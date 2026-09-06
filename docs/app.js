const CATEGORY_LABELS = {
  streaming: '動画配信',
  music: '音楽',
  software: 'ソフト・アプリ',
  fitness: 'ジム・フィットネス',
  food: '食品・宅配',
  other: 'その他',
};

const CYCLE_LABELS = {
  monthly: '月払い',
  yearly: '年払い',
  weekly: '週払い',
};

let subs = [];
let currentTab = 'all';

const cardGrid = document.getElementById('cardGrid');
const emptyState = document.getElementById('emptyState');
const summaryBar = document.getElementById('summaryBar');
const reminderBanner = document.getElementById('reminderBanner');
const trialBanner = document.getElementById('trialBanner');
const modalOverlay = document.getElementById('modalOverlay');
const subForm = document.getElementById('subForm');
const modalTitle = document.getElementById('modalTitle');
const deleteBtn = document.getElementById('deleteBtn');
const categorySelect = document.getElementById('category');
const categoryLabelWrap = document.getElementById('categoryLabelWrap');

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function monthlyEquivalent(amount, cycle) {
  if (amount == null) return 0;
  if (cycle === 'yearly') return amount / 12;
  if (cycle === 'weekly') return amount * 4.33;
  return amount;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function billingBadge(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return { text: '請求日未設定', cls: 'badge-none' };
  if (days < 0) return { text: `更新日超過(${Math.abs(days)}日前)`, cls: 'badge-overdue' };
  if (days === 0) return { text: '本日請求', cls: 'badge-overdue' };
  if (days <= 7) return { text: `あと${days}日`, cls: 'badge-warn' };
  return { text: `あと${days}日`, cls: 'badge-ok' };
}

async function loadSubs() {
  subs = await Storage.list();
  renderSummary();
  renderReminderBanner();
  renderTrialBanner();
  renderCards();
}

function renderSummary() {
  if (subs.length === 0) {
    summaryBar.hidden = true;
    return;
  }
  const monthlyTotal = subs.reduce((sum, s) => sum + monthlyEquivalent(s.cost, s.billing_cycle), 0);
  summaryBar.hidden = false;
  summaryBar.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">月換算の合計</span>
      <span class="summary-value">${Math.round(monthlyTotal).toLocaleString()}円</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">年間換算</span>
      <span class="summary-value">${Math.round(monthlyTotal * 12).toLocaleString()}円</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">登録件数</span>
      <span class="summary-value">${subs.length}件</span>
    </div>
  `;
}

function renderReminderBanner() {
  const soon = subs
    .filter((s) => {
      const d = daysUntil(s.next_billing_date);
      return d !== null && d <= 7;
    })
    .sort((a, b) => daysUntil(a.next_billing_date) - daysUntil(b.next_billing_date));

  if (soon.length === 0) {
    reminderBanner.hidden = true;
    return;
  }

  const items = soon.map((s) => {
    const d = daysUntil(s.next_billing_date);
    const dayText = d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? '本日' : `あと${d}日`;
    return `「${escapeHtml(s.service_name)}」: ${dayText}`;
  });

  reminderBanner.innerHTML = `もうすぐ請求されるサブスクがあるよ💳<br>${items.join(' / ')}`;
  reminderBanner.hidden = false;
}

function renderTrialBanner() {
  const soon = subs
    .filter((s) => {
      const d = daysUntil(s.trial_end_date);
      return d !== null && d <= 3;
    })
    .sort((a, b) => daysUntil(a.trial_end_date) - daysUntil(b.trial_end_date));

  if (soon.length === 0) {
    trialBanner.hidden = true;
    return;
  }

  const items = soon.map((s) => {
    const d = daysUntil(s.trial_end_date);
    const dayText = d < 0 ? `${Math.abs(d)}日前に終了済み` : d === 0 ? '本日終了' : `あと${d}日で終了`;
    return `「${escapeHtml(s.service_name)}」: ${dayText}`;
  });

  trialBanner.innerHTML = `⚠️ 無料トライアルがもうすぐ終わるよ。いらなければ今のうちに解約を!<br>${items.join(' / ')}`;
  trialBanner.hidden = false;
}

function renderCards() {
  const filtered = currentTab === 'all'
    ? subs
    : subs.filter((s) => s.category === currentTab);

  cardGrid.innerHTML = '';
  emptyState.hidden = subs.length !== 0;

  if (filtered.length === 0 && subs.length !== 0) {
    cardGrid.innerHTML = '<div class="empty-state">このカテゴリのサブスクはまだ登録されてないよ。</div>';
    return;
  }

  filtered.forEach((s) => {
    const badge = billingBadge(s.next_billing_date);
    const catLabel = s.category === 'other' && s.category_label
      ? s.category_label
      : CATEGORY_LABELS[s.category] || 'その他';

    const trialDays = daysUntil(s.trial_end_date);
    const trialTag = trialDays !== null && trialDays >= 0
      ? `<span class="badge badge-trial">トライアル中 あと${trialDays}日</span>`
      : '';

    const card = document.createElement('div');
    card.className = `sub-card cat-${s.category}`;
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-category">${catLabel}${s.plan_name ? ` / ${escapeHtml(s.plan_name)}` : ''}</div>
          <div class="card-name">${escapeHtml(s.service_name)}</div>
        </div>
        <span class="badge ${badge.cls}">${badge.text}</span>
      </div>
      ${trialTag}
      ${s.cost != null ? `<div class="card-detail">料金: ${Number(s.cost).toLocaleString()}円 / ${CYCLE_LABELS[s.billing_cycle] || ''}</div>` : ''}
      ${s.next_billing_date ? `<div class="card-detail">次回請求日: ${s.next_billing_date}</div>` : ''}
      ${s.payment_method ? `<div class="card-detail">支払い方法: ${escapeHtml(s.payment_method)}</div>` : ''}
      ${s.cancel_url ? `<a class="cancel-link-btn" href="${escapeHtml(s.cancel_url)}" target="_blank" rel="noopener">解約ページを開く →</a>` : ''}
    `;
    card.querySelector('.card-top').addEventListener('click', () => openEditModal(s));
    card.querySelector('.card-name').addEventListener('click', () => openEditModal(s));
    card.addEventListener('click', (e) => {
      if (e.target.closest('.cancel-link-btn')) return;
      openEditModal(s);
    });
    cardGrid.appendChild(card);
  });
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');
  currentTab = btn.dataset.cat;
  renderCards();
});

