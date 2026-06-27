use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use crate::service::crypto_service::{CryptoService, CryptoAction};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PipelineNode {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub node_type: String, // "api", "crypto", "schema"
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PipelineEdge {
    pub id: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PipelineFlow {
    pub nodes: Vec<PipelineNode>,
    pub edges: Vec<PipelineEdge>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ErrorPolicy {
    FastFail,
    ContinueOnError,
    Retry,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct NodeExecutionResult {
    pub node_id: String,
    pub success: bool,
    #[specta(type = f64)]
    pub elapsed_ms: u64,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PipelineExecutionReport {
    pub success: bool,
    #[specta(type = f64)]
    pub elapsed_ms: u64,
    pub results: Vec<NodeExecutionResult>,
    pub error: Option<String>,
}

pub struct PipelineRunner {
    crypto_service: CryptoService,
}

impl PipelineRunner {
    pub fn new() -> Self {
        Self {
            crypto_service: CryptoService::new(),
        }
    }

    /// Performs topological sort on nodes & edges. Returns ordered list of node IDs.
    pub fn sort_dag(&self, flow: &PipelineFlow) -> Result<Vec<String>, String> {
        let mut adj: HashMap<String, Vec<String>> = HashMap::new();
        let mut in_degree: HashMap<String, usize> = HashMap::new();

        for node in &flow.nodes {
            adj.insert(node.id.clone(), Vec::new());
            in_degree.insert(node.id.clone(), 0);
        }

        for edge in &flow.edges {
            if adj.contains_key(&edge.source) && adj.contains_key(&edge.target) {
                adj.get_mut(&edge.source).unwrap().push(edge.target.clone());
                *in_degree.get_mut(&edge.target).unwrap() += 1;
            }
        }

        let mut queue: Vec<String> = Vec::new();
        for (node_id, &deg) in &in_degree {
            if deg == 0 {
                queue.push(node_id.clone());
            }
        }

        // Sort queue to maintain deterministic order
        queue.sort();

        let mut order = Vec::new();
        while !queue.is_empty() {
            let u = queue.remove(0);
            order.push(u.clone());

            if let Some(neighbors) = adj.get(&u) {
                for neighbor in neighbors {
                    let deg = in_degree.get_mut(neighbor).unwrap();
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push(neighbor.clone());
                    }
                }
            }
        }

        if order.len() != flow.nodes.len() {
            return Err("Cycle detected in pipeline graph. Cannot execute cyclic flows.".to_string());
        }

        Ok(order)
    }

    /// Executes the pipeline sequentially in topological order.
    pub async fn run(&self, flow: PipelineFlow) -> PipelineExecutionReport {
        let start_time = Instant::now();
        let mut context: HashMap<String, serde_json::Value> = HashMap::new();
        let mut results = Vec::new();

        let order = match self.sort_dag(&flow) {
            Ok(o) => o,
            Err(e) => {
                return PipelineExecutionReport {
                    success: false,
                    elapsed_ms: start_time.elapsed().as_millis() as u64,
                    results: Vec::new(),
                    error: Some(e),
                };
            }
        };

        // Create a map of node_id -> PipelineNode for quick lookup
        let node_map: HashMap<String, &PipelineNode> = flow.nodes.iter().map(|n| (n.id.clone(), n)).collect();

        for node_id in order {
            let node = match node_map.get(&node_id) {
                Some(&n) => n,
                None => continue,
            };

            // 1. Interpolate configuration variables
            let mut interpolated_config = serde_json::from_str::<serde_json::Value>(&node.config)
                .unwrap_or(serde_json::Value::Null);
            interpolate_value(&mut interpolated_config, &context);

            // 2. Parse Error Policy
            let error_policy = match interpolated_config.get("errorPolicy").and_then(|v| v.as_str()) {
                Some("continueOnError") => ErrorPolicy::ContinueOnError,
                Some("retry") => ErrorPolicy::Retry,
                _ => ErrorPolicy::FastFail,
            };

            let node_start = Instant::now();
            let mut attempts = if matches!(error_policy, ErrorPolicy::Retry) { 3 } else { 1 };
            let mut last_error = None;
            let mut output = serde_json::Value::Null;
            let mut node_success = false;

            while attempts > 0 {
                match self.execute_node(node.node_type.as_str(), &interpolated_config).await {
                    Ok(out) => {
                        output = out;
                        node_success = true;
                        last_error = None;
                        break;
                    }
                    Err(e) => {
                        last_error = Some(e);
                        attempts -= 1;
                        if attempts > 0 {
                            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                        }
                    }
                }
            }

            let elapsed = node_start.elapsed().as_millis() as u64;

            // 3. Handle result based on error policy
            if !node_success {
                let err_msg = last_error.clone().unwrap_or_else(|| "Unknown execution error".to_string());
                results.push(NodeExecutionResult {
                    node_id: node_id.clone(),
                    success: false,
                    elapsed_ms: elapsed,
                    output: "null".to_string(),
                    error: Some(err_msg.clone()),
                });

                match error_policy {
                    ErrorPolicy::FastFail | ErrorPolicy::Retry => {
                        return PipelineExecutionReport {
                            success: false,
                            elapsed_ms: start_time.elapsed().as_millis() as u64,
                            results,
                            error: Some(format!("Pipeline aborted at node '{}': {}", node.label, err_msg)),
                        };
                    }
                    ErrorPolicy::ContinueOnError => {
                        let err_val = serde_json::json!({ "error": err_msg });
                        context.insert(node_id.clone(), err_val.clone());
                    }
                }
            } else {
                results.push(NodeExecutionResult {
                    node_id: node_id.clone(),
                    success: true,
                    elapsed_ms: elapsed,
                    output: serde_json::to_string(&output).unwrap_or_else(|_| "null".to_string()),
                    error: None,
                });
                context.insert(node_id.clone(), output);
            }
        }

        PipelineExecutionReport {
            success: true,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            results,
            error: None,
        }
    }

    /// Execute individual node type logic
    async fn execute_node(&self, node_type: &str, config: &serde_json::Value) -> Result<serde_json::Value, String> {
        match node_type {
            "api" => {
                let method_str = config.get("method").and_then(|v| v.as_str()).unwrap_or("GET");
                let url = config.get("url").and_then(|v| v.as_str()).ok_or_else(|| "URL is required".to_string())?;
                
                let headers_val = config.get("headers");
                let mut headers = HashMap::new();
                if let Some(h_obj) = headers_val.and_then(|v| v.as_object()) {
                    for (k, v) in h_obj {
                        if let Some(s) = v.as_str() {
                            headers.insert(k.clone(), s.to_string());
                        }
                    }
                }

                let body = config.get("body").and_then(|v| {
                    match v {
                        serde_json::Value::String(s) => Some(s.clone()),
                        serde_json::Value::Null => None,
                        other => Some(other.to_string()),
                    }
                });

                let method: reqwest::Method = method_str.to_uppercase().parse()
                    .map_err(|e| format!("Invalid HTTP method: {}", e))?;

                let client = reqwest::Client::builder()
                    .danger_accept_invalid_certs(true)
                    .timeout(std::time::Duration::from_secs(30))
                    .build()
                    .map_err(|e| format!("HTTP Client init failed: {}", e))?;

                let mut builder = client.request(method, url);
                for (k, v) in &headers {
                    builder = builder.header(k.as_str(), v.as_str());
                }

                if let Some(b) = body {
                    builder = builder.body(b);
                    if !headers.keys().any(|k| k.eq_ignore_ascii_case("content-type")) {
                        builder = builder.header("content-type", "application/json");
                    }
                }

                let resp = builder.send().await
                    .map_err(|e| format!("API request failed: {}", e))?;

                let status = resp.status().as_u16();
                
                // Parse headers
                let mut resp_headers = HashMap::new();
                for (k, v) in resp.headers() {
                    if let Ok(val) = v.to_str() {
                        resp_headers.insert(k.as_str().to_string(), val.to_string());
                    }
                }

                let text = resp.text().await
                    .map_err(|e| format!("Failed to read response body: {}", e))?;

                // Try parsing body as JSON, if fail keep as string
                let parsed_body: serde_json::Value = serde_json::from_str(&text)
                    .unwrap_or_else(|_| serde_json::Value::String(text));

                Ok(serde_json::json!({
                    "statusCode": status,
                    "headers": resp_headers,
                    "body": parsed_body
                }))
            }
            "crypto" => {
                let action_str = config.get("action").and_then(|v| v.as_str()).ok_or_else(|| "Action is required".to_string())?;
                let payload = config.get("payload").and_then(|v| {
                    match v {
                        serde_json::Value::String(s) => Some(s.as_str()),
                        serde_json::Value::Null => None,
                        other => Some(other.as_str().unwrap_or("")), // Fallback
                    }
                }).unwrap_or("");

                let key = config.get("key").and_then(|v| v.as_str());
                let iv = config.get("iv").and_then(|v| v.as_str());

                let action: CryptoAction = serde_json::from_value(serde_json::json!(action_str))
                    .map_err(|_| format!("Unsupported crypto action: {}", action_str))?;

                let result = self.crypto_service.process_crypto(action, payload, key, iv)?;
                
                // Try parsing result as JSON if action is JwtDecode, otherwise return as String
                let result_val = if matches!(action, CryptoAction::JwtDecode) {
                    serde_json::from_str(&result).unwrap_or(serde_json::Value::String(result))
                } else {
                    serde_json::Value::String(result)
                };

                Ok(serde_json::json!({
                    "result": result_val
                }))
            }
            "schema" => {
                let payload = config.get("payload").and_then(|v| {
                    match v {
                        serde_json::Value::String(s) => Some(s.clone()),
                        other => Some(other.to_string()),
                    }
                }).ok_or_else(|| "Payload is required".to_string())?;

                let schema = config.get("schema").and_then(|v| {
                    match v {
                        serde_json::Value::String(s) => Some(s.clone()),
                        other => Some(other.to_string()),
                    }
                }).ok_or_else(|| "Schema is required".to_string())?;

                match self.crypto_service.validate_json_schema(&payload, &schema) {
                    Ok(()) => {
                        Ok(serde_json::json!({
                            "valid": true,
                            "errors": null
                        }))
                    }
                    Err(e) => {
                        Ok(serde_json::json!({
                            "valid": false,
                            "errors": e
                        }))
                    }
                }
            }
            "preview" => {
                Ok(config.clone())
            }
            "mapper" => {
                let mut out_obj = serde_json::Map::new();
                if let Some(mappings) = config.get("mappings").and_then(|v| v.as_array()) {
                    for m in mappings {
                        if let (Some(k), Some(v)) = (m.get("targetKey").and_then(|v| v.as_str()), m.get("sourceValue")) {
                            if !k.trim().is_empty() {
                                out_obj.insert(k.trim().to_string(), v.clone());
                            }
                        }
                    }
                }
                Ok(serde_json::Value::Object(out_obj))
            }
            other => Err(format!("Unsupported node type: {}", other)),
        }
    }
}

/// Dotted variable path resolver helper
fn resolve_path<'a>(
    path: &str,
    context: &'a HashMap<String, serde_json::Value>,
) -> Option<&'a serde_json::Value> {
    let parts: Vec<&str> = path.split('.').collect();
    if parts.is_empty() {
        return None;
    }
    let node_id = parts[0];
    let mut current_val = context.get(node_id)?;

    for &key in &parts[1..] {
        match current_val {
            serde_json::Value::Object(map) => {
                current_val = map.get(key)?;
            }
            serde_json::Value::Array(arr) => {
                if let Ok(idx) = key.parse::<usize>() {
                    current_val = arr.get(idx)?;
                } else {
                    return None;
                }
            }
            _ => return None,
        }
    }

    Some(current_val)
}

/// Recursively traverses and interpolates `{{node_id.path}}` inside json configurations
fn interpolate_value(val: &mut serde_json::Value, context: &HashMap<String, serde_json::Value>) {
    match val {
        serde_json::Value::String(s) => {
            if s.starts_with("{{") && s.ends_with("}}") {
                let path = &s[2..s.len() - 2];
                if let Some(resolved) = resolve_path(path, context) {
                    *val = resolved.clone();
                }
            } else {
                let mut new_s = s.clone();
                while let Some(start_idx) = new_s.find("{{") {
                    if let Some(end_idx) = new_s[start_idx..].find("}}") {
                        let actual_end = start_idx + end_idx;
                        let path = &new_s[start_idx + 2..actual_end];
                        if let Some(resolved) = resolve_path(path, context) {
                            let resolved_str = match resolved {
                                serde_json::Value::String(rs) => rs.clone(),
                                other => other.to_string(),
                            };
                            new_s.replace_range(start_idx..actual_end + 2, &resolved_str);
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                *val = serde_json::Value::String(new_s);
            }
        }
        serde_json::Value::Object(map) => {
            for (_, v) in map.iter_mut() {
                interpolate_value(v, context);
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr.iter_mut() {
                interpolate_value(v, context);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_topo_sort_happy_path() {
        let runner = PipelineRunner::new();
        let flow = PipelineFlow {
            nodes: vec![
                PipelineNode {
                    id: "A".to_string(),
                    label: "Node A".to_string(),
                    node_type: "crypto".to_string(),
                    config: "{}".to_string(),
                },
                PipelineNode {
                    id: "B".to_string(),
                    label: "Node B".to_string(),
                    node_type: "crypto".to_string(),
                    config: "{}".to_string(),
                },
                PipelineNode {
                    id: "C".to_string(),
                    label: "Node C".to_string(),
                    node_type: "crypto".to_string(),
                    config: "{}".to_string(),
                },
            ],
            edges: vec![
                PipelineEdge {
                    id: "e1".to_string(),
                    source: "A".to_string(),
                    target: "B".to_string(),
                },
                PipelineEdge {
                    id: "e2".to_string(),
                    source: "B".to_string(),
                    target: "C".to_string(),
                },
            ],
        };

        let sorted = runner.sort_dag(&flow).unwrap();
        assert_eq!(sorted, vec!["A".to_string(), "B".to_string(), "C".to_string()]);
    }

    #[test]
    fn test_topo_sort_cycle_detection() {
        let runner = PipelineRunner::new();
        let flow = PipelineFlow {
            nodes: vec![
                PipelineNode {
                    id: "A".to_string(),
                    label: "Node A".to_string(),
                    node_type: "crypto".to_string(),
                    config: "{}".to_string(),
                },
                PipelineNode {
                    id: "B".to_string(),
                    label: "Node B".to_string(),
                    node_type: "crypto".to_string(),
                    config: "{}".to_string(),
                },
            ],
            edges: vec![
                PipelineEdge {
                    id: "e1".to_string(),
                    source: "A".to_string(),
                    target: "B".to_string(),
                },
                PipelineEdge {
                    id: "e2".to_string(),
                    source: "B".to_string(),
                    target: "A".to_string(),
                },
            ],
        };

        let result = runner.sort_dag(&flow);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Cycle detected in pipeline graph. Cannot execute cyclic flows.");
    }

    #[test]
    fn test_resolve_path_helper() {
        let mut context = HashMap::new();
        context.insert(
            "node_1".to_string(),
            serde_json::json!({
                "body": {
                    "token": "secret_abc",
                    "user": {
                        "name": "Jane"
                    }
                }
            })
        );

        let res1 = resolve_path("node_1.body.token", &context).unwrap();
        assert_eq!(res1.as_str().unwrap(), "secret_abc");

        let res2 = resolve_path("node_1.body.user.name", &context).unwrap();
        assert_eq!(res2.as_str().unwrap(), "Jane");

        let res_none = resolve_path("node_1.body.invalid", &context);
        assert!(res_none.is_none());
    }

    #[test]
    fn test_interpolate_value_helper() {
        let mut context = HashMap::new();
        context.insert(
            "crypto_node".to_string(),
            serde_json::json!({
                "output": "processed_payload"
            })
        );

        let mut test_val = serde_json::json!("{{crypto_node.output}}");
        interpolate_value(&mut test_val, &context);
        assert_eq!(test_val.as_str().unwrap(), "processed_payload");

        let mut test_mixed_val = serde_json::json!("Prefix {{crypto_node.output}} Suffix");
        interpolate_value(&mut test_mixed_val, &context);
        assert_eq!(test_mixed_val.as_str().unwrap(), "Prefix processed_payload Suffix");
    }
}
