use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use super::{cli_println, cli_eprintln};

const SKILL_MD: &str = include_str!("../../resources/skills/watchtower/SKILL.md");
const LOGS_MJS: &str = include_str!("../../resources/skills/watchtower/scripts/logs.mjs");

const SKILL_DIR_NAME: &str = "watchtower";
const PROJECT_SKILL_REL: &str = ".agents/skills/watchtower";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AgentTarget {
    Cursor,
    Claude,
    Codex,
    Gemini,
    Copilot,
    Windsurf,
}

impl AgentTarget {
    fn id(self) -> &'static str {
        match self {
            Self::Cursor => "cursor",
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Gemini => "gemini",
            Self::Copilot => "copilot",
            Self::Windsurf => "windsurf",
        }
    }

    fn all() -> &'static [Self] {
        &[
            Self::Cursor,
            Self::Claude,
            Self::Codex,
            Self::Gemini,
            Self::Copilot,
            Self::Windsurf,
        ]
    }

    fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "cursor" => Some(Self::Cursor),
            "claude" | "claude-code" => Some(Self::Claude),
            "codex" => Some(Self::Codex),
            "gemini" | "antigravity" | "gemini-cli" => Some(Self::Gemini),
            "copilot" | "github-copilot" => Some(Self::Copilot),
            "windsurf" => Some(Self::Windsurf),
            _ => None,
        }
    }
}

#[derive(Debug, Default)]
pub struct InitOptions {
    pub target: Option<String>,
    pub project: bool,
    pub print: bool,
    pub force: bool,
}

#[derive(Debug, Serialize)]
struct InstalledPath {
    target: String,
    path: String,
    status: String,
}

#[derive(Debug, Serialize)]
struct InitResult {
    success: bool,
    scope: String,
    targets: Vec<String>,
    installed: Vec<InstalledPath>,
    skipped: Vec<InstalledPath>,
    #[serde(skip_serializing_if = "Option::is_none")]
    skill_md: Option<String>,
}

pub fn execute_init(args: &[String]) {
    let options = parse_init_options(args);

    if options.print {
        let output = InitResult {
            success: true,
            scope: "print".to_string(),
            targets: vec![],
            installed: vec![],
            skipped: vec![],
            skill_md: Some(SKILL_MD.to_string()),
        };
        cli_println(&serde_json::to_string_pretty(&output).unwrap());
        return;
    }

    let home = match home_dir() {
        Some(h) => h,
        None => {
            print_init_error("홈 디렉터리를 찾을 수 없습니다.");
            return;
        }
    };

    let targets = resolve_targets(options.target.as_deref(), &home);
    let target_ids: Vec<String> = targets.iter().map(|t| t.id().to_string()).collect();
    let mut installed = Vec::new();
    let mut skipped = Vec::new();

    if options.project {
        let project_dir = std::env::current_dir()
            .map(|cwd| cwd.join(PROJECT_SKILL_REL))
            .unwrap_or_else(|_| PathBuf::from(PROJECT_SKILL_REL));
        match write_skill_bundle(&project_dir, options.force) {
            Ok(status) => installed.push(InstalledPath {
                target: "project".to_string(),
                path: project_dir.to_string_lossy().into_owned(),
                status,
            }),
            Err(e) => skipped.push(InstalledPath {
                target: "project".to_string(),
                path: project_dir.to_string_lossy().into_owned(),
                status: e,
            }),
        }
    }

    if !options.project {
        for target in &targets {
            let dir = global_skill_dir(&home, *target);
            match write_skill_bundle(&dir, options.force) {
                Ok(status) => installed.push(InstalledPath {
                    target: target.id().to_string(),
                    path: dir.to_string_lossy().into_owned(),
                    status,
                }),
                Err(e) => skipped.push(InstalledPath {
                    target: target.id().to_string(),
                    path: dir.to_string_lossy().into_owned(),
                    status: e,
                }),
            }
        }
    }

    let scope = if options.project {
        "project".to_string()
    } else {
        "global".to_string()
    };

    let output = InitResult {
        success: skipped.is_empty() || !installed.is_empty(),
        scope,
        targets: if options.project {
            vec!["project".to_string()]
        } else {
            target_ids
        },
        installed,
        skipped,
        skill_md: None,
    };

    cli_println(&serde_json::to_string_pretty(&output).unwrap());
}

fn parse_init_options(args: &[String]) -> InitOptions {
    let mut options = InitOptions::default();
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--target" if i + 1 < args.len() => {
                options.target = Some(args[i + 1].clone());
                i += 2;
            }
            "--project" => {
                options.project = true;
                i += 1;
            }
            "--print" => {
                options.print = true;
                i += 1;
            }
            "--force" => {
                options.force = true;
                i += 1;
            }
            _ => i += 1,
        }
    }
    options
}

