'use strict';

const state = {
  data: null, currentAccountId: null, currentStockId: null,
  currentTab: 'buy', stockFilter: 'active'
};

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '۰';
  return Math.round(n).toLocaleString('fa-IR');
}
function fmtRialShort(n) { return `${Math.round(n||0).toLocaleString('fa-IR')} ریال`; }
function fmtFull(n) {
  const r = Math.round(n||0); const t = Math.round(r/10);
  return `${r.toLocaleString('fa-IR')} ریال (${t.toLocaleString('fa-IR')} تومان)`;
}
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function showModal(title, htmlContent, buttons) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').innerHTML = htmlContent;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label; btn.className = 'btn '+(b.cls||'btn-ghost');
    btn.onclick = () => { hideModal(); if (b.action) b.action(); };
    footer.appendChild(btn);
  });
  document.getElementById('modalOverlay').style.display = 'flex';
}
function hideModal() { document.getElementById('modalOverlay').style.display = 'none'; }
function infoModal(title, message) {
  showModal(title,`<p style="color:var(--text-secondary);line-height:1.7">${message}</p>`,[{label:'باشه',cls:'btn-primary'}]);
}
function formModal(title, contentHtml, saveLabel, onSave, saveClass) {
  document.getElementById('modalTitle').textContent = title;
  const msgEl = document.getElementById('modalMessage');
  msgEl.innerHTML = contentHtml;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = '';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = saveLabel||'ذخیره'; saveBtn.className = 'btn '+(saveClass||'btn-primary');
  saveBtn.onclick = onSave; footer.appendChild(saveBtn);
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'انصراف'; cancelBtn.className = 'btn btn-ghost';
  cancelBtn.onclick = hideModal; footer.appendChild(cancelBtn);
  document.getElementById('modalOverlay').style.display = 'flex';
  msgEl.querySelectorAll('input[type=text]').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key==='Enter') onSave(); });
  });
}
function flagInput(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('input-error'); el.addEventListener('input',()=>el.classList.remove('input-error'),{once:true}); el.focus(); }
}

// ─── Bonus / Rights modal helpers ─────────────────────────────────────────────
function _bonusModalHtml(ex) {
  return `
    <div class="modal-form-group">
      <label class="modal-form-label">تعداد سهام جایزه <span class="modal-required">*</span></label>
      <input type="number" id="fm_bonusQty" value="${ex?.quantity||''}" min="1" placeholder="تعداد" style="width:160px">
    </div>
    <div class="modal-form-group">
      <label class="modal-form-label">مبلغ اولیه <small class="modal-optional">(اختیاری — خالی = صفر)</small></label>
      <input type="number" id="fm_bonusAmount" value="${ex?.initialAmount!=null?ex.initialAmount:''}" min="0" placeholder="ریال" style="width:180px">
    </div>`;
}
function _rightsModalHtml(ex) {
  return `
    <div class="modal-form-group">
      <label class="modal-form-label">تعداد حق تقدم <span class="modal-required">*</span></label>
      <input type="number" id="fm_rightsQty" value="${ex?.quantity||''}" min="1" placeholder="تعداد" style="width:160px">
    </div>
    <div class="modal-form-group">
      <label class="modal-form-label">قیمت اولیه (ریال) <span class="modal-required">*</span></label>
      <input type="number" id="fm_rightsPrice" value="${ex?.initialPrice||''}" min="0" placeholder="ریال" style="width:180px">
    </div>
    <div class="modal-form-group">
      <label class="modal-form-label">مبلغ اولیه <small class="modal-optional">(اختیاری — خالی = qty × price)</small></label>
      <input type="number" id="fm_rightsAmount" value="${ex?.initialAmount!=null?ex.initialAmount:''}" min="0" placeholder="ریال" style="width:180px">
    </div>`;
}

// ─── Account Management ───────────────────────────────────────────────────────
function createAccount() {
  formModal('＋ حساب جدید',
    `<div class="modal-form-group"><label class="modal-form-label">نام حساب:</label>
     <input type="text" id="fm_accountName" placeholder="مثلاً: حساب شخصی" style="width:100%"></div>`,
    'ایجاد حساب', () => {
      const name = document.getElementById('fm_accountName')?.value.trim();
      if (!name) { flagInput('fm_accountName'); return; }
      const account = {id:storage.generateId(),name,createdAt:jalali.todayFormatted()};
      state.data.accounts.push(account); storage.save(state.data);
      hideModal(); renderAccountList(); switchAccount(account.id);
    });
  setTimeout(()=>document.getElementById('fm_accountName')?.focus(),60);
}
function switchAccount(id) {
  state.currentAccountId = id||null; state.currentStockId = null;
  const sel = document.getElementById('accountSelect');
  if (sel) sel.value = id||'';
  const addBtn = document.getElementById('addStockBtn');
  if (addBtn) addBtn.disabled = !id;
  renderStockList(); showWelcomeScreen();
}
function deleteCurrentAccount() {
  if (!state.currentAccountId) { infoModal('⚠️ خطا','حسابی انتخاب نشده'); return; }
  const account = state.data.accounts.find(a=>a.id===state.currentAccountId);
  if (!account) return;
  showModal('حذف حساب',
    `<span>حساب "<strong>${escHtml(account.name)}</strong>" و تمام سهام آن حذف شود؟</span>`,
    [{label:'حذف',cls:'btn-danger',action:()=>{
      const ids = state.data.stocks.filter(s=>s.accountId===state.currentAccountId).map(s=>s.id);
      state.data.transactions = state.data.transactions.filter(t=>!ids.includes(t.stockId));
      state.data.stocks = state.data.stocks.filter(s=>s.accountId!==state.currentAccountId);
      state.data.accounts = state.data.accounts.filter(a=>a.id!==state.currentAccountId);
      storage.save(state.data); state.currentAccountId=null; state.currentStockId=null;
      renderAccountList(); renderStockList(); showWelcomeScreen();
      const addBtn=document.getElementById('addStockBtn'); if(addBtn) addBtn.disabled=true;
    }},{label:'انصراف',cls:'btn-ghost'}]);
}
function renderAccountList() {
  const sel = document.getElementById('accountSelect'); if (!sel) return;
  sel.innerHTML = '<option value="">انتخاب حساب...</option>';
  state.data.accounts.forEach(a=>{
    const opt=document.createElement('option'); opt.value=a.id; opt.textContent=a.name; sel.appendChild(opt);
  });
  if (state.currentAccountId) sel.value = state.currentAccountId;
}
function currentAccountName() {
  if (!state.currentAccountId) return '';
  return state.data.accounts.find(a=>a.id===state.currentAccountId)?.name||'';
}

