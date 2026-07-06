use serde_json::Value;

pub fn apply_query(value: &Value, query: &str) -> Value {
    if query.trim().is_empty() {
        return value.clone();
    }
    let path_parts = split_query_path(query);
    evaluate_path(value, &path_parts)
}

fn split_query_path(query: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut in_bracket = 0; // Tracks nesting of [] or {}

    for c in query.chars() {
        match c {
            '.' if in_bracket == 0 => {
                if !current.is_empty() {
                    parts.push(current.clone());
                    current.clear();
                }
            }
            '[' | '{' => {
                in_bracket += 1;
                current.push(c);
            }
            ']' | '}' => {
                if in_bracket > 0 {
                    in_bracket -= 1;
                }
                current.push(c);
            }
            _ => {
                current.push(c);
            }
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }
    parts
}

fn evaluate_path(value: &Value, parts: &[String]) -> Value {
    if parts.is_empty() {
        return value.clone();
    }

    let part = &parts[0];
    let rest = &parts[1..];

    // Check if part is array projection: "[]"
    if part == "[]" {
        if let Some(arr) = value.as_array() {
            let projected: Vec<Value> = arr
                .iter()
                .map(|item| evaluate_path(item, rest))
                .filter(|v| !v.is_null())
                .collect();
            return Value::Array(projected);
        }
        return Value::Null;
    }

    // Check if part is object slicing: "{field1,field2,...}"
    if part.starts_with('{') && part.ends_with('}') {
        let fields_str = &part[1..part.len() - 1];
        let fields: Vec<&str> = fields_str.split(',').map(|s| s.trim()).collect();

        if let Some(obj) = value.as_object() {
            let mut sliced = serde_json::Map::new();
            for field in fields {
                if let Some(val) = obj.get(field) {
                    sliced.insert(field.to_string(), val.clone());
                }
            }
            return Value::Object(sliced);
        }

        // Also support array of objects directly if they didn't write "[]"
        if let Some(arr) = value.as_array() {
            let projected: Vec<Value> = arr
                .iter()
                .map(|item| evaluate_path(item, parts))
                .filter(|v| !v.is_null())
                .collect();
            return Value::Array(projected);
        }

        return Value::Null;
    }

    // Check if part has filter: "name[cond]"
    if part.contains('[') && part.ends_with(']') {
        let open_idx = part.find('[').unwrap();
        let key = &part[0..open_idx];
        let cond_str = &part[open_idx + 1..part.len() - 1];

        let current_val = if key.is_empty() {
            value
        } else if let Some(obj) = value.as_object() {
            if let Some(v) = obj.get(key) {
                v
            } else {
                return Value::Null;
            }
        } else {
            return Value::Null;
        };

        if let Some(arr) = current_val.as_array() {
            if let Some((field, op, expected)) = parse_condition(cond_str) {
                let filtered: Vec<Value> = arr
                    .iter()
                    .filter(|item| {
                        if let Some(item_obj) = item.as_object() {
                            if let Some(val) = item_obj.get(&field) {
                                match op.as_str() {
                                    "=" | "==" => compare_eq(val, &expected),
                                    ">=" => compare_num(val, &expected, |a, b| a >= b),
                                    "<=" => compare_num(val, &expected, |a, b| a <= b),
                                    ">" => compare_num(val, &expected, |a, b| a > b),
                                    "<" => compare_num(val, &expected, |a, b| a < b),
                                    _ => false,
                                }
                            } else {
                                false
                            }
                        } else {
                            false
                        }
                    })
                    .cloned()
                    .collect();

                return evaluate_path(&Value::Array(filtered), rest);
            }
        }
        return Value::Null;
    }

    // Normal key access
    if let Some(obj) = value.as_object() {
        if let Some(next) = obj.get(part) {
            return evaluate_path(next, rest);
        }
    }

    // Also support implicit array projection: if value is an array and key is accessed, we project it.
    if let Some(arr) = value.as_array() {
        let projected: Vec<Value> = arr
            .iter()
            .map(|item| evaluate_path(item, parts))
            .filter(|v| !v.is_null())
            .collect();
        return Value::Array(projected);
    }

    Value::Null
}

fn parse_condition(cond: &str) -> Option<(String, String, String)> {
    let ops = vec![">=", "<=", "==", "=", ">", "<"];
    for op in ops {
        if let Some(idx) = cond.find(op) {
            let field = cond[0..idx].trim().to_string();
            let op_str = op.to_string();
            let val = cond[idx + op.len()..].trim().to_string();
            return Some((field, op_str, val));
        }
    }
    None
}

fn compare_eq(val: &Value, expected: &str) -> bool {
    if let Some(s) = val.as_str() {
        s == expected
    } else if let Some(n) = val.as_i64() {
        if let Ok(exp_num) = expected.parse::<i64>() {
            n == exp_num
        } else {
            false
        }
    } else if let Some(b) = val.as_bool() {
        if let Ok(exp_bool) = expected.parse::<bool>() {
            b == exp_bool
        } else {
            false
        }
    } else {
        false
    }
}

fn compare_num<F>(val: &Value, expected: &str, compare: F) -> bool
where
    F: Fn(f64, f64) -> bool,
{
    let val_f64 = if let Some(n) = val.as_f64() {
        n
    } else if let Some(n) = val.as_i64() {
        n as f64
    } else if let Some(n) = val.as_u64() {
        n as f64
    } else {
        return false;
    };

    if let Ok(exp_f64) = expected.parse::<f64>() {
        compare(val_f64, exp_f64)
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_split_query_path() {
        assert_eq!(split_query_path("data.logs"), vec!["data", "logs"]);
        assert_eq!(
            split_query_path("data.logs.[].{path,statusCode}"),
            vec!["data", "logs", "[]", "{path,statusCode}"]
        );
        assert_eq!(
            split_query_path("logs[statusCode>=500].path"),
            vec!["logs[statusCode>=500]", "path"]
        );
    }

    #[test]
    fn test_apply_query() {
        let val = json!({
            "success": true,
            "data": {
                "logs": [
                    {"path": "/a", "statusCode": 200},
                    {"path": "/b", "statusCode": 500},
                    {"path": "/c", "statusCode": 404}
                ]
            }
        });

        // 1. Basic path
        assert_eq!(apply_query(&val, "success"), json!(true));
        
        // 2. Array projection
        assert_eq!(apply_query(&val, "data.logs.[].path"), json!(["/a", "/b", "/c"]));
        
        // 3. Object slicing
        assert_eq!(
            apply_query(&val, "data.logs.[].{path,statusCode}"),
            json!([
                {"path": "/a", "statusCode": 200},
                {"path": "/b", "statusCode": 500},
                {"path": "/c", "statusCode": 404}
            ])
        );

        // 4. Condition filter
        assert_eq!(
            apply_query(&val, "data.logs[statusCode>=500].path"),
            json!(["/b"])
        );
        assert_eq!(
            apply_query(&val, "data.logs[statusCode=404].path"),
            json!(["/c"])
        );
    }
}
