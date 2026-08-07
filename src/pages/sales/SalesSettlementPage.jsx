import React, { useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';
import { computeMonthlyLaborByBranch } from '../../lib/laborCost';

// 본사 매출정산 — 기간·점포별 상품 단위 정산 + 전월 동기간 비교
//  조회기간: 상품코드/상품명/원가/판매가/판매수량/매출액/할인금액/실제매출/이익/원가비중(%)
//  전월동기간: 판매수량/판매금액(매출액)/할인금액/실제매출
//  전월증감: 실제매출 증감
export default function SalesSettlementPage() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo,   setFTo]   = useState(todayStr);
  const [fStores, setFStores] = useState([]); // 빈 배열 = 전체 점포 (다중 선택)
  const [fBranch, setFBranch] = useState(''); // '' = 전체 지점 (단일 점포 선택 시에만)
  const [storeMenu, setStoreMenu] = useState(false); // 점포 다중선택 드롭다운
  const [cmpFrom, setCmpFrom] = useState(''); // 비교기간 시작 (비우면 자동 전월동기)
  const [cmpTo,   setCmpTo]   = useState(''); // 비교기간 종료 (비우면 자동 전월동기)
  const [rows, setRows] = useState([]);
  const [prevFrom, setPrevFrom] = useState('');
  const [prevTo,   setPrevTo]   = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sortKey, setSortKey] = useState('net');   // 정렬 기준 컬럼 (기본: 실제매출)
  const [sortDir, setSortDir] = useState('desc');  // 'desc' 높은순 / 'asc' 낮은순

  // 매출결산 탭 (점포별 손익 결산 — 월 단위)
  const [tab, setTab] = useState('settlement');    // settlement | closing
  const [clYear, setClYear]   = useState(now.getFullYear());
  const [clMonth, setClMonth] = useState(now.getMonth() + 1);
  const [clRows, setClRows]   = useState([]);
  const [clTotals, setClTotals] = useState(null);
  const [clLoading, setClLoading] = useState(false);
  const [clSearched, setClSearched] = useState(false);
  const [clCappedTo, setClCappedTo] = useState(null); // 당월 어제까지 집계 시 그 날짜
  const [clSortKey, setClSortKey] = useState('');    // 지점별 상세 정렬: '' = 점포순 기본
  const [clSortDir, setClSortDir] = useState('desc'); // desc 높은순 / asc 낮은순
  const [clStoreSortKey, setClStoreSortKey] = useState(''); // 점포별 합산 정렬: '' = 점포순 기본
  const [clStoreSortDir, setClStoreSortDir] = useState('desc');

  // 매장지출 탭
  const [exYear, setExYear]   = useState(now.getFullYear());
  const [exMonth, setExMonth] = useState(now.getMonth() + 1);
  const [exRows, setExRows]   = useState([]);   // 매장별 합계 [{key,dept,branch,total,count}]
  const [exRaw, setExRaw]     = useState([]);   // 원본 지출행 (상세 팝업용)
  const [exLoading, setExLoading] = useState(false);
  const [exSearched, setExSearched] = useState(false);
  const [exDetail, setExDetail] = useState(null); // { dept, branch, items:[...] } 팝업
  const [exSelKeys, setExSelKeys] = useState(new Set()); // 엑셀 다운로드용 지점(행) 선택

  // 전월 동기간 (같은 일자, 월말 초과 시 말일로 보정)
  const prevRange = (from, to) => {
    const back = (s) => {
      const [y, m, d] = s.split('-').map(Number);
      let pm = m - 1, py = y;
      if (pm < 1) { pm = 12; py -= 1; }
      const last = new Date(py, pm, 0).getDate();
      return `${py}-${pad(pm)}-${pad(Math.min(d, last))}`;
    };
    return [back(from), back(to)];
  };

  const fetchRange = async (from, to) => {
    const all = []; let start = 0; const PAGE = 1000;
    while (true) {
      let q = supabase.from('sales')
        .select('product_id, quantity, price, payment, product:products(code, name, price, cost)')
        .neq('payment', '구매이력')
        .gte('sold_at', from).lte('sold_at', to)
        .order('id').range(start, start + PAGE - 1);
      if (fStores.length === 1) q = q.eq('store_name', fStores[0]);
      else if (fStores.length > 1) q = q.in('store_name', fStores);
      if (fStores.length === 1 && fBranch) q = q.eq('branch_name', fBranch);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      start += PAGE;
    }
    return all;
  };

  // 상품 단위 집계 → Map(product_id → {code,name,listPrice,unitCost,qty,gross,net,costTotal})
  const aggregate = (all) => {
    const map = new Map();
    for (const r of all) {
      if (!r.product_id) continue;
      const isReturn = r.payment === '반품' || (Number(r.price) < 0);
      const q = Number(r.quantity) || 0;
      const netQty = isReturn ? -q : q;
      const unitPrice = Number(r.price) || 0;
      const listPrice = Number(r.product?.price) || 0;
      const unitCost  = Number(r.product?.cost) || 0;
      const key = r.product_id;
      if (!map.has(key)) map.set(key, {
        code: r.product?.code || '', name: r.product?.name || '(삭제된 상품)',
        listPrice, unitCost, qty: 0, gross: 0, net: 0, costTotal: 0,
      });
      const g = map.get(key);
      g.qty       += netQty;
      g.gross     += listPrice * netQty;
      g.net       += unitPrice * q;
      g.costTotal += unitCost * netQty;
    }
    return map;
  };

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const [pf, pt] = (cmpFrom && cmpTo) ? [cmpFrom, cmpTo] : prevRange(fFrom, fTo);
      const [curAll, prevAll] = await Promise.all([fetchRange(fFrom, fTo), fetchRange(pf, pt)]);
      const curMap = aggregate(curAll), prevMap = aggregate(prevAll);
      const list = [...curMap.entries()].map(([id, g]) => {
        const p = prevMap.get(id) || { qty:0, gross:0, net:0 };
        return {
          ...g,
          discount: g.gross - g.net,
          profit:   g.net - g.costTotal,
          costPct:  g.net !== 0 ? (g.costTotal / g.net) * 100 : 0,
          prevQty: p.qty, prevGross: p.gross, prevDiscount: (p.gross||0) - (p.net||0), prevNet: p.net,
          diffNet: g.net - (p.net||0),
        };
      });
      list.sort((a, b) => b.net - a.net);
      setPrevFrom(pf); setPrevTo(pt);
      setRows(list);
      setSearched(true);
    } catch (err) {
      toast('조회 실패: ' + (err.message || err), 'err');
    }
    setLoading(false);
  }, [fFrom, fTo, fStores, fBranch, cmpFrom, cmpTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 매출결산: 월 단위 점포/지점별 손익 집계 ──
  const fetchClosingSales = async (year, month, endDate) => {
    const from = `${year}-${pad(month)}-01`;
    const fullTo = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
    const to = (endDate && endDate < fullTo) ? endDate : fullTo;
    const all = []; let start = 0; const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase.from('sales')
        .select('store_name, branch_name, quantity, price, payment, product:products(cost)')
        .neq('payment', '구매이력')
        .gte('sold_at', from).lte('sold_at', to)
        .order('id').range(start, start + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      start += PAGE;
    }
    return all;
  };

  // 특판 B2B 매출(biz_sales) — 월별, 매출결산에 '특판/업체' 행으로 합산
  const fetchClosingBiz = async (year, month, endDate) => {
    const from = `${year}-${pad(month)}-01`;
    const fullTo = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
    const to = (endDate && endDate < fullTo) ? endDate : fullTo;
    const all = []; let start = 0; const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase.from('biz_sales')
        .select('company_name, quantity, supply_price, product:products(cost)')
        .gte('sold_at', from).lte('sold_at', to)
        .order('id').range(start, start + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      start += PAGE;
    }
    return all;
  };

  const searchClosing = useCallback(async () => {
    setClLoading(true);
    try {
      // 당월이면 어제날짜까지만 (오늘 미완료분 제외)
      const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const yestKst  = new Date(Date.now() + 9 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const isCurMonth = `${clYear}-${pad(clMonth)}` === todayKst.slice(0, 7);
      const endDate = isCurMonth ? yestKst : null;
      setClCappedTo(endDate);
      const [sales, labor, biz] = await Promise.all([
        fetchClosingSales(clYear, clMonth, endDate),
        computeMonthlyLaborByBranch({ year: clYear, month: clMonth, endDate }),
        fetchClosingBiz(clYear, clMonth, endDate),
      ]);
      const map = new Map();
      const ensure = (dept, branch) => {
        const key = `${dept}|${branch}`;
        if (!map.has(key)) map.set(key, { key, dept, branch, revenue:0, soldCost:0, giftCost:0, tastingCost:0, labor:0, headcount:0 });
        return map.get(key);
      };
      for (const r of sales) {
        const g = ensure(r.store_name || '(미지정)', r.branch_name || '(미지정)');
        const q = Number(r.quantity) || 0;
        const price = Number(r.price) || 0;
        const cost = Number(r.product?.cost) || 0;
        const isReturn = r.payment === '반품' || price < 0;
        const netQty = isReturn ? -q : q;
        g.revenue += price * q;                       // C 매출액 (반품 음수·증정/시식 0 자동)
        if (r.payment === '증정')      g.giftCost    += cost * q;   // I
        else if (r.payment === '시식') g.tastingCost += cost * q;   // J
        else                           g.soldCost    += cost * netQty; // H (반품은 음수로 차감)
      }
      // 특판 B2B(biz_sales) → '특판 / 업체' 행 (매출액=공급가×수량, 원가=상품원가×수량, 증정/시식·인건비 없음)
      for (const b of biz) {
        const g = ensure('특판', b.company_name || '(미지정)');
        const q = Number(b.quantity) || 0;
        g.revenue  += (Number(b.supply_price) || 0) * q;
        g.soldCost += (Number(b.product?.cost) || 0) * q;
      }
      for (const [key, info] of labor.byBranch.entries()) {
        const [dept, branch] = key.split('|');
        const g = ensure(dept, branch);
        g.labor += info.labor;
        g.headcount += info.count;
      }
      const list = [...map.values()].map(g => {
        const totalCost = g.soldCost + g.giftCost + g.tastingCost;
        return { ...g, totalCost, gtPct: g.revenue ? ((g.giftCost + g.tastingCost) / g.revenue) * 100 : 0 };
      });
      const rank = s => { const i = STORE_NAMES.indexOf(s); return i === -1 ? 999 : i; };
      list.sort((a, b) => rank(a.dept) - rank(b.dept) || a.dept.localeCompare(b.dept) || a.branch.localeCompare(b.branch, 'ko'));
      const sum = (k) => list.reduce((s, r) => s + r[k], 0);
      setClRows(list);
      setClTotals({ revenue: sum('revenue'), soldCost: sum('soldCost'), giftCost: sum('giftCost'),
        tastingCost: sum('tastingCost'), totalCost: sum('totalCost'), labor: sum('labor'), headcount: sum('headcount') });
      setClSearched(true);
    } catch (err) {
      toast('결산 조회 실패: ' + (err.message || err), 'err');
    }
    setClLoading(false);
  }, [clYear, clMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 매장지출: 월별 매장(지점)별 총 지출 + 일자별 상세 ──
  const searchExpense = useCallback(async () => {
    setExLoading(true);
    try {
      const from = `${exYear}-${pad(exMonth)}-01`;
      const to   = `${exYear}-${pad(exMonth)}-${pad(new Date(exYear, exMonth, 0).getDate())}`;
      const all = []; let start = 0; const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase.from('store_expenses')
          .select('store_name, branch_name, expense_date, category, amount, memo')
          .gte('expense_date', from).lte('expense_date', to)
          .order('expense_date').order('id').range(start, start + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        start += PAGE;
      }
      const map = new Map();
      for (const e of all) {
        const key = `${e.store_name}|${e.branch_name}`;
        if (!map.has(key)) map.set(key, { key, dept: e.store_name, branch: e.branch_name, total: 0, count: 0 });
        const g = map.get(key); g.total += e.amount || 0; g.count += 1;
      }
      const rank = s => { const i = STORE_NAMES.indexOf(s); return i === -1 ? 999 : i; };
      const list = [...map.values()].sort((a, b) => rank(a.dept) - rank(b.dept) || a.dept.localeCompare(b.dept) || a.branch.localeCompare(b.branch, 'ko'));
      setExRaw(all);
      setExRows(list);
      setExSelKeys(new Set(list.map(r => r.key))); // 기본 전체 지점 선택
      setExSearched(true);
    } catch (err) {
      toast('지출 조회 실패: ' + (err.message || err), 'err');
    }
    setExLoading(false);
  }, [exYear, exMonth]);

  const openExDetail = (row) => {
    const items = exRaw
      .filter(e => e.store_name === row.dept && e.branch_name === row.branch)
      .sort((a, b) => (a.expense_date < b.expense_date ? -1 : a.expense_date > b.expense_date ? 1 : 0));
    setExDetail({ dept: row.dept, branch: row.branch, total: row.total, items });
  };
  const exTotal = exRows.reduce((s, r) => s + r.total, 0);

  // 지출결의서 엑셀 다운로드 (점포 선택 → 지점별 시트)
  const abbrStore = s => (s || '').replace('백화점', '').replace('_SHOP', '');
  const BRANCH_ABBR = { '건대스타시티점': '건대' };
  const abbrBranch = b => BRANCH_ABBR[b] || (b || '').replace(/점$/, '');
  const sheetTitle = (dept, branch, mgr) => `${abbrStore(dept)}_${abbrBranch(branch)}${mgr ? '_' + mgr : ''}`
    .replace(/[\\/?*[\]:]/g, '').slice(0, 31);

  const buildExpenseSheet = (ws, items, manager, year, month) => {
    const FONT = { name: '굴림체', size: 10 };
    const thin = { style: 'thin' }, medium = { style: 'medium' };
    const box = () => ({ top: thin, left: thin, bottom: thin, right: thin });
    const pad = n => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;
    const total = items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const N = Math.max(16, items.length);
    [5, 8.875, 11.625, 4, 7.875, 9.25, 9.25, 9.25, 9.25, 9.25].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const set = (addr, val, opt = {}) => {
      const c = ws.getCell(addr);
      if (val !== undefined) c.value = val;
      c.font = { ...FONT, ...(opt.font || {}) };
      c.alignment = { vertical: 'middle', horizontal: opt.h || 'center', wrapText: !!opt.wrap };
      if (opt.border) c.border = opt.border;
      if (opt.numFmt) c.numFmt = opt.numFmt;
      if (opt.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opt.fill } };
      return c;
    };
    // 결재란
    ['C1:D1', 'E1:F1', 'G1:H1', 'I1:J1', 'C2:D2', 'E2:F2', 'G2:H2', 'I2:J2'].forEach(m => ws.mergeCells(m));
    [['C1', '담당'], ['E1', '팀장'], ['G1', '사업팀장'], ['I1', '대표']].forEach(([a, t]) => set(a, t, { border: box() }));
    ['C2', 'E2', 'G2', 'I2'].forEach(a => set(a, '', { border: box() }));
    ws.getRow(1).height = 23.25; ws.getRow(2).height = 49.5; ws.getRow(3).height = 16.5;
    // 제목
    ws.mergeCells('B4:J5'); set('B4', '현금 지출 결의서', { font: { size: 20, bold: true }, border: { top: medium, left: medium, right: medium } });
    ws.getRow(4).height = 20.1; ws.getRow(5).height = 20.1;
    // 일금
    ws.getRow(6).height = 20.1; ws.getRow(7).height = 20.1;
    set('G6', '  일금:', { h: 'left', fill: 'FFFFFF00', border: { bottom: thin } });
    ws.mergeCells('H6:I6'); set('H6', total, { h: 'right', numFmt: '"₩"#,##0', font: { size: 11 }, fill: 'FFFFFF00', border: { bottom: thin } });
    set('J6', '원 정', { border: { right: medium } });
    // 작성일 행
    ws.getRow(8).height = 20.1;
    ['C8:D8', 'F8:G8', 'I8:J8'].forEach(m => ws.mergeCells(m));
    set('B8', '작성일', { border: { top: thin, bottom: thin, left: medium, right: thin } });
    set('C8', endDate, { border: box() });
    set('E8', '지출일', { border: box() });
    set('F8', '', { border: box() });
    set('H8', '계정과목', { border: box() });
    set('I8', '', { border: { top: thin, bottom: thin, left: thin, right: medium } });
    // 내역 헤더
    ws.mergeCells('B9:J10'); set('B9', '내           역', { font: { size: 12 }, border: { left: medium, right: medium, top: thin } });
    ws.getRow(9).height = 20.1; ws.getRow(10).height = 20.1;
    // 컬럼 헤더
    ws.getRow(11).height = 13.5;
    ['B11:E11', 'F11:H11', 'I11:J11'].forEach(m => ws.mergeCells(m));
    set('B11', '적  요', { border: { top: thin, bottom: thin, left: medium, right: thin } });
    set('F11', ' 금 액', { border: box() });
    set('I11', '비 고', { border: { top: thin, bottom: thin, left: thin, right: medium } });
    // 데이터 행
    let r = 12;
    for (let i = 0; i < N; i++, r++) {
      ws.getRow(r).height = 20.1;
      [`C${r}:E${r}`, `F${r}:H${r}`, `I${r}:J${r}`].forEach(m => ws.mergeCells(m));
      const it = items[i];
      const dstr = it ? `${Number(it.expense_date.slice(5, 7))}/${Number(it.expense_date.slice(8, 10))}` : '';
      set(`B${r}`, dstr, { numFmt: '@', border: { top: thin, bottom: thin, left: medium, right: thin } });
      set(`C${r}`, it ? it.category : '', { h: 'left', border: box() });
      set(`F${r}`, it ? (Number(it.amount) || 0) : null, { h: 'right', numFmt: '#,##0', border: box() });
      set(`I${r}`, it ? (it.memo || '') : '', { border: { top: thin, bottom: thin, left: thin, right: medium } });
    }
    // 계
    ws.getRow(r).height = 20.1;
    [`B${r}:E${r}`, `F${r}:H${r}`, `I${r}:J${r}`].forEach(m => ws.mergeCells(m));
    set(`B${r}`, '계', { border: { top: thin, bottom: medium, left: medium, right: thin } });
    set(`F${r}`, total, { h: 'right', numFmt: '"₩"#,##0', border: { top: thin, bottom: medium, left: thin, right: thin } });
    set(`I${r}`, '', { border: { top: thin, bottom: medium, left: thin, right: medium } });
    r += 2;
    ws.mergeCells(`B${r}:J${r}`); set(`B${r}`, '위 금액을 영수(청구) 합니다.'); ws.getRow(r).height = 18; r += 2;
    ws.mergeCells(`B${r}:J${r}`); set(`B${r}`, `${year} 년 ${pad(month)}월 ${pad(lastDay)}일`); ws.getRow(r).height = 18; r += 2;
    ws.mergeCells(`B${r}:J${r}`); set(`B${r}`, `지출자 :   ${manager || ''}  (인)`); ws.getRow(r).height = 18;
    ws.pageSetup = { paperSize: 9, orientation: 'portrait', horizontalCentered: true, verticalCentered: true,
      margins: { left: 0.236, right: 0.236, top: 0.748, bottom: 0.748, header: 0.315, footer: 0.315 }, showGridLines: false };
  };

  const exportExpenseExcel = async () => {
    const targets = exRows.filter(r => exSelKeys.has(r.key));
    if (targets.length === 0) { toast('선택한 매장이 없습니다', 'err'); return; }
    const ExcelJS = (await import('exceljs')).default;
    const { dlBlob } = await import('../../lib/utils');
    const { data: profs } = await supabase.from('profiles').select('department, branch, name').eq('approved', true).eq('job_title', '매니저');
    const mgrMap = {}; (profs || []).forEach(p => { mgrMap[`${p.department}|${p.branch}`] = p.name; });
    const wb = new ExcelJS.Workbook();
    const used = new Set();
    for (const t of targets) {
      const items = exRaw.filter(e => e.store_name === t.dept && e.branch_name === t.branch)
        .sort((a, b) => (a.expense_date < b.expense_date ? -1 : a.expense_date > b.expense_date ? 1 : 0));
      const manager = mgrMap[`${t.dept}|${t.branch}`] || '';
      let name = sheetTitle(t.dept, t.branch, manager); let nm = name, k = 1;
      while (used.has(nm)) { nm = (name.slice(0, 28) + '_' + (++k)); } used.add(nm);
      buildExpenseSheet(wb.addWorksheet(nm), items, manager, exYear, exMonth);
    }
    const buf = await wb.xlsx.writeBuffer();
    dlBlob(buf, `판매사원 지출결의서_${exYear}년${String(exMonth).padStart(2, '0')}월.xlsx`);
  };

  // ── 매출결산 엑셀 다운로드 (점포별 결산 손익보고서 양식 재현) ──
  const exportClosingExcel = async () => {
    if (clRows.length === 0) { toast('조회된 데이터가 없습니다', 'err'); return; }
    const ExcelJS = (await import('exceljs')).default;
    const { dlBlob } = await import('../../lib/utils');
    const colL = (c) => { let s = '', n = c; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
    const FONT = { name: '맑은 고딕', size: 11 };
    const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const YELLOW = new Set(['C', 'D', 'G', 'H', 'I', 'J', 'K', 'S', 'T']);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('매출손익');

    const widths = { A: 11.625, B: 15.125, E: 18.75, H: 13, K: 11, L: 14.375, M: 11, N: 11, O: 15.125, P: 15.125, Q: 15.125, T: 11 };
    for (let c = 1; c <= 25; c++) ws.getColumn(c).width = widths[colL(c)] ?? 8.43;

    ws.getCell('A3').value = `점포별 결산 손익보고서  (${clYear}년 ${clMonth}월${clCappedTo ? ` 1일~${clCappedTo.slice(5)}` : ''})`;
    ws.getCell('A3').font = { ...FONT, size: 14, bold: true };
    ws.getCell('A5').value = '구분';
    ws.getCell('A5').font = { ...FONT, bold: true };

    const HEADERS = ['지점명', '매장명', '매출액', '매출비율', '공급가\n(수수료제외금액)', '수수료율', '전체원가', '판매제품원가', '증정원가', '시식원가', '증정시식율', '제품원가2\n(SCM 인건비)', '매출이익', '판관비\n소계', '광고비\n(상품권비용 등)', '결제\n수수료', '물류비\n소계', '부서비용', '판매\n인건비', '판매인건비\n비율', '부가세', '영업이익', '본사\n인건비+제품개발', '순이익', '비고'];
    const hr = ws.getRow(6); hr.height = 49.5;
    HEADERS.forEach((h, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = h; cell.font = { ...FONT }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = border;
      if (YELLOW.has(colL(i + 1))) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    });

    const totRev = clTotals.revenue, totLab = clTotals.labor;
    const pct = (n, d) => (d ? (n / d) * 100 : 0);
    const dataOf = (g) => ({
      revenue: g.revenue, totalCost: g.totalCost, soldCost: g.soldCost, giftCost: g.giftCost, tastingCost: g.tastingCost, labor: g.labor,
      dpct: pct(g.revenue, totRev), kpct: g.revenue ? pct(g.giftCost + g.tastingCost, g.revenue) : 0, tpct: pct(g.labor, totLab),
    });
    let r = 7;
    const put = (a, b, d, { merge = false, bold = false, fill = null } = {}) => {
      const row = ws.getRow(r); row.height = 16.5;
      const map = { 1: a, 2: b, 3: d?.revenue, 4: d?.dpct, 7: d?.totalCost, 8: d?.soldCost, 9: d?.giftCost, 10: d?.tastingCost, 11: d?.kpct, 19: d?.labor, 20: d?.tpct };
      for (let c = 1; c <= 25; c++) {
        const cell = row.getCell(c);
        if (map[c] !== undefined && map[c] !== null) cell.value = map[c];
        cell.font = { ...FONT, bold }; cell.border = border;
        if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        if ([3, 7, 8, 9, 10, 19].includes(c)) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
        else if ([4, 11, 20].includes(c)) { cell.numFmt = '0.0"%"'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
        else cell.alignment = { vertical: 'middle', horizontal: c <= 2 ? 'center' : 'right' };
      }
      if (merge) ws.mergeCells(r, 1, r, 2);
      r++;
    };

    put('총 합계', '', dataOf({ ...clTotals }), { merge: true, bold: true, fill: 'FFF2F2F2' });
    const rank = s => { const i = STORE_NAMES.indexOf(s); return i === -1 ? 999 : i; };
    const stores = [...new Set(clRows.map(x => x.dept))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    for (const st of stores) {
      const brs = clRows.filter(x => x.dept === st);
      const sub = brs.reduce((t, x) => ({ revenue: t.revenue + x.revenue, totalCost: t.totalCost + x.totalCost, soldCost: t.soldCost + x.soldCost, giftCost: t.giftCost + x.giftCost, tastingCost: t.tastingCost + x.tastingCost, labor: t.labor + x.labor }), { revenue: 0, totalCost: 0, soldCost: 0, giftCost: 0, tastingCost: 0, labor: 0 });
      put(`${st} 소계`, '', dataOf(sub), { merge: true, bold: true, fill: 'FFF7F7F7' });
      for (const x of brs) put(st, x.branch, dataOf(x));
    }

    const buf = await wb.xlsx.writeBuffer();
    dlBlob(buf, `매출결산_${clYear}년${String(clMonth).padStart(2, '0')}월.xlsx`);
  };

  const totals = rows.reduce((t, r) => ({
    qty: t.qty + r.qty, gross: t.gross + r.gross, discount: t.discount + r.discount,
    net: t.net + r.net, cost: t.cost + r.costTotal, profit: t.profit + r.profit,
    pQty: t.pQty + r.prevQty, pGross: t.pGross + r.prevGross, pDiscount: t.pDiscount + r.prevDiscount, pNet: t.pNet + r.prevNet,
  }), { qty:0, gross:0, discount:0, net:0, cost:0, profit:0, pQty:0, pGross:0, pDiscount:0, pNet:0 });
  const totalCostPct = totals.net !== 0 ? (totals.cost / totals.net) * 100 : 0;
  const totalDiff = totals.net - totals.pNet;

  // 컬럼 클릭 정렬: 같은 컬럼 재클릭 시 방향 토글, 다른 컬럼 클릭 시 높은순부터
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = Number(a[sortKey]) || 0, bv = Number(b[sortKey]) || 0;
      return (av - bv) * dir;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const won = (n) => Math.round(n || 0).toLocaleString();
  const diffCell = (v) => {
    const up = v >= 0;
    return <span style={{ color: up ? '#1b5e20' : '#c62828', fontWeight:700 }}>{up ? '▲' : '▼'} {won(Math.abs(v))}</span>;
  };
  const tabBtn = (on) => ({ height:40, padding:'0 22px', borderRadius:'var(--radius)', border:'2px solid', cursor:'pointer', fontSize:14, fontWeight:700,
    borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'var(--accent)' : '#fff', color: on ? '#fff' : 'var(--text2)' });
  const pctOf = (n, d) => (d ? (n / d) * 100 : 0);
  const pctStr = (v) => `${v.toFixed(1)}%`;
  const handleClSort = (key) => {
    if (clSortKey !== key) { setClSortKey(key); setClSortDir('desc'); }   // 1클릭: 높은순
    else if (clSortDir === 'desc') setClSortDir('asc');                    // 2클릭: 낮은순
    else { setClSortKey(''); setClSortDir('desc'); }                       // 3클릭: 점포순 복귀
  };
  const sortedClRows = useMemo(() => {
    if (!clSortKey) return clRows;
    const dir = clSortDir === 'asc' ? 1 : -1;
    return [...clRows].sort((a, b) => ((Number(a[clSortKey]) || 0) - (Number(b[clSortKey]) || 0)) * dir);
  }, [clRows, clSortKey, clSortDir]);
  // 점포별 합산 (지점 → 점포 단위로 묶음, clRows의 점포순 유지)
  const clStoreRows = useMemo(() => {
    const m = new Map();
    for (const r of clRows) {
      if (!m.has(r.dept)) m.set(r.dept, { dept:r.dept, revenue:0, soldCost:0, giftCost:0, tastingCost:0, totalCost:0, labor:0, headcount:0, branches:0 });
      const g = m.get(r.dept);
      g.revenue += r.revenue; g.soldCost += r.soldCost; g.giftCost += r.giftCost; g.tastingCost += r.tastingCost;
      g.totalCost += r.totalCost; g.labor += r.labor; g.headcount += r.headcount; g.branches += 1;
    }
    return [...m.values()].map(g => ({ ...g, gtPct: g.revenue ? ((g.giftCost + g.tastingCost) / g.revenue) * 100 : 0 }));
  }, [clRows]);
  const sortedClStoreRows = useMemo(() => {
    if (!clStoreSortKey) return clStoreRows;
    const dir = clStoreSortDir === 'asc' ? 1 : -1;
    return [...clStoreRows].sort((a, b) => ((Number(a[clStoreSortKey]) || 0) - (Number(b[clStoreSortKey]) || 0)) * dir);
  }, [clStoreRows, clStoreSortKey, clStoreSortDir]);
  const handleClStoreSort = (key) => {
    if (clStoreSortKey !== key) { setClStoreSortKey(key); setClStoreSortDir('desc'); }
    else if (clStoreSortDir === 'desc') setClStoreSortDir('asc');
    else { setClStoreSortKey(''); setClStoreSortDir('desc'); }
  };
  const clStoreTh = (label, key) => {
    const active = clStoreSortKey === key;
    return (
      <th className="r" onClick={() => handleClStoreSort(key)} title="클릭하여 정렬 (3번째 클릭 시 점포순)"
        style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap', color: active ? 'var(--accent)' : undefined }}>
        {label}<span style={{ marginLeft:2, fontSize:10, opacity: active ? 1 : 0.4 }}>{active ? (clStoreSortDir === 'desc' ? '▼' : '▲') : '⇅'}</span>
      </th>
    );
  };
  const clTh = (label, key) => {
    const active = clSortKey === key;
    return (
      <th className="r" onClick={() => handleClSort(key)} title="클릭하여 정렬"
        style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap', color: active ? 'var(--accent)' : undefined }}>
        {label}<span style={{ marginLeft:2, fontSize:10, opacity: active ? 1 : 0.4 }}>{active ? (clSortDir === 'desc' ? '▼' : '▲') : '⇅'}</span>
      </th>
    );
  };

  // ERP '기간별상품매출현황' 양식(굴림 9pt·흰 배경·천단위·2줄 헤더·순번·합계 상단)과
  // 동일하게 출력한다. (열너비/행높이/폰트/정렬/테두리/숫자서식 모두 샘플 파일 기준)
  const exportExcel = async () => {
    if (rows.length === 0) { toast('조회된 데이터가 없습니다', 'err'); return; }
    const ExcelJS = (await import('exceljs')).default;
    const { dlBlob } = await import('../../lib/utils');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('sheet1');
    const ymd = s => (s || '').replace(/-/g, '');

    // ── 데이터 채우기 ──
    ws.addRow(['기간별상품매출현황']);                       // 1 제목
    ws.addRow([]);                                          // 2
    ws.addRow([`조회기간-시작  = ${ymd(fFrom)}`]);           // 3
    ws.addRow([`조회기간-종료  = ${ymd(fTo)}`]);             // 4
    ws.addRow([`그룹 =  ${fStores.length ? fStores.join(', ') : '전체'}`]);              // 5 점포
    ws.addRow([`매장 =  ${fBranch || '전체'}`]);             // 6 지점
    ws.addRow([]);                                          // 7
    ws.addRow([]);                                          // 8
    ws.addRow(['순번','상품코드','상품명','원가','판매가','조회기간','','','','','','전월 동기간','','','','전월증감비교']); // 9
    ws.addRow(['','','','','','판매수량','매출액','할인금액','실제매출','이익','원가비중','판매수량','판매금액','할인금액','실제매출','실제매출']);           // 10
    ws.addRow(['','','합 계','','', totals.qty, Math.round(totals.gross), Math.round(totals.discount), Math.round(totals.net), null, null,
               totals.pQty, Math.round(totals.pGross), Math.round(totals.pDiscount), Math.round(totals.pNet), Math.round(totalDiff)]); // 11 합계
    rows.forEach((r, i) => {
      ws.addRow([
        i + 1, r.code, r.name, Math.round(r.unitCost), Math.round(r.listPrice),
        r.qty, Math.round(r.gross), Math.round(r.discount), Math.round(r.net), Math.round(r.profit),
        r.unitCost > 0 ? Number(r.costPct.toFixed(1)) : null,
        r.prevQty, Math.round(r.prevGross), Math.round(r.prevDiscount), Math.round(r.prevNet), Math.round(r.diffNet),
      ]);
    });

    // ── 병합 ──
    ws.mergeCells('A1:P1');
    ['A3:P3','A4:P4','A5:P5','A6:P6'].forEach(m => ws.mergeCells(m));
    ['A9:A10','B9:B10','C9:C10','D9:D10','E9:E10'].forEach(m => ws.mergeCells(m));
    ws.mergeCells('F9:K9'); ws.mergeCells('L9:O9');

    // ── 열너비 (샘플과 동일) ──
    [5.6,14,43.4,12.6,12,13.1,12.7,15.6,15.9,9.9,9.9,8.4,12.7,9.9,9.9,12.7]
      .forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });

    // ── 서식 ──
    const F = (bold) => ({ name: '굴림', size: 9, bold: !!bold });
    const thin = { style: 'thin', color: { argb: 'FF000000' } };
    const box = { top: thin, left: thin, bottom: thin, right: thin };
    const money = [4,5,7,8,9,10,13,14,15,16];
    const qty = [6,12];
    const lastRow = ws.rowCount;

    // 제목
    ws.getRow(1).height = 18;
    Object.assign(ws.getCell('A1'), { font: F(true), alignment: { horizontal: 'center', vertical: 'middle' } });
    // 필터 4줄 (좌측 정렬)
    [3,4,5,6].forEach(rn => { const c = ws.getCell(rn, 1); c.font = F(false); c.alignment = { horizontal: 'left', vertical: 'middle' }; });
    // 헤더 2줄
    ws.getRow(9).height = 18; ws.getRow(10).height = 27;
    for (const rn of [9,10]) for (let cn = 1; cn <= 16; cn++) {
      const c = ws.getCell(rn, cn);
      c.font = F(true); c.border = box;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    // 합계 + 데이터
    for (let rn = 11; rn <= lastRow; rn++) {
      ws.getRow(rn).height = 15;
      const isSum = rn === 11;
      for (let cn = 1; cn <= 16; cn++) {
        const c = ws.getCell(rn, cn);
        c.font = F(isSum); c.border = box;
        let h = 'right';
        if (cn === 1 || cn === 2) h = 'center';
        else if (cn === 3) h = isSum ? 'center' : 'left';
        c.alignment = { horizontal: h, vertical: 'middle' };
        if (money.includes(cn) || qty.includes(cn)) c.numFmt = '#,##0';
        else if (cn === 11) c.numFmt = '0.0';
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const scope = fBranch || (fStores.length === 1 ? fStores[0] : fStores.length ? `${fStores.length}개점포` : '전체');
    dlBlob(buf, `기간별상품매출현황_${scope}_${fFrom}~${fTo}.xlsx`);
    toast(`${rows.length}개 상품 다운로드`, 'ok');
  };

  const toggleStore = (s) => {
    setFStores(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setFBranch(''); // 점포 구성이 바뀌면 지점 초기화 (지점은 단일 점포 선택 시에만 유효)
  };
  const storeBtnLabel   = fStores.length === 0 ? '전체 점포' : fStores.length === 1 ? fStores[0] : `${fStores.length}개 점포`;
  const storeScopeLabel = fStores.length === 0 ? '전체 점포' : fStores.join(', ');

  const grp = { borderLeft: '2px solid var(--border2)' }; // 그룹 구분 세로선
  const th = (label, extra) => <th className="r" style={{ whiteSpace:'nowrap', ...extra }}>{label}</th>;
  // 클릭 정렬 헤더: 활성 컬럼은 ▼(높은순)/▲(낮은순), 비활성은 ⇅
  const sortTh = (label, key, extra) => {
    const active = sortKey === key;
    return (
      <th className="r" onClick={() => handleSort(key)} title="클릭하여 정렬"
        style={{ whiteSpace:'nowrap', cursor:'pointer', userSelect:'none',
                 color: active ? 'var(--accent)' : undefined, ...extra }}>
        {label}<span style={{ marginLeft:2, fontSize:10, opacity: active ? 1 : 0.4 }}>{active ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}</span>
      </th>
    );
  };

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <button type="button" onClick={() => setTab('settlement')} style={tabBtn(tab === 'settlement')}>🧮 매출정산</button>
        <button type="button" onClick={() => setTab('expense')} style={tabBtn(tab === 'expense')}>💸 매장지출</button>
        <button type="button" onClick={() => setTab('closing')} style={tabBtn(tab === 'closing')}>📊 매출결산</button>
      </div>

      {tab === 'settlement' && (<>
      <div className="card">
        <div className="card-label">🧮 매출정산 <span style={{ fontSize:12, fontWeight:400, color:'var(--text3)' }}>· 기간·점포별 상품단위 정산</span></div>
        <div className="fbar" style={{ flexWrap:'wrap', gap:8 }}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          <span style={{ fontSize:12, color:'var(--text3)' }}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} />
          <div style={{ position:'relative' }}>
            <button type="button" onClick={() => setStoreMenu(o => !o)} className="fsel"
              style={{ cursor:'pointer', textAlign:'left', minWidth:130, display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}
              title="점포 중복 선택 가능">
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{storeBtnLabel}</span>
              <span style={{ fontSize:9, color:'var(--text3)' }}>▼</span>
            </button>
            {storeMenu && (
              <>
                <div onClick={() => setStoreMenu(false)} style={{ position:'fixed', inset:0, zIndex:40 }}/>
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:41, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.14)', padding:6, minWidth:180, maxHeight:300, overflowY:'auto' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', cursor:'pointer', borderRadius:4, fontSize:13, fontWeight:700 }}
                    onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <input type="checkbox" checked={fStores.length === 0} onChange={() => { setFStores([]); setFBranch(''); }} />
                    전체 점포
                  </label>
                  <div style={{ height:1, background:'var(--border)', margin:'4px 0' }}/>
                  {STORE_NAMES.map(s => (
                    <label key={s} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', cursor:'pointer', borderRadius:4, fontSize:13 }}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <input type="checkbox" checked={fStores.includes(s)} onChange={() => toggleStore(s)} />
                      {s}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={fStores.length !== 1}
            title={fStores.length === 1 ? '' : '지점은 점포 1개만 선택했을 때 사용'}>
            <option value="">{fStores.length === 1 ? '전체 지점' : '지점(단일 점포시)'}</option>
            {fStores.length === 1 && (STORE_MAP[fStores[0]] || []).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span style={{ fontSize:12, color:'var(--text3)', marginLeft:6 }}>비교</span>
          <input type="date" className="fsel" value={cmpFrom} onChange={e => setCmpFrom(e.target.value)} title="비교기간 시작 (비우면 전월 동기간 자동)" />
          <span style={{ fontSize:12, color:'var(--text3)' }}>~</span>
          <input type="date" className="fsel" value={cmpTo} onChange={e => setCmpTo(e.target.value)} title="비교기간 종료 (비우면 전월 동기간 자동)" />
          {(cmpFrom || cmpTo) && (
            <button type="button" onClick={() => { setCmpFrom(''); setCmpTo(''); }}
              style={{ height:34, padding:'0 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', color:'var(--text3)', fontSize:12, cursor:'pointer' }}
              title="비교기간 자동으로 되돌리기">↺ 자동</button>
          )}
          <div className="fbar-right" style={{ display:'flex', gap:8 }}>
            {searched && rows.length > 0 && (
              <button type="button" onClick={exportExcel}
                style={{ height:34, padding:'0 12px', border:'1px solid #2e7d32', borderRadius:'var(--radius)', background:'#e8f5e9', color:'#2e7d32', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                📥 엑셀 다운로드
              </button>
            )}
            <button className="btn btn-p" onClick={search} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔍 조회'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding:'16px 20px' }}>
        {loading ? <div className="empty"><span className="spinner"/></div>
        : !searched ? <div className="empty">기간·점포를 선택하고 조회하세요</div>
        : rows.length === 0 ? <div className="empty">해당 기간 매출이 없습니다</div>
        : (
          <>
          <div style={{ marginBottom:10, fontSize:12, color:'var(--text2)' }}>
            <b>{rows.length}</b>개 상품 · {storeScopeLabel} · 조회 <b>{fFrom} ~ {fTo}</b>
            <span style={{ marginLeft:10, color:'#6a1b9a' }}>· 비교 <b>{prevFrom} ~ {prevTo}</b> {(cmpFrom && cmpTo) ? '(수동)' : '(전월동기 자동)'}</span>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  <th colSpan={2}></th>
                  <th colSpan={8} style={{ textAlign:'center', ...grp }}>조회기간</th>
                  <th colSpan={4} style={{ textAlign:'center', ...grp }}>전월 동기간</th>
                  <th style={{ textAlign:'center', ...grp }}>전월증감</th>
                </tr>
                <tr>
                  <th>상품코드</th><th>상품명</th>
                  {th('원가', grp)}{th('판매가')}{sortTh('판매수량','qty')}{sortTh('매출액','gross')}{th('할인금액')}{sortTh('실제매출','net')}{sortTh('이익','profit')}{sortTh('원가비중','costPct')}
                  {th('판매수량', grp)}{th('판매금액')}{th('할인금액')}{th('실제매출')}
                  {th('실제매출', grp)}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize:11, color:'var(--text3)' }}>{r.code || '-'}</td>
                    <td style={{ fontSize:12, fontWeight:600 }}>{r.name}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text3)', ...grp }}>{won(r.unitCost)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)' }}>{won(r.listPrice)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{r.qty.toLocaleString()}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)' }}>{won(r.gross)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--danger)' }}>{won(r.discount)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>{won(r.net)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color: r.profit < 0 ? 'var(--danger)' : '#2e7d32' }}>{won(r.profit)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{r.costPct.toFixed(1)}%</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', ...grp }}>{r.prevQty.toLocaleString()}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)' }}>{won(r.prevGross)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--danger)' }}>{won(r.prevDiscount)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#6a1b9a' }}>{won(r.prevNet)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', ...grp }}>{diffCell(r.diffNet)}</td>
                  </tr>
                ))}
                <tr style={{ background:'var(--bg3)', borderTop:'2px solid var(--border2)' }}>
                  <td colSpan={2} style={{ fontWeight:700, padding:'9px 11px' }}>합계</td>
                  <td className="r" style={{ ...grp }}></td><td></td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{totals.qty.toLocaleString()}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(totals.gross)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--danger)' }}>{won(totals.discount)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:14 }}>{won(totals.net)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color: totals.profit < 0 ? 'var(--danger)' : '#2e7d32', fontSize:14 }}>{won(totals.profit)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{totalCostPct.toFixed(1)}%</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, ...grp }}>{totals.pQty.toLocaleString()}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(totals.pGross)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--danger)' }}>{won(totals.pDiscount)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#6a1b9a' }}>{won(totals.pNet)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, ...grp }}>{diffCell(totalDiff)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
      </>)}

      {tab === 'expense' && (
        <>
          <div className="card">
            <div className="card-label">💸 매장지출 <span style={{ fontSize:12, fontWeight:400, color:'var(--text3)' }}>· 월별 매장 지출 합계</span></div>
            <div className="fbar" style={{ flexWrap:'wrap', gap:8 }}>
              <select className="fsel" value={exYear} onChange={e => setExYear(Number(e.target.value))}>
                {Array.from({ length: 4 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select className="fsel" value={exMonth} onChange={e => setExMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
              <div className="fbar-right">
                <button className="btn btn-p" onClick={searchExpense} disabled={exLoading}>
                  {exLoading ? <span className="spinner"/> : '🔍 조회'}
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding:'16px 20px' }}>
            {exLoading ? <div className="empty"><span className="spinner"/></div>
            : !exSearched ? <div className="empty">연·월을 선택하고 조회하세요</div>
            : exRows.length === 0 ? <div className="empty">해당 월 지출 내역이 없습니다</div>
            : (
              <>
              <div style={{ marginBottom:10, fontSize:12, color:'var(--text2)' }}>
                <b>{exYear}년 {exMonth}월</b> · 매장 <b>{exRows.length}</b>개 · 총 지출 <b style={{ color:'var(--accent)' }}>{won(exTotal)}원</b> · 금액 클릭 시 일자별 세부내역
              </div>
              {/* 지출결의서 다운로드 툴바 (선택 지점별 시트) */}
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12, padding:'10px 12px', background:'#fafafa', border:'1px solid var(--border)', borderRadius:'var(--radius)' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text2)' }}>📄 지출결의서 · 선택 <b style={{ color:'var(--accent)' }}>{exSelKeys.size}</b>개 지점</span>
                <button type="button" onClick={() => exportExpenseExcel()} disabled={exSelKeys.size === 0}
                  style={{ marginLeft:'auto', height:32, padding:'0 14px', border:'1px solid #2e7d32', borderRadius:'var(--radius)', background:'#e8f5e9', color:'#2e7d32', fontSize:12, fontWeight:700, cursor: exSelKeys.size? 'pointer':'default' }}>
                  📥 엑셀 다운로드
                </button>
              </div>
              <div className="twrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width:40, textAlign:'center' }}>
                        <input type="checkbox" title="전체선택"
                          checked={exRows.length > 0 && exSelKeys.size === exRows.length}
                          ref={el => { if (el) el.indeterminate = exSelKeys.size > 0 && exSelKeys.size < exRows.length; }}
                          onChange={() => setExSelKeys(exSelKeys.size === exRows.length ? new Set() : new Set(exRows.map(r => r.key)))}
                          style={{ cursor:'pointer' }} />
                      </th>
                      <th>점포</th><th>지점</th><th className="r" style={{ width:100 }}>건수</th><th className="r" style={{ width:170 }}>총 지출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exRows.map(r => {
                      const on = exSelKeys.has(r.key);
                      return (
                      <tr key={r.key} style={on ? {} : { opacity:0.5 }}>
                        <td style={{ textAlign:'center' }}>
                          <input type="checkbox" checked={on}
                            onChange={() => setExSelKeys(prev => { const n = new Set(prev); n.has(r.key) ? n.delete(r.key) : n.add(r.key); return n; })}
                            style={{ cursor:'pointer' }} />
                        </td>
                        <td><span className="badge badge-dept">{r.dept}</span></td>
                        <td><span className="badge badge-store">{r.branch}</span></td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{r.count}건</td>
                        <td className="r">
                          <button type="button" onClick={() => openExDetail(r)} title="일자별 세부내역 보기"
                            style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:14, textDecoration:'underline' }}>
                            {won(r.total)}원
                          </button>
                        </td>
                      </tr>
                    ); })}
                    <tr style={{ background:'var(--bg3)', borderTop:'2px solid var(--border2)' }}>
                      <td colSpan={3} style={{ fontWeight:700, padding:'9px 11px' }}>합계</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{exRows.reduce((s, r) => s + r.count, 0)}건</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:14 }}>{won(exTotal)}원</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'closing' && (
        <>
          <div className="card">
            <div className="card-label">📊 매출결산 <span style={{ fontSize:12, fontWeight:400, color:'var(--text3)' }}>· 월별 점포/지점 손익결산</span></div>
            <div className="fbar" style={{ flexWrap:'wrap', gap:8 }}>
              <select className="fsel" value={clYear} onChange={e => setClYear(Number(e.target.value))}>
                {Array.from({ length: 4 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select className="fsel" value={clMonth} onChange={e => setClMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
              <div className="fbar-right" style={{ display:'flex', gap:8 }}>
                {clSearched && clRows.length > 0 && (
                  <button type="button" onClick={exportClosingExcel}
                    style={{ height:34, padding:'0 12px', border:'1px solid #2e7d32', borderRadius:'var(--radius)', background:'#e8f5e9', color:'#2e7d32', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    📥 엑셀 다운로드
                  </button>
                )}
                <button className="btn btn-p" onClick={searchClosing} disabled={clLoading}>
                  {clLoading ? <span className="spinner"/> : '🔍 결산 조회'}
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding:'16px 20px' }}>
            {clLoading ? <div className="empty"><span className="spinner"/></div>
            : !clSearched ? <div className="empty">연·월을 선택하고 결산을 조회하세요</div>
            : clRows.length === 0 ? <div className="empty">해당 월 매출·인건비 데이터가 없습니다</div>
            : (
              <>
              <div style={{ marginBottom:10, fontSize:12, color:'var(--text2)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span><b>{clYear}년 {clMonth}월</b>{clCappedTo ? ` (1일~${clCappedTo.slice(5)} 집계)` : ''} · 점포/지점 <b>{clRows.length}</b>개 · 판매인건비는 급여관리 기준 자동집계</span>
                {clSortKey && (
                  <button type="button" onClick={() => { setClSortKey(''); setClSortDir('desc'); }}
                    style={{ height:26, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer' }}
                    title="정렬 해제하고 점포순으로">↺ 점포순</button>
                )}
              </div>

              {/* 점포별 합산 */}
              <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', margin:'4px 0 8px' }}>■ 점포별 합산</div>
              <div className="twrap" style={{ marginBottom:22 }}>
                <table>
                  <thead>
                    <tr>
                      <th>점포</th><th style={{ textAlign:'center' }}>지점수</th>
                      {clStoreTh('매출액','revenue')}<th className="r">매출비율</th>
                      {clStoreTh('전체원가','totalCost')}{clStoreTh('판매제품원가','soldCost')}{clStoreTh('증정원가','giftCost')}{clStoreTh('시식원가','tastingCost')}{clStoreTh('증정시식율','gtPct')}
                      {clStoreTh('판매인건비','labor')}<th className="r">인건비비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClStoreRows.map((r) => (
                      <tr key={r.dept}>
                        <td><span className="badge badge-dept">{r.dept}</span></td>
                        <td style={{ textAlign:'center', fontFamily:'var(--mono)', color:'var(--text3)' }}>{r.branches}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>{won(r.revenue)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{pctStr(pctOf(r.revenue, clTotals.revenue))}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{won(r.totalCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)' }}>{won(r.soldCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'#6a1b9a' }}>{won(r.giftCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'#1565C0' }}>{won(r.tastingCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{pctStr(pctOf(r.giftCost + r.tastingCost, r.revenue))}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#e65100', whiteSpace:'nowrap' }}>
                          {won(r.labor)} <span style={{ fontSize:11, fontWeight:600, color:'var(--text3)' }}>({r.headcount}명)</span>
                        </td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{pctStr(pctOf(r.labor, clTotals.labor))}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'var(--bg3)', borderTop:'2px solid var(--border2)' }}>
                      <td style={{ fontWeight:700, padding:'9px 11px' }}>합계</td>
                      <td style={{ textAlign:'center', fontFamily:'var(--mono)', fontWeight:700 }}>{clRows.length}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:14 }}>{won(clTotals.revenue)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>100.0%</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(clTotals.totalCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(clTotals.soldCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#6a1b9a' }}>{won(clTotals.giftCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#1565C0' }}>{won(clTotals.tastingCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{pctStr(pctOf(clTotals.giftCost + clTotals.tastingCost, clTotals.revenue))}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#e65100', fontSize:14, whiteSpace:'nowrap' }}>
                        {won(clTotals.labor)} <span style={{ fontSize:11, fontWeight:600, color:'var(--text3)' }}>({clTotals.headcount}명)</span>
                      </td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 지점별 상세 */}
              <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', margin:'4px 0 8px' }}>■ 지점별 상세</div>
              <div className="twrap">
                <table>
                  <thead>
                    <tr>
                      <th>점포</th><th>지점</th>
                      {clTh('매출액','revenue')}<th className="r">매출비율</th>
                      {clTh('전체원가','totalCost')}{clTh('판매제품원가','soldCost')}{clTh('증정원가','giftCost')}{clTh('시식원가','tastingCost')}{clTh('증정시식율','gtPct')}
                      {clTh('판매인건비','labor')}<th className="r">인건비비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClRows.map((r) => (
                      <tr key={r.key}>
                        <td><span className="badge badge-dept">{r.dept}</span></td>
                        <td><span className="badge badge-store">{r.branch}</span></td>
                        <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>{won(r.revenue)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{pctStr(pctOf(r.revenue, clTotals.revenue))}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{won(r.totalCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)' }}>{won(r.soldCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'#6a1b9a' }}>{won(r.giftCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'#1565C0' }}>{won(r.tastingCost)}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{pctStr(pctOf(r.giftCost + r.tastingCost, r.revenue))}</td>
                        <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#e65100', whiteSpace:'nowrap' }}>
                          {won(r.labor)} <span style={{ fontSize:11, fontWeight:600, color:'var(--text3)' }}>({r.headcount}명)</span>
                        </td>
                        <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{pctStr(pctOf(r.labor, clTotals.labor))}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'var(--bg3)', borderTop:'2px solid var(--border2)' }}>
                      <td colSpan={2} style={{ fontWeight:700, padding:'9px 11px' }}>합계</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:14 }}>{won(clTotals.revenue)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>100.0%</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(clTotals.totalCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(clTotals.soldCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#6a1b9a' }}>{won(clTotals.giftCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#1565C0' }}>{won(clTotals.tastingCost)}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{pctStr(pctOf(clTotals.giftCost + clTotals.tastingCost, clTotals.revenue))}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#e65100', fontSize:14, whiteSpace:'nowrap' }}>
                        {won(clTotals.labor)} <span style={{ fontSize:11, fontWeight:600, color:'var(--text3)' }}>({clTotals.headcount}명)</span>
                      </td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </>
      )}

      {exDetail && (
        <div onClick={() => setExDetail(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:12, maxWidth:640, width:'100%', maxHeight:'80vh', overflow:'auto', boxShadow:'0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'#fff' }}>
              <div style={{ fontSize:15, fontWeight:800 }}>💸 {exDetail.dept} {exDetail.branch} · 일자별 지출</div>
              <span style={{ marginLeft:'auto', fontSize:14, fontWeight:700, color:'var(--accent)' }}>{won(exDetail.total)}원</span>
              <button type="button" onClick={() => setExDetail(null)}
                style={{ marginLeft:8, border:'none', background:'none', fontSize:20, cursor:'pointer', color:'var(--text3)' }}>×</button>
            </div>
            <div style={{ padding:'12px 20px 20px' }}>
              <div className="twrap">
                <table>
                  <thead>
                    <tr><th style={{ width:110 }}>날짜</th><th style={{ width:90 }}>항목</th><th className="r" style={{ width:110 }}>금액</th><th>메모</th></tr>
                  </thead>
                  <tbody>
                    {exDetail.items.map((e, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight:600 }}>{e.expense_date}</td>
                        <td><span className="badge" style={{ background:'#f5f5f5', color:'var(--text2)', border:'1px solid var(--border)' }}>{e.category}</span></td>
                        <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(e.amount)}원</td>
                        <td style={{ fontSize:13, color:'var(--text2)' }}>{e.memo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
