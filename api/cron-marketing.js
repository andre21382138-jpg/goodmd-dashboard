// Vercel Cron: 매일 자정 KST (UTC 15:00) 실행
// 1) 14일 후 만료되는 회원에게 안내 SMS 큐 등록
// 2) 오늘 만료 도래한 회원의 sms_consent_at 자동 1년 연장

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sb(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {}),
    },
  });
}

function buildMarketingRenewalMessage(name, expireDateStr) {
  return `[팔레오] 마케팅 정보 수신동의 안내\n\n${name}님, ${expireDateStr}(D-14) 마케팅 정보 수신동의가\n만료됩니다.\n\n✅ 무응답 시 1년 자동 연장됩니다.\n\n1년 재동의 유지 시 혜택:\n· 팔레오 매장 다양한 프로모션·신제품 안내\n· 매장 이용 시 적립금 지급 및 사용 가능\n· 회원 전용 할인·이벤트 우선 안내\n\n수신거부 전화 : 0808092009 (무료)\n\n광고주 : (주)한국생활건강`;
}

// 발신번호 — 환경변수로 분리 권장. 임시 기본값
const DEFAULT_SENDER = process.env.MARKETING_SENDER || '0212345678';

export default async function handler(req, res) {
  // Vercel cron 인증
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase 환경변수 없음' });
  }

  // 오늘 날짜 (KST 기준 — Vercel은 UTC라 +9h 보정)
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10); // YYYY-MM-DD
  const expire14 = new Date(nowKst); expire14.setDate(expire14.getDate() + 14);
  const expire14Str = expire14.toISOString().slice(0, 10);

  // 1) 14일 후 만료 = 동의일이 (오늘 - 1년 + 14일) 인 회원
  //    실제 SQL: sms_consent_at::date = (오늘 + 14일 - 1년) 인 회원
  //    동의일 + 1년 = 만료일. 만료일 == 오늘+14일 인 경우.
  //    즉 sms_consent_at::date = (오늘 + 14일 - 1년)
  const targetConsentDate = new Date(nowKst);
  targetConsentDate.setDate(targetConsentDate.getDate() + 14);
  targetConsentDate.setFullYear(targetConsentDate.getFullYear() - 1);
  const targetConsentDateStr = targetConsentDate.toISOString().slice(0, 10);

  // 안내 대상 회원 fetch
  const noticeRes = await sb(
    `/customers?sms_consent=eq.true&sms_consent_at=gte.${targetConsentDateStr}T00:00:00&sms_consent_at=lt.${targetConsentDateStr}T23:59:59&phone=not.is.null&select=id,name,phone,sms_consent_at`
  );
  const noticeMembers = await noticeRes.json();

  let queued = 0;
  if (Array.isArray(noticeMembers) && noticeMembers.length > 0) {
    // 중복 발송 방지: 이미 같은 만료 사이클에 marketing_renewal_notice 발송된 회원 제외
    // 11개월 이내에 같은 phone으로 marketing_renewal_notice가 sms_schedules에 있으면 skip
    const checkSince = new Date(nowKst);
    checkSince.setMonth(checkSince.getMonth() - 11);
    const checkSinceStr = checkSince.toISOString();
    const existingRes = await sb(
      `/sms_schedules?kind=eq.marketing_renewal_notice&scheduled_at=gte.${checkSinceStr}&select=receivers`
    );
    const existing = await existingRes.json();
    const sentPhones = new Set();
    if (Array.isArray(existing)) {
      for (const s of existing) {
        for (const r of (s.receivers || [])) {
          if (r.phone) sentPhones.add(String(r.phone).replace(/\D/g, ''));
        }
      }
    }

    // 발송 시각: 다음날 오전 10시 KST (UTC 01:00)
    const sendAt = new Date(nowKst);
    sendAt.setDate(sendAt.getDate() + 1);
    sendAt.setHours(10, 0, 0, 0);
    const sendAtUtc = new Date(sendAt.getTime() - 9 * 3600 * 1000).toISOString();

    const inserts = [];
    for (const m of noticeMembers) {
      const phoneDigits = String(m.phone || '').replace(/\D/g, '');
      if (sentPhones.has(phoneDigits)) continue;
      const expireDate = new Date(m.sms_consent_at);
      expireDate.setFullYear(expireDate.getFullYear() + 1);
      const expireStr = expireDate.toISOString().slice(0, 10);
      const body = buildMarketingRenewalMessage(m.name, expireStr);
      inserts.push({
        scheduled_at: sendAtUtc,
        message: body,
        sender: DEFAULT_SENDER,
        receivers: [{ name: m.name, phone: m.phone }],
        kind: 'marketing_renewal_notice',
        status: 'pending',
      });
    }
    if (inserts.length > 0) {
      await sb('/sms_schedules', {
        method: 'POST',
        body: JSON.stringify(inserts),
        headers: { 'Prefer': 'return=minimal' },
      });
      queued = inserts.length;
    }
  }

  // 2) 오늘 만료 도래 = sms_consent_at + 1년 == 오늘 인 회원
  //    sms_consent_at::date = (오늘 - 1년)
  const expireToday = new Date(nowKst);
  expireToday.setFullYear(expireToday.getFullYear() - 1);
  const expireTodayStr = expireToday.toISOString().slice(0, 10);

  const extendRes = await sb(
    `/customers?sms_consent=eq.true&sms_consent_at=gte.${expireTodayStr}T00:00:00&sms_consent_at=lt.${expireTodayStr}T23:59:59`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sms_consent_at: new Date().toISOString() }),
      headers: { 'Prefer': 'return=representation' },
    }
  );
  const extended = await extendRes.json();
  const extendedCount = Array.isArray(extended) ? extended.length : 0;

  res.json({ queued, extended: extendedCount, todayStr, expire14Str });
}
