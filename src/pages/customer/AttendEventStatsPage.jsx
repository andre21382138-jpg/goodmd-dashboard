import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob } from '../../lib/utils';

// 본사 — 출석체크 이벤트(300원 적립) 매장별·일자별 참여인원 현황
//  attendance_rewards: 1행 = 회원 1명의 하루 참여 (회원당 하루 1회) → 행 수 = 참여인원
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const REWARD = 300; // 1회 적립금

export default function AttendEventStatsPage() {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo, setFTo] = useState(fmt(today));
  const [fStore, setFStore] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let all = [], s = 0;
    while (true) {
      const { data, error } = await supabase.from('attendance_rewards')
        .select('reward_date, store_name, branch_name, points')
        .gte('reward_date', fFrom).lte('reward_date', fTo)
        .order('reward_date').range(s, s + 999);
      if (error) { toast(error.message, 'err'); break; }
      if (!data || !data.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      s += 1000;
    }
    setRows(all);
    setLoading(false);
  }, [fFrom, fTo]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const allStores = useMemo(() => {
    const set = new Set(rows.map(r => r.store_name).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  // 피벗: 행=매장/지점, 열=일자, 셀=참여인원
  const pivot = useMemo(() => {
    const filtered = fStore ? rows.filter(r => r.store_name === fStore) : rows;
    const dSet = new Set(), stMap = new Map(), m = {};
    for (const r of filtered) {
      const d = r.reward_date; if (!d) continue;
      const st = `${r.store_name}|${r.branch_name}`;
      dSet.add(d);
      if (!stMap.has(st)) stMap.set(st, { store: r.store_name || '-', branch: r.branch_name || '-' });
      m[st] = m[st] || {};
      m[st][d] = (m[st][d] || 0) + 1;
    }
    const dates = [...dSet].sort();
    const stores = [...stMap.entries()].map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => (a.store || '').localeCompare(b.store) || (a.branch || '').localeCompare(b.branch));
    const storeTotal = {}, dateTotal = {}; let grand = 0;
    for (const st of stores) {
      storeTotal[st.key] = 0;
      for (const d of dates) {
        const v = (m[st.key] && m[st.key][d]) || 0;
        storeTotal[st.key] += v;
        dateTotal[d] = (dateTotal[d] || 0) + v;
        grand += v;
      }
    }
    return { dates, stores, m, storeTotal, dateTotal, grand };
  }, [rows, fStore]);

  const { dates, stores, m, storeTotal, dateTotal, grand } = pivot;
  const dowOf = (d) => DOW[new Date(d + 'T00:00:00').getDay()];

  const exportExcel = async () => {
    if (grand === 0) { toast('데이터가 없습니다', 'err'); return; }
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('출석이벤트');
    const header = ['매장', '지점', ...dates.map(d => `${d.slice(5)}(${dowOf(d)})`), '합계'];
    ws.addRow(header);
    ws.getRow(1).eachCell(c => { c.font = { bold: true }; c.alignment = { horizontal: 'center' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; });
    for (const st of stores) {
      ws.addRow([st.store, st.branch, ...dates.map(d => (m[st.key] && m[st.key][d]) || 0), storeTotal[st.key]]);
    }
    ws.addRow(['합계', '', ...dates.map(d => dateTotal[d] || 0), grand]);
    ws.getRow(ws.rowCount).eachCell(c => { c.font = { bold: true }; });
    ws.columns.forEach((col, i) => { col.width = i < 2 ? 16 : 9; });
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    dlBlob(buf, `출석체크이벤트_${fFrom}_${fTo}.xlsx`);
  };

  return (
    <>
      <div className="card">
        <div className="card-label">🎁 출석체크 이벤트 참여현황 (매장별 · 일자별)</div>
        <div className="fbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} />
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 매장</option>
            {allStores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="fbar-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="fresult">
              총 참여 <b>{grand.toLocaleString()}</b>명 · 적립 <b>{(grand * REWARD).toLocaleString()}</b>원
            </span>
            {grand > 0 && (
              <button type="button" onClick={exportExcel}
                style={{ height: 34, padding: '0 14px', border: '1px solid #2e7d32', borderRadius: 'var(--radius)', background: '#e8f5e9', color: '#2e7d32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                📥 엑셀
              </button>
            )}
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>{loading ? <span className="spinner" /> : '🔄 새로고침'}</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        {loading ? <div className="empty"><span className="spinner" /></div>
        : grand === 0 ? <div className="empty">해당 기간 참여내역이 없습니다</div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg2, #fff)' }}>매장</th>
                  <th>지점</th>
                  {dates.map(d => (
                    <th key={d} className="r" style={{ whiteSpace: 'nowrap' }}>
                      {d.slice(5)}<br /><span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>({dowOf(d)})</span>
                    </th>
                  ))}
                  <th className="r" style={{ background: '#fff3e0' }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {stores.map(st => (
                  <tr key={st.key}>
                    <td><span className="badge badge-dept">{st.store}</span></td>
                    <td><span className="badge badge-store">{st.branch}</span></td>
                    {dates.map(d => {
                      const v = (m[st.key] && m[st.key][d]) || 0;
                      return <td key={d} className="r" style={{ fontFamily: 'var(--mono)', color: v ? 'var(--text)' : 'var(--text3)' }}>{v || '·'}</td>;
                    })}
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', background: '#fff8f0' }}>{storeTotal[st.key].toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
                  <td colSpan={2} style={{ fontWeight: 700 }}>일자별 합계</td>
                  {dates.map(d => (
                    <td key={d} className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{(dateTotal[d] || 0).toLocaleString()}</td>
                  ))}
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--accent)', fontSize: 14 }}>{grand.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
