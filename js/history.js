'use strict';

let hData = null;
let hAccountId = null;

// ── Modal ──────────────────────────────────────────────────────────────────────
function hideModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

function showConfirm(title, msg, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').innerHTML = msg;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = '';
  ['حذف|btn-danger|onConfirm', 'انصراف|btn-ghost|hideModal'].forEach(spec => {
    const [label, cls, fn] = spec.split('|');
    const btn = document.createElement('button');
    btn.textContent = label; btn.className = 'btn ' + cls;
    btn.onclick = fn === 'onConfirm' ? () => { hideModal(); onConfirm(); } : hideModal;
    footer.appendChild(btn);
  });
  document.getElementById('modalOverlay').style.display = 'flex';
}

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtN(n) {
  if (n === null || n === undefined || isNaN(n)) return '۰';
  return Math.round(n).toLocaleString('fa-IR');
}

function fmtChartVal(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(1)  + 'B';
  if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(1)  + 'M';
  if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(0)  + 'K';
  return String(Math.round(n));
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  hData = storage.load();
  populateAccounts();
  const saved = localStorage.getItem('lastHistAccountId');
  const first = hData.accounts[0]?.id;
  const target = (saved && hData.accounts.find(a => a.id === saved)) ? saved : first;
  if (target) {
    document.getElementById('histAccountSelect').value = target;
    onAccountChange(target);
  } else {
    renderHistory();
  }
}

function populateAccounts() {
  const sel = document.getElementById('histAccountSelect');
  sel.innerHTML = '<option value="">انتخاب حساب...</option>';
  hData.accounts.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.name;
    sel.appendChild(opt);
  });
}

function onAccountChange(id) {
  hAccountId = id || null;
  if (id) localStorage.setItem('lastHistAccountId', id);
  renderHistory();
}

