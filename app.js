
'use strict';
const $=s=>document.querySelector(s),escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const hostOf=s=>{try{return new URL(s).hostname.replace(/^www\./,'')}catch{return '收藏網址'}};
let db={categories:[],articles:[]},selected=null,expanded=new Set(),search='',view='grid',editArticleId=null,editCategoryId=null,detailId=null,busy=false;
let filters={category:'',source:'',tag:'',start:'',end:'',onlyPinned:false};
let batchMode=false, selectedArticleIds=new Set(), exploreMode=false, exploreIds=[],dataHealth=null;
const SORT_KEY='my-collection-sort-v2';
function readSort(){try{return localStorage.getItem(SORT_KEY)||'newest'}catch(_){return 'newest'}}
function saveSort(s){try{localStorage.setItem(SORT_KEY,s)}catch(_){}}
let currentSort=readSort(), randomSeed=Math.random();

const FAVORITES_KEY='my-collection-favorite-categories-v1';
function readFavorites(){try{return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'))}catch{return new Set()}}
let favoriteCategories=readFavorites();
function saveFavorites(){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...favoriteCategories]))}catch(e){toast('此瀏覽器無法記住常用分類')}}
function toggleFavorite(id){if(favoriteCategories.has(id))favoriteCategories.delete(id);else favoriteCategories.add(id);saveFavorites();renderTree()}

