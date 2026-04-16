import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, GradeBadge } from '../../lib/utils';

function byteLen(str) {
  let len = 0;
  for (const ch of str) len += ch.charCodeAt(0) > 127 ? 2 : 1;
  return len;
}

export default function CustomerLookupPage({ profile }) {
  const isManager = profile?.job_title === '매니저';
  const [search,     setSearch]    = useState('');
  const [fStore,     setFStore]    = useState('');
  const [fBranch,    setFBranch]   = useState('');
  const [fFrom,      setFFrom]     = useState('');
  const [fTo,        setFTo]       = useState('');
  const [fSms,       setFSms]      = useState(false);
  const [fNewOnly,   setFNewOnly]  = useState(false);
  const [fGrade,     setFGrade]    = useState('');
  const [customers,  setCustomers] = useState([]);
  const [selected,   setSelected]  = useState(null);
  const [purchases,  setPurchases] = useState([]);
  const [loading,    setLoading]   = useState(false);
  const [loadingP,   setLoadingP]  = useState(false);
  const [allStores,  setAllStores] = useState([]);
  const [page,       setPage]      = useState(0);
  const [totalCount, setTotalCount]= useState(0);
  const [hasMore,    setHasMore]   = useState(false); // eslint-disable-line no-unused-vars

  // 체크박스 선택 (현재 페이지)
  const [checkedIds, setCheckedIds] = useState(new Set());

  // SMS 모달
  const [smsModal,      setSmsModal]      = useState(false);
  const [smsMsg,        setSmsMsg]        = useState('');
  const [smsSender,     setSmsSender]     = useState('');
  const [sending,       setSending]       = useState(false);
  const [bulkTargets,   setBulkTargets]   = useState(null); // 전체 발송 시 override
  const [loadingBulk,   setLoadingBulk]   = useState(false);
  const [testPhone,     setTestPhone]     = useState('');
  const [sendingTest,   setSendingTest]   = useState(false);

  // 점포 목록 로드 (profiles에서)
  useEffect(() => {
    supabase.from('profiles').select('department').eq('approved', true)
      .neq('role','admin').neq('job_title','담당자')
      .then(({ data }) => {
        const stores = [...new Set((data||[]).map(d => d.department))].filter(Boolean).sort();
        setAllStores(stores);
      });
  }, []);

  const [allBranches, setAllBranches] = useState([]);
  useEffect(() => {
    if (!fStore) { setAllBranches([]); return; }
    supabase.from('profiles').select('branch').eq('approved', true)
      .eq('department', fStore).neq('role','admin').neq('job_title','담당자')
      .then(({ data }) => {
        const branches = [...new Set((data||[]).map(d => d.branch))].filter(Boolean).sort();
        setAllBranches(branches);
      });
  }, [fStore]);

  const PAGE_SIZE = 200;

  const fetchCustomers = useCallback(async (pg = 0) => {
    setLoading(true);
    setPage(pg);
    setCheckedIds(new Set());
    let q = supabase.from('customers')
      .select('*', { count: 'exact' })
      .order('joined_at', { ascending: false });
    if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    if (fStore)  q = q.eq('store_name', fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    if (fFrom)   q = q.gte('joined_at', fFrom);
    if (fTo)     q = q.lte('joined_at', fTo);
    if (fSms)    q = q.eq('sms_consent', true);
    if (fGrade)  q = q.eq('grade', fGrade);
    if (fNewOnly) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      q = q.gte('joined_at', oneYearAgo.toISOString().slice(0,10));
    }
    const { data, count, error } = await q.range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);
    if (error) { toast(error.message, 'err'); setLoading(false); return; }
    setCustomers(data || []);
    setTotalCount(count || 0);
    setSelected(null); setPurchases([]);
    setLoading(false);
  }, [search, fStore, fBranch, fFrom, fTo, fSms, fNewOnly, fGrade]);

  // 필터 조건 전체 SMS동의 회원 가져오기 (Supabase 1000행 제한 우회)
  const fetchAllSmsTargets = useCallback(async () => {
    setLoadingBulk(true);
    const CHUNK = 1000;
    let all = [];
    let from = 0;

    const buildQuery = () => {
      let q = supabase.from('customers')
        .select('id, name, phone')
        .eq('sms_consent', true)
        .order('joined_at', { ascending: false });
      if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      if (fStore)  q = q.eq('store_name', fStore);
      if (fBranch) q = q.eq('branch_name', fBranch);
      if (fFrom)   q = q.gte('joined_at', fFrom);
      if (fTo)     q = q.lte('joined_at', fTo);
      if (fGrade)  q = q.eq('grade', fGrade);
      if (fNewOnly) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        q = q.gte('joined_at', oneYearAgo.toISOString().slice(0,10));
      }
      return q;
    };

    while (true) {
      const { data, error } = await buildQuery().range(from, from + CHUNK - 1);
      if (error) { toast(error.message, 'err'); setLoadingBulk(false); return; }
      if (!data?.length) break;
      all = all.concat(data);
      if (data.length < CHUNK) break;
      from += CHUNK;
    }

    setLoadingBulk(false);
    if (!all.length) { toast('SMS동의 회원이 없습니다', 'inf'); return; }
    setBulkTargets(all);
    setSmsModal(true);
  }, [search, fStore, fBranch, fFrom, fTo, fGrade, fNewOnly]);

  // 점포 변경시 지점 초기화
  const handleStoreChange = (val) => { setFStore(val); setFBranch(''); };

  const fetchPurchases = async (customerId) => {
    setLoadingP(true);
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name)')
      .eq('customer_id', customerId)
      .order('sold_at', { ascending: false });
    setPurchases(data || []);
    setLoadingP(false);
  };

  const handleSelect = (c) => { setSelected(c); fetchPurchases(c.id); };

  const withdrawCustomer = async (c, e) => {
    e.stopPropagation();
    if (!window.confirm(`[${c.name}] 회원을 탈퇴 처리하시겠습니까?\n\n이름: ${c.name}\n연락처: ${c.phone}\n점포: ${c.store_name} ${c.branch_name}\n\n탈퇴 후에는 회원 정보가 삭제됩니다.`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) toast(error.message, 'err');
    else {
      toast(`${c.name} 회원 탈퇴 처리 완료`, 'ok');
      if (selected?.id === c.id) setSelected(null);
      fetchCustomers();
    }
  };

  // 테스트 발송 (본인 번호)
  const handleTestSend = async () => {
    const phone = testPhone.replace(/\D/g, '');
    if (phone.length < 10) { toast('휴대폰 번호를 확인해주세요', 'err'); return; }
    if (!smsSender.replace(/\D/g,'')) { toast('발신번호를 입력해주세요', 'err'); return; }
    if (!smsMsg.trim()) { toast('메시지를 입력해주세요', 'err'); return; }
    setSendingTest(true);
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivers: [{ name: '테스트', phone }],
          message: smsMsg,
          sender: smsSender,
        }),
      });
      const result = await res.json();
      if (!res.ok) toast(result.error || '테스트 발송 실패', 'err');
      else if (result.ok === 1) toast(`✅ 테스트 발송 성공 → ${testPhone}`, 'ok');
      else toast(`테스트 발송 실패: ${result.failed?.[0] || '알 수 없는 오류'}`, 'err');
    } catch(e) {
      toast('네트워크 오류: ' + e.message, 'err');
    }
    setSendingTest(false);
  };

  // 체크박스 토글
  const toggleCheck = (e, id) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 전체 선택 / 해제 (SMS동의 회원만)
  const smsConsentIds = useMemo(() => customers.filter(c => c.sms_consent).map(c => c.id), [customers]);
  const allChecked = smsConsentIds.length > 0 && smsConsentIds.every(id => checkedIds.has(id));
  const toggleAll = (e) => {
    e.stopPropagation();
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(smsConsentIds));
    }
  };

  // 선택된 수신자 목록 (bulkTargets 우선)
  const checkedCustomers = useMemo(
    () => bulkTargets ?? customers.filter(c => checkedIds.has(c.id)),
    [bulkTargets, customers, checkedIds]
  );

  // SMS 발송
  const handleSendSms = async () => {
    if (!smsSender.replace(/\D/g,'')) { toast('발신번호를 입력해주세요', 'err'); return; }
    if (!smsMsg.trim()) { toast('메시지를 입력해주세요', 'err'); return; }
    if (checkedCustomers.length === 0) { toast('수신자를 선택해주세요', 'err'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivers: checkedCustomers.map(c => ({ name: c.name, phone: c.phone })),
          message: smsMsg,
          sender: smsSender,
        }),
      });
      const result = await res.json();
      if (!res.ok) { toast(result.error || 'SMS 발송 실패', 'err'); }
      else {
        toast(`발송 완료: ${result.ok}건 성공${result.failCount ? ` / ${result.failCount}건 실패` : ''}`, result.failCount ? 'inf' : 'ok');
        if (result.failCount) {
          console.warn('SMS 실패 목록:', result.failed);
        }
        setSmsModal(false);
        setSmsMsg('');
        setSmsSender('');
        setBulkTargets(null);
        setCheckedIds(new Set());
      }
    } catch(e) {
      toast('네트워크 오류: ' + e.message, 'err');
    }
    setSending(false);
  };

  // 단건 문자 버튼 (행 내)
  const handleSingleSms = (e, c) => {
    e.stopPropagation();
    if (!c.sms_consent) { toast('SMS 수신 미동의 회원입니다', 'err'); return; }
    setCheckedIds(new Set([c.id]));
    setSmsModal(true);
  };

  const totalAmt = useMemo(() => purchases.reduce((s,r) => s + r.price * r.quantity, 0), [purchases]);
  const totalQty = useMemo(() => purchases.reduce((s,r) => s + r.quantity, 0), [purchases]); // eslint-disable-line no-unused-vars

  const msgBytes = byteLen(smsMsg);

  return (
    <div>
      {/* 검색·필터 */}
      <div className="card">
        <div className="card-label">회원 조회</div>
        <div className="fbar" style={{ flexWrap:'wrap', gap:8 }}>
          <input className="finput" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 연락처 검색" style={{ height:34 }}
            onKeyDown={e => e.key==='Enter' && fetchCustomers()} />
          <select className="fsel" value={fStore} onChange={e => handleStoreChange(e.target.value)}>
            <option value="">전체 점포</option>
            {allStores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)}
            disabled={!fStore} style={{ background: !fStore ? '#f0f0f0' : '#fff' }}>
            <option value="">전체 지점</option>
            {allBranches.map(b => <option key={b}>{b}</option>)}
          </select>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="가입일 시작" />
          <span style={{fontSize:12,color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="가입일 종료" />
          <button type="button"
            onClick={() => setFSms(p => !p)}
            style={{ height:34, padding:'0 14px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
              borderColor: fSms ? 'var(--success)' : 'var(--border)',
              background: fSms ? '#e8f5e9' : '#fff',
              color: fSms ? 'var(--success)' : 'var(--text2)' }}>
            {fSms ? '✅ 마케팅동의만' : '📱 마케팅동의만'}
          </button>
          <button type="button"
            onClick={() => setFNewOnly(p => !p)}
            style={{ height:34, padding:'0 14px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
              borderColor: fNewOnly ? '#1565C0' : 'var(--border)',
              background: fNewOnly ? '#e3f2fd' : '#fff',
              color: fNewOnly ? '#1565C0' : 'var(--text2)' }}>
            {fNewOnly ? '✅ 1년 미만' : '📅 1년 미만'}
          </button>
          <select className="fsel" value={fGrade} onChange={e => setFGrade(e.target.value)}>
            <option value="">전체 등급</option>
            {['VVIP','VIP','로얄','골드','실버','패밀리'].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {(search||fStore||fBranch||fFrom||fTo||fSms||fNewOnly||fGrade) &&
            <button className="btn-ghost" onClick={() => { setSearch(''); setFStore(''); setFBranch(''); setFFrom(''); setFTo(''); setFSms(false); setFNewOnly(false); setFGrade(''); setCustomers([]); setSelected(null); setPage(0); setTotalCount(0); setHasMore(false); setCheckedIds(new Set()); }}>✕ 초기화</button>}
          <div className="fbar-right">
            <button className="btn btn-p" onClick={() => fetchCustomers(0)} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔍 조회'}
            </button>
          </div>
        </div>
      </div>

      {customers.length > 0 && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8}}>
            <span className="fresult">총 <b>{totalCount.toLocaleString()}</b>명 · 이 페이지 <b>{customers.length}</b>명 · SMS동의 <b>{customers.filter(c=>c.sms_consent).length}</b>명</span>
            <div style={{display:'flex', gap:8}}>
              {checkedIds.size > 0 && (
                <button
                  className="btn btn-p"
                  style={{padding:'6px 18px', fontSize:13, fontWeight:700}}
                  onClick={() => setSmsModal(true)}>
                  📨 선택 {checkedIds.size}명 문자 발송
                </button>
              )}
              <button
                className="btn btn-s"
                style={{padding:'6px 18px', fontSize:13, fontWeight:700}}
                onClick={fetchAllSmsTargets}
                disabled={loadingBulk}
                title="현재 필터 조건의 SMS동의 회원 전체에게 발송">
                {loadingBulk ? <span className="spinner"/> : `📡 필터 전체 일괄발송`}
              </button>
            </div>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{textAlign:'center', width:36}}>
                    <input type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      title="SMS동의 회원 전체 선택"
                      style={{cursor:'pointer', width:15, height:15}}/>
                  </th>
                  <th>가입일</th>
                  <th>이름</th>
                  <th>등급</th>
                  <th>성별</th>
                  <th>휴대폰번호</th>
                  <th>생일</th>
                  <th>점포</th>
                  <th>지점</th>
                  <th>담당매니저</th>
                  <th className="r">남은적립금</th>
                  <th className="r">사용적립금</th>
                  <th className="r">구매건수</th>
                  <th className="r">구매수량</th>
                  <th className="r">총구매금액</th>
                  <th style={{textAlign:'center'}}>마케팅동의</th>
                  <th></th>
                  {!isManager && <th></th>}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} style={{cursor:'pointer'}} onClick={() => handleSelect(c)}>
                    <td style={{textAlign:'center'}} onClick={e => e.stopPropagation()}>
                      {c.sms_consent ? (
                        <input type="checkbox"
                          checked={checkedIds.has(c.id)}
                          onChange={e => toggleCheck(e, c.id)}
                          style={{cursor:'pointer', width:15, height:15}}/>
                      ) : (
                        <span style={{color:'var(--text3)', fontSize:12}}>-</span>
                      )}
                    </td>
                    <td className="mono" style={{fontSize:11}}>{c.joined_at}</td>
                    <td><strong style={{fontSize:13}}>{c.name}</strong></td>
                    <td><GradeBadge grade={c.grade || '패밀리'}/></td>
                    <td style={{fontSize:13}}>{c.gender || '-'}</td>
                    <td className="mono" style={{fontSize:12}}>{c.phone}</td>
                    <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{c.birthday || '-'}</td>
                    <td><span className="badge badge-dept">{c.store_name}</span></td>
                    <td><span className="badge badge-store">{c.branch_name}</span></td>
                    <td style={{fontSize:12, color:'var(--accent)', fontWeight:600}}>{c.manager_name || '-'}</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', color: (c.total_points||0)>0?'var(--success)':'var(--text3)', whiteSpace:'nowrap'}}>{(c.total_points||0).toLocaleString()}원</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', color:'var(--text3)', whiteSpace:'nowrap'}}>{(c.used_points||0).toLocaleString()}원</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', whiteSpace:'nowrap'}}>{(c.purchase_count||0)}건</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', whiteSpace:'nowrap'}}>{(c.purchase_qty||0)}개</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', fontWeight:600, whiteSpace:'nowrap'}}>{(c.total_purchase||0).toLocaleString()}원</td>
                    <td style={{textAlign:'center'}}>
                      {c.sms_consent
                        ? <span style={{color:'var(--success)', fontWeight:700, fontSize:12}}>✅ 동의</span>
                        : <span style={{color:'var(--text3)', fontSize:12}}>미동의</span>
                      }
                    </td>
                    <td>
                      <button
                        className="btn btn-s"
                        style={{fontSize:11, padding:'3px 10px', opacity: c.sms_consent ? 1 : 0.35}}
                        title={c.sms_consent ? '문자 발송' : 'SMS 미동의 회원'}
                        onClick={e => handleSingleSms(e, c)}>
                        📱 문자
                      </button>
                    </td>
                    {!isManager && (
                      <td>
                        <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}}
                          onClick={e => withdrawCustomer(c, e)}>
                          탈퇴
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 페이지 네비게이션 */}
          {totalCount > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(totalCount / PAGE_SIZE);
            const visiblePages = [];
            const delta = 4;
            let start = Math.max(0, page - delta);
            let end   = Math.min(totalPages - 1, page + delta);
            if (end - start < delta * 2) {
              start = Math.max(0, end - delta * 2);
              end   = Math.min(totalPages - 1, start + delta * 2);
            }
            for (let i = start; i <= end; i++) visiblePages.push(i);
            const btnStyle = (active) => ({
              height: 32, minWidth: 32, padding: '0 8px', border: '1px solid',
              borderRadius: 'var(--radius)', fontSize: 13, fontWeight: active ? 700 : 400,
              cursor: 'pointer',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              background: active ? '#fff3e0' : '#fff',
              color: active ? 'var(--accent)' : 'var(--text2)',
            });
            return (
              <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'14px 0', borderTop:'1px solid var(--border)', flexWrap:'wrap'}}>
                <button style={btnStyle(false)} disabled={page===0} onClick={() => fetchCustomers(0)}>«</button>
                <button style={btnStyle(false)} disabled={page===0} onClick={() => fetchCustomers(page-1)}>‹</button>
                {start > 0 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                {visiblePages.map(p => (
                  <button key={p} style={btnStyle(p===page)} onClick={() => fetchCustomers(p)}>{p+1}</button>
                ))}
                {end < totalPages-1 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                <button style={btnStyle(false)} disabled={page===totalPages-1} onClick={() => fetchCustomers(page+1)}>›</button>
                <button style={btnStyle(false)} disabled={page===totalPages-1} onClick={() => fetchCustomers(totalPages-1)}>»</button>
                <span style={{fontSize:12, color:'var(--text3)', marginLeft:8}}>
                  {page+1} / {totalPages}페이지 (총 {totalCount.toLocaleString()}명)
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* SMS 발송 모달 */}
      {smsModal && (
        <div style={{position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => { if (!sending) { setSmsModal(false); setSmsMsg(''); setSmsSender(''); setBulkTargets(null); } }}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(520px,95vw)', boxShadow:'0 8px 40px rgba(0,0,0,0.25)', padding:'24px'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', alignItems:'center', marginBottom:18}}>
              <div style={{fontSize:17, fontWeight:700}}>📨 마케팅 SMS 발송</div>
              <button onClick={() => { if (!sending) { setSmsModal(false); setSmsMsg(''); setSmsSender(''); setBulkTargets(null); } }}
                style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
            </div>

            {/* 수신자 요약 */}
            <div style={{background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, fontSize:13}}>
              <span style={{fontWeight:700, color:'var(--accent)'}}>수신자 {checkedCustomers.length}명</span>
              <span style={{color:'var(--text2)', marginLeft:8}}>
                {checkedCustomers.slice(0,5).map(c => c.name).join(', ')}{checkedCustomers.length > 5 ? ` 외 ${checkedCustomers.length - 5}명` : ''}
              </span>
            </div>

            {/* 발신번호 */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:6}}>발신번호 <span style={{fontWeight:400, color:'var(--text3)'}}>(문자나라에 사전등록된 번호)</span></label>
              <input
                value={smsSender}
                onChange={e => setSmsSender(e.target.value)}
                placeholder="01012345678"
                style={{width:'100%', height:36, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--mono)', outline:'none', boxSizing:'border-box'}}
              />
            </div>

            {/* 메시지 입력 */}
            <div style={{marginBottom:6}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:6}}>메시지 내용</label>
              <textarea
                value={smsMsg}
                onChange={e => setSmsMsg(e.target.value)}
                rows={6}
                placeholder="발송할 메시지를 입력하세요"
                style={{width:'100%', padding:'10px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', resize:'vertical', outline:'none', boxSizing:'border-box'}}
              />
            </div>

            {/* 바이트 카운터 */}
            <div style={{display:'flex', justifyContent:'flex-end', marginBottom:16, fontSize:12, color: msgBytes > 2000 ? 'var(--err, #d32f2f)' : msgBytes > 90 ? '#f57c00' : 'var(--text3)'}}>
              {msgBytes} byte{msgBytes <= 90 ? ` (단문 SMS, 최대 90byte)` : msgBytes <= 2000 ? ` (장문 LMS)` : ` ⚠ 2000byte 초과`}
            </div>

            {/* 테스트 발송 */}
            <div style={{background:'#fffde7', border:'1px dashed #f9a825', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:14}}>
              <div style={{fontSize:12, fontWeight:700, color:'#f57f17', marginBottom:8}}>🧪 테스트 발송 (본인 번호로 먼저 확인)</div>
              <div style={{display:'flex', gap:8}}>
                <input
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  style={{flex:1, height:34, padding:'0 10px', border:'1px solid #f9a825', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--mono)', outline:'none'}}
                />
                <button
                  className="btn btn-s"
                  style={{whiteSpace:'nowrap', padding:'0 14px', height:34, borderColor:'#f9a825', color:'#f57f17', fontWeight:700}}
                  onClick={handleTestSend}
                  disabled={sendingTest || !smsMsg.trim() || !smsSender.replace(/\D/g,'')}>
                  {sendingTest ? <span className="spinner"/> : '테스트 발송'}
                </button>
              </div>
            </div>

            <div style={{display:'flex', gap:10}}>
              <button className="btn btn-s" style={{flex:1, justifyContent:'center', height:42}}
                onClick={() => { setSmsModal(false); setSmsMsg(''); setSmsSender(''); setBulkTargets(null); }} disabled={sending}>
                취소
              </button>
              <button className="btn btn-p" style={{flex:2, justifyContent:'center', height:42, fontWeight:700}}
                onClick={handleSendSms} disabled={sending || !smsMsg.trim() || !smsSender.replace(/\D/g,'') || msgBytes > 2000}>
                {sending ? <span className="spinner"/> : `📨 ${checkedCustomers.length}명에게 발송`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 상세 팝업 모달 */}
      {selected && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => setSelected(null)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(900px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div style={{padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10}}>
              <div style={{fontSize:18, fontWeight:700}}>{selected.name}</div>
              <GradeBadge grade={selected.grade || '패밀리'}/>
              {selected.gender && <span style={{fontSize:13, color:'var(--text2)'}}>{selected.gender}</span>}
              <div style={{fontFamily:'var(--mono)', fontSize:13, color:'var(--text2)'}}>{selected.phone}</div>
              {selected.birthday && <div style={{fontSize:12, color:'var(--text3)'}}>🎂 {selected.birthday}</div>}
              <button onClick={() => setSelected(null)}
                style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
            </div>
            <div style={{padding:'16px 24px'}}>
              {/* 기본 정보 */}
              <div style={{display:'flex', flexWrap:'wrap', gap:8, fontSize:12, marginBottom:16, paddingBottom:14, borderBottom:'1px solid var(--border)'}}>
                <span style={{color:'var(--text3)'}}>가입일</span><strong>{selected.joined_at}</strong>
                <span style={{color:'var(--border2)'}}>|</span>
                <span className="badge badge-dept">{selected.store_name}</span>
                <span className="badge badge-store">{selected.branch_name}</span>
                {selected.manager_name && (<><span style={{color:'var(--border2)'}}>|</span><span style={{color:'var(--text3)'}}>담당</span><strong style={{color:'var(--accent)'}}>{selected.manager_name}</strong></>)}
                <span style={{color:'var(--border2)'}}>|</span>
                {selected.sms_consent
                  ? <span style={{color:'var(--success)', fontWeight:700}}>✅ SMS동의</span>
                  : <span style={{color:'var(--text3)'}}>SMS미동의</span>}
              </div>
              {/* 통계 카드 */}
              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
                {[
                  {label:'등급',       value: selected.grade||'패밀리', grade:true},
                  {label:'누적구매',   value: (selected.total_purchase||0).toLocaleString()+'원'},
                  {label:'남은적립금', value: (selected.total_points||0).toLocaleString()+'원', color:'var(--success)'},
                  {label:'사용적립금', value: (selected.used_points||0).toLocaleString()+'원'},
                  {label:'구매건수',   value: (selected.purchase_count||purchases.length)+'건'},
                  {label:'구매수량',   value: (selected.purchase_qty||purchases.reduce((s,p)=>s+p.quantity,0))+'개'},
                ].map(s => (
                  <div key={s.label} style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'7px 14px', textAlign:'center', minWidth:90}}>
                    <div style={{fontSize:10, fontWeight:600, color:'var(--text2)', marginBottom:3}}>{s.label}</div>
                    <div style={{fontSize:14, fontWeight:700, color: s.color||'var(--accent)', fontFamily:'var(--mono)'}}>
                      {s.grade ? <GradeBadge grade={s.value}/> : s.value}
                    </div>
                  </div>
                ))}
              </div>
              {/* 구매 이력 */}
              <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>구매 이력</div>
              {loadingP ? <div className="empty"><span className="spinner"/></div> : (
                <div className="twrap">
                  <table>
                    <thead>
                      <tr>
                        <th>구매일</th><th>점포</th><th>지점</th>
                        <th>브랜드</th><th>상품명</th>
                        <th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th>
                        <th>결제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.length === 0
                        ? <tr><td colSpan={9} className="empty">구매 이력이 없습니다</td></tr>
                        : purchases.map(p => (
                          <tr key={p.id}>
                            <td className="mono">{p.sold_at}</td>
                            <td><span className="badge badge-dept">{p.store_name}</span></td>
                            <td><span className="badge badge-store">{p.branch_name}</span></td>
                            <td>{p.brand?.name||'-'}</td>
                            <td>{p.product?.name||'-'}</td>
                            <td className="r">{p.quantity}</td>
                            <td className="r">{Number(p.price).toLocaleString()}</td>
                            <td className="r" style={{fontWeight:600}}>{(p.price*p.quantity).toLocaleString()}</td>
                            <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>{p.payment}</span></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{marginTop:12, fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)'}}>
                총 {purchases.length}건 · {totalAmt.toLocaleString()}원
              </div>
            </div>
          </div>
        </div>
      )}

      {customers.length === 0 && !loading && (
        <div className="empty">
          조건을 설정하고 <strong>조회</strong> 버튼을 눌러주세요<br/>
          <span style={{fontSize:11,color:'var(--text3)'}}>이름·연락처 검색, 점포·지점·날짜 필터 사용 가능 · 조건 없이 조회하면 전체 회원 표시</span>
        </div>
      )}
    </div>
  );
}
