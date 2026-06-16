import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const NOTICE_BUCKET = 'notice-images';

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
  // 첨부 이미지 — 등록 전 임시 목록 [{ file, previewUrl }]
  const [pendingImages, setPendingImages] = useState([]);
  const fileRef = useRef(null);
  // 상세보기 이미지 라이트박스
  const [lightbox, setLightbox] = useState(null); // url

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('notices')
      .select('*, author:profiles(name, job_title, role)')
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  // 이미지 선택 (여러 개) — 임시 목록에 미리보기로 추가
  const handlePickImages = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length !== files.length) toast('이미지 파일만 첨부할 수 있습니다', 'inf');
    const tooBig = imgs.find(f => f.size > 10 * 1024 * 1024);
    if (tooBig) { toast(`이미지는 10MB 이하만 가능 (${tooBig.name})`, 'err'); return; }
    setPendingImages(prev => [...prev, ...imgs.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }))]);
  };
  const removePending = (idx) => {
    setPendingImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx]?.previewUrl);
      next.splice(idx, 1);
      return next;
    });
  };

  const resetForm = () => {
    pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setTitle(''); setContent(''); setPendingImages([]); setWriting(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { toast('제목과 내용을 입력해주세요', 'err'); return; }
    setSaving(true);
    try {
      // 1) 이미지 업로드 → 공개 URL 수집
      const imageUrls = [];
      for (const { file } of pendingImages) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(NOTICE_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(NOTICE_BUCKET).getPublicUrl(path);
        imageUrls.push(pub.publicUrl);
      }
      // 2) 공지 insert
      const { error } = await supabase.from('notices').insert({
        title: title.trim(), content: content.trim(), created_by: profile.id,
        images: imageUrls.length > 0 ? imageUrls : null,
      });
      if (error) throw error;
      toast('공지사항 등록 완료', 'ok');
      resetForm();
      fetchNotices();
    } catch (err) {
      toast('등록 실패: ' + (err.message || err), 'err');
    }
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
              {/* 이미지 첨부 */}
              <div style={{marginBottom:12}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>
                  이미지 첨부 <span style={{color:'var(--text3)', fontWeight:400}}>(여러 개 가능 · 10MB 이하)</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePickImages} style={{display:'none'}}/>
                <button type="button" className="btn btn-s" onClick={() => fileRef.current?.click()}>🖼️ 이미지 추가</button>
                {pendingImages.length > 0 && (
                  <div style={{display:'flex', flexWrap:'wrap', gap:8, marginTop:10}}>
                    {pendingImages.map((p, i) => (
                      <div key={i} style={{position:'relative', width:88, height:88, borderRadius:8, overflow:'hidden', border:'1px solid var(--border)'}}>
                        <img src={p.previewUrl} alt={`첨부 ${i+1}`} style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                        <button type="button" onClick={() => removePending(i)}
                          title="삭제"
                          style={{position:'absolute', top:2, right:2, width:20, height:20, border:'none', borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:12, cursor:'pointer', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center'}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 본문 미리보기 — 등록 시 매장에서 보이는 모습 그대로 */}
              {(title.trim() || content.trim() || pendingImages.length > 0) && (
                <div style={{marginBottom:12}}>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>👀 미리보기 (실제 표시 모습)</label>
                  <div style={{border:'1px dashed var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', background:'#fff'}}>
                    {title.trim() && <div style={{fontSize:16, fontWeight:700, marginBottom:8}}>{title}</div>}
                    {content.trim() && <div style={{fontSize:13, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap'}}>{content}</div>}
                    {pendingImages.length > 0 && (
                      <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:content.trim() ? 16 : 0}}>
                        {pendingImages.map((p, i) => (
                          <img key={i} src={p.previewUrl} alt={`첨부 ${i+1}`}
                            style={{maxWidth:'100%', borderRadius:8, border:'1px solid var(--border)'}}/>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-p" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner"/> : '등록'}</button>
                <button className="btn btn-s" onClick={resetForm} disabled={saving}>취소</button>
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
                      <div style={{fontWeight:600, fontSize:13, flex:1, marginRight:8}}>
                        {n.title}
                        {Array.isArray(n.images) && n.images.length > 0 && (
                          <span style={{marginLeft:6, fontSize:11, color:'var(--text3)'}}>🖼️{n.images.length}</span>
                        )}
                      </div>
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
            {Array.isArray(selected.images) && selected.images.length > 0 && (
              <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:16}}>
                {selected.images.map((url, i) => (
                  <img key={i} src={url} alt={`첨부 이미지 ${i+1}`}
                    onClick={() => setLightbox(url)}
                    style={{maxWidth:'100%', borderRadius:8, border:'1px solid var(--border)', cursor:'zoom-in'}}/>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 이미지 라이트박스 */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, cursor:'zoom-out'}}>
          <img src={lightbox} alt="첨부 이미지 확대" style={{maxWidth:'95%', maxHeight:'95%', objectFit:'contain'}}/>
        </div>
      )}
    </div>
  );
}
