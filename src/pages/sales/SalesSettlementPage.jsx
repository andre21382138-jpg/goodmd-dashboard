import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_NAMES } from '../../lib/constants';

// 본사 매출정산 — 기간·점포별 상품 단위 정산
//  상품코드/상품명/원가/판매가/판매수량/매출액/할인금액/실제매출/이익/원가비중(%)
//  매출액 = Σ 정상가(products.price)×수량, 실제매출 = Σ 실제 판매가×수량(반품=음수 자동 차감)
export default function SalesSettlementPage() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo,   setFTo]   = useState(todayStr);
  const [fStore, setFStore] = useState(''); // '' = 전체 점포
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      // sales 전량 페이징 (1000행 제한 회피)
      const all = []; let start = 0; const PAGE = 1000;
      while (true) {
        let q = supabase.from('sales')
          .select('product_id, quantity, price, payment, product:products(code, name, price, cost)')
          .gte('sold_at', fFrom).lte('sold_at', fTo)
          .order('id').range(start, start + PAGE - 1);
        if (fStore) q = q.eq('store_name', fStore);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        start += PAGE;
      }

      // 상품 단위 집계
      const map = new Map();
      for (const r of all) {
        if (!r.product_id) continue;
        const isReturn = r.payment === '반품' || (Number(r.price) < 0);
        const q = Number(r.quantity) || 0;
        const netQty = isReturn ? -q : q;               // 판매수량(반품 차감)
        const unitPrice = Number(r.price) || 0;         // 실제 판매 단가(반품은 음수)
        const listPrice = Number(r.product?.price) || 0; // 정상가
        const unitCost  = Number(r.product?.cost) || 0;  // 원가(미설정=0)

        const key = r.product_id;
        if (!map.has(key)) map.set(key, {
          code: r.product?.code || '', name: r.product?.name || '(삭제된 상품)',
          listPrice, unitCost, qty: 0, gross: 0, net: 0, costTotal: 0,
        });
        const g = map.get(key);
        g.qty       += netQty;
        g.gross     += listPrice * netQty;   // 매출액(정상가 기준)
        g.net       += unitPrice * q;        // 실제매출(반품 음수 자동)
        g.costTotal += unitCost * netQty;    // 원가총액
      }

      const list = [...map.values()].map(g => ({
        ...g,
        discount: g.gross - g.net,                                    // 할인금액
        profit:   g.net - g.costTotal,                                // 이익
        costPct:  g.net !== 0 ? (g.costTotal / g.net) * 100 : 0,      // 원가비중
      }));
      list.sort((a, b) => b.net - a.net);
      setRows(list);
      setSearched(true);
    } catch (err) {
      toast('조회 실패: ' + (err.message || err), 'err');
    }
    setLoading(false);
  }, [fFrom, fTo, fStore]);

  const totals = rows.reduce((t, r) => ({
    qty: t.qty + r.qty, gross: t.gross + r.gross, discount: t.discount + r.discount,
    net: t.net + r.net, cost: t.cost + r.costTotal, profit: t.profit + r.profit,
  }), { qty:0, gross:0, discount:0, net:0, cost:0, profit:0 });
  const totalCostPct = totals.net !== 0 ? (totals.cost / totals.net) * 100 : 0;

  const exportExcel = () => {
    if (rows.length === 0) { toast('조회된 데이터가 없습니다', 'err'); return; }
    const data = rows.map(r => ({
      '상품코드': r.code, '상품명': r.name,
      '원가': Math.round(r.unitCost), '판매가': Math.round(r.listPrice), '판매수량': r.qty,
      '매출액': Math.round(r.gross), '할인금액': Math.round(r.discount), '실제매출': Math.round(r.net),
      '이익': Math.round(r.profit), '원가비중(%)': Number(r.costPct.toFixed(1)),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '매출정산');
    XLSX.writeFile(wb, `매출정산_${fStore||'전체'}_${fFrom}~${fTo}.xlsx`);
  };

  const won = (n) => Math.round(n || 0).toLocaleString();

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
            <b>{rows.length}</b>개 상품 · {fStore || '전체 점포'} · {fFrom} ~ {fTo}
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>상품코드</th><th>상품명</th>
                  <th className="r">원가</th><th className="r">판매가</th><th className="r">판매수량</th>
                  <th className="r">매출액</th><th className="r">할인금액</th><th className="r">실제매출</th>
                  <th className="r">이익</th><th className="r">원가비중</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize:11, color:'var(--text3)' }}>{r.code || '-'}</td>
                    <td style={{ fontSize:12, fontWeight:600 }}>{r.name}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text3)' }}>{won(r.unitCost)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)' }}>{won(r.listPrice)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{r.qty.toLocaleString()}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)' }}>{won(r.gross)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--danger)' }}>{won(r.discount)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>{won(r.net)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color: r.profit < 0 ? 'var(--danger)' : '#2e7d32' }}>{won(r.profit)}</td>
                    <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{r.costPct.toFixed(1)}%</td>
                  </tr>
                ))}
                <tr style={{ background:'var(--bg3)', borderTop:'2px solid var(--border2)' }}>
                  <td colSpan={4} style={{ fontWeight:700, padding:'9px 11px' }}>합계</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{totals.qty.toLocaleString()}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{won(totals.gross)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--danger)' }}>{won(totals.discount)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:14 }}>{won(totals.net)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color: totals.profit < 0 ? 'var(--danger)' : '#2e7d32', fontSize:14 }}>{won(totals.profit)}</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{totalCostPct.toFixed(1)}%</td>
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
