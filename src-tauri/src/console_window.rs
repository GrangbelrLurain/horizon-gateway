//! Windows console window management.
//!
//! Release builds use the default console subsystem so `cli` pipes and spawn
//! redirection work reliably. Hide the console when launching the GUI.

#[cfg(all(windows, not(debug_assertions)))]
pub fn hide_for_gui() {
    extern "system" {
        fn GetConsoleWindow() -> *mut std::ffi::c_void;
        fn ShowWindow(hwnd: *mut std::ffi::c_void, n_cmd_show: i32) -> i32;
    }

    const SW_HIDE: i32 = 0;

    unsafe {
        let hwnd = GetConsoleWindow();
        if !hwnd.is_null() {
            ShowWindow(hwnd, SW_HIDE);
        }
    }
}

#[cfg(any(not(windows), debug_assertions))]
pub fn hide_for_gui() {}
