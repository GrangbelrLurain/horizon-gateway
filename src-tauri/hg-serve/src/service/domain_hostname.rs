use crate::service::local_proxy::route_domain_to_host;

/// Hostname extracted from a domain URL (lowercase, no trailing dot).
pub fn domain_url_to_hostname(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    // Lowercase before parse so `HTTPS://Host` still strips the scheme.
    let lowered = trimmed.to_lowercase();
    let host = route_domain_to_host(&lowered);
    host.trim_end_matches('.').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_hostname_from_https_url() {
        assert_eq!(
            domain_url_to_hostname("https://api.example.com/path"),
            "api.example.com"
        );
    }

    #[test]
    fn extracts_hostname_from_bare_host() {
        assert_eq!(domain_url_to_hostname("api.example.com"), "api.example.com");
    }

    #[test]
    fn treats_scheme_path_and_port_as_same_host() {
        assert_eq!(
            domain_url_to_hostname("https://api.example.com"),
            "api.example.com"
        );
        assert_eq!(
            domain_url_to_hostname("http://api.example.com/"),
            "api.example.com"
        );
        assert_eq!(
            domain_url_to_hostname("api.example.com:443"),
            "api.example.com"
        );
        assert_eq!(
            domain_url_to_hostname("HTTPS://API.EXAMPLE.COM"),
            "api.example.com"
        );
    }
}
