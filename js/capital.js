'use strict';

let capData = null;
let capAccountId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtN(n) {
  if (n===null||n===undefined||isNaN(n)) return '۰';
  return Math.round(n).toLocaleString('fa-IR');
}
function getCapBalance(account) {
  return (account.capitalTransactions||[]).reduce((s,t)=>t.type==='deposit'?s+t.amount:s-t.amount, 0);
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function hideModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}
function showConfirm(title, msg, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = msg;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = '';
  [['تأیید','btn-danger',()=>{hideModal();onConfirm();}],['انصراف','btn-ghost',hideModal]].forEach(([label,cls,fn])=>{
    const btn = document.createElement('button');
    btn.textContent = label; btn.className = 'btn '+cls; btn.onclick = fn;
    footer.appendChild(btn);
  });
  document.getElementById('modalOverlay').style.display = 'flex';
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  capData = storage.load();
  populateAccounts();
  const saved = localStorage.getItem('lastCapAccountId');
  const first = capData.accounts[0]?.id;
  const target = (saved && capData.accounts.find(a=>a.id===saved)) ? saved : first;
  if (target) {
    document.getElementById('capAccountSelect').value = target;
    onAccountChange(target);
  } else {
    renderCapital();
  }
}

function populateAccounts() {
  const sel = document.getElementById('capAccountSelect');
  sel.innerHTML = '<option value="">انتخاب حساب...</option>';
  capData.accounts.forEach(a=>{
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.name;
    sel.appendChild(opt);
  });
}

function onAccountChange(id) {
  capAccountId = id || null;
  if (id) localStorage.setItem('lastCapAccountId', id);
  renderCapital();
}

// ── Render ─────────────────────────────────────────────────────────────────────
function renderCapital() {
  const account = capData.accounts.find(a=>a.id===capAccountId);

  document.getElementById('capEmptyAccount').style.display = account ? 'none' : 'block';
  document.getElementById('capContent').style.display       = account ? 'block' : 'none';
  if (!account) return;

  const txs     = account.capitalTransactions || [];
  const balance = getCapBalance(account);

  const balEl = document.getElementById('capBalance');
  balEl.textContent = fmtN(balance);
  balEl.className   = 'cap-balance-value' + (balance < 0 ? ' cap-neg' : '');

  document.getElementById('capEmptyTx').style.display   = txs.length === 0 ? 'block' : 'none';
  document.getElementById('capTableWrap').style.display = txs.length === 0 ? 'none'  : 'block';
  if (txs.length === 0) return;

  // Sort oldest → newest, compute running balance, then display newest first
  const sorted = [...txs].sort((a,b)=>{
    if (!a.date && !b.date) return 0;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date < b.date ? -1 : 1;
  });
  let running = 0;
  const withBal = sorted.map(t=>{
    running = t.type==='deposit' ? running+t.amount : running-t.amount;
    return {...t, runningBalance: running};
  });

  const rows = [...withBal].reverse().map(t=>{
    const dep  = t.type==='deposit';
    const sign = dep ? '+' : '−';
    return `<tr>
      <td>${t.date || '<span class="dim">—</span>'}</td>
      <td><span class="${dep?'cap-tx-deposit':'cap-tx-withdrawal'}">${dep?'واریز':'برداشت'}</span></td>
      <td>${escHtml(t.description)}</td>
      <td class="number-col ${dep?'cap-tx-deposit':'cap-tx-withdrawal'}">${sign}${fmtN(t.amount)}</td>
      <td class="number-col${t.runningBalance<0?' cap-tx-withdrawal':''}">${fmtN(t.runningBalance)}</td>
      <td><button class="btn btn-ghost btn-sm" style="border-color:#FFCDD2;color:#C62828;padding:4px 9px"
              onclick="deleteTransaction('${t.id}')">🗑</button></td>
    </tr>`;
  }).join('');

  document.getElementById('capTable').innerHTML = `
    <thead><tr>
      <th>تاریخ</th>
      <th>نوع</th>
      <th>شرح</th>
      <th class="number-col">مبلغ (ریال)</th>
      <th class="number-col">موجودی (ریال)</th>
      <th></th>
    </tr></thead>
    <tbody>${rows}</tbody>`;
}

