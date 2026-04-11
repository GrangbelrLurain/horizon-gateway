(function () {
  if (window.__WATCHTOWER_DASHBOARD_LOADED__) return;
  window.__WATCHTOWER_DASHBOARD_LOADED__ = true;

  console.log("[Watchtower] Dashboard Initializing...");

  // Load html2canvas from CDN
  if (!window.html2canvas) {
    const script = document.createElement("script");
    script.src = "https://html2canvas.hertzen.com/dist/html2canvas.min.js";
    document.head.appendChild(script);
  }

  let isInspectMode = false;
  let isMenuOpen = false;
  let overlay = null;

  const CSS = `
    #wt-dashboard-root {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #wt-main-btn {
      width: 50px;
      height: 50px;
      background-color: #3b82f6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: 2px solid white;
    }
    #wt-main-btn:hover {
      transform: scale(1.1);
    }
    #wt-main-btn img {
      width: 30px;
      height: 30px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    #wt-menu {
      position: absolute;
      bottom: 60px;
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      width: 200px;
      overflow: hidden;
      display: none;
      border: 1px solid #e2e8f0;
      animation: wt-slide-up 0.2s ease-out;
    }
    @keyframes wt-slide-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .wt-menu-item {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: background 0.2s;
      color: #1e293b;
      font-size: 14px;
      font-weight: 500;
    }
    .wt-menu-item:hover {
      background: #f1f5f9;
    }
    .wt-menu-item svg {
      width: 18px;
      height: 18px;
      color: #64748b;
    }
    .wt-menu-header {
      padding: 10px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }
    #wt-inspector-overlay {
      position: fixed;
      pointer-events: none;
      background-color: rgba(59, 130, 246, 0.2);
      border: 2px solid #3b82f6;
      z-index: 2147483647;
      display: none;
    }
    .wt-active {
      background-color: #ef4444 !important;
    }
  `;

  function injectCSS() {
    const style = document.createElement("style");
    style.innerHTML = CSS;
    document.head.appendChild(style);
  }

  function createUI() {
    const root = document.createElement("div");
    root.id = "wt-dashboard-root";

    const menu = document.createElement("div");
    menu.id = "wt-menu";
    menu.innerHTML = `
      <div class="wt-menu-header">Watchtower Dashboard</div>
      <div class="wt-menu-item" id="wt-opt-inspect">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        UI Inspect Mode
      </div>
      <div class="wt-menu-item" id="wt-opt-focus">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
        Open Watchtower App
      </div>
      <div class="wt-menu-item" id="wt-opt-setup">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.756 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        Proxy Setup
      </div>
      <div class="wt-menu-item" onclick="window.location.reload(true)">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        Hard Refresh
      </div>
    `;

    const btn = document.createElement("div");
    btn.id = "wt-main-btn";
    btn.title = "Watchtower Dashboard";
    btn.innerHTML = `<img src="/.watchtower/logo.svg" alt="WT">`;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      isMenuOpen = !isMenuOpen;
      menu.style.display = isMenuOpen ? "block" : "none";
    });

    root.appendChild(menu);
    root.appendChild(btn);
    document.body.appendChild(root);

    // Event Listeners
    document.getElementById("wt-opt-focus").onclick = () => fetch("/.watchtower/api/focus");
    document.getElementById("wt-opt-setup").onclick = () => window.open("/.watchtower/setup", "_blank");
    document.getElementById("wt-opt-inspect").onclick = (e) => {
      isInspectMode = !isInspectMode;
      document.getElementById("wt-main-btn").classList.toggle("wt-active", isInspectMode);
      isMenuOpen = false;
      menu.style.display = "none";
      if (!isInspectMode && overlay) overlay.style.display = "none";
    };

    window.addEventListener("click", () => {
      isMenuOpen = false;
      menu.style.display = "none";
    });
  }

  function getSelector(el) {
    if (el.id) return "#" + el.id;
    if (el === document.body) return "body";
    let path = [];
    let current = el;
    while (current && current.parentElement) {
      let name = current.localName;
      if (current.className && typeof current.className === "string") {
        let classes = current.className.trim().split(/\s+/).filter(c => !c.includes(":") && !c.includes("[") && c.length > 0);
        if (classes.length) name += "." + classes.join(".");
      }
      let index = Array.from(current.parentElement.children).indexOf(current) + 1;
      path.unshift(name + ":nth-child(" + index + ")");
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  document.addEventListener("mouseover", (e) => {
    if (!isInspectMode) return;
    if (e.target.closest("#wt-dashboard-root")) return;

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "wt-inspector-overlay";
      document.body.appendChild(overlay);
    }

    const rect = e.target.getBoundingClientRect();
    overlay.style.top = rect.top + "px";
    overlay.style.left = rect.left + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    overlay.style.display = "block";
  }, true);

  document.addEventListener("click", async (e) => {
    if (!isInspectMode) return;
    if (e.target.closest("#wt-dashboard-root")) return;

    e.preventDefault(); e.stopPropagation();
    const target = e.target;
    const selector = getSelector(target);
    const content = target.innerText ? target.innerText.substring(0, 100) : "";
    const tagName = target.tagName;

    if (overlay) overlay.style.display = "none";
    target.style.outline = "2px solid #3b82f6";

    try {
      if (!window.html2canvas) throw new Error("html2canvas loading...");
      const canvas = await window.html2canvas(target, { logging: false, useCORS: true, scale: 1 });
      const thumbnail = canvas.toDataURL("image/png");

      const res = await fetch("/.watchtower/api/annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selector, content, tagName, thumbnail }),
      });

      if (res.ok) {
        target.style.outline = "2px solid #22c55e";
        setTimeout(() => { target.style.outline = ""; }, 800);
        // Automatically open app to show the result
        fetch("/.watchtower/api/focus");
      }
    } catch (err) {
      console.error(err);
      target.style.outline = "";
    } finally {
      if (isInspectMode && overlay) overlay.style.display = "block";
    }
  }, true);

  injectCSS();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }
})();
