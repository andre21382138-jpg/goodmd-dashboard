import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_MAP } from '../../lib/constants';

// 결산 리포트 집계 대상 — 원본 업무보고서와 동일하게 정식 백화점 7개 체인만 (그린푸드·특판 제외)
const REPORT_CHAINS = ['롯데백화점', '갤러리아백화점', 'AK백화점', '현대백화점', '신세계백화점', '농협_SHOP', '대동백화점'];

// ════════════════════════════════════════════════════════════════
// 결산 리포트 — 주간(지난주 금 ~ 금주 목) / 월간(구현 예정)
//   · 매출 = price × quantity, payment='구매이력' 제외, 반품(음수) 자동 반영
//   · 체인(백화점) 요약 + 체인별 점별 전개
//   · 컬럼: 당월 / 전월(동일날짜) / 전월대비 / 금주 / D-1~D-4주전
// ════════════════════════════════════════════════════════════════

// KST 달력일(UTC 자정 앵커)로 오늘을 구한다 — 브라우저 TZ 무관하게 일 단위 연산
function kstToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
// timestamptz(UTC) → KST 달력일 문자열
const saleKstDate = (ts) => new Date(new Date(ts).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const won = (n) => Math.round(Number(n) || 0).toLocaleString();
const mmdd = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

export default function SettlementReportPage() {
  const [tab, setTab] = useState('weekly');
  return (
    <div>
      <div className="fbar" style={{ gap: 6, marginBottom: 12 }}>
        <button className={tab === 'weekly' ? 'btn btn-p' : 'btn-ghost'} onClick={() => setTab('weekly')}>주간</button>
        <button className={tab === 'monthly' ? 'btn btn-p' : 'btn-ghost'} onClick={() => setTab('monthly')}>월간</button>
      </div>
      {tab === 'weekly' ? <WeeklyReport /> : <MonthlyPlaceholder />}
    </div>
  );
}

function MonthlyPlaceholder() {
  return (
    <div className="card" style={{ padding: 40 }}>
      <div className="empty" style={{ lineHeight: 1.8 }}>
        📅 월간 결산 리포트는 <b>구현 예정</b>입니다.
      </div>
    </div>
  );
}

function WeeklyReport() {
  // weekOffset: 0 = 가장 최근 완료주, -1 = 그 이전주 …
  const [weekOffset, setWeekOffset] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // 기준 주 계산 — END = (오늘 이전의 가장 최근 목요일) + offset*7, START = END-6 (금)
  const { start, end, weeks, curM, prevM } = useMemo(() => {
    const today = kstToday();
    const dow = today.getUTCDay();              // 0 일 … 4 목 … 6 토
    const diff = (dow - 4 + 7) % 7;             // 직전(또는 당일) 목요일까지의 일수
    const baseThu = addDays(today, -diff);
    const END = addDays(baseThu, weekOffset * 7);
    const START = addDays(END, -6);
    // 금주(0) + D-1~D-4주전 윈도우
    const wk = [];
    for (let k = 0; k < 5; k++) {
      const e = addDays(END, -7 * k);
      const s = addDays(e, -6);
      wk.push({ s: ymd(s), e: ymd(e) });
    }
    // 당월/전월(동일날짜 기준) — END 기준
    const y = END.getUTCFullYear(), m = END.getUTCMonth(), day = END.getUTCDate();
    const curStart = new Date(Date.UTC(y, m, 1));
    const curEnd = END;
    const prevStart = new Date(Date.UTC(y, m - 1, 1));
    const prevMonthLastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const prevEnd = new Date(Date.UTC(y, m - 1, Math.min(day, prevMonthLastDay)));
    return {
      start: START, end: END, weeks: wk,
      curM: { s: ymd(curStart), e: ymd(curEnd) },
      prevM: { s: ymd(prevStart), e: ymd(prevEnd) },
    };
  }, [weekOffset]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // 로드 범위: (금주-4주 시작)과 전월 1일 중 더 이른 날 ~ 금주 목
    const rangeStartStr = weeks[4].s < prevM.s ? weeks[4].s : prevM.s;
    const gte = `${rangeStartStr}T00:00:00+09:00`;
    const lte = `${ymd(end)}T23:59:59+09:00`;
    const acc = [];
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase.from('sales')
        .select('store_name, branch_name, price, quantity, payment, sold_at')
        .neq('payment', '구매이력')
        .gte('sold_at', gte).lte('sold_at', lte)
        .order('id').range(from, from + 999);
      if (error) { toast('조회 실패: ' + error.message, 'err'); break; }
      acc.push(...(data || []));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    setRows(acc);
    setLoading(false);
  }, [weeks, prevM, end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 집계: buckets[chain][branch] = { w:[5], cur, prev }
  const { chains, grand } = useMemo(() => {
    const mkCell = () => ({ w: [0, 0, 0, 0, 0], cur: 0, prev: 0 });
    const map = {}; // chain -> { branches: {branch: cell}, total: cell }
    for (const r of rows) {
      const amt = (Number(r.price) || 0) * (Number(r.quantity) || 0);
      if (!amt) continue;
      const chain = r.store_name || '(미지정)';
      const branch = r.branch_name || '(미지정)';
      const d = saleKstDate(r.sold_at);
      if (!map[chain]) map[chain] = { branches: {}, total: mkCell() };
      if (!map[chain].branches[branch]) map[chain].branches[branch] = mkCell();
      const cell = map[chain].branches[branch];
      const ct = map[chain].total;
      for (let k = 0; k < 5; k++) {
        if (d >= weeks[k].s && d <= weeks[k].e) { cell.w[k] += amt; ct.w[k] += amt; }
      }
      if (d >= curM.s && d <= curM.e) { cell.cur += amt; ct.cur += amt; }
      if (d >= prevM.s && d <= prevM.e) { cell.prev += amt; ct.prev += amt; }
    }
    // 집계 대상: 정식 백화점 7개 체인만, 원본 순서대로. 지점: STORE_MAP 순 우선.
    const orderedChains = REPORT_CHAINS.filter(c => map[c]);
    const grand = mkCell();
    const chains = orderedChains.map(chain => {
      const { branches, total } = map[chain];
      const known = STORE_MAP[chain] || [];
      const bNames = [
        ...known.filter(b => branches[b]),
        ...Object.keys(branches).filter(b => !known.includes(b)),
      ];
      for (let k = 0; k < 5; k++) grand.w[k] += total.w[k];
      grand.cur += total.cur; grand.prev += total.prev;
      return { chain, total, branches: bNames.map(b => ({ name: b, cell: branches[b] })) };
    });
    return { chains, grand };
  }, [rows, weeks, curM, prevM]);

  const growth = (cur, prev) => {
    if (!prev) return null;
    return (cur - prev) / prev;
  };
  const GrowthCell = ({ cur, prev, tdStyle }) => {
    const g = growth(cur, prev);
    if (g === null) return <td className="r" style={{ color: 'var(--text3)', ...tdStyle }}>-</td>;
    const pos = g >= 0;
    return <td className="r" style={{ color: pos ? '#2e7d32' : 'var(--danger)', fontWeight: 700, ...tdStyle }}>
      {pos ? '+' : ''}{(g * 100).toFixed(1)}%
    </td>;
  };

  const periodLabel = `${mmdd(ymd(start))}~${mmdd(ymd(end))}`;
  const rangeTd = { fontSize: 11, color: 'var(--text3)', fontWeight: 600, fontFamily: 'var(--mono)', paddingTop: 8, borderTop: '2px solid var(--border)' };
  const hCell = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', padding: '8px 14px', background: 'var(--bg3, #eef1f6)', borderBottom: '1px solid var(--border)' };
  const hCellR = { ...hCell, textAlign: 'right' };
  const COLS = ['당월', '전월', '전월대비', '금주', 'D-1주전', 'D-2주전', 'D-3주전', 'D-4주전'];
  const BlockHeader = () => (
    <tr>
      <td style={hCell}>구분</td>
      {COLS.map(c => <td key={c} style={hCellR}>{c}</td>)}
    </tr>
  );

  const Row = ({ label, cell, bold, indent, emphasis }) => {
    const bd = emphasis ? { borderTop: '2.5px solid var(--text)', borderBottom: '2.5px solid var(--text)' } : null;
    return (
      <tr style={{
        ...(bold ? { fontWeight: 700 } : null),
        ...(emphasis ? { background: 'var(--bg3, #eef1f6)' } : bold ? { background: 'var(--bg2, #f7f7f9)' } : null),
      }}>
        <td style={{ ...bd, paddingLeft: indent ? 24 : undefined, fontWeight: (bold || emphasis) ? 800 : 500, whiteSpace: 'nowrap' }}>{label}</td>
        <td className="r" style={{ ...bd }}>{won(cell.cur)}</td>
        <td className="r" style={{ ...bd, color: 'var(--text3)' }}>{won(cell.prev)}</td>
        <GrowthCell cur={cell.cur} prev={cell.prev} tdStyle={bd} />
        <td className="r" style={{ ...bd, fontWeight: 700 }}>{won(cell.w[0])}</td>
        <td className="r" style={{ ...bd, color: 'var(--text3)' }}>{won(cell.w[1])}</td>
        <td className="r" style={{ ...bd, color: 'var(--text3)' }}>{won(cell.w[2])}</td>
        <td className="r" style={{ ...bd, color: 'var(--text3)' }}>{won(cell.w[3])}</td>
        <td className="r" style={{ ...bd, color: 'var(--text3)' }}>{won(cell.w[4])}</td>
      </tr>
    );
  };

  const downloadExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('주간결산', { views: [{ showGridLines: false }] });
    // 원본 업무보고서 양식과 동일: 맑은 고딕 10 · 전체 테두리 · 회계형 #,##0 · 0.0% · 중앙정렬
    const FONT = { name: '맑은 고딕', size: 10 };
    const BORDER = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
    const ACC = '_-* #,##0_-;\\-* #,##0_-;_-* "-"_-;_-@_-';
    const PCT = '0.0%';
    const widths = [13.125, 12.625, 12.625, 8, 12.125, 12.125, 11.125, 11.125, 10.5];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const rng = (s, e) => `${mmdd(s)}~${mmdd(e)}`;
    const hdr = (r) => {
      const labels = ['구분', `당월\n(${rng(curM.s, curM.e)})`, `전월\n(${rng(prevM.s, prevM.e)})`, '전월대비',
        `금주\n(${rng(weeks[0].s, weeks[0].e)})`, `D-1주전\n(${rng(weeks[1].s, weeks[1].e)})`,
        `D-2주전\n(${rng(weeks[2].s, weeks[2].e)})`, `D-3주전\n(${rng(weeks[3].s, weeks[3].e)})`,
        `D-4주전\n(${rng(weeks[4].s, weeks[4].e)})`];
      const row = ws.getRow(r); row.height = 30;
      labels.forEach((t, i) => {
        const c = row.getCell(i + 1);
        c.value = t; c.font = { ...FONT, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        c.border = BORDER;
      });
      return r + 1;
    };
    const dataRow = (r, label, cell, opt = {}) => {
      const { bold = false, indent = false } = opt;
      const row = ws.getRow(r); row.height = 17.25;
      const g = growth(cell.cur, cell.prev);
      const vals = [(indent ? '   ' : '') + label, cell.cur, cell.prev, (g === null ? '-' : g),
        cell.w[0], cell.w[1], cell.w[2], cell.w[3], cell.w[4]];
      vals.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v; c.font = { ...FONT, bold }; c.border = BORDER;
        if (i === 0) c.alignment = { horizontal: 'left', vertical: 'center' };
        else if (i === 3) { c.numFmt = g === null ? 'General' : PCT; c.alignment = { horizontal: 'center', vertical: 'center' }; }
        else { c.numFmt = ACC; c.alignment = { horizontal: 'right', vertical: 'center' }; }
      });
      return r + 1;
    };
    const sectionRow = (r, text, size = 11) => {
      ws.getRow(r).getCell(1).value = text;
      ws.getRow(r).getCell(1).font = { ...FONT, bold: true, size };
      return r + 1;
    };

    let r = 1;
    r = sectionRow(r, `■ 결산 리포트(주간) ${periodLabel}`, 12);
    r += 1;
    r = sectionRow(r, '[ 전체 / 체인별 요약 ]');
    r = hdr(r);
    r = dataRow(r, '전체 합계', grand, { bold: true });
    for (const c of chains) r = dataRow(r, c.chain, c.total);
    r += 1;
    for (const c of chains) {
      r = sectionRow(r, `[ ${c.chain} ]`);
      r = hdr(r);
      r = dataRow(r, `${c.chain} 합계`, c.total, { bold: true });
      for (const b of c.branches) r = dataRow(r, b.name, b.cell, { indent: true });
      r += 1;
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `결산리포트_주간_${ymd(start)}~${ymd(end)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="fbar" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button className="btn-ghost" onClick={() => setWeekOffset(o => o - 1)}>◀ 이전주</button>
        <div style={{ fontWeight: 800, fontSize: 16, minWidth: 150, textAlign: 'center' }}>
          {periodLabel}
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 6 }}>
            ({ymd(start).slice(0, 4)}, 금~목)
          </span>
        </div>
        <button className="btn-ghost" disabled={weekOffset >= 0} onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
          style={{ opacity: weekOffset >= 0 ? 0.4 : 1, cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer' }}>다음주 ▶</button>
        <div className="fbar-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {weekOffset !== 0 && <button className="btn-ghost" onClick={() => setWeekOffset(0)}>최근주</button>}
          <button className="btn btn-p" onClick={downloadExcel} disabled={loading}>📥 엑셀 다운로드</button>
        </div>
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="twrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>구분</th>
                <th className="r">당월</th>
                <th className="r">전월</th>
                <th className="r">전월대비</th>
                <th className="r">금주</th>
                <th className="r">D-1주전</th>
                <th className="r">D-2주전</th>
                <th className="r">D-3주전</th>
                <th className="r">D-4주전</th>
              </tr>
            </thead>
            <tbody>
              {chains.length === 0
                ? <tr><td colSpan={9} className="empty">해당 기간 매출 데이터가 없습니다</td></tr>
                : (
                  <>
                    <Row label="전체 합계" cell={grand} emphasis />
                    {chains.map(c => <Row key={`sum-${c.chain}`} label={c.chain} cell={c.total} />)}
                    {chains.map(c => (
                      <React.Fragment key={`blk-${c.chain}`}>
                        <tr><td colSpan={9} style={{ height: 20, background: '#fff', border: 'none' }} /></tr>
                        <tr><td colSpan={9} style={{ background: 'var(--accent, #1565C0)', color: '#fff', fontWeight: 800, fontSize: 15, padding: '8px 12px', borderRadius: '6px 6px 0 0' }}>🏬 {c.chain}</td></tr>
                        <BlockHeader />
                        <Row label={`${c.chain} 합계`} cell={c.total} bold />
                        {c.branches.map(b => <Row key={`${c.chain}-${b.name}`} label={b.name} cell={b.cell} indent />)}
                      </React.Fragment>
                    ))}
                  </>
                )}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...rangeTd, fontWeight: 700 }}>기간</td>
                <td className="r" style={rangeTd}>{mmdd(curM.s)}~{mmdd(curM.e)}</td>
                <td className="r" style={rangeTd}>{mmdd(prevM.s)}~{mmdd(prevM.e)}</td>
                <td style={rangeTd}></td>
                <td className="r" style={rangeTd}>{mmdd(weeks[0].s)}~{mmdd(weeks[0].e)}</td>
                <td className="r" style={rangeTd}>{mmdd(weeks[1].s)}~{mmdd(weeks[1].e)}</td>
                <td className="r" style={rangeTd}>{mmdd(weeks[2].s)}~{mmdd(weeks[2].e)}</td>
                <td className="r" style={rangeTd}>{mmdd(weeks[3].s)}~{mmdd(weeks[3].e)}</td>
                <td className="r" style={rangeTd}>{mmdd(weeks[4].s)}~{mmdd(weeks[4].e)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
        · 1주 = 금요일~목요일. 기본값은 가장 최근 완료주, [◀ 이전주/다음주 ▶]로 과거 주 조회.<br />
        · 매출 = 단가 × 수량, 구매이력 제외, 반품은 음수 반영. 당월·전월은 '동일 날짜(1일~금주 목요일)' 기준.<br />
        · 집계 대상: 정식 백화점 7개 체인(롯데·갤러리아·AK·현대·신세계·농협·대동). 그린푸드·특판은 제외(원본 업무보고서 기준).
      </div>
    </div>
  );
}
