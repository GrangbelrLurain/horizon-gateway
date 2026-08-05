use std::sync::Arc;

use axum::http::{header, HeaderMap, HeaderValue};

use crate::service::local_proxy::flags::{is_inspector_enabled, is_local_routing_enabled, is_mocking_enabled};

use super::super::routing::host_key_for_logging_map;
use super::super::state::ProxyState;

pub(crate) const INSPECTOR_INJECTION_SCRIPT: &str =
    r#"<script id="wt-injection-marker" type="module" src="/.horizon-gateway/inspector.js"></script>"#;

pub(crate) const EARLY_INTERCEPTOR_SCRIPT: &str = r#"<script id="wt-early-interceptor">
(function(){
  if(window.__wt_interceptor_installed)return;
  window.__wt_interceptor_installed=true;
  window.__wt_mocked_requests=window.__wt_mocked_requests||[];
  function mark(url,method,getHeader){
    try{
      if(!url||url.indexOf('/.horizon-gateway/')!==-1)return;
      var mb=getHeader('x-mocked-by');
      if(!mb)return;
      var rn=getHeader('x-mock-rule-name');
      var ri=getHeader('x-mock-rule-id');
      var entry={
        id:Math.random().toString(36).substring(2)+Date.now().toString(36),
        url:String(url),
        method:String(method||'GET').toUpperCase(),
        ruleName:rn||undefined,
        ruleId:ri||undefined,
        timestamp:Date.now()
      };
      window.__wt_mocked_requests.unshift(entry);
      window.dispatchEvent(new CustomEvent('wt:mocked-request',{detail:entry}));
    }catch(e){}
  }
  var of=window.fetch;
  if(of){
    window.fetch=function(){
      var a=arguments;
      return of.apply(this,a).then(function(res){
        try{
          var req=a[0];
          var u=typeof req==='string'?req:(req&&req.url?req.url:'');
          var m=req&&req.method?req.method:(a[1]&&a[1].method?a[1].method:'GET');
          mark(u,m,function(k){return res.headers.get(k);});
        }catch(e){}
        return res;
      });
    };
  }
  var xo=XMLHttpRequest.prototype.open;
  var xs=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){
    this.__wtU=String(u);
    this.__wtM=String(m);
    return xo.apply(this,arguments);
  };
  XMLHttpRequest.prototype.send=function(){
    this.addEventListener('loadend',function(){
      var self=this;
      mark(self.__wtU||self.responseURL,self.__wtM,function(k){return self.getResponseHeader(k);});
    });
    return xs.apply(this,arguments);
  };
})();
</script>"#;

pub(crate) fn apply_html_injection_cache_headers(headers: &mut HeaderMap) {
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, no-cache, must-revalidate, proxy-revalidate"),
    );
    headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    headers.remove(header::EXPIRES);
}

/// Injects early interceptor script in `<head>` and inspector script before `</body>`.
pub(crate) fn inject_inspector_script(mut body: Vec<u8>) -> Vec<u8> {
    let injection_script = INSPECTOR_INJECTION_SCRIPT;
    let early_script = EARLY_INTERCEPTOR_SCRIPT;

    let mut injected = false;
    if let Ok(body_str) = String::from_utf8(body.clone()) {
        let body_lower = body_str.to_lowercase();
        if !body_str.contains("wt-early-interceptor") {
            let mut new_body = body_str.clone();
            // Inject early script into <head> or at beginning of <body> or top
            if let Some(head_pos) = body_lower.find("<head>") {
                let pos = head_pos + 6;
                new_body.insert_str(pos, early_script);
            } else if let Some(body_pos) = body_lower.find("<body") {
                if let Some(gt_pos) = body_lower[body_pos..].find('>') {
                    let pos = body_pos + gt_pos + 1;
                    new_body.insert_str(pos, early_script);
                }
            } else {
                new_body.insert_str(0, early_script);
            }

            let new_lower = new_body.to_lowercase();
            if new_lower.contains("</body>") && !new_body.contains("wt-injection-marker") {
                if let Some(pos) = new_lower.rfind("</body>") {
                    let mut final_body = new_body[..pos].to_string();
                    final_body.push_str(injection_script);
                    final_body.push_str(&new_body[pos..]);
                    body = final_body.into_bytes();
                    injected = true;
                    crate::proxy_log!("✅ [Horizon Gateway] Inspector & Early Interceptor injected (UTF-8).");
                }
            } else {
                body = new_body.into_bytes();
            }
        }
    }

    if !injected {
        let pattern = b"</body>";
        let marker = b"wt-injection-marker";
        if !body.windows(marker.len()).any(|w| w == marker) {
            if let Some(pos) = body
                .windows(pattern.len())
                .rposition(|w: &[u8]| w.eq_ignore_ascii_case(pattern))
            {
                let mut new_bytes = Vec::with_capacity(body.len() + injection_script.len() + early_script.len());
                new_bytes.extend_from_slice(early_script.as_bytes());
                new_bytes.extend_from_slice(&body[..pos]);
                new_bytes.extend_from_slice(injection_script.as_bytes());
                new_bytes.extend_from_slice(&body[pos..]);
                body = new_bytes;
                crate::proxy_log!("✅ [Horizon Gateway] Inspector & Early Interceptor injected (Byte-level).");
            }
        }
    }

    body
}

pub(crate) fn should_inject_for_host(state: &Arc<ProxyState>, host: &str) -> bool {
    let mocking_enabled = state.mocking_service.get_settings().enabled || is_mocking_enabled();
    let is_active = is_inspector_enabled() || mocking_enabled || is_local_routing_enabled();
    if !is_active {
        return false;
    }
    let domains = state.inspector_service.get_injection_domains();
    if domains.is_empty() {
        return true;
    }
    let host_key = host_key_for_logging_map(host);
    domains.iter().any(|d| {
        let d_lower = d.to_lowercase();
        host_key == d_lower || host_key.ends_with(&format!(".{d_lower}"))
    })
}