// ─── Stock Management ─────────────────────────────────────────────────────────
function createStock() {
  if (!state.currentAccountId) { infoModal('⚠️ خطا','ابتدا یک حساب انتخاب کنید'); return; }
  formModal('＋ سهام جدید',
    `<div class="modal-form-group">
       <label class="modal-form-label">نماد سهام <span class="modal-required">*</span></label>
       <input type="text" id="fm_symbol" placeholder="مثلاً: فولاد" style="width:100%">
     </div>
     <div class="modal-form-group">
       <label class="modal-form-label">نام شرکت <span style="font-weight:400;color:#999">(اختیاری)</span></label>
       <input type="text" id="fm_name" placeholder="نام کامل" style="width:100%">
     </div>`,
    'افزودن سهم', () => {
      const symbol = document.getElementById('fm_symbol')?.value.trim();
      if (!symbol) { flagInput('fm_symbol'); return; }
      const stock = {
        id:storage.generateId(), accountId:state.currentAccountId, symbol,
        name:document.getElementById('fm_name')?.value.trim()||'',
        createdAt:jalali.todayFormatted(), realTimePrice:null, finalized:false,
        bonusShares:{enabled:false,quantity:0,initialAmount:null},
        rightShares:{enabled:false,quantity:0,initialPrice:0,initialAmount:null,realTimePrice:null,sold:false,salePrice:null,saleAmount:null}
      };
      state.data.stocks.push(stock); storage.save(state.data);
      hideModal(); renderStockList(); selectStock(stock.id);
    });
  setTimeout(()=>document.getElementById('fm_symbol')?.focus(),60);
}
function editStock(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  formModal('✏️ ویرایش سهم',
    `<div class="modal-form-group">
       <label class="modal-form-label">نماد سهام <span class="modal-required">*</span></label>
       <input type="text" id="fm_editSymbol" value="${escHtml(stock.symbol)}" style="width:100%">
     </div>
     <div class="modal-form-group">
       <label class="modal-form-label">نام شرکت <span style="font-weight:400;color:#999">(اختیاری)</span></label>
       <input type="text" id="fm_editName" value="${escHtml(stock.name||'')}" style="width:100%">
     </div>`,
    'ذخیره', () => {
      const symbol = document.getElementById('fm_editSymbol')?.value.trim();
      if (!symbol) { flagInput('fm_editSymbol'); return; }
      stock.symbol = symbol; stock.name = document.getElementById('fm_editName')?.value.trim()||'';
      storage.save(state.data); hideModal(); renderStockList(); renderStockDetail();
    });
  setTimeout(()=>document.getElementById('fm_editSymbol')?.focus(),60);
}
function selectStock(id) {
  state.currentStockId = id;
  document.querySelectorAll('.stock-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  document.querySelectorAll('.portfolio-nav-item').forEach(el=>el.classList.remove('active'));
  state.currentTab = 'buy'; renderStockDetail();
}
function deleteStock(id) {
  const stock = state.data.stocks.find(s=>s.id===id); if (!stock) return;
  showModal('حذف سهم',
    `<span>سهم "<strong>${escHtml(stock.symbol)}</strong>" و تمام معاملات آن حذف شود؟</span>`,
    [{label:'حذف',cls:'btn-danger',action:()=>{
      state.data.transactions = state.data.transactions.filter(t=>t.stockId!==id);
      state.data.stocks = state.data.stocks.filter(s=>s.id!==id);
      storage.save(state.data);
      if (state.currentStockId===id) { state.currentStockId=null; showWelcomeScreen(); }
      renderStockList();
    }},{label:'انصراف',cls:'btn-ghost'}]);
}
function setStockFilter(filter) {
  state.stockFilter = filter;
  const curStock = state.data.stocks.find(s=>s.id===state.currentStockId);
  if (curStock) {
    const mismatch = (filter==='sold' && !curStock.finalized) || (filter==='active' && curStock.finalized);
    if (mismatch) { state.currentStockId=null; showWelcomeScreen(); }
  }
  renderStockList();
}
function finalizeStock(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  const sum = calculateSummary(stockId);
  if (sum.totalBuyQty===0) { infoModal('⚠️','هیچ خریدی ثبت نشده'); return; }
  const ip = sum.realizedProfit>=0;
  const sign = ip?'+':'';
  const pct  = sum.costOfSold>0?((sum.realizedProfit/sum.costOfSold)*100).toFixed(2):'0';
  showModal('🏁 اتمام معامله',
    `<div style="font-size:13px;line-height:2">
       <div>معامله سهم <strong>${escHtml(stock.symbol)}</strong> بسته شود؟</div>
       ${sum.totalSellQty>0?`<div style="margin-top:8px;padding:10px;background:${ip?'#E8F5E9':'#FFEBEE'};border-radius:8px;font-size:12px">
         سود/زیان فعلی: <strong class="${ip?'pnl-pos':'pnl-neg'}">${sign}${fmtFull(sum.realizedProfit)}</strong> (${sign}${pct}٪)
       </div>`:''}
       ${sum.remainingQty>0?`<div style="font-size:12px;color:#E65100;margin-top:8px">⚠️ ${fmtNum(sum.remainingQty)} سهم هنوز فروخته نشده</div>`:''}
       <div style="font-size:11px;color:#999;margin-top:8px">پس از بستن، با ثبت خرید جدید سهم به حالت فعال برمی‌گردد</div>
     </div>`,
    [{label:'✅ بله، ثبت شود',cls:'btn-success',action:()=>{
      stock.finalized=true; storage.save(state.data); renderStockList(); renderStockDetail();
    }},{label:'انصراف',cls:'btn-ghost'}]);
}
function reactivateStock(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  stock.finalized=false; storage.save(state.data); renderStockList(); renderStockDetail();
}
function renderStockList() {
  const container = document.getElementById('stockList'); if (!container) return;
  if (!state.currentAccountId) {
    container.innerHTML='<div class="empty-state">ابتدا یک حساب انتخاب کنید</div>'; return;
  }
  const all    = state.data.stocks.filter(s=>s.accountId===state.currentAccountId);
  const active = all.filter(s=>!s.finalized);
  const sold   = all.filter(s=>s.finalized);
  const showSold = state.stockFilter==='sold';
  const list   = showSold ? sold : active;

  const filterTabs = `
    <div class="sidebar-filter-tabs">
      <button class="sft-btn${!showSold?' sft-active':''}" onclick="setStockFilter('active')">فعال <span class="sft-count">${active.length}</span></button>
      <button class="sft-btn sold-sft${showSold?' sft-active':''}" onclick="setStockFilter('sold')">فروخته‌شده <span class="sft-count">${sold.length}</span></button>
    </div>`;

  const portfolioNav = !showSold ? `
    <div class="portfolio-nav-item ${!state.currentStockId?'active':''}" onclick="showPortfolio()">
      <span>📊</span> نمای کلی سبد
    </div>` : '';

  if (!list.length) {
    container.innerHTML = filterTabs + portfolioNav +
      `<div class="empty-state">${showSold?'سهم فروخته‌شده‌ای ندارید':'سهمی ثبت نشده<br><small>از دکمه + سهام جدید استفاده کنید</small>'}</div>`;
    return;
  }
  container.innerHTML = filterTabs + portfolioNav + list.map(s=>{
    const badges = [
      s.bonusShares?.enabled?'<span class="stock-badge bonus-badge" title="سهام جایزه">🎁</span>':'',
      s.rightShares?.enabled?'<span class="stock-badge rights-badge" title="حق تقدم">ح</span>':''
    ].join('');
    return `<div class="stock-item ${s.id===state.currentStockId?'active':''} ${s.finalized?'sold-stock-item':''}"
              data-id="${s.id}" onclick="selectStock('${s.id}')">
      <div>
        <div class="stock-symbol">${escHtml(s.symbol)} ${badges}</div>
        ${s.name?`<div class="stock-name">${escHtml(s.name)}</div>`:''}
      </div>
      <button class="delete-stock-btn" onclick="event.stopPropagation();deleteStock('${s.id}')">×</button>
    </div>`;
  }).join('');
}

// ─── Bonus / Rights inline management ────────────────────────────────────────
function addBonusShares(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  formModal('🎁 افزودن سهام جایزه', _bonusModalHtml(null), 'افزودن', ()=>{
    const qty = parseInt(document.getElementById('fm_bonusQty')?.value);
    if (!qty||qty<=0) { flagInput('fm_bonusQty'); return; }
    const el = document.getElementById('fm_bonusAmount');
    const amt = (el&&el.value!=='') ? (parseFloat(el.value)||0) : null;
    stock.bonusShares = {enabled:true,quantity:qty,initialAmount:amt};
    storage.save(state.data); hideModal(); renderStockList(); renderStockDetail();
  });
  setTimeout(()=>document.getElementById('fm_bonusQty')?.focus(),60);
}
function editBonusShares(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  formModal('✏️ ویرایش سهام جایزه', _bonusModalHtml(stock.bonusShares), 'ذخیره', ()=>{
    const qty = parseInt(document.getElementById('fm_bonusQty')?.value);
    if (!qty||qty<=0) { flagInput('fm_bonusQty'); return; }
    const el = document.getElementById('fm_bonusAmount');
    const amt = (el&&el.value!=='') ? (parseFloat(el.value)||0) : null;
    stock.bonusShares = {enabled:true,quantity:qty,initialAmount:amt};
    storage.save(state.data); hideModal(); renderStockDetail();
  });
  setTimeout(()=>document.getElementById('fm_bonusQty')?.focus(),60);
}
function deleteBonusShares(stockId) {
  showModal('🗑 حذف سهام جایزه','<span>اطلاعات سهام جایزه حذف شود؟</span>',
    [{label:'حذف',cls:'btn-danger',action:()=>{
      const stock=state.data.stocks.find(s=>s.id===stockId);
      if (stock) { stock.bonusShares={enabled:false,quantity:0,initialAmount:null}; storage.save(state.data); renderStockDetail(); renderStockList(); }
    }},{label:'انصراف',cls:'btn-ghost'}]);
}
function sellBonusShares(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock?.bonusShares?.enabled) return;
  const qty = stock.bonusShares.quantity;
  state.currentTab = 'sell'; renderStockDetail();
  setTimeout(()=>{
    const el = document.getElementById('qty_1');
    if (el) { el.value=qty; calcRowTotal(1); }
    document.getElementById('transactionFormContainer')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  },80);
}
function addRightShares(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  formModal('📜 افزودن حق تقدم', _rightsModalHtml(null), 'افزودن', ()=>{
    const qty   = parseInt(document.getElementById('fm_rightsQty')?.value);
    const price = parseFloat(document.getElementById('fm_rightsPrice')?.value);
    if (!qty||qty<=0) { flagInput('fm_rightsQty'); return; }
    if (isNaN(price)||price<0) { flagInput('fm_rightsPrice'); return; }
    const el = document.getElementById('fm_rightsAmount');
    const amt = (el&&el.value!=='') ? (parseFloat(el.value)||0) : null;
    const prev = stock.rightShares||{};
    stock.rightShares = {enabled:true,quantity:qty,initialPrice:price,initialAmount:amt,
      realTimePrice:prev.realTimePrice||null,sold:false,salePrice:null,saleAmount:null};
    storage.save(state.data); hideModal(); renderStockList(); renderStockDetail();
  });
  setTimeout(()=>document.getElementById('fm_rightsQty')?.focus(),60);
}
function editRightShares(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  const ex = stock.rightShares;
  let extraHtml = '';
  if (ex?.sold) {
    extraHtml = `<div class="modal-form-group">
      <label class="modal-form-label">قیمت فروش (ریال/سهم)</label>
      <input type="number" id="fm_rightsSalePrice" value="${ex.salePrice||''}" min="0" style="width:180px">
    </div>`;
  }
  formModal('✏️ ویرایش حق تقدم', _rightsModalHtml(ex)+extraHtml, 'ذخیره', ()=>{
    const qty   = parseInt(document.getElementById('fm_rightsQty')?.value);
    const price = parseFloat(document.getElementById('fm_rightsPrice')?.value);
    if (!qty||qty<=0) { flagInput('fm_rightsQty'); return; }
    if (isNaN(price)||price<0) { flagInput('fm_rightsPrice'); return; }
    const el = document.getElementById('fm_rightsAmount');
    const amt = (el&&el.value!=='') ? (parseFloat(el.value)||0) : null;
    const prev = stock.rightShares;
    let newSalePrice = prev?.salePrice||null, newSaleAmount = prev?.saleAmount||null;
    const saleEl = document.getElementById('fm_rightsSalePrice');
    if (saleEl && prev?.sold) {
      newSalePrice = parseFloat(saleEl.value)||0;
      newSaleAmount = qty * newSalePrice;
    }
    stock.rightShares = {enabled:true,quantity:qty,initialPrice:price,initialAmount:amt,
      realTimePrice:prev?.realTimePrice||null,sold:prev?.sold||false,salePrice:newSalePrice,saleAmount:newSaleAmount};
    storage.save(state.data); hideModal(); renderStockDetail();
  });
  setTimeout(()=>document.getElementById('fm_rightsQty')?.focus(),60);
}
function deleteRightShares(stockId) {
  showModal('🗑 حذف حق تقدم','<span>اطلاعات حق تقدم حذف شود؟</span>',
    [{label:'حذف',cls:'btn-danger',action:()=>{
      const stock=state.data.stocks.find(s=>s.id===stockId);
      if (stock) {
        stock.rightShares={enabled:false,quantity:0,initialPrice:0,initialAmount:null,realTimePrice:null,sold:false,salePrice:null,saleAmount:null};
        storage.save(state.data); renderStockDetail(); renderStockList();
      }
    }},{label:'انصراف',cls:'btn-ghost'}]);
}
function sellRightShares(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock?.rightShares?.enabled) return;
  const r = stock.rightShares;
  formModal('💰 فروش حق تقدم',
    `<div class="modal-form-group">
       <label class="modal-form-label">قیمت فروش هر حق تقدم (ریال) <span class="modal-required">*</span></label>
       <input type="number" id="fm_rightsSalePrice" value="${r.realTimePrice||''}" min="0" placeholder="ریال" style="width:180px">
     </div>
     <div style="font-size:12px;color:#777;margin-top:4px">تعداد: ${fmtNum(r.quantity)} سهم</div>`,
    'ثبت فروش', ()=>{
      const price = parseFloat(document.getElementById('fm_rightsSalePrice')?.value);
      if (!price||price<=0) { flagInput('fm_rightsSalePrice'); return; }
      stock.rightShares.sold = true;
      stock.rightShares.salePrice  = price;
      stock.rightShares.saleAmount = r.quantity * price;
      stock.rightShares.realTimePrice = null;
      storage.save(state.data); hideModal(); renderStockDetail();
    });
  setTimeout(()=>document.getElementById('fm_rightsSalePrice')?.focus(),60);
}
function unsellRightShares(stockId) {
  showModal('↩ لغو فروش حق تقدم','<span>فروش حق تقدم لغو و داده‌های فروش پاک شود؟</span>',
    [{label:'بله',cls:'btn-warning',action:()=>{
      const stock=state.data.stocks.find(s=>s.id===stockId);
      if (stock?.rightShares) {
        stock.rightShares.sold=false; stock.rightShares.salePrice=null; stock.rightShares.saleAmount=null;
        storage.save(state.data); renderStockDetail();
      }
    }},{label:'انصراف',cls:'btn-ghost'}]);
}

