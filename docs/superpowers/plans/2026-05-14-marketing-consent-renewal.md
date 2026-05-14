# 마케팅 수신동의 1년 자동 갱신 + 재동의 안내 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매년 마케팅 수신동의 갱신 워크플로우 자동화 — 만료 14일 전 안내 SMS, 무응답자 자동 1년 연장, 거부 회원의 광고성 SMS 차단, 문자나라 수신거부 명단 일괄 동기화.

**Architecture:** 신규 Vercel cron(`api/cron-marketing.js`)이 매일 자정(KST) 실행되어 sms_schedules에 안내 SMS를 큐 등록하고 만료일 도래 회원의 동의일을 자동 갱신. 기존 `api/cron-sms.js`가 분 단위로 큐를 처리. `api/send-sms.js`에 `kind` 분기를 추가해 광고성 발송은 `sms_consent=true` 회원만 허용. 본사 사이드바에 신규 메뉴 "수신거부 동기화" 추가하여 문자나라 엑셀 일괄 업로드 지원.

**Tech Stack:** React 18, Supabase JS, Vercel cron, ExcelJS (또는 DOM 파싱). 기존 `customers.sms_consent` / `sms_consent_at` 컬럼 그대로 사용 (spec의 `marketing_consent`와 동일 개념). 새 컬럼은 `customers.sms_unsubscribed_at` 1개 + `sms_schedules.kind` 1개만 추가.

**Spec:** [docs/superpowers/specs/2026-05-14-marketing-consent-renewal-design.md](../specs/2026-05-14-marketing-consent-renewal-design.md)

## Spec 대비 명명 매핑

| Spec | 실제 코드 (Plan) |
|---|---|
| `customers.marketing_consent` | `customers.sms_consent` (기존, 재사용) |
| `customers.marketing_consent_at` | `customers.sms_consent_at` (기존, 재사용) |
| `customers.marketing_unsubscribed_at` | `customers.sms_unsubscribed_at` (신규 추가) |
| pg_cron 일일 함수 | Vercel cron `api/cron-marketing.js` (신규) |

---

## File Structure

| 파일 | 역할 | 변경 종류 |
|---|---|---|
| `api/cron-marketing.js` | 매일 자정 — 14일 후 만료 회원 안내 SMS 큐 등록 + 만료일 도래 자동 연장 | **Create** |
| `vercel.json` | 신규 cron 스케줄 등록 | Modify |
| `api/send-sms.js` | `kind` 파라미터 추가, 광고성이면 `sms_consent=true` 회원만 발송 | Modify |
| `src/pages/customer/SmsUnsubscribeSyncPage.jsx` | 문자나라 엑셀 업로드 → 매칭 → 일괄 거부 처리 | **Create** |
| `src/lib/constants.js` | HQ_MENUS의 `member_mgmt` sub에 `sms_unsubscribe_sync` 추가 | Modify |
| `src/App.js` | 신규 라우트 추가 (`page === 'sms_unsubscribe_sync'`) | Modify |
| `src/pages/customer/CustomerLookupPage.jsx` | 회원 상세에 동의/거부 토글 + 거부일/만료일 표시 | Modify |
| `src/pages/customer/MyMembersPage.jsx` | 회원 모달에 동의 상태 + 만료일 표시 | Modify |

---

## Prerequisites (사용자가 Supabase SQL Editor에서 직접 실행)

플랜 Task 들어가기 전에 SQL을 실행해야 한다. 코드 변경이 적용되어도 컬럼이 없으면 동작 안 함.

### Prereq 1: 신규 컬럼 추가

```sql
-- customers.sms_unsubscribed_at 추가
ALTER TABLE customers ADD COLUMN sms_unsubscribed_at timestamptz;

-- sms_schedules.kind 추가
ALTER TABLE sms_schedules ADD COLUMN kind text;
```

### Prereq 2: 기존 회원 마이그레이션 (가입일 기준)

```sql
-- sms_consent_at이 NULL인 회원에게 created_at 채우기
UPDATE customers
SET sms_consent_at = created_at
WHERE sms_consent_at IS NULL;

-- 가입 1년 경과 회원은 sms_consent = false로 자동 거부 처리
UPDATE customers
SET sms_consent = false
WHERE sms_consent = true
  AND (sms_consent_at + interval '1 year') < CURRENT_DATE;

-- 검증
SELECT
  sms_consent,
  COUNT(*) AS cnt,
  MIN(sms_consent_at)::date AS 최초동의일,
  MAX(sms_consent_at)::date AS 최근동의일
FROM customers
GROUP BY sms_consent;
```

