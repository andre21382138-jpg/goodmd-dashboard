import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';
import { DAILY_CHECKLIST, CHECKLIST_ITEMS } from '../../lib/dailyChecklist';

// 매장 → 일일 체크리스트 (매니저 매일 작성)
export default function DailyChecklistPage({ profile }) {
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore, setHqStore]   = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const branchOpts = useMemo(() => (hqStore ? (STORE_MAP[hqStore] || []) : []), [hqStore]);
  const kstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const [checkDate, setCheckDate] = useState(kstToday); // 기본 오늘, 미제출 보완용 과거 날짜 선택 가능

  const [author, setAuthor]     = useState('');
  const [answers, setAnswers]   = useState({});
  const [itemMemos, setItemMemos] = useState({}); // { 항목라벨: 비고 }
  const [memo, setMemo]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [existing, setExisting] = useState(null);
  const [workers, setWorkers]   = useState([]);

  // 해당 매장 근무자 목록 (작성자 선택용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!storeName || !branchName) { setWorkers([]); return; }
      let acctId = isStoreMgr ? profile.id : null;
      if (!acctId) {
        const { data: prof } = await supabase.from('profiles').select('id')
          .eq('department', storeName).eq('branch', branchName).eq('approved', true).limit(1).maybeSingle();
        acctId = prof?.id;
      }
      if (!acctId) { if (!cancelled) setWorkers([]); return; }
      const { data } = await supabase.from('store_members')
        .select('name, display_name, job_title').eq('store_account_id', acctId).is('resigned_at', null)
        .order('is_primary', { ascending: false });
      if (!cancelled) setWorkers(data || []);
    })();
    return () => { cancelled = true; };
  }, [storeName, branchName, isStoreMgr, profile.id]);
  const workerNames = useMemo(() => {
    const names = workers.map(w => ({ nm: w.display_name || w.name, job: w.job_title }));
    if (author && !names.some(n => n.nm === author)) names.push({ nm: author, job: '' }); // 기존 저장 작성자 유지
    return names;
  }, [workers, author]);

  const loadToday = useCallback(async () => {
    if (!storeName || !branchName) { setExisting(null); return; }
    const { data } = await supabase.from('daily_checklists').select('*')
      .eq('store_name', storeName).eq('branch_name', branchName).eq('check_date', checkDate).maybeSingle();
    setExisting(data || null);
    if (data) { setAnswers(data.answers || {}); setItemMemos(data.item_memos || {}); setAuthor(data.author || ''); setMemo(data.memo || ''); }
    else { setAnswers({}); setItemMemos({}); setMemo(''); setAuthor(''); }
  }, [storeName, branchName, checkDate]);
  useEffect(() => { loadToday(); }, [loadToday]);

  const pick = (label, opt) => setAnswers(prev => ({ ...prev, [label]: prev[label] === opt ? undefined : opt }));
  const answeredCount = CHECKLIST_ITEMS.filter(l => answers[l]).length;
  const allAnswered = answeredCount === CHECKLIST_ITEMS.length;

  const save = async () => {
    if (!storeName || !branchName) { toast('점포·지점을 선택해주세요', 'err'); return; }
    if (!author.trim()) { toast('작성자(근무자)를 선택해주세요', 'err'); return; }
    if (!allAnswered) { toast(`모든 항목을 체크해주세요 (${answeredCount}/${CHECKLIST_ITEMS.length})`, 'err'); return; }
    setSaving(true);
    const clean = {};
    for (const l of CHECKLIST_ITEMS) clean[l] = answers[l];
    const cleanMemos = {};
    for (const l of CHECKLIST_ITEMS) { const v = (itemMemos[l] || '').trim(); if (v) cleanMemos[l] = v; }
    const row = {
      store_name: storeName, branch_name: branchName, check_date: checkDate,
      author: author.trim(), answers: clean, item_memos: cleanMemos, memo: memo.trim() || null,
      created_by: profile?.id || null, updated_at: new Date().toISOString(),
    };
    let error;
    if (existing) ({ error } = await supabase.from('daily_checklists').update(row).eq('id', existing.id));
    else ({ error } = await supabase.from('daily_checklists').insert(row));
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast(existing ? '일일 체크리스트 수정 완료' : '일일 체크리스트 저장 완료', 'ok');
    loadToday();
  };

  const inputStyle = { height: 38, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, outline: 'none' };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="card-label" style={{ margin: 0 }}>📋 일일 체크리스트</div>
          {existing && <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', fontSize: 11 }}>이 날짜 저장됨 (수정 가능)</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: answeredCount === CHECKLIST_ITEMS.length ? '#2e7d32' : 'var(--accent)', fontWeight: 700 }}>
            {answeredCount} / {CHECKLIST_ITEMS.length} 항목
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>📅 작성일</span>
          <input type="date" value={checkDate} max={kstToday} onChange={e => setCheckDate(e.target.value)}
            style={{ ...inputStyle, width: 150 }} title="미제출한 지난 날짜도 선택해 작성할 수 있습니다" />
          {checkDate !== kstToday && <span className="badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', fontSize: 11 }}>과거 날짜</span>}
          {isStoreMgr ? (
            <div style={{ fontSize: 13, fontWeight: 700 }}>🏬 {storeName} {branchName}</div>
          ) : (
            <>
              <select value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }} style={{ ...inputStyle, width: 160 }}>
                <option value="">점포 선택</option>
                {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={hqBranch} onChange={e => setHqBranch(e.target.value)} disabled={!hqStore} style={{ ...inputStyle, width: 160 }}>
                <option value="">{hqStore ? '지점 선택' : '점포 먼저'}</option>
                {branchOpts.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </>
          )}
          <select value={author} onChange={e => setAuthor(e.target.value)}
            style={{ ...inputStyle, width: 180, marginLeft: 'auto', borderColor: author ? 'var(--border)' : 'var(--accent)' }}>
            <option value="">작성자 선택 *</option>
            {workerNames.map(w => <option key={w.nm} value={w.nm}>{w.nm}{w.job ? ` (${w.job})` : ''}</option>)}
          </select>
        </div>
      </div>

      {DAILY_CHECKLIST.map(sec => (
        <div key={sec.cat} className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>{sec.icon} {sec.cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sec.items.map(it => (
              <div key={it.label} style={{ display: 'grid', gridTemplateColumns: '190px auto 1fr', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {it.label} {!answers[it.label] && <span style={{ color: 'var(--danger)', fontSize: 11 }}>*</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {it.options.map(opt => {
                    const on = answers[it.label] === opt;
                    return (
                      <button key={opt} type="button" onClick={() => pick(it.label, opt)}
                        style={{ height: 34, padding: '0 14px', borderRadius: 'var(--radius)', border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? '#fff3e0' : '#fff', color: on ? 'var(--accent)' : 'var(--text2)' }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <input value={itemMemos[it.label] || ''} onChange={e => setItemMemos(p => ({ ...p, [it.label]: e.target.value }))}
                  placeholder="비고"
                  style={{ width: '100%', height: 32, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>특이사항 / 비고 <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>(선택)</span></div>
        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
          placeholder="품절·클레임·이슈 상세 등 자유 기재" />
      </div>

      <button type="button" onClick={save} disabled={saving}
        style={{ width: '100%', height: 48, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        {saving ? '저장 중…' : (existing ? '✓ 수정 저장' : '✓ 저장')}
      </button>
    </div>
  );
}
