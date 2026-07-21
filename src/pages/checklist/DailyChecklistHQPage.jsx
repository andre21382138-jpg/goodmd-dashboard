import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { DAILY_CHECKLIST, ATTENTION_ANSWERS } from '../../lib/dailyChecklist';

// 본사 → 매장 일일 체크 (전일 저장분 매장별 조회 + 누락 표시)
export default function DailyChecklistHQPage() {
  const kst = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterday = kst(new Date(Date.now() - 24 * 3600 * 1000));

  const [date, setDate]       = useState(yesterday);
  const [stores, setStores]   = useState([]);   // 전체 매장 [{store,branch}]
  const [rows, setRows]       = useState([]);    // 해당 날짜 제출분
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState(null);

  // 전체 매장 목록 (승인 매니저 기준, 점포·지점 단위 1개)
  useEffect(() => {
    supabase.from('profiles').select('department, branch, job_title, approved')
      .eq('approved', true).eq('job_title', '매니저').order('department').order('branch')
      .then(({ data }) => {
        const map = new Map();
        for (const p of (data || [])) {
          if (!p.department || !p.branch) continue;
          const k = `${p.department}|${p.branch}`;
          if (!map.has(k)) map.set(k, { store: p.department, branch: p.branch });
        }
        setStores([...map.values()]);
      });
  }, []);

  const fetchDay = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('daily_checklists').select('*').eq('check_date', date).order('created_at');
    if (error) toast(error.message, 'err');
    else setRows(data || []);
    setLoading(false);
    setOpenKey(null);
  }, [date]);
  useEffect(() => { fetchDay(); }, [fetchDay]);

  const byKey = useMemo(() => {
    const m = new Map();
    for (const r of rows) m.set(`${r.store_name}|${r.branch_name}`, r);
    return m;
  }, [rows]);

  const submitted = stores.filter(s => byKey.has(`${s.store}|${s.branch}`));
  const missing   = stores.filter(s => !byKey.has(`${s.store}|${s.branch}`));
  const missingByStore = missing.reduce((m, s) => { (m[s.store] = m[s.store] || []).push(s.branch); return m; }, {});

  return (
    <>
      <div className="card">
        <div className="card-label">📋 매장 일일 체크 조회</div>
        <div className="fbar" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="date" className="fsel" value={date} onChange={e => setDate(e.target.value)} />
          <button className="btn btn-s" onClick={() => setDate(yesterday)}>전일</button>
          <button className="btn btn-s" onClick={() => setDate(kst(new Date()))}>오늘</button>
          <div className="fbar-right">
            <span className="fresult">
              제출 <b style={{ color: '#2e7d32' }}>{submitted.length}</b> / 전체 <b>{stores.length}</b>
              {missing.length > 0 && <> · 누락 <b style={{ color: 'var(--danger)' }}>{missing.length}</b></>}
            </span>
            <button className="btn btn-s" onClick={fetchDay} disabled={loading}>{loading ? <span className="spinner" /> : '🔄 새로고침'}</button>
          </div>
        </div>
      </div>

      {/* 누락 매장 */}
      {missing.length > 0 && (
        <div className="card" style={{ padding: '14px 18px', border: '1px solid #ef9a9a', background: '#fff5f5' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)', marginBottom: 10 }}>⚠️ 미작성 매장 {missing.length}개</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(missingByStore).map(([store, branches]) => (
              <div key={store} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: 'var(--danger)', minWidth: 120, flexShrink: 0 }}>{store}</span>
                <span style={{ color: 'var(--text3)' }}>:</span>
                <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{branches.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 제출 목록 */}
      <div className="card" style={{ padding: '16px 20px' }}>
        {loading ? <div className="empty"><span className="spinner" /></div>
        : submitted.length === 0 ? <div className="empty">해당 날짜에 저장된 체크리스트가 없습니다</div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>점포</th><th>지점</th><th>작성자</th><th style={{ width: 140 }}>저장시각</th><th style={{ width: 90, textAlign: 'center' }}>주의</th><th style={{ width: 80, textAlign: 'center' }}></th></tr>
              </thead>
              <tbody>
                {submitted.map(s => {
                  const r = byKey.get(`${s.store}|${s.branch}`);
                  const key = `${s.store}|${s.branch}`;
                  const open = openKey === key;
                  const attn = Object.values(r.answers || {}).filter(v => ATTENTION_ANSWERS.has(v)).length;
                  return (
                    <React.Fragment key={key}>
                      <tr style={{ cursor: 'pointer', background: open ? '#fff8e1' : 'transparent' }} onClick={() => setOpenKey(open ? null : key)}>
                        <td><span className="badge badge-dept">{s.store}</span></td>
                        <td><span className="badge badge-store">{s.branch}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.author || '-'}</td>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--text2)' }}>{r.created_at ? new Date(r.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          {attn > 0 ? <span className="badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', fontSize: 11 }}>주의 {attn}</span> : <span style={{ color: 'var(--text3)', fontSize: 12 }}>-</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-s" style={{ padding: '3px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); setOpenKey(open ? null : key); }}>{open ? '▲ 닫기' : '▼ 보기'}</button>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} style={{ background: '#fafafa', padding: '12px 16px', borderTop: '2px solid var(--accent)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                              {DAILY_CHECKLIST.map(sec => (
                                <div key={sec.cat}>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6 }}>{sec.icon} {sec.cat}</div>
                                  {sec.items.map(it => {
                                    const val = (r.answers || {})[it.label];
                                    const warn = ATTENTION_ANSWERS.has(val);
                                    return (
                                      <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '3px 0', borderBottom: '1px dashed #eee' }}>
                                        <span style={{ color: 'var(--text2)' }}>{it.label}</span>
                                        <span style={{ fontWeight: 700, color: warn ? 'var(--danger)' : 'var(--text)', whiteSpace: 'nowrap' }}>{val || '-'}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                            {r.memo && (
                              <div style={{ marginTop: 12, fontSize: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
                                <b style={{ color: 'var(--text2)' }}>비고:</b> {r.memo}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
