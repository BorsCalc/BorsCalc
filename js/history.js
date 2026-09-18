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

  const assetsPoints   = all.map(s => ({ x: s.date, y: s.totalAssets }));
  const realizedPoints = all.map(s => ({ x: s.date, y: s.realizedPnl }));
  const changePoints   = all.slice(1).map((s, i) => {
    const prev = all[i];
    if (!prev.totalAssets) return null;
    return { x: s.date, y: (s.totalAssets - prev.totalAssets) / Math.abs(prev.totalAssets) * 100 };
  }).filter(Boolean);

  const lastReal = realizedPoints[realizedPoints.length - 1]?.y ?? 0;

  document.getElementById('chartAssets').innerHTML   = buildLineChart(assetsPoints, '#1565C0');
  document.getElementById('chartRealized').innerHTML  = buildLineChart(realizedPoints, lastReal >= 0 ? '#2E7D32' : '#C62828');
  document.getElementById('chartChange').innerHTML   = changePoints.length
    ? buildBarChart(changePoints)
    : '<div class="chart-no-data">حداقل ۲ روز داده نیاز است</div>';

  renderTable(all);
}

// ── SVG Line Chart ─────────────────────────────────────────────────────────────
function buildLineChart(points, color) {
  const n = points.length;
  if (n === 0) return '<div class="chart-no-data">داده‌ای موجود نیست</div>';

  const W = 700, H = 200;
  const pad = { t: 22, r: 24, b: 46, l: 72 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;

  const yVals = points.map(p => p.y);
  let yMin = Math.min(...yVals), yMax = Math.max(...yVals);
  if (yMin === yMax) {
    const d = Math.abs(yMin) * 0.1 || 100000;
    yMin -= d; yMax += d;
  }
  const ySpan = yMax - yMin;
  const yLo = yMin - ySpan * 0.12;
  const yHi = yMax + ySpan * 0.12;

  const sx = i  => pad.l + (n > 1 ? i * cW / (n - 1) : cW / 2);
  const sy = v  => pad.t + cH * (1 - (v - yLo) / (yHi - yLo));

  // Y grid lines + labels (6 ticks)
  const grid = Array.from({ length: 6 }, (_, i) => {
    const v = yLo + (i / 5) * (yHi - yLo);
    const y = sy(v).toFixed(1);
    return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#EEEEEE" stroke-width="1"/>
<text x="${pad.l - 5}" y="${(+y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#9E9E9E">${fmtChartVal(v)}</text>`;
  }).join('');

  // Dashed zero line when range crosses zero
  const zeroLine = yLo < 0 && yHi > 0
    ? `<line x1="${pad.l}" y1="${sy(0).toFixed(1)}" x2="${W - pad.r}" y2="${sy(0).toFixed(1)}" stroke="#BDBDBD" stroke-width="1.5" stroke-dasharray="4,3"/>`
    : '';

  // Area fill (above baseline)
  const baseY = sy(Math.max(yLo, 0)).toFixed(1);
  const area = n > 1
    ? `<path d="M${sx(0).toFixed(1)},${sy(points[0].y).toFixed(1)} ` +
      points.map((p, i) => `L${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ') +
      ` L${sx(n - 1).toFixed(1)},${baseY} L${sx(0).toFixed(1)},${baseY} Z"
       fill="${color}" fill-opacity="0.07"/>`
    : '';

  // Polyline
  const ptsStr = points.map((p, i) => `${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  // Dots (skip when too many points)
  const dots = n <= 40
    ? points.map((p, i) =>
        `<circle cx="${sx(i).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${n > 20 ? 2 : 3}" fill="${color}" stroke="white" stroke-width="1.5"/>`
      ).join('')
    : '';

  // X-axis date labels (max ~8 labels, always first & last)
  const step = Math.max(1, Math.ceil(n / 8));
  const xLabels = points.map((p, i) => {
    if (i !== 0 && i !== n - 1 && i % step !== 0) return '';
    return `<text x="${sx(i).toFixed(1)}" y="${H - pad.b + 14}" text-anchor="middle" font-size="9" fill="#757575">${p.x.slice(-5)}</text>`;
  }).join('');

  // Latest value label above last dot
  const lx = sx(n - 1).toFixed(1);
  const ly = (sy(points[n - 1].y) - 8).toFixed(1);
  const lastLabel = `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" fill="${color}" font-weight="bold">${fmtChartVal(points[n - 1].y)}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  ${grid}${zeroLine}
  <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" stroke="#E0E0E0" stroke-width="1"/>
  <line x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}" stroke="#E0E0E0" stroke-width="1"/>
  ${area}
  ${n > 1 ? `<polyline points="${ptsStr}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
  ${dots}${lastLabel}${xLabels}
</svg>`;
}

// ── SVG Bar Chart (day-over-day % change) ─────────────────────────────────────
function buildBarChart(points) {
  const n = points.length;
  const W = 700, H = 200;
  const pad = { t: 25, r: 24, b: 46, l: 52 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;

  const yVals = points.map(p => p.y);
  let yMin = Math.min(...yVals, 0), yMax = Math.max(...yVals, 0);
  if (yMin === yMax) { yMin -= 0.5; yMax += 0.5; }
  const ySpan = yMax - yMin;
  const yLo = yMin - ySpan * 0.2;
  const yHi = yMax + ySpan * 0.2;

  const sy = v => pad.t + cH * (1 - (v - yLo) / (yHi - yLo));
  const z  = sy(0);

  const barW   = Math.max(6, Math.min(40, cW / n - 6));
  const spacing = cW / n;
  const bx = i  => pad.l + spacing * i + (spacing - barW) / 2;

  // Y grid (5 ticks)
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = yLo + (i / 4) * (yHi - yLo);
    const y = sy(v).toFixed(1);
    return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#EEEEEE" stroke-width="1"/>
<text x="${pad.l - 4}" y="${(+y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#9E9E9E">${v.toFixed(1)}%</text>`;
  }).join('');

  const zLine = `<line x1="${pad.l}" y1="${z.toFixed(1)}" x2="${W - pad.r}" y2="${z.toFixed(1)}" stroke="#9E9E9E" stroke-width="1.5"/>`;

  const bars = points.map((p, i) => {
    const top    = p.y >= 0 ? sy(p.y) : z;
    const bottom = p.y >= 0 ? z : sy(p.y);
    const h      = Math.max(1, bottom - top);
    const c      = p.y >= 0 ? '#2E7D32' : '#C62828';
    const x      = bx(i).toFixed(1);
    const cx_    = (bx(i) + barW / 2).toFixed(1);
    const valY   = (p.y >= 0 ? top - 5 : bottom + 13).toFixed(1);
    const val    = (p.y >= 0 ? '+' : '') + p.y.toFixed(1) + '%';
    return `<rect x="${x}" y="${top.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${c}" rx="2"/>
<text x="${cx_}" y="${valY}" text-anchor="middle" font-size="9" fill="${c}" font-weight="bold">${val}</text>
<text x="${cx_}" y="${H - pad.b + 13}" text-anchor="middle" font-size="9" fill="#757575">${p.x.slice(-5)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  ${grid}${zLine}
  <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" stroke="#E0E0E0" stroke-width="1"/>
  ${bars}
</svg>`;
}

// ── Table renderer ─────────────────────────────────────────────────────────────
function renderTable(snapshots) {
  const reversed = [...snapshots].reverse(); // newest first

  const rows = reversed.map((s, ri) => {
    const prev = reversed[ri + 1]; // the older snapshot (next in reversed array)

    const assetsDiff = prev != null ? s.totalAssets - prev.totalAssets : null;
    const assetsPct  = (prev != null && prev.totalAssets) ? assetsDiff / Math.abs(prev.totalAssets) * 100 : null;
    const realDiff   = prev != null ? s.realizedPnl - prev.realizedPnl : null;

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
      ? `<span class="${s.unrealizedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${s.unrealizedPnl >= 0 ? '+' : ''}${fmtN(s.unrealizedPnl)}</span>`
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
      <td class="number-col">${fmtN(s.netDeployed ?? s.totalInvested)}</td>
      <td class="number-col">${fmtN(s.inactiveCapital)}</td>
      <td class="number-col">${unrealCell}</td>
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
        <th class="number-col">سرمایه غیرفعال</th>
        <th class="number-col">سود/زیان لحظه‌ای</th>
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
