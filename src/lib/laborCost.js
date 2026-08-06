// 월별 매장(지점) 판매인건비 자동집계 — 급여관리(payrollExcel)와 동일한 급여 계산 로직 사용
//  · 월급자: 고정 월급
//  · 일급자: 일급 × 근무일수 + 추가수당1 × 연장근무일수 + 휴일근무수당(고정) × 휴일근무일수
//  · 회원가입 인센티브 포함 (매니저별 지급분을 해당 매장에 가산)
import { supabase } from './supabase';
import { calcDayCell, holidayUnitPayFor, fetchMemberIncentive } from './payrollExcel';

export async function computeMonthlyLaborByBranch({ year, month, endDate }) {
  const pad = n => String(n).padStart(2, '0');
  const monthStr = `${year}-${pad(month)}`;
  const lastDay = new Date(year, month, 0).getDate();
  const from = `${monthStr}-01`;
  const fullTo = `${monthStr}-${pad(lastDay)}`;
  // endDate(당월 어제까지 등)가 있으면 그 날짜까지만 집계 (일급 근무일 기준)
  const to = (endDate && endDate < fullTo) ? endDate : fullTo;
  const endDay = Number(to.slice(8, 10));

  const [
    { data: members },
    { data: attendance },
    { data: leavePlans },
    { data: storeClosures },
    incentiveMap,
  ] = await Promise.all([
    supabase.from('store_members')
      .select('id, name, job_title, salary_type, salary, extra_pay, store_account_id, store:profiles!store_account_id(department, branch)')
      .or(`resigned_at.is.null,resigned_at.gte.${monthStr}-01`),
    supabase.from('attendance').select('manager_id, manager_name, work_date').gte('work_date', from).lte('work_date', to),
    supabase.from('leave_plans').select('manager_id, manager_name, dates').eq('target_month', monthStr),
    supabase.from('store_closures').select('store_name, branch_name, dates').eq('target_month', monthStr),
    fetchMemberIncentive(from, to),
  ]);

  const Holidays = (await import('date-holidays')).default;
  const hd = new Holidays('KR');
  const holidaySet = new Set();
  for (let d = 1; d <= lastDay; d++) if (hd.isHoliday(new Date(year, month - 1, d))) holidaySet.add(d);

  const attLookup = new Set();
  (attendance || []).forEach(r => attLookup.add(`${r.manager_id}|${r.manager_name}|${r.work_date}`));
  const leaveLookup = new Set();
  (leavePlans || []).forEach(p => (p.dates || []).forEach(d => leaveLookup.add(`${p.manager_id}|${p.manager_name}|${d}`)));
  const closureMap = new Map();
  (storeClosures || []).forEach(c => {
    const key = `${c.store_name}|${c.branch_name}`;
    if (!closureMap.has(key)) closureMap.set(key, new Set());
    (c.dates || []).forEach(d => closureMap.get(key).add(d));
  });

  const byBranch = new Map(); // 'dept|branch' → { labor: 인건비(원), count: 인원수 }
  let total = 0;
  const addLabor = (dept, branch, labor) => {
    const key = `${dept}|${branch}`;
    const cur = byBranch.get(key) || { labor: 0, count: 0 };
    cur.labor += labor; cur.count += 1;
    byBranch.set(key, cur);
    total += labor;
  };
  // 근무일수/연장/휴일근무 집계 (급여관리와 동일 calcDayCell 로직)
  const countDays = (acct, name, dept, branch, isMonthly) => {
    const closureSet = closureMap.get(`${dept}|${branch}`) || new Set();
    let workDays = 0, extendDays = 0, holidayDays = 0;
    for (let d = 1; d <= endDay; d++) {
      const dateStr = `${monthStr}-${pad(d)}`;
      const k = `${acct}|${name}|${dateStr}`;
      const dow = new Date(year, month - 1, d).getDay();
      const val = calcDayCell({
        isClosed: closureSet.has(dateStr), hasLeave: leaveLookup.has(k), hasAtt: attLookup.has(k),
        isHoliday: holidaySet.has(d), isFriSatSun: dow === 0 || dow === 5 || dow === 6, isManager: isMonthly,
      });
      if (val.startsWith('O')) workDays++;
      if (val === 'O(연장)') extendDays++;
      if (val === 'O(휴근)') holidayDays++;
    }
    return { workDays, extendDays, holidayDays };
  };

  for (const m of (members || [])) {
    const dept = m.store?.department || '', branch = m.store?.branch || '';
    if (!dept || !branch) continue;
    const isMonthly = m.salary_type === '월급';
    const { workDays, extendDays, holidayDays } = countDays(m.store_account_id, m.name, dept, branch, isMonthly);
    const baseSalary = isMonthly ? (m.salary || 0) : (m.salary || 0) * workDays;
    const extra   = isMonthly ? 0 : (m.extra_pay || 0) * extendDays;
    const holiday = isMonthly ? 0 : holidayUnitPayFor(dept, branch) * holidayDays;
    const incentive = incentiveMap[m.name] || 0;
    addLabor(dept, branch, baseSalary + extra + holiday + incentive);
  }

  // 기타근무자 = 출근기록 있으나 store_members 미등록 → 직책 기타근무자·일급 100,000·연장 6,000
  const regSet = new Set((members || []).map(m => `${m.store_account_id}|${m.name}`));
  const acctStore = {};
  (members || []).forEach(m => { if (m.store_account_id && m.store?.department) acctStore[m.store_account_id] = { department: m.store.department, branch: m.store.branch }; });
  const attKeys = new Set();
  (attendance || []).forEach(r => attKeys.add(`${r.manager_id}|${r.manager_name}`));
  const extraKeys = [...attKeys].filter(k => !regSet.has(k));
  const needAccts = [...new Set(extraKeys.map(k => k.slice(0, k.indexOf('|'))))].filter(a => !acctStore[a]);
  if (needAccts.length) {
    const { data: eps } = await supabase.from('profiles').select('id, department, branch').in('id', needAccts);
    (eps || []).forEach(p => { acctStore[p.id] = { department: p.department, branch: p.branch }; });
  }
  for (const k of extraKeys) {
    const i = k.indexOf('|'); const acct = k.slice(0, i), name = k.slice(i + 1);
    const st = acctStore[acct];
    if (!st || !st.department || !st.branch) continue;
    const { workDays, extendDays, holidayDays } = countDays(acct, name, st.department, st.branch, false);
    const labor = 100000 * workDays + 6000 * extendDays + holidayUnitPayFor(st.department, st.branch) * holidayDays + (incentiveMap[name] || 0);
    addLabor(st.department, st.branch, labor);
  }

  return { byBranch, total };
}
