use crate::model::api_response::ApiResponse;
use crate::model::domain::Domain;
use crate::model::domain_group::DomainGroup;
use crate::model::domain_group_link::DomainGroupLink;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::domain_service::DomainService;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn get_domain_group_links(
    link_service: State<'_, DomainGroupLinkService>,
) -> Result<ApiResponse<Vec<DomainGroupLink>>, String> {
    let links = link_service.get_all_links();
    Ok(ApiResponse {
        success: true,
        data: links,
        message: String::new(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SetDomainGroupsPayload {
    pub domain_id: u32,
    pub group_ids: Vec<u32>,
}

#[tauri::command]
#[specta::specta]
pub fn set_domain_groups(
    payload: SetDomainGroupsPayload,
    link_service: State<'_, DomainGroupLinkService>,
) -> Result<ApiResponse<()>, String> {
    link_service.set_groups_for_domain(payload.domain_id, payload.group_ids);
    Ok(ApiResponse {
        success: true,
        data: (),
        message: "Domain groups updated".to_string(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SetGroupDomainsPayload {
    pub group_id: u32,
    pub domain_ids: Vec<u32>,
}

#[tauri::command]
#[specta::specta]
pub fn set_group_domains(
    payload: SetGroupDomainsPayload,
    link_service: State<'_, DomainGroupLinkService>,
) -> Result<ApiResponse<()>, String> {
    link_service.set_domains_for_group(payload.group_id, payload.domain_ids);
    Ok(ApiResponse {
        success: true,
        data: (),
        message: "Group domains updated".to_string(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetDomainsByGroupPayload {
    pub group_id: u32,
}

#[tauri::command]
#[specta::specta]
pub fn get_domains_by_group(
    payload: GetDomainsByGroupPayload,
    domain_service: State<'_, DomainService>,
    link_service: State<'_, DomainGroupLinkService>,
) -> Result<ApiResponse<Vec<Domain>>, String> {
    let domain_ids = link_service.get_domain_ids_for_group(payload.group_id);
    let all_domains = domain_service.get_all();
    let domains: Vec<Domain> = domain_ids
        .into_iter()
        .filter_map(|id| all_domains.iter().find(|d| d.id == id).cloned())
        .collect();
    Ok(ApiResponse {
        success: true,
        data: domains,
        message: String::new(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetGroupsForDomainPayload {
    pub domain_id: u32,
}

#[tauri::command]
#[specta::specta]
pub fn get_groups_for_domain(
    payload: GetGroupsForDomainPayload,
    group_service: State<'_, DomainGroupService>,
    link_service: State<'_, DomainGroupLinkService>,
) -> Result<ApiResponse<Vec<DomainGroup>>, String> {
    let group_ids = link_service.get_group_ids_for_domain(payload.domain_id);
    let all_groups = group_service.get_all();
    let groups: Vec<DomainGroup> = group_ids
        .into_iter()
        .filter_map(|id| all_groups.iter().find(|g| g.id == id).cloned())
        .collect();
    Ok(ApiResponse {
        success: true,
        data: groups,
        message: String::new(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupPayload {
    pub name: String,
}

#[tauri::command]
#[specta::specta]
pub async fn create_group(
    payload: CreateGroupPayload,
    service: State<'_, DomainGroupService>,
) -> Result<ApiResponse<Vec<DomainGroup>>, String> {
    let groups = service.add_group(payload.name);
    Ok(ApiResponse {
        success: true,
        data: groups,
        message: "Group created successfully".to_string(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_groups(
    service: State<'_, DomainGroupService>,
) -> Result<ApiResponse<Vec<DomainGroup>>, String> {
    let groups = service.get_all();
    Ok(ApiResponse {
        success: true,
        data: groups,
        message: String::new(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGroupPayload {
    pub id: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn delete_group(
    payload: DeleteGroupPayload,
    service: State<'_, DomainGroupService>,
    link_service: State<'_, DomainGroupLinkService>,
) -> Result<ApiResponse<Vec<DomainGroup>>, String> {
    link_service.remove_links_for_group(payload.id);
    let groups = service.delete_group(payload.id);
    Ok(ApiResponse {
        success: true,
        data: groups,
        message: "Group deleted successfully".to_string(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupPayload {
    pub id: u32,
    pub name: String,
}

#[tauri::command]
#[specta::specta]
pub async fn update_group(
    payload: UpdateGroupPayload,
    service: State<'_, DomainGroupService>,
) -> Result<ApiResponse<Vec<DomainGroup>>, String> {
    let groups = service.update_group(payload.id, payload.name);
    Ok(ApiResponse {
        success: true,
        data: groups,
        message: "Group updated successfully".to_string(),
    })
}
