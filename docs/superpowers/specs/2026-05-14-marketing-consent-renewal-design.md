# 마케팅 수신동의 1년 자동 갱신 + 재동의 안내 (Design)

작성일: 2026-05-14
대상 영역:
- 회원 마스터(`customers` 테이블) 컬럼 확장
- 회원 관리 페이지(`MyMembersPage`, `CustomerLookupPage`) — 거부 상태 표시 + 수동 토글
- 신규 메뉴: **수신거부 명단 업로드** (문자나라 엑셀)
- 신규 cron: 매일 자정 만료 임박 회원 스캔 → 안내 SMS 스케줄 등록 + 만료일 도래 시 자동 1년 연장
- 외부 SMS API: 문자나라 (`/api/send-sms` 기존 endpoint 재사용, `sms_schedules` 테이블 활용)

## 1. 배경 / 목적

회원의 마케팅 정보 수신동의가 한국 정보통신망법 제50조의8에 따라 일정 주기로 유지 의사를 확인해야 한다. 회사 정책상 **유효기간을 1년**으로 운영하며, 만료 시점 이전에 회원에게 안내 후 재동의 의사를 확인한다.

업계 일반적 패턴(opt-out 방식)을 따라 **무응답은 동의 유지로 간주**하되, 회원이 명시적으로 거부할 수 있는 수단을 제공한다. 거부 수단은 회사가 보유한 무료수신거부 ARS 번호(`0808092009`)로 처리하며, 문자나라가 거부자를 내부 DNC 리스트로 자동 차단한다.

## 2. 사용자 흐름

### 2.1 회원 입장 — 재동의 안내 수신

1. 마케팅 수신동의 만료일 14일 전, 자정 시각 cron이 회원을 스캔하여 SMS 발송 큐(`sms_schedules`)에 등록.
2. 정해진 발송 시각에 문자나라가 LMS 발송:
   ```
   [팔레오] 마케팅 정보 수신동의 안내
   {name}님, {expire}(D-14) 마케팅 정보 수신동의가
   만료됩니다.

   ✅ 무응답 시 1년 자동 연장됩니다.

   1년 재동의 유지 시 혜택:
   · 팔레오 매장 다양한 프로모션·신제품 안내
   · 매장 이용 시 적립금 지급 및 사용 가능
   · 회원 전용 할인·이벤트 우선 안내

   수신거부 전화 : 0808092009 (무료)

   광고주 : (주)한국생활건강
   ```
3. 회원이 별도 조치 없이 14일이 지나면 만료일 자정에 cron이 `marketing_consent_at = NOW()`로 자동 연장.
4. 회원이 0808092009로 전화 ARS 거부 시 → 문자나라가 DNC 리스트에 등록 → 이후 마케팅 SMS 자동 차단.

### 2.2 운영자 입장 — 거부 명단 동기화

1. 운영자가 문자나라 대시보드에서 **수신거부관리** → 엑셀 다운로드(`tlsdbxhd2.xls`).
2. 우리 시스템의 **본사 → 회원관리 → 수신거부 동기화** 페이지 진입.
3. 엑셀 파일 드래그&드롭 또는 선택 업로드.
4. 시스템이 파일 파싱 → 회원 매칭(전화번호) → `marketing_consent = false`, `marketing_unsubscribed_at = (엑셀의 등록일시)` 일괄 업데이트.
5. 결과 요약: "총 N건 처리 — 매칭 M명, 미매칭 K건(신규 회원이 아닌 외부 번호)".

### 2.3 매장 직원 입장 — 회원 응대 시 거부 처리

1. 회원이 매장에서 "마케팅 안 받겠다" 요청.
2. 매장 직원이 회원 카드에서 **마케팅 수신** 토글 OFF.
3. confirm 다이얼로그 표시:
   ```
   회원의 마케팅 수신동의를 거부 처리합니다.

   ⚠️ 시스템 DB만 업데이트되며, 실제 SMS 차단은
   회원이 0808092009로 직접 거부 통화하거나
   운영자가 문자나라 대시보드에서 수동 등록해야
   적용됩니다.

   진행하시겠습니까?
   ```
4. 확인 시 `marketing_consent = false`, `marketing_unsubscribed_at = NOW()` 업데이트.
5. 우리 DB는 갱신되지만 문자나라 발송 차단은 별개 작업으로 운영자가 수동 처리 필요 (한계점).

## 3. 데이터 모델

### 3.1 `customers` 테이블 컬럼 추가

```sql
ALTER TABLE customers
  ADD COLUMN marketing_consent boolean DEFAULT true,
  ADD COLUMN marketing_consent_at timestamptz,
  ADD COLUMN marketing_unsubscribed_at timestamptz;
```

