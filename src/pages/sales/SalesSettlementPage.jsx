import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_NAMES } from '../../lib/constants';

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
  const [fStore, setFStore] = useState(''); // '' = 전체 점포
  const [rows, setRows] = useState([]);
  const [prevFrom, setPrevFrom] = useState('');
  const [prevTo,   setPrevTo]   = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
        .gte('sold_at', from).lte('sold_at', to)
        .order('id').range(start, start + PAGE - 1);
      if (fStore) q = q.eq('store_name', fStore);
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
      const [pf, pt] = prevRange(fFrom, fTo);
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
  }, [fFrom, fTo, fStore]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = rows.reduce((t, r) => ({
    qty: t.qty + r.qty, gross: t.gross + r.gross, discount: t.discount + r.discount,
    net: t.net + r.net, cost: t.cost + r.costTotal, profit: t.profit + r.profit,
    pQty: t.pQty + r.prevQty, pGross: t.pGross + r.prevGross, pDiscount: t.pDiscount + r.prevDiscount, pNet: t.pNet + r.prevNet,
  }), { qty:0, gross:0, discount:0, net:0, cost:0, profit:0, pQty:0, pGross:0, pDiscount:0, pNet:0 });
  const totalCostPct = totals.net !== 0 ? (totals.cost / totals.net) * 100 : 0;
  const totalDiff = totals.net - totals.pNet;

  const won = (n) => Math.round(n || 0).toLocaleString();
  const diffCell = (v) => {
    const up = v >= 0;
    return <span style={{ color: up ? '#1b5e20' : '#c62828', fontWeight:700 }}>{up ? '▲' : '▼'} {won(Math.abs(v))}</span>;
  };

  const exportExcel = async () => {
    if (rows.length === 0) { toast('조회된 데이터가 없습니다', 'err'); return; }
    const ExcelJS = (await import('exceljs')).default;
    const { dlBlob } = await import('../../lib/utils');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('매출정산');

    ws.columns = [
      { width:17 }, { width:36 },
      { width:11 }, { width:11 }, { width:10 }, { width:13 }, { width:12 }, { width:13 }, { width:13 }, { width:10 },
      { width:10 }, { width:13 }, { width:12 }, { width:13 },
      { width:14 },
    ];

    // 1행: 그룹 헤더 (병합)
    ws.addRow(['', '', '조회기간', '', '', '', '', '', '', '', '전월 동기간', '', '', '', '전월증감']);
    ws.mergeCells('A1:B1'); ws.mergeCells('C1:J1'); ws.mergeCells('K1:N1');
    // 2행: 컬럼 헤더
    ws.addRow(['상품코드','상품명','원가','판매가','판매수량','매출액','할인금액','실제매출','이익','원가비중(%)','판매수량','판매금액','할인금액','실제매출','실제매출증감']);

    for (const r of rows) {
      ws.addRow([
        r.code, r.name,
        Math.round(r.unitCost), Math.round(r.listPrice), r.qty, Math.round(r.gross), Math.round(r.discount), Math.round(r.net), Math.round(r.profit), Number(r.costPct.toFixed(1)),
        r.prevQty, Math.round(r.prevGross), Math.round(r.prevDiscount), Math.round(r.prevNet),
        Math.round(r.diffNet),
      ]);
    }
    const totalRow = ws.addRow([
      '합계', '', '', '', totals.qty, Math.round(totals.gross), Math.round(totals.discount), Math.round(totals.net), Math.round(totals.profit), Number(totalCostPct.toFixed(1)),
      totals.pQty, Math.round(totals.pGross), Math.round(totals.pDiscount), Math.round(totals.pNet),
      Math.round(totalDiff),
    ]);

    // ── 스타일 ──
    const RED='FFC62828', ORANGE='FFE65100', GREEN='FF1B5E20', PURPLE='FF6A1B9A';
    const moneyCols = [3,4,6,7,8,9,12,13,14,15];
    const qtyCols   = [5,11];
    const thin = { style:'thin', color:{argb:'FFD0D0D0'} };
    const grpBorder = { style:'medium', color:{argb:'FF9E9E9E'} };
    const colColor = { 7:RED, 8:ORANGE, 13:RED, 14:PURPLE }; // 고정 색
    const grpStartCols = [3, 11, 15];
    const lastRow = ws.rowCount;

    ws.eachRow((row, rn) => {
      row.height = rn <= 2 ? 20 : 17;
      row.eachCell((cell, cn) => {
        cell.font = { name:'맑은 고딕', size: 10, bold: rn <= 2 || rn === lastRow };
        cell.alignment = { horizontal: cn <= 2 ? (rn>=3 ? 'left':'center') : (rn<=2 ? 'center':'right'), vertical:'middle' };
        cell.border = {
          bottom: rn === 2 ? { style:'medium', color:{argb:'FF9E9E9E'} } : thin,
          top: rn === lastRow ? { style:'medium', color:{argb:'FF9E9E9E'} } : undefined,
          left: grpStartCols.includes(cn) ? grpBorder : thin,
          right: thin,
        };
        if (rn === 1) { cell.font = { name:'맑은 고딕', size: 11, bold: true }; cell.alignment = { horizontal:'center', vertical:'middle' }; }
        if (rn >= 3) {
          if (moneyCols.includes(cn)) cell.numFmt = '#,##0';
          if (qtyCols.includes(cn))   cell.numFmt = '#,##0';
          if (cn === 10) cell.numFmt = '0.0"%"';
          // 색상
          if (colColor[cn]) cell.font = { ...cell.font, color:{argb: colColor[cn]}, bold: cn===8 || rn===lastRow };
          if (cn === 9)  cell.font = { ...cell.font, color:{argb: (cell.value<0? RED: GREEN)}, bold: rn===lastRow };
          if (cn === 15) cell.font = { ...cell.font, color:{argb: (cell.value<0? RED: GREEN)}, bold:true };
        }
      });
    });
    // 헤더 배경(연회색)로 살짝 구분
    for (const rn of [1,2]) ws.getRow(rn).eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'} }; });
    totalRow.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF7F3EC'} }; });
    ws.views = [{ state:'frozen', xSplit:2, ySplit:2 }];

    const buf = await wb.xlsx.writeBuffer();
    dlBlob(buf, `매출정산_${fStore||'전체'}_${fFrom}~${fTo}.xlsx`);
    toast(`${rows.length}개 상품 다운로드`, 'ok');
  };

  const grp = { borderLeft: '2px solid var(--border2)' }; // 그룹 구분 세로선
  const th = (label, extra) => <th className="r" style={{ whiteSpace:'nowrap', ...extra }}>{label}</th>;

  return (
    <div>
      <div className="card">
        <div className="card-label">🧮 매출정산</div>
        <div className="fbar" style={{ flexWrap:'wrap', gap:8 }}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          <span style={{ fontSize:12, color:'var(--text3)' }}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} />
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 점포</option>
            {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
            <b>{rows.length}</b>개 상품 · {fStore || '전체 점포'} · 조회 <b>{fFrom} ~ {fTo}</b>
            <span style={{ marginLeft:10, color:'#6a1b9a' }}>· 전월동기 <b>{prevFrom} ~ {prevTo}</b></span>
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
                  {th('원가', grp)}{th('판매가')}{th('판매수량')}{th('매출액')}{th('할인금액')}{th('실제매출')}{th('이익')}{th('원가비중')}
                  {th('판매수량', grp)}{th('판매금액')}{th('할인금액')}{th('실제매출')}
                  {th('실제매출', grp)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
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
    </div>
  );
}
