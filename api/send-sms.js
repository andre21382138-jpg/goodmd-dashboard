// POST /api/send-sms
// Body: { receivers: [{ name, phone }], message, sender }
// Env:  MUNJANARA_USERID, MUNJANARA_PASSWD

import iconv from 'iconv-lite';

const BATCH = 50; // 동시 발송 수 (Vercel Pro 300s 기준)

// 메시지를 EUC-KR로 변환 후 percent-encode
function encodeEucKr(str) {
  const buf = iconv.encode(str, 'EUC-KR');
  let encoded = '';
  for (const byte of buf) {
    encoded += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return encoded;
}

const ERR = {
  '1':'필수값 부족', '2':'아이디 오류', '3':'비밀번호 오류', '4':'잔액 부족',
  '5':'번호오류', '6':'발신번호 오류', '7':'메시지 없음', '8':'메시지 초과',
  '10':'수신거부', '11':'수신거부', '12':'수신오류', '13':'발신번호 미등록',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { receivers, message, sender, kind } = req.body;
  if (!receivers?.length || !message?.trim()) {
    return res.status(400).json({ error: '수신자 또는 메시지가 없습니다' });
  }

  // 광고성(kind가 'marketing_'으로 시작) — sms_consent=true 회원만 통과
  let filteredReceivers = receivers;
  let filteredOut = 0;
  if (kind && kind.startsWith('marketing_')) {
    const phones = receivers.map(r => String(r.phone || '').replace(/\D/g, '')).filter(Boolean);
    if (phones.length > 0) {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
      if (SUPABASE_URL && SUPABASE_KEY) {
        const phoneFilter = phones.map(p => `phone.eq.${p}`).join(',');
        const url = `${SUPABASE_URL}/rest/v1/customers?or=(${phoneFilter})&select=phone,sms_consent`;
        try {
          const r = await fetch(url, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          });
          const rows = await r.json();
          const consentMap = new Map();
          for (const row of (Array.isArray(rows) ? rows : [])) {
            consentMap.set(String(row.phone || '').replace(/\D/g, ''), row.sms_consent === true);
          }
          filteredReceivers = receivers.filter(rcv => {
            const digits = String(rcv.phone || '').replace(/\D/g, '');
            return consentMap.get(digits) === true;
          });
          filteredOut = receivers.length - filteredReceivers.length;
        } catch (e) {
          // 동의 조회 실패 시 안전하게 발송 차단 (광고성은 보수적)
          return res.status(500).json({ error: '수신동의 확인 실패. 발송 중단.' });
        }
      }
    }
  }

  if (filteredReceivers.length === 0) {
    return res.json({ ok: 0, failCount: 0, failed: [], details: [], filteredOut });
  }

  const { MUNJANARA_USERID, MUNJANARA_PASSWD } = process.env;
  if (!MUNJANARA_USERID || !MUNJANARA_PASSWD) {
    return res.status(500).json({ error: 'SMS 환경변수가 설정되지 않았습니다' });
  }

  const SENDER = sender?.replace(/\D/g, '') || '';
  if (!SENDER) {
    return res.status(400).json({ error: '발신번호가 없습니다' });
  }

  const encodedMsg = encodeEucKr(message);

  // 90바이트 초과 → LMS(장문). 제목(subject)이 있어야 장문으로 발송되며, 없으면 단문(90byte)으로 잘림.
  // 단문(≤90byte)은 subject 없이 SMS 유지 (LMS는 요금이 더 비쌈).
  const isLong = iconv.encode(message, 'EUC-KR').length > 90;
  const subjectText = (message.split('\n').find(l => l.trim())?.trim() || '안내').slice(0, 20);
  const encodedSubject = isLong ? encodeEucKr(subjectText) : '';

  const sendOne = async (r) => {
    const phone = String(r.phone || '').replace(/\D/g, '');
    if (phone.length < 10) return { ok: false, name: r.name || '', phone, status: '번호오류' };

    const url =
      `http://munjanara.co.kr/send.sys` +
      `?userid=${encodeURIComponent(MUNJANARA_USERID)}` +
      `&passwd=${encodeURIComponent(MUNJANARA_PASSWD)}` +
      `&sender=${SENDER}` +
      `&receiver=${phone}` +
      `&encode=1` +
      `&end_alert=0` +
      (isLong ? `&subject=${encodedSubject}` : '') +
      `&message=${encodedMsg}`;

    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const code = text.trim().split('|')[0];
      if (code === '9') return { ok: true, name: r.name || '', phone, status: '정상수신' };
      const status = ERR[code] || `오류코드 ${code}`;
      return { ok: false, name: r.name || '', phone, status };
    } catch (e) {
      return { ok: false, name: r.name || '', phone, status: '수신오류' };
    }
  };

  let okCount = 0;
  const details = []; // { name, phone, status }

  // BATCH 단위로 병렬 발송
  for (let i = 0; i < filteredReceivers.length; i += BATCH) {
    const chunk = filteredReceivers.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(sendOne));
    for (const r of results) {
      const v = r.status === 'fulfilled' ? r.value : { ok: false, name: '?', phone: '?', status: '수신오류' };
      if (v.ok) okCount++;
      details.push({ name: v.name, phone: v.phone, status: v.status });
    }
  }

  const failCount = details.filter(d => d.status !== '정상수신').length;
  const failed = details.filter(d => d.status !== '정상수신').map(d => `${d.name}(${d.status})`);

  res.json({ ok: okCount, failCount, failed, details, filteredOut });
}
