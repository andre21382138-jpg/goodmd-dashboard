import React, { useState, useCallback } from 'react';
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

const PAGE_SIZE = 200;

export default function SmsHistoryPage() {
  const [fFrom,    setFFrom]    = useState('');
  const [fTo,      setFTo]      = useState('');
  const [fStatus,  setFStatus]  = useState('');
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page,     setPage]     = useState(0);
  const [preview,  setPreview]  = useState(null); // { message, sender, receiver, receiver_name }

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

  const statusStyle = (s) => ({
    display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700,
    ...(STATUS_STYLE[s] || { background:'#f5f5f5', color:'#666', border:'1px solid #ddd' }),
  });

  return (
    <div>
      {/* 필터 */}
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

      {/* 결과 테이블 */}
      {logs.length > 0 && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
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
                      {new Date(log.sent_at).toLocaleString('ko-KR', {
                        year:'2-digit', month:'2-digit', day:'2-digit',
                        hour:'2-digit', minute:'2-digit',
                      })}
                    </td>
                    <td>
                      <button
                        style={{background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontWeight:600, fontSize:12, padding:0, textAlign:'left', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block'}}
                        onClick={() => setPreview(log)}
                        title="클릭하여 내용 보기">
                        {log.message.length > 20 ? log.message.slice(0, 20) + '…' : log.message}
                      </button>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={statusStyle(log.status)}>{log.status}</span>
                    </td>
                    <td style={{fontSize:12}}>{log.receiver_name || '-'}</td>
                    <td className="mono" style={{fontSize:12}}>{log.receiver}</td>
                    <td className="mono" style={{fontSize:12}}>{log.sender}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalCount > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(totalCount / PAGE_SIZE);
            const delta = 4;
            let start = Math.max(0, page - delta);
            let end   = Math.min(totalPages - 1, page + delta);
            if (end - start < delta * 2) { start = Math.max(0, end - delta * 2); end = Math.min(totalPages - 1, start + delta * 2); }
            const pages = [];
            for (let i = start; i <= end; i++) pages.push(i);
            const btn = (active) => ({
              height:32, minWidth:32, padding:'0 8px', border:'1px solid', borderRadius:'var(--radius)', fontSize:13,
              fontWeight: active ? 700 : 400, cursor:'pointer',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              background: active ? '#fff3e0' : '#fff',
              color: active ? 'var(--accent)' : 'var(--text2)',
            });
            return (
              <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'14px 0', borderTop:'1px solid var(--border)', flexWrap:'wrap'}}>
                <button style={btn(false)} disabled={page===0} onClick={() => fetchLogs(0)}>«</button>
                <button style={btn(false)} disabled={page===0} onClick={() => fetchLogs(page-1)}>‹</button>
                {start > 0 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                {pages.map(p => <button key={p} style={btn(p===page)} onClick={() => fetchLogs(p)}>{p+1}</button>)}
                {end < totalPages-1 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                <button style={btn(false)} disabled={page===totalPages-1} onClick={() => fetchLogs(page+1)}>›</button>
                <button style={btn(false)} disabled={page===totalPages-1} onClick={() => fetchLogs(totalPages-1)}>»</button>
                <span style={{fontSize:12, color:'var(--text3)', marginLeft:8}}>{page+1} / {totalPages}페이지</span>
              </div>
            );
          })()}
        </div>
      )}

      {logs.length === 0 && !loading && (
        <div className="empty">
          날짜·결과를 선택하고 <strong>조회</strong> 버튼을 눌러주세요
        </div>
      )}

      {/* 내용 미리보기 팝업 */}
      {preview && (
        <div style={{position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => setPreview(null)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(420px,95vw)', boxShadow:'0 8px 40px rgba(0,0,0,0.25)', padding:'24px'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', alignItems:'center', marginBottom:16}}>
              <div style={{fontSize:16, fontWeight:700}}>문자 내용</div>
              <button onClick={() => setPreview(null)} style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6, fontSize:12, marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)'}}>
              <span style={{color:'var(--text3)'}}>전송일시</span>
              <strong>{new Date(preview.sent_at).toLocaleString('ko-KR')}</strong>
              <span style={{color:'var(--border2)'}}>|</span>
              <span style={{color:'var(--text3)'}}>수신자</span>
              <strong>{preview.receiver_name || '-'} ({preview.receiver})</strong>
              <span style={{color:'var(--border2)'}}>|</span>
              <span style={statusStyle(preview.status)}>{preview.status}</span>
            </div>
            <div style={{background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:8, padding:'14px', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:300, overflowY:'auto'}}>
              {preview.message}
            </div>
            <div style={{marginTop:10, fontSize:11, color:'var(--text3)', textAlign:'right'}}>
              발신번호: {preview.sender}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
