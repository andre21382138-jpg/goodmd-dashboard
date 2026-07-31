import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

const CATEGORIES = ['택배비', '사무용품', '기타'];
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const newRow = () => ({ category: '', amount: '', memo: '' });

// 매장 → 지출 입력 (공용 날짜 + 항목/금액/메모 여러 행 일괄 저장)
export default function ExpenseInputPage({ profile }) {
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore, setHqStore]   = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const branchOpts = useMemo(() => (hqStore ? (STORE_MAP[hqStore] || []) : []), [hqStore]);

  const [date, setDate] = useState(kstToday());
  const [rows, setRows] = useState([newRow()]);
  const [saving, setSaving] = useState(false);
  const [monthRows, setMonthRows] = useState([]); // 당월 날짜별 그룹 [{date, items, total}]
  const [detail, setDetail] = useState(null);     // 상세보기 팝업 { date, items, total }
  const curMonth = kstToday().slice(0, 7);

  const loadMonth = useCallback(async () => {
    if (!storeName || !branchName) { setMonthRows([]); return; }
    const { data } = await supabase.from('store_expenses').select('*')
      .eq('store_name', storeName).eq('branch_name', branchName)
      .gte('expense_date', `${curMonth}-01`).lte('expense_date', `${curMonth}-31`)
      .order('expense_date', { ascending: false }).order('id', { ascending: false });
    const map = new Map(); // date → {date, items, total} (쿼리가 날짜 내림차순이라 삽입순 유지)
    for (const e of (data || [])) {
      if (!map.has(e.expense_date)) map.set(e.expense_date, { date: e.expense_date, items: [], total: 0 });
      const g = map.get(e.expense_date); g.items.push(e); g.total += e.amount || 0;
    }
    setMonthRows([...map.values()]);
  }, [storeName, branchName, curMonth]);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  // 팝업 열려있으면 데이터 갱신 시 팝업 내용도 동기화
  useEffect(() => {
    if (detail) { const g = monthRows.find(r => r.date === detail.date); setDetail(g || null); }
  }, [monthRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (i, k, v) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(rs => [...rs, newRow()]);
  const removeRow = (i) => setRows(rs => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)));

  const total = rows.reduce((s, r) => s + (Number(String(r.amount).replace(/,/g, '')) || 0), 0);

  const save = async () => {
    if (!storeName || !branchName) { toast('점포·지점을 선택해주세요', 'err'); return; }
    if (!date) { toast('날짜를 선택해주세요', 'err'); return; }
    const clean = [];
    for (const r of rows) {
      const amt = Number(String(r.amount).replace(/,/g, '')) || 0;
      const hasAny = r.category || amt > 0 || r.memo.trim();
      if (!hasAny) continue; // 완전 빈 행은 무시
      if (!r.category) { toast('지출항목을 선택해주세요', 'err'); return; }
      if (amt <= 0) { toast('금액을 입력해주세요', 'err'); return; }
      clean.push({
        store_name: storeName, branch_name: branchName,
        expense_date: date, category: r.category, amount: amt,
        memo: r.memo.trim() || null, created_by: profile?.id || null,
      });
    }
    if (clean.length === 0) { toast('저장할 지출 내역이 없습니다', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('store_expenses').insert(clean);
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast(`지출 ${clean.length}건 저장 완료`, 'ok');
    setRows([newRow()]);
    loadMonth();
  };

  const del = async (id) => {
    const { error } = await supabase.from('store_expenses').delete().eq('id', id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast('삭제되었습니다', 'ok');
    loadMonth();
  };

  const inputStyle = { height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const won = (n) => Number(n || 0).toLocaleString();
  const GRID = '180px 170px 1fr 44px';

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="card-label" style={{ margin: 0 }}>💸 지출 입력</div>
          {!isStoreMgr && (
            <div style={{ display: 'flex', gap: 8, marginLeft: 8, flexWrap: 'wrap' }}>
              <select value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }} style={{ ...inputStyle, width: 150 }}>
                <option value="">점포 선택</option>
                {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={hqBranch} onChange={e => setHqBranch(e.target.value)} disabled={!hqStore} style={{ ...inputStyle, width: 150 }}>
                <option value="">{hqStore ? '지점 선택' : '점포 먼저'}</option>
                {branchOpts.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>합계 {won(total)}원</span>
        </div>

        {/* 날짜 (공용) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>📅 날짜</span>
          <input type="date" value={date} max={kstToday()} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 180 }} />
        </div>

        {/* 지출 항목 행 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, fontSize: 12, color: 'var(--text3)', fontWeight: 700, padding: '0 2px 6px' }}>
            <div>지출항목</div><div>금액</div><div>메모 (선택)</div><div></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center' }}>
                <select value={r.category} onChange={e => update(i, 'category', e.target.value)}
                  style={{ ...inputStyle, borderColor: r.category ? 'var(--border)' : 'var(--accent)' }}>
                  <option value="">항목 선택</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input inputMode="numeric" value={r.amount}
                  onChange={e => update(i, 'amount', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="금액 *" style={{ ...inputStyle, textAlign: 'right', fontFamily: 'var(--mono)' }} />
                <input value={r.memo} onChange={e => update(i, 'memo', e.target.value)} placeholder="메모" style={inputStyle} />
                <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} title="행 삭제"
                  style={{ height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', color: rows.length === 1 ? 'var(--text3)' : 'var(--danger)', cursor: rows.length === 1 ? 'default' : 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addRow}
            style={{ marginTop: 10, height: 42, width: '100%', border: '1px dashed var(--accent)', borderRadius: 'var(--radius)', background: '#fff', color: 'var(--accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + 지출항목 추가
          </button>
        </div>

        {/* 저장 (우측) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={save} disabled={saving}
            style={{ height: 46, padding: '0 40px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '저장 중…' : '✓ 저장'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="card-label" style={{ marginBottom: 12 }}>📋 이번 달 지출 내역 <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>({curMonth})</span></div>
        {(!storeName || !branchName) ? <div className="empty">점포·지점을 선택해주세요</div>
        : monthRows.length === 0 ? <div className="empty">이번 달 지출 내역이 없습니다</div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th style={{ width: 140 }}>날짜</th><th className="r" style={{ width: 100 }}>지출건수</th><th className="r" style={{ width: 140 }}>총 금액</th><th style={{ width: 90, textAlign: 'center' }}></th></tr>
              </thead>
              <tbody>
                {monthRows.map(g => (
                  <tr key={g.date}>
                    <td style={{ fontWeight: 700 }}>{g.date}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{g.items.length}건</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{won(g.total)}원</td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" onClick={() => setDetail(g)} className="btn btn-s" style={{ padding: '3px 12px', fontSize: 11 }}>상세보기</button>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
                  <td style={{ fontWeight: 700, padding: '9px 11px' }}>당월 합계</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{monthRows.reduce((s, g) => s + g.items.length, 0)}건</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>{won(monthRows.reduce((s, g) => s + g.total, 0))}원</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <div onClick={() => setDetail(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#fff' }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>💸 {detail.date} 지출 내역</div>
              <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{won(detail.total)}원</span>
              <button type="button" onClick={() => setDetail(null)} style={{ marginLeft: 8, border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>×</button>
            </div>
            <div style={{ padding: '12px 20px 20px' }}>
              <div className="twrap">
                <table>
                  <thead>
                    <tr><th style={{ width: 100 }}>항목</th><th className="r" style={{ width: 120 }}>금액</th><th>메모</th><th style={{ width: 56, textAlign: 'center' }}></th></tr>
                  </thead>
                  <tbody>
                    {detail.items.map(e => (
                      <tr key={e.id}>
                        <td><span className="badge" style={{ background: '#f5f5f5', color: 'var(--text2)', border: '1px solid var(--border)' }}>{e.category}</span></td>
                        <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{won(e.amount)}원</td>
                        <td style={{ fontSize: 13, color: 'var(--text2)' }}>{e.memo || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" onClick={() => del(e.id)} className="btn btn-s" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--danger)' }}>삭제</button>
                        </td>
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
