use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use tokio::task::JoinHandle;

static TRANSPARENT_RUNNING: AtomicBool = AtomicBool::new(false);
static TRANSPARENT_PORT: AtomicU16 = AtomicU16::new(0);
static TRANSPARENT_HANDLE: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TransparentProxyStatus {
    pub running: bool,
    pub target_port: u16,
    pub active_connections: u32,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct SessionKey {
    src_ip: Ipv4Addr,
    src_port: u16,
}

#[derive(Debug, Clone)]
struct SessionVal {
    orig_dst_ip: Ipv4Addr,
    orig_dst_port: u16,
}

type NatTable = Arc<Mutex<HashMap<SessionKey, SessionVal>>>;

static NAT_TABLE: std::sync::LazyLock<NatTable> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

pub struct TransparentProxyService;

impl TransparentProxyService {
    /// Copy bundled WinDivert sidecars next to the exe when missing (MSI/NSIS resource layouts).
    pub fn ensure_runtime_sidecars() {
        #[cfg(target_os = "windows")]
        if let Err(e) = ensure_windivert_sidecars() {
            tracing::warn!("[transparent-proxy] sidecar prepare: {e}");
        }
    }

    pub fn get_status() -> TransparentProxyStatus {
        let active = if let Ok(guard) = NAT_TABLE.lock() {
            guard.len() as u32
        } else {
            0
        };

        TransparentProxyStatus {
            running: TRANSPARENT_RUNNING.load(Ordering::Relaxed),
            target_port: TRANSPARENT_PORT.load(Ordering::Relaxed),
            active_connections: active,
            error_message: None,
        }
    }

    #[cfg(target_os = "windows")]
    pub fn start(target_proxy_port: u16) -> Result<TransparentProxyStatus, String> {
        if TRANSPARENT_RUNNING.load(Ordering::Relaxed) {
            return Ok(Self::get_status());
        }

        ensure_windivert_sidecars()?;

        let pid = std::process::id();
        let filter = format!(
            "outbound and ip and (tcp.DstPort == 80 or tcp.DstPort == 443) and processId != {pid}"
        );

        let handle = match windivert::WinDivert::network(&filter, 0, windivert::prelude::WinDivertFlags::default()) {
            Ok(driver) => driver,
            Err(_) => {
                let fallback_filter = "outbound and ip and (tcp.DstPort == 80 or tcp.DstPort == 443)";
                match windivert::WinDivert::network(fallback_filter, 0, windivert::prelude::WinDivertFlags::default()) {
                    Ok(driver) => driver,
                    Err(e) => {
                        return Err(format!(
                            "Failed to initialize WinDivert driver (Administrator privileges required): {e}"
                        ));
                    }
                }
            }
        };

        TRANSPARENT_RUNNING.store(true, Ordering::Relaxed);
        TRANSPARENT_PORT.store(target_proxy_port, Ordering::Relaxed);

        let nat_table = Arc::clone(&NAT_TABLE);

        let join_handle = tokio::spawn(async move {
            tracing::info!("[transparent-proxy] WinDivert NAT worker started for target port {}", target_proxy_port);
            let mut packet_buf = vec![0u8; 65535];
            let target_ip = Ipv4Addr::new(127, 0, 0, 1);

            while TRANSPARENT_RUNNING.load(Ordering::Relaxed) {
                match handle.recv(Some(&mut packet_buf)) {
                    Ok(mut packet) => {
                        if let Ok(sliced) = etherparse::SlicedPacket::from_ip(&packet.data) {
                            if let (Some(etherparse::InternetSlice::Ipv4(ref ip_hdr, _)), Some(etherparse::TransportSlice::Tcp(ref tcp_hdr))) =
                                (sliced.ip.as_ref(), sliced.transport.as_ref())
                            {
                                let src_ip = ip_hdr.source_addr();
                                let src_port = tcp_hdr.source_port();
                                let orig_dst_ip = ip_hdr.destination_addr();
                                let orig_dst_port = tcp_hdr.destination_port();

                                if let Ok(mut table) = nat_table.lock() {
                                    table.insert(
                                        SessionKey { src_ip, src_port },
                                        SessionVal { orig_dst_ip, orig_dst_port },
                                    );
                                }

                                rewrite_ipv4_tcp_dst(packet.data.to_mut(), target_ip, target_proxy_port);
                            }
                        }

                        let _ = handle.send(&packet);
                    }
                    Err(_) => {
                        if !TRANSPARENT_RUNNING.load(Ordering::Relaxed) {
                            break;
                        }
                    }
                }
            }
            tracing::info!("[transparent-proxy] WinDivert NAT worker stopped");
        });

        if let Ok(mut guard) = TRANSPARENT_HANDLE.lock() {
            *guard = Some(join_handle);
        }

        Ok(Self::get_status())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn start(_target_proxy_port: u16) -> Result<TransparentProxyStatus, String> {
        Err("Transparent proxy via WinDivert is currently supported on Windows only.".to_string())
    }

    pub fn stop() -> Result<TransparentProxyStatus, String> {
        TRANSPARENT_RUNNING.store(false, Ordering::Relaxed);
        TRANSPARENT_PORT.store(0, Ordering::Relaxed);

        if let Ok(mut table) = NAT_TABLE.lock() {
            table.clear();
        }

        if let Ok(mut guard) = TRANSPARENT_HANDLE.lock() {
            if let Some(h) = guard.take() {
                h.abort();
            }
        }

        Ok(Self::get_status())
    }
}

/// Ensure official WinDivert sidecars sit next to the executable (required by WinDivertOpen).
#[cfg(target_os = "windows")]
fn ensure_windivert_sidecars() -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;

    let exe = std::env::current_exe().map_err(|e| format!("current_exe failed: {e}"))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "current_exe has no parent directory".to_string())?
        .to_path_buf();

    let names = ["WinDivert.dll", "WinDivert64.sys"];
    let missing: Vec<&str> = names
        .iter()
        .copied()
        .filter(|n| !exe_dir.join(n).is_file())
        .collect();
    if missing.is_empty() {
        return Ok(());
    }

    let mut search_roots: Vec<PathBuf> = Vec::new();
    search_roots.push(exe_dir.join("resources"));
    search_roots.push(exe_dir.clone());
    if let Ok(cwd) = std::env::current_dir() {
        search_roots.push(cwd.join("resources").join("windivert"));
        search_roots.push(cwd.join("src-tauri").join("resources").join("windivert"));
    }

    for name in missing {
        let dest = exe_dir.join(name);
        let mut copied = false;
        for root in &search_roots {
            let src = root.join(name);
            if src.is_file() {
                fs::copy(&src, &dest).map_err(|e| {
                    format!("failed to copy {} -> {}: {e}", src.display(), dest.display())
                })?;
                tracing::info!(
                    "[transparent-proxy] installed sidecar {} from {}",
                    name,
                    src.display()
                );
                copied = true;
                break;
            }
        }
        if !copied && name.ends_with(".sys") {
            return Err(format!(
                "WinDivert driver missing ({name}). Reinstall Horizon Gateway or place {name} next to the executable."
            ));
        }
        // DLL may be optional when the crate is statically linked.
        if !copied {
            tracing::warn!(
                "[transparent-proxy] optional sidecar not found: {name}"
            );
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn ensure_windivert_sidecars() -> Result<(), String> {
    Ok(())
}

/// Helper function to modify IPv4 Dst IP and TCP Dst Port in-place in raw IP packet buffer
fn rewrite_ipv4_tcp_dst(buf: &mut [u8], new_dst_ip: Ipv4Addr, new_dst_port: u16) {
    if buf.len() < 40 {
        return;
    }

    let ip_header_len = ((buf[0] & 0x0f) * 4) as usize;
    if buf.len() < ip_header_len + 20 {
        return;
    }

    // Set IPv4 Dst IP (bytes 16..20)
    let ip_octets = new_dst_ip.octets();
    buf[16..20].copy_from_slice(&ip_octets);

    // Set TCP Dst Port (bytes ip_header_len+2 .. ip_header_len+4)
    let port_bytes = new_dst_port.to_be_bytes();
    buf[ip_header_len + 2..ip_header_len + 4].copy_from_slice(&port_bytes);

    // Clear checksums so WinDivert recalculates them automatically upon send
    buf[10..12].copy_from_slice(&[0, 0]); // IP checksum
    buf[ip_header_len + 16..ip_header_len + 18].copy_from_slice(&[0, 0]); // TCP checksum
}