| 컬럼 | 의미 |
|---|---|
| `marketing_consent` | 현재 동의 상태. `false` = 거부됨 |
| `marketing_consent_at` | 동의(또는 직전 자동연장) 시각. 만료일 계산 기준 |
| `marketing_unsubscribed_at` | 거부 처리 시각. 분쟁 입증용 영구 보관 |

**기존 회원 마이그레이션 (옵션 A: 가입일 기준):**

```sql
UPDATE customers SET
  marketing_consent_at = created_at,
  marketing_consent = CASE
    WHEN created_at + interval '1 year' >= CURRENT_DATE THEN true   -- 1년 미만 → 광고성 발송 OK
    ELSE false                                                       -- 1년 이상 → 광고성 발송 X (재동의 못 받은 상태로 간주)
  END;
```

| 가입일 | 동의일로 채움 | 현재 상태 | 발송 가능 |
|---|---|---|---|
| 2023-01-15 (3년 전) | 2023-01-15 | `consent = false` | 정보성만 |
| 2025-08-20 (9개월 전) | 2025-08-20 | `consent = true` | 광고성 + 정보성 |
| 2026-05-07 (1주 전) | 2026-05-07 | `consent = true` | 광고성 + 정보성 |
| 신규 가입 (앞으로) | 가입일 | `consent = true` | 광고성 + 정보성 |

**중요**: 도입 시점에 1년 이미 지난 회원은 안내 SMS도 보내지 않음 (이미 만료 상태). 다음 광고성 동의를 받으려면 매장에서 회원이 다시 동의 의사를 전달해야 함.

### 3.2 만료일 계산

```js
const expiryDate = new Date(marketing_consent_at);
expiryDate.setFullYear(expiryDate.getFullYear() + 1);
```

만료 임박 판정:
- `expiryDate - today === 14일` → 1차 안내 발송
- `expiryDate - today === 0일` → 자동 연장 OR 발송 차단

## 4. cron 자동화

### 4.1 실행 환경

**선택: Supabase pg_cron**

이유:
- goodmd-dashboard는 supabase를 백엔드로 사용 중
- 별도 서버 운영 부담 없음
- DB 작업 + supabase 함수 호출이 SQL로 직접 가능
- 이미 `sms_schedules` 테이블이 존재하므로, cron 함수가 거기에 row insert만 하면 발송은 기존 인프라가 처리

**대안:**
- 외부 cron(cron-job.org 등) + `/api/cron-marketing` endpoint → 코드 가시성 좋지만 서버 추가 노출 면적
- Supabase Edge Function + scheduled trigger → pg_cron이 안 되는 환경에서 대안

기본은 pg_cron으로 진행, 환경 제약 발견되면 외부 cron으로 fallback.

### 4.2 매일 자정 실행 함수 (의사 코드)

DB 함수로 정의 후 pg_cron에서 호출:

```sql
CREATE OR REPLACE FUNCTION run_marketing_consent_cron() RETURNS void AS $$
DECLARE
  c RECORD;
  body text;
  expire_str text;
BEGIN
  -- 1) 14일 후 만료되는 회원에게 안내 SMS 큐 등록
  FOR c IN
    SELECT id, name, phone, marketing_consent_at
    FROM customers
    WHERE marketing_consent = true
      AND phone IS NOT NULL AND phone <> ''
      AND (marketing_consent_at + interval '1 year')::date = (CURRENT_DATE + interval '14 days')::date
      AND NOT EXISTS (
        SELECT 1 FROM sms_schedules s
        WHERE s.kind = 'marketing_renewal_notice'
          AND s.receivers @> jsonb_build_array(jsonb_build_object('phone', c.phone))
          AND s.scheduled_at > (c.marketing_consent_at + interval '11 months')
      )
  LOOP
    expire_str := to_char(c.marketing_consent_at + interval '1 year', 'YYYY-MM-DD');
    body := '[팔레오] 마케팅 정보 수신동의 안내'
         || E'\n\n' || c.name || '님, ' || expire_str || '(D-14) 마케팅 정보 수신동의가'
         || E'\n만료됩니다.'
         || E'\n\n✅ 무응답 시 1년 자동 연장됩니다.'
         || E'\n\n1년 재동의 유지 시 혜택:'
         || E'\n· 팔레오 매장 다양한 프로모션·신제품 안내'
         || E'\n· 매장 이용 시 적립금 지급 및 사용 가능'
         || E'\n· 회원 전용 할인·이벤트 우선 안내'
         || E'\n\n수신거부 전화 : 0808092009 (무료)'
         || E'\n\n광고주 : (주)한국생활건강';
    INSERT INTO sms_schedules (scheduled_at, message, sender, receivers, kind)
    VALUES (
      (CURRENT_DATE + interval '1 day' + interval '10 hours'),  -- 다음날 오전 10시
      body,
      '{기본 발신번호 — 매장별 기본값 또는 회사 대표번호}',
      jsonb_build_array(jsonb_build_object('name', c.name, 'phone', c.phone)),
      'marketing_renewal_notice'
    );
  END LOOP;

  -- 2) 오늘 만료일 도래 + 동의 유지 회원 자동 1년 연장
  UPDATE customers SET marketing_consent_at = NOW()
  WHERE marketing_consent = true
    AND (marketing_consent_at + interval '1 year')::date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- 매일 한국시간 00:00 (UTC 15:00) 실행
SELECT cron.schedule('marketing-consent-cron', '0 15 * * *', $$SELECT run_marketing_consent_cron();$$);
```