// ─── Calculations ─────────────────────────────────────────────────────────────
function getStockTransactions(stockId) {
  const all  = state.data.transactions.filter(t=>t.stockId===stockId);
  const sort = arr=>arr.sort((a,b)=>a.createdAt>b.createdAt?1:-1);
  return {buys:sort(all.filter(t=>t.type==='buy')),sells:sort(all.filter(t=>t.type==='sell'))};
}
function calculateSummary(stockId) {
  const {buys,sells} = getStockTransactions(stockId);
  let totalBuyQty=0,totalBuyAmount=0,totalSellQty=0,totalSellAmount=0;
  buys.forEach(t=>{totalBuyQty+=t.totalQuantity;totalBuyAmount+=t.totalAmount;});
  sells.forEach(t=>{totalSellQty+=t.totalQuantity;totalSellAmount+=t.totalAmount;});
  const avgBuyPrice         = totalBuyQty>0 ? totalBuyAmount/totalBuyQty : 0;
  const costOfSold          = avgBuyPrice * totalSellQty;
  const realizedProfit      = totalSellAmount - costOfSold;
  const remainingQty        = totalBuyQty - totalSellQty;
  const remainingInvestment = avgBuyPrice * remainingQty;
  const stock               = state.data.stocks.find(s=>s.id===stockId);
  const realTimePrice       = stock ? (parseFloat(stock.realTimePrice)||0) : 0;
  const hasRT               = realTimePrice>0 && remainingQty>0;
  const currentValue        = hasRT ? realTimePrice*remainingQty : 0;
  const unrealizedPnl       = hasRT ? (realTimePrice-avgBuyPrice)*remainingQty : null;
  const totalPnl            = unrealizedPnl!==null ? realizedProfit+unrealizedPnl : null;

  // Bonus contribution: realtime × qty treated as realized profit
  let bonus = null;
  const b = stock?.bonusShares;
  if (b?.enabled && b.quantity>0) {
    const bCost   = b.initialAmount!=null ? parseFloat(b.initialAmount)||0 : 0;
    const bVal    = realTimePrice>0 ? b.quantity*realTimePrice : 0;
    const bProfit = realTimePrice>0 ? bVal-bCost : null;
    bonus = {quantity:b.quantity,costBasis:bCost,currentValue:bVal,valueAsProfit:bProfit};
  }

  // Rights contribution: entire value treated as realized profit
  let rights = null;
  const r = stock?.rightShares;
  if (r?.enabled && r.quantity>0) {
    const rInitialPrice = parseFloat(r.initialPrice)||0;
    const rCost = r.initialAmount!=null ? parseFloat(r.initialAmount)||0 : r.quantity*rInitialPrice;
    if (r.sold) {
      const rSale = parseFloat(r.saleAmount)||0;
      rights = {quantity:r.quantity,initialPrice:rInitialPrice,costBasis:rCost,
                sold:true,salePrice:parseFloat(r.salePrice)||0,saleAmount:rSale,
                currentValue:rSale,valueAsProfit:rSale-rCost,realTimePrice:null};
    } else {
      const rRt  = parseFloat(r.realTimePrice)||0;
      const rVal = rRt>0 ? r.quantity*rRt : 0;
      const rPft = rRt>0 ? rVal-rCost : null;
      rights = {quantity:r.quantity,initialPrice:rInitialPrice,costBasis:rCost,
                sold:false,realTimePrice:rRt,currentValue:rVal,valueAsProfit:rPft};
    }
  }

  const bonusContrib  = bonus  && bonus.valueAsProfit!==null  ? bonus.valueAsProfit  : 0;
  const rightsContrib = rights && rights.valueAsProfit!==null ? rights.valueAsProfit : 0;
  const totalRealizedProfit = realizedProfit + bonusContrib + rightsContrib;

  return {
    totalBuyQty,totalBuyAmount,avgBuyPrice,totalSellQty,totalSellAmount,
    remainingQty,remainingInvestment,realizedProfit,costOfSold,
    realTimePrice,currentValue,unrealizedPnl,totalPnl,
    bonus,rights,totalRealizedProfit
  };
}

// ─── Real-Time Price ──────────────────────────────────────────────────────────
function updateStockRealTimePrice(stockId, value) {
  const price = parseFloat(value)||0;
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  stock.realTimePrice = price>0 ? price : null;
  storage.save(state.data);
  const sum = calculateSummary(stockId);
  if (state.currentStockId===stockId) { updateDetailPnlSection(sum); updateBonusPnlSection(sum); }
  else if (!state.currentStockId) updatePortfolioRow(stockId);
}
function clearRealTimePrice(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock) return;
  stock.realTimePrice=null; storage.save(state.data); renderStockDetail();
}
function updateRightsRealTimePrice(stockId, value) {
  const price = parseFloat(value)||0;
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock?.rightShares) return;
  stock.rightShares.realTimePrice = price>0 ? price : null;
  storage.save(state.data);
  const sum = calculateSummary(stockId);
  if (state.currentStockId===stockId) updateRightsPnlSection(sum);
  else if (!state.currentStockId) updatePortfolioRow(stockId);
}
function clearRightsRealTimePrice(stockId) {
  const stock = state.data.stocks.find(s=>s.id===stockId); if (!stock?.rightShares) return;
  stock.rightShares.realTimePrice=null; storage.save(state.data); renderStockDetail();
}