categorySelect.addEventListener('change', () => {
  categoryLabelWrap.hidden = categorySelect.value !== 'other';
});

function openAddModal() {
  subForm.reset();
  document.getElementById('subId').value = '';
  modalTitle.textContent = 'サブスクを追加';
  deleteBtn.hidden = true;
  categoryLabelWrap.hidden = true;
  modalOverlay.hidden = false;
}

function openEditModal(s) {
  document.getElementById('subId').value = s.id;
  document.getElementById('category').value = s.category;
  document.getElementById('category_label').value = s.category_label || '';
  document.getElementById('service_name').value = s.service_name || '';
  document.getElementById('plan_name').value = s.plan_name || '';
  document.getElementById('cost').value = s.cost ?? '';
  document.getElementById('billing_cycle').value = s.billing_cycle || 'monthly';
  document.getElementById('next_billing_date').value = s.next_billing_date || '';
  document.getElementById('trial_end_date').value = s.trial_end_date || '';
  document.getElementById('payment_method').value = s.payment_method || '';
  document.getElementById('cancel_url').value = s.cancel_url || '';
  document.getElementById('cancel_note').value = s.cancel_note || '';
  document.getElementById('memo').value = s.memo || '';

  categoryLabelWrap.hidden = s.category !== 'other';
  modalTitle.textContent = 'サブスクを編集';
  deleteBtn.hidden = false;
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
}

document.getElementById('addBtn').addEventListener('click', openAddModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

subForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('subId').value;
  const body = {
    category: document.getElementById('category').value,
    category_label: document.getElementById('category_label').value,
    service_name: document.getElementById('service_name').value,
    plan_name: document.getElementById('plan_name').value,
    cost: document.getElementById('cost').value,
    billing_cycle: document.getElementById('billing_cycle').value,
    next_billing_date: document.getElementById('next_billing_date').value,
    trial_end_date: document.getElementById('trial_end_date').value,
    payment_method: document.getElementById('payment_method').value,
    cancel_url: document.getElementById('cancel_url').value,
    cancel_note: document.getElementById('cancel_note').value,
    memo: document.getElementById('memo').value,
  };

  if (id) {
    await Storage.update(id, body);
  } else {
    await Storage.create(body);
  }

  closeModal();
  loadSubs();
});

deleteBtn.addEventListener('click', async () => {
  const id = document.getElementById('subId').value;
  if (!id) return;
  if (!confirm('このサブスクを削除する?元には戻せないよ。')) return;
  await Storage.remove(id);
  closeModal();
  loadSubs();
});

