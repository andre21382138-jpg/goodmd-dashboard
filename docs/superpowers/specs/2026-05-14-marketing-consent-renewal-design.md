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

**기존 회원 마이그레이션:**
- 모든 기존 회원: `marketing_consent_at = 가입일(created_at)`, `marketing_consent = true`로 일괄 설정
- 이미 비동의 상태 회원이 있다면 별도 정의 필요 (현재는 컬럼이 없으니 전원 동의 가정)

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

회원 상세에 다음 영역 추가:

```
┌─ 마케팅 수신동의 ──────────────────────────────────┐
│ 상태: ✅ 동의 (~2027-05-14)                        │
│ 동의일: 2026-05-14                                 │
│ [▼ 거부 처리]                                      │
└────────────────────────────────────────────────────┘
```

거부 처리 클릭 시 confirm + DB update + 토스트:
```
회원의 마케팅 수신동의를 거부 처리합니다.
시스템 DB만 업데이트되며, 실제 SMS 차단은
회원이 0808092009로 직접 거부 통화해야 적용됩니다.

진행하시겠습니까?
```

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

## 6. 회귀 영향 / 안전성

- **기존 회원**: 마이그레이션 시 전원 `marketing_consent = true`로 설정. 이전 발송 이력에 따른 추정은 안 함(보수적).
- **거래 안내 SMS**: 마케팅 동의와 무관. `marketing_consent = false` 회원에게도 주문확인/배송 안내 등은 계속 발송 — 발송 로직에서 `kind` 구분 필요.
- **문자나라 DNC와 우리 DB의 불일치**: 자동 동기화가 불가능하므로 약간의 지연/누락 가능. 거부 회원에게 마케팅 발송 요청이 가도 문자나라가 차단하므로 회원에게 실제 도달은 없음.
- **2회 발송 불요**: 1차 안내 후 별도 2차 안내 없음. 무응답자도 만료일에 자동 연장 처리.

## 7. 비목표 (Out of Scope)

- 적극 회신 시 즉시 보상(쿠폰 발급) — 쿠폰 시스템 미구비, 별도 spec 필요
- 카카오 알림톡 — 현재 SMS만 사용
- 문자나라 외 다른 SMS API 통합
- 회원 자체적으로 우리 시스템에서 거부 처리 (예: 마이페이지에서 토글) — 회원 로그인 시스템이 없으므로 비대상
- 휴면계정 처리 (마케팅 동의와 별개 의무)
- 발송 통계/대시보드 (마케팅 동의율 추이 등)

## 8. Open Decisions (구현 직전 결정 필요)

1. **cron 환경 최종 확정**: pg_cron 활성화 가능한가? (Supabase Free 또는 Pro 플랜 따라 다름) — 안 되면 외부 cron으로 fallback
2. **기존 회원 마이그레이션 기준일**: `created_at`을 `marketing_consent_at`으로 쓰면 가장 오래된 회원은 즉시 만료 처리됨 — 마이그레이션 시점부터 1년으로 일괄 초기화하는 게 더 안전(추천)
3. **`sms_schedules.kind` 컬럼 추가 가능 여부 확인** — 기존 SMS와 마케팅 SMS 구분이 필요
4. **발송 시각**: 매일 오전 10시로 표준 (변경 가능)