---

## Task 1: api/cron-marketing.js — 일일 cron 엔드포인트

**Files:**
- Create: `api/cron-marketing.js`

매일 자정(KST) 실행되어 안내 SMS 큐 등록 + 만료일 자동 연장.

- [ ] **Step 1: 파일 작성**

`api/cron-marketing.js`:

```js
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
```

- [ ] **Step 2: 로컬 검증 (선택)**

이 endpoint는 Vercel 환경에서만 동작. 로컬에선 SUPABASE_URL 등 env 없어서 실행 불가. push 후 Vercel 환경에서 수동 호출하여 검증.

- [ ] **Step 3: Commit**

```bash
git add api/cron-marketing.js
git commit -m "$(cat <<'EOF'
feat(api): 마케팅 수신동의 일일 cron 엔드포인트

매일 자정(KST) 실행 — 14일 후 만료 회원에게 안내 SMS 큐 등록 +
오늘 만료 도래 회원의 sms_consent_at 자동 1년 연장.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: vercel.json — 일일 cron 스케줄 등록

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: cron 추가**

기존 `vercel.json`:

```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/cron-sms",
      "schedule": "* * * * *"
    }
  ]
}
```

다음으로 변경:

```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/cron-sms",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron-marketing",
      "schedule": "0 15 * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "$(cat <<'EOF'
feat(vercel): cron-marketing 일일 스케줄 등록

매일 UTC 15:00 (KST 자정) 실행.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: api/send-sms.js — kind 파라미터 + 광고성 필터

**Files:**
- Modify: `api/send-sms.js`

- [ ] **Step 1: kind 받고 광고성이면 sms_consent=true 회원만 발송**

기존 함수 시작 부분(약 25-35행):

```js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { receivers, message, sender } = req.body;
  if (!receivers?.length || !message?.trim()) {
    return res.status(400).json({ error: '수신자 또는 메시지가 없습니다' });
  }
```

다음으로 변경:

```js
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
```

- [ ] **Step 2: 이후 `receivers`를 모두 `filteredReceivers`로 교체**

`for (let i = 0; i < receivers.length; i += BATCH)` 라인을 `filteredReceivers.length`로 변경:

```js
  for (let i = 0; i < filteredReceivers.length; i += BATCH) {
    const chunk = filteredReceivers.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(sendOne));
```

마지막 응답에 filteredOut 포함:

```js
  res.json({ ok: okCount, failCount, failed, details, filteredOut });
}
```

- [ ] **Step 3: Commit**

```bash
git add api/send-sms.js
git commit -m "$(cat <<'EOF'
feat(api): send-sms에 kind 분기 + 광고성 발송 시 sms_consent 필터

kind가 'marketing_'으로 시작하면 발송 직전 customers.sms_consent를
supabase에서 조회하여 동의 회원만 통과. 정보성/거래성(info_/transaction_)은
필터 안 함.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 수신거부 동기화 페이지 신설 + 사이드바 메뉴

**Files:**
- Create: `src/pages/customer/SmsUnsubscribeSyncPage.jsx`
- Modify: `src/lib/constants.js`
- Modify: `src/App.js`

- [ ] **Step 1: SmsUnsubscribeSyncPage.jsx 작성**

`src/pages/customer/SmsUnsubscribeSyncPage.jsx` 파일을 생성:

```jsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

// 문자나라 엑셀(.xls; 실제 HTML 테이블)에서 전화번호 + 등록일시 추출
function parseMunjanaraXls(text) {
  // HTML 테이블 파싱 — DOMParser 사용
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const rows = doc.querySelectorAll('tr');
  const out = [];
  rows.forEach((tr, idx) => {
    if (idx === 0) return; // 헤더 스킵
    const tds = tr.querySelectorAll('td');
    if (tds.length < 4) return;
    const registeredAt = (tds[1]?.textContent || '').trim();
    const phone = (tds[2]?.textContent || '').replace(/\D/g, '');
    if (phone.length >= 10) {
      out.push({ phone, registeredAt });
    }
  });
  return out;
}

export default function SmsUnsubscribeSyncPage() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null); // { entries: [...], matched: [...], unmatched: [...] }
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(null);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setParsed(null); setDone(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        let text;
        if (f.name.endsWith('.xls') || f.name.endsWith('.html') || f.name.endsWith('.htm')) {
          // 문자나라 xls는 EUC-KR 인코딩된 HTML
          const buf = reader.result;
          const decoder = new TextDecoder('euc-kr');
          text = decoder.decode(buf);
        } else {
          text = String(reader.result || '');
        }
        const entries = parseMunjanaraXls(text);
        if (entries.length === 0) {
          toast('파싱된 전화번호가 없습니다. 파일 형식 확인 필요', 'err');
          return;
        }
        // DB 매칭 — 전화번호 기준
        const phones = entries.map(e => e.phone);
        const { data: customers } = await supabase.from('customers')
          .select('id, name, phone, sms_consent')
          .in('phone', phones);
        const custMap = new Map();
        for (const c of (customers || [])) {
          custMap.set(String(c.phone || '').replace(/\D/g, ''), c);
        }
        const matched = [];
        const unmatched = [];
        for (const e of entries) {
          const c = custMap.get(e.phone);
          if (c) matched.push({ ...e, customer: c });
          else unmatched.push(e);
        }
        setParsed({ entries, matched, unmatched });
      } catch (e) {
        toast('파일 파싱 실패: ' + (e.message || e), 'err');
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleApply = async () => {
    if (!parsed || parsed.matched.length === 0) return;
    if (!window.confirm(`${parsed.matched.length}명을 수신거부 처리합니다.\n진행하시겠습니까?`)) return;
    setApplying(true);
    try {
      // 거부 처리 - parallel batches
      const targets = parsed.matched.filter(m => m.customer.sms_consent !== false);
      let processed = 0;
      for (const m of targets) {
        const unsubAt = m.registeredAt
          ? new Date(m.registeredAt.replace(' ', 'T')).toISOString()
          : new Date().toISOString();
        const { error } = await supabase.from('customers')
          .update({
            sms_consent: false,
            sms_unsubscribed_at: unsubAt,
          })
          .eq('id', m.customer.id);
        if (!error) processed++;
      }
      setDone({ processed, total: parsed.matched.length, alreadyBlocked: parsed.matched.length - targets.length });
      toast(`${processed}명 수신거부 처리 완료`, 'ok');
    } catch (e) {
      toast('처리 실패: ' + (e.message || e), 'err');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <div className="card" style={{padding:'20px 24px', marginBottom:16}}>
        <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>📥 문자나라 수신거부 명단 동기화</div>
        <div style={{fontSize:12, color:'var(--text2)', lineHeight:1.7}}>
          문자나라 대시보드 → 수신거부관리 → 엑셀 다운로드 받은 파일(.xls)을 업로드하세요.<br/>
          전화번호 기준으로 회원과 매칭하여 일괄 거부 처리됩니다.
        </div>
      </div>

      <div className="card" style={{padding:'20px 24px', marginBottom:16}}>
        <label style={{display:'block', cursor:'pointer'}}>
          <input type="file" accept=".xls,.html,.htm"
            style={{display:'none'}}
            onChange={e => handleFile(e.target.files?.[0])}/>
          <div style={{padding:'40px 20px', border:'2px dashed var(--border)', borderRadius:8, textAlign:'center',
            background: file ? '#fff8e1' : '#fafafa'}}>
            {file ? (
              <>
                <div style={{fontSize:32, marginBottom:8}}>📄</div>
                <div style={{fontSize:14, fontWeight:600}}>{file.name}</div>
                <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>다른 파일 선택하려면 클릭</div>
              </>
            ) : (
              <>
                <div style={{fontSize:32, marginBottom:8}}>📤</div>
                <div style={{fontSize:14, fontWeight:600}}>파일 선택 또는 드래그</div>
                <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>.xls (문자나라 엑셀 형식)</div>
              </>
            )}
          </div>
        </label>
      </div>

      {parsed && (
        <div className="card" style={{padding:'20px 24px', marginBottom:16}}>
          <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>📊 미리보기</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16}}>
            <div style={{padding:'14px 18px', border:'1px solid var(--border)', borderRadius:6}}>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:6}}>총 거부자 수</div>
              <div style={{fontSize:22, fontWeight:700}}>{parsed.entries.length}</div>
            </div>
            <div style={{padding:'14px 18px', border:'1px solid #a5d6a7', background:'#e8f5e9', borderRadius:6}}>
              <div style={{fontSize:11, color:'#2e7d32', marginBottom:6}}>회원 매칭</div>
              <div style={{fontSize:22, fontWeight:700, color:'#2e7d32'}}>{parsed.matched.length}</div>
            </div>
            <div style={{padding:'14px 18px', border:'1px solid var(--border)', background:'#fafafa', borderRadius:6}}>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:6}}>비회원</div>
              <div style={{fontSize:22, fontWeight:700, color:'var(--text3)'}}>{parsed.unmatched.length}</div>
            </div>
          </div>
          {parsed.matched.length > 0 && (
            <button className="btn-auth" onClick={handleApply} disabled={applying}
              style={{width:'auto', padding:'0 20px', height:38, marginTop:0}}>
              {applying ? '처리 중...' : `${parsed.matched.length}명 수신거부 처리`}
            </button>
          )}
        </div>
      )}

      {done && (
        <div className="card" style={{padding:'20px 24px', background:'#e8f5e9', border:'1px solid #a5d6a7'}}>
          <div style={{fontSize:14, fontWeight:700, color:'#2e7d32', marginBottom:8}}>✅ 처리 완료</div>
          <div style={{fontSize:12, color:'var(--text2)', lineHeight:1.7}}>
            · 처리된 회원: <b>{done.processed}명</b><br/>
            · 이미 거부 상태였던 회원: <b>{done.alreadyBlocked}명</b><br/>
            · 총 매칭: {done.total}명
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 사이드바 메뉴 추가**

`src/lib/constants.js`의 HQ_MENUS에서 `member_mgmt` sub 부분 수정:

기존:
```js
  { key: 'member_mgmt', icon: '👥', label: '고객관리', sub: [
    { key: 'member_mgmt',   icon: '🔍', label: '회원 조회' },
    { key: 'sms_history',   icon: '📨', label: '문자 내역' },
  ]},
```

다음으로:
```js
  { key: 'member_mgmt', icon: '👥', label: '고객관리', sub: [
    { key: 'member_mgmt',         icon: '🔍', label: '회원 조회' },
    { key: 'sms_history',         icon: '📨', label: '문자 내역' },
    { key: 'sms_unsubscribe_sync', icon: '🚫', label: '수신거부 동기화' },
  ]},
```

- [ ] **Step 3: App.js 라우트 추가**

`src/App.js`에서 페이지 라우팅이 있는 영역을 찾는다. 다음 패턴을 grep으로 검색:

```
{page === 'sms_history'    && canSeeMain && <SmsHistoryPage/>}
```

그 라인 바로 다음에 추가:

```jsx
            {page === 'sms_history'    && canSeeMain && <SmsHistoryPage/>}
            {page === 'sms_unsubscribe_sync' && canSeeMain && <SmsUnsubscribeSyncPage/>}
```

또한 페이지 한글 라벨 매핑(`page_label` 또는 유사한 dict)이 있다면 거기에도 추가:

기존:
```js
    sms_history:    '문자 내역',
```

다음 라인에 추가:
```js
    sms_history:    '문자 내역',
    sms_unsubscribe_sync: '수신거부 동기화',
```

import 추가 (App.js 상단 다른 customer 페이지 import 근처):

```js
import SmsUnsubscribeSyncPage from './pages/customer/SmsUnsubscribeSyncPage';
```

- [ ] **Step 4: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled with warnings (기존 경고만), 새 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/SmsUnsubscribeSyncPage.jsx src/lib/constants.js src/App.js
git commit -m "$(cat <<'EOF'
feat(customer): 문자나라 수신거부 동기화 페이지 신설

본사 → 고객관리 → 수신거부 동기화 메뉴 추가.
문자나라 엑셀(.xls; HTML 테이블) 업로드 후 전화번호 매칭으로
sms_consent=false, sms_unsubscribed_at 일괄 처리.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: CustomerLookupPage — 동의/거부 토글 + 만료일 배지

**Files:**
- Modify: `src/pages/customer/CustomerLookupPage.jsx`

회원 조회 페이지의 상세 영역에 동의 관리 UI 추가.

- [ ] **Step 1: 만료일 계산 헬퍼 + 배지 컴포넌트**

`CustomerLookupPage.jsx` 파일 상단에서 컴포넌트 함수 시작 직전 또는 같은 파일 내 헬퍼로 다음 함수 추가 (import 다음에):

```jsx
function consentStatus(c) {
  if (!c.sms_consent_at) {
    return { label: c.sms_consent ? '동의 (만료일 미설정)' : '미동의', color:'#666', tone:'gray' };
  }
  const consentDate = new Date(c.sms_consent_at);
  const expiry = new Date(consentDate); expiry.setFullYear(expiry.getFullYear() + 1);
  const today = new Date();
  const daysToExpiry = Math.ceil((expiry - today) / (1000*60*60*24));
  if (!c.sms_consent) {
    return { label: '🚫 거부', color:'#c62828', tone:'red', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  if (daysToExpiry <= 14 && daysToExpiry > 0) {
    return { label: `⏳ ${daysToExpiry}일 후 만료`, color:'#e65100', tone:'orange', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  if (daysToExpiry <= 0) {
    return { label: '만료됨', color:'#c62828', tone:'red', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  return { label: `✅ 동의`, color:'#2e7d32', tone:'green', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
}
```

- [ ] **Step 2: 동의/거부 처리 핸들러 추가**

컴포넌트 본문 안 (state hooks 다음, useEffect 근처에) 추가:

```jsx
const handleToggleConsent = async (customer) => {
  if (customer.sms_consent) {
    // 동의 → 거부 처리
    const ok = window.confirm(
      `${customer.name}님의 마케팅 수신동의를 거부 처리합니다.\n\n` +
      '⚠️ 시스템 DB만 업데이트되며, 실제 SMS 차단은\n' +
      '회원이 0808092009로 직접 거부 통화하거나\n' +
      '운영자가 문자나라 대시보드에서 수동 등록해야\n' +
      '적용됩니다.\n\n진행하시겠습니까?'
    );
    if (!ok) return;
    const { error } = await supabase.from('customers').update({
      sms_consent: false,
      sms_unsubscribed_at: new Date().toISOString(),
    }).eq('id', customer.id);
    if (error) toast(error.message, 'err');
    else { toast('거부 처리 완료', 'ok'); fetchData(); }
  } else {
    // 거부 → 동의 (재동의)
    const ok = window.confirm(
      `${customer.name}님의 마케팅 수신동의를 다시 활성화합니다.\n\n` +
      '⚠️ 회원이 직접 매장에서 동의 의사를 명시적으로\n' +
      '표현한 경우에만 진행해주세요.\n\n' +
      '· 동의일 = 오늘\n· 만료일 = 1년 후\n\n진행하시겠습니까?'
    );
    if (!ok) return;
    const { error } = await supabase.from('customers').update({
      sms_consent: true,
      sms_consent_at: new Date().toISOString(),
      sms_unsubscribed_at: null,
    }).eq('id', customer.id);
    if (error) toast(error.message, 'err');
    else { toast('동의 처리 완료', 'ok'); fetchData(); }
  }
};
```

**참고:** 컴포넌트 내 데이터 fetch 함수 이름(`fetchData`, `fetchCustomers` 등)을 먼저 확인하여 위 코드의 마지막 줄 호출명을 일치시킬 것. `Grep`으로 `fetchData|fetchCustomers|loadCustomers` 검색.

- [ ] **Step 3: 회원 행 옆/상세에 동의 상태 배지 렌더링**

`{c.sms_consent ? (...) : ...}` 패턴이 있는 곳(약 399, 423행)을 찾아 만료일 배지 추가. 예시 — 어떤 식으로 렌더되든 다음 JSX를 SMS 상태 셀에 끼움:

```jsx
{(() => {
  const st = consentStatus(c);
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700,
      background: st.tone==='green' ? '#e8f5e9' : st.tone==='orange' ? '#fff3e0' : st.tone==='red' ? '#ffebee' : '#f5f5f5',
      color: st.color,
      border: `1px solid ${st.tone==='green' ? '#a5d6a7' : st.tone==='orange' ? '#ffcc80' : st.tone==='red' ? '#ef9a9a' : '#ddd'}`,
    }} title={st.expireStr ? `만료일: ${st.expireStr}` : ''}>
      {st.label}
    </span>
  );
})()}
```

만료/거부 표시는 기존 ✅/미동의 표시를 대체하는 형태로 통합 (혼란 방지).

- [ ] **Step 4: 회원 상세에 토글 버튼 추가**

회원 상세를 표시하는 영역(어떤 div/td/모달 안)에 다음 블록 추가:

```jsx
<div style={{padding:'10px 12px', border:'1px solid var(--border)', borderRadius:6, marginTop:8}}>
  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6}}>마케팅 수신동의 관리</div>
  {(() => {
    const st = consentStatus(c);
    return (
      <>
        <div style={{fontSize:12, marginBottom:6}}>
          상태: <span style={{color:st.color, fontWeight:700}}>{st.label}</span>
          {st.expireStr && <span style={{marginLeft:8, color:'var(--text3)', fontSize:11}}>(만료일: {st.expireStr})</span>}
        </div>
        {c.sms_unsubscribed_at && (
          <div style={{fontSize:11, color:'var(--text3)', marginBottom:6}}>
            거부일: {new Date(c.sms_unsubscribed_at).toISOString().slice(0,10)}
          </div>
        )}
        <button type="button" onClick={() => handleToggleConsent(c)}
          style={{height:30, padding:'0 12px', borderRadius:4, fontSize:12, fontWeight:700, cursor:'pointer',
            border: c.sms_consent ? '1px solid #ef9a9a' : '1px solid #a5d6a7',
            background: c.sms_consent ? '#fff' : '#e8f5e9',
            color: c.sms_consent ? '#c62828' : '#2e7d32'}}>
          {c.sms_consent ? '거부 처리' : '동의 처리'}
        </button>
      </>
    );
  })()}
</div>
```

**참고:** 위 JSX를 회원 상세 영역의 적절한 위치에 삽입. 정확한 위치는 파일을 읽어 상세 영역(예: `expanded === c.id` 또는 모달 내부 등)을 식별 후 결정.

- [ ] **Step 5: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled, 새 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add src/pages/customer/CustomerLookupPage.jsx
git commit -m "$(cat <<'EOF'
feat(customer): 회원 조회에 마케팅 수신동의 토글 + 만료일 배지

- consentStatus 헬퍼: 동의/거부/만료임박/만료됨 상태 판정
- 동의 상태 배지를 SMS 셀에 표시 (만료 14일 이내는 주황)
- 회원 상세에 거부/재동의 토글 버튼 + 만료일 + 거부일 표시
- 거부 처리 시 문자나라 별도 처리 안내 confirm

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: MyMembersPage — 동의 상태 + 만료일 표시 (매장용)

**Files:**
- Modify: `src/pages/customer/MyMembersPage.jsx`

매장 회원 목록에도 만료 임박/거부 상태 배지를 추가.

- [ ] **Step 1: consentStatus 헬퍼 추가**

`src/pages/customer/MyMembersPage.jsx` 상단(import 다음)에 Task 5의 `consentStatus` 함수를 동일하게 복사 추가.

```jsx
function consentStatus(c) {
  if (!c.sms_consent_at) {
    return { label: c.sms_consent ? '동의 (만료일 미설정)' : '미동의', color:'#666', tone:'gray' };
  }
  const consentDate = new Date(c.sms_consent_at);
  const expiry = new Date(consentDate); expiry.setFullYear(expiry.getFullYear() + 1);
  const today = new Date();
  const daysToExpiry = Math.ceil((expiry - today) / (1000*60*60*24));
  if (!c.sms_consent) {
    return { label: '🚫 거부', color:'#c62828', tone:'red', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  if (daysToExpiry <= 14 && daysToExpiry > 0) {
    return { label: `⏳ ${daysToExpiry}일 후 만료`, color:'#e65100', tone:'orange', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  if (daysToExpiry <= 0) {
    return { label: '만료됨', color:'#c62828', tone:'red', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  return { label: `✅ 동의`, color:'#2e7d32', tone:'green', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
}
```

(DRY 관점에서 두 파일에 같은 함수 — 추후 utils로 이동 권장이나 이번 plan 범위 아님.)

- [ ] **Step 2: 표의 SMS 컬럼 렌더 변경**

기존 (약 158-162행):

```jsx
<td style={{textAlign:'center'}}>
  {m.sms_consent
    ? <span style={{color:'var(--success)', fontWeight:700, fontSize:11}}>✅</span>
    : <span style={{color:'var(--text3)', fontSize:11}}>미동의</span>
  }
</td>
```

다음으로 변경:

```jsx
<td style={{textAlign:'center'}}>
  {(() => {
    const st = consentStatus(m);
    return (
      <span style={{
        display:'inline-block', padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:700,
        background: st.tone==='green' ? '#e8f5e9' : st.tone==='orange' ? '#fff3e0' : st.tone==='red' ? '#ffebee' : '#f5f5f5',
        color: st.color,
        border: `1px solid ${st.tone==='green' ? '#a5d6a7' : st.tone==='orange' ? '#ffcc80' : st.tone==='red' ? '#ef9a9a' : '#ddd'}`,
      }} title={st.expireStr ? `만료일: ${st.expireStr}` : ''}>
        {st.label}
      </span>
    );
  })()}
</td>
```

- [ ] **Step 3: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled, 새 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/pages/customer/MyMembersPage.jsx
git commit -m "$(cat <<'EOF'
feat(customer): 매장 회원 목록에 동의 만료/거부 상태 배지

만료 14일 이내는 주황, 거부는 빨강, 정상은 녹색 배지로 통합 표시.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 통합 빌드 + 푸시

- [ ] **Step 1: 최종 빌드**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -15`
Expected: Compiled with warnings, 새 에러 없음.

- [ ] **Step 2: Vercel 환경변수 확인 안내 (수동 단계)**

배포 후 다음을 확인하라고 사용자에게 안내한다:
- `MARKETING_SENDER` 환경변수 — 마케팅 SMS 발신번호 (선택, 미설정 시 기본값 사용)
- `CRON_SECRET` 환경변수 — cron 인증용 (기존 cron-sms와 동일하게 설정)

- [ ] **Step 3: 푸시**

Run: `git push origin main`
Expected: main → main 푸시 성공. Vercel 자동 배포 트리거.

- [ ] **Step 4: 수동 점검 (사용자가 확인)**

```
☐ Supabase SQL Editor에서 Prereq SQL 모두 실행 완료 확인
☐ Vercel 배포 후 cron-marketing이 cron 목록에 등록되었는지 확인
☐ 본사 로그인 → 고객관리 → 수신거부 동기화 메뉴 노출 확인
☐ 문자나라 엑셀 파일 업로드 → 미리보기 → 처리 확인
☐ 회원 조회 페이지에서 거부 토글 + 만료 배지 동작 확인
☐ (선택) cron-marketing 수동 호출하여 동작 검증:
   curl -H "Authorization: Bearer $CRON_SECRET" https://goodmd.app/api/cron-marketing
```

---

## Self-Review

### Spec coverage

| Spec 섹션 | 대응 Task |
|---|---|
| §1 배경 | (배경) |
| §2.1 회원 안내 수신 흐름 | Task 1 (cron) + Task 2 (vercel.json) |
| §2.2 운영자 거부 명단 동기화 | Task 4 (업로드 페이지) |
| §2.3 매장 직원 수동 처리 | Task 5 (CustomerLookupPage 토글) |
| §3.1 DB 컬럼 추가 | Prerequisites (SQL Editor에서) |
| §3.1 마이그레이션 | Prerequisites |
| §4 cron 자동화 | Task 1 + Task 2 (pg_cron 대신 Vercel cron 선택) |
| §5.1 회원 리스트 배지 | Task 5 + Task 6 |
| §5.2 회원 상세 토글 | Task 5 |
| §5.3 수신거부 동기화 페이지 | Task 4 |
| §5.4 SMS 본문 함수 | Task 1 내 `buildMarketingRenewalMessage` |
| §6 SMS 분류 (광고성/정보성) | Task 3 (`kind` 분기) |
| §7 회귀 안전성 | 각 Task의 기존 동작 보존 |
| §8 확정 사항 | 모두 반영 (옵션A, 14일 1회, Vercel cron) |

### Placeholder scan

- "TBD" / "implement later" 없음.
- Task 5 Step 2의 "fetchData/fetchCustomers 이름 확인" 및 Step 4의 "회원 상세 영역 식별" — 코드 읽고 결정해야 하는 부분이지만 명확한 행동 지침 있음. 구체 위치 확인 후 적용하라는 형태로 OK.

### Type consistency

- `consentStatus(c)` 함수 — Task 5와 Task 6에 동일 시그니처 복사.
- `handleToggleConsent` — Task 5에서만 정의 (CustomerLookupPage).
- 컬럼명 일관: `sms_consent`, `sms_consent_at`, `sms_unsubscribed_at`, `sms_schedules.kind`.
- SMS 본문 함수 `buildMarketingRenewalMessage(name, expireDateStr)` — Task 1에서 정의, 다른 곳에서 호출 안 함 (cron 내부에서만).
- cron-marketing 응답 객체 `{ queued, extended, todayStr, expire14Str }` — Task 1에서 정의, 검증용.
