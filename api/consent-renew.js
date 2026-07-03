// POST /api/consent-renew
// Body: { phone, action: 'lookup' | 'apply' }
// 공개(비로그인) 마케팅 수신 재동의 — 회원 본인이 자기 폰에서 처리.
// service_role로 RLS 우회하여 조회/갱신.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function hyphenate(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith('02')
    ? `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`
    : `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  return d;
}
function maskName(n) {
  const s = String(n || '').trim();
  if (s.length <= 1) return s || '회원';
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}
function maskPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}-****-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0,3)}-***-${d.slice(6)}`;
  return p;
}
async function sb(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: '서버 설정 오류(환경변수)' });

  const { phone, action } = req.body || {};
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return res.status(400).json({ error: '휴대폰 번호를 정확히 입력해주세요' });

  const hyph = hyphenate(digits);
  const orFilter = `or=(phone.eq.${digits},phone.eq.${hyph})`;

  let rows;
  try {
    const r = await sb(`/customers?${orFilter}&select=id,name,phone,sms_consent,sms_consent_at`);
    rows = await r.json();
  } catch (e) {
    return res.status(500).json({ error: '조회 실패' });
  }
  if (!Array.isArray(rows) || rows.length === 0) return res.json({ found: false });

  const first = rows[0];
  const now = new Date();
  let status = '미동의', expireDate = null;
  if (first.sms_consent) {
    if (first.sms_consent_at) {
      const exp = new Date(first.sms_consent_at); exp.setFullYear(exp.getFullYear() + 1);
      expireDate = exp.toISOString().slice(0, 10);
      status = exp >= now ? '유효' : '만료';
    } else { status = '유효'; }
  }

  if (action === 'apply') {
    const ids = rows.map(x => x.id);
    const nowIso = new Date().toISOString();
    const patch = await sb(`/customers?id=in.(${ids.join(',')})`, {
      method: 'PATCH',
      body: JSON.stringify({ sms_consent: true, sms_consent_at: nowIso, sms_unsubscribed_at: null }),
    });
    if (!patch.ok) return res.status(500).json({ error: '재동의 처리 실패' });
    const newExp = new Date(); newExp.setFullYear(newExp.getFullYear() + 1);
    return res.json({ ok: true, maskedName: maskName(first.name), expireDate: newExp.toISOString().slice(0, 10), count: ids.length });
  }

  // lookup
  return res.json({ found: true, maskedName: maskName(first.name), maskedPhone: maskPhone(first.phone), status, expireDate });
}
