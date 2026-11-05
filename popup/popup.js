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

  // src/shared/schema.ts
  var VALID_THEMES = ["system", "light", "dark"];
  function isValidThemePreference(x) {
    return typeof x === "string" && VALID_THEMES.includes(x);
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
  var DEFAULT_THEME = "system";
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
  async function getThemePreference() {
    const raw = await safeGet(chrome.storage.local, STORAGE_KEYS.theme);
    return isValidThemePreference(raw) ? raw : DEFAULT_THEME;
  }
  async function getOrCreateInstallId() {
    const existing = await safeGet(chrome.storage.local, STORAGE_KEYS.installId);
    if (typeof existing === "string" && existing.length > 0) return existing;
    const id = crypto.randomUUID();
    await safeSet(chrome.storage.local, STORAGE_KEYS.installId, id);
    return id;
  }

  // src/shared/theme.ts
  function applyToDocument(pref) {
    const root = document.documentElement;
    if (pref === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", pref);
    }
  }
  async function applyStoredTheme() {
    const pref = await getThemePreference();
    applyToDocument(pref);
    return pref;
  }
  function watchThemeChanges(onChange) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") return;
        const change = changes[STORAGE_KEYS.theme];
        if (!change) return;
        const next = change.newValue === "light" || change.newValue === "dark" ? change.newValue : "system";
        applyToDocument(next);
        onChange?.(next);
      });
    } catch (err) {
      console.warn("[cleanlink] theme watchThemeChanges unavailable", err);
    }
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

  // src/popup/popup.ts
  var UPGRADE_URL_BASE = "https://zovo.one/pricing?utm_source=cleanlink&utm_medium=extension&utm_campaign=upgrade";
  var upgradeUrl = (surface) => `${UPGRADE_URL_BASE}&utm_content=${surface}`;
  var NUDGE_SEEN_KEY = "zovo_cleanlink_nudge_seen";
  var CAP_BANNER_SEEN_KEY = "zovo_cleanlink_cap_banner_seen";
  var $ = (id) => document.getElementById(id);
  var statusChip = $("status-chip");
  var statusChipText = $("status-chip-text");
  var heroCount = $("hero-count");
  var heroLabel = $("hero-label");
  var heroProgressFill = $("hero-progress-fill");
  var heroSrStatus = $("hero-sr-status");
  var capBanner = $("cap-banner");
  var capBannerText = $("cap-banner-text");
  var masterToggle = $("master-toggle");
  var masterToggleSub = $("master-toggle-sub");
  var allowRow = $("allow-row");
  var allowToggle = $("allow-toggle");
  var siteHost = $("site-host");
  var allowCapNote = $("allow-cap-note");
  var nudgeTip = $("nudge-tip");
  var nudgeText = $("nudge-text");
  var nudgeUpgradeLink = $("nudge-upgrade-link");
  var nudgeDismissBtn = $("nudge-dismiss");
  var proSection = $("pro-section");
  var proActiveSection = $("pro-active-section");
  var upgradeBtn = $("upgrade-btn");
  var settingsBtn = $("settings-btn");
  async function sendMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      return null;
    }
  }
  var state = {
    enabled: true,
    allowHosts: [],
    paramCount: 0,
    activeHost: null,
    tier: "free",
    copyCount: 0,
    copyCap: 15,
    allowlistCap: 1
  };
  async function loadState() {
    const res = await sendMessage({ action: "GET_STATE" });
    if (res) state = res;
    render();
  }
  function render() {
    renderStatusChip();
    renderHero();
    void renderCapBanner();
    renderMasterToggle();
    renderAllowRow();
    renderProSection();
    void renderNudge();
  }
  function renderStatusChip() {
    statusChip.classList.toggle("status-chip--on", state.enabled);
    statusChip.classList.toggle("status-chip--off", !state.enabled);
    statusChipText.textContent = state.enabled ? msg("statusOn") : msg("statusOff");
  }
  function renderHero() {
    const isPro = state.tier === "pro";
    heroCount.replaceChildren();
    if (isPro) {
      heroCount.appendChild(document.createTextNode("\u221E"));
      heroLabel.textContent = msg("heroLabelPro");
      heroProgressFill.style.width = "100%";
      heroSrStatus.textContent = msg("heroSrPro");
    } else {
      heroCount.appendChild(document.createTextNode(String(state.copyCount)));
      const sep = document.createElement("span");
      sep.className = "hero-cap-sep";
      sep.textContent = ` / ${state.copyCap}`;
      heroCount.appendChild(sep);
      heroLabel.textContent = msg("heroLabelFree");
      const pct = state.copyCap > 0 ? Math.min(100, state.copyCount / state.copyCap * 100) : 0;
      heroProgressFill.style.width = `${pct}%`;
      heroSrStatus.textContent = msg("heroSrFree", [String(state.copyCount), String(state.copyCap)]);
    }
  }
  async function renderCapBanner() {
    const hit = state.tier === "free" && state.copyCount >= state.copyCap;
    capBanner.hidden = !hit;
    if (!hit) return;
    capBannerText.textContent = msg("capBannerText", [String(state.copyCap)]);
    await announceCapHitOnce();
  }
  async function announceCapHitOnce() {
    let seen = false;
    try {
      const store = await chrome.storage.session.get(CAP_BANNER_SEEN_KEY);
      seen = Boolean(store[CAP_BANNER_SEEN_KEY]);
    } catch {
      seen = true;
    }
    if (seen) return;
    void emit("cap_hit", { feature: "copy_clean", cap: state.copyCap, surface: "popup" });
    void emit("paywall_shown", { trigger: "cap_hit", surface: "popup" });
    try {
      await chrome.storage.session.set({ [CAP_BANNER_SEEN_KEY]: true });
    } catch {
    }
  }
  function renderMasterToggle() {
    masterToggle.checked = state.enabled;
    masterToggleSub.textContent = msg("masterToggleSub", [String(state.paramCount)]);
  }
  function renderAllowRow() {
    const host = state.activeHost;
    siteHost.textContent = host ?? msg("noActiveSite");
    if (!host) {
      allowToggle.disabled = true;
      allowToggle.checked = false;
      allowRow.setAttribute("aria-disabled", "true");
      allowCapNote.hidden = true;
      return;
    }
    allowRow.removeAttribute("aria-disabled");
    const isAllowed = state.allowHosts.includes(host);
    allowToggle.checked = isAllowed;
    const atCap = state.tier === "free" && !isAllowed && state.allowHosts.length >= state.allowlistCap;
    allowToggle.disabled = atCap;
    allowCapNote.hidden = !atCap;
    if (atCap) allowCapNote.textContent = msg("allowlistCapReached", [String(state.allowlistCap)]);
  }
  function renderProSection() {
    const isPro = state.tier === "pro";
    proSection.hidden = isPro;
    proActiveSection.hidden = !isPro;
  }
  async function renderNudge() {
    if (state.tier !== "free" || state.copyCount < 1) {
      nudgeTip.hidden = true;
      return;
    }
    let seen = false;
    try {
      const store = await chrome.storage.session.get(NUDGE_SEEN_KEY);
      seen = Boolean(store[NUDGE_SEEN_KEY]);
    } catch {
      seen = true;
    }
    if (seen) {
      nudgeTip.hidden = true;
      return;
    }
    nudgeText.textContent = msg("nudgeText");
    nudgeTip.hidden = false;
    void emit("paywall_shown", { trigger: "post_win", surface: "popup_nudge" });
    try {
      await chrome.storage.session.set({ [NUDGE_SEEN_KEY]: true });
    } catch {
    }
  }
  async function setEnabled(enabled) {
    masterToggle.disabled = true;
    const prev = state.enabled;
    state = { ...state, enabled };
    renderStatusChip();
    const ack = await sendMessage({ action: "SET_ENABLED", enabled });
    masterToggle.disabled = false;
    if (!ack || !ack.ok) {
      state = { ...state, enabled: prev };
      renderStatusChip();
      renderMasterToggle();
      return;
    }
    await loadState();
  }
  async function setAllow(host, on) {
    allowToggle.disabled = true;
    const ack = await sendMessage({ action: "SET_ALLOW", host, on });
    allowToggle.disabled = false;
    if (!ack || !ack.ok) {
      await loadState();
      return;
    }
    await loadState();
  }
  function dismissNudge() {
    nudgeTip.hidden = true;
  }
  function openSettings() {
    try {
      chrome.runtime.openOptionsPage();
    } catch (err) {
      console.error("[cleanlink] openOptionsPage failed", err);
    }
  }
  function wireEvents() {
    masterToggle.addEventListener("change", () => {
      void setEnabled(masterToggle.checked);
    });
    allowToggle.addEventListener("change", () => {
      if (!state.activeHost) return;
      void setAllow(state.activeHost, allowToggle.checked);
    });
    nudgeDismissBtn.addEventListener("click", dismissNudge);
    settingsBtn.addEventListener("click", openSettings);
    upgradeBtn.addEventListener("click", () => void emit("cta_click", { surface: "popup" }));
    nudgeUpgradeLink.addEventListener("click", () => void emit("cta_click", { surface: "popup_nudge" }));
  }
  async function init() {
    await applyStoredTheme();
    watchThemeChanges();
    localizeHtml(document);
    upgradeBtn.href = upgradeUrl("popup");
    nudgeUpgradeLink.href = upgradeUrl("popup_nudge");
    wireEvents();
    await loadState();
  }
  void init();
})();
//# sourceMappingURL=popup.js.map
