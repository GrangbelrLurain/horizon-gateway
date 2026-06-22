use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use super::super::dns::connect_for_connect;

/// Pass-through CONNECT tunnel: 200 Established + bidirectional copy.
pub(crate) async fn handle_connect_passthrough(
    mut client: TcpStream,
    host: &str,
    port: u16,
    resolver: Option<&std::sync::Arc<super::super::dns::TokioResolver>>,
    header_buf: Vec<u8>,
) {
    let mut upstream = match connect_for_connect(host, port, resolver).await {
        Ok(s) => s,
        Err(_e) => {
            let _ = client
                .write_all(
                    b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
                )
                .await;
            return;
        }
    };
    let response = b"HTTP/1.1 200 Connection Established\r\n\r\n";
    if client.write_all(response).await.is_err() {
        return;
    }
    let body_start = header_buf
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .map_or(header_buf.len(), |i| i + 4);
    if body_start < header_buf.len() {
        let _ = upstream.write_all(&header_buf[body_start..]).await;
    }
    let (mut client_r, mut client_w) = client.into_split();
    let (mut up_r, mut up_w) = upstream.into_split();
    let t1 = tokio::spawn(async move { tokio::io::copy(&mut client_r, &mut up_w).await });
    let t2 = tokio::spawn(async move { tokio::io::copy(&mut up_r, &mut client_w).await });
    let _ = t1.await;
    let _ = t2.await;
}
