use crate::model::api_response::ApiResponse;
use crate::model::domain::Domain;
use crate::service::api_logging_settings_service::ApiLoggingSettingsService;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_monitor_service::DomainMonitorService;
use crate::service::domain_service::DomainService;

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RegistDomainsPayload {
    pub urls: Vec<String>,
    pub group_id: Option<u32>,
}

#[tauri::command]
#[specta::specta]
pub fn regist_domains(
    payload: RegistDomainsPayload,
    domain_service: tauri::State<'_, DomainService>,
    link_service: tauri::State<'_, DomainGroupLinkService>,
    _monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<Vec<Domain>>, String> {
    let requested = payload.urls.len();
    let list = domain_service.add_domains(payload.urls);
    if let Some(gid) = payload.group_id {
        for d in &list {
            link_service.add_domain_to_group(d.id, gid);
        }
    }
    let skipped = requested.saturating_sub(list.len());
    let message = if skipped > 0 {
        format!("{}개 등록 완료, {}개 중복 제외!", list.len(), skipped)
    } else {
        format!("{}개 등록 완료!", list.len())
    };
    Ok(ApiResponse {
        message,
        success: true,
        data: list,
    })
}

#[tauri::command]
#[specta::specta]
pub fn get_domains(
    domain_service: tauri::State<'_, DomainService>,
) -> Result<ApiResponse<Vec<Domain>>, String> {
    let list = domain_service.get_all();
    Ok(ApiResponse {
        message: format!("{}개 조회 완료!", list.len()),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetDomainByIdPayload {
    pub id: u32,
}

#[tauri::command]
#[specta::specta]
pub fn get_domain_by_id(
    payload: GetDomainByIdPayload,
    domain_service: tauri::State<'_, DomainService>,
) -> Result<ApiResponse<Option<Domain>>, String> {
    let domain = domain_service.get_domain_by_id(payload.id);
    if let Some(domain) = domain {
        Ok(ApiResponse {
            message: format!("{} 조회 완료!", domain.url),
            success: true,
            data: Some(domain.clone()),
        })
    } else {
        Ok(ApiResponse {
            message: format!("{} 조회 실패!", payload.id),
            success: false,
            data: Option::<Domain>::None,
        })
    }
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDomainByIdPayload {
    pub id: u32,
    pub url: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn update_domain_by_id(
    payload: UpdateDomainByIdPayload,
    domain_service: tauri::State<'_, DomainService>,
) -> Result<ApiResponse<Option<Domain>>, String> {
    let url = payload.url.filter(|s| !s.is_empty());
    let domain = domain_service.update_domain(payload.id, url);
    if domain.is_empty() {
        Ok(ApiResponse {
            message: format!("{} 업데이트 실패!", payload.id),
            success: false,
            data: Option::<Domain>::None,
        })
    } else {
        Ok(ApiResponse {
            message: format!("{} 업데이트 완료!", payload.id),
            success: true,
            data: Some(domain[0].clone()),
        })
    }
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoveDomainsPayload {
    pub id: u32,
}

#[tauri::command]
#[specta::specta]
pub fn remove_domains(
    payload: RemoveDomainsPayload,
    domain_service: tauri::State<'_, DomainService>,
    link_service: tauri::State<'_, DomainGroupLinkService>,
    monitor_service: tauri::State<'_, DomainMonitorService>,
    api_logging_service: tauri::State<'_, ApiLoggingSettingsService>,
) -> Result<ApiResponse<Option<Domain>>, String> {
    link_service.remove_links_for_domain(payload.id);
    let domain = domain_service.delete_domain(payload.id);
    let all_domains = domain_service.get_all();
    monitor_service.sync_with_domains(&all_domains);
    api_logging_service.remove_link(payload.id, &all_domains);
    if domain.is_empty() {
        Ok(ApiResponse {
            message: format!("{} 삭제 실패!", payload.id),
            success: false,
            data: Option::<Domain>::None,
        })
    } else {
        Ok(ApiResponse {
            message: format!("{} 삭제 완료!", payload.id),
            success: true,
            data: Some(domain[0].clone()),
        })
    }
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportDomainsPayload {
    pub domains: Vec<Domain>,
}

#[tauri::command]
#[specta::specta]
pub fn import_domains(
    payload: ImportDomainsPayload,
    domain_service: tauri::State<'_, DomainService>,
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<Vec<Domain>>, String> {
    let list = domain_service.import_from_json(payload.domains);
    monitor_service.sync_with_domains(&domain_service.get_all());
    Ok(ApiResponse {
        message: format!("{}개 도메인 임포트 완료!", list.len()),
        success: true,
        data: list,
    })
}

#[tauri::command]
#[specta::specta]
pub fn clear_all_domains(
    domain_service: tauri::State<'_, DomainService>,
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<Vec<Domain>>, String> {
    let list = domain_service.import_from_json(vec![]);
    monitor_service.sync_with_domains(&domain_service.get_all());
    Ok(ApiResponse {
        message: "모든 도메인이 삭제되었습니다.".to_string(),
        success: true,
        data: list,
    })
}
