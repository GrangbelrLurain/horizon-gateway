//! JSON 스키마 버전 및 마이그레이션. docs/plans/10-json-schema-migration.md 참고.
//!
//! - `schema_version` 없음 → v1으로 취급, 최신 형식으로 마이그레이션 후 저장
//! - `schema_version` < 현재 → 마이그레이션 후 저장
//! - 마이그레이션 전 기존 파일 백업 (.json.bak)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

pub const CURRENT_SCHEMA_VERSION: u32 = 2;

#[derive(Serialize, Deserialize)]
struct VersionedJson<T> {
    schema_version: u32,
    data: T,
}

/// 기존 파일이 있으면 .json.bak으로 백업
fn backup_if_exists(path: &Path) {
    if path.exists() {
        let backup_path = path.with_extension("json.bak");
        let _ = fs::copy(path, backup_path);
    }
}

/// 버전드 JSON 로드. v1(버전 없음) 또는 구버전이면 마이그레이션 후 저장.
pub fn load_versioned<T>(path: &Path) -> T
where
    T: for<'de> Deserialize<'de> + Serialize + Default,
{
    if !path.exists() {
        return T::default();
    }
    let Ok(content) = fs::read_to_string(path) else {
        return T::default();
    };

    // Try versioned format first
    if let Ok(versioned) = serde_json::from_str::<VersionedJson<T>>(&content) {
        if versioned.schema_version < CURRENT_SCHEMA_VERSION {
            backup_if_exists(path);
            save_versioned(path, &versioned.data);
        }
        return versioned.data;
    }

    // Try v1 (raw format, no wrapper)
    if let Ok(data) = serde_json::from_str::<T>(&content) {
        backup_if_exists(path);
        save_versioned(path, &data);
        return data;
    }

    T::default()
}

/// 버전드 JSON 저장
pub fn save_versioned<T: Serialize + ?Sized>(path: &Path, data: &T) {
    let versioned = VersionedJson {
        schema_version: CURRENT_SCHEMA_VERSION,
        data,
    };
    if let Ok(content) = serde_json::to_string_pretty(&versioned) {
        let _ = fs::write(path, content);
    }
}
