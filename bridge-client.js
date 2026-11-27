/*
  GitHub Pages <-> Google Apps Script HTML bridge.
  NOTE: This is a transport solution, NOT a security or authentication solution.
*/
(function () {
  'use strict';
  const config = window.MY_COLLECTION_CONFIG || {};
  const endpoint = String(config.gasWebAppUrl || '').trim();
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\/?$/.test(endpoint);
  const bridgeId = (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID() : 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const calls = new Map();
  let frameSource = null;
  let frameOrigin = null;
  let ready = false;
  let iframe = null;
  let sequence = 0;
  const allowed = new Set([
    'ping','snapshot','categories','addArticle','updateArticle','deleteArticle',
    'createCategory','updateCategory','deleteCategory','mergeCategory',
    'reorderCategory','importData','setPinned','batchArticles','repairData'
  ]);
  const waiting = [];
  function send(msg) { if (ready && frameSource) frameSource.postMessage(msg, frameOrigin); }
  window.addEventListener('message', event => {
    if (!configured) return;
    const data = event.data;
    if (!data || data.protocol !== 'my-collection-bridge-v1' || data.bridgeId !== bridgeId) return;
    if (data.type === 'ready') {
      // The bridge can live in a nested Google-hosted HTML Service iframe;
      // the received source may therefore differ from iframe.contentWindow.
      // The unpredictable bridgeId is supplied only to the intended iframe URL.
      if (ready) return;
      if (!/^https:\/\/(?:[^/]+\.)?(?:googleusercontent\.com|google\.com)$/.test(event.origin)) return;
      frameSource = event.source;
      frameOrigin = event.origin;
      ready = true;
      while (waiting.length) send(waiting.shift());
      return;
    }
    if (!ready || event.source !== frameSource || event.origin !== frameOrigin || data.type !== 'result') return;
    const call = calls.get(data.id);
    if (!call) return;
    calls.delete(data.id);
    clearTimeout(call.timeout);
    if (data.ok) call.resolve(data.response);
    else call.reject(new Error(data.error || '後端執行失敗'));
  });
  if (configured) {
    iframe = document.createElement('iframe');
    iframe.title = 'My Collection 資料連線';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex','-1');
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-10000px;top:0;';
    iframe.src = endpoint + '?mode=bridge&bridgeId=' + encodeURIComponent(bridgeId);
    document.body.appendChild(iframe);
  }
  window.MyCollectionBridge = {
    configured,
    call(action, payload = {}) {
      if (!configured) return Promise.reject(new Error('尚未在 config.js 設定有效的 GAS /exec 網址'));
      if (!allowed.has(action)) return Promise.reject(new Error('不支援的操作：' + action));
      return new Promise((resolve, reject) => {
        const id = String(++sequence);
        const timeout = setTimeout(() => {
          calls.delete(id);
          reject(new Error('GAS 連線逾時：請確認新版 GAS 已部署、可匿名開啟 bridge 頁，以及瀏覽器沒有阻擋內嵌頁面'));
        }, 35000);
        calls.set(id, {resolve, reject, timeout});
        const msg = {protocol:'my-collection-bridge-v1',bridgeId,type:'call',id,action,payload};
        if (ready) send(msg); else waiting.push(msg);
      });
    }
  };
})();
