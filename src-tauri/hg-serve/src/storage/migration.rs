//! 앱 시작 시 실행되는 마이그레이션. docs/plans/10-json-schema-migration.md 참고.
//!
//! Tauri 메인 로직 시작 전에 버전 확인 → 필요한 경우 순차 마이그레이션 (1→2→3...)

use serde_json::Value;
use std::fs;
use std::path::Path;

use super::versioned::CURRENT_SCHEMA_VERSION;

/// 기존 파일이 있으면 .json.bak으로 백업
fn backup_if_exists(path: &Path) {
    if path.exists() {
        let backup_path = path.with_extension("json.bak");
        let _ = fs::copy(path, backup_path);
    }
}

/// JSON 파싱하여 현재 버전 반환. v1 = 버전 없음.
fn get_current_version(value: &Value) -> u32 {
    match value {
        Value::Object(map) => map
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
            .map_or(1, |n| n as u32),
        _ => 1, // Array 또는 기타 = v1
    }
}

/// v1 → v2: { `schema_version`, data } 래퍼로 감싸기
fn migrate_1_to_2(value: Value) -> Value {
    serde_json::json!({
        "schema_version": 2,
        "data": value
    })
}

/// v2 → v3: (추후 필요 시 구조 변경. migration chain에 추가)
#[allow(dead_code)]
fn migrate_2_to_3(value: Value) -> Value {
    // v3 구조 변경 시 여기에 추가
    value
}

/// 단일 파일 마이그레이션. structure별로 적용할 migration chain 정의
fn migrate_file(path: &Path, migrations: &[fn(Value) -> Value]) {
    if !path.exists() {
        return;
    }
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };
    let Ok(mut value) = serde_json::from_str::<Value>(&content) else {
        return;
    };

    let mut version = get_current_version(&value);

    // v1인 경우: value가 array 또는 object (raw). migration에 넘길 때 그대로 전달.
    // v2+인 경우: value가 { schema_version, data }. migration에는 data만 넘겨야 함.
    // migration 함수 시그니처: Value -> Value
    // migrate_1_to_2: v1 data (array/object) -> v2 전체 { schema_version, data }
    // migrate_2_to_3: v2 전체 받아서 data 변환 후 v3 전체 반환

    // 표준화: 각 migration은 "현재 버전의 전체 Value"를 받아 "다음 버전의 전체 Value" 반환
    // v1: raw (array or object)
    // v2: { schema_version: 2, data: ... }
    // migrate_1_to_2(raw) -> { schema_version: 2, data: raw }
    // migrate_2_to_3(v2_obj) -> v3_obj (data 변환 시)

    while version < CURRENT_SCHEMA_VERSION {
        let migration_idx = (version - 1) as usize;
        if migration_idx >= migrations.len() {
            break;
        }
        backup_if_exists(path);
        value = migrations[migration_idx](value);
        version = get_current_version(&value);
    }

    if let Ok(content) = serde_json::to_string_pretty(&value) {
        let _ = fs::write(path, content);
    }
}

/// `domain_status.json` → `domain_monitor_links.json` 파일 마이그레이션 (구조체 변경)
fn migrate_domain_status_to_monitor_links(app_data_dir: &Path) {
    let old_path = app_data_dir.join("domain_status.json");
    let new_path = app_data_dir.join("domain_monitor_links.json");
    if !old_path.exists() {
        return;
    }
    let Ok(content) = fs::read_to_string(&old_path) else {
        return;
    };
    let Ok(value) = serde_json::from_str::<Value>(&content) else {
        return;
    };
    backup_if_exists(&old_path);
    let versioned = if get_current_version(&value) < 2 {
        migrate_1_to_2(value)
    } else {
        value
    };
    if let Ok(content) = serde_json::to_string_pretty(&versioned) {
        if fs::write(&new_path, content).is_ok() {
            let _ = fs::remove_file(&old_path);
        }
    }
}

/// 모든 저장소 파일에 대해 마이그레이션 실행. 앱 시작 시 `setup()` 맨 앞에서 호출.
pub fn run_all(app_data_dir: &Path) {
    // domain_status.json → domain_monitor_links.json (파일명 변경)
    migrate_domain_status_to_monitor_links(app_data_dir);

    // structure별 migration chain (1→2, 2→3, ...)
    let migrations: Vec<fn(Value) -> Value> = vec![migrate_1_to_2];

    let paths = [
        app_data_dir.join("domains.json"),
        app_data_dir.join("groups.json"),
        app_data_dir.join("domain_group_links.json"),
        app_data_dir.join("domain_monitor_links.json"),
        app_data_dir.join("domain_local_routes.json"),
        app_data_dir.join("proxy_settings.json"),
    ];

    for path in &paths {
        migrate_file(path, &migrations);
    }
}
