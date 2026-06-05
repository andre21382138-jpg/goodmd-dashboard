// ────────────────────────────────────────────────────────────────────────
// 점별 판매사원 스케줄표 엑셀 생성
// 양식은 본사가 재무팀에 전달하는 첨부파일과 동일하게 맞춤.
// 폰트 맑은고딕 10pt, 컬럼 폭·행 높이·병합·테두리 모두 재현.
// ────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import { dlBlob } from './utils';

// 1일을 컬럼 T(20)로 잡고 30일까지 → 컬럼 매핑 헬퍼
const colLetter = (idx) => {
  // 1=A, 26=Z, 27=AA, ...
  let s = '';
  let n = idx;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const DOW_KR = ['일','월','화','수','목','금','토'];

// 그날의 일자 컬럼 인덱스 (1일 → T=20, 2일 → 21, ...)
const dayCol = (day) => 19 + day;

// 표시 정책: 휴무신청 × 출근 × 휴무일/공휴일
function calcDayCell({ hasLeave, hasAtt, isHoliday, isFriSatSun, isManager }) {
  if (hasLeave && !hasAtt) return 'X';
  if (hasLeave &&  hasAtt) return '확인필요';
  if (!hasLeave && !hasAtt) return '확인필요';
  // 출근만 (정상)
  if (isHoliday) return isManager ? 'O' : 'O(휴근)';
  if (isFriSatSun) return 'O(연장)';
  return 'O';
}

// 매니저별 회원 가입 인센티브 계산 (기존 IncentivePage 로직 그대로)
async function fetchMemberIncentive(from, to) {
  const calc = (amt) => {
    if (amt >= 200000) return 3000;
    if (amt >= 100000) return 2000;
    if (amt >= 20000)  return 1000;
    return 0;
  };
  const { data: newCustomers } = await supabase.from('customers')
    .select('id, manager_name').eq('sms_consent', true)
    .gte('joined_at', from).lte('joined_at', to);
  const ids = (newCustomers || []).map(c => c.id);
  const salesMap = {};
  if (ids.length > 0) {
    const { data: cs } = await supabase.from('sales')
      .select('customer_id, price, quantity')
      .in('customer_id', ids).gte('sold_at', from).lte('sold_at', to);
    (cs || []).forEach(s => {
      if (!salesMap[s.customer_id]) salesMap[s.customer_id] = 0;
      salesMap[s.customer_id] += (s.price || 0) * (s.quantity || 0);
    });
  }
  const incentiveMap = {};
  (newCustomers || []).forEach(c => {
    if (!c.manager_name) return;
    const inc = calc(salesMap[c.id] || 0);
    if (!incentiveMap[c.manager_name]) incentiveMap[c.manager_name] = 0;
    incentiveMap[c.manager_name] += inc;
  });
  return incentiveMap;
}

// 점포 정렬 우선순위 (엑셀 양식 기준)
const STORE_ORDER = [
  '신세계백화점', '롯데백화점', '갤러리아백화점', '갤러리아', '현대백화점',
  '대동백화점', '농협_SHOP', '농협', 'AK백화점', 'AK플라자', '그린푸드',
  '영남실업', '동화상사', '창원지점(박경원님)', '중소기업명품마루', '특판',
];
const storeRank = (s) => {
  const i = STORE_ORDER.indexOf(s);
  return i === -1 ? 999 : i;
};

export async function downloadPayrollExcel({ year, month }) {
  const monthStr = `${year}-${String(month).padStart(2,'0')}`;
  const lastDay = new Date(year, month, 0).getDate();
  const from = `${monthStr}-01`;
  const to   = `${monthStr}-${String(lastDay).padStart(2,'0')}`;

  // ── 1. 데이터 fetch ──────────────────────────────────
  const [
    { data: members },
    { data: attendance },
    { data: leavePlans },
    incentiveMap,
  ] = await Promise.all([
    supabase.from('store_members')
      .select('id, name, display_name, job_title, salary_type, salary, extra_pay, affiliation, phone, hire_date, store_account_id, store:profiles!store_account_id(department, branch)')
      .order('id', { ascending: true }),
    supabase.from('attendance')
      .select('manager_id, manager_name, work_date')
      .gte('work_date', from).lte('work_date', to),
    supabase.from('leave_plans')
      .select('manager_id, manager_name, dates')
      .eq('target_month', monthStr),
    fetchMemberIncentive(from, to),
  ]);

  // ── 2. 공휴일 (date-holidays) ────────────────────────
  const Holidays = (await import('date-holidays')).default;
  const hd = new Holidays('KR');
  const holidaySet = new Set();
  for (let d = 1; d <= lastDay; d++) {
    if (hd.isHoliday(new Date(year, month-1, d))) holidaySet.add(d);
  }

  // ── 3. lookup 구성 ───────────────────────────────────
  const attLookup = new Set();
  (attendance || []).forEach(r => {
    attLookup.add(`${r.manager_id}|${r.manager_name}|${r.work_date}`);
  });
  const leaveLookup = new Set();
  (leavePlans || []).forEach(p => {
    (p.dates || []).forEach(d => {
      leaveLookup.add(`${p.manager_id}|${p.manager_name}|${d}`);
    });
  });

  // ── 4. 매장 그룹화 ────────────────────────────────────
  const groupMap = new Map();
  for (const m of (members || [])) {
    const dept = m.store?.department || '';
    const branch = m.store?.branch || '';
    if (!dept || !branch) continue;
    const key = `${dept}|${branch}`;
    if (!groupMap.has(key)) groupMap.set(key, { dept, branch, members: [] });
    groupMap.get(key).members.push(m);
  }
  const groups = [...groupMap.values()].sort((a, b) => {
    const ra = storeRank(a.dept), rb = storeRank(b.dept);
    if (ra !== rb) return ra - rb;
    if (a.dept !== b.dept) return a.dept.localeCompare(b.dept);
    return a.branch.localeCompare(b.branch);
  });
  // 각 그룹 내부 정렬: 매니저 먼저, 부매니저 다음
  for (const g of groups) {
    g.members.sort((a, b) => {
      const titleRank = (t) => t === '매니저' ? 0 : t === '부매니저' ? 1 : 2;
      return titleRank(a.job_title) - titleRank(b.job_title);
    });
  }

  // ── 5. 엑셀 생성 ──────────────────────────────────────
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${month}월 스케줄표`);

  // 컬럼 폭 (분석 결과 그대로)
  const widths = {
    A: 6.62, B: 8, C: 8, D: 10.12, E: 6.38, F: 11.12, G: 14.75, H: 9.88,
    I: 7.5, J: 9.38, K: 4.75, L: 6.38, M: 8.43, N: 7.25, O: 8.43,
    P: 10.5, Q: 8.88, R: 8.43, S: 13.25, AX: 6.12, AY: 21.25,
  };
  const totalCols = 51; // A~AY
  for (let i = 1; i <= totalCols; i++) {
    const L = colLetter(i);
    const w = widths[L] || (i >= 20 && i <= 49 ? 6.12 : 8.43);
    ws.getColumn(i).width = w;
  }

  const thin = { style: 'thin', color: { argb: 'FF666666' } };
  const allBorder = { top: thin, bottom: thin, left: thin, right: thin };
  const font10 = { name: '맑은 고딕', size: 10 };
  const font12b = { name: '맑은 고딕', size: 12, bold: true };
  const centerWrap = { horizontal: 'center', vertical: 'center', wrapText: true };

  // Row 1: 제목
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${year}년 ${month}월 점별 판매사원 스케줄표`;
  titleCell.font = font12b;
  titleCell.alignment = centerWrap;
  ws.getRow(1).height = 21;

  // Row 2: 공백
  ws.getRow(2).height = 9.95;

  // Row 3: 기간
  ws.getCell(3, 1).value =
    ` ■ 기간 : ${year}년 ${month}월 1일 ~ ${month}월 ${lastDay}일까지 [${lastDay}일간] / 기본휴무 9번`;
  ws.getCell(3, 1).font = font10;

  // 공휴일 마킹 (row 3 일자 위에)
  for (let d = 1; d <= lastDay; d++) {
    if (holidaySet.has(d)) {
      const c = ws.getCell(3, dayCol(d));
      const info = hd.isHoliday(new Date(year, month-1, d));
      c.value = info && info[0] ? info[0].name : '공휴일';
      c.font = { name: '맑은 고딕', size: 9, color: { argb: 'FFC62828' }, bold: true };
      c.alignment = centerWrap;
    }
  }

  // Row 4~5: 헤더 (대부분 4~5 행 병합)
  const headers = {
    'A4:B5': '매장명',
    'C4:C5': '운영형태',
    'D4:D5': '성명',
    'E4:E5': '연락처',
    'F4:F5': '입사일 /\n근무시작일',
    'G4:G5': '평일 근무시간/\n주말 근무시간',
    'H4:H5': '월급 / 일급',
    'I4:I5': '추가\n수당1',
    'J4:J5': '휴일\n근무수당',
    'K4:K5': '소속',
    'L4:L5': '근무\n일수',
    'M4:M5': '휴무\n일수',
    'N4:N5': '연장근무일수',
    'O4:O5': '휴일근무일수',
    'P4:P5': '월 급여\n금액',
    'Q4:Q5': '추가수당\n금액',
    'R4:R5': '인센티브\n금액',
    'S4:S5': '금액',
    'AY4:AY5': '비고\n(특이사항)',
  };
  for (const [range, val] of Object.entries(headers)) {
    ws.mergeCells(range);
    const start = range.split(':')[0];
    const c = ws.getCell(start);
    c.value = val;
    c.font = font10;
    c.alignment = centerWrap;
    c.border = allBorder;
  }
  // 일자 헤더 (T4~AW4 = 1일~30일), 요일 (T5~AW5)
  for (let d = 1; d <= lastDay; d++) {
    const col = dayCol(d);
    const h4 = ws.getCell(4, col);
    h4.value = `${d}일`;
    h4.font = font10;
    h4.alignment = centerWrap;
    h4.border = allBorder;
    const h5 = ws.getCell(5, col);
    const dow = new Date(year, month-1, d).getDay();
    h5.value = DOW_KR[dow];
    h5.font = { ...font10, color: { argb: dow === 0 ? 'FFC62828' : dow === 6 ? 'FF1565C0' : 'FF000000' } };
    h5.alignment = centerWrap;
    h5.border = allBorder;
  }
  ws.getRow(4).height = 30.75;
  ws.getRow(5).height = 17.25;

  // ── 6. 데이터 행 ──────────────────────────────────────
  let curRow = 6;
  for (const grp of groups) {
    const rowStart = curRow;
    for (const m of grp.members) {
      const isManager = m.job_title === '매니저';

      // 일자별 셀 값 + 통계
      let workDays = 0, extendDays = 0, holidayDays = 0;
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${monthStr}-${String(d).padStart(2,'0')}`;
        const k = `${m.store_account_id}|${m.name}|${dateStr}`;
        const hasAtt = attLookup.has(k);
        const hasLeave = leaveLookup.has(k);
        const dow = new Date(year, month-1, d).getDay();
        const isFriSatSun = dow === 0 || dow === 5 || dow === 6;
        const isHoliday = holidaySet.has(d);
        const val = calcDayCell({ hasLeave, hasAtt, isHoliday, isFriSatSun, isManager });
        if (val.startsWith('O')) workDays++;
        if (val === 'O(연장)') extendDays++;
        if (val === 'O(휴근)') holidayDays++;
        const cell = ws.getCell(curRow, dayCol(d));
        cell.value = val;
        cell.font = font10;
        cell.alignment = centerWrap;
        cell.border = allBorder;
        if (val === 'X') cell.font = { ...font10, color: { argb: 'FFC62828' } };
        else if (val === '확인필요') cell.font = { ...font10, color: { argb: 'FFE65100' }, bold: true };
        else if (val === 'O(연장)') cell.font = { ...font10, color: { argb: 'FF1565C0' } };
        else if (val === 'O(휴근)') cell.font = { ...font10, color: { argb: 'FF6A1B9A' }, bold: true };
      }
      const offDays = lastDay - workDays;

      // 급여 계산
      const isMonthly = m.salary_type === '월급';
      const baseSalary = isMonthly
        ? (m.salary || 0)
        : (m.salary || 0) * (workDays - holidayDays);
      const extraPayAmt = isManager ? '' : ((m.extra_pay || 0) * extendDays);
      const holidayPayAmt = isManager ? '' : Math.round((m.salary || 0) * 1.5 * holidayDays);
      const incentive = incentiveMap[m.name] || 0;
      const total = baseSalary
        + (typeof extraPayAmt === 'number' ? extraPayAmt : 0)
        + (typeof holidayPayAmt === 'number' ? holidayPayAmt : 0)
        + incentive;

      // 컬럼별 값
      const colValues = {
        1: m === grp.members[0] ? grp.dept : null,            // A
        2: m === grp.members[0] ? grp.branch : null,          // B (A:B는 매장명 영역으로 병합되지만 데이터엔 점포/지점 분리)
        3: isManager ? '본매장' : '',                          // C 운영형태
        4: m.display_name || m.name || '',                    // D 성명
        5: m.phone || '',                                     // E 연락처
        6: m.hire_date || '',                                 // F 입사일
        7: '',                                                // G 근무시간
        8: m.salary || 0,                                     // H 월급/일급
        9: isManager ? '' : (m.extra_pay || 0),               // I 추가수당1
        10: isManager ? '' : Math.round((m.salary || 0) * 1.5), // J 휴일근무수당 단가
        11: m.affiliation || '',                              // K 소속
        12: workDays,                                         // L 근무일수
        13: offDays,                                          // M 휴무일수
        14: extendDays,                                       // N 연장근무일수
        15: isManager ? '' : holidayDays,                     // O 휴일근무일수
        16: baseSalary,                                       // P 월급여금액
        17: extraPayAmt,                                      // Q 추가수당 금액
        18: incentive,                                        // R 인센티브 금액
        19: total,                                            // S 합계 금액
        51: '',                                               // AY 비고
      };
      for (let c = 1; c <= totalCols; c++) {
        if (c >= 20 && c <= 49) continue; // 일자 영역은 위에서 처리됨
        if (c === 50) continue; // 빈 컬럼
        const cell = ws.getCell(curRow, c);
        if (colValues[c] !== undefined && colValues[c] !== null) cell.value = colValues[c];
        cell.font = font10;
        cell.alignment = centerWrap;
        cell.border = allBorder;
        // 금액 컬럼 천단위 구분
        if ([8, 9, 10, 16, 17, 18, 19].includes(c) && typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      }
      ws.getRow(curRow).height = 21;
      curRow++;
    }
    // 매장명·지점·운영형태 세로 병합 (다인 매장만)
    if (grp.members.length > 1) {
      ws.mergeCells(rowStart, 1, curRow - 1, 1); // A
      ws.mergeCells(rowStart, 2, curRow - 1, 2); // B
      // C 운영형태는 매니저만 값이 있어 병합하지 않음 (부매니저 행은 빈칸 유지)
    }
  }

  // 다운로드
  const buf = await wb.xlsx.writeBuffer();
  const fname = `${year}년 ${String(month).padStart(2,'0')}월 점별 판매사원 스케줄표.xlsx`;
  dlBlob(buf, fname);
  return { rowCount: curRow - 6, groupCount: groups.length };
}