function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500)}
function api(action,payload={}){return window.MyCollectionBridge.call(action,payload);}
async function load(){const result=await api('snapshot');db.categories=result.categories.map(c=>({id:String(c.id),name:String(c.name),parent:String(c.parentId||'')||null,order:Number(c.sortOrder)||0}));db.articles=result.articles.map(a=>({id:String(a.id),url:String(a.url),title:String(a.title||''),description:String(a.description||''),image:String(a.imageUrl||''),category:String(a.categoryId||'')||null,tags:String(a.tags||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean),notes:String(a.notes||''),createdAt:String(a.createdAt||''),updatedAt:String(a.updatedAt||''),pinned:String(a.pinned||'').toUpperCase()==='TRUE'||String(a.pinned||'')==='1'}));dataHealth=result.health||null;refreshFilterOptions();options($('#batchCategory'),true);render();renderHealth();}
async function mutation(action,payload,message){if(busy)return;busy=true;try{const r=await api(action,payload);await load();if(message)toast(message);return r;}catch(e){toast('操作失敗：'+e.message);throw e;}finally{busy=false}}
function getCat(id){return db.categories.find(c=>c.id===id)}
function children(p){return db.categories.filter(c=>c.parent===(p||null)).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'zh-Hant'))}
function descendants(id){const ids=new Set([id]);let changed=true;while(changed){changed=false;db.categories.forEach(c=>{if(ids.has(c.parent)&&!ids.has(c.id)){ids.add(c.id);changed=true}})}return ids}
function lineage(id){let out=[],node=getCat(id);while(node&&out.length<100){out.unshift(node);node=getCat(node.parent)}return out}
function pathText(id){return id?lineage(id).map(c=>c.name).join(' / '):'未分類'}
const CATEGORY_ICONS={all:'📚',uncategorized:'🗂️',tech:'💻',ai:'🤖',ai_creative:'🎨',ai_prompt:'✍️',ai_tools:'🧰',trend:'📈',web:'🌐',tech_apps:'🧩',travel:'✈️',asia:'🌏',asia_thailand:'🇹🇭',asia_chiangmai:'🏞️',asia_korea:'🇰🇷',japan:'🇯🇵',japan_tokyo:'🗼',japan_okinawa:'🌺',japan_fukuoka:'🍜',bali:'🏝️',europe:'🏛️',europe_france:'🥐',europe_austria:'🎼',europe_italy:'🍋',europe_spain:'💃',europe_balkans:'🧭',europe_czech:'🏰',europe_uk:'🎡',europe_other:'🧳',taiwan:'🇹🇼',tw_taipei:'🌃',tw_kaohsiung:'🌊',design:'🎨',business:'📣',career:'💼',career_abroad:'🌍',career_jobs:'🧑‍💼',career_teaching:'🧑‍🏫',productivity:'📚',life:'🌿',life_beauty:'💄',life_relationship:'💕',life_money:'💰',life_home:'🏠',life_health:'🩺',life_food:'🍽️',history:'🏛️',history_taiwan:'📜',history_world:'🌍',learning:'🎓',learning_lang:'🗣️',learning_course:'📘',learning_research:'🔬',leisure:'🎭',leisure_events:'🎫',leisure_media:'🎬',to_review:'🗂️'};
function categoryIcon(id){if(!id)return CATEGORY_ICONS.uncategorized;const chain=lineage(id);for(let i=chain.length-1;i>=0;i--){const icon=CATEGORY_ICONS[chain[i].id];if(icon)return icon}return CATEGORY_ICONS.uncategorized}
function options(select,allowEmpty,exclude){const block=exclude?descendants(exclude):new Set(),list=[];function walk(p,depth){children(p).forEach(c=>{if(block.has(c.id))return;list.push({id:c.id,name:'　'.repeat(depth)+c.name});walk(c.id,depth+1)})}walk(null,0);select.innerHTML=(allowEmpty?'<option value="">'+(select.id==='categoryParent'?'無（主分類）':'請選擇分類')+'</option>':'')+list.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}
function selectCategory(id){selected=id;$('#allArticles').classList.toggle('active',!id);render();$('#sidebar').classList.remove('open');$('#sidebarBackdrop').classList.remove('open')}
function categoryCount(id){const ids=descendants(id);return db.articles.filter(a=>ids.has(a.category)).length}
function renderFavorites(){
 const section=$('#favoriteSection'),list=$('#favoriteCategoryList');
 favoriteCategories=new Set([...favoriteCategories].filter(id=>!!getCat(id)));
 const cats=[...favoriteCategories].map(getCat).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
 section.hidden=!cats.length;
 list.innerHTML=cats.map(c=>`<div class="fav-row${selected===c.id?' active':''}"><button type="button" class="fav-link" data-fav-link="${escapeHtml(c.id)}"><span aria-hidden="true">${categoryIcon(c.id)}</span><span class="fav-name">${escapeHtml(c.name)}</span><span class="cat-count">${categoryCount(c.id)}</span></button><button class="fav-remove" type="button" title="移除常用分類" aria-label="移除常用分類：${escapeHtml(c.name)}" data-fav-remove="${escapeHtml(c.id)}">★</button></div>`).join('');
 list.querySelectorAll('[data-fav-link]').forEach(b=>b.onclick=()=>selectCategory(b.dataset.favLink));
 list.querySelectorAll('[data-fav-remove]').forEach(b=>b.onclick=()=>toggleFavorite(b.dataset.favRemove));
}
function renderTree(){
 const holder=$('#categoryTree');holder.innerHTML='';
 function add(p,depth){children(p).forEach(c=>{
  const kids=children(c.id).length,row=document.createElement('div');
  row.className='cat-row'+(selected===c.id?' selected':'');row.style.paddingLeft=(depth*11+3)+'px';row.draggable=true;
  const isFav=favoriteCategories.has(c.id);
  row.innerHTML=`<button type="button" class="cat-caret${kids?'':' is-empty'}" aria-label="${kids?'展開或收合':'無子分類'}">${kids?(expanded.has(c.id)?'⌄':'›'):''}</button><span class="cat-icon" aria-hidden="true">${categoryIcon(c.id)}</span><span class="cat-name" title="${escapeHtml(pathText(c.id))}">${escapeHtml(c.name)}</span><span class="cat-count" title="包含子分類的收藏數量">${categoryCount(c.id)}</span><button type="button" class="cat-star${isFav?' on':''}" aria-label="${isFav?'取消':'加入'}常用分類：${escapeHtml(c.name)}" title="${isFav?'取消常用':'加入常用'}">${isFav?'★':'☆'}</button><button type="button" class="cat-more" title="管理分類" aria-label="管理分類">⋯</button>`;
  row.querySelector('.cat-caret').onclick=()=>{if(!kids)return;if(expanded.has(c.id))expanded.delete(c.id);else expanded.add(c.id);renderTree()};
  row.querySelector('.cat-icon').onclick=row.querySelector('.cat-name').onclick=()=>selectCategory(c.id);
  row.querySelector('.cat-star').onclick=e=>{e.stopPropagation();toggleFavorite(c.id)};
  row.querySelector('.cat-more').onclick=e=>{e.stopPropagation();categoryMenu(c.id)};
  row.ondragstart=e=>{e.dataTransfer.setData('text/plain',c.id);e.dataTransfer.effectAllowed='move'};
  row.ondragover=e=>{e.preventDefault();row.classList.add('drag-over')};row.ondragleave=()=>row.classList.remove('drag-over');
  row.ondrop=async e=>{e.preventDefault();row.classList.remove('drag-over');const src=e.dataTransfer.getData('text/plain');if(src&&src!==c.id&&!descendants(src).has(c.id)){const item=getCat(src);if(item){await mutation('updateCategory',{id:src,name:item.name,parentId:c.id},'分類已移動');expanded.add(c.id);renderTree()}}};
  holder.append(row);if(expanded.has(c.id))add(c.id,depth+1)
 })}add(null,0);$('#allCount').textContent=db.articles.length;renderFavorites();
}
function categoryMenu(id){const c=getCat(id);if(!c)return;const chosen=prompt(`管理「${c.name}」\n1 新增子分類\n2 編輯／移動\n3 往上排序\n4 往下排序\n5 合併分類\n6 刪除分類\n請輸入 1～6`);if(chosen==='1')openCategoryDialog(null,id);if(chosen==='2')openCategoryDialog(id);if(chosen==='3'||chosen==='4')mutation('reorderCategory',{id,direction:chosen==='3'?-1:1},'排序已更新');if(chosen==='5')mergeCategory(id);if(chosen==='6'){const count=db.articles.filter(a=>descendants(id).has(a.category)).length;if(confirm(`刪除「${c.name}」及全部子分類？\n${count} 篇文章將保留，但變成未分類。`))mutation('deleteCategory',{id},'分類已刪除')}}
function mergeCategory(id){const choices=db.categories.filter(c=>!descendants(id).has(c.id));if(!choices.length)return toast('沒有可合併的分類');const lines=choices.map((c,i)=>`${i+1}. ${pathText(c.id)}`).join('\n'),number=Number(prompt(`合併「${getCat(id).name}」到哪個分類？輸入數字：\n${lines}`));const dest=choices[number-1];if(!dest)return;if(confirm(`將此分類及子分類中的文章，移至「${pathText(dest.id)}」，並刪除原分類？`))mutation('mergeCategory',{id,destinationId:dest.id},'分類已合併')}
function refreshFilterOptions(){
 const cat=$('#filterCategory'),oldCat=filters.category;
 const opts=[];function walk(p,depth){children(p).forEach(c=>{opts.push({id:c.id,label:'　'.repeat(depth)+c.name});walk(c.id,depth+1)})}walk(null,0);
 cat.innerHTML='<option value="">全部分類</option>'+opts.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');
 if(opts.some(o=>o.id===oldCat))cat.value=oldCat;else{filters.category='';cat.value=''}
 const tags=new Set();db.articles.forEach(a=>a.tags.forEach(t=>tags.add(t)));
 const tagValues=[...tags].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
 $('#filterTag').innerHTML='<option value="">全部標籤</option>'+tagValues.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
 if(tagValues.includes(filters.tag))$('#filterTag').value=filters.tag;else{filters.tag='';$('#filterTag').value=''}
 const counts=new Map();db.articles.forEach(a=>{const domain=hostOf(a.url);counts.set(domain,(counts.get(domain)||0)+1)});
 const sources=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 $('#filterSource').innerHTML='<option value="">全部來源網站</option>'+sources.map(([domain,count])=>`<option value="${escapeHtml(domain)}">${escapeHtml(domain)} (${count})</option>`).join('');
 if(sources.some(x=>x[0]===filters.source))$('#filterSource').value=filters.source;else{filters.source='';$('#filterSource').value=''}
}
function filteredArticles(){
 const selectedIds=selected?descendants(selected):null;
 const filterIds=filters.category?descendants(filters.category):null;
 const start=filters.start?new Date(filters.start+'T00:00:00').getTime():null;
 const end=filters.end?new Date(filters.end+'T23:59:59.999').getTime():null;
 const term=search.toLocaleLowerCase();
 const list=db.articles.filter(a=>{
  if(selectedIds&&!selectedIds.has(a.category))return false;
  if(filterIds&&!filterIds.has(a.category))return false;
  if(filters.source&&hostOf(a.url)!==filters.source)return false;
  if(filters.tag&&!a.tags.includes(filters.tag))return false;
  if(filters.onlyPinned&&!a.pinned)return false;
  if(start!==null||end!==null){const time=Date.parse(a.createdAt);if(!Number.isFinite(time))return false;if(start!==null&&time<start)return false;if(end!==null&&time>end)return false}
  return [a.title,a.url,a.description,a.notes,...a.tags,pathText(a.category)].join(' ').toLocaleLowerCase().includes(term)
 });
 const sort=currentSort;
 const ts=v=>Number.isFinite(Date.parse(v))?Date.parse(v):0;
 const rand=id=>{let n=0;for(const ch of String(id))n=(n*31+ch.charCodeAt(0))>>>0;return ((n^Math.floor(randomSeed*4294967295))>>>0)/4294967295};
 list.sort((a,b)=>{
  if(sort==='random')return rand(a.id)-rand(b.id);
  if(sort==='source')return hostOf(a.url).localeCompare(hostOf(b.url))||a.title.localeCompare(b.title,'zh-Hant');
  if(sort==='title')return a.title.localeCompare(b.title,'zh-Hant');
  if(sort==='oldest')return ts(a.createdAt)-ts(b.createdAt);
  if(sort==='updated')return ts(b.updatedAt)-ts(a.updatedAt);
  return ts(b.createdAt)-ts(a.createdAt)
 });
 if(exploreMode){
  const found=new Map(list.map(a=>[a.id,a]));
  return exploreIds.map(id=>found.get(id)).filter(Boolean);
 }
 // Keep pinned links first except when user intentionally chose random mode.
 return sort==='random'?list:list.sort((a,b)=>Number(b.pinned)-Number(a.pinned));
}
function renderArticles(){
  const list=filteredArticles(),el=$('#articles');
  $('#visibleCount').textContent=list.length;
  $('#emptyState').hidden=list.length>0;
  el.className='articles '+(view==='grid'?'grid-view':'list-view');
  el.innerHTML=list.map(a=>`<article class="article-card${a.pinned?' is-pinned':''}${selectedArticleIds.has(a.id)?' is-selected':''}" data-id="${escapeHtml(a.id)}"><a class="card-link" href="${escapeHtml(safeUrl(a.url)||'#')}" target="_blank" rel="noopener noreferrer" aria-label="開啟原文：${escapeHtml(a.title||a.url)}"><div class="card-meta"><span class="card-cat-icon" aria-hidden="true">${categoryIcon(a.category)}</span><div class="card-category">${escapeHtml(pathText(a.category))}</div></div><div class="card-title">${escapeHtml(a.title||a.url)}</div></a><button type="button" class="card-pin" data-pin-id="${escapeHtml(a.id)}" title="${a.pinned?'取消釘選':'釘選文章'}" aria-label="${a.pinned?'取消釘選':'釘選文章'}">📌</button><label class="batch-check" ${batchMode?'':'hidden'}><input type="checkbox" data-article-check="${escapeHtml(a.id)}" ${selectedArticleIds.has(a.id)?'checked':''} aria-label="選取 ${escapeHtml(a.title||a.url)}"><span>選取</span></label><button type="button" class="card-more" data-manage-id="${escapeHtml(a.id)}" aria-label="編輯此收藏" title="編輯收藏">⋯</button></article>`).join('');
  el.querySelectorAll('[data-manage-id]').forEach(btn=>btn.onclick=()=>manageArticle(btn.dataset.manageId));
  el.querySelectorAll('[data-pin-id]').forEach(btn=>btn.onclick=()=>togglePin(btn.dataset.pinId));
  el.querySelectorAll('[data-article-check]').forEach(input=>input.onchange=e=>{if(e.target.checked)selectedArticleIds.add(input.dataset.articleCheck);else selectedArticleIds.delete(input.dataset.articleCheck);input.closest('.article-card').classList.toggle('is-selected',e.target.checked);updateBatchBar()});
  updateBatchBar();
}
async function togglePin(id){const a=db.articles.find(x=>x.id===id);if(!a)return;try{await mutation('setPinned',{id,pinned:!a.pinned},a.pinned?'已取消釘選':'已釘選文章')}catch(_){}}
function sampleRandom(){
 exploreMode=false;const pool=filteredArticles().map(a=>a.id);exploreMode=true; // uses all articles matching the active filters
 if(!pool.length){exploreMode=false;toast('目前沒有符合篩選條件的文章');return}
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 exploreIds=pool.slice(0,12);$('#randomExplore').textContent='🔀 換一批';$('#exitExplore').hidden=false;renderArticles()
}
function stopExplore(){exploreMode=false;exploreIds=[];$('#randomExplore').textContent='🔀 隨機看看';$('#exitExplore').hidden=true;renderArticles()}
function setBatchMode(on){batchMode=on;if(!on)selectedArticleIds.clear();$('#batchToggle').textContent=on?'完成批次管理':'☑ 批次管理';$('#batchToolbar').hidden=!on;renderArticles()}
function updateBatchBar(){const bar=$('#batchToolbar');if(!bar)return;$('#selectedCount').textContent=selectedArticleIds.size;const n=selectedArticleIds.size;bar.querySelectorAll('[data-batch-action]').forEach(x=>x.disabled=!n)}
function renderHealth(){const h=dataHealth;if(!h)return;const issues=(h.duplicateLinks||0)+(h.invalidCategories||0)+(h.invalidUrls||0)+(h.missingIds||0);$('#healthInfo').textContent=h.repairedIds?`已自動補齊 ${h.repairedIds} 筆文章 ID`:(issues?`資料檢查：${issues} 項待確認`:'資料檢查正常');$('#healthInfo').title=(h.examples||[]).join('\n')}
async function batchAction(type){
 const ids=[...selectedArticleIds];if(!ids.length)return;
 const p={operation:type,ids};
 if(type==='move'){const category=$('#batchCategory').value;if(!category)return toast('請先選擇移動目標分類');p.categoryId=category}
 if(type==='addTags'){const tags=prompt('請輸入要新增的標籤，多個標籤用逗號隔開：');if(tags===null)return;p.tags=tags}
 if(type==='delete'&&!confirm(`確定永久刪除已選取的 ${ids.length} 篇文章嗎？這個操作無法復原。`))return;
 try{await mutation('batchArticles',p,`已處理 ${ids.length} 篇文章`);selectedArticleIds.clear();renderArticles()}catch(_){}
}
function manageArticle(id){
  // Open edit form directly; deletion is available inside the form.
  if(!db.articles.some(a=>a.id===id))return;
  openArticleDialog(id);
}
function render(){renderTree();const c=getCat(selected);$('#pageTitle').textContent=c?.name||'全部收藏';$('#pageSubtitle').textContent=c?`瀏覽「${c.name}」以及所有下層分類中的收藏。`:'收藏值得一讀的好內容，讓每個想法都有自己的位置。';$('#breadcrumbs').textContent=c?'我的收藏 / '+pathText(selected):'我的收藏';renderArticles()}
function formatDate(t){const date=new Date(t);return isNaN(date)?'':date.toLocaleDateString('zh-TW')}
function openArticleDialog(id=null){editArticleId=id;const a=db.articles.find(x=>x.id===id);$('#articleDialogTitle').textContent=a?'編輯收藏':'新增收藏';$('#deleteArticleFromDialog').hidden=!a;options($('#articleCategory'),true);$('#articleUrl').value=a?.url||'';$('#articleTitle').value=a?.title||'';$('#articleCategory').value=a?.category||selected||'';$('#articleTags').value=(a?.tags||[]).join(', ');$('#articleDescription').value=a?.description||'';$('#articleNotes').value=a?.notes||'';$('#articleImage').value=a?.image||'';$('#articleFormError').hidden=true;$('#articleDialog').showModal()}
function openCategoryDialog(id=null,parent=null){editCategoryId=id;const c=getCat(id);$('#categoryDialogTitle').textContent=c?'編輯分類':'新增分類';$('#categoryName').value=c?.name||'';options($('#categoryParent'),true,id);$('#categoryParent').value=c?.parent||parent||'';$('#categoryFormError').hidden=true;$('#categoryDialog').showModal()}
function download(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-collection-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#articleForm').onsubmit=async e=>{e.preventDefault();const url=safeUrl($('#articleUrl').value.trim()),categoryId=$('#articleCategory').value;if(!url||!categoryId){$('#articleFormError').hidden=false;$('#articleFormError').textContent='請填寫有效文章網址，並選擇分類';return}const payload={id:editArticleId,url,categoryId,title:$('#articleTitle').value.trim(),description:$('#articleDescription').value.trim(),imageUrl:$('#articleImage').value.trim(),tags:$('#articleTags').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),notes:$('#articleNotes').value.trim()};try{const r=await mutation(editArticleId?'updateArticle':'addArticle',payload,editArticleId?'文章已更新':'文章已儲存');$('#articleDialog').close();if(r?.status==='duplicate')toast('這篇文章已經收藏過了')}catch(err){$('#articleFormError').hidden=false;$('#articleFormError').textContent=err.message}};
$('#deleteArticleFromDialog').onclick=async()=>{
  const id=editArticleId;
  const article=db.articles.find(a=>a.id===id);
  if(!article)return;
  if(!confirm(`確定永久刪除「${article.title||article.url}」？\n刪除後無法復原。`))return;
  const button=$('#deleteArticleFromDialog');
  button.disabled=true;
  try{
    await mutation('deleteArticle',{id},'收藏已刪除');
    $('#articleDialog').close();
    editArticleId=null;
  }catch(_){/* mutation already displays the error */}
  finally{button.disabled=false;}
};
$('#categoryForm').onsubmit=async e=>{e.preventDefault();const name=$('#categoryName').value.trim(),parentId=$('#categoryParent').value;try{await mutation(editCategoryId?'updateCategory':'createCategory',{id:editCategoryId,name,parentId},'分類已儲存');$('#categoryDialog').close();if(parentId)expanded.add(parentId);renderTree()}catch(err){$('#categoryFormError').hidden=false;$('#categoryFormError').textContent=err.message}};
$('#filterCategory').onchange=e=>{filters.category=e.target.value;stopExplore()};
$('#filterSource').onchange=e=>{filters.source=e.target.value;stopExplore()};
$('#filterTag').onchange=e=>{filters.tag=e.target.value;stopExplore()};
$('#filterPinned').onchange=e=>{filters.onlyPinned=e.target.checked;stopExplore()};
$('#filterDateStart').onchange=e=>{filters.start=e.target.value;stopExplore()};
$('#filterDateEnd').onchange=e=>{filters.end=e.target.value;stopExplore()};
$('#clearFilters').onclick=()=>{filters={category:'',source:'',tag:'',start:'',end:'',onlyPinned:false};['filterCategory','filterSource','filterTag','filterDateStart','filterDateEnd'].forEach(id=>$('#'+id).value='');$('#filterPinned').checked=false;search='';$('#searchInput').value='';stopExplore()};
$('#newArticle').onclick=$('#emptyAdd').onclick=()=>openArticleDialog();$('#addRoot').onclick=()=>openCategoryDialog();$('#allArticles').onclick=()=>selectCategory(null);$('#randomExplore').onclick=sampleRandom;$('#exitExplore').onclick=stopExplore;$('#batchToggle').onclick=()=>setBatchMode(!batchMode);$('#batchSelectAll').onclick=()=>{filteredArticles().forEach(a=>selectedArticleIds.add(a.id));renderArticles()};$('#batchClear').onclick=()=>{selectedArticleIds.clear();renderArticles()};document.querySelectorAll('[data-batch-action]').forEach(b=>b.onclick=()=>batchAction(b.dataset.batchAction));$('#repairData').onclick=async()=>{try{const r=await mutation('repairData',{},'資料檢查完成');dataHealth=r.health;renderHealth();if(dataHealth.examples?.length)alert('發現待確認的資料：\n'+dataHealth.examples.join('\n'))}catch(_){}};$('#searchInput').oninput=e=>{search=e.target.value;stopExplore()};$('#sortSelect').value=['newest','oldest','updated','title','source','random'].includes(currentSort)?currentSort:'newest';$('#sortSelect').onchange=e=>{currentSort=e.target.value;saveSort(currentSort);randomSeed=Math.random();stopExplore()};$('#gridView').onclick=()=>{view='grid';$('#gridView').classList.add('active');$('#listView').classList.remove('active');renderArticles()};$('#listView').onclick=()=>{view='list';$('#listView').classList.add('active');$('#gridView').classList.remove('active');renderArticles()};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());$('#menuSidebar').onclick=()=>{$('#sidebar').classList.add('open');$('#sidebarBackdrop').classList.add('open')};$('#closeSidebar').onclick=$('#sidebarBackdrop').onclick=()=>{$('#sidebar').classList.remove('open');$('#sidebarBackdrop').classList.remove('open')};document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#searchInput').focus()}});
$('#exportData').onclick=download;$('#importData').onclick=()=>$('#importFile').click();$('#importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!Array.isArray(obj.articles)||!Array.isArray(obj.categories))throw Error('格式不正確');if(confirm(`⚠️ 這會覆蓋 Google Sheets 目前全部的文章與分類！\n檔案有 ${obj.articles.length} 篇文章、${obj.categories.length} 個分類。\n請先匯出備份。確定嗎？`)){await mutation('importData',{data:obj,confirmReplace:true},'匯入完成');selected=null;render()}}catch(err){toast('匯入失敗：'+err.message)}e.target.value=''};
if (window.MyCollectionBridge.configured) {
  load().catch(err=>toast('讀取失敗：'+err.message));
} else {
  $('#healthInfo').textContent='尚未設定 GAS 連線：請參照 README.md 設定 config.js';
  toast('尚未設定 GAS 網址，請先完成部署步驟');
}
