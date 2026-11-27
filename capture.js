'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const form = $('captureForm');
  const urlField = $('articleUrl');
  const titleField = $('articleTitle');
  const categoryField = $('category');
  const tagsField = $('tags');
  const notesField = $('notes');
  const saveBtn = $('saveBtn');
  const reloadBtn = $('reloadBtn');
  let busy = false;
  let categories = [];

  const params = new URLSearchParams(location.search);
  const sharedUrl = (params.get('url') || '').trim();
  const sharedTitle = (params.get('title') || '').trim();
  if (sharedUrl) urlField.value = sharedUrl.slice(0, 3000);
  if (sharedTitle) titleField.value = sharedTitle.slice(0, 300);

  const config = window.MY_COLLECTION_CONFIG || {};
  const gas = String(config.gasWebAppUrl || '').replace(/\/$/, '');
  const fallbackUrl = gas && /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(gas)
    ? gas + '?mode=save' + (sharedUrl ? '&url=' + encodeURIComponent(sharedUrl) : '')
    : '';
  if (fallbackUrl) {
    $('gasFallback').href = fallbackUrl;
  } else {
    $('gasFallback').hidden = true;
  }

  function showStatus(message, error = false) {
    const status = $('status');
    status.hidden = false;
    status.textContent = message;
    status.className = 'status' + (error ? ' error' : '');
  }
  function clearStatus() { $('status').hidden = true; }
  function updateButtons() {
    saveBtn.disabled = busy || !urlField.value.trim() || !categoryField.value;
    reloadBtn.disabled = busy;
    categoryField.disabled = busy || !categories.length;
  }
  function setBusy(next) { busy = next; updateButtons(); }
  function updatePath() {
    const current = categories.find(c => String(c.id) === categoryField.value);
    $('path').hidden = !current;
    $('path').textContent = current ? '目前選擇：' + (current.path || current.name) : '';
    updateButtons();
  }
  function api(action, payload = {}) {
    if (!window.MyCollectionBridge) return Promise.reject(new Error('找不到連線程式，請確認 bridge-client.js 已上傳'));
    return window.MyCollectionBridge.call(action, payload);
  }
  async function loadCategories() {
    setBusy(true);
    showStatus('正在連接 GAS，讀取分類…');
    try {
      const result = await api('categories');
      if (!result || !result.ok || !Array.isArray(result.categories)) throw new Error('後端未回傳分類資料');
      categories = result.categories;
      const previousValue = categoryField.value;
      categoryField.replaceChildren();
      categoryField.add(new Option(categories.length ? '請選擇分類' : '尚無分類', ''));
      for (const category of categories) {
        categoryField.add(new Option(String(category.path || category.name || category.id), String(category.id)));
      }
      if (categories.some(c => String(c.id) === previousValue)) categoryField.value = previousValue;
      updatePath();
      if (categories.length) clearStatus();
      else showStatus('Google Sheets 目前沒有可選分類，請先回主網站新增分類。', true);
    } catch (err) {
      categories = [];
      categoryField.replaceChildren(new Option('分類載入失敗', ''));
      showStatus('無法讀取分類：' + (err.message || String(err)) + '。可點「重新載入分類」，或使用下方原本的 GAS 收藏頁。', true);
    } finally {
      setBusy(false);
    }
  }
  async function saveArticle(event) {
    event.preventDefault();
    if (busy) return;
    const url = urlField.value.trim();
    const title = titleField.value.trim();
    const categoryId = categoryField.value;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw Error();
    } catch (_) {
      showStatus('請輸入有效的 http 或 https 文章網址。', true);
      urlField.focus();
      return;
    }
    if (!categoryId) { showStatus('請先選擇分類。', true); categoryField.focus(); return; }
    setBusy(true);
    showStatus('正在儲存文章，請不要關閉這個頁面…');
    try {
      const result = await api('addArticle', {
        url, title, categoryId,
        tags: tagsField.value.trim(), notes: notesField.value.trim()
      });
      if (!result || !result.ok) throw new Error(result?.error || '後端未確認儲存結果');
      $('capturePanel').hidden = true;
      $('successPanel').hidden = false;
      $('successTitle').textContent = result.status === 'duplicate' ? '這個網址已收藏過' : '收藏成功！';
      $('savedTitle').textContent = result.title || title || url;
    } catch (err) {
      showStatus('儲存失敗：' + (err.message || String(err)) + '。請確認是否已儲存後再重試，以免重複收藏。', true);
    } finally { setBusy(false); }
  }
  $('anotherBtn').addEventListener('click', () => {
    $('capturePanel').hidden = false;
    $('successPanel').hidden = true;
    urlField.value = '';
    titleField.value = '';
    tagsField.value = '';
    notesField.value = '';
    urlField.focus();
  });
  urlField.addEventListener('input', updateButtons);
  categoryField.addEventListener('change', updatePath);
  reloadBtn.addEventListener('click', loadCategories);
  form.addEventListener('submit', saveArticle);
  if (!window.MyCollectionBridge?.configured) {
    showStatus('尚未設定有效的 GAS 網址。請檢查 config.js。', true);
  } else loadCategories();
})();
