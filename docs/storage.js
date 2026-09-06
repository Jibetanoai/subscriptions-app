// サーバーを持たない静的サイトなので、常にこのブラウザ内(localStorage)にデータを保存する。
const Storage = (() => {
  const LOCAL_KEY = 'subscriptions_v1';
  const LOCAL_SEQ_KEY = 'subscriptions_seq_v1';

  function normalize(data) {
    return {
      category: data.category || 'other',
      category_label: data.category_label || null,
      service_name: data.service_name || '',
      plan_name: data.plan_name || null,
      cost: data.cost !== '' && data.cost != null ? Number(data.cost) : null,
      billing_cycle: data.billing_cycle || 'monthly',
      next_billing_date: data.next_billing_date || null,
      trial_end_date: data.trial_end_date || null,
      payment_method: data.payment_method || null,
      cancel_url: data.cancel_url || null,
      cancel_note: data.cancel_note || null,
      memo: data.memo || null,
    };
  }

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveLocal(list) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  }

  function nextId() {
    const n = Number(localStorage.getItem(LOCAL_SEQ_KEY) || '0') + 1;
    localStorage.setItem(LOCAL_SEQ_KEY, String(n));
    return n;
  }

  return {
    async list() {
      return loadLocal().slice().sort((a, b) => {
        if (!a.next_billing_date && !b.next_billing_date) return 0;
        if (!a.next_billing_date) return 1;
        if (!b.next_billing_date) return -1;
        return a.next_billing_date.localeCompare(b.next_billing_date);
      });
    },
    async create(data) {
      const list = loadLocal();
      const now = new Date().toISOString();
      const norm = normalize(data);
      const history = [];
      if (norm.cost != null) {
        history.push({ date: now.slice(0, 10), amount: norm.cost, billing_cycle: norm.billing_cycle });
      }
      const row = { id: nextId(), ...norm, cost_history: history, created_at: now, updated_at: now };
      list.push(row);
      saveLocal(list);
      return row;
    },
    async update(id, data) {
      const list = loadLocal();
      const idx = list.findIndex((p) => String(p.id) === String(id));
      if (idx === -1) throw new Error('not found');
      const prev = list[idx];
      const norm = normalize(data);
      const history = Array.isArray(prev.cost_history) ? prev.cost_history.slice() : [];
      const today = new Date().toISOString().slice(0, 10);
      const last = history[history.length - 1];
      if (norm.cost != null && (!last || last.amount !== norm.cost || last.billing_cycle !== norm.billing_cycle)) {
        const entry = { date: today, amount: norm.cost, billing_cycle: norm.billing_cycle };
        if (last && last.date === today) {
          history[history.length - 1] = entry;
        } else {
          history.push(entry);
        }
      }
      list[idx] = { ...prev, ...norm, cost_history: history, updated_at: new Date().toISOString() };
      saveLocal(list);
      return list[idx];
    },
    async remove(id) {
      saveLocal(loadLocal().filter((p) => String(p.id) !== String(id)));
    },
  };
})();
