const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://owgsyjbvlqjaqqdgybvv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z3N5amJ2bHFqYXFxZGd5YnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI0NzE0MiwiZXhwIjoyMDg5ODIzMTQyfQ.C9VIcafWOO6wnACSbtKKas7q3kFzA3YKutR3VjhcFOc';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const stores = [
  { accountId:'KBH0001', store:'AK백화점', branch:'AK백화점수원점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경기 수원시 팔달구 덕영대로 924 AK플라자 수원점 B1층 팔레오 매장', open:'2017년 12월', members:[{"name": "이경란", "display_name": "이경란", "job_title": "매니저", "phone": "010-3630-5453", "affil": "신우", "hire": "2024-10-01", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "이미란B", "display_name": "이미란", "job_title": "부매니저", "phone": "010-3108-5332", "affil": "신우", "hire": "2024-11-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0002', store:'AK백화점', branch:'AK백화점평택점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경기 평택시 평택로 51 AK플라자 평택점 B1층 팔레오 매장', open:'2018년 01월', members:[{"name": "민순복", "display_name": "민순복", "job_title": "매니저", "phone": "010-2902-3659", "affil": "한국생활건강", "hire": "2020-06-01", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "나연숙", "display_name": "나연숙", "job_title": "부매니저", "phone": "010-6474-1097", "affil": "한국생활건강", "hire": "2022-08-31", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0003', store:'농협', branch:'농협_SHOP남창원점', weekday:'1~2주 10:30~21:00', weekend:'3~4주 09:00~19:30', addr:'경남 창원시 성산구 가음로 100 남창원농협 농수산물종합유통센터 지상1층 팔레오 매장', open:'2017년 01월', members:[{"name": "양여진", "display_name": "양여진", "job_title": "매니저", "phone": "010-9988-2393", "affil": "한국생활건강", "hire": "2026-01-01", "sal_type": "월급", "sal": 2360000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "김근영", "display_name": "김근영", "job_title": "부매니저", "phone": "010-8277-9448", "affil": "신우", "hire": "2026-03-13", "sal_type": "일급", "sal": 106000, "extra": 0, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0004', store:'대동백화점', branch:'대동백화점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경남 창원시 성산구 원이대로 730 대동백화점 지상1층 팔레오 매장', open:'2016년 12월', members:[{"name": "이경숙B", "display_name": "이경숙", "job_title": "매니저", "phone": "010-5346-9476", "affil": "한국생활건강", "hire": "2021-10-29", "sal_type": "월급", "sal": 2244000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "홍순덕", "display_name": "홍순덕", "job_title": "부매니저", "phone": "010-4870-8799 ", "affil": "한국생활건강", "hire": "2020-07-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0005', store:'갤러리아백화점', branch:'갤러리아백화점광교점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경기 수원시 영통구 광교중앙로 124 갤러리아 광교점 B1층 팔레오 매장', open:'2020년 03월', members:[{"name": "이채영", "display_name": "이채영", "job_title": "매니저", "phone": "010-3779-3161", "affil": "신우", "hire": "2024-03-01", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}] },
  { accountId:'KBH0006', store:'갤러리아백화점', branch:'갤러리아백화점진주점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경남 진주시 진주대로 1095 갤러리아 진주점 B1층 팔레오 매장', open:'2018년 07월', members:[{"name": "박소정", "display_name": "박소정", "job_title": "매니저", "phone": "010-7124-9537", "affil": "한국생활건강", "hire": "2018-07-19", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "박정숙", "display_name": "박정숙", "job_title": "부매니저", "phone": " 010-2976-3139 ", "affil": "한국생활건강", "hire": "2020-07-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0007', store:'갤러리아백화점', branch:'갤러리아백화점천안센터점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'충남 천안시 서북구 공원로 227 갤러리아백화점 센터시티 B1층 팔레오 매장', open:'2018년 07월', members:[{"name": "윤동하", "display_name": "윤동하", "job_title": "매니저", "phone": "010-8384-5615", "affil": "한국생활건강", "hire": "2020-07-05", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "김경숙", "display_name": "김경숙", "job_title": "부매니저", "phone": "010-7703-7499", "affil": "한국생활건강", "hire": "2021-10-29", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0008', store:'갤러리아백화점', branch:'갤러리아백화점타임월드점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'대전 서구 대덕대로 211 갤러리아 타임월드점 B2층 팔레오 매장', open:'2019년 08월', members:[{"name": "이정미", "display_name": "이정미", "job_title": "매니저", "phone": "010-2798-7458", "affil": "한국생활건강", "hire": "2022-08-01", "sal_type": "월급", "sal": 2350000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "이애정", "display_name": "이애정", "job_title": "부매니저", "phone": "010-2405-9028", "affil": "신우", "hire": "2025-08-27", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0009', store:'롯데백화점', branch:'롯데백화점건대시티점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'서울 광진구 능동로 92 롯데백화점 건대스타시티점 B1층 팔레오 매장', open:'2020년 03월', members:[{"name": "이병은", "display_name": "이병은", "job_title": "매니저", "phone": "010-7538-0723", "affil": "한국생활건강", "hire": "2019-08-01", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "신현주", "display_name": "신현주", "job_title": "부매니저", "phone": "010-6396-3802", "affil": "신우", "hire": "2023-11-12", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0010', store:'롯데백화점', branch:'롯데백화점관악점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'서울 관악구 봉천로 209 롯데백화점 관악점 B2층 팔레오 매장', open:'2020년 03월', members:[{"name": "박혜숙", "display_name": "박혜숙", "job_title": "매니저", "phone": "010-3407-1018", "affil": "한국생활건강", "hire": "2020-06-04", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "김연주", "display_name": "김연주", "job_title": "부매니저", "phone": "010-3247-1696", "affil": "한국생활건강", "hire": "2020-04-21", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0011', store:'롯데백화점', branch:'롯데백화점광복점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'부산 중구 중앙동7가 20-1 롯데백화점 광복점 B1층 팔레오 매장', open:'2017년 02월', members:[{"name": "박미진", "display_name": "박미진", "job_title": "매니저", "phone": "010-9956-1860", "affil": "한국생활건강", "hire": "2021-10-26", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "남향숙", "display_name": "남향숙", "job_title": "매니저", "phone": "010-9800-2636", "affil": "한국생활건강", "hire": "2022-08-01", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": false}] },
  { accountId:'KBH0012', store:'롯데백화점', branch:'롯데백화점구리점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경기도 구리시 경춘로 261 (인창동 677) 롯데백화점 구리점 B1층 팔레오매장 ', open:'2022년 02월', members:[{"name": "나효숙", "display_name": "나효숙", "job_title": "매니저", "phone": "010-9776-7006", "affil": "한국생활건강", "hire": "2022-08-01", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "박인숙", "display_name": "박인숙", "job_title": "부매니저", "phone": "010-4388-2791", "affil": "한국생활건강", "hire": "2026-01-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0013', store:'롯데백화점', branch:'롯데백화점대전점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'대전 서구 계룡로 598 롯데백화점 대전점 B1층 팔레오 매장', open:'2020년 06월', members:[{"name": "이경숙A", "display_name": "이경숙", "job_title": "매니저", "phone": "010-8233-7003", "affil": "한국생활건강", "hire": "2022-08-01", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "김경자B", "display_name": "김경자", "job_title": "부매니저", "phone": "010-8822-5616", "affil": "한국생활건강", "hire": "2022-08-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0014', store:'롯데백화점', branch:'롯데백화점미아점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'서울 강북구 도봉로 62 롯데백화점 미아점  B2층 팔레오 매장', open:'2020년 08월', members:[{"name": "송현미", "display_name": "송현미", "job_title": "매니저", "phone": "010-5341-5972", "affil": "한국생활건강", "hire": "2021-11-04", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "정미숙", "display_name": "정미숙", "job_title": "부매니저", "phone": "010-9441-4126", "affil": "한국생활건강", "hire": "2026-01-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0015', store:'롯데백화점', branch:'롯데백화점부산본점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'부산 부산진구 가야대로 772 롯데백화점 부산본점 B2층 팔레오 매장', open:'2017년 01월', members:[{"name": "옥영숙", "display_name": "옥영숙", "job_title": "매니저", "phone": "010-2048-7210", "affil": "한국생활건강", "hire": "2018-11-01", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "이은수", "display_name": "이은수", "job_title": "부매니저", "phone": "010-2859-4110", "affil": "신우", "hire": "2023-11-09", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0016', store:'롯데백화점', branch:'롯데백화점센텀시티점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'부산 해운대구 센텀남대로 59 롯데백화점 센텀시티점 B1층 팔레오 매장', open:'2018년 10월', members:[{"name": "김연후", "display_name": "김연후", "job_title": "매니저", "phone": "010-6299-5457", "affil": "한국생활건강", "hire": "2021-10-24", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "최주연", "display_name": "최주연", "job_title": "부매니저", "phone": "010-9090-9308", "affil": "한국생활건강", "hire": "2022-08-31", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0017', store:'롯데백화점', branch:'롯데백화점영등포점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'서울 영등포구 경인로 846  롯데백화점 영등포점 B1층 팔레오 매장', open:'2025년 08월', members:[{"name": "김영희", "display_name": "김영희", "job_title": "매니저", "phone": "010-6888-8865", "affil": "신우", "hire": "2025-08-01", "sal_type": "월급", "sal": 2350000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "배해옥", "display_name": "배해옥", "job_title": "부매니저", "phone": "010-5467-3720", "affil": "신우", "hire": "2025-08-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0018', store:'롯데백화점', branch:'롯데백화점일산점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경기 고양시 일산동구 중앙로 1283 롯데백화점 일산점 B2층 팔레오 매장', open:'2020년 05월', members:[{"name": "김미경", "display_name": "김미경", "job_title": "매니저", "phone": "010-2232-8025", "affil": "한국생활건강", "hire": "2021-12-20", "sal_type": "월급", "sal": 2350000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "김수연", "display_name": "김수연", "job_title": "부매니저", "phone": "010-7669-1188", "affil": "신우", "hire": "2025-12-06", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0019', store:'롯데백화점', branch:'롯데백화점청량리점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'서울 동대문구 왕산로 214 롯데백화점 청량리점 B2층', open:'2020년 11월', members:[{"name": "박효숙", "display_name": "박효숙", "job_title": "매니저", "phone": "010-4194-1262", "affil": "한국생활건강", "hire": "2022-08-31", "sal_type": "월급", "sal": 2321000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "주수연", "display_name": "주수연", "job_title": "부매니저", "phone": "010-3237-9973", "affil": "신우", "hire": "2025-06-02", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0020', store:'롯데백화점', branch:'롯데백화점포항점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경북 포항시 북구 학산로 62 롯데백화점 포항점 B1층 팔레오 매장', open:'2018년 10월', members:[{"name": "장현숙", "display_name": "장현숙", "job_title": "매니저", "phone": "010-2007-2834", "affil": "신우", "hire": "2026-01-14", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "정의숙", "display_name": "정의숙", "job_title": "부매니저", "phone": "010-4373-5269", "affil": "신우", "hire": "2023-06-05", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0021', store:'신세계백화점', branch:'신세계백화점마산점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'경남 창원시 마산합포구 합포로 251 신세계백화점마산점 B1층 팔레오매장', open:'2024년 07월', members:[{"name": "황경이", "display_name": "황경이", "job_title": "매니저", "phone": "010-4587-0462", "affil": "한국생활건강", "hire": "2018-02-17", "sal_type": "월급", "sal": 2400000, "extra": 0, "leave": "월 8회 휴무", "is_primary": true}, {"name": "김소영", "display_name": "김소영", "job_title": "부매니저", "phone": "010-9055-5648", "affil": "신우", "hire": "2025-11-01", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0022', store:'현대백화점', branch:'현대백화점충청점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'충북 청주시 흥덕구 직지대로 308 현대백화점 충청점 B1층 팔레오 매장', open:'2021년 01월', members:[{"name": "이수자", "display_name": "이수자", "job_title": "매니저", "phone": "010-2254-8136", "affil": "한국생활건강", "hire": "2026-03-01", "sal_type": "월급", "sal": 2350000, "extra": 0, "leave": "주 5일", "is_primary": true}, {"name": "강연숙", "display_name": "강연숙", "job_title": "부매니저", "phone": "010-5417-6482", "affil": "한국생활건강", "hire": "2021-11-29", "sal_type": "일급", "sal": 101000, "extra": 5000, "leave": "56시간미만 연차미지급", "is_primary": false}] },
  { accountId:'KBH0023', store:'그린푸드', branch:'그린푸드_현대대구점', weekday:'10:00~20:00', weekend:'10:00-20:30', addr:'대구광역시 중구 달구벌대로 2077 더현대대구점 검품장', open:'', members:[{"name": "이명자", "display_name": "이명자", "job_title": "매니저", "phone": "010-6522-2574", "affil": "신우", "hire": "2024-06-12", "sal_type": "일급", "sal": 100000, "extra": 6000, "leave": "56시간미만 연차미지급", "is_primary": true}] },
];

async function run() {
  console.log(`총 ${stores.length}개 매장 계정 생성 시작...\n`);
  let ok = 0, fail = 0;

  for (const s of stores) {
    const email = `${s.accountId.toLowerCase()}@kbh.kr`;
    const password = s.accountId;

    // 1. Auth 계정 생성
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (authErr) { console.error(`❌ ${s.accountId} Auth 오류: ${authErr.message}`); fail++; continue; }
    const userId = authData.user.id;

    // 2. profiles 업데이트 (트리거가 자동 생성한 row를 upsert)
    const primary = s.members.find(m => m.is_primary) || s.members[0];
    const { error: profErr } = await supabase.from('profiles').upsert({
      id: userId, email,
      name: primary.name,
      job_title: primary.job_title,
      department: s.store,
      branch: s.branch,
      role: 'user',
      approved: true,
    });
    if (profErr) { console.error(`❌ ${s.accountId} profiles 오류: ${profErr.message}`); fail++; continue; }

    // 3. manager_info 저장 (매장 기본정보)
    const { error: infoErr } = await supabase.from('manager_info').upsert({
      employee_id: s.accountId,
      profile_id: userId,
      store_name: s.store,
      branch_name: s.branch,
      name: primary.name,
      display_name: primary.display_name,
      job_title: primary.job_title,
      phone: primary.phone,
      affiliation: primary.affil,
      hire_date: primary.hire || null,
      salary_type: primary.sal_type,
      salary: primary.sal,
      extra_pay: primary.extra,
      leave_condition: primary.leave,
      weekday_hours: s.weekday,
      weekend_hours: s.weekend,
      store_address: s.addr,
      store_open_date: s.open,
    }, { onConflict: 'employee_id' });
    if (infoErr) { console.error(`❌ ${s.accountId} manager_info 오류: ${infoErr.message}`); fail++; continue; }

    // 4. store_members 저장 (근무자 목록)
    for (const m of s.members) {
      const { error: memErr } = await supabase.from('store_members').insert({
        store_account_id: userId,
        employee_id: s.accountId,
        name: m.name,
        display_name: m.display_name,
        job_title: m.job_title,
        phone: m.phone,
        affiliation: m.affil,
        hire_date: m.hire || null,
        salary_type: m.sal_type,
        salary: m.sal,
        extra_pay: m.extra,
        leave_condition: m.leave,
        is_primary: m.is_primary,
      });
      if (memErr) console.error(`  ⚠️ ${s.accountId} ${m.name} store_members 오류: ${memErr.message}`);
    }

    console.log(`✅ ${s.accountId} ${s.branch} (${s.members.length}인 근무)`);
    ok++;
  }
  console.log(`\n완료: 성공 ${ok}개, 실패 ${fail}개`);
}

run().catch(console.error);
