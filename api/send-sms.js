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

  const { receivers, message, sender } = req.body;
  if (!receivers?.length || !message?.trim()) {
    return res.status(400).json({ error: '수신자 또는 메시지가 없습니다' });
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
  for (let i = 0; i < receivers.length; i += BATCH) {
    const chunk = receivers.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(sendOne));
    for (const r of results) {
      const v = r.status === 'fulfilled' ? r.value : { ok: false, name: '?', phone: '?', status: '수신오류' };
      if (v.ok) okCount++;
      details.push({ name: v.name, phone: v.phone, status: v.status });
    }
  }

  const failCount = details.filter(d => d.status !== '정상수신').length;
  const failed = details.filter(d => d.status !== '정상수신').map(d => `${d.name}(${d.status})`);

  res.json({ ok: okCount, failCount, failed, details });
}
