use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};

/// Global flag: when `false` the proxy still runs but passes all traffic through
/// without matching local routes (pure pass-through mode).
static LOCAL_ROUTING_ENABLED: AtomicBool = AtomicBool::new(true);
static MOCKING_ENABLED: AtomicBool = AtomicBool::new(true);
static INSPECTOR_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn is_local_routing_enabled() -> bool {
    LOCAL_ROUTING_ENABLED.load(AtomicOrdering::Relaxed)
}

pub fn set_local_routing_enabled(enabled: bool) {
    LOCAL_ROUTING_ENABLED.store(enabled, AtomicOrdering::Relaxed);
}

pub fn is_mocking_enabled() -> bool {
    MOCKING_ENABLED.load(AtomicOrdering::Relaxed)
}

pub fn set_mocking_enabled(enabled: bool) {
    MOCKING_ENABLED.store(enabled, AtomicOrdering::Relaxed);
}

pub fn is_inspector_enabled() -> bool {
    INSPECTOR_ENABLED.load(AtomicOrdering::Relaxed)
}

pub fn set_inspector_enabled(enabled: bool) {
    INSPECTOR_ENABLED.store(enabled, AtomicOrdering::Relaxed);
}
