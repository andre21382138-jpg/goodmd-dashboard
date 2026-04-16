// POST /api/send-sms
// Body: { receivers: [{ name, phone }], message }
// Env:  MUNJANARA_USERID, MUNJANARA_PASSWD, MUNJANARA_SENDER

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

  const MUNJANARA_SENDER = sender?.replace(/\D/g, '') || '';
  if (!MUNJANARA_SENDER) {
    return res.status(400).json({ error: '발신번호가 없습니다' });
  }

  let ok = 0;
  const failed = [];

  for (const r of receivers) {
    const phone = String(r.phone || '').replace(/\D/g, '');
    if (phone.length < 10) { failed.push(r.name || phone); continue; }

    const url =
      `https://munjanara.co.kr/send.sys` +
      `?userid=${encodeURIComponent(MUNJANARA_USERID)}` +
      `&passwd=${encodeURIComponent(MUNJANARA_PASSWD)}` +
      `&sender=${MUNJANARA_SENDER}` +
      `&receiver=${phone}` +
      `&message=${encodeURIComponent(message)}` +
      `&encode=1`;

    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const code = text.trim().split('|')[0];
      if (code === '9') {
        ok++;
      } else {
        const errMsg = { '1':'필수값 부족', '2':'아이디 오류', '3':'비밀번호 오류', '4':'잔액 부족' }[code] || `오류코드 ${code}`;
        failed.push(`${r.name || phone}(${errMsg})`);
      }
    } catch (e) {
      failed.push(r.name || phone);
    }
  }

  res.json({ ok, failCount: failed.length, failed });
}
