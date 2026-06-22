use std::io::Cursor;
use std::task::{Context, Poll};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, ReadBuf};
use tokio::net::TcpStream;

pub(crate) struct PrependIo {
    buf: Cursor<Vec<u8>>,
    stream: TcpStream,
}

impl PrependIo {
    pub(crate) fn new(buf: Vec<u8>, stream: TcpStream) -> Self {
        Self {
            buf: Cursor::new(buf),
            stream,
        }
    }
}

impl AsyncRead for PrependIo {
    fn poll_read(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        let buf_len = self.buf.get_ref().len();
        let pos = self.buf.position();
        if pos < buf_len as u64 {
            let remain = (buf_len as u64 - pos) as usize;
            let n = remain.min(buf.remaining());
            let start = pos as usize;
            buf.put_slice(&self.buf.get_ref()[start..start + n]);
            self.buf.set_position(pos + n as u64);
            return Poll::Ready(Ok(()));
        }
        AsyncRead::poll_read(std::pin::Pin::new(&mut self.stream), cx, buf)
    }
}

impl AsyncWrite for PrependIo {
    fn poll_write(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        AsyncWrite::poll_write(std::pin::Pin::new(&mut self.stream), cx, buf)
    }
    fn poll_flush(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        AsyncWrite::poll_flush(std::pin::Pin::new(&mut self.stream), cx)
    }
    fn poll_shutdown(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        AsyncWrite::poll_shutdown(std::pin::Pin::new(&mut self.stream), cx)
    }
}
const MAX_HEADER_LEN: usize = 8192;

/// Read from stream until \r\n\r\n or max size. Returns the buffer.
pub(crate) async fn read_request_headers(stream: &mut TcpStream) -> std::io::Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(1024);
    let mut search = 0usize;
    loop {
        if buf.len() >= MAX_HEADER_LEN {
            break Ok(buf);
        }
        let mut tmp = [0u8; 256];
        let n = AsyncReadExt::read(stream, &mut tmp).await?;
        if n == 0 {
            break Ok(buf);
        }
        buf.extend_from_slice(&tmp[..n]);
        while search + 3 < buf.len() {
            if buf[search] == b'\r'
                && buf[search + 1] == b'\n'
                && buf[search + 2] == b'\r'
                && buf[search + 3] == b'\n'
            {
                return Ok(buf);
            }
            search += 1;
        }
    }
}

/// Parse first line for CONNECT: "CONNECT host:port HTTP/1.x" -> (host, port).
pub(crate) fn parse_connect_target(first_line: &str) -> Option<(String, u16)> {
    let first_line = first_line.trim();
    if !first_line.to_uppercase().starts_with("CONNECT ") {
        return None;
    }
    let rest = first_line
        .strip_prefix("CONNECT ")
        .unwrap_or(first_line)
        .trim();
    let authority = rest.split_whitespace().next()?;
    let (host, port_str) = authority.split_once(':').unwrap_or((authority, "443"));
    let port: u16 = port_str.parse().ok().unwrap_or(443);
    Some((host.to_string(), port))
}
