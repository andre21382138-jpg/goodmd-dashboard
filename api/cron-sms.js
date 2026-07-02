// Vercel Cron: 1분마다 실행 — 예약 SMS 발송
// vercel.json crons 설정 필요

import iconv from 'iconv-lite';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BATCH = 50;

function encodeEucKr(str) {
  const buf = iconv.encode(str, 'EUC-KR');
  let encoded = '';
  for (const byte of buf) encoded += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  return encoded;
}

const ERR = {
  '1':'필수값 부족','2':'아이디 오류','3':'비밀번호 오류','4':'잔액 부족',
  '5':'번호오류','6':'발신번호 오류','7':'메시지 없음','8':'메시지 초과',
  '10':'수신거부','11':'수신거부','12':'수신오류','13':'발신번호 미등록',
};

async function sb(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      ...(options.headers || {}),
    },
  });
}

async function sendAll(receivers, message, sender) {
  const encodedMsg = encodeEucKr(message);
  const { MUNJANARA_USERID, MUNJANARA_PASSWD } = process.env;

  const sendOne = async (r) => {
    const phone = String(r.phone || '').replace(/\D/g, '');
    if (phone.length < 10) return { ok: false, name: r.name || '', phone, status: '번호오류' };
    const url =
      `http://munjanara.co.kr/send.sys` +
      `?userid=${encodeURIComponent(MUNJANARA_USERID)}` +
      `&passwd=${encodeURIComponent(MUNJANARA_PASSWD)}` +
      `&sender=${sender.replace(/\D/g,'')}` +
      `&receiver=${phone}&encode=1&end_alert=0&allow_mms=1` + // 장문허용(미설정 시 90byte 자동짤림)
      `&message=${encodedMsg}`;
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const code = text.trim().split('|')[0];
      if (code === '9') return { ok: true, name: r.name || '', phone, status: '정상수신' };
      return { ok: false, name: r.name || '', phone, status: ERR[code] || `오류코드 ${code}` };
    } catch {
      return { ok: false, name: r.name || '', phone, status: '수신오류' };
    }
  };

  const details = [];
  let okCount = 0;
  for (let i = 0; i < receivers.length; i += BATCH) {
    const results = await Promise.allSettled(receivers.slice(i, i + BATCH).map(sendOne));
    for (const r of results) {
      const v = r.status === 'fulfilled' ? r.value : { ok: false, name: '?', phone: '?', status: '수신오류' };
      if (v.ok) okCount++;
      details.push(v);
    }
  }
  return { okCount, details };
}

export default async function handler(req, res) {
  // Vercel cron 인증
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase 환경변수 없음' });
  }

  // 현재 시각 이하의 pending 예약 조회
  const now = new Date().toISOString();
  const listRes = await sb(
    `/sms_schedules?status=eq.pending&scheduled_at=lte.${encodeURIComponent(now)}&select=*`,
    { headers: { 'Prefer': 'return=representation' } }
  );
  const schedules = await listRes.json();

  if (!schedules?.length) return res.json({ processed: 0 });

  let processed = 0;
  for (const sch of schedules) {
    // sending 상태로 먼저 변경 (중복 실행 방지)
    await sb(`/sms_schedules?id=eq.${sch.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sending' }),
    });

    try {
      const { okCount, details } = await sendAll(sch.receivers, sch.message, sch.sender);
      const failCount = details.filter(d => d.status !== '정상수신').length;

      // 상태 업데이트
      await sb(`/sms_schedules?id=eq.${sch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'sent',
          sent_at: new Date().toISOString(),
          ok_count: okCount,
          fail_count: failCount,
        }),
      });

      // sms_logs 저장
      const sentAt = new Date().toISOString();
      const rows = details.map(d => ({
        sent_at: sentAt, message: sch.message, sender: sch.sender,
        receiver: d.phone, receiver_name: d.name, status: d.status,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await sb('/sms_logs', {
          method: 'POST',
          body: JSON.stringify(rows.slice(i, i + 500)),
        });
      }
      processed++;
    } catch (e) {
      await sb(`/sms_schedules?id=eq.${sch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed' }),
      });
    }
  }

  res.json({ processed });
}
