import React, { useState, useMemo } from 'react';
import { useSort, sortRows, uniq, dlBlob, toast } from '../../lib/utils';

async function exportSafety(rows, period) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('안전재고현황');
  ws.columns = [
    { key: 'dept',    width: 14 },
    { key: 'store',   width: 16 },
    { key: 'code',    width: 18 },
    { key: 'name',    width: 36 },
    { key: 'sales',   width: 16 },
    { key: 'safe',    width: 14 },
    { key: 'stock',   width: 14 },
    { key: 'shortage',width: 14 },
  ];
  const hr = ws.addRow([
    '백화점', '매장', '상품코드', '상품명',
    `매출수량(${period})`, '안전재고', '현재재고', '부족수량'
  ]);
  hr.height = 26;
  hr.eachCell(cell => {
    cell.font = { bold: true, name: 'Malgun Gothic', size: 10, color: { argb: 'FF1A1A1A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD600' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rows.forEach((r, i) => {
    const shortage = r.sales - r.stock;
    const row = ws.addRow([r.dept, r.store, r.code, r.name, r.sales, r.sales, r.stock, shortage]);
    row.height = 18;
    row.eachCell((cell, ci) => {
      cell.font = { name: 'Malgun Gothic', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: ci <= 4 ? 'left' : 'center' };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
      if (ci === 6) cell.font = { name: 'Malgun Gothic', size: 10, bold: true, color: { argb: 'FFBF6000' } };
      if (ci === 8 && shortage > 0) {
        cell.font = { name: 'Malgun Gothic', size: 10, bold: true, color: { argb: 'FFC62828' } };
      }
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `안전재고현황_${period.replace(/\s/g,'')}.xlsx`);
}

export default function SafetyTab({ rows: allRows, period }) {
  const [fDept,  setFDept]  = useState('');
  const [fStore, setFStore] = useState('');
  const [fSearch, setFS]    = useState('');
  const [showShortOnly, setShortOnly] = useState(false);
  const [exporting, setEx]  = useState(false);
  const sort = useSort('dept');

  const depts  = useMemo(() => uniq(allRows.map(r => r.dept)), [allRows]);
  const stores = useMemo(() => uniq((fDept ? allRows.filter(r => r.dept === fDept) : allRows).map(r => r.store)), [allRows, fDept]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (fDept)  rows = rows.filter(r => r.dept === fDept);
    if (fStore) rows = rows.filter(r => r.store === fStore);
    if (fSearch) {
      const q = fSearch.toLowerCase();
      rows = rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    if (showShortOnly) rows = rows.filter(r => r.stock < r.sales);
    return sortRows(rows, sort.key, sort.dir);
  }, [allRows, fDept, fStore, fSearch, showShortOnly, sort.key, sort.dir]);

  const shortCount = useMemo(() => allRows.filter(r => r.stock < r.sales).length, [allRows]);

  return (
    <>
      {shortCount > 0 && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 'var(--radius)',
          padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center',
          gap: 10, fontSize: 13, color: '#856404'
        }}>
          <span>⚠️</span>
          <span>재고 부족 항목 <strong>{shortCount}개</strong> — 안전재고 미달입니다.</span>
          <button className="btn btn-s" style={{ marginLeft: 'auto', fontSize: 11 }}
            onClick={() => setShortOnly(v => !v)}>
            {showShortOnly ? '전체 보기' : '부족 항목만 보기'}
          </button>
        </div>
      )}

      <div className="fbar">
        <select className="fsel" value={fDept} onChange={e => { setFDept(e.target.value); setFStore(''); }}>
          <option value="">전체 백화점</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
          <option value="">전체 매장</option>
          {stores.map(s => <option key={s}>{s}</option>)}
        </select>
        <input className="finput" placeholder="상품코드 / 상품명 검색" value={fSearch} onChange={e => setFS(e.target.value)} />
        {(fDept || fStore || fSearch) && (
          <button className="btn-ghost" onClick={() => { setFDept(''); setFStore(''); setFS(''); }}>✕ 초기화</button>
        )}
        <div className="fbar-right">
          <span className="fresult"><b>{filtered.length.toLocaleString()}</b>개 항목</span>
          <button className="btn btn-p"
            onClick={async () => { setEx(true); try { await exportSafety(filtered, period); toast('엑셀 다운로드 완료'); } catch(e) { toast(e.message,'err'); } setEx(false); }}
            disabled={exporting || !filtered.length}>
            {exporting ? <span className="spinner" /> : '⬇ Excel'}
          </button>
        </div>
      </div>

      <div className="twrap">
        <table>
          <thead>
            <tr>
              <th className={sort.thClass('dept')}  onClick={() => sort.toggle('dept')}>백화점</th>
              <th className={sort.thClass('store')} onClick={() => sort.toggle('store')}>매장</th>
              <th className={sort.thClass('code')}  onClick={() => sort.toggle('code')}>상품코드</th>
              <th className={sort.thClass('name')}  onClick={() => sort.toggle('name')}>상품명</th>
              <th className={'r '+sort.thClass('sales')}  onClick={() => sort.toggle('sales')} title="해당 기간 동안 판매한 수량">판매수량</th>
              <th className={'r '+sort.thClass('stock')}  onClick={() => sort.toggle('stock')} title="판매수량을 제외하고 남은 현재 재고">현재재고</th>
              <th className="r">부족수량</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} className="empty">조회 결과가 없습니다</td></tr>
              : filtered.map((r, i) => {
                  const shortage = r.stock - r.sales;
                  const isShort  = shortage < 0;
                  return (
                    <tr key={i} style={isShort ? { background: '#fff9f9' } : {}}>
                      <td><span className="badge badge-dept">{r.dept}</span></td>
                      <td><span className="badge badge-store">{r.store}</span></td>
                      <td className="mono">{r.code}</td>
                      <td>{r.name}</td>
                      <td className="r"><span className="safety-num">{r.sales.toLocaleString()}</span></td>
                      <td className="r">{r.stock.toLocaleString()}</td>
                      <td className="r">
                        {isShort
                          ? <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--danger)' }}>
                              ▼ {Math.abs(shortage).toLocaleString()}
                            </span>
                          : <span style={{ fontFamily:'var(--mono)', color:'var(--success)' }}>
                              +{shortage.toLocaleString()}
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </>
  );
}
