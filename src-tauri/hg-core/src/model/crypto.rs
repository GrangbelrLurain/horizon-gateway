use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum CryptoAction {
    Base64Encode,
    Base64Decode,
    UrlEncode,
    UrlDecode,
    HexEncode,
    HexDecode,
    JwtDecode,
    AesEncrypt,
    AesDecrypt,
    Sha256,
    HmacSha256,
}
