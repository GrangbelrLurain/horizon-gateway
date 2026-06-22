use axum::http::Uri;
use crate::model::local_route::LocalRoute;
use crate::service::local_proxy::flags::{
    is_local_routing_enabled, set_local_routing_enabled,
};
use super::super::resolver::{resolve_connect_target, resolve_target};

    // ── LOCAL_ROUTING_ENABLED toggle ───────────────────────────────────
    #[test]
    fn test_local_routing_toggle() {
        // Reset to known state
        set_local_routing_enabled(true);
        assert!(is_local_routing_enabled());

        set_local_routing_enabled(false);
        assert!(!is_local_routing_enabled());

        set_local_routing_enabled(true);
        assert!(is_local_routing_enabled());
    }

    // ── resolve_target: empty routes → pure pass-through ───────────────
    #[test]
    fn test_resolve_target_empty_routes_passthrough() {
        let uri: Uri = "http://example.com/path?q=1".parse().unwrap();
        let (target_uri, _pass_host, _target_host_value, local_origin) =
            resolve_target(&uri, Some("example.com"), &[], "http");

        // No local route matched → local_origin is None
        assert!(
            local_origin.is_none(),
            "empty routes should yield no local_origin"
        );
        // Target URI is the original (pass-through)
        assert!(
            target_uri.contains("example.com"),
            "pass-through target should contain original host, got: {target_uri}"
        );
    }

    // ── resolve_target: matching route → local routing ─────────────────
    #[test]
    fn test_resolve_target_with_matching_route() {
        let route = LocalRoute {
            id: 1,
            domain: "api.example.com".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 3000,
            enabled: true,
        };
        let uri: Uri = "http://api.example.com/foo".parse().unwrap();
        let (_target_uri, _pass_host, _target_host_value, local_origin) =
            resolve_target(&uri, Some("api.example.com"), &[route], "http");

        assert!(
            local_origin.is_some(),
            "matching route should yield local_origin"
        );
        let (host, port, path) = local_origin.unwrap();
        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 3000);
        assert_eq!(path, "/foo");
    }

    // ── resolve_target: disabled route should NOT match ─────────────────
    #[test]
    fn test_resolve_target_disabled_route_no_match() {
        let route = LocalRoute {
            id: 1,
            domain: "api.example.com".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 3000,
            enabled: false,
        };
        let uri: Uri = "http://api.example.com/foo".parse().unwrap();
        let (_target_uri, _pass_host, _target_host_value, local_origin) =
            resolve_target(&uri, Some("api.example.com"), &[route], "http");

        assert!(local_origin.is_none(), "disabled route should not match");
    }

    // ── resolve_connect_target: empty routes ────────────────────────────
    #[test]
    fn test_resolve_connect_target_empty_routes() {
        let result = resolve_connect_target("api.example.com", &[]);
        assert!(
            result.is_none(),
            "empty routes should return None for CONNECT"
        );
    }

    // ── resolve_connect_target: matching route ──────────────────────────
    #[test]
    fn test_resolve_connect_target_matching_route() {
        let route = LocalRoute {
            id: 1,
            domain: "api.example.com".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 3000,
            enabled: true,
        };
        let result = resolve_connect_target("api.example.com", &[route]);
        assert!(result.is_some());
        let (host, port) = result.unwrap();
        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 3000);
    }

    // ── local routing flag integration with resolve_target ──────────────
    #[test]
    fn test_routing_flag_integration() {
        let route = LocalRoute {
            id: 1,
            domain: "dev.local".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 8080,
            enabled: true,
        };
        let uri: Uri = "http://dev.local/api".parse().unwrap();

        // Enabled: route should match
        set_local_routing_enabled(true);
        let routes_enabled = if is_local_routing_enabled() {
            vec![route.clone()]
        } else {
            vec![]
        };
        let (_, _, _, local_origin) =
            resolve_target(&uri, Some("dev.local"), &routes_enabled, "http");
        assert!(local_origin.is_some(), "routing enabled → should match");

        // Disabled: same route, but we pass empty vec (mimicking proxy_handler logic)
        set_local_routing_enabled(false);
        let routes_disabled = if is_local_routing_enabled() {
            vec![route]
        } else {
            vec![]
        };
        let (_, _, _, local_origin) =
            resolve_target(&uri, Some("dev.local"), &routes_disabled, "http");
        assert!(
            local_origin.is_none(),
            "routing disabled → should pass through"
        );

        // Cleanup
        set_local_routing_enabled(true);
    }
