//! System tray owned by the serve process (the long-running app body).

use std::path::{Path, PathBuf};

pub fn start() {
    #[cfg(windows)]
    windows::start();
    #[cfg(not(windows))]
    unix::start();
}

pub(crate) fn gui_exe_names() -> &'static [&'static str] {
    if cfg!(windows) {
        &["horizon-gateway.exe"]
    } else {
        &["horizon-gateway"]
    }
}

pub(crate) fn gui_exe_from_dir(dir: &Path) -> Option<PathBuf> {
    gui_exe_names()
        .iter()
        .map(|name| dir.join(name))
        .find(|p| p.is_file())
}

/// Resolve the GUI binary next to serve, including macOS bundle layouts.
pub(crate) fn gui_exe_near(dir: &Path) -> Option<PathBuf> {
    if let Some(path) = gui_exe_from_dir(dir) {
        return Some(path);
    }
    let name = dir.file_name()?.to_str()?;
    if name.eq_ignore_ascii_case("Resources") {
        return gui_exe_from_dir(&dir.parent()?.join("MacOS"));
    }
    if let Some(parent) = dir.parent() {
        if let Some(path) = gui_exe_from_dir(parent) {
            return Some(path);
        }
        if let Some(path) = gui_exe_from_dir(&parent.join("bin")) {
            return Some(path);
        }
    }
    None
}

fn find_gui_exe() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .and_then(|dir| gui_exe_near(&dir))
}

fn open_gui() {
    crate::serve::publish_event("show-main-window", ());
    let Some(exe) = find_gui_exe() else {
        tracing::warn!("[serve] tray: GUI executable not found next to serve");
        return;
    };
    #[cfg(windows)]
    windows::launch_gui(&exe);
    #[cfg(not(windows))]
    unix::launch_gui(&exe);
}