function buildServiceTimelines() {
  const dateSet = new Set();
  subs.forEach((s) => (s.cost_history || []).forEach((h) => dateSet.add(h.date)));
  const dates = Array.from(dateSet).sort();

  const series = subs
    .filter((s) => (s.cost_history || []).length > 0)
    .map((s) => {
      const firstDate = s.cost_history[0].date;
      const values = dates.map((date) => {
        if (date < firstDate) return null;
        const hist = s.cost_history.filter((h) => h.date <= date);
        const latest = hist[hist.length - 1];
        return Math.round(monthlyEquivalent(latest.amount, latest.billing_cycle));
      });
      return { id: String(s.id), name: `${escapeHtml(s.service_name)}`, values };
    });

  const totalValues = dates.map((_, i) => {
    let sum = 0;
    series.forEach((s) => { if (s.values[i] != null) sum += s.values[i]; });
    return Math.round(sum);
  });

  return { dates, series, totalValues };
}

function latestValue(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i];
  }
  return null;
}

const CHART_PALETTE = ['#3b6cf6', '#e0a52c', '#16a34a', '#e14b4b', '#7c3aed', '#0891b2', '#c2410c', '#4d7c0f'];
let chartVisibility = {};

function renderSpendChart() {
  const content = document.getElementById('chartContent');
  const { dates, series, totalValues } = buildServiceTimelines();

  if (dates.length === 0) {
    content.innerHTML = '<div class="empty-state">まだ推移データがないよ。料金を登録・変更していくと、ここに変化が記録されていくよ。</div>';
    return;
  }

  const allSeries = [
    { id: 'total', name: '合計', values: totalValues, color: '#4b5563', dashed: true },
    ...series.map((s, i) => ({ ...s, color: CHART_PALETTE[i % CHART_PALETTE.length], dashed: false })),
  ];
  allSeries.forEach((s) => {
    if (!(s.id in chartVisibility)) chartVisibility[s.id] = true;
  });

  const width = 560;
  const height = 280;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const visibleSeries = allSeries.filter((s) => chartVisibility[s.id]);
  const visibleValues = visibleSeries.flatMap((s) => s.values.filter((v) => v != null));
  const maxV = Math.max(...visibleValues, 1);

  const xAt = (i) => padL + (dates.length === 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const yAt = (v) => padT + innerH - (v / maxV) * innerH;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const v = Math.round((maxV * i) / yTickCount);
    const y = yAt(v);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>
            <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--text-muted)">${v.toLocaleString()}</text>`;
  }).join('');

  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));
  const xLabels = dates
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i === 0 || i === dates.length - 1 || i % labelEvery === 0)
    .map(({ d, i }) => `<text x="${xAt(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${d.slice(2)}</text>`)
    .join('');

  const lines = visibleSeries.map((s) => {
    let d = '';
    let drawing = false;
    s.values.forEach((v, i) => {
      if (v == null) { drawing = false; return; }
      const x = xAt(i).toFixed(1);
      const y = yAt(v).toFixed(1);
      d += `${d ? ' ' : ''}${drawing ? 'L' : 'M'} ${x} ${y}`;
      drawing = true;
    });
    const dots = s.values
      .map((v, i) => (v == null ? '' : `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="3" fill="${s.color}"><title>${s.name} / ${dates[i]}: ${v.toLocaleString()}円</title></circle>`))
      .join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dashed ? 'stroke-dasharray="5,4"' : ''}></path>${dots}`;
  }).join('');

  const legend = allSeries.map((s) => {
    const v = latestValue(s.values);
    return `
      <button type="button" class="chart-legend-item${chartVisibility[s.id] ? '' : ' off'}" data-series="${s.id}">
        <span class="chart-legend-swatch" style="background:${s.color}"></span>
        ${s.name}${v != null ? `: ${v.toLocaleString()}円` : ''}
      </button>
    `;
  }).join('');

  content.innerHTML = `
    <p class="chart-sub">月額換算(年払いは12分の1、週払いは4.33倍)。タップで表示・非表示を切り替えられるよ。</p>
    <div class="chart-legend">${legend}</div>
    <svg viewBox="0 0 ${width} ${height}" class="spend-chart" role="img" aria-label="サブスク支出推移グラフ">
      ${yTicks}
      ${lines}
      ${xLabels}
    </svg>
  `;

  content.querySelectorAll('.chart-legend-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      chartVisibility[btn.dataset.series] = !chartVisibility[btn.dataset.series];
      renderSpendChart();
    });
  });
}

const chartOverlay = document.getElementById('chartOverlay');
document.getElementById('chartBtn').addEventListener('click', () => {
  renderSpendChart();
  chartOverlay.hidden = false;
});
document.getElementById('closeChart').addEventListener('click', () => {
  chartOverlay.hidden = true;
});
chartOverlay.addEventListener('click', (e) => {
  if (e.target === chartOverlay) chartOverlay.hidden = true;
});

loadSubs();