**주의 사항:**
- `sms_schedules`에 `kind` 컬럼 없으면 추가 필요 (`kind text`)
- 중복 발송 방지 로직 필수 — 같은 만료 사이클 1회 한정
- 발송 시각은 오전 10시로 표준화 (사용자 친화적)

### 4.3 발송 비용 추정

- 회원 수가 1만명이라 가정, 가입일이 균등 분포일 때 일 평균 약 27명에게 발송
- LMS 건당 약 30~50원 → 일 1,000~1,500원
- 월 환산 약 3~5만원

## 5. UI 변경

### 5.1 회원 카드 / 리스트 — 거부 상태 표시

`MyMembersPage`, `CustomerLookupPage`의 회원 리스트와 상세 영역에:

```jsx
{!c.marketing_consent && (
  <span style={{
    display:'inline-flex', alignItems:'center', gap:3,
    fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99,
    background:'#ffebee', color:'#c62828', border:'1px solid #ef9a9a',
  }}>
    🚫 마케팅 거부
  </span>
)}
```

만료일 임박 표시(선택):
```jsx
{daysToExpiry <= 14 && c.marketing_consent && (
  <span style={{...주황 배지...}}>
    ⏳ {daysToExpiry}일 후 만료
  </span>
)}
```

### 5.2 회원 상세 페이지 — 수동 토글

회원 상세에 다음 영역 추가 (현재 상태에 따라 다른 UI):

**동의 상태일 때:**
```
┌─ 마케팅 수신동의 ──────────────────────────────────┐
│ 상태: ✅ 동의 (~2027-05-14)                        │
│ 동의일: 2026-05-14                                 │
│ [거부 처리]                                         │
└────────────────────────────────────────────────────┘
```

**거부/만료 상태일 때:**
```
┌─ 마케팅 수신동의 ──────────────────────────────────┐
│ 상태: 🚫 거부 (또는 만료)                          │
│ 거부일/만료일: 2026-05-14                          │
│ [동의 처리] ← 회원이 다시 동의 의사 표시한 경우    │
└────────────────────────────────────────────────────┘
```

**거부 처리 클릭:**
```
회원의 마케팅 수신동의를 거부 처리합니다.

⚠️ 시스템 DB만 업데이트되며, 실제 SMS 차단은
회원이 0808092009로 직접 거부 통화하거나
운영자가 문자나라 대시보드에서 수동 등록해야
적용됩니다.

진행하시겠습니까?
```
확인 시: `marketing_consent = false`, `marketing_unsubscribed_at = NOW()`

**동의 처리 클릭** (재동의):
```
회원의 마케팅 수신동의를 다시 활성화합니다.

⚠️ 회원이 직접 매장에서 동의 의사를 명시적으로
표현한 경우에만 진행해주세요.

· 동의일 = 오늘
· 만료일 = 1년 후

진행하시겠습니까?
```
확인 시: `marketing_consent = true`, `marketing_consent_at = NOW()`, `marketing_unsubscribed_at = NULL`

### 5.3 수신거부 명단 동기화 페이지 (신규)

본사 사이드바 회원관리 영역에 신규 메뉴 추가. 정확한 위치는 plan 단계에서 기존 사이드바 구조 확인 후 결정(예: 본사 → 회원관리 또는 본사 → 고객 sub).

페이지 구조:
1. 파일 업로드 박스 (drag&drop 또는 클릭 선택)
2. 업로드 후 미리보기:
   - 파일에서 추출한 전화번호 N건
   - 우리 DB와 매칭된 회원 M명
   - 미매칭 K건 (외부 번호 또는 회원 아닌 사람)
