//! Windows console handling for release GUI vs CLI launches.
//!
//! Release binaries use `windows_subsystem = "windows"` so Explorer / Start Menu
//! never create a console window. CLI mode attaches to the parent console only
//! when stdout/stderr are not already redirected (pipes/files), so agent `spawn`
//! and file redirection keep working.

#[cfg(all(windows, not(debug_assertions)))]
pub fn attach_for_cli() {
    const ATTACH_PARENT_PROCESS: u32 = 0xFFFF_FFFF;
    const ERROR_ACCESS_DENIED: u32 = 5;

    extern "system" {
        fn AttachConsole(dw_process_id: u32) -> i32;
        fn GetLastError() -> u32;
    }

    // STD_OUTPUT_HANDLE / STD_ERROR_HANDLE
    if stdio_is_redirected(-11) || stdio_is_redirected(-12) {
        return;
    }

    unsafe {
        if AttachConsole(ATTACH_PARENT_PROCESS) == 0 {
            let err = GetLastError();
            // Already attached (e.g. nested launch) — fine.
            if err != ERROR_ACCESS_DENIED {
                return;
            }
        }
    }
}

#[cfg(all(windows, not(debug_assertions)))]
fn stdio_is_redirected(n_std_handle: i32) -> bool {
    extern "system" {
        fn GetStdHandle(n_std_handle: i32) -> *mut std::ffi::c_void;
        fn GetFileType(h_file: *mut std::ffi::c_void) -> u32;
    }

    unsafe {
        let handle = GetStdHandle(n_std_handle);
        if handle.is_null() || handle as isize == -1 {
            return false;
        }
        let file_type = GetFileType(handle);
        // FILE_TYPE_DISK (1) or FILE_TYPE_PIPE (3)
        file_type == 1 || file_type == 3
    }
}

#[cfg(any(not(windows), debug_assertions))]
pub fn attach_for_cli() {}