pub(crate) fn quit_serve() {
    let _ = crate::command::local_route_commands::stop_local_proxy_svc(None);
    let _ = crate::command::transparent_proxy_commands::stop_transparent_proxy_svc();
    crate::serve::publish_event("serve-stopping", ());
    std::thread::sleep(std::time::Duration::from_millis(250));
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gui_exe_name_matches_shell() {
        assert_eq!(gui_exe_names()[0].replace(".exe", ""), "horizon-gateway");
    }

    #[test]
    fn gui_exe_from_dir_skips_missing() {
        let dir = std::env::temp_dir();
        assert!(gui_exe_from_dir(&dir.join("horizon-gateway-missing-dir-xyz")).is_none());
    }

    #[test]
    fn gui_exe_from_dir_finds_present() {
        let dir = std::env::temp_dir().join(format!("hg-tray-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let exe = dir.join(gui_exe_names()[0]);
        std::fs::write(&exe, b"").expect("touch gui exe");
        assert_eq!(gui_exe_from_dir(&dir).as_deref(), Some(exe.as_path()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn gui_exe_near_finds_macos_resources_layout() {
        let root = std::env::temp_dir().join(format!("hg-tray-bundle-{}", std::process::id()));
        let macos = root.join("Contents").join("MacOS");
        let resources = root.join("Contents").join("Resources");
        std::fs::create_dir_all(&macos).expect("macos dir");
        std::fs::create_dir_all(&resources).expect("resources dir");
        let exe = macos.join(gui_exe_names()[0]);
        std::fs::write(&exe, b"").expect("touch gui exe");
        assert_eq!(gui_exe_near(&resources).as_deref(), Some(exe.as_path()));
        let _ = std::fs::remove_dir_all(&root);
    }
}

#[cfg(not(windows))]
mod unix {
    use std::path::Path;

    use tao::event::{Event, StartCause};
    use tao::event_loop::{ControlFlow, EventLoopBuilder};
    use tray_icon::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
    use tray_icon::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    enum UserEvent {
        TrayIconEvent(TrayIconEvent),
        MenuEvent(MenuEvent),
    }

    pub fn start() {
        let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();

        let proxy = event_loop.create_proxy();
        TrayIconEvent::set_event_handler(Some(move |event| {
            let _ = proxy.send_event(UserEvent::TrayIconEvent(event));
        }));
        let proxy = event_loop.create_proxy();
        MenuEvent::set_event_handler(Some(move |event| {
            let _ = proxy.send_event(UserEvent::MenuEvent(event));
        }));

        let tray_menu = Menu::new();
        let open_i = MenuItem::new("Open Horizon Gateway", true, None);
        let quit_i = MenuItem::new("Quit", true, None);
        let _ = tray_menu.append_items(&[&open_i, &PredefinedMenuItem::separator(), &quit_i]);

        let mut tray_icon = None;
        event_loop.run(move |event, _, control_flow| {
            *control_flow = ControlFlow::Wait;
            match event {
                Event::NewEvents(StartCause::Init) => match load_icon() {
                    Ok(icon) => {
                        match TrayIconBuilder::new()
                            .with_menu(Box::new(tray_menu.clone()))
                            .with_tooltip("Horizon Gateway")
                            .with_icon(icon)
                            .build()
                        {
                            Ok(icon) => {
                                tray_icon = Some(icon);
                                tracing::info!("[serve] tray icon ready");
                            }
                            Err(e) => tracing::warn!("[serve] tray: {e}"),
                        }
                    }
                    Err(e) => tracing::warn!("[serve] tray icon: {e}"),
                },
                Event::UserEvent(UserEvent::TrayIconEvent(event)) => {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        super::open_gui();
                    }
                }
                Event::UserEvent(UserEvent::MenuEvent(event)) => {
                    if event.id == open_i.id() {
                        super::open_gui();
                    } else if event.id == quit_i.id() {
                        tray_icon.take();
                        super::quit_serve();
                    }
                }
                _ => {}
            }
        });
    }

    pub fn launch_gui(exe: &Path) {
        #[cfg(target_os = "macos")]
        {
            if let Some(app) = exe
                .ancestors()
                .find(|p| p.extension().and_then(|ext| ext.to_str()) == Some("app"))
            {
                if let Err(e) = std::process::Command::new("open").arg(app).spawn() {
                    tracing::warn!("[serve] tray: failed to open app bundle: {e}");
                }
                return;
            }
        }
        if let Err(e) = std::process::Command::new(exe).spawn() {
            tracing::warn!("[serve] tray: failed to launch GUI: {e}");
        }
    }

    fn load_icon() -> Result<tray_icon::Icon, String> {
        const PNG: &[u8] = include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../hg-gui/icons/32x32.png"
        ));
        decode_png_icon(PNG)
    }

    fn decode_png_icon(bytes: &[u8]) -> Result<tray_icon::Icon, String> {
        let mut decoder = png::Decoder::new(std::io::Cursor::new(bytes));
        decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::ALPHA);
        let mut reader = decoder.read_info().map_err(|e| format!("png: {e}"))?;
        let mut buf = vec![0; reader.output_buffer_size()];
        let info = reader
            .next_frame(&mut buf)
            .map_err(|e| format!("png frame: {e}"))?;
        buf.truncate(info.buffer_size());
        tray_icon::Icon::from_rgba(buf, info.width, info.height).map_err(|e| e.to_string())
    }
}

#[cfg(windows)]
#[allow(unsafe_code)]
mod windows {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::ptr;

    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteW, Shell_NotifyIconW, NIF_ICON, NIF_MESSAGE, NIF_TIP, NIM_ADD, NIM_DELETE,
        NOTIFYICONDATAW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        AppendMenuW, CreatePopupMenu, CreateWindowExW, DefWindowProcW, DestroyIcon, DestroyMenu,
        DestroyWindow, DispatchMessageW, GetCursorPos, GetMessageW, LoadIconW, LoadImageW,
        PostQuitMessage, RegisterClassW, SetForegroundWindow, TrackPopupMenu, TranslateMessage,
        UnregisterClassW, HICON, HMENU, IDI_APPLICATION, IMAGE_ICON, LR_DEFAULTSIZE,
        LR_LOADFROMFILE, MF_STRING, MSG, SW_SHOWNORMAL, TPM_RIGHTBUTTON, WM_COMMAND, WM_DESTROY,
        WM_LBUTTONUP, WM_RBUTTONUP, WM_USER, WNDCLASSW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        WS_POPUP,
    };

    const WM_TRAY: u32 = WM_USER + 32;
    const ID_OPEN: usize = 1;
    const ID_QUIT: usize = 2;
    const TRAY_UID: u32 = 1;

    pub fn start() {
        let _ = std::thread::Builder::new()
            .name("serve-tray".into())
            .spawn(|| {
                if let Err(e) = run_message_loop() {
                    tracing::warn!("[serve] tray: {e}");
                }
            });
    }

    pub fn launch_gui(exe: &Path) {
        let exe_w = wide(&exe.to_string_lossy());
        let verb = wide("open");
        let work_dir = exe.parent().map(|p| wide(&p.to_string_lossy()));
        let result = unsafe {
            ShellExecuteW(
                ptr::null_mut(),
                verb.as_ptr(),
                exe_w.as_ptr(),
                ptr::null(),
                work_dir.as_ref().map_or(ptr::null(), |p| p.as_ptr()),
                SW_SHOWNORMAL,
            )
        };
        if result as isize <= 32 {
            tracing::warn!(
                "[serve] tray: failed to launch GUI (ShellExecute={})",
                result as i32
            );
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn icon_candidates() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                paths.push(dir.join("icon.ico"));
                paths.push(dir.join("resources").join("icon.ico"));
            }
        }
        paths.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("hg-gui")
                .join("icons")
                .join("icon.ico"),
        );
        paths
    }

    fn load_icon() -> HICON {
        for path in icon_candidates() {
            if !path.is_file() {
                continue;
            }
            let w = wide(&path.to_string_lossy());
            let icon = unsafe {
                LoadImageW(
                    ptr::null_mut(),
                    w.as_ptr(),
                    IMAGE_ICON,
                    0,
                    0,
                    LR_LOADFROMFILE | LR_DEFAULTSIZE,
                )
            };
            if !icon.is_null() {
                return icon as HICON;
            }
        }
        unsafe { LoadIconW(ptr::null_mut(), IDI_APPLICATION) }
    }

    fn show_menu(hwnd: HWND) {
        unsafe {
            let menu: HMENU = CreatePopupMenu();
            if menu.is_null() {
                return;
            }
            let open = wide("Open Horizon Gateway");
            let quit = wide("Quit");
            let _ = AppendMenuW(menu, MF_STRING, ID_OPEN, open.as_ptr());
            let _ = AppendMenuW(menu, MF_STRING, ID_QUIT, quit.as_ptr());
            let mut pt = POINT { x: 0, y: 0 };
            let _ = GetCursorPos(&mut pt);
            let _ = SetForegroundWindow(hwnd);
            let _ = TrackPopupMenu(menu, TPM_RIGHTBUTTON, pt.x, pt.y, 0, hwnd, ptr::null());
            let _ = DestroyMenu(menu);
        }
    }

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_TRAY => {
                let event = lparam as u32;
                if event == WM_LBUTTONUP {
                    super::open_gui();
                } else if event == WM_RBUTTONUP {
                    show_menu(hwnd);
                }
                0
            }
            WM_COMMAND => {
                match wparam as usize & 0xffff {
                    ID_OPEN => super::open_gui(),
                    ID_QUIT => super::quit_serve(),
                    _ => {}
                }
                0
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                0
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }

    fn run_message_loop() -> Result<(), String> {
        let class_name = wide("HorizonGatewayServeTray");
        let hinstance = unsafe { GetModuleHandleW(ptr::null()) };
        let class = WNDCLASSW {
            style: 0,
            lpfnWndProc: Some(wnd_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinstance,
            hIcon: ptr::null_mut(),
            hCursor: ptr::null_mut(),
            hbrBackground: ptr::null_mut(),
            lpszMenuName: ptr::null(),
            lpszClassName: class_name.as_ptr(),
        };
        let atom = unsafe { RegisterClassW(&class) };
        if atom == 0 {
            return Err("RegisterClassW failed".into());
        }

        let title = wide("Horizon Gateway");
        let hwnd = unsafe {
            CreateWindowExW(
                WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
                class_name.as_ptr(),
                title.as_ptr(),
                WS_POPUP,
                0,
                0,
                0,
                0,
                ptr::null_mut(),
                ptr::null_mut(),
                hinstance,
                ptr::null(),
            )
        };
        if hwnd.is_null() {
            unsafe { UnregisterClassW(class_name.as_ptr(), hinstance) };
            return Err("CreateWindowExW failed".into());
        }

        let icon = load_icon();
        let mut nid = unsafe { std::mem::zeroed::<NOTIFYICONDATAW>() };
        nid.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
        nid.hWnd = hwnd;
        nid.uID = TRAY_UID;
        nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
        nid.uCallbackMessage = WM_TRAY;
        nid.hIcon = icon;
        let tip = wide("Horizon Gateway");
        for (i, ch) in tip
            .iter()
            .take(nid.szTip.len().saturating_sub(1))
            .enumerate()
        {
            nid.szTip[i] = *ch;
        }

        let added = unsafe { Shell_NotifyIconW(NIM_ADD, &nid) };
        if added == 0 {
            unsafe {
                DestroyWindow(hwnd);
                UnregisterClassW(class_name.as_ptr(), hinstance);
            }
            return Err("Shell_NotifyIconW NIM_ADD failed".into());
        }

        tracing::info!("[serve] tray icon ready");

        let mut msg = unsafe { std::mem::zeroed::<MSG>() };
        loop {
            let status = unsafe { GetMessageW(&mut msg, ptr::null_mut(), 0, 0) };
            if status == 0 || status == -1 {
                break;
            }
            unsafe {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }

        unsafe {
            let _ = Shell_NotifyIconW(NIM_DELETE, &nid);
            if !icon.is_null() {
                let _ = DestroyIcon(icon);
            }
            DestroyWindow(hwnd);
            UnregisterClassW(class_name.as_ptr(), hinstance);
        }
        Ok(())
    }
}