3. [확정 적용] 버튼 클릭 → 매칭된 회원 일괄 `marketing_consent = false` + `marketing_unsubscribed_at = 엑셀의 등록일시`
4. 결과 토스트 + 처리 이력 영구 저장 (선택)

파싱 로직:
```js
// 엑셀 파일을 텍스트로 읽어 HTML 테이블 파싱 (DOMParser)
// 전화번호 컬럼만 추출하여 정규화 (010-XXXX-XXXX → 01012345678)
// customers.phone과 매칭
```

### 5.4 SMS 본문 템플릿 함수

DB 함수 또는 클라이언트에서 본문 생성:

```js
function buildMarketingRenewalMessage(name, expireDateStr) {
  return `[팔레오] 마케팅 정보 수신동의 안내

${name}님, ${expireDateStr}(D-14) 마케팅 정보 수신동의가
만료됩니다.

✅ 무응답 시 1년 자동 연장됩니다.

1년 재동의 유지 시 혜택:
· 팔레오 매장 다양한 프로모션·신제품 안내
· 매장 이용 시 적립금 지급 및 사용 가능
· 회원 전용 할인·이벤트 우선 안내

수신거부 전화 : 0808092009 (무료)

광고주 : (주)한국생활건강`;
}
```

## 6. SMS 발송 분류 (광고성 vs 정보성)

법적으로 두 종류를 명확히 구분해야 한다:

| 분류 | 예시 | 발송 조건 | `marketing_consent` 영향 |
|---|---|---|---|
| **광고성 (Marketing)** | 신상품 안내, 할인 이벤트, 프로모션, 회원의 날 특별 안내 | `marketing_consent = true` 회원만 | ✅ 동의 필요 |
| **정보성 (Informational/Transactional)** | 주문확인, 배송 안내, 적립금 소멸 안내, 휴면계정 전환 안내, 본인인증 등 | 모든 회원 (조건 무관) | ❌ 동의 불필요 |

**`sms_schedules.kind` 컬럼으로 구분:**
- `kind = 'marketing_*'` → 광고성. 발송 직전 회원의 `marketing_consent` 재확인 후 발송
- `kind = 'info_*'` 또는 `kind = 'transaction_*'` → 정보성. 동의 무관 발송

발송 코드(`/api/send-sms` 또는 매장 수동 발송 UI)에서 발송 전 다음 로직 적용:
```js
if (kind.startsWith('marketing_')) {
  // marketing_consent = true인 수신자만 통과
  receivers = receivers.filter(r => isMarketingConsented(r.phone));
}
// info_*, transaction_*는 필터 안 함
```

## 7. 회귀 영향 / 안전성

- **기존 회원 마이그레이션**: 가입일 기준 1년 경과 회원은 자동 `marketing_consent = false`. 매장에서 회원이 다시 동의하면 토글 ON으로 처리(매장 직원 책임).
- **정보성 SMS는 발송 계속**: `marketing_consent = false` 회원에게도 적립금 소멸 안내·주문확인 등은 발송. 발송 로직의 `kind` 분기 필수.
- **문자나라 DNC와 우리 DB의 불일치**: 자동 동기화가 불가능하므로 약간의 지연/누락 가능. 거부 회원에게 마케팅 발송 요청이 가도 문자나라가 차단하므로 회원에게 실제 도달은 없음.
- **2회 발송 불요**: 1차 안내 후 별도 2차 안내 없음. 무응답자도 만료일에 자동 연장 처리.
- **만료 회원에게 안내 SMS 미발송**: 도입 시점에 이미 1년 지난 회원은 cron이 안내 SMS를 보내지 않음 (이미 비동의 상태이므로). 정보성 안내만 가능.

## 7. 비목표 (Out of Scope)

- 적극 회신 시 즉시 보상(쿠폰 발급) — 쿠폰 시스템 미구비, 별도 spec 필요
- 카카오 알림톡 — 현재 SMS만 사용
- 문자나라 외 다른 SMS API 통합
- 회원 자체적으로 우리 시스템에서 거부 처리 (예: 마이페이지에서 토글) — 회원 로그인 시스템이 없으므로 비대상
- 휴면계정 처리 (마케팅 동의와 별개 의무)
- 발송 통계/대시보드 (마케팅 동의율 추이 등)

## 8. 확정된 결정 사항

1. **cron 환경**: Supabase pg_cron 활성화 후 사용 (확정)
2. **기존 회원 마이그레이션**: 옵션 A (가입일 기준 `created_at`) 확정. 1년 경과 회원은 자동 `marketing_consent = false`
3. **`sms_schedules.kind` 컬럼 추가**: 필요. 기존 컬럼 구조 확인 후 plan에서 처리
4. **발송 시각**: 매일 오전 10시 표준
