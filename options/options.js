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
  var HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;
  function sanitizeHost(raw) {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 2048) return null;
    let candidate = trimmed.toLowerCase();
    if (candidate.includes("://") || candidate.includes("/") || candidate.includes("?") || candidate.includes("#")) {
      try {
        candidate = new URL(candidate.includes("://") ? candidate : `http://${candidate}`).hostname;
      } catch {
        return null;
      }
    } else {
      const colonIndex = candidate.indexOf(":");
      if (colonIndex !== -1) candidate = candidate.slice(0, colonIndex);
    }
    if (!HOSTNAME_RE.test(candidate)) return null;
    return candidate;
  }
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
  async function setThemePreference(pref) {
    if (!isValidThemePreference(pref)) {
      console.error("[storage] setThemePreference() rejected invalid value", pref);
      return false;
    }
    return safeSet(chrome.storage.local, STORAGE_KEYS.theme, pref);
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
  async function setTheme(pref) {
    applyToDocument(pref);
    return setThemePreference(pref);
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

  // src/options/options.ts
  var UPGRADE_URL_BASE = "https://zovo.one/pricing?utm_source=cleanlink&utm_medium=extension&utm_campaign=upgrade";
  var upgradeUrl = (surface) => `${UPGRADE_URL_BASE}&utm_content=${surface}`;
  var $ = (id) => document.getElementById(id);
  var statusChip = $("status-chip");
  var statusChipText = $("status-chip-text");
  var heroCount = $("hero-count");
  var heroSub = $("hero-sub");
  var heroSrStatus = $("hero-sr-status");
  var masterToggle = $("master-toggle");
  var masterToggleSub = $("master-toggle-sub");
  var hostList = $("host-list");
  var hostListEmpty = $("host-list-empty");
  var addHostForm = $("add-host-form");
  var addHostInput = $("add-host-input");
  var addHostBtn = $("add-host-btn");
  var addHostError = $("add-host-error");
  var allowlistCapNote = $("allowlist-cap-note");
  var usageText = $("usage-text");
  var usageProgressFill = $("usage-progress-fill");
  var proSection = $("pro-section");
  var proActiveSection = $("pro-active-section");
  var upgradeBtn = $("upgrade-btn");
  var headerGetPro = $("header-get-pro");
  var themeSeg = $("theme-seg");
  var themeButtons = Array.from(
    themeSeg.querySelectorAll(".zovo-seg__item")
  );
  var aboutVersion = $("about-version");
  var resetBtn = $("reset-btn");
  var resetConfirm = $("reset-confirm");
  var resetConfirmBtn = $("reset-confirm-btn");
  var resetCancelBtn = $("reset-cancel-btn");
  var resetDone = $("reset-done");
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
    renderMasterToggle();
    renderHostList();
    renderUsage();
    renderProSection();
  }
  function renderStatusChip() {
    statusChip.classList.toggle("status-chip--on", state.enabled);
    statusChip.classList.toggle("status-chip--off", !state.enabled);
    statusChipText.textContent = state.enabled ? msg("statusOn") : msg("statusOff");
  }
  function renderHero() {
    const isPro = state.tier === "pro";
    heroCount.textContent = String(state.paramCount);
    heroSub.textContent = isPro ? msg("optionsHeroSubPro") : msg("optionsHeroSubFree");
    heroSrStatus.textContent = `${state.paramCount} ${msg("optionsHeroLabel")}`;
  }
  function renderMasterToggle() {
    masterToggle.checked = state.enabled;
    masterToggleSub.textContent = msg("masterToggleSub", [String(state.paramCount)]);
  }
  function renderHostList() {
    hostList.replaceChildren();
    const hosts = state.allowHosts;
    hostListEmpty.hidden = hosts.length > 0;
    for (const host of hosts) {
      const li = document.createElement("li");
      li.className = "host-row";
      const label = document.createElement("span");
      label.className = "host-row__label zovo-mono";
      label.textContent = host;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "zovo-btn zovo-btn--ghost host-row__remove";
      removeBtn.textContent = msg("optionsAllowlistRemove");
      removeBtn.setAttribute("aria-label", `${msg("optionsAllowlistRemove")} ${host}`);
      removeBtn.addEventListener("click", () => {
        void removeHost(host, removeBtn);
      });
      li.appendChild(label);
      li.appendChild(removeBtn);
      hostList.appendChild(li);
    }
    const atCap = state.tier === "free" && hosts.length >= state.allowlistCap;
    addHostInput.disabled = atCap;
    addHostBtn.disabled = atCap;
    allowlistCapNote.hidden = !atCap;
    if (atCap) allowlistCapNote.textContent = msg("allowlistCapReached", [String(state.allowlistCap)]);
  }
  function renderUsage() {
    const isPro = state.tier === "pro";
    if (isPro) {
      usageText.textContent = msg("optionsUsageUnlimited");
      usageProgressFill.style.width = "100%";
    } else {
      usageText.textContent = msg("popupCopyCap", [String(state.copyCount), String(state.copyCap)]);
      const pct = state.copyCap > 0 ? Math.min(100, state.copyCount / state.copyCap * 100) : 0;
      usageProgressFill.style.width = `${pct}%`;
    }
  }
  function renderProSection() {
    const isPro = state.tier === "pro";
    proSection.hidden = isPro;
    proActiveSection.hidden = !isPro;
    headerGetPro.hidden = isPro;
    if (!isPro) void announceProSectionOnce();
  }
  var PRO_SECTION_SEEN_KEY = "zovo_cleanlink_options_pro_seen";
  async function announceProSectionOnce() {
    let seen = false;
    try {
      const store = await chrome.storage.session.get(PRO_SECTION_SEEN_KEY);
      seen = Boolean(store[PRO_SECTION_SEEN_KEY]);
    } catch {
      seen = true;
    }
    if (seen) return;
    void emit("paywall_shown", { trigger: "options_view", surface: "options" });
    try {
      await chrome.storage.session.set({ [PRO_SECTION_SEEN_KEY]: true });
    } catch {
    }
  }
  function renderTheme(pref) {
    for (const btn of themeButtons) {
      const isActive = btn.dataset.themeValue === pref;
      btn.setAttribute("aria-checked", String(isActive));
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
    const ack = await sendMessage({ action: "SET_ALLOW", host, on });
    await loadState();
    return Boolean(ack && ack.ok);
  }
  async function removeHost(host, triggerBtn) {
    triggerBtn.disabled = true;
    await setAllow(host, false);
  }
  function showAddHostError(text) {
    addHostError.textContent = text;
    addHostError.hidden = false;
  }
  function clearAddHostError() {
    addHostError.hidden = true;
    addHostError.textContent = "";
  }
  async function addHost() {
    clearAddHostError();
    const raw = addHostInput.value;
    const host = sanitizeHost(raw);
    if (!host) {
      showAddHostError(msg("optionsAllowlistInvalid"));
      return;
    }
    if (state.allowHosts.includes(host)) {
      showAddHostError(msg("optionsAllowlistDuplicate"));
      return;
    }
    addHostInput.disabled = true;
    addHostBtn.disabled = true;
    const ok = await setAllow(host, true);
    addHostInput.disabled = state.tier === "free" && state.allowHosts.length >= state.allowlistCap;
    addHostBtn.disabled = addHostInput.disabled;
    if (ok) {
      addHostInput.value = "";
    }
  }
  var resetInFlight = false;
  async function performReset() {
    if (resetInFlight) return;
    resetInFlight = true;
    resetConfirmBtn.disabled = true;
    resetCancelBtn.disabled = true;
    for (const host of [...state.allowHosts]) {
      await sendMessage({ action: "SET_ALLOW", host, on: false });
    }
    await sendMessage({ action: "SET_ENABLED", enabled: true });
    resetInFlight = false;
    resetConfirmBtn.disabled = false;
    resetCancelBtn.disabled = false;
    resetConfirm.hidden = true;
    resetBtn.hidden = false;
    resetDone.hidden = false;
    await loadState();
  }
  function wireEvents() {
    masterToggle.addEventListener("change", () => {
      void setEnabled(masterToggle.checked);
    });
    addHostForm.addEventListener("submit", (e) => {
      e.preventDefault();
      void addHost();
    });
    addHostInput.addEventListener("input", clearAddHostError);
    for (const btn of themeButtons) {
      btn.addEventListener("click", () => {
        const value = btn.dataset.themeValue;
        if (value !== "system" && value !== "light" && value !== "dark") return;
        renderTheme(value);
        void setTheme(value);
      });
    }
    resetBtn.addEventListener("click", () => {
      resetDone.hidden = true;
      resetBtn.hidden = true;
      resetConfirm.hidden = false;
    });
    resetCancelBtn.addEventListener("click", () => {
      resetConfirm.hidden = true;
      resetBtn.hidden = false;
    });
    resetConfirmBtn.addEventListener("click", () => {
      void performReset();
    });
    upgradeBtn.addEventListener("click", () => void emit("cta_click", { surface: "options_veil" }));
    headerGetPro.addEventListener("click", () => void emit("cta_click", { surface: "options_header" }));
  }
  async function init() {
    const initialTheme = await applyStoredTheme();
    watchThemeChanges(renderTheme);
    localizeHtml(document);
    renderTheme(initialTheme);
    upgradeBtn.href = upgradeUrl("options_veil");
    headerGetPro.href = upgradeUrl("options_header");
    aboutVersion.textContent = msg("optionsVersionLabel", [chrome.runtime.getManifest().version]);
    wireEvents();
    await loadState();
  }
  void init();
})();
//# sourceMappingURL=options.js.map
