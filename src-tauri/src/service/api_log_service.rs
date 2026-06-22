use crate::model::api_log::ApiLogEntry;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct ApiLogService {
    log_dir: PathBuf,
    // 파일 쓰기 동시성 제어를 위한 뮤텍스 (날짜별로 관리하면 좋겠지만 간단하게 전역 락)
    write_lock: Arc<Mutex<()>>,
}

impl ApiLogService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let log_dir = app_data_dir.join("api_logs");
        if !log_dir.exists() {
            let _ = fs::create_dir_all(&log_dir);
        }
        Self {
            log_dir,
            write_lock: Arc::new(Mutex::new(())),
        }
    }

    /// 로그 저장 (Append to YYYY-MM-DD.jsonl)
    pub fn save_log(&self, entry: &ApiLogEntry) {
        // timestamp에서 날짜 추출 (YYYY-MM-DD)
        // entry.timestamp는 ISO8601 문자열이라고 가정
        let date_str = if entry.timestamp.len() >= 10 {
            &entry.timestamp[0..10]
        } else {
            "unknown"
        };

        // 파일명: YYYY-MM-DD.jsonl
        let file_path = self.log_dir.join(format!("{date_str}.jsonl"));

        let Ok(json) = serde_json::to_string(entry) else {
            return;
        };

        let _lock = self.write_lock.lock().unwrap();
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(file_path) {
            let _ = writeln!(file, "{json}");
        }
    }

    pub fn list_dates(&self) -> Vec<String> {
        let mut dates = Vec::new();
        if let Ok(entries) = fs::read_dir(&self.log_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        dates.push(stem.to_string());
                    }
                }
            }
        }
        dates.sort();
        dates.reverse(); // 최신순
        dates
    }

    pub fn get_logs(
        &self,
        date: &str,
        domain_filter: Option<String>, // This is actually path_filter in exact match mode context, or url filter in legacy mode
        method_filter: Option<String>,
        host_filter: Option<String>,
        exact_match: bool,
    ) -> Vec<ApiLogEntry> {
        let file_path = self.log_dir.join(format!("{date}.jsonl"));
        if !file_path.exists() {
            return Vec::new();
        }

        let mut logs = Vec::new();
        if let Ok(file) = fs::File::open(file_path) {
            let reader = BufReader::new(file);
            for line in reader.lines().map_while(Result::ok) {
                if let Ok(entry) = serde_json::from_str::<ApiLogEntry>(&line) {
                    // Filter
                    if exact_match {
                        if let Some(filter) = &domain_filter {
                            if !filter.is_empty() && entry.path != *filter {
                                continue;
                            }
                        }
                        if let Some(filter) = &method_filter {
                            if !filter.is_empty() && entry.method != *filter {
                                continue;
                            }
                        }
                        if let Some(filter) = &host_filter {
                            if !filter.is_empty() && entry.host != *filter {
                                continue;
                            }
                        }
                    } else {
                        if let Some(filter) = &domain_filter {
                            if !filter.is_empty() && !entry.url.contains(filter) {
                                continue;
                            }
                        }
                        if let Some(filter) = &method_filter {
                            if !filter.is_empty() && entry.method != *filter {
                                continue;
                            }
                        }
                        if let Some(filter) = &host_filter {
                            if !filter.is_empty() && !entry.host.contains(filter) {
                                continue;
                            }
                        }
                    }
                    logs.push(entry);
                }
            }
        }
        // 시간 역순 정렬 (최신이 위로)
        logs.reverse();
        logs
    }

    pub fn clear_logs(&self, date: Option<String>) -> Result<(), String> {
        let _lock = self.write_lock.lock().unwrap();
        if let Some(d) = date {
            let file_path = self.log_dir.join(format!("{d}.jsonl"));
            if file_path.exists() {
                fs::remove_file(file_path).map_err(|e| e.to_string())?;
            }
        } else {
            // Clear all
            if let Ok(entries) = fs::read_dir(&self.log_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                        let _ = fs::remove_file(path);
                    }
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_save_and_get_logs() {
        let dir = tempdir().unwrap();
        let service = ApiLogService::new(dir.path().to_path_buf());

        let entry = ApiLogEntry {
            id: "1".to_string(),
            timestamp: "2026-02-19T10:00:00Z".to_string(),
            method: "GET".to_string(),
            url: "http://example.com".to_string(),
            host: "example.com".to_string(),
            path: "/".to_string(),
            status_code: Some(200),
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
        };

        service.save_log(&entry);

        let dates = service.list_dates();
        assert_eq!(dates.len(), 1);
        assert_eq!(dates[0], "2026-02-19");

        let logs = service.get_logs("2026-02-19", None, None, None, false);
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].id, "1");
    }

    #[test]
    fn test_filter_logs() {
        let dir = tempdir().unwrap();
        let service = ApiLogService::new(dir.path().to_path_buf());

        let entry1 = ApiLogEntry {
            id: "1".to_string(),
            timestamp: "2026-02-19T10:00:00Z".to_string(),
            method: "GET".to_string(),
            url: "http://example.com/api/v1".to_string(),
            host: "example.com".to_string(),
            path: "/api/v1".to_string(),
            status_code: Some(200),
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
        };

        let entry2 = ApiLogEntry {
            id: "2".to_string(),
            timestamp: "2026-02-19T10:01:00Z".to_string(),
            method: "POST".to_string(),
            url: "http://other.com/api/v2".to_string(),
            host: "other.com".to_string(),
            path: "/api/v2".to_string(),
            status_code: Some(201),
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
        };

        service.save_log(&entry1);
        service.save_log(&entry2);

        let logs_all = service.get_logs("2026-02-19", None, None, None, false);
        assert_eq!(logs_all.len(), 2);

        let logs_domain = service.get_logs("2026-02-19", Some("v1".to_string()), None, None, false);
        assert_eq!(logs_domain.len(), 1);
        assert_eq!(logs_domain[0].id, "1");

        let logs_method =
            service.get_logs("2026-02-19", None, Some("GET".to_string()), None, false);
        assert_eq!(logs_method.len(), 1);
        assert_eq!(logs_method[0].id, "1");

        let logs_host = service.get_logs(
            "2026-02-19",
            None,
            None,
            Some("other.com".to_string()),
            false,
        );
        assert_eq!(logs_host.len(), 1);
        assert_eq!(logs_host[0].id, "2");
    }

    #[test]
    fn test_clear_logs() {
        let dir = tempdir().unwrap();
        let service = ApiLogService::new(dir.path().to_path_buf());

        let entry = ApiLogEntry {
            id: "1".to_string(),
            timestamp: "2026-02-19T10:00:00Z".to_string(),
            method: "GET".to_string(),
            url: "http://example.com".to_string(),
            host: "example.com".to_string(),
            path: "/".to_string(),
            status_code: Some(200),
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
        };

        service.save_log(&entry);
        assert_eq!(service.list_dates().len(), 1);

        service.clear_logs(Some("2026-02-19".to_string())).unwrap();
        assert_eq!(service.list_dates().len(), 0);

        service.save_log(&entry);
        service.clear_logs(None).unwrap();
        assert_eq!(service.list_dates().len(), 0);
    }

    #[test]
    fn test_exact_match_filter() {
        let dir = tempdir().unwrap();
        let service = ApiLogService::new(dir.path().to_path_buf());

        let entry1 = ApiLogEntry {
            id: "1".to_string(),
            timestamp: "2026-02-19T10:00:00Z".to_string(),
            method: "GET".to_string(),
            url: "http://example.com/api/v1".to_string(),
            host: "example.com".to_string(),
            path: "/api/v1".to_string(),
            status_code: Some(200),
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
        };

        service.save_log(&entry1);

        // Exact match: success
        let logs_match = service.get_logs(
            "2026-02-19",
            Some("/api/v1".to_string()),
            None,
            Some("example.com".to_string()),
            true,
        );
        assert_eq!(logs_match.len(), 1);

        // Exact match: fail (partial path)
        let logs_fail_path =
            service.get_logs("2026-02-19", Some("/api".to_string()), None, None, true);
        assert_eq!(logs_fail_path.len(), 0);

        // Exact match: fail (wrong host)
        let logs_fail_host = service.get_logs(
            "2026-02-19",
            None,
            None,
            Some("example.co".to_string()),
            true,
        );
        assert_eq!(logs_fail_host.len(), 0);
    }
}
