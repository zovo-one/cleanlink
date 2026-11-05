"use strict";
(() => {
  // src/shared/i18n.ts
  function msg(key, substitutions) {
    try {
      return chrome.i18n.getMessage(key, substitutions) || "";
    } catch {
      return "";
    }
  }
  var MSG_TOKEN = /__MSG_([A-Za-z0-9_]+)__/g;
  var MSG_TOKEN_TEST = /__MSG_([A-Za-z0-9_]+)__/;
  var LOCALIZED_ATTRS = ["placeholder", "aria-label", "title", "alt"];
  function resolveTokens(input) {
    return input.replace(MSG_TOKEN, (_m, key) => msg(key));
  }
  function localizeHtml(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.nodeValue && MSG_TOKEN_TEST.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const targets = [];
    let current = walker.nextNode();
    while (current) {
      if (current instanceof Text) targets.push(current);
      current = walker.nextNode();
    }
    for (const t of targets) {
      if (t.nodeValue) t.nodeValue = resolveTokens(t.nodeValue);
    }
    root.querySelectorAll("*").forEach((el) => {
      for (const name of LOCALIZED_ATTRS) {
        const v = el.getAttribute(name);
        if (v && MSG_TOKEN_TEST.test(v)) el.setAttribute(name, resolveTokens(v));
      }
    });
  }

  // src/shared/storage.ts
  var STORAGE_KEYS = {
    settings: "zovo_cleanlink_settings",
    // chrome.storage.sync (falls back to .local, see setSettings)
    usage: "zovo_cleanlink_usage",
    // chrome.storage.local — device-local by design
    license: "zovo_license",
    // chrome.storage.local — fleet-standard key name
    theme: "zovo_cleanlink_theme",
    // chrome.storage.local — device-local by design, UI-only
    installId: "zovo_cleanlink_install_id",
    // chrome.storage.local — random join-key for the (unwired-by-default) funnel-event sink, see shared/events.ts. Never transmitted by this file.
    firstValueAt: "zovo_cleanlink_first_value_at"
    // chrome.storage.local — epoch ms of the first real completed action, 0/unset until then. Fires the funnel's first_value event exactly once.
  };
  async function safeGet(area, key) {
    try {
      const result = await area.get(key);
      return result[key];
    } catch (err) {
      console.error(`[storage] get(${key}) failed:`, err);
      return void 0;
    }
  }
  async function safeSet(area, key, value) {
    try {
      await area.set({ [key]: value });
      return true;
    } catch (err) {
      console.error(`[storage] set(${key}) failed:`, err);
      return false;
    }
  }
  async function getOrCreateInstallId() {
    const existing = await safeGet(chrome.storage.local, STORAGE_KEYS.installId);
    if (typeof existing === "string" && existing.length > 0) return existing;
    const id = crypto.randomUUID();
    await safeSet(chrome.storage.local, STORAGE_KEYS.installId, id);
    return id;
  }

  // src/shared/events.ts
  var EXT_KEY = "cleanlink";
  var sink = null;
  async function emit(name, detail = {}) {
    if (!sink) return;
    try {
      const installId = await getOrCreateInstallId();
      sink(name, { t: Date.now(), installId, extKey: EXT_KEY, ...detail });
    } catch (err) {
      console.error("[cleanlink] emit failed", err);
    }
  }

  // src/pages/onboarding/onboarding.ts
  var TOTAL = 6;
  var i = 0;
  var offerShown = false;
  var steps = Array.from(document.querySelectorAll(".step"));
  var rail = document.getElementById("rail");
  var back = document.getElementById("back");
  var next = document.getElementById("next");
  var stepno = document.getElementById("stepno");
  for (let d = 0; d < TOTAL; d++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    rail.appendChild(dot);
  }
  var dots = Array.from(rail.children);
  function render() {
    steps.forEach((s, n) => {
      s.classList.toggle("on", n === i);
    });
    dots.forEach((dt, n) => {
      dt.className = "dot" + (n < i ? " done" : n === i ? " now" : "");
    });
    back.style.visibility = i === 0 ? "hidden" : "visible";
    stepno.textContent = msg("onbStepOf", [String(i + 1), String(TOTAL)]);
    next.textContent = i === TOTAL - 1 ? msg("onbStartBrowsing") : i === 4 ? msg("onbMaybeLater") : msg("onbNext");
    next.className = "btn " + (i === TOTAL - 1 ? "btn--primary" : "btn--primary");
    if (i === 1) setTimeout(runDemo, 350);
    if (i === 4 && !offerShown) {
      offerShown = true;
      void emit("paywall_shown", { trigger: "onboarding_offer", surface: "onboarding" });
    }
  }
  function go(n) {
    i = Math.max(0, Math.min(TOTAL - 1, n));
    render();
    try {
      if (chrome.storage && chrome.storage.local) chrome.storage.local.set({ cl_onboard_step: i });
    } catch {
    }
  }
  next.addEventListener("click", () => {
    if (i === TOTAL - 1) {
      finish(false);
    } else {
      go(i + 1);
    }
  });
  back.addEventListener("click", () => {
    go(i - 1);
  });
  document.getElementById("skip")?.addEventListener("click", () => finish(true));
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (e.key === "ArrowRight" || e.key === "Enter") {
      if (active?.tagName !== "INPUT" && active?.tagName !== "A") next.click();
    }
    if (e.key === "ArrowLeft") back.click();
  });
  function finish(skipped) {
    void emit("onboarding_complete", { steps: i + 1, skipped });
    try {
      if (chrome.storage && chrome.storage.local) chrome.storage.local.set({ cl_onboardingComplete: true });
    } catch {
    }
    try {
      if (chrome.tabs && chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent(function(t) {
          t && t.id != null ? chrome.tabs.remove(t.id) : window.close();
        });
      } else window.close();
    } catch {
      window.close();
    }
  }
  function runDemo() {
    const boxes = document.querySelectorAll('[data-step="1"] .box[data-fill]');
    boxes.forEach((b) => {
      b.classList.remove("filled");
      b.textContent = " ";
    });
    boxes.forEach((b, n) => {
      setTimeout(() => {
        const val = b.getAttribute("data-fill") || "";
        b.textContent = "";
        b.classList.add("filled");
        let k = 0;
        (function type() {
          b.textContent = val.slice(0, k);
          if (k <= val.length) {
            k++;
            setTimeout(type, 22);
          }
        })();
      }, 260 * n);
    });
  }
  document.getElementById("demoBtn")?.addEventListener("click", runDemo);
  var pinBtn = document.getElementById("pinBtn");
  pinBtn?.addEventListener("click", () => {
    try {
      if (chrome.storage && chrome.storage.local) chrome.storage.local.set({ cl_pinAcknowledged: true });
    } catch {
    }
    document.getElementById("pinned")?.classList.add("show");
    pinBtn.textContent = msg("onbS3PinBtnDone");
    pinBtn.disabled = true;
    pinBtn.style.opacity = "0.7";
  });
  document.getElementById("community-cta")?.addEventListener("click", () => {
    void emit("cta_click", { surface: "onboarding_community" });
  });
  document.getElementById("lifetime-cta")?.addEventListener("click", () => {
    void emit("cta_click", { surface: "onboarding_lifetime" });
  });
  localizeHtml(document);
  render();
})();
//# sourceMappingURL=onboarding.js.map