// ── Add transaction ────────────────────────────────────────────────────────────
function showAddModal(type) {
  const account = capData.accounts.find(a=>a.id===capAccountId);
  if (!account) return;
  const dep = type === 'deposit';
  document.getElementById('modalTitle').textContent = dep ? '➕ ثبت واریز' : '➖ ثبت برداشت';
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-form-group">
      <div class="form-date-row">
        <label>تاریخ:</label>
        <input type="text" id="capTxDate" value="${jalali.todayFormatted()}" style="width:130px">
        <span style="font-size:11px;color:#999">(شمسی)</span>
      </div>
    </div>
    <div class="modal-form-group">
      <label>مبلغ (ریال):</label>
      <input type="number" id="capTxAmount" placeholder="۰" min="1" style="width:100%;margin-top:6px">
    </div>
    <div class="modal-form-group">
      <label>شرح <span style="color:var(--sell)">*</span>:</label>
      <input type="text" id="capTxDesc" placeholder="توضیح تراکنش را بنویسید..." style="width:100%;margin-top:6px">
    </div>`;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = '';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'ذخیره'; saveBtn.className = dep ? 'btn btn-success' : 'btn btn-danger';
  saveBtn.onclick = ()=>saveTransaction(type);
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'انصراف'; cancelBtn.className = 'btn btn-ghost';
  cancelBtn.onclick = hideModal;
  footer.appendChild(saveBtn); footer.appendChild(cancelBtn);
  document.getElementById('modalOverlay').style.display = 'flex';
  setTimeout(()=>document.getElementById('capTxAmount')?.focus(), 60);
}

function saveTransaction(type) {
  const account = capData.accounts.find(a=>a.id===capAccountId); if (!account) return;
  const dateEl   = document.getElementById('capTxDate');
  const amountEl = document.getElementById('capTxAmount');
  const descEl   = document.getElementById('capTxDesc');
  const date        = dateEl?.value.trim();
  const amount      = parseFloat(amountEl?.value);
  const description = descEl?.value.trim();
  let valid = true;
  if (!jalali.isValid(date))      { dateEl?.classList.add('input-error');   dateEl?.addEventListener('input',()=>dateEl.classList.remove('input-error'),{once:true});   valid=false; }
  if (!amount || amount <= 0)     { amountEl?.classList.add('input-error'); amountEl?.addEventListener('input',()=>amountEl.classList.remove('input-error'),{once:true}); valid=false; }
  if (!description)               { descEl?.classList.add('input-error');   descEl?.addEventListener('input',()=>descEl.classList.remove('input-error'),{once:true});   valid=false; }
  if (!valid) return;
  account.capitalTransactions = account.capitalTransactions || [];
  account.capitalTransactions.push({ id: storage.generateId(), date, type, amount, description });
  storage.save(capData);
  hideModal();
  renderCapital();
}

// ── Delete ─────────────────────────────────────────────────────────────────────
function deleteTransaction(txId) {
  const account = capData.accounts.find(a=>a.id===capAccountId); if (!account) return;
  const tx = (account.capitalTransactions||[]).find(t=>t.id===txId); if (!tx) return;
  const dep = tx.type === 'deposit';
  showConfirm(`🗑 حذف ${dep?'واریز':'برداشت'}`,
    `<span>تراکنش <strong>${escHtml(tx.description)}</strong> (${fmtN(tx.amount)} ریال) حذف شود؟</span>`,
    ()=>{
      account.capitalTransactions = account.capitalTransactions.filter(t=>t.id!==txId);
      storage.save(capData);
      renderCapital();
    });
}

Object.assign(window, { onAccountChange, showAddModal, deleteTransaction, hideModal });
document.addEventListener('DOMContentLoaded', init);
