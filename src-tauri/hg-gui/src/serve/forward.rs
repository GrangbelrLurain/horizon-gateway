use crate::cli::CLI_COMMANDS;

/// Whether this command should be routed to the serve backend instead of in-process dispatch.
pub fn should_forward(command: &str) -> bool {
    !is_gui_only(command)
}

pub fn is_gui_only(command: &str) -> bool {
    CLI_COMMANDS
        .iter()
        .find(|info| info.name == command)
        .is_some_and(|info| info.gui_only)
}
