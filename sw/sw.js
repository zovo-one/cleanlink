"use strict";
(() => {
  // src/core/params.ts
  var CORE_TRACKING_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "msclkid",
    "dclid",
    "yclid",
    "twclid",
    "ttclid",
    "igshid",
    "mc_eid",
    "mc_cid",
    "mkt_tok",
    "_hsenc",
    "_hsmi",
    "hsCtaTracking",
    "vero_id",
    "vero_conv",
    "oly_anon_id",
    "oly_enc_id",
    "wickedid",
    "_openstat",
    "ml_subscriber",
    "ml_subscriber_hash",
    "ref",
    "ref_src"
  ];
  var EXTENDED_TRACKING_PARAMS = [
    // Google/paid-ads extended (auto-tagging + ValueTrack, non-generic names only)
    "utm_id",
    "utm_source_platform",
    "utm_creative_format",
    "utm_marketing_tactic",
    "utm_reader",
    "utm_name",
    "utm_cid",
    "utm_referrer",
    "gclsrc",
    "gbraid",
    "wbraid",
    "srsltid",
    "gad_source",
    "gad_campaignid",
    "campaignid",
    "adgroupid",
    "creativeid",
    "targetid",
    "matchtype",
    "adposition",
    "loc_interest_ms",
    "loc_physical_ms",
    // Affiliate networks (Impact, CJ, Awin, Rakuten, Matomo/Piwik pk_*, ShareASale, generic)
    "irclickid",
    "irgwc",
    "awc",
    "cjevent",
    "cjdata",
    "sscid",
    "zanpid",
    "rvo_aff",
    "rvo_subid",
    "pk_campaign",
    "pk_kwd",
    "pk_source",
    "pk_medium",
    "pk_content",
    "pk_cid",
    "affId",
    "aff_id",
    "affid",
    "aff_sub",
    "aff_sub2",
    "aff_sub3",
    "aff_sub4",
    "aff_sub5",
    "affiliate_id",
    "partner_id",
    "partnerid",
    "tap_a",
    "tap_s",
    // Generic (but distinctively named) click ids
    "subid",
    "clickid",
    "click_id",
    // Email / marketing automation (Eloqua, Salesforce Marketing Cloud, HubSpot ads,
    // Klaviyo, Adobe Experience Cloud)
    "elqTrackId",
    "elqaid",
    "elqat",
    "elqCampaignId",
    "sfmc_id",
    "sfmc_activityid",
    "trk_contact",
    "trk_msg",
    "trk_module",
    "trk_sid",
    "hsa_acc",
    "hsa_ad",
    "hsa_cam",
    "hsa_grp",
    "hsa_kw",
    "hsa_mt",
    "hsa_net",
    "hsa_src",
    "hsa_tgt",
    "hsa_ver",
    "_kx",
    "adobe_mc",
    "s_cid",
    "ef_id",
    "cm_mmc",
    "cmpid",
    "icid",
    // eBay
    "mkevt",
    "mkcid",
    "mkrid",
    "campid",
    "toolid",
    "customid",
    // Amazon (associates tag + on-site recommendation/ref params)
    "tag",
    "ascsubtag",
    "linkCode",
    "linkId",
    "ref_",
    "pd_rd_r",
    "pd_rd_w",
    "pd_rd_wg",
    "pf_rd_p",
    "pf_rd_r",
    "pf_rd_s",
    "pf_rd_t",
    "pf_rd_i",
    "pf_rd_m",
    "cxrecs_s",
    // AliExpress / Alibaba
    "spm",
    "scm",
    "algo_expid",
    "algo_pvid",
    "btsid",
    "ws_ab_test",
    // Social share trackers
    "epik",
    "si",
    "soc_src",
    "soc_trk",
    "rdt_cid",
    "sc_cid",
    "igsh",
    // Native ad networks
    "tblci",
    "obOrigUrl",
    "dicbo",
    "ncid",
    "taid",
    // Consent-wall / redirect trackers (Yahoo/Verizon Media "guce")
    "guccounter",
    "guce_referrer",
    "guce_referrer_sig",
    // Misc web analytics
    "wt_zmc",
    "wtrid"
  ];
  var TRACKING_FRAGMENTS = [
    /^#_ga=.*/i,
    /^#_gl=.*/i
  ];

  // src/core/clean.ts
  var DEFAULT_OPTIONS = { extended: false };
  function cleanUrl(raw, opts = DEFAULT_OPTIONS) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return raw;
    }
    const paramsToStrip = opts.extended ? [...CORE_TRACKING_PARAMS, ...EXTENDED_TRACKING_PARAMS] : CORE_TRACKING_PARAMS;
    const stripSet = new Set(paramsToStrip.map((p) => p.toLowerCase()));
    const keysToDelete = [];
    for (const key of url.searchParams.keys()) {
      if (stripSet.has(key.toLowerCase()) && !keysToDelete.includes(key)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      url.searchParams.delete(key);
    }
    if (url.hash) {
      for (const pattern of TRACKING_FRAGMENTS) {
        if (pattern.test(url.hash)) {
          url.hash = "";
          break;
        }
      }
    }
    return url.toString();
  }
  function paramCountForTier(extended) {
    return extended ? CORE_TRACKING_PARAMS.length + EXTENDED_TRACKING_PARAMS.length : CORE_TRACKING_PARAMS.length;
  }

  // src/core/rules.ts
  var CORE_RULESET_ID = "core";
  var EXTENDED_RULESET_ID = "extended";
  var ALLOW_PRIORITY = 2;
  var ALLOW_RULE_ID_MIN = 1e3;
  var ALLOW_RULE_ID_MAX = 65535;
  var ALLOW_RULE_ID_RANGE = ALLOW_RULE_ID_MAX - ALLOW_RULE_ID_MIN + 1;
  function allowRuleId(host) {
    let hash = 2166136261;
    for (let i = 0; i < host.length; i++) {
      hash ^= host.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return ALLOW_RULE_ID_MIN + hash % ALLOW_RULE_ID_RANGE;
  }

  // src/shared/i18n.ts
  function msg(key, substitutions) {
    try {
      return chrome.i18n.getMessage(key, substitutions) || "";
    } catch {
      return "";
    }
  }

  // src/shared/schema.ts
  var MAX_ALLOWLIST_HOSTS = 500;
  var MAX_URL_LENGTH = 8192;
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
  function isValidSettings(x) {
    if (typeof x !== "object" || x === null) return false;
    const s = x;
    if (typeof s.enabled !== "boolean") return false;
    if (!Array.isArray(s.allowlist)) return false;
    if (s.allowlist.length > MAX_ALLOWLIST_HOSTS) return false;
    return s.allowlist.every((h) => typeof h === "string" && sanitizeHost(h) === h);
  }
  function sanitizeSettings(x, fallback) {
    if (typeof x !== "object" || x === null) return fallback;
    const s = x;
    const enabled = typeof s.enabled === "boolean" ? s.enabled : fallback.enabled;
    const rawList = Array.isArray(s.allowlist) ? s.allowlist : fallback.allowlist;
    const allowlist = [
      ...new Set(rawList.map((h) => sanitizeHost(h)).filter((h) => h !== null))
    ].slice(0, MAX_ALLOWLIST_HOSTS);
    return { enabled, allowlist };
  }
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function isValidUsage(x) {
    if (typeof x !== "object" || x === null) return false;
    const u = x;
    return typeof u.copyCount === "number" && Number.isFinite(u.copyCount) && u.copyCount >= 0 && Number.isInteger(u.copyCount) && typeof u.copyCountDate === "string" && (u.copyCountDate === "" || DATE_RE.test(u.copyCountDate));
  }
  var VALID_TIERS = ["free", "pro"];
  function isValidTier(x) {
    return typeof x === "string" && VALID_TIERS.includes(x);
  }
  function isValidLicenseState(x) {
    if (typeof x !== "object" || x === null) return false;
    const s = x;
    if (!isValidTier(s.tier)) return false;
    if (typeof s.verifiedAt !== "number" || !Number.isFinite(s.verifiedAt) || s.verifiedAt < 0) return false;
    return true;
  }
  function isValidLicenseResponse(x) {
    if (typeof x !== "object" || x === null) return false;
    const r = x;
    if (typeof r.valid !== "boolean") return false;
    if (r.valid) {
      if (typeof r.tier !== "string" || r.tier.length === 0) return false;
      if (r.expiresAt !== void 0 && r.expiresAt !== null && typeof r.expiresAt !== "number") return false;
    }
    return true;
  }
  function isValidMsg(x) {
    if (typeof x !== "object" || x === null) return false;
    const m = x;
    switch (m.action) {
      case "GET_STATE":
        return true;
      case "SET_ENABLED":
        return typeof m.enabled === "boolean";
      case "SET_ALLOW":
        return typeof m.host === "string" && m.host.length > 0 && m.host.length <= 253 && typeof m.on === "boolean";
      case "COPY_CLEAN":
        return typeof m.url === "string" && m.url.length > 0 && m.url.length <= MAX_URL_LENGTH;
      default:
        return false;
    }
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
  var DEFAULT_SETTINGS = { enabled: true, allowlist: [] };
  var DEFAULT_USAGE = { copyCount: 0, copyCountDate: "" };
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
  async function getSettings() {
    const [syncRaw, localRaw] = await Promise.all([
      safeGet(chrome.storage.sync, STORAGE_KEYS.settings),
      safeGet(chrome.storage.local, STORAGE_KEYS.settings)
    ]);
    if (isValidSettings(syncRaw)) return sanitizeSettings(syncRaw, DEFAULT_SETTINGS);
    if (isValidSettings(localRaw)) return sanitizeSettings(localRaw, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  async function setSettings(settings) {
    const clean = sanitizeSettings(settings, DEFAULT_SETTINGS);
    const wroteSync = await safeSet(chrome.storage.sync, STORAGE_KEYS.settings, clean);
    if (wroteSync) return true;
    return safeSet(chrome.storage.local, STORAGE_KEYS.settings, clean);
  }
  async function getUsage() {
    const raw = await safeGet(chrome.storage.local, STORAGE_KEYS.usage);
    return isValidUsage(raw) ? raw : DEFAULT_USAGE;
  }
  async function setUsage(usage) {
    if (!isValidUsage(usage)) {
      console.error("[storage] setUsage() rejected invalid shape", usage);
      return false;
    }
    return safeSet(chrome.storage.local, STORAGE_KEYS.usage, usage);
  }
  async function getLicenseCache() {
    const raw = await safeGet(chrome.storage.local, STORAGE_KEYS.license);
    return isValidLicenseState(raw) ? raw : null;
  }
  async function setLicenseCache(state) {
    if (!isValidLicenseState(state)) {
      console.error("[storage] setLicenseCache() rejected invalid shape", state);
      return false;
    }
    return safeSet(chrome.storage.local, STORAGE_KEYS.license, state);
  }
  async function getOrCreateInstallId() {
    const existing = await safeGet(chrome.storage.local, STORAGE_KEYS.installId);
    if (typeof existing === "string" && existing.length > 0) return existing;
    const id = crypto.randomUUID();
    await safeSet(chrome.storage.local, STORAGE_KEYS.installId, id);
    return id;
  }
  async function hasFirstValue() {
    const raw = await safeGet(chrome.storage.local, STORAGE_KEYS.firstValueAt);
    return typeof raw === "number" && raw > 0;
  }
  async function markFirstValue() {
    const already = await hasFirstValue();
    if (already) return false;
    await safeSet(chrome.storage.local, STORAGE_KEYS.firstValueAt, Date.now());
    return true;
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
  async function markFirstValueOnce(feature) {
    const first = await markFirstValue();
    if (first) void emit("first_value", { feature });
  }

  // src/shared/license.ts
  var FREE_LIMITS = {
    copyCleanPerDay: 15,
    allowlistSites: 1
  };
  var API_BASE = "https://zgubxqomnbmxgbdhvwja.supabase.co/functions/v1";
  var VERIFY_PATH = "/verify-extension-license";
  var SUPABASE_ANON_KEY = "sb_publishable_RG4IVO9Qm23_xPzdQjdFPQ_QHBwbOLv";
  var LICENSE_KEY_STORAGE = "zovo_cleanlink_license_key";
  var EXTENSION_KEY = "cleanlink";
  var CACHE_TTL_MS = 30 * 60 * 1e3;
  var OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1e3;
  var REQUEST_TIMEOUT_MS = 1e4;
  var DEFAULT_STATE = { tier: "free", verifiedAt: 0 };
  async function readCache() {
    const cached = await getLicenseCache();
    return cached ?? DEFAULT_STATE;
  }
  async function writeCache(state) {
    const wrote = await setLicenseCache(state);
    if (!wrote) console.error("[cleanlink] license writeCache: setLicenseCache rejected state", state);
  }
  async function verifyRemote() {
    if (!API_BASE.startsWith("https://")) return null;
    let licenseKey;
    try {
      const got = await chrome.storage.local.get(LICENSE_KEY_STORAGE);
      const v = got?.[LICENSE_KEY_STORAGE];
      if (typeof v === "string" && v.trim().length > 0) licenseKey = v.trim();
    } catch {
    }
    if (!licenseKey) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(API_BASE + VERIFY_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ license_key: licenseKey, extension: EXTENSION_KEY }),
        signal: controller.signal
      });
      let data;
      try {
        data = await response.json();
      } catch {
        void emit("verify_failed", { extKey: EXTENSION_KEY, reason: "bad-json" });
        return null;
      }
      if (!isValidLicenseResponse(data)) {
        console.warn("[cleanlink] license verify: unexpected response shape");
        void emit("verify_failed", { extKey: EXTENSION_KEY, reason: "bad-schema" });
        return null;
      }
      const tier = data.valid && data.tier !== "free" ? "pro" : "free";
      if (tier === "pro") void emit("key_verified", { extKey: EXTENSION_KEY, tier });
      return { tier, verifiedAt: Date.now() };
    } catch (err) {
      console.warn("[cleanlink] license verify unreachable/timeout", err);
      const reason = err instanceof DOMException && err.name === "AbortError" ? "timeout" : "network";
      void emit("verify_failed", { extKey: EXTENSION_KEY, reason });
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  async function refresh() {
    const cached = await readCache();
    const remote = await verifyRemote();
    if (remote) {
      await writeCache(remote);
      return remote;
    }
    const withinGrace = cached.verifiedAt > 0 && Date.now() - cached.verifiedAt <= OFFLINE_GRACE_MS;
    if (withinGrace) return cached;
    const fallback = { tier: "free", verifiedAt: cached.verifiedAt };
    await writeCache(fallback);
    return fallback;
  }
  async function getTier() {
    const cached = await readCache();
    const isFresh = cached.verifiedAt > 0 && Date.now() - cached.verifiedAt <= CACHE_TTL_MS;
    if (isFresh) return cached.tier;
    const state = await refresh();
    return state.tier;
  }
  var licenseManager = { getTier, refresh };

  // src/sw/sw.ts
  var COPY_MENU_ID = "copyClean";
  var BADGE_FLASH_MS = 2e3;
  var OFFSCREEN_URL = "offscreen/offscreen.html";
  var ONBOARDING_URL = "pages/onboarding/onboarding.html";
  var BADGE_COLOR_OK = "#10B981";
  var BADGE_COLOR_ERROR = "#EF4444";
  var BADGE_COLOR_CAP = "#F59E0B";
  async function resolveActiveTabUrl() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const raw = tabs[0]?.url;
      if (!raw) return null;
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }
  async function resolveActiveHost() {
    const url = await resolveActiveTabUrl();
    if (!url) return null;
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  function todayLocalDate() {
    const now = /* @__PURE__ */ new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  async function getTodayUsage() {
    const usage = await getUsage();
    const today = todayLocalDate();
    if (usage.copyCountDate !== today) {
      return { copyCount: 0, copyCountDate: today };
    }
    return usage;
  }
  async function incrementCopyCount(current) {
    await setUsage({ copyCount: current.copyCount + 1, copyCountDate: current.copyCountDate });
  }
  var badgeClearTimer;
  async function flashBadge(text, color) {
    try {
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({ color });
    } catch (err) {
      console.error("[cleanlink] flashBadge failed", err);
      return;
    }
    if (badgeClearTimer !== void 0) clearTimeout(badgeClearTimer);
    badgeClearTimer = setTimeout(() => {
      chrome.action.setBadgeText({ text: "" }).catch((err) => {
        console.error("[cleanlink] badge clear failed", err);
      });
    }, BADGE_FLASH_MS);
  }
  function desiredRulesetIds(settings, tier) {
    if (!settings.enabled) return [];
    return tier === "pro" ? [CORE_RULESET_ID, EXTENDED_RULESET_ID] : [CORE_RULESET_ID];
  }
  async function reconcileRulesets(settings, tier) {
    const desired = new Set(desiredRulesetIds(settings, tier));
    let current;
    try {
      current = await chrome.declarativeNetRequest.getEnabledRulesets();
    } catch (err) {
      console.error("[cleanlink] getEnabledRulesets failed", err);
      return;
    }
    const currentSet = new Set(current);
    const enableRulesetIds = [...desired].filter((id) => !currentSet.has(id));
    const disableRulesetIds = [CORE_RULESET_ID, EXTENDED_RULESET_ID].filter(
      (id) => currentSet.has(id) && !desired.has(id)
    );
    if (enableRulesetIds.length === 0 && disableRulesetIds.length === 0) return;
    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds, disableRulesetIds });
    } catch (err) {
      console.error("[cleanlink] updateEnabledRulesets failed", err);
    }
  }
  function buildAllowRule(host) {
    return {
      id: allowRuleId(host),
      priority: ALLOW_PRIORITY,
      action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
      condition: {
        requestDomains: [host],
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
      }
    };
  }
  async function reconcileAllowRules(settings) {
    const desiredRules = settings.allowlist.map(buildAllowRule);
    const desiredIds = new Set(desiredRules.map((r) => r.id));
    let currentRules;
    try {
      currentRules = await chrome.declarativeNetRequest.getDynamicRules();
    } catch (err) {
      console.error("[cleanlink] getDynamicRules failed", err);
      return;
    }
    const currentIds = new Set(currentRules.map((r) => r.id));
    const removeRuleIds = currentRules.filter((r) => r.id >= ALLOW_RULE_ID_MIN && r.id <= ALLOW_RULE_ID_MAX && !desiredIds.has(r.id)).map((r) => r.id);
    const addRules = desiredRules.filter((r) => !currentIds.has(r.id));
    if (removeRuleIds.length === 0 && addRules.length === 0) return;
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
    } catch (err) {
      console.error("[cleanlink] updateDynamicRules failed", err);
    }
  }
  async function reconcile() {
    const [settings, tier] = await Promise.all([getSettings(), licenseManager.getTier()]);
    await Promise.all([reconcileRulesets(settings, tier), reconcileAllowRules(settings)]);
  }
  function removeAllContextMenus() {
    return new Promise((resolve) => {
      try {
        chrome.contextMenus.removeAll(() => resolve());
      } catch (err) {
        console.error("[cleanlink] contextMenus.removeAll failed", err);
        resolve();
      }
    });
  }
  async function ensureContextMenu() {
    await removeAllContextMenus();
    try {
      chrome.contextMenus.create({
        id: COPY_MENU_ID,
        title: msg("menuCopyClean") || "Copy clean link",
        contexts: ["link"]
      });
    } catch (err) {
      console.error("[cleanlink] contextMenus.create failed", err);
    }
  }
  async function ensureOffscreenDocument() {
    const has = await chrome.offscreen.hasDocument();
    if (has) return;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: "Write the cleaned link to the clipboard from the service worker."
    });
  }
  async function copyViaOffscreen(text) {
    try {
      await ensureOffscreenDocument();
      const request = { action: "COPY_CLEAN", url: text };
      const ack = await chrome.runtime.sendMessage(request);
      return Boolean(ack?.ok);
    } catch (err) {
      console.error("[cleanlink] copyViaOffscreen failed", err);
      return false;
    } finally {
      try {
        await chrome.offscreen.closeDocument();
      } catch {
      }
    }
  }
  async function handleCopyClean(linkUrl) {
    try {
      const tier = await licenseManager.getTier();
      const usage = await getTodayUsage();
      const capped = tier === "free" && usage.copyCount >= FREE_LIMITS.copyCleanPerDay;
      if (capped) {
        await flashBadge("MAX", BADGE_COLOR_CAP);
        void emit("cap_hit", { feature: "copy_clean", cap: FREE_LIMITS.copyCleanPerDay, surface: "context_menu" });
        return;
      }
      const cleaned = cleanUrl(linkUrl, { extended: tier === "pro" });
      const copied = await copyViaOffscreen(cleaned);
      if (!copied) {
        await flashBadge("!", BADGE_COLOR_ERROR);
        return;
      }
      await incrementCopyCount(usage);
      await flashBadge("\u2713", BADGE_COLOR_OK);
      void markFirstValueOnce("copy_clean");
      void emit("feature_used", { feature: "copy_clean", count: usage.copyCount + 1 });
    } catch (err) {
      console.error("[cleanlink] handleCopyClean failed", err);
    }
  }
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== COPY_MENU_ID) return;
    const linkUrl = info.linkUrl;
    if (!linkUrl) return;
    void handleCopyClean(linkUrl);
  });
  async function buildStateReply() {
    const [settings, tier, usage, activeHost] = await Promise.all([
      getSettings(),
      licenseManager.getTier(),
      getTodayUsage(),
      resolveActiveHost()
    ]);
    const isPro = tier === "pro";
    return {
      enabled: settings.enabled,
      allowHosts: settings.allowlist,
      paramCount: paramCountForTier(isPro),
      activeHost,
      tier,
      copyCount: usage.copyCount,
      copyCap: isPro ? Number.POSITIVE_INFINITY : FREE_LIMITS.copyCleanPerDay,
      allowlistCap: isPro ? Number.POSITIVE_INFINITY : FREE_LIMITS.allowlistSites
    };
  }
  async function handleGetState() {
    await reconcile();
    return buildStateReply();
  }
  async function handleSetEnabled(enabled) {
    const settings = await getSettings();
    const ok = await setSettings({ ...settings, enabled });
    if (!ok) return { ok: false, error: "failed to persist settings" };
    await reconcile();
    return { ok: true };
  }
  async function handleSetAllow(hostInput, on) {
    const host = sanitizeHost(hostInput);
    if (!host) return { ok: false, error: "invalid host" };
    const [settings, tier] = await Promise.all([getSettings(), licenseManager.getTier()]);
    const already = settings.allowlist.includes(host);
    let nextAllowlist;
    let added = false;
    if (on) {
      if (already) {
        nextAllowlist = settings.allowlist;
      } else {
        const cap = tier === "pro" ? MAX_ALLOWLIST_HOSTS : FREE_LIMITS.allowlistSites;
        if (settings.allowlist.length >= cap) {
          if (tier === "free") void emit("cap_hit", { feature: "allowlist", cap, surface: "allowlist" });
          return { ok: false, error: "allowlist cap reached" };
        }
        nextAllowlist = [...settings.allowlist, host];
        added = true;
      }
    } else {
      nextAllowlist = settings.allowlist.filter((h) => h !== host);
    }
    const ok = await setSettings({ ...settings, allowlist: nextAllowlist });
    if (!ok) return { ok: false, error: "failed to persist settings" };
    await reconcile();
    if (added) void emit("feature_used", { feature: "allowlist_add", count: nextAllowlist.length });
    return { ok: true };
  }
  function handleMessage(message, _sender, sendResponse) {
    if (!isValidMsg(message)) return false;
    switch (message.action) {
      case "GET_STATE":
        void handleGetState().then(sendResponse);
        return true;
      case "SET_ENABLED":
        void handleSetEnabled(message.enabled).then(sendResponse);
        return true;
      case "SET_ALLOW":
        void handleSetAllow(message.host, message.on).then(sendResponse);
        return true;
      case "COPY_CLEAN":
        return false;
      default:
        return false;
    }
  }
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.runtime.onMessage.addListener((message) => {
    if (typeof message === "object" && message !== null && message.type === "ZOVO_CONV") {
      const cta = message.cta;
      void emit("cta_click", { surface: typeof cta === "string" ? cta : "sidebar" });
    }
    return false;
  });
  async function openOnboarding() {
    try {
      const sourceUrl = await resolveActiveTabUrl();
      const base = chrome.runtime.getURL(ONBOARDING_URL);
      const url = sourceUrl ? `${base}?src=${encodeURIComponent(sourceUrl)}` : base;
      await chrome.tabs.create({ url });
    } catch (err) {
      console.error("[cleanlink] openOnboarding failed", err);
    }
  }
  chrome.runtime.onInstalled.addListener((details) => {
    void (async () => {
      if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        await setSettings(DEFAULT_SETTINGS);
        void emit("install", {});
      }
      await ensureContextMenu();
      await reconcile();
      if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        await openOnboarding();
      }
    })();
  });
  chrome.runtime.onStartup.addListener(() => {
    void (async () => {
      await ensureContextMenu();
      await reconcile();
    })();
  });
})();
//# sourceMappingURL=sw.js.map
