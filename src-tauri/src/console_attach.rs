//! Attach a GUI-subsystem Windows binary to the parent console for `cli` mode.
//!
//! Release builds use `windows_subsystem = "windows"`, so PowerShell may return
//! before stdout is visible unless we attach and rebind stdio handles first.

#[cfg(windows)]
pub fn attach_for_cli() {
    const ATTACH_PARENT_PROCESS: u32 = 0xFFFF_FFFF;
    const ERROR_ACCESS_DENIED: u32 = 5;

    extern "system" {
        fn AttachConsole(dw_process_id: u32) -> i32;
        fn GetLastError() -> u32;
    }

    unsafe {
        if AttachConsole(ATTACH_PARENT_PROCESS) == 0 {
            let err = GetLastError();
            if err != ERROR_ACCESS_DENIED {
                return;
            }
        }
    }

    rebind_stdio();
}

#[cfg(windows)]
fn rebind_stdio() {
    use std::fs::OpenOptions;
    use std::mem;
    use std::os::windows::io::AsRawHandle;

    const STD_INPUT_HANDLE: u32 = 0xFFFF_FFF6;
    const STD_OUTPUT_HANDLE: u32 = 0xFFFF_FFF5;
    const STD_ERROR_HANDLE: u32 = 0xFFFF_FFF4;

    extern "system" {
        fn SetStdHandle(n_std_handle: u32, handle: *mut std::ffi::c_void) -> i32;
    }

    let Ok(conout) = OpenOptions::new().write(true).open("CONOUT$") else {
        return;
    };
    let Ok(conerr) = OpenOptions::new().write(true).open("CONOUT$") else {
        return;
    };
    let Ok(conin) = OpenOptions::new().read(true).open("CONIN$") else {
        return;
    };

    let out_handle = conout.as_raw_handle();
    let err_handle = conerr.as_raw_handle();
    let in_handle = conin.as_raw_handle();

    unsafe {
        let _ = SetStdHandle(STD_OUTPUT_HANDLE, out_handle as *mut std::ffi::c_void);
        let _ = SetStdHandle(STD_ERROR_HANDLE, err_handle as *mut std::ffi::c_void);
        let _ = SetStdHandle(STD_INPUT_HANDLE, in_handle as *mut std::ffi::c_void);
    }

    mem::forget(conout);
    mem::forget(conerr);
    mem::forget(conin);
}

#[cfg(not(windows))]
pub fn attach_for_cli() {}
