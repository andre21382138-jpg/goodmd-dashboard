// Vercel Cron: 매일 15:10 UTC(=익일 00:10 KST) 실행.
// KST 기준 '1일'일 때만 동작 → 지난달 말(마지막 판매입력 후) 재고를 상품별로 스냅샷 저장.
// store_stock(전체 매장) 합계를 product_code→product_id로 매핑해 stock_snapshots에 upsert.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sb(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

async function fetchAll(pathBase) {
  const all = []; let offset = 0; const PAGE = 1000;
  while (true) {
    const sep = pathBase.includes('?') ? '&' : '?';
    const res = await sb(`${pathBase}${sep}limit=${PAGE}&offset=${offset}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase 환경변수 없음' });
  }

  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  const force = req.query && (req.query.force === '1'); // 수동 강제 실행용
  if (nowKst.getUTCDate() !== 1 && !force) {
    return res.json({ skipped: true, reason: '매월 1일에만 실행', kstDate: nowKst.toISOString().slice(0, 10) });
  }
  // 지난달 (1일 기준 전날의 YYYY-MM)
  const prev = new Date(nowKst); prev.setUTCDate(0);
  const snapshotMonth = prev.toISOString().slice(0, 7); // 'YYYY-MM'

  // 1) 현재 재고 합계 (전체 매장, product_code)
  const stock = await fetchAll('/store_stock?select=product_code,stock_qty');
  const qtyByCode = {};
  for (const s of stock) { const c = String(s.product_code || ''); if (c) qtyByCode[c] = (qtyByCode[c] || 0) + (s.stock_qty || 0); }

  // 2) product_code → product_id
  const products = await fetchAll('/products?select=id,code');
  const idByCode = {};
  for (const p of products) { if (p.code) idByCode[String(p.code)] = p.id; }

  // 3) 스냅샷 payload
  const rows = [];
  for (const [code, qty] of Object.entries(qtyByCode)) {
    const pid = idByCode[code];
    if (!pid) continue;
    rows.push({ snapshot_month: snapshotMonth, product_id: pid, quantity: Math.round(qty) });
  }

  // 4) upsert (merge-duplicates on unique(snapshot_month, product_id))
  let saved = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const r = await sb('/stock_snapshots?on_conflict=snapshot_month,product_id', {
      method: 'POST',
      body: JSON.stringify(slice),
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    });
    if (r.ok) saved += slice.length;
    else { const t = await r.text(); return res.status(500).json({ error: 'upsert 실패', detail: t, saved }); }
  }

  res.json({ ok: true, snapshotMonth, products: rows.length, saved });
}