// ─── Targeted DOM updates ─────────────────────────────────────────────────────
function updateDetailPnlSection(sum) {
  const el = document.getElementById('detail-rt-pnl'); if (!el) return;
  if (sum.realTimePrice>0 && sum.remainingQty>0) {
    const ip = (sum.unrealizedPnl||0)>=0;
    const s  = ip?'+':'';
    const pct = sum.remainingInvestment>0?((sum.unrealizedPnl/sum.remainingInvestment)*100).toFixed(2):'0';
    el.innerHTML=`<div class="rt-pnl-box ${ip?'':'rt-loss'}"><div class="rt-pnl-grid">
      <div class="rt-pnl-item"><span class="rt-pnl-label">💰 ارزش لحظه‌ای</span><span class="rt-pnl-val">${fmtFull(sum.currentValue)}</span></div>
      <div class="rt-pnl-item"><span class="rt-pnl-label">${ip?'🟢 سود':'🔴 زیان'} لحظه‌ای</span>
        <span class="rt-pnl-val ${ip?'pnl-pos':'pnl-neg'}">${s}${fmtFull(sum.unrealizedPnl||0)}</span>
        <span class="rt-pnl-pct">${s}${pct}٪</span></div>
      ${sum.totalPnl!==null?`<div class="rt-pnl-item"><span class="rt-pnl-label">💎 سود/زیان کل</span>
        <span class="rt-pnl-val ${sum.totalPnl>=0?'pnl-pos':'pnl-neg'}">${sum.totalPnl>=0?'+':''}${fmtFull(sum.totalPnl)}</span>
        <span class="rt-pnl-sub">تحقق‌یافته + لحظه‌ای</span></div>`:''}</div></div>`;
  } else el.innerHTML='';
}
function updateBonusPnlSection(sum) {
  const el = document.getElementById('detail-bonus-value'); if (!el||!sum.bonus) return;
  if (sum.realTimePrice>0 && sum.bonus.valueAsProfit!==null) {
    const v=sum.bonus.valueAsProfit;
    el.textContent=`ارزش: ${fmtRialShort(sum.bonus.currentValue)} | ${v>=0?'+':''}${fmtRialShort(v)}`;
    el.className=`extra-pnl-tag ${v>=0?'pnl-pos':'pnl-neg'}`; el.style.display='';
  } else { el.textContent=''; el.style.display='none'; }
}
function updateRightsPnlSection(sum) {
  const el = document.getElementById('detail-rights-pnl'); if (!el||!sum.rights) return;
  const r = sum.rights;
  if (!r.sold && r.realTimePrice>0) {
    const ip=(r.valueAsProfit||0)>=0; const s=ip?'+':'';
    const pct=r.costBasis>0?((r.valueAsProfit/r.costBasis)*100).toFixed(2):'0';
    el.innerHTML=`<div class="rt-pnl-box ${ip?'':'rt-loss'}" style="margin-top:8px"><div class="rt-pnl-grid">
      <div class="rt-pnl-item"><span class="rt-pnl-label">💰 ارزش لحظه‌ای حق تقدم</span><span class="rt-pnl-val">${fmtFull(r.currentValue)}</span></div>
      <div class="rt-pnl-item"><span class="rt-pnl-label">${ip?'🟢 سود':'🔴 زیان'} لحظه‌ای</span>
        <span class="rt-pnl-val ${ip?'pnl-pos':'pnl-neg'}">${s}${fmtFull(r.valueAsProfit||0)}</span>
        <span class="rt-pnl-pct">${s}${pct}٪</span></div>
    </div></div>`;
  } else el.innerHTML='';
}
function updatePortfolioRow(stockId) {
  const sum = calculateSummary(stockId);
  const cvEl   = document.getElementById(`pf-cv-${stockId}`);
  const pnlEl  = document.getElementById(`pf-pnl-${stockId}`);
  const rpnlEl = document.getElementById(`pf-rpnl-${stockId}`);
  if (cvEl)  cvEl.textContent = sum.currentValue>0?fmtNum(sum.currentValue):'—';
  if (pnlEl) {
    if (sum.unrealizedPnl!==null) {
      pnlEl.textContent=`${sum.unrealizedPnl>=0?'+':''}${fmtNum(sum.unrealizedPnl)}`;
      pnlEl.className=`number-col ${sum.unrealizedPnl>=0?'pnl-pos':'pnl-neg'}`;
    } else { pnlEl.textContent='—'; pnlEl.className='number-col'; }
  }
  if (rpnlEl) {
    const rp=sum.totalRealizedProfit;
    const show=sum.totalSellQty>0||(sum.bonus&&sum.realTimePrice>0)||(sum.rights?.sold)||(sum.rights&&sum.rights.realTimePrice>0);
    if (show) { rpnlEl.textContent=`${rp>=0?'+':''}${fmtNum(rp)}`; rpnlEl.className=`number-col ${rp>=0?'pnl-pos':'pnl-neg'}`; }
    else { rpnlEl.textContent='—'; rpnlEl.className='number-col'; }
  }
  updatePortfolioTotals();
}
function updatePortfolioTotals() {
  if (!state.currentAccountId) return;
  const stocks = state.data.stocks.filter(s=>s.accountId===state.currentAccountId);
  const sums   = stocks.map(s=>({stock:s,sum:calculateSummary(s.id)}));
  const active = sums.filter(r=>!r.stock.finalized);
  const totalInvested      = active.reduce((a,r)=>a+r.sum.remainingInvestment,0);
  const totalCurrentValue  = active.reduce((a,r)=>a+(r.sum.currentValue||0),0);
  const totalUnrealizedPnl = active.reduce((a,r)=>a+(r.sum.unrealizedPnl||0),0);
  const totalRealizedPnl   = sums.reduce((a,r)=>a+r.sum.totalRealizedProfit,0);
  const hasRealTime        = active.some(r=>r.sum.realTimePrice>0&&r.sum.remainingQty>0);
  const set    = (id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
  const setCls = (id,cls) =>{const el=document.getElementById(id);if(el)el.className=cls;};
  set('pf-total-invested',fmtNum(totalInvested));
  set('pf-total-cv',hasRealTime?fmtNum(totalCurrentValue):'—');
  set('pf-total-rpnl',fmtNum(totalRealizedPnl));
  setCls('pf-total-rpnl',`number-col ${totalRealizedPnl>=0?'pnl-pos':'pnl-neg'}`);
  if (hasRealTime) {
    set('pf-total-pnl',`${totalUnrealizedPnl>=0?'+':''}${fmtNum(totalUnrealizedPnl)}`);
    setCls('pf-total-pnl',`number-col ${totalUnrealizedPnl>=0?'pnl-pos':'pnl-neg'}`);
  } else { set('pf-total-pnl','—'); setCls('pf-total-pnl','number-col'); }
  const cvCard  = document.getElementById('pf-agg-cv-card');
  const pnlCard = document.getElementById('pf-agg-pnl-card');
  if (cvCard)  { cvCard.style.display=hasRealTime?'':'none'; set('pf-agg-cv',fmtFull(totalCurrentValue)); }
  if (pnlCard) {
    pnlCard.style.display=hasRealTime?'':'none';
    pnlCard.className=`agg-card ${totalUnrealizedPnl>=0?'agg-profit':'agg-loss'}`;
    set('pf-agg-pnl',`${totalUnrealizedPnl>=0?'+':''}${fmtFull(totalUnrealizedPnl)}`);
  }
  const account = state.data.accounts.find(a=>a.id===state.currentAccountId);
  const ic = account ? (parseFloat(account.inactiveCapital)||0) : 0;
  set('pf-agg-ic-val', fmtFull(ic));
  set('pf-total-assets', fmtFull(totalInvested + ic + totalRealizedPnl));
}

// ─── Portfolio Dashboard ───────────────────────────────────────────────────────
function showPortfolio() {
  state.currentStockId=null;
  document.querySelectorAll('.stock-item').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.portfolio-nav-item').forEach(el=>el.classList.add('active'));
  renderPortfolioDashboard();
}
function renderPortfolioDashboard() {
  const detail = document.getElementById('stockDetail'); if (!detail||!state.currentAccountId) return;
  const stocks = state.data.stocks.filter(s=>s.accountId===state.currentAccountId);
  if (!stocks.length) {
    detail.innerHTML=`<div class="welcome-screen"><div class="welcome-icon">📊</div><h2>سبد خالی است</h2><p>از دکمه ＋ سهام جدید اضافه کنید</p></div>`; return;
  }
  const account  = state.data.accounts.find(a=>a.id===state.currentAccountId);
  const ic       = account ? (parseFloat(account.inactiveCapital)||0) : 0;
  const rows     = stocks.map(s=>({stock:s,sum:calculateSummary(s.id)}));
  const active   = rows.filter(r=>!r.stock.finalized);
  const finalized= rows.filter(r=>r.stock.finalized);
  const totalInvested      = active.reduce((a,r)=>a+r.sum.remainingInvestment,0);
  const totalCurrentValue  = active.reduce((a,r)=>a+(r.sum.currentValue||0),0);
  const totalUnrealizedPnl = active.reduce((a,r)=>a+(r.sum.unrealizedPnl||0),0);
  const totalRealizedPnl   = rows.reduce((a,r)=>a+r.sum.totalRealizedProfit,0);
  const hasRealTime        = active.some(r=>r.sum.realTimePrice>0&&r.sum.remainingQty>0);
  const totalAssets        = totalInvested + ic + totalRealizedPnl;

  const activeRowsHtml = active.map(({stock,sum})=>{
    const hasPnl = sum.unrealizedPnl!==null;
    const rp = sum.totalRealizedProfit;
    const showRp = sum.totalSellQty>0||(sum.bonus&&sum.realTimePrice>0)||(sum.rights?.sold)||(sum.rights&&sum.rights.realTimePrice>0);
    const badges = [
      stock.bonusShares?.enabled?`<span class="pf-extra-badge bonus-badge">🎁 ${fmtNum(stock.bonusShares.quantity)}</span>`:'',
      stock.rightShares?.enabled?`<span class="pf-extra-badge rights-badge">ح ${fmtNum(stock.rightShares.quantity)}</span>`:''
    ].filter(Boolean).join(' ');
    const rightsRtInput = (stock.rightShares?.enabled && !stock.rightShares?.sold) ? `
      <div style="margin-top:5px;padding-top:5px;border-top:1px dashed #DDD">
        <div style="font-size:10px;color:#4527A0;font-weight:700;margin-bottom:2px">${escHtml(stock.symbol)}ح:</div>
        <input type="number" class="rt-price-input rights-rt-input" value="${stock.rightShares.realTimePrice||''}" placeholder="—"
               oninput="updateRightsRealTimePrice('${stock.id}',this.value)">
      </div>` : (stock.rightShares?.sold ? `<div style="font-size:10px;color:#4527A0;margin-top:4px">ح: ✅ فروخته</div>` : '');
    return `<tr>
      <td onclick="selectStock('${stock.id}')" style="cursor:pointer">
        <div class="pf-symbol">${escHtml(stock.symbol)}</div>
        ${stock.name?`<div class="pf-name">${escHtml(stock.name)}</div>`:''}
        ${badges?`<div class="pf-extras">${badges}</div>`:''}
      </td>
      <td class="number-col">${sum.remainingQty>0?fmtNum(sum.remainingQty):'<span class="dim">—</span>'}</td>
      <td class="number-col">${sum.totalBuyQty>0?fmtNum(sum.avgBuyPrice):'<span class="dim">—</span>'}</td>
      <td class="number-col">${fmtNum(sum.remainingInvestment)}</td>
      <td class="number-col pf-price-cell" onclick="event.stopPropagation()">
        <input type="number" class="rt-price-input" value="${sum.realTimePrice||''}" placeholder="—"
               oninput="updateStockRealTimePrice('${stock.id}',this.value)">
        ${rightsRtInput}
      </td>
      <td class="number-col" id="pf-cv-${stock.id}">${sum.currentValue>0?fmtNum(sum.currentValue):'<span class="dim">—</span>'}</td>
      <td class="number-col ${hasPnl?(sum.unrealizedPnl>=0?'pnl-pos':'pnl-neg'):''}" id="pf-pnl-${stock.id}">
        ${hasPnl?`${sum.unrealizedPnl>=0?'+':''}${fmtNum(sum.unrealizedPnl)}`:'<span class="dim">—</span>'}
      </td>
      <td class="number-col ${showRp?(rp>=0?'pnl-pos':'pnl-neg'):'dim'}" id="pf-rpnl-${stock.id}">
        ${showRp?`${rp>=0?'+':''}${fmtNum(rp)}`:'—'}
      </td>
    </tr>`;
  }).join('');

  const finalizedRowsHtml = finalized.length ? [
    `<tr class="pf-section-divider"><td colspan="8" style="padding:8px 12px;font-size:12px;color:#666;background:#F5F5F5">🏁 فروخته‌شده</td></tr>`,
    ...finalized.map(({stock,sum})=>{
      const rp=sum.totalRealizedProfit;
      return `<tr class="pf-finalized-row" onclick="selectStock('${stock.id}')" style="cursor:pointer">
        <td>
          <div class="pf-symbol" style="opacity:.5">${escHtml(stock.symbol)}</div>
          ${stock.name?`<div class="pf-name" style="opacity:.5">${escHtml(stock.name)}</div>`:''}
          <span class="pf-finalized-tag">فروخته‌شده</span>
        </td>
        <td class="dim">${sum.remainingQty>0?fmtNum(sum.remainingQty):'—'}</td>
        <td class="dim">—</td><td class="dim">—</td><td class="dim">—</td><td class="dim">—</td><td class="dim">—</td>
        <td class="number-col ${rp>=0?'pnl-pos':'pnl-neg'}" id="pf-rpnl-${stock.id}">
          ${rp!==0?`${rp>=0?'+':''}${fmtNum(rp)}`:'—'}
        </td>
      </tr>`;
    })
  ].join('') : '';

  detail.innerHTML=`
    <div class="pf-dashboard">
      <div class="pf-dashboard-header">
        <div>
          <h2 class="pf-title">📊 نمای کلی سبد سهام</h2>
          <span class="pf-account-badge">${escHtml(currentAccountName())}</span>
        </div>
        <div class="pf-hint">قیمت لحظه‌ای را وارد کنید تا سود/زیان محاسبه شود</div>
      </div>
      <div class="pf-agg-grid">
        <div class="agg-card"><div class="agg-label">💼 سرمایه در گردش (فعال)</div><div class="agg-value">${fmtFull(totalInvested)}</div></div>
        <div class="agg-card agg-card-ic">
          <div class="agg-label">💤 سرمایه غیرفعال (بلااستفاده)</div>
          <div class="ic-input-row" onclick="event.stopPropagation()">
            <input type="number" id="pf-ic-input" class="ic-amount-input" value="${ic||''}" placeholder="۰"
                   oninput="updateInactiveCapital('${state.currentAccountId}',this.value)">
            <span class="ic-unit">ریال</span>
          </div>
          <div class="agg-value" id="pf-agg-ic-val" style="font-size:12px;margin-top:4px">${ic>0?fmtFull(ic):'—'}</div>
        </div>
        <div class="agg-card" id="pf-agg-cv-card" style="${hasRealTime?'':'display:none'}">
          <div class="agg-label">📈 ارزش لحظه‌ای کل</div><div class="agg-value" id="pf-agg-cv">${fmtFull(totalCurrentValue)}</div>
        </div>
        <div class="agg-card ${hasRealTime?(totalUnrealizedPnl>=0?'agg-profit':'agg-loss'):''}" id="pf-agg-pnl-card" style="${hasRealTime?'':'display:none'}">
          <div class="agg-label">💡 سود/زیان لحظه‌ای</div><div class="agg-value" id="pf-agg-pnl">${totalUnrealizedPnl>=0?'+':''}${fmtFull(totalUnrealizedPnl)}</div>
        </div>
        <div class="agg-card ${totalRealizedPnl>0?'agg-profit':totalRealizedPnl<0?'agg-loss':''}">
          <div class="agg-label">✅ سود/زیان تحقق‌یافته کل <small style="font-weight:400;opacity:.7">(شامل جایزه و حق تقدم)</small></div>
          <div class="agg-value ${totalRealizedPnl>=0?'pnl-pos':'pnl-neg'}">${totalRealizedPnl!==0?(totalRealizedPnl>=0?'+':'')+fmtFull(totalRealizedPnl):'—'}</div>
        </div>
        <div class="agg-card agg-card-total">
          <div class="agg-label">🏦 جمع کل دارایی <small style="font-weight:400;opacity:.7">(فعال + غیرفعال + تحقق‌یافته)</small></div>
          <div class="agg-value agg-total-val" id="pf-total-assets">${fmtFull(totalAssets)}</div>
        </div>
      </div>
      <div class="pf-table-wrap"><table class="portfolio-table">
        <thead><tr>
          <th>نماد</th><th class="number-col">مانده (سهم)</th><th class="number-col">میانگین (ریال)</th>
          <th class="number-col">سرمایه (ریال)</th><th class="number-col">قیمت لحظه‌ای</th>
          <th class="number-col">ارزش لحظه‌ای (ریال)</th><th class="number-col">سود/زیان لحظه‌ای</th>
          <th class="number-col">سود تحقق‌یافته (ریال)</th>
        </tr></thead>
        <tbody>${activeRowsHtml}${finalizedRowsHtml}</tbody>
        <tfoot><tr class="pf-footer-row">
          <td>جمع کل</td><td></td><td></td>
          <td class="number-col" id="pf-total-invested">${fmtNum(totalInvested)}</td>
          <td></td>
          <td class="number-col" id="pf-total-cv">${hasRealTime?fmtNum(totalCurrentValue):'—'}</td>
          <td class="number-col ${hasRealTime?(totalUnrealizedPnl>=0?'pnl-pos':'pnl-neg'):''}" id="pf-total-pnl">
            ${hasRealTime?`${totalUnrealizedPnl>=0?'+':''}${fmtNum(totalUnrealizedPnl)}`:'—'}
          </td>
          <td class="number-col ${totalRealizedPnl>=0?'pnl-pos':'pnl-neg'}" id="pf-total-rpnl">${fmtNum(totalRealizedPnl)}</td>
        </tr></tfoot>
      </table></div>
    </div>`;
}

// ─── Welcome screen ───────────────────────────────────────────────────────────
function showWelcomeScreen() {
  if (state.currentStockId) { renderStockDetail(); return; }
  if (state.currentAccountId) {
    const stocks = state.data.stocks.filter(s=>s.accountId===state.currentAccountId&&!s.finalized);
    if (stocks.length>0) { renderPortfolioDashboard(); return; }
  }
  const detail = document.getElementById('stockDetail'); if (!detail) return;
  detail.innerHTML=`<div class="welcome-screen"><div class="welcome-icon">📊</div>
    <h2>به بورس‌کالک خوش آمدید</h2>
    <p>${state.currentAccountId?'از دکمه ＋ سهام جدید اضافه کنید':'ابتدا یک حساب ایجاد یا انتخاب کنید'}</p></div>`;
}

// ─── Bonus section renderer ───────────────────────────────────────────────────
function renderBonusSection(stock, sum) {
  const b = stock.bonusShares; const hasBon = b?.enabled && b.quantity>0;
  let entryHtml = '';
  if (hasBon && sum.bonus) {
    const bs=sum.bonus; const hasRT=sum.realTimePrice>0;
    const va=bs.valueAsProfit!=null?bs.valueAsProfit:0;
    entryHtml=`<div class="extra-entry">
      <div class="extra-entry-info">
        <span class="extra-qty-tag">${fmtNum(b.quantity)} سهم</span>
        <span class="extra-meta-tag">بهای تمام‌شده: <strong>${fmtRialShort(bs.costBasis)}</strong></span>
        <span class="extra-meta-tag dim">قیمت: همان سهم اصلی</span>
        <span id="detail-bonus-value" class="extra-pnl-tag ${va>=0?'pnl-pos':'pnl-neg'}" style="${hasRT?'':'display:none'}">
          ${hasRT?`ارزش: ${fmtRialShort(bs.currentValue)} | ${va>=0?'+':''}${fmtRialShort(va)}`:''}
        </span>
      </div>
      <div class="extra-entry-actions">
        <button class="btn btn-ghost btn-sm" onclick="editBonusShares('${stock.id}')">✏️ ویرایش</button>
        <button class="btn btn-ghost btn-sm" style="border-color:#FFCDD2;color:var(--sell)" onclick="deleteBonusShares('${stock.id}')">🗑 حذف</button>
        <button class="btn btn-warning btn-sm" onclick="sellBonusShares('${stock.id}')">💰 فروش</button>
      </div>
    </div>`;
  }
  return `<div class="extra-mgmt-section bonus-mgmt">
    <div class="extra-mgmt-header">
      <span class="extra-mgmt-title">🎁 سهام جایزه</span>
      ${!hasBon?`<button class="btn btn-ghost btn-sm" onclick="addBonusShares('${stock.id}')">＋ افزودن</button>`:''}
    </div>${entryHtml}</div>`;
}

// ─── Rights section renderer ──────────────────────────────────────────────────
function renderRightsSection(stock, sum) {
  const r = stock.rightShares; const hasR = r?.enabled && r.quantity>0;
  let entryHtml = '';
  if (hasR && sum.rights) {
    const rs=sum.rights;
    if (rs.sold) {
      const va=rs.valueAsProfit;
      entryHtml=`<div class="extra-entry">
        <div class="extra-entry-info">
          <span class="extra-qty-tag">${fmtNum(r.quantity)} سهم</span>
          <span class="extra-meta-tag">قیمت اولیه: ${fmtNum(rs.initialPrice)} ریال | بهای تمام‌شده: ${fmtRialShort(rs.costBasis)}</span>
          <span class="rights-sold-status">✅ فروخته | ${fmtNum(r.salePrice)} ریال/سهم | ${fmtRialShort(rs.saleAmount)}</span>
          <span class="extra-pnl-tag ${va>=0?'pnl-pos':'pnl-neg'}">سود: ${va>=0?'+':''}${fmtRialShort(va)}</span>
        </div>
        <div class="extra-entry-actions">
          <button class="btn btn-ghost btn-sm" onclick="editRightShares('${stock.id}')">✏️ ویرایش</button>
          <button class="btn btn-ghost btn-sm" style="border-color:#FFCDD2;color:var(--sell)" onclick="deleteRightShares('${stock.id}')">🗑 حذف</button>
          <button class="btn btn-ghost btn-sm" onclick="unsellRightShares('${stock.id}')">↩ لغو فروش</button>
        </div>
      </div>`;
    } else {
      entryHtml=`<div class="extra-entry">
        <div class="extra-entry-info">
          <span class="extra-qty-tag">${fmtNum(r.quantity)} سهم</span>
          <span class="extra-meta-tag">قیمت اولیه: ${fmtNum(rs.initialPrice)} ریال | بهای تمام‌شده: ${fmtRialShort(rs.costBasis)}</span>
        </div>
        <div class="rights-rt-block">
          <span class="rights-rt-badge">لحظه‌ای ح</span>
          <label class="rt-label">قیمت جاری ${escHtml(stock.symbol)}ح:</label>
          <input type="number" id="rtRightsInput" value="${r.realTimePrice||''}" placeholder="ریال"
                 oninput="updateRightsRealTimePrice('${stock.id}',this.value)">
          <span class="rt-unit">ریال</span>
          ${r.realTimePrice?`<button class="rt-clear-btn" onclick="clearRightsRealTimePrice('${stock.id}')">× پاک</button>`:''}
        </div>
        <div id="detail-rights-pnl"></div>
        <div class="extra-entry-actions">
          <button class="btn btn-ghost btn-sm" onclick="editRightShares('${stock.id}')">✏️ ویرایش</button>
          <button class="btn btn-ghost btn-sm" style="border-color:#FFCDD2;color:var(--sell)" onclick="deleteRightShares('${stock.id}')">🗑 حذف</button>
          <button class="btn btn-warning btn-sm" onclick="sellRightShares('${stock.id}')">💰 فروش</button>
        </div>
      </div>`;
    }
  }
  return `<div class="extra-mgmt-section rights-mgmt">
    <div class="extra-mgmt-header">
      <span class="extra-mgmt-title">📜 حق تقدم <span class="ha-badge">ح</span></span>
      ${!hasR?`<button class="btn btn-ghost btn-sm" onclick="addRightShares('${stock.id}')">＋ افزودن</button>`:''}
    </div>${entryHtml}</div>`;
}

// ─── Stock Detail ─────────────────────────────────────────────────────────────
function renderStockDetail() {
  const detail = document.getElementById('stockDetail');
  if (!detail||!state.currentStockId) { showWelcomeScreen(); return; }
  const stock = state.data.stocks.find(s=>s.id===state.currentStockId);
  if (!stock) { showWelcomeScreen(); return; }
  const {buys,sells} = getStockTransactions(stock.id);
  const sum = calculateSummary(stock.id);

  // Finalized banner
  let finalizedBanner='';
  if (stock.finalized) {
    const ip=sum.realizedProfit>=0; const s=ip?'+':'';
    const pct=sum.costOfSold>0?((sum.realizedProfit/sum.costOfSold)*100).toFixed(2):'0';
    finalizedBanner=`<div class="finalized-banner ${ip?'finalized-profit':'finalized-loss'}">
      <div class="finalized-top">
        <div>
          <span class="finalized-label">🏁 سهم فروخته‌شده</span>
          <span class="finalized-note">${sum.remainingQty>0?`⚠️ ${fmtNum(sum.remainingQty)} سهم باقی‌مانده`:'✅ تمام سهام فروخته شد'}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="reactivateStock('${stock.id}')">↩ بازگشت به فعال</button>
      </div>
      <div class="finalized-profit-grid">
        <div class="fp-item"><span class="fp-label">📈 جمع خرید</span><span class="fp-val">${fmtFull(sum.totalBuyAmount)}</span></div>
        <div class="fp-item"><span class="fp-label">📉 جمع فروش</span><span class="fp-val">${fmtFull(sum.totalSellAmount)}</span></div>
        <div class="fp-item"><span class="fp-label">⚖️ میانگین خرید</span><span class="fp-val">${fmtNum(sum.avgBuyPrice)} ریال/سهم</span></div>
        <div class="fp-item fp-highlight">
          <span class="fp-label">${ip?'🟢 سود خالص':'🔴 زیان خالص'}</span>
          <span class="fp-val ${ip?'pnl-pos':'pnl-neg'}">${s}${fmtFull(sum.realizedProfit)}</span>
          <span class="fp-pct">${s}${pct}٪ بازده</span>
        </div>
      </div>
      <div class="finalized-action-note">برای ثبت خرید جدید، سهم به حالت فعال برمی‌گردد</div>
    </div>`;
  }

  // Realized profit box (active only)
  let profitSection='';
  if (!stock.finalized && sum.totalSellQty>0) {
    const ip=sum.realizedProfit>=0;
    profitSection=`<div class="profit-result-box ${ip?'':'loss'}">
      <div class="profit-label">💡 سود/زیان تحقق‌یافته از معاملات</div>
      <div class="profit-amount ${ip?'profit-positive':'profit-negative'}">${ip?'+':''}${fmtFull(sum.realizedProfit)}</div>
      <div class="profit-sub">میانگین بهای تمام‌شده: ${fmtNum(sum.avgBuyPrice)} ریال | هزینه فروش‌رفته: ${fmtRialShort(sum.costOfSold)}</div>
    </div>`;
  }

  detail.innerHTML=`
    <div class="stock-detail-header">
      <div>
        <div class="symbol">📌 ${escHtml(stock.symbol)}
          <button class="btn-edit-symbol" onclick="editStock('${stock.id}')" title="ویرایش">✏️</button>
          ${stock.finalized?'<span class="sold-badge-header">فروخته‌شده</span>':''}
        </div>
        ${stock.name?`<div class="name">${escHtml(stock.name)}</div>`:''}
      </div>
      <div class="header-actions">
        ${!stock.finalized?`<button class="btn btn-warning" onclick="finalizeStock('${stock.id}')">🏁 اتمام فروش</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="deleteStock('${stock.id}')">🗑 حذف سهم</button>
      </div>
    </div>

    ${finalizedBanner}

    <div class="summary-grid">
      <div class="summary-card buy-card"><div class="card-label">📈 جمع خرید</div>
        <div class="card-value">${fmtNum(sum.totalBuyQty)} سهم</div><div class="card-sub">${fmtRialShort(sum.totalBuyAmount)}</div></div>
      <div class="summary-card sell-card"><div class="card-label">📉 جمع فروش</div>
        <div class="card-value">${fmtNum(sum.totalSellQty)} سهم</div><div class="card-sub">${fmtRialShort(sum.totalSellAmount)}</div></div>
      <div class="summary-card balance-card"><div class="card-label">💼 مانده سرمایه</div>
        <div class="card-value">${fmtNum(sum.remainingQty)} سهم</div><div class="card-sub">${fmtRialShort(sum.remainingInvestment)}</div></div>
      <div class="summary-card avg-card"><div class="card-label">⚖️ میانگین خرید</div>
        <div class="card-value">${fmtNum(sum.avgBuyPrice)}</div><div class="card-sub">ریال به ازای هر سهم</div></div>
    </div>

    ${!stock.finalized?`<div class="realtime-section">
      <div class="realtime-input-row">
        <span class="rt-badge">لحظه‌ای</span>
        <label class="rt-label">💹 قیمت جاری سهم:</label>
        <input type="number" id="rtPriceInput" value="${sum.realTimePrice||''}" placeholder="قیمت فعلی (ریال)"
               oninput="updateStockRealTimePrice('${stock.id}',this.value)">
        <span class="rt-unit">ریال</span>
        ${sum.realTimePrice?`<button class="rt-clear-btn" onclick="clearRealTimePrice('${stock.id}')">× پاک</button>`:''}
      </div>
      <div id="detail-rt-pnl"></div>
    </div>`:''}

    ${renderBonusSection(stock,sum)}
    ${renderRightsSection(stock,sum)}

    <div class="tab-container">
      <div class="tab-buttons">
        <button class="tab-btn buy-tab ${state.currentTab==='buy'?'active':''}" onclick="switchTab('buy')">📈 خرید</button>
        <button class="tab-btn sell-tab ${state.currentTab==='sell'?'active':''}" onclick="switchTab('sell')">📉 فروش</button>
      </div>
      <div id="transactionFormContainer" class="transaction-form">${buildTransactionForm()}</div>
    </div>

    <div class="transaction-section">
      <div class="section-header buy-header">📈 تاریخچه خریدها (${fmtNum(sum.totalBuyQty)} سهم)</div>
      ${renderTransactionTable(buys,'buy')}
      ${buys.length?`<div class="section-sub">جمع: <strong>${fmtNum(sum.totalBuyQty)}</strong> سهم | <strong>${fmtFull(sum.totalBuyAmount)}</strong></div>`:''}
    </div>
    <div class="transaction-section">
      <div class="section-header sell-header">📉 تاریخچه فروش‌ها (${fmtNum(sum.totalSellQty)} سهم)</div>
      ${renderTransactionTable(sells,'sell')}
      ${sells.length?`<div class="section-sub">جمع: <strong>${fmtNum(sum.totalSellQty)}</strong> سهم | <strong>${fmtFull(sum.totalSellAmount)}</strong></div>`:''}
    </div>

    ${profitSection}`;

  window._rowCounter=1;
  if (!stock.finalized && sum.realTimePrice>0&&sum.remainingQty>0) updateDetailPnlSection(sum);
  if (!stock.finalized && sum.bonus&&sum.realTimePrice>0) updateBonusPnlSection(sum);
  if (!stock.finalized && sum.rights&&!sum.rights.sold&&sum.rights.realTimePrice>0) updateRightsPnlSection(sum);
}

// ─── Transaction form helpers ─────────────────────────────────────────────────
function buildTransactionForm() {
  const isBuy=state.currentTab==='buy';
  return `<div class="form-date-row">
    <label>تاریخ ${isBuy?'خرید':'فروش'}:</label>
    <input type="text" id="txDate" placeholder="۱۴۰۴/۰۶/۲۳" value="${jalali.todayFormatted()}" style="width:130px">
    <span style="font-size:11px;color:#999">(شمسی)</span>
  </div>
  <div id="transactionRows" class="transaction-rows-container">${makeRowHtml(1)}</div>
  <button class="btn btn-ghost btn-sm" onclick="addTransactionRow()" style="margin-bottom:12px">➕ افزودن ردیف</button>
  <div class="form-actions">
    <button class="btn ${isBuy?'btn-success':'btn-danger'}" onclick="submitTransaction()">
      ${isBuy?'✅ ثبت خرید':'💰 ثبت فروش'}
    </button>
  </div>`;
}
function makeRowHtml(idx,qty,price) {
  const tot=(qty>0&&price>0)?qty*price:0;
  return `<div class="transaction-row" id="txRow_${idx}" data-idx="${idx}">
    <span class="row-num">${idx}</span>
    <input type="number" placeholder="تعداد" id="qty_${idx}" value="${qty||''}" oninput="calcRowTotal(${idx})" min="1" style="width:110px">
    <span class="row-label">سهم ×</span>
    <input type="number" placeholder="قیمت (ریال)" id="price_${idx}" value="${price||''}" oninput="calcRowTotal(${idx})" min="0" style="width:145px">
    <span class="equals">=</span>
    <span class="row-total ${tot>0?'has-value':''}" id="total_${idx}">${tot>0?fmtRialShort(tot):'—'}</span>
    ${idx>1?`<button style="color:var(--sell);background:none;border:none;cursor:pointer;font-size:20px;line-height:1;padding:0 4px" onclick="removeTransactionRow(${idx})">×</button>`:''}
  </div>`;
}
function addTransactionRow() {
  window._rowCounter=(window._rowCounter||1)+1;
  const container=document.getElementById('transactionRows'); if (!container) return;
  const tmp=document.createElement('div'); tmp.innerHTML=makeRowHtml(window._rowCounter,'','');
  container.appendChild(tmp.firstElementChild);
}
function removeTransactionRow(idx) { document.getElementById('txRow_'+idx)?.remove(); }
function calcRowTotal(idx) {
  const qty=parseFloat(document.getElementById('qty_'+idx)?.value)||0;
  const price=parseFloat(document.getElementById('price_'+idx)?.value)||0;
  const el=document.getElementById('total_'+idx); if (!el) return;
  if (qty>0&&price>0) { el.textContent=fmtRialShort(qty*price); el.classList.add('has-value'); }
  else { el.textContent='—'; el.classList.remove('has-value'); }
}
function switchTab(type) {
  state.currentTab=type;
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.classList.toggle('active',btn.classList.contains(type+'-tab')));
  const container=document.getElementById('transactionFormContainer');
  if (container) { container.innerHTML=buildTransactionForm(); window._rowCounter=1; }
}
function submitTransaction() {
  const date=document.getElementById('txDate')?.value.trim();
  if (!jalali.isValid(date)) { infoModal('⚠️ تاریخ نامعتبر','تاریخ معتبر شمسی وارد کنید (مثلاً ۱۴۰۴/۰۶/۲۳)'); return; }
  const rowEls=document.querySelectorAll('#transactionRows .transaction-row');
  const rows=[]; let allValid=true;
  rowEls.forEach(rowEl=>{
    const idx=rowEl.dataset.idx;
    const qty=parseFloat(document.getElementById('qty_'+idx)?.value);
    const price=parseFloat(document.getElementById('price_'+idx)?.value);
    if (isNaN(qty)||qty<=0||isNaN(price)||price<=0) allValid=false;
    else rows.push({quantity:qty,price,total:qty*price});
  });
  if (!allValid||rows.length===0) { infoModal('⚠️ اطلاعات ناقص','تعداد و قیمت همه ردیف‌ها را وارد کنید'); return; }
  const tx={
    id:storage.generateId(),stockId:state.currentStockId,type:state.currentTab,
    date,createdAt:new Date().toISOString(),rows,
    totalQuantity:rows.reduce((s,r)=>s+r.quantity,0),
    totalAmount:rows.reduce((s,r)=>s+r.total,0)
  };
  state.data.transactions.push(tx);
  if (tx.type==='buy') {
    const stock=state.data.stocks.find(s=>s.id===state.currentStockId);
    if (stock?.finalized) {
      stock.finalized=false;
      state.stockFilter='active';
    }
  }
  storage.save(state.data); renderStockList(); renderStockDetail();
}

// ─── Delete transaction ───────────────────────────────────────────────────────
function deleteTransaction(txId) {
  const tx=state.data.transactions.find(t=>t.id===txId); if (!tx) return;
  const typeLabel=tx.type==='buy'?'خرید':'فروش';
  showModal(`🗑 حذف ${typeLabel}`,
    `<span>حذف معامله تاریخ <strong>${escHtml(tx.date)}</strong> (${fmtNum(tx.totalQuantity)} سهم — ${fmtRialShort(tx.totalAmount)})؟</span>`,
    [{label:'حذف',cls:'btn-danger',action:()=>{
      state.data.transactions=state.data.transactions.filter(t=>t.id!==txId);
      storage.save(state.data); renderStockDetail();
    }},{label:'انصراف',cls:'btn-ghost'}]);
}

// ─── Transaction table ────────────────────────────────────────────────────────
function renderTransactionTable(transactions, type) {
  if (!transactions.length) return `<p class="empty-state" style="padding:20px">${type==='buy'?'خریدی ثبت نشده':'فروشی ثبت نشده'}</p>`;
  let html=`<div style="overflow-x:auto"><table class="transaction-table"><thead><tr>
    <th>تاریخ شمسی</th><th class="number-col">تعداد</th><th class="number-col">قیمت هر سهم (ریال)</th>
    <th class="number-col">مبلغ کل (ریال)</th><th class="tx-actions-col"></th>
  </tr></thead><tbody>`;
  transactions.forEach(tx=>{
    tx.rows.forEach((row,i)=>{
      html+=`<tr><td>${i===0?`<div class="tx-date-cell"><span>${escHtml(tx.date)}</span>
        <button class="tx-edit-btn" onclick="editTransaction('${tx.id}')" title="ویرایش">✏️</button>
        <button class="tx-delete-btn" onclick="deleteTransaction('${tx.id}')" title="حذف">🗑</button>
      </div>`:''}</td>
      <td class="number-col">${fmtNum(row.quantity)}</td>
      <td class="number-col">${fmtNum(row.price)}</td>
      <td class="number-col">${fmtNum(row.total)}</td>
      <td class="tx-actions-col"></td></tr>`;
    });
    if (tx.rows.length>1) {
      html+=`<tr style="background:#F8F8F8;font-style:italic">
        <td style="font-size:11px;color:#999">↑ جمع این گروه</td>
        <td class="number-col" style="font-weight:700">${fmtNum(tx.totalQuantity)}</td>
        <td></td><td class="number-col" style="font-weight:700">${fmtNum(tx.totalAmount)}</td><td></td></tr>`;
    }
  });
  const totQty=transactions.reduce((s,t)=>s+t.totalQuantity,0);
  const totAmt=transactions.reduce((s,t)=>s+t.totalAmount,0);
  html+=`</tbody><tfoot><tr class="${type==='buy'?'buy-total-row':'sell-total-row'}">
    <td>جمع کل</td><td class="number-col">${fmtNum(totQty)} سهم</td>
    <td></td><td class="number-col">${fmtNum(totAmt)}</td><td></td>
  </tr></tfoot></table></div>`;
  return html;
}

// ─── Edit transaction ─────────────────────────────────────────────────────────
function makeEditRowHtml(idx,qty,price) {
  const tot=(qty>0&&price>0)?qty*price:0;
  return `<div class="transaction-row edit-tx-row" id="etxrow_${idx}" data-idx="${idx}">
    <span class="row-num">${idx}</span>
    <input type="number" placeholder="تعداد" id="eqty_${idx}" value="${qty||''}" oninput="calcEditRowTotal(${idx})" min="1" style="width:110px">
    <span class="row-label">سهم ×</span>
    <input type="number" placeholder="قیمت (ریال)" id="eprice_${idx}" value="${price||''}" oninput="calcEditRowTotal(${idx})" min="0" style="width:145px">
    <span class="equals">=</span>
    <span class="row-total ${tot>0?'has-value':''}" id="etotal_${idx}">${tot>0?fmtRialShort(tot):'—'}</span>
    ${idx>1?`<button style="color:var(--sell);background:none;border:none;cursor:pointer;font-size:20px;line-height:1;padding:0 4px" onclick="removeEditTxRow(${idx})">×</button>`:''}
  </div>`;
}
function calcEditRowTotal(idx) {
  const qty=parseFloat(document.getElementById('eqty_'+idx)?.value)||0;
  const price=parseFloat(document.getElementById('eprice_'+idx)?.value)||0;
  const el=document.getElementById('etotal_'+idx); if (!el) return;
  if (qty>0&&price>0) { el.textContent=fmtRialShort(qty*price); el.classList.add('has-value'); }
  else { el.textContent='—'; el.classList.remove('has-value'); }
}
function addEditTxRow() {
  window._editTxRowCount=(window._editTxRowCount||1)+1;
  const container=document.getElementById('editTxRows'); if (!container) return;
  const tmp=document.createElement('div'); tmp.innerHTML=makeEditRowHtml(window._editTxRowCount,'','');
  container.appendChild(tmp.firstElementChild);
}
function removeEditTxRow(idx) { document.getElementById('etxrow_'+idx)?.remove(); }
function editTransaction(txId) {
  const tx=state.data.transactions.find(t=>t.id===txId); if (!tx) return;
  const typeLabel=tx.type==='buy'?'خرید':'فروش';
  window._editTxRowCount=tx.rows.length;
  const rowsHtml=tx.rows.map((row,i)=>makeEditRowHtml(i+1,row.quantity,row.price)).join('');
  formModal(`✏️ ویرایش ${typeLabel}`,
    `<div class="modal-form-group"><div class="form-date-row" style="margin-bottom:0">
       <label>تاریخ ${typeLabel}:</label>
       <input type="text" id="editTxDate" value="${escHtml(tx.date)}" style="width:130px">
       <span style="font-size:11px;color:#999">(شمسی)</span>
     </div></div>
     <div class="modal-form-group">
       <div id="editTxRows" class="transaction-rows-container">${rowsHtml}</div>
       <button class="btn btn-ghost btn-sm" onclick="addEditTxRow()" style="margin-top:6px">➕ افزودن ردیف</button>
     </div>`,
    'ذخیره تغییرات', ()=>saveEditTransaction(txId));
}
function saveEditTransaction(txId) {
  const dateEl=document.getElementById('editTxDate');
  const date=dateEl?.value.trim();
  if (!jalali.isValid(date)) {
    if (dateEl) { dateEl.classList.add('input-error'); dateEl.addEventListener('input',()=>dateEl.classList.remove('input-error'),{once:true}); } return;
  }
  const rowEls=document.querySelectorAll('#editTxRows .edit-tx-row');
  const rows=[]; let allValid=true;
  rowEls.forEach(rowEl=>{
    const idx=rowEl.dataset.idx;
    const qty=parseFloat(document.getElementById('eqty_'+idx)?.value);
    const price=parseFloat(document.getElementById('eprice_'+idx)?.value);
    if (isNaN(qty)||qty<=0||isNaN(price)||price<=0) allValid=false;
    else rows.push({quantity:qty,price,total:qty*price});
  });
  if (!allValid||rows.length===0) return;
  const tx=state.data.transactions.find(t=>t.id===txId);
  if (tx) {
    tx.date=date; tx.rows=rows;
    tx.totalQuantity=rows.reduce((s,r)=>s+r.quantity,0);
    tx.totalAmount=rows.reduce((s,r)=>s+r.total,0);
    storage.save(state.data);
  }
  hideModal(); renderStockDetail();
}

// ─── Inactive Capital ─────────────────────────────────────────────────────────
function updateInactiveCapital(accountId, value) {
  const account = state.data.accounts.find(a=>a.id===accountId); if (!account) return;
  account.inactiveCapital = parseFloat(value)||0;
  storage.save(state.data);
  // update total-assets card without full re-render
  const ic = account.inactiveCapital;
  const stocks = state.data.stocks.filter(s=>s.accountId===accountId);
  const active = stocks.filter(s=>!s.finalized);
  const totalInvested = active.reduce((acc,s)=>acc+calculateSummary(s.id).remainingInvestment,0);
  const totalRpnl = stocks.reduce((acc,s)=>acc+calculateSummary(s.id).totalRealizedProfit,0);
  const totalAssets = totalInvested + ic + totalRpnl;
  const el = document.getElementById('pf-total-assets');
  if (el) el.textContent = fmtFull(totalAssets);
  const icVal = document.getElementById('pf-agg-ic-val');
  if (icVal) icVal.textContent = fmtFull(ic);
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────
function exportBackup() { storage.exportToFile(state.data); }
function importBackup(event) {
  const file=event.target.files[0]; if (!file) return;
  storage.importFromFile(file)
    .then(data=>{
      state.data=data; state.currentAccountId=null; state.currentStockId=null;
      renderAccountList(); renderStockList(); showWelcomeScreen();
      const addBtn=document.getElementById('addStockBtn'); if (addBtn) addBtn.disabled=true;
      infoModal('✅ موفق','داده‌ها با موفقیت بازیابی شد');
    })
    .catch(err=>infoModal('❌ خطا در بازیابی',err.message));
  event.target.value='';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  state.data=storage.load();
  state.data.accounts.forEach(a=>{
    if (a.inactiveCapital===undefined) a.inactiveCapital=0;
  });
  state.data.stocks.forEach(s=>{
    if (s.finalized===undefined) s.finalized=false;
    if (!s.bonusShares) s.bonusShares={enabled:false,quantity:0,initialAmount:null};
    if (!s.rightShares) s.rightShares={enabled:false,quantity:0,initialPrice:0,initialAmount:null,realTimePrice:null,sold:false,salePrice:null,saleAmount:null};
    else {
      if (s.rightShares.sold===undefined) s.rightShares.sold=false;
      if (s.rightShares.salePrice===undefined) s.rightShares.salePrice=null;
      if (s.rightShares.saleAmount===undefined) s.rightShares.saleAmount=null;
    }
  });
  renderAccountList();
  if (state.data.accounts.length>0) switchAccount(state.data.accounts[0].id);
  else {
    renderStockList(); showWelcomeScreen();
    const addBtn=document.getElementById('addStockBtn'); if (addBtn) addBtn.disabled=true;
  }
}

Object.assign(window,{
  init,createAccount,switchAccount,deleteCurrentAccount,
  createStock,editStock,selectStock,deleteStock,setStockFilter,finalizeStock,reactivateStock,
  showPortfolio,
  addBonusShares,editBonusShares,deleteBonusShares,sellBonusShares,
  addRightShares,editRightShares,deleteRightShares,sellRightShares,unsellRightShares,
  switchTab,addTransactionRow,removeTransactionRow,calcRowTotal,submitTransaction,
  editTransaction,saveEditTransaction,deleteTransaction,
  addEditTxRow,removeEditTxRow,calcEditRowTotal,
  updateStockRealTimePrice,clearRealTimePrice,updateRightsRealTimePrice,clearRightsRealTimePrice,
  exportBackup,importBackup,hideModal,
  updateInactiveCapital
});

document.addEventListener('DOMContentLoaded',init);
