use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use hmac::{Hmac, Mac};
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD, engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL_SAFE};

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

pub struct CryptoService;

impl CryptoService {
    pub fn new() -> Self {
        Self
    }

    /// JSON Schema Draft 7 / 2020-12 Validation using `jsonschema` crate
    pub fn validate_json_schema(&self, payload: &str, schema: &str) -> Result<(), String> {
        let payload_json: serde_json::Value = serde_json::from_str(payload)
            .map_err(|e| format!("Invalid payload JSON: {}", e))?;
        let schema_json: serde_json::Value = serde_json::from_str(schema)
            .map_err(|e| format!("Invalid schema JSON: {}", e))?;

        let validator = jsonschema::validator_for(&schema_json)
            .map_err(|e| format!("Schema compilation failed: {}", e))?;

        if let Err(err) = validator.validate(&payload_json) {
            return Err(err.to_string());
        }

        Ok(())
    }

    /// Main cryptographic & encoding execution entrypoint
    pub fn process_crypto(
        &self,
        action: CryptoAction,
        payload: &str,
        key: Option<&str>,
        iv: Option<&str>,
    ) -> Result<String, String> {
        match action {
            CryptoAction::Base64Encode => {
                Ok(BASE64_STANDARD.encode(payload.as_bytes()))
            }
            CryptoAction::Base64Decode => {
                let decoded = BASE64_STANDARD.decode(payload.trim())
                    .map_err(|e| format!("Base64 decode failed: {}", e))?;
                String::from_utf8(decoded)
                    .map_err(|e| format!("UTF-8 decode failed: {}", e))
            }
            CryptoAction::UrlEncode => {
                Ok(urlencoding::encode(payload).into_owned())
            }
            CryptoAction::UrlDecode => {
                urlencoding::decode(payload)
                    .map(|cow| cow.into_owned())
                    .map_err(|e| format!("URL decode failed: {}", e))
            }
            CryptoAction::HexEncode => {
                Ok(hex::encode(payload.as_bytes()))
            }
            CryptoAction::HexDecode => {
                let decoded = hex::decode(payload.trim())
                    .map_err(|e| format!("Hex decode failed: {}", e))?;
                String::from_utf8(decoded)
                    .map_err(|e| format!("UTF-8 decode failed: {}", e))
            }
            CryptoAction::JwtDecode => {
                self.decode_jwt(payload, key)
            }
            CryptoAction::AesEncrypt => {
                let k_str = key.ok_or_else(|| "Key is required for AES encryption".to_string())?;
                let iv_str = iv.ok_or_else(|| "IV is required for AES encryption".to_string())?;
                self.aes_encrypt(payload, k_str, iv_str)
            }
            CryptoAction::AesDecrypt => {
                let k_str = key.ok_or_else(|| "Key is required for AES decryption".to_string())?;
                let iv_str = iv.ok_or_else(|| "IV is required for AES decryption".to_string())?;
                self.aes_decrypt(payload, k_str, iv_str)
            }
            CryptoAction::Sha256 => {
                let mut hasher = Sha256::new();
                hasher.update(payload.as_bytes());
                Ok(hex::encode(hasher.finalize()))
            }
            CryptoAction::HmacSha256 => {
                let k_str = key.ok_or_else(|| "Key is required for HMAC-SHA256".to_string())?;
                type HmacSha256Type = Hmac<Sha256>;
                let mut mac = <HmacSha256Type as hmac::Mac>::new_from_slice(k_str.as_bytes())
                    .map_err(|e| format!("HMAC key initialization failed: {}", e))?;
                mac.update(payload.as_bytes());
                Ok(hex::encode(mac.finalize().into_bytes()))
            }
        }
    }

    /// Derives a 32-byte key from the provided string (hex parse or sha256 fallback)
    fn derive_aes_key(&self, key_str: &str) -> [u8; 32] {
        if key_str.len() == 64 {
            if let Ok(hex_key) = hex::decode(key_str) {
                if hex_key.len() == 32 {
                    let mut k = [0u8; 32];
                    k.copy_from_slice(&hex_key);
                    return k;
                }
            }
        }
        let mut hasher = Sha256::new();
        hasher.update(key_str.as_bytes());
        let result = hasher.finalize();
        let mut k = [0u8; 32];
        k.copy_from_slice(&result);
        k
    }

