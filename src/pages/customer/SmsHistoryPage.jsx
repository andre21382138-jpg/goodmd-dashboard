import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const STATUS_LIST = ['정상수신', '예약처리', '결과대기', '번호오류', '수신거부', '수신오류'];

const STATUS_STYLE = {
  '정상수신': { background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7' },
  '예약처리': { background:'#e3f2fd', color:'#1565c0', border:'1px solid #90caf9' },
  '결과대기': { background:'#fff8e1', color:'#f57f17', border:'1px solid #ffe082' },
  '번호오류': { background:'#fce4ec', color:'#b71c1c', border:'1px solid #f48fb1' },
  '수신거부': { background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8' },
  '수신오류': { background:'#fbe9e7', color:'#bf360c', border:'1px solid #ffab91' },
};

const SCH_STATUS_STYLE = {
  'pending':  { background:'#fff8e1', color:'#f57f17', border:'1px solid #ffe082', label:'대기중' },
  'sending':  { background:'#e3f2fd', color:'#1565c0', border:'1px solid #90caf9', label:'발송중' },
  'sent':     { background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', label:'발송완료' },
  'failed':   { background:'#fce4ec', color:'#b71c1c', border:'1px solid #f48fb1', label:'실패' },
  'cancelled':{ background:'#f5f5f5', color:'#757575', border:'1px solid #e0e0e0', label:'취소됨' },
};

const PAGE_SIZE = 200;
const pad2 = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dstr(d); };

export default function SmsHistoryPage() {
  const [tab,      setTab]      = useState('history'); // 'history' | 'schedule' | 'renewal'

  // 발송 내역
  const [fFrom,    setFFrom]    = useState('');
  const [fTo,      setFTo]      = useState('');
  const [fStatus,  setFStatus]  = useState('');
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page,     setPage]     = useState(0);
  const [preview,  setPreview]  = useState(null);

  // 예약 내역
  const [schedules,    setSchedules]    = useState([]);
  const [loadingSch,   setLoadingSch]   = useState(false);
  const [previewSch,   setPreviewSch]   = useState(null);
  const [schFrom,      setSchFrom]      = useState(daysAgoStr(30));
  const [schTo,        setSchTo]        = useState(dstr(new Date()));
  const [schSearched,  setSchSearched]  = useState(false);

  // 재동의 안내 (날짜별 조회)
  const [rnFrom,    setRnFrom]    = useState(daysAgoStr(7));
  const [rnTo,      setRnTo]      = useState(dstr(new Date()));
  const [rnRows,    setRnRows]    = useState([]);
  const [rnLoading, setRnLoading] = useState(false);
  const [rnSearched,setRnSearched]= useState(false);

  const fetchLogs = useCallback(async (pg = 0) => {
    setLoading(true);
    setPage(pg);
    let q = supabase.from('sms_logs')
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false });
    if (fFrom)   q = q.gte('sent_at', fFrom);
    if (fTo)     q = q.lte('sent_at', fTo + 'T23:59:59');
    if (fStatus) q = q.eq('status', fStatus);
    const { data, count, error } = await q.range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);
    if (error) { toast(error.message, 'err'); setLoading(false); return; }
    setLogs(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [fFrom, fTo, fStatus]);

  const RENEWAL_KIND = 'marketing_renewal_notice';

  const fetchSchedules = useCallback(async () => {
    setLoadingSch(true); setSchSearched(true);
    // 예약 내역 탭은 일반 예약만 (재동의 안내 제외) — 예약일시 기간 필터 + 페이징
    const all = []; let start = 0; const PAGE = 1000;
    while (true) {
      let q = supabase.from('sms_schedules').select('*')
        .or(`kind.is.null,kind.neq.${RENEWAL_KIND}`)
        .order('scheduled_at', { ascending: false })
        .range(start, start + PAGE - 1);
      if (schFrom) q = q.gte('scheduled_at', schFrom);
      if (schTo)   q = q.lte('scheduled_at', schTo + 'T23:59:59');
      const { data, error } = await q;
      if (error) { toast(error.message, 'err'); break; }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      start += PAGE;
    }
    setSchedules(all);
    setLoadingSch(false);
  }, [schFrom, schTo]);

  // 재동의 안내 — 날짜(예약일시) 범위로 서버 조회 (누적량 많아 페이징)
  const fetchRenewal = useCallback(async () => {
    setRnLoading(true); setRnSearched(true);
    const all = []; let start = 0; const PAGE = 1000;
    while (true) {
      let q = supabase.from('sms_schedules').select('*')
        .eq('kind', RENEWAL_KIND)
        .order('scheduled_at', { ascending: false })
        .range(start, start + PAGE - 1);
      if (rnFrom) q = q.gte('scheduled_at', rnFrom);
      if (rnTo)   q = q.lte('scheduled_at', rnTo + 'T23:59:59');
      const { data, error } = await q;
      if (error) { toast(error.message, 'err'); break; }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      start += PAGE;
    }
    setRnRows(all);
    setRnLoading(false);
  }, [rnFrom, rnTo]);

  useEffect(() => {
    if (tab === 'schedule') fetchSchedules();
    if (tab === 'renewal')  fetchRenewal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const manualSchedules = schedules.filter(s => s.kind !== RENEWAL_KIND);
  const rnSummary = rnRows.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {});
  // 예약 발송 합계: 대상 수신자 / 성공(실제 발송) / 실패
  const schSummary = manualSchedules.reduce((a, s) => {
    a.count += 1;
    a.recipients += (s.receivers?.length || 0);
    if (s.status === 'sent') { a.ok += (s.ok_count || 0); a.fail += (s.fail_count || 0); }
    return a;
  }, { count: 0, recipients: 0, ok: 0, fail: 0 });

  const cancelSchedule = async (id) => {
    if (!window.confirm('예약을 취소하시겠습니까?')) return;
    const { error } = await supabase.from('sms_schedules').update({ status: 'cancelled' }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('예약 취소됨', 'ok'); fetchSchedules(); }
  };

  const statusBadge = (s) => ({
    display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700,
    ...(STATUS_STYLE[s] || { background:'#f5f5f5', color:'#666', border:'1px solid #ddd' }),
  });

  const schBadge = (s) => {
    const st = SCH_STATUS_STYLE[s] || { background:'#f5f5f5', color:'#666', border:'1px solid #ddd', label: s };
    return { style: { display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, background:st.background, color:st.color, border:st.border }, label: st.label };
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='history'?'on':''}`} onClick={() => setTab('history')}>발송 내역</button>
        <button className={`tab ${tab==='schedule'?'on':''}`} onClick={() => setTab('schedule')}>예약 내역</button>
        <button className={`tab ${tab==='renewal'?'on':''}`} onClick={() => setTab('renewal')}>🔁 재동의 안내</button>
      </div>

      {/* ── 발송 내역 탭 ── */}
      {tab === 'history' && (
        <>
          <div className="card">
            <div className="card-label">문자 발송 내역</div>
            <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
              <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="전송일 시작"/>
              <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
              <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="전송일 종료"/>
              <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">전체 결과</option>
                {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(fFrom || fTo || fStatus) &&
                <button className="btn-ghost" onClick={() => { setFFrom(''); setFTo(''); setFStatus(''); setLogs([]); setTotalCount(0); }}>✕ 초기화</button>}
              <div className="fbar-right">
                <button className="btn btn-p" onClick={() => fetchLogs(0)} disabled={loading}>
                  {loading ? <span className="spinner"/> : '🔍 조회'}
                </button>
              </div>
            </div>
          </div>

          {logs.length > 0 && (
            <div className="card" style={{padding:'16px 20px'}}>
              <div style={{marginBottom:12}}>
                <span className="fresult">총 <b>{totalCount.toLocaleString()}</b>건</span>
              </div>
              <div className="twrap">
                <table>
                  <thead>
                    <tr>
                      <th>전송일시</th>
                      <th>내용</th>
                      <th style={{textAlign:'center'}}>전송결과</th>
                      <th>수신자</th>
                      <th>수신번호</th>
                      <th>발신번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td className="mono" style={{fontSize:11, whiteSpace:'nowrap'}}>
                          {new Date(log.sent_at).toLocaleString('ko-KR', {year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td>
                          <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontWeight:600,fontSize:12,padding:0,textAlign:'left',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}
                            onClick={() => setPreview(log)}>
                            {log.message.length > 20 ? log.message.slice(0,20)+'…' : log.message}
                          </button>
                        </td>
                        <td style={{textAlign:'center'}}><span style={statusBadge(log.status)}>{log.status}</span></td>
                        <td style={{fontSize:12}}>{log.receiver_name || '-'}</td>
                        <td className="mono" style={{fontSize:12}}>{log.receiver}</td>
                        <td className="mono" style={{fontSize:12}}>{log.sender}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalCount > PAGE_SIZE && (() => {
                const totalPages = Math.ceil(totalCount / PAGE_SIZE);
                const delta = 4;
                let start = Math.max(0, page - delta), end = Math.min(totalPages-1, page+delta);
                if (end-start < delta*2) { start = Math.max(0,end-delta*2); end = Math.min(totalPages-1,start+delta*2); }
                const pages = []; for (let i=start;i<=end;i++) pages.push(i);
                const btn = (active) => ({height:32,minWidth:32,padding:'0 8px',border:'1px solid',borderRadius:'var(--radius)',fontSize:13,fontWeight:active?700:400,cursor:'pointer',borderColor:active?'var(--accent)':'var(--border)',background:active?'#fff3e0':'#fff',color:active?'var(--accent)':'var(--text2)'});
                return (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,padding:'14px 0',borderTop:'1px solid var(--border)',flexWrap:'wrap'}}>
                    <button style={btn(false)} disabled={page===0} onClick={()=>fetchLogs(0)}>«</button>
                    <button style={btn(false)} disabled={page===0} onClick={()=>fetchLogs(page-1)}>‹</button>
                    {start>0&&<span style={{padding:'0 4px',color:'var(--text3)'}}>...</span>}
                    {pages.map(p=><button key={p} style={btn(p===page)} onClick={()=>fetchLogs(p)}>{p+1}</button>)}
                    {end<totalPages-1&&<span style={{padding:'0 4px',color:'var(--text3)'}}>...</span>}
                    <button style={btn(false)} disabled={page===totalPages-1} onClick={()=>fetchLogs(page+1)}>›</button>
                    <button style={btn(false)} disabled={page===totalPages-1} onClick={()=>fetchLogs(totalPages-1)}>»</button>
                    <span style={{fontSize:12,color:'var(--text3)',marginLeft:8}}>{page+1}/{totalPages}페이지</span>
                  </div>
                );
              })()}
            </div>
          )}
          {logs.length === 0 && !loading && (
            <div className="empty">날짜·결과를 선택하고 <strong>조회</strong> 버튼을 눌러주세요</div>
          )}
        </>
      )}

      {/* ── 예약 내역 탭 ── */}
      {tab === 'schedule' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
            <span className="card-label" style={{margin:0}}>예약 발송 내역</span>
          </div>
          <div className="fbar" style={{flexWrap:'wrap', gap:8, marginBottom:12}}>
            <input type="date" className="fsel" value={schFrom} onChange={e => setSchFrom(e.target.value)} title="예약일시 시작"/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={schTo} onChange={e => setSchTo(e.target.value)} title="예약일시 종료"/>
            <button className="btn btn-s" onClick={() => { setSchFrom(dstr(new Date())); setSchTo(dstr(new Date())); }}>오늘</button>
            <button className="btn btn-s" onClick={() => { setSchFrom(daysAgoStr(7)); setSchTo(dstr(new Date())); }}>최근 7일</button>
            <button className="btn btn-s" onClick={() => { setSchFrom(daysAgoStr(30)); setSchTo(dstr(new Date())); }}>최근 30일</button>
            <div className="fbar-right">
              <button className="btn btn-p" onClick={fetchSchedules} disabled={loadingSch}>
                {loadingSch ? <span className="spinner"/> : '🔍 조회'}
              </button>
            </div>
          </div>
          {manualSchedules.length > 0 && (
            <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12}}>
              <span className="fresult">예약 <b>{schSummary.count.toLocaleString()}</b>건</span>
              <span style={{fontSize:12, color:'var(--text2)'}}>· 대상 <b>{schSummary.recipients.toLocaleString()}</b>명</span>
              <span style={{fontSize:12, color:'var(--success)', fontWeight:700}}>· 발송성공 {schSummary.ok.toLocaleString()}명</span>
              {schSummary.fail > 0 && <span style={{fontSize:12, color:'#c62828', fontWeight:700}}>· 실패 {schSummary.fail.toLocaleString()}명</span>}
            </div>
          )}
          {loadingSch ? <div className="empty"><span className="spinner"/></div> : manualSchedules.length === 0 ? (
            <div className="empty">{schSearched ? '해당 기간 예약 발송 내역이 없습니다' : '기간을 선택하고 조회하세요'}</div>
          ) : (
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>예약일시</th>
                    <th style={{textAlign:'center'}}>상태</th>
                    <th className="r">수신자</th>
                    <th className="r">성공</th>
                    <th className="r">실패</th>
                    <th>내용</th>
                    <th>발신번호</th>
                    <th>발송일시</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {manualSchedules.map(sch => {
                    const { style, label } = schBadge(sch.status);
                    return (
                      <tr key={sch.id}>
                        <td className="mono" style={{fontSize:11, whiteSpace:'nowrap'}}>
                          {new Date(sch.scheduled_at).toLocaleString('ko-KR', {year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td style={{textAlign:'center'}}><span style={style}>{label}</span></td>
                        <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{sch.receivers?.length?.toLocaleString() || 0}명</td>
                        <td className="r" style={{fontFamily:'var(--mono)', color:'var(--success)', fontWeight:700}}>{sch.status==='sent'? sch.ok_count?.toLocaleString() : '-'}</td>
                        <td className="r" style={{fontFamily:'var(--mono)', color: sch.fail_count>0?'#c62828':'var(--text3)', fontWeight:700}}>{sch.status==='sent'? sch.fail_count?.toLocaleString() : '-'}</td>
                        <td>
                          <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontWeight:600,fontSize:12,padding:0,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}
                            onClick={() => setPreviewSch(sch)}>
                            {sch.message.length > 18 ? sch.message.slice(0,18)+'…' : sch.message}
                          </button>
                        </td>
                        <td className="mono" style={{fontSize:12}}>{sch.sender}</td>
                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>
                          {sch.sent_at ? new Date(sch.sent_at).toLocaleString('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}
                        </td>
                        <td>
                          {sch.status === 'pending' && (
                            <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}} onClick={() => cancelSchedule(sch.id)}>취소</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 재동의 안내 탭 ── */}
      {tab === 'renewal' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8}}>
            <span className="card-label" style={{margin:0}}>🔁 마케팅 재동의 안내 내역</span>
          </div>
          <div className="fbar" style={{flexWrap:'wrap', gap:8, marginBottom:12}}>
            <input type="date" className="fsel" value={rnFrom} onChange={e => setRnFrom(e.target.value)} title="예약일시 시작"/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={rnTo} onChange={e => setRnTo(e.target.value)} title="예약일시 종료"/>
            <button className="btn btn-s" onClick={() => { setRnFrom(dstr(new Date())); setRnTo(dstr(new Date())); }}>오늘</button>
            <button className="btn btn-s" onClick={() => { setRnFrom(daysAgoStr(7)); setRnTo(dstr(new Date())); }}>최근 7일</button>
            <button className="btn btn-s" onClick={() => { setRnFrom(daysAgoStr(30)); setRnTo(dstr(new Date())); }}>최근 30일</button>
            <div className="fbar-right">
              <button className="btn btn-p" onClick={fetchRenewal} disabled={rnLoading}>
                {rnLoading ? <span className="spinner"/> : '🔍 조회'}
              </button>
            </div>
          </div>
          {rnRows.length > 0 && (
            <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12}}>
              <span className="fresult">총 <b>{rnRows.length.toLocaleString()}</b>건</span>
              {['sent','sending','pending','failed','cancelled'].filter(s => rnSummary[s]).map(s => {
                const { style, label } = schBadge(s);
                return <span key={s} style={style}>{label} {rnSummary[s]}</span>;
              })}
            </div>
          )}
          {rnLoading ? <div className="empty"><span className="spinner"/></div> : rnRows.length === 0 ? (
            <div className="empty">{rnSearched ? '해당 기간 재동의 안내 내역이 없습니다' : '기간을 선택하고 조회하세요'}</div>
          ) : (
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>예약일시</th>
                    <th style={{textAlign:'center'}}>상태</th>
                    <th>수신자</th>
                    <th>수신번호</th>
                    <th>내용</th>
                    <th>발신번호</th>
                    <th>발송일시</th>
                  </tr>
                </thead>
                <tbody>
                  {rnRows.map(sch => {
                    const { style, label } = schBadge(sch.status);
                    const rcv = sch.receivers?.[0] || {};
                    return (
                      <tr key={sch.id}>
                        <td className="mono" style={{fontSize:11, whiteSpace:'nowrap'}}>
                          {new Date(sch.scheduled_at).toLocaleString('ko-KR', {year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td style={{textAlign:'center'}}><span style={style}>{label}</span></td>
                        <td style={{fontSize:12}}>{rcv.name || '-'}</td>
                        <td className="mono" style={{fontSize:12}}>{rcv.phone || '-'}</td>
                        <td>
                          <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontWeight:600,fontSize:12,padding:0,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}
                            onClick={() => setPreviewSch(sch)}>
                            {sch.message.length > 18 ? sch.message.slice(0,18)+'…' : sch.message}
                          </button>
                        </td>
                        <td className="mono" style={{fontSize:12}}>{sch.sender}</td>
                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>
                          {sch.sent_at ? new Date(sch.sent_at).toLocaleString('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 발송내역 내용 팝업 */}
      {preview && (
        <div style={{position:'fixed',inset:0,zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setPreview(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'relative',background:'#fff',borderRadius:16,width:'min(420px,95vw)',boxShadow:'0 8px 40px rgba(0,0,0,0.25)',padding:'24px'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700}}>문자 내용</div>
              <button onClick={()=>setPreview(null)} style={{marginLeft:'auto',background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#999'}}>✕</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,fontSize:12,marginBottom:14,paddingBottom:12,borderBottom:'1px solid var(--border)'}}>
              <span style={{color:'var(--text3)'}}>전송일시</span><strong>{new Date(preview.sent_at).toLocaleString('ko-KR')}</strong>
              <span style={{color:'var(--border2)'}}>|</span>
              <span style={{color:'var(--text3)'}}>수신자</span><strong>{preview.receiver_name||'-'} ({preview.receiver})</strong>
              <span style={{color:'var(--border2)'}}>|</span>
              <span style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,...(STATUS_STYLE[preview.status]||{})}}>{preview.status}</span>
            </div>
            <div style={{background:'#f8f9fa',border:'1px solid var(--border)',borderRadius:8,padding:'14px',fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-all',maxHeight:300,overflowY:'auto'}}>
              {preview.message}
            </div>
            <div style={{marginTop:10,fontSize:11,color:'var(--text3)',textAlign:'right'}}>발신번호: {preview.sender}</div>
          </div>
        </div>
      )}

      {/* 예약내역 내용 팝업 */}
      {previewSch && (
        <div style={{position:'fixed',inset:0,zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setPreviewSch(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'relative',background:'#fff',borderRadius:16,width:'min(420px,95vw)',boxShadow:'0 8px 40px rgba(0,0,0,0.25)',padding:'24px'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700}}>예약 문자 내용</div>
              <button onClick={()=>setPreviewSch(null)} style={{marginLeft:'auto',background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#999'}}>✕</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,fontSize:12,marginBottom:14,paddingBottom:12,borderBottom:'1px solid var(--border)'}}>
              <span style={{color:'var(--text3)'}}>예약일시</span><strong>{new Date(previewSch.scheduled_at).toLocaleString('ko-KR')}</strong>
              <span style={{color:'var(--border2)'}}>|</span>
              <span style={{color:'var(--text3)'}}>수신자</span><strong>{previewSch.receivers?.length}명</strong>
              <span style={{color:'var(--border2)'}}>|</span>
              <span style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,...(SCH_STATUS_STYLE[previewSch.status]||{})}}>{SCH_STATUS_STYLE[previewSch.status]?.label||previewSch.status}</span>
            </div>
            <div style={{background:'#f8f9fa',border:'1px solid var(--border)',borderRadius:8,padding:'14px',fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-all',maxHeight:300,overflowY:'auto'}}>
              {previewSch.message}
            </div>
            <div style={{marginTop:10,fontSize:11,color:'var(--text3)',textAlign:'right'}}>발신번호: {previewSch.sender}</div>
          </div>
        </div>
      )}
    </div>
  );
}
