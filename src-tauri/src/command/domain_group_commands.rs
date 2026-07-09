use crate::model::api_response::ApiResponse;
use crate::model::domain::Domain;
use crate::model::domain_group::DomainGroup;
use crate::model::domain_group_link::DomainGroupLink;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::domain_service::DomainService;
use tauri::State;

pub const GET_DOMAIN_GROUP_LINKS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_domain_group_links",
    description: "도메인과 그룹 간의 연결 링크 전체 목록을 조회합니다.",
    payload_example: "{}",
    category: "domains",
    gui_only: false,
};

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

pub const SET_DOMAIN_GROUPS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "set_domain_groups",
    description: "특정 도메인에 속하는 그룹 목록을 설정합니다.",
    payload_example: r#"{"domainId": 1, "groupIds": [1, 2]}"#,
    category: "domains",
    gui_only: false,
};

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

pub const SET_GROUP_DOMAINS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "set_group_domains",
    description: "특정 그룹에 속하는 도메인 목록을 설정합니다.",
    payload_example: r#"{"groupId": 1, "domainIds": [1, 2, 3]}"#,
    category: "domains",
    gui_only: false,
};

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

pub const GET_DOMAINS_BY_GROUP_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_domains_by_group",
    description: "특정 그룹에 속한 도메인 목록을 조회합니다.",
    payload_example: r#"{"groupId": 1}"#,
    category: "domains",
    gui_only: false,
};

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

pub const GET_GROUPS_FOR_DOMAIN_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_groups_for_domain",
    description: "특정 도메인이 속한 그룹 목록을 조회합니다.",
    payload_example: r#"{"domainId": 1}"#,
    category: "domains",
    gui_only: false,
};

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

pub const CREATE_GROUP_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "create_group",
    description: "새로운 도메인 그룹을 생성합니다.",
    payload_example: r#"{"name": "My Group"}"#,
    category: "domains",
    gui_only: false,
};

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

pub const GET_GROUPS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_groups",
    description: "도메인 그룹 전체 목록을 조회합니다.",
    payload_example: "{}",
    category: "domains",
    gui_only: false,
};

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

pub const DELETE_GROUP_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "delete_group",
    description: "도메인 그룹을 삭제합니다.",
    payload_example: r#"{"id": 1}"#,
    category: "domains",
    gui_only: false,
};

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

pub const UPDATE_GROUP_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "update_group",
    description: "도메인 그룹의 이름을 수정합니다.",
    payload_example: r#"{"id": 1, "name": "New Group Name"}"#,
    category: "domains",
    gui_only: false,
};

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
