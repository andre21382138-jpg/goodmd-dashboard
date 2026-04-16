import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function NoticePage({ profile }) {
  const isAdmin = profile?.role === 'admin';
  const isHQ    = profile?.job_title === '담당자';
  const canWrite = isAdmin || isHQ;
  const [notices,  setNotices]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [writing,  setWriting]  = useState(false);
  const [title,    setTitle]    = useState('');
  const [content,  setContent]  = useState('');
  const [saving,   setSaving]   = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('notices')
      .select('*, author:profiles(name, job_title, role)')
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { toast('제목과 내용을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('notices').insert({
      title: title.trim(), content: content.trim(), created_by: profile.id
    });
    if (error) toast(error.message, 'err');
    else { toast('공지사항 등록 완료', 'ok'); setTitle(''); setContent(''); setWriting(false); fetchNotices(); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('공지사항을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); setSelected(null); fetchNotices(); }
  };

  const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };

  return (
    <div>
      {/* 작성 폼 */}
      {canWrite && (
        <div className="card" style={{marginBottom:14}}>
          {!writing ? (
            <button className="btn btn-p" onClick={() => setWriting(true)}>+ 공지사항 작성</button>
          ) : (
            <>
              <div className="card-label">공지사항 작성</div>
              <div style={{marginBottom:10}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>제목</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="공지사항 제목"/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>내용</label>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  style={{...inputStyle, height:120, resize:'vertical', lineHeight:1.6}}
                  placeholder="공지사항 내용을 입력하세요"/>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-p" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner"/> : '등록'}</button>
                <button className="btn btn-s" onClick={() => {setWriting(false);setTitle('');setContent('');}}>취소</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 목록 + 상세 */}
      <div style={{display:'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap:14}}>
        <div className="card" style={{padding:'14px 16px'}}>
          <div className="card-label">공지사항 목록</div>
          {loading ? <div className="empty"><span className="spinner"/></div>
            : notices.length === 0 ? <div className="empty">등록된 공지사항이 없습니다</div>
            : notices.map(n => (
              <div key={n.id} onClick={() => setSelected(n)}
                style={{padding:'11px 12px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:4,
                  background: selected?.id===n.id ? '#fff8e1' : 'var(--bg3)',
                  border: `1px solid ${selected?.id===n.id ? '#ffcc80' : 'transparent'}`}}>
                {(() => {
                  const a = n.author;
                  const authorLabel = a?.job_title === '담당자' ? '담당자' : a?.role === 'admin' ? '관리자' : (a?.name || '-');
                  const authorColor = a?.job_title === '담당자' ? '#1565C0' : '#E65100';
                  return (
                    <div style={{display:'flex', alignItems:'center', gap:0}}>
                      <div style={{fontWeight:600, fontSize:13, flex:1, marginRight:8}}>{n.title}</div>
                      <div style={{fontSize:11, color:'var(--text3)', whiteSpace:'nowrap', marginRight:10}}>
                        {new Date(n.created_at).toLocaleDateString('ko-KR')}
                      </div>
                      <div style={{fontSize:11, fontWeight:700, color:authorColor, whiteSpace:'nowrap'}}>
                        {authorLabel}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))
          }
        </div>

        {selected && (
          <div className="card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)'}}>
              <div>
                <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>{selected.title}</div>
                <div style={{fontSize:12, color:'var(--text3)'}}>
                  {selected.author?.job_title === '담당자' ? '담당자' : selected.author?.role === 'admin' ? '관리자' : (selected.author?.name || '-')} · {new Date(selected.created_at).toLocaleString('ko-KR')}
                </div>
              </div>
              <div style={{display:'flex', gap:6}}>
                {(isAdmin || (isHQ && selected.created_by === profile?.id)) && (
                  <button className="btn-danger" onClick={() => handleDelete(selected.id)}>삭제</button>
                )}
                <button className="btn btn-s" style={{fontSize:11}} onClick={() => setSelected(null)}>닫기</button>
              </div>
            </div>
            <div style={{fontSize:13, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap'}}>{selected.content}</div>
          </div>
        )}
      </div>
    </div>
  );
}
