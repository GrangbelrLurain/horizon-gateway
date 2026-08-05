use std::sync::Arc;

use axum::{
    body::Body,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};

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
  window.__wt_api_traffic_logs=window.__wt_api_traffic_logs||[];

  function isStatic(u){
    if(!u)return true;
    var s=String(u).toLowerCase().split('?')[0];
    return s.endsWith('.png')||s.endsWith('.jpg')||s.endsWith('.jpeg')||s.endsWith('.gif')||
           s.endsWith('.svg')||s.endsWith('.webp')||s.endsWith('.ico')||s.endsWith('.css')||
           s.endsWith('.js')||s.endsWith('.woff')||s.endsWith('.woff2')||s.endsWith('.ttf')||
           s.endsWith('.mp4')||s.endsWith('.mp3');
  }

  function parseHeaders(hdrs){
    var res={};
    try{
      if(hdrs&&typeof hdrs.forEach==='function'){
        hdrs.forEach(function(v,k){res[k]=v;});
      }else if(hdrs&&typeof hdrs==='object'){
        for(var k in hdrs){res[k.toLowerCase()]=String(hdrs[k]);};
      }
    }catch(e){}
    return res;
  }

  function parseXhrHeaders(str){
    var res={};
    if(!str)return res;
    var lines=str.trim().split(/[\r\n]+/);
    for(var i=0;i<lines.length;i++){
      var parts=lines[i].split(': ');
      if(parts.length>=2){
        res[parts[0].toLowerCase()]=parts.slice(1).join(': ');
      }
    }
    return res;
  }

  function logLog(url,method,status,duration,isMocked,reqHdrs,reqBody,respHdrs,respBody){
    try{
      if(!url||url.indexOf('/.horizon-gateway/')!==-1||isStatic(url))return;
      var entry={
        id:Math.random().toString(36).substring(2)+Date.now().toString(36),
        url:String(url),
        method:String(method||'GET').toUpperCase(),
        status:Number(status)||200,
        duration:Math.round(duration),
        timestamp:Date.now(),
        isMocked:!!isMocked,
        requestHeaders:reqHdrs,
        requestBody:reqBody,
        responseHeaders:respHdrs,
        responseBody:respBody
      };
      window.__wt_api_traffic_logs.unshift(entry);
      if(window.__wt_api_traffic_logs.length>1000)window.__wt_api_traffic_logs.pop();
      window.dispatchEvent(new CustomEvent('wt:traffic-log',{detail:entry}));
    }catch(e){}
  }

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
      var t0=performance.now();
      var req=a[0];
      var u=typeof req==='string'?req:(req&&req.url?req.url:String(req||''));
      var m=req&&req.method?req.method:(a[1]&&a[1].method?a[1].method:'GET');
      var reqBodyStr=a[1]&&a[1].body?String(a[1].body):undefined;
      var reqHdrs=parseHeaders(a[1]&&a[1].headers?a[1].headers:(req&&req.headers?req.headers:undefined));

      return of.apply(this,a).then(function(res){
        var t1=performance.now();
        try{
          mark(u,m,function(k){return res.headers.get(k);});
          if(!isStatic(u)&&u.indexOf('/.horizon-gateway/')===-1){
            var mb=res.headers.get('x-mocked-by');
            var respHdrs=parseHeaders(res.headers);
            var c=res.clone();
            c.text().then(function(txt){
              var trunc=txt&&txt.length>10000000?txt.substring(0,10000000)+'\n...(truncated)':txt;
              logLog(u,m,res.status,t1-t0,!!mb,reqHdrs,reqBodyStr,respHdrs,trunc);
            }).catch(function(){
              logLog(u,m,res.status,t1-t0,!!mb,reqHdrs,reqBodyStr,respHdrs,undefined);
            });
          }
        }catch(e){}
        return res;
      });
    };
  }

  var xo=XMLHttpRequest.prototype.open;
  var xs=XMLHttpRequest.prototype.send;
  var xsh=XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open=function(m,u){
    this.__wtU=String(u);
    this.__wtM=String(m);
    this.__wtT0=performance.now();
    this.__wtReqHdrs={};
    return xo.apply(this,arguments);
  };
  if(xsh){
    XMLHttpRequest.prototype.setRequestHeader=function(k,v){
      try{if(!this.__wtReqHdrs)this.__wtReqHdrs={};this.__wtReqHdrs[String(k).toLowerCase()]=String(v);}catch(e){}
      return xsh.apply(this,arguments);
    };
  }
  XMLHttpRequest.prototype.send=function(b){
    var reqBodyStr=typeof b==='string'?b:undefined;
    this.addEventListener('loadend',function(){
      var self=this;
      var t1=performance.now();
      var u=self.__wtU||self.responseURL;
      var m=self.__wtM||'GET';
      var mb=self.getResponseHeader('x-mocked-by');
      mark(u,m,function(k){return self.getResponseHeader(k);});
      var respHdrs=parseXhrHeaders(self.getAllResponseHeaders());
      var respBody;
      try{
        if(typeof self.responseText==='string'){
          respBody=self.responseText.length>10000000?self.responseText.substring(0,10000000)+'\n...(truncated)':self.responseText;
        }
      }catch(e){}
      logLog(u,m,self.status||200,t1-(self.__wtT0||t1),!!mb,self.__wtReqHdrs,reqBodyStr,respHdrs,respBody);
    });
    return xs.apply(this,b);
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

pub(crate) fn build_proxy_error_response(host_h: &str, error_msg: &str) -> Response {
    let raw_html = format!(
        r#"<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>로컬 타깃 서버 연결 실패 - Watchtower</title>
  <style>
    body {{
      background-color: #0f172a;
      color: #f3f4f6;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }}
    .card {{
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(239, 68, 68, 0.4);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      border-radius: 16px;
      padding: 32px;
      max-width: 520px;
      width: 100%;
      text-align: center;
    }}
    h2 {{ color: #ef4444; margin-top: 0; font-size: 20px; font-weight: 800; }}
    p {{ color: rgba(255,255,255,0.7); font-size: 13px; line-height: 1.6; margin: 12px 0; }}
    .err-code {{ background: rgba(0,0,0,0.4); color: #f59e0b; padding: 10px 14px; border-radius: 8px; font-family: monospace; font-size: 11px; margin: 16px 0; word-break: break-all; text-align: left; }}
    .tip {{ font-size: 12px; color: #10b981; margin-top: 20px; font-weight: 600; background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 8px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>⚠️ 로컬 타깃 서버 연결 실패</h2>
    <p>로컬 프록시 라우트에 지정된 타깃 서버(<strong>{host_h}</strong>)로 연결할 수 없습니다.<br/>개발 서버(예: <code>npm run dev</code> / <code>localhost:3000</code>)가 정상 실행 중인지 확인하세요.</p>
    <div class="err-code">Proxy Error: {error_msg}</div>
    <div class="tip">💡 하단 우측 Watchtower 툴바의 <strong>[PRX]</strong> 버튼을 클릭하여 로컬 프록시 라우트를 OFF로 끌 수 있습니다.</div>
  </div>
</body>
</html>"#
    );

    let injected = inject_inspector_script(raw_html.into_bytes());

    let mut response = Response::builder()
        .status(StatusCode::BAD_GATEWAY)
        .body(Body::from(injected))
        .unwrap_or_else(|_| (StatusCode::BAD_GATEWAY, "Proxy Error").into_response());

    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/html; charset=utf-8"),
    );
    apply_html_injection_cache_headers(response.headers_mut());
    response
}