// ── Main renderer ─────────────────────────────────────────────────────────────
function renderHistory() {
  const emptyEl  = document.getElementById('histEmpty');
  const chartsEl = document.getElementById('histCharts');
  const tableEl  = document.getElementById('histTableSection');
  const countEl  = document.getElementById('histSnapshotCount');

  if (!hAccountId) {
    emptyEl.style.display = 'block';
    chartsEl.style.display = 'none';
    tableEl.style.display = 'none';
    countEl.textContent = '';
    return;
  }

  const all = (hData.snapshots || [])
    .filter(s => s.accountId === hAccountId)
    .sort((a, b) => a.date < b.date ? -1 : 1);

  countEl.textContent = all.length.toLocaleString('fa-IR') + ' روز ذخیره‌شده';

  if (all.length === 0) {
    emptyEl.style.display = 'block';
    chartsEl.style.display = 'none';
    tableEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  chartsEl.style.display = 'block';
  tableEl.style.display = 'block';

  document.getElementById('histChart').innerHTML = all.length >= 2
    ? buildCombinedChart(all)
    : '<div class="chart-no-data">حداقل ۲ روز داده برای نمودار نیاز است</div>';

  renderTable(all);
}

// ── Single panel bar chart ─────────────────────────────────────────────────────
function _panelBar(points, colorPos, colorNeg) {
  const W = 340, H = 165;
  const pad = { t: 20, r: 12, b: 38, l: 66 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

  const yVals = points.map(p => p.y).filter(v => v != null);
  if (!yVals.length) return '<div class="chart-no-data" style="min-height:100px">داده‌ای موجود نیست</div>';

  const n = points.length;
  const hasNeg = yVals.some(v => v < 0);
  let yMin = hasNeg ? Math.min(...yVals) : 0;
  let yMax = Math.max(...yVals, 0);
  if (yMin === yMax) { const d = Math.abs(yMax) * 0.15 || 100000; yMin -= d; yMax += d; }
  const span = yMax - yMin;
  const yLo = yMin - span * (hasNeg ? 0.08 : 0);
  const yHi = yMax + span * 0.14;

  const sy = v => pad.t + cH * (1 - (v - yLo) / (yHi - yLo));
  const bW = Math.max(4, Math.min(26, cW / n - 2));
  const bx = i => pad.l + i * cW / n + (cW / n - bW) / 2;
  const z0 = sy(0);

  const grid = Array.from({length: 5}, (_, i) => {
    const v = yLo + i / 4 * (yHi - yLo), y = sy(v);
    return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W-pad.r}" y2="${y.toFixed(1)}" stroke="#EEEEEE" stroke-width="1"/>
<text x="${pad.l-4}" y="${(y+3.5).toFixed(1)}" text-anchor="end" font-size="8.5" fill="#9E9E9E">${fmtChartVal(v)}</text>`;
  }).join('');

  const zLine = hasNeg
    ? `<line x1="${pad.l}" y1="${z0.toFixed(1)}" x2="${W-pad.r}" y2="${z0.toFixed(1)}" stroke="#BDBDBD" stroke-width="1.5"/>`
    : '';

  const bars = points.map((p, i) => {
    if (p.y == null) return '';
    const c = p.y < 0 ? colorNeg : colorPos;
    const top = p.y >= 0 ? sy(p.y) : z0, bot = p.y >= 0 ? z0 : sy(p.y);
    return `<rect x="${bx(i).toFixed(1)}" y="${top.toFixed(1)}" width="${bW}" height="${Math.max(2, bot - top).toFixed(1)}" fill="${c}" rx="1"/>`;
  }).join('');

  const step = Math.max(1, Math.ceil(n / 7));
  const xLbls = points.map((p, i) => {
    if (i !== 0 && i !== n - 1 && i % step !== 0) return '';
    return `<text x="${(bx(i)+bW/2).toFixed(1)}" y="${H-pad.b+11}" text-anchor="middle" font-size="8.5" fill="#757575">${p.x.slice(-5)}</text>`;
  }).join('');

  const last = [...points].reverse().find(p => p.y != null);
  const lastLbl = last
    ? `<text x="${(W-pad.r-1).toFixed(1)}" y="${(sy(last.y)-5).toFixed(1)}" text-anchor="end" font-size="9" fill="${last.y < 0 ? colorNeg : colorPos}" font-weight="bold">${fmtChartVal(last.y)}</text>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  ${grid}${zLine}
  <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}" stroke="#D0D0D0" stroke-width="1"/>
  <line x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}" stroke="#D0D0D0" stroke-width="1"/>
  ${bars}${lastLbl}${xLbls}
</svg>`;
}

// ── 2×2 combined chart ─────────────────────────────────────────────────────────
function buildCombinedChart(snapshots) {
  const n = snapshots.length;
  if (!n) return '<div class="chart-no-data">داده‌ای موجود نیست</div>';

  const assetPts  = snapshots.map(s => ({ x: s.date, y: s.totalAssets }));
  const changePts = snapshots.map((s, i) => ({
    x: s.date,
    y: i > 0 ? s.totalAssets - snapshots[i-1].totalAssets : null
  }));
  const realPts   = snapshots.map(s => ({ x: s.date, y: s.realizedPnl }));
  const unrealPts = snapshots.map(s => ({
    x: s.date,
    y: s.hasRealTime && s.unrealizedPnl != null ? s.unrealizedPnl : null
  }));
  const hasUnreal = unrealPts.some(p => p.y != null);
  const noData = '<div class="chart-no-data" style="min-height:100px">داده‌ای موجود نیست</div>';

  return `<div class="hist-chart-grid">
    <div class="hist-chart-panel">
      <div class="hist-panel-title">💰 جمع کل دارایی <span class="chart-unit">(ریال)</span></div>
      ${_panelBar(assetPts, '#1565C0', '#C62828')}
    </div>
    <div class="hist-chart-panel">
      <div class="hist-panel-title">📊 تغییر روزانه دارایی <span class="chart-unit">(ریال)</span></div>
      ${n >= 2 ? _panelBar(changePts, '#2E7D32', '#C62828') : noData}
    </div>
    <div class="hist-chart-panel">
      <div class="hist-panel-title">✅ سود تحقق‌یافته <span class="chart-unit">(ریال)</span></div>
      ${_panelBar(realPts, '#2E7D32', '#C62828')}
    </div>
    <div class="hist-chart-panel">
      <div class="hist-panel-title">⚡ سود/زیان لحظه‌ای <span class="chart-unit">(ریال)</span></div>
      ${hasUnreal ? _panelBar(unrealPts, '#E65100', '#C62828') : noData}
    </div>
  </div>`;
}

// ── Table renderer ─────────────────────────────────────────────────────────────
function renderTable(snapshots) {
  const reversed = [...snapshots].reverse(); // newest first

  const rows = reversed.map((s, ri) => {
    const prev = reversed[ri + 1]; // older snapshot

    const assetsDiff = prev != null ? s.totalAssets - prev.totalAssets : null;
    const assetsPct  = (prev != null && prev.totalAssets) ? assetsDiff / Math.abs(prev.totalAssets) * 100 : null;
    const realDiff   = prev != null ? s.realizedPnl - prev.realizedPnl : null;
    const prevUnreal = (prev != null && prev.hasRealTime && prev.unrealizedPnl != null) ? prev.unrealizedPnl : null;
    const unrealDiff = (s.hasRealTime && s.unrealizedPnl != null && prevUnreal != null) ? s.unrealizedPnl - prevUnreal : null;
    const nd         = s.netDeployed ?? s.totalInvested;
    const unrealPct  = (s.hasRealTime && s.unrealizedPnl != null && nd > 0) ? s.unrealizedPnl / nd * 100 : null;

    const changeBadge = assetsPct !== null
      ? `<span class="${assetsPct >= 0 ? 'pnl-pos' : 'pnl-neg'}" style="font-size:11px;display:block;margin-top:3px">
           ${assetsPct >= 0 ? '▲' : '▼'} ${Math.abs(assetsPct).toFixed(2)}٪
         </span>`
      : '';

    const realChangeBadge = realDiff !== null
      ? `<span class="${realDiff >= 0 ? 'pnl-pos' : 'pnl-neg'}" style="font-size:11px;display:block;margin-top:3px">
           ${realDiff >= 0 ? '+' : ''}${fmtN(realDiff)}
         </span>`
      : '';

    const unrealCell = s.hasRealTime && s.unrealizedPnl !== null
      ? `<span class="${s.unrealizedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${s.unrealizedPnl >= 0 ? '+' : ''}${fmtN(s.unrealizedPnl)}</span>
         ${unrealDiff !== null ? `<span class="${unrealDiff >= 0 ? 'pnl-pos' : 'pnl-neg'}" style="font-size:11px;display:block;margin-top:3px">${unrealDiff >= 0 ? '+' : ''}${fmtN(unrealDiff)}</span>` : ''}`
      : '<span class="dim">—</span>';

    const unrealPctCell = unrealPct !== null
      ? `<span class="${unrealPct >= 0 ? 'pnl-pos' : 'pnl-neg'}" style="font-weight:700">${unrealPct >= 0 ? '+' : ''}${unrealPct.toFixed(2)}٪</span>`
      : '<span class="dim">—</span>';

    return `<tr>
      <td><strong style="font-size:13px">${s.date}</strong></td>
      <td class="number-col">
        <div>${fmtN(s.totalAssets)}</div>${changeBadge}
      </td>
      <td class="number-col">
        <div class="${s.realizedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${s.realizedPnl >= 0 ? '+' : ''}${fmtN(s.realizedPnl)}</div>
        ${realChangeBadge}
      </td>
      <td class="number-col">${fmtN(nd)}</td>
      <td class="number-col">${unrealCell}</td>
      <td class="number-col">${unrealPctCell}</td>
      <td>
        <button class="btn btn-ghost btn-sm" style="border-color:#FFCDD2;color:#C62828;padding:4px 9px"
                onclick="deleteSnapshot('${s.id}','${s.date}')">🗑</button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('histTable').innerHTML = `
    <thead>
      <tr>
        <th>تاریخ</th>
        <th class="number-col">جمع دارایی (ریال)<br><small style="font-weight:400;opacity:.75">± تغییر روز</small></th>
        <th class="number-col">سود تحقق‌یافته (ریال)<br><small style="font-weight:400;opacity:.75">± تغییر</small></th>
        <th class="number-col">سرمایه خالص در گردش</th>
        <th class="number-col">سود/زیان لحظه‌ای<br><small style="font-weight:400;opacity:.75">± تغییر روز</small></th>
        <th class="number-col">بازده لحظه‌ای<br><small style="font-weight:400;opacity:.75">% از سرمایه در گردش</small></th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

// ── Delete ─────────────────────────────────────────────────────────────────────
function deleteSnapshot(id, date) {
  showConfirm('🗑 حذف وضعیت',
    `<span>وضعیت تاریخ <strong>${date}</strong> حذف شود؟</span>`,
    () => {
      hData.snapshots = (hData.snapshots || []).filter(s => s.id !== id);
      storage.save(hData);
      renderHistory();
    });
}

Object.assign(window, { onAccountChange, deleteSnapshot, hideModal });

document.addEventListener('DOMContentLoaded', init);
