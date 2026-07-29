import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

const CATEGORIES = ['택배비', '사무용품', '기타'];
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const newRow = () => ({ date: kstToday(), category: '', amount: '', memo: '' });

// 매장 → 지출 입력 (날짜·항목·금액·메모, 여러 행 일괄 저장)
export default function ExpenseInputPage({ profile }) {
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore, setHqStore]   = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const branchOpts = useMemo(() => (hqStore ? (STORE_MAP[hqStore] || []) : []), [hqStore]);

  const [rows, setRows] = useState([newRow()]);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]);

  const loadRecent = useCallback(async () => {
    if (!storeName || !branchName) { setRecent([]); return; }
    const { data } = await supabase.from('store_expenses').select('*')
      .eq('store_name', storeName).eq('branch_name', branchName)
      .order('expense_date', { ascending: false }).order('id', { ascending: false }).limit(20);
    setRecent(data || []);
  }, [storeName, branchName]);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  const update = (i, k, v) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(rs => [...rs, { ...newRow(), date: rs[rs.length - 1]?.date || kstToday() }]);
  const removeRow = (i) => setRows(rs => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)));

  const total = rows.reduce((s, r) => s + (Number(String(r.amount).replace(/,/g, '')) || 0), 0);

  const save = async () => {
    if (!storeName || !branchName) { toast('점포·지점을 선택해주세요', 'err'); return; }
    const clean = [];
    for (const r of rows) {
      const amt = Number(String(r.amount).replace(/,/g, '')) || 0;
      const hasAny = r.category || amt > 0 || r.memo.trim();
      if (!hasAny) continue; // 완전 빈 행은 무시
      if (!r.category) { toast('지출항목을 선택해주세요', 'err'); return; }
      if (amt <= 0) { toast('금액을 입력해주세요', 'err'); return; }
      if (!r.date) { toast('날짜를 선택해주세요', 'err'); return; }
      clean.push({
        store_name: storeName, branch_name: branchName,
        expense_date: r.date, category: r.category, amount: amt,
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
    loadRecent();
  };

  const del = async (id) => {
    const { error } = await supabase.from('store_expenses').delete().eq('id', id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast('삭제되었습니다', 'ok');
    loadRecent();
  };

  const inputStyle = { height: 38, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const won = (n) => Number(n || 0).toLocaleString();

  return (
    <div style={{ maxWidth: 920 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="card-label" style={{ margin: 0 }}>💸 지출 입력</div>
          {isStoreMgr ? (
            <div style={{ fontSize: 13, fontWeight: 700, marginLeft: 8 }}>🏬 {storeName} {branchName}</div>
          ) : (
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
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>합계 {won(total)}원</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 150px 160px 1fr 40px', gap: 10, fontSize: 12, color: 'var(--text3)', fontWeight: 700, padding: '0 2px' }}>
            <div>날짜</div><div>지출항목</div><div>금액</div><div>메모 (선택)</div><div></div>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 150px 160px 1fr 40px', gap: 10, alignItems: 'center' }}>
              <input type="date" value={r.date} max={kstToday()} onChange={e => update(i, 'date', e.target.value)} style={inputStyle} />
              <select value={r.category} onChange={e => update(i, 'category', e.target.value)}
                style={{ ...inputStyle, borderColor: r.category ? 'var(--border)' : 'var(--accent)' }}>
                <option value="">선택</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input inputMode="numeric" value={r.amount}
                onChange={e => update(i, 'amount', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="금액 *" style={{ ...inputStyle, textAlign: 'right', fontFamily: 'var(--mono)' }} />
              <input value={r.memo} onChange={e => update(i, 'memo', e.target.value)} placeholder="메모" style={inputStyle} />
              <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                title="행 삭제"
                style={{ height: 38, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', color: rows.length === 1 ? 'var(--text3)' : 'var(--danger)', cursor: rows.length === 1 ? 'default' : 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" onClick={addRow}
            style={{ height: 44, flex: '0 0 auto', padding: '0 18px', border: '1px dashed var(--accent)', borderRadius: 'var(--radius)', background: '#fff', color: 'var(--accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + 행 추가
          </button>
          <button type="button" onClick={save} disabled={saving}
            style={{ height: 44, flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '저장 중…' : '✓ 저장'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="card-label" style={{ marginBottom: 12 }}>📋 최근 지출 내역</div>
        {(!storeName || !branchName) ? <div className="empty">점포·지점을 선택해주세요</div>
        : recent.length === 0 ? <div className="empty">저장된 지출 내역이 없습니다</div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th style={{ width: 120 }}>날짜</th><th style={{ width: 110 }}>항목</th><th className="r" style={{ width: 120 }}>금액</th><th>메모</th><th style={{ width: 60, textAlign: 'center' }}></th></tr>
              </thead>
              <tbody>
                {recent.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.expense_date}</td>
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
        )}
      </div>
    </div>
  );
}
