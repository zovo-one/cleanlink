/* zovo-sidebar.js — reveals Pro card always; Rate card after N opens; live tier hides Pro if already Pro. */
(function(){
  const SESSIONS_BEFORE_RATE = 3;
  async function get(k){ try{ return (await chrome.storage.local.get(k))[k]; }catch{ return undefined; } }
  async function set(o){ try{ await chrome.storage.local.set(o); }catch{} }
  async function init(){
    const proCard = document.querySelector('[data-zs="pro"]');
    const rateCard = document.querySelector('[data-zs="rate"]');
    // tier: hide Pro card if already Pro
    const lic = await get('zovo_license');
    const isPro = lic && lic.tier === 'pro';
    if (proCard) proCard.hidden = isPro;
    // rate gating: count option-page opens
    let n = (await get('zovo_options_opens')) || 0; n++; await set({zovo_options_opens:n});
    const rated = await get('zovo_rated');
    if (rateCard) rateCard.hidden = !(n >= SESSIONS_BEFORE_RATE && !rated);
    document.querySelectorAll('[data-zs-cta]').forEach(a=>a.addEventListener('click',e=>{
      const kind = a.getAttribute('data-zs-cta');
      if (kind === 'rate') set({zovo_rated:true});
      try{ chrome.runtime.sendMessage({type:'ZOVO_CONV', cta:kind}); }catch{}
    }));
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