fn resolve_targets(target: Option<&str>, home: &Path) -> Vec<AgentTarget> {
    let selection = target.unwrap_or("auto");
    if selection.eq_ignore_ascii_case("all") {
        return AgentTarget::all().to_vec();
    }

    if selection.eq_ignore_ascii_case("auto") {
        let detected = detect_installed_targets(home);
        if detected.is_empty() {
            return AgentTarget::all().to_vec();
        }
        return detected;
    }

    if let Some(parsed) = AgentTarget::parse(selection) {
        return vec![parsed];
    }

    AgentTarget::all().to_vec()
}

fn detect_installed_targets(home: &Path) -> Vec<AgentTarget> {
    let mut targets = Vec::new();
    if home.join(".cursor").exists() {
        targets.push(AgentTarget::Cursor);
    }
    if env_path("CLAUDE_CONFIG_DIR")
        .map(|p| p.exists())
        .unwrap_or(false)
        || home.join(".claude").exists()
    {
        targets.push(AgentTarget::Claude);
    }
    if env_path("CODEX_HOME")
        .map(|p| p.exists())
        .unwrap_or(false)
        || home.join(".codex").exists()
    {
        targets.push(AgentTarget::Codex);
    }
    if home.join(".gemini").exists() {
        targets.push(AgentTarget::Gemini);
    }
    if home.join(".copilot").exists() {
        targets.push(AgentTarget::Copilot);
    }
    if home.join(".codeium").join("windsurf").exists() {
        targets.push(AgentTarget::Windsurf);
    }
    targets
}

fn global_skill_dir(home: &Path, target: AgentTarget) -> PathBuf {
    match target {
        AgentTarget::Cursor => home.join(".cursor/skills").join(SKILL_DIR_NAME),
        AgentTarget::Claude => {
            let claude_home = env_path("CLAUDE_CONFIG_DIR").unwrap_or_else(|| home.join(".claude"));
            claude_home.join("skills").join(SKILL_DIR_NAME)
        }
        AgentTarget::Codex => {
            let codex_home = env_path("CODEX_HOME").unwrap_or_else(|| home.join(".codex"));
            codex_home.join("skills").join(SKILL_DIR_NAME)
        }
        AgentTarget::Gemini => home
            .join(".gemini/config/skills")
            .join(SKILL_DIR_NAME),
        AgentTarget::Copilot => home.join(".copilot/skills").join(SKILL_DIR_NAME),
        AgentTarget::Windsurf => home
            .join(".codeium/windsurf/skills")
            .join(SKILL_DIR_NAME),
    }
}

fn write_skill_bundle(dest: &Path, force: bool) -> Result<String, String> {
    let skill_file = dest.join("SKILL.md");
    let scripts_dir = dest.join("scripts");
    let logs_file = scripts_dir.join("logs.mjs");

    let existed = skill_file.exists();
    if existed && !force {
        return Err("already exists (use --force to overwrite)".to_string());
    }

    fs::create_dir_all(&scripts_dir).map_err(|e| format!("mkdir failed: {e}"))?;
    fs::write(&skill_file, SKILL_MD).map_err(|e| format!("write SKILL.md failed: {e}"))?;
    fs::write(&logs_file, LOGS_MJS).map_err(|e| format!("write logs.mjs failed: {e}"))?;

    Ok(if existed { "updated".to_string() } else { "installed".to_string() })
}

fn home_dir() -> Option<PathBuf> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        if !profile.is_empty() {
            return Some(PathBuf::from(profile));
        }
    }
    std::env::var_os("HOME").map(PathBuf::from)
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var(key)
        .ok()
        .filter(|v| !v.trim().is_empty())
        .map(PathBuf::from)
}

fn print_init_error(msg: &str) {
    let output = serde_json::json!({
        "success": false,
        "error": msg
    });
    cli_eprintln(&serde_json::to_string_pretty(&output).unwrap());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_agent_targets() {
        assert_eq!(AgentTarget::parse("cursor"), Some(AgentTarget::Cursor));
        assert_eq!(AgentTarget::parse("claude-code"), Some(AgentTarget::Claude));
        assert_eq!(AgentTarget::parse("github-copilot"), Some(AgentTarget::Copilot));
        assert_eq!(AgentTarget::parse("unknown"), None);
    }

    #[test]
    fn global_paths_use_expected_suffix() {
        let home = PathBuf::from("/home/user");
        assert!(
            global_skill_dir(&home, AgentTarget::Cursor)
                .ends_with(".cursor/skills/watchtower")
        );
        assert!(
            global_skill_dir(&home, AgentTarget::Gemini)
                .ends_with(".gemini/config/skills/watchtower")
        );
    }

    #[test]
    fn embedded_skill_has_frontmatter() {
        assert!(SKILL_MD.contains("name: watchtower"));
        assert!(LOGS_MJS.contains("getWatchtowerLogsDir"));
    }
}