    /// Derives a 12-byte IV/nonce from the provided string (hex parse or sha256 slice fallback)
    fn derive_aes_nonce(&self, iv_str: &str) -> [u8; 12] {
        if iv_str.len() == 24 {
            if let Ok(hex_iv) = hex::decode(iv_str) {
                if hex_iv.len() == 12 {
                    let mut iv = [0u8; 12];
                    iv.copy_from_slice(&hex_iv);
                    return iv;
                }
            }
        }
        let mut hasher = Sha256::new();
        hasher.update(iv_str.as_bytes());
        let result = hasher.finalize();
        let mut iv = [0u8; 12];
        iv.copy_from_slice(&result[0..12]);
        iv
    }

    /// AES-256-GCM Encryption (Resulting ciphertext is Base64-encoded)
    fn aes_encrypt(&self, plaintext: &str, key_str: &str, iv_str: &str) -> Result<String, String> {
        let key_bytes = self.derive_aes_key(key_str);
        let nonce_bytes = self.derive_aes_nonce(iv_str);

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let cipher = Aes256Gcm::new(key);

        let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("AES encryption failed: {}", e))?;

        Ok(BASE64_STANDARD.encode(ciphertext))
    }

    /// AES-256-GCM Decryption (Input ciphertext should be Base64-encoded)
    fn aes_decrypt(&self, ciphertext_base64: &str, key_str: &str, iv_str: &str) -> Result<String, String> {
        let key_bytes = self.derive_aes_key(key_str);
        let nonce_bytes = self.derive_aes_nonce(iv_str);

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let cipher = Aes256Gcm::new(key);

        let ciphertext = BASE64_STANDARD.decode(ciphertext_base64.trim())
            .map_err(|e| format!("Base64 decode of ciphertext failed: {}", e))?;

        let decrypted = cipher.decrypt(nonce, ciphertext.as_slice())
            .map_err(|e| format!("AES decryption failed: {}", e))?;

        String::from_utf8(decrypted)
            .map_err(|e| format!("UTF-8 decode of decrypted text failed: {}", e))
    }

    /// JWT Decoder (Optionally verifies signature if a key is provided)
    fn decode_jwt(&self, token: &str, key: Option<&str>) -> Result<String, String> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() < 2 {
            return Err("Invalid JWT: token must contain at least a header and payload separated by a dot".to_string());
        }

        // Insecure parse (always decoded so the user can inspect it)
        let decode_part = |part: &str| -> Result<serde_json::Value, String> {
            let decoded = BASE64_URL_SAFE.decode(part)
                .map_err(|e| format!("Base64Url decode failed: {}", e))?;
            serde_json::from_slice(&decoded)
                .map_err(|e| format!("JSON parse failed: {}", e))
        };

        let header_json = decode_part(parts[0])?;
        let payload_json = decode_part(parts[1])?;

        let mut result = serde_json::json!({
            "header": header_json,
            "payload": payload_json,
            "signatureVerified": false
        });

        // Optional signature verification
        if let Some(k_str) = key {
            if !k_str.is_empty() {
                // Determine algorithm from header (default to HS256)
                let alg_str = header_json.get("alg")
                    .and_then(|v| v.as_str())
                    .unwrap_or("HS256");

                let validation = jsonwebtoken::Validation::new(
                    self.parse_jwt_algorithm(alg_str)
                        .unwrap_or(jsonwebtoken::Algorithm::HS256)
                );

                let decoding_key = if alg_str.starts_with("HS") {
                    jsonwebtoken::DecodingKey::from_secret(k_str.as_bytes())
                } else {
                    // RSA/EC public key
                    jsonwebtoken::DecodingKey::from_rsa_pem(k_str.as_bytes())
                        .or_else(|_| jsonwebtoken::DecodingKey::from_ec_pem(k_str.as_bytes()))
                        .or_else(|_| jsonwebtoken::DecodingKey::from_ed_pem(k_str.as_bytes()))
                        .unwrap_or_else(|_| jsonwebtoken::DecodingKey::from_secret(k_str.as_bytes()))
                };

                let verify_result: Result<jsonwebtoken::TokenData<HashMap<String, serde_json::Value>>, _> = 
                    jsonwebtoken::decode(token, &decoding_key, &validation);

                match verify_result {
                    Ok(_) => {
                        if let Some(obj) = result.as_object_mut() {
                            obj.insert("signatureVerified".to_string(), serde_json::Value::Bool(true));
                        }
                    }
                    Err(e) => {
                        if let Some(obj) = result.as_object_mut() {
                            obj.insert("signatureError".to_string(), serde_json::Value::String(e.to_string()));
                        }
                    }
                }
            }
        }

        serde_json::to_string_pretty(&result)
            .map_err(|e| format!("Failed to serialize JWT output: {}", e))
    }

    fn parse_jwt_algorithm(&self, alg: &str) -> Option<jsonwebtoken::Algorithm> {
        match alg {
            "HS256" => Some(jsonwebtoken::Algorithm::HS256),
            "HS384" => Some(jsonwebtoken::Algorithm::HS384),
            "HS512" => Some(jsonwebtoken::Algorithm::HS512),
            "RS256" => Some(jsonwebtoken::Algorithm::RS256),
            "RS384" => Some(jsonwebtoken::Algorithm::RS384),
            "RS512" => Some(jsonwebtoken::Algorithm::RS512),
            "ES256" => Some(jsonwebtoken::Algorithm::ES256),
            "ES384" => Some(jsonwebtoken::Algorithm::ES384),
            "PS256" => Some(jsonwebtoken::Algorithm::PS256),
            "PS384" => Some(jsonwebtoken::Algorithm::PS384),
            "PS512" => Some(jsonwebtoken::Algorithm::PS512),
            "EdDSA" => Some(jsonwebtoken::Algorithm::EdDSA),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_encoding() {
        let service = CryptoService::new();
        let payload = "Hello World";
        let encoded = service.process_crypto(CryptoAction::Base64Encode, payload, None, None).unwrap();
        assert_eq!(encoded, "SGVsbG8gV29ybGQ=");

        let decoded = service.process_crypto(CryptoAction::Base64Decode, &encoded, None, None).unwrap();
        assert_eq!(decoded, payload);
    }

    #[test]
    fn test_hex_encoding() {
        let service = CryptoService::new();
        let payload = "Hello";
        let encoded = service.process_crypto(CryptoAction::HexEncode, payload, None, None).unwrap();
        assert_eq!(encoded, "48656c6c6f");

        let decoded = service.process_crypto(CryptoAction::HexDecode, &encoded, None, None).unwrap();
        assert_eq!(decoded, payload);
    }

    #[test]
    fn test_url_encoding() {
        let service = CryptoService::new();
        let payload = "hello world!?";
        let encoded = service.process_crypto(CryptoAction::UrlEncode, payload, None, None).unwrap();
        assert_eq!(encoded, "hello%20world%21%3F");

        let decoded = service.process_crypto(CryptoAction::UrlDecode, &encoded, None, None).unwrap();
        assert_eq!(decoded, payload);
    }

    #[test]
    fn test_sha256_and_hmac() {
        let service = CryptoService::new();
        let payload = "hello";
        let sha = service.process_crypto(CryptoAction::Sha256, payload, None, None).unwrap();
        assert_eq!(sha, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");

        let hmac_res = service.process_crypto(CryptoAction::HmacSha256, payload, Some("key"), None).unwrap();
        assert!(!hmac_res.is_empty());
    }

    #[test]
    fn test_aes_gcm() {
        let service = CryptoService::new();
        let payload = "secret data";
        let key = "mysecretkey12345";
        let iv = "myinitialvector";
        let encrypted = service.process_crypto(CryptoAction::AesEncrypt, payload, Some(key), Some(iv)).unwrap();
        assert!(!encrypted.is_empty());

        let decrypted = service.process_crypto(CryptoAction::AesDecrypt, &encrypted, Some(key), Some(iv)).unwrap();
        assert_eq!(decrypted, payload);
    }

    #[test]
    fn test_json_schema_validation() {
        let service = CryptoService::new();
        let schema = r#"
        {
            "type": "object",
            "properties": {
                "name": { "type": "string" },
                "age": { "type": "integer" }
            },
            "required": ["name"]
        }
        "#;

        let valid_payload = r#"
        {
            "name": "John Doe",
            "age": 30
        }
        "#;

        let invalid_payload = r#"
        {
            "age": 30
        }
        "#;

        assert!(service.validate_json_schema(valid_payload, schema).is_ok());
        assert!(service.validate_json_schema(invalid_payload, schema).is_err());
    }
}
