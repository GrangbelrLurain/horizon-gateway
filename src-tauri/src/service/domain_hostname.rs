use crate::service::local_proxy::route_domain_to_host;

/// Hostname extracted from a domain URL (lowercase).
pub fn domain_url_to_hostname(url: &str) -> String {
    route_domain_to_host(url.trim()).to_lowercase()
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
}
