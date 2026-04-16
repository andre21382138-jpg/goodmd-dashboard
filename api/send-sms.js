// POST /api/send-sms
// Body: { receivers: [{ name, phone }], message, sender }
// Env:  MUNJANARA_USERID, MUNJANARA_PASSWD

const BATCH = 20; // 동시 발송 수

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

  const sendOne = async (r) => {
    const phone = String(r.phone || '').replace(/\D/g, '');
    if (phone.length < 10) return { ok: false, label: r.name || phone, reason: '번호 오류' };

    const url =
      `https://munjanara.co.kr/send.sys` +
      `?userid=${encodeURIComponent(MUNJANARA_USERID)}` +
      `&passwd=${encodeURIComponent(MUNJANARA_PASSWD)}` +
      `&sender=${SENDER}` +
      `&receiver=${phone}` +
      `&message=${encodeURIComponent(message)}` +
      `&encode=1`;

    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const code = text.trim().split('|')[0];
      if (code === '9') return { ok: true };
      const reason = { '1':'필수값 부족', '2':'아이디 오류', '3':'비밀번호 오류', '4':'잔액 부족' }[code] || `오류코드 ${code}`;
      return { ok: false, label: r.name || phone, reason };
    } catch (e) {
      return { ok: false, label: r.name || phone, reason: '네트워크 오류' };
    }
  };

  let okCount = 0;
  const failed = [];

  // BATCH 단위로 병렬 발송
  for (let i = 0; i < receivers.length; i += BATCH) {
    const chunk = receivers.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(sendOne));
    for (const r of results) {
      const v = r.status === 'fulfilled' ? r.value : { ok: false, label: '?', reason: r.reason?.message };
      if (v.ok) okCount++;
      else failed.push(`${v.label}(${v.reason})`);
    }
  }

  res.json({ ok: okCount, failCount: failed.length, failed });
}
