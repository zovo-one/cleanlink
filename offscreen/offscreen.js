"use strict";
(() => {
  // src/shared/schema.ts
  var MAX_URL_LENGTH = 8192;
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

  // src/offscreen/offscreen.ts
  var clipEl = document.getElementById("clip");
  function copyToClipboard(text) {
    if (!clipEl) {
      return { ok: false, error: "offscreen textarea missing" };
    }
    try {
      clipEl.value = text;
      clipEl.focus();
      clipEl.select();
      clipEl.setSelectionRange(0, text.length);
      const copied = document.execCommand("copy");
      clipEl.value = "";
      return copied ? { ok: true } : { ok: false, error: "execCommand(copy) returned false" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "unknown clipboard error" };
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isValidMsg(message) || message.action !== "COPY_CLEAN") return false;
    sendResponse(copyToClipboard(message.url));
    return false;
  });
})();
//# sourceMappingURL=offscreen.js.map
