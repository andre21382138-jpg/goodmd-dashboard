import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const NOTICE_BUCKET = 'notice-images';
let _bkSeq = 0;
const newKey = () => `bk_${Date.now()}_${_bkSeq++}`;

export default function NoticePage({ profile }) {
  const isAdmin = profile?.role === 'admin';
  const isHQ    = profile?.job_title === '담당자';
  const canWrite = isAdmin || isHQ;
  const [notices,  setNotices]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [writing,  setWriting]  = useState(false);
  const [title,    setTitle]    = useState('');
  const [saving,   setSaving]   = useState(false);
  // 블록 편집 — 텍스트/이미지 블록을 순서대로
  // text:  { key, type:'text', text }
  // image: { key, type:'image', file, previewUrl }
  const [blocks, setBlocks] = useState([]);
  const fileRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('notices')
      .select('*, author:profiles(name, job_title, role)')
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const startWriting = () => {
    setBlocks([{ key: newKey(), type: 'text', text: '' }]);
    setWriting(true);
  };

  // 블록 조작
  const addTextBlock  = () => setBlocks(prev => [...prev, { key: newKey(), type: 'text', text: '' }]);
  const addImageBlocks = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length !== files.length) toast('이미지 파일만 첨부할 수 있습니다', 'inf');
    const tooBig = imgs.find(f => f.size > 10 * 1024 * 1024);
    if (tooBig) { toast(`이미지는 10MB 이하만 가능 (${tooBig.name})`, 'err'); return; }
    setBlocks(prev => [...prev, ...imgs.map(f => ({ key: newKey(), type: 'image', file: f, previewUrl: URL.createObjectURL(f) }))]);
  };
  const updateText = (key, text) => setBlocks(prev => prev.map(b => b.key === key ? { ...b, text } : b));
  const removeBlock = (key) => setBlocks(prev => {
    const b = prev.find(x => x.key === key);
    if (b?.previewUrl) URL.revokeObjectURL(b.previewUrl);
    return prev.filter(x => x.key !== key);
  });
  const moveBlock = (idx, dir) => setBlocks(prev => {
    const next = [...prev];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return prev;
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

  const resetForm = () => {
    blocks.forEach(b => { if (b.previewUrl) URL.revokeObjectURL(b.previewUrl); });
    setTitle(''); setBlocks([]); setWriting(false);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast('제목을 입력해주세요', 'err'); return; }
    const hasContent = blocks.some(b => (b.type === 'text' && b.text.trim()) || b.type === 'image');
    if (!hasContent) { toast('내용(텍스트 또는 이미지)을 입력해주세요', 'err'); return; }
    setSaving(true);
    try {
      // 블록 순서대로 처리 — 이미지는 업로드, 텍스트는 그대로
      const outBlocks = [];
      const imageUrls = [];
      const textParts = [];
      for (const b of blocks) {
        if (b.type === 'text') {
          if (!b.text.trim()) continue;
          outBlocks.push({ type: 'text', text: b.text });
          textParts.push(b.text);
        } else if (b.type === 'image') {
          const ext = (b.file.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
          const { error: upErr } = await supabase.storage.from(NOTICE_BUCKET)
            .upload(path, b.file, { upsert: false, contentType: b.file.type });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from(NOTICE_BUCKET).getPublicUrl(path);
          outBlocks.push({ type: 'image', url: pub.publicUrl });
          imageUrls.push(pub.publicUrl);
        }
      }
      const { error } = await supabase.from('notices').insert({
        title: title.trim(),
        content: textParts.join('\n\n'),       // 레거시/검색용 텍스트
        blocks: outBlocks,                      // 순서 보존 블록
        images: imageUrls.length > 0 ? imageUrls : null, // 레거시 호환(목록 🖼️ 카운트 등)
        created_by: profile.id,
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

  // 상세/미리보기 본문 렌더링 — blocks 우선, 없으면 레거시(content + images)
  const renderBody = (n, { clickableImg = false } = {}) => {
    const imgStyle = { maxWidth:'100%', borderRadius:8, border:'1px solid var(--border)', cursor: clickableImg ? 'zoom-in' : 'default' };
    if (Array.isArray(n.blocks) && n.blocks.length > 0) {
      return (
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {n.blocks.map((b, i) => b.type === 'text'
            ? <div key={i} style={{fontSize:13, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap'}}>{b.text}</div>
            : <img key={i} src={b.url} alt={`이미지 ${i+1}`} style={imgStyle} onClick={clickableImg ? () => setLightbox(b.url) : undefined}/>
          )}
        </div>
      );
    }
    // 레거시
    return (
      <>
        {n.content && <div style={{fontSize:13, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap'}}>{n.content}</div>}
        {Array.isArray(n.images) && n.images.length > 0 && (
          <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:16}}>
            {n.images.map((url, i) => (
              <img key={i} src={url} alt={`첨부 이미지 ${i+1}`} style={imgStyle} onClick={clickableImg ? () => setLightbox(url) : undefined}/>
            ))}
          </div>
        )}
      </>
    );
  };

  // 미리보기용 가짜 notice 객체 (blocks를 url 대신 previewUrl로)
  const previewNotice = {
    blocks: blocks
      .filter(b => (b.type === 'text' && b.text.trim()) || b.type === 'image')
      .map(b => b.type === 'text' ? { type:'text', text:b.text } : { type:'image', url:b.previewUrl }),
  };
  const hasPreview = title.trim() || previewNotice.blocks.length > 0;

  return (
    <div>
      {/* 작성 폼 */}
      {canWrite && (
        <div className="card" style={{marginBottom:14}}>
          {!writing ? (
            <button className="btn btn-p" onClick={startWriting}>+ 공지사항 작성</button>
          ) : (
            <>
              <div className="card-label">공지사항 작성</div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>제목</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="공지사항 제목"/>
              </div>

              {/* 블록 편집기 */}
              <div style={{marginBottom:12}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>
                  내용 <span style={{color:'var(--text3)', fontWeight:400}}>(텍스트·이미지 블록을 순서대로 배치 · ▲▼로 정렬)</span>
                </label>
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {blocks.map((b, i) => (
                    <div key={b.key} style={{display:'flex', gap:8, alignItems:'flex-start', background:'#fafafa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:8}}>
                      {/* 정렬/삭제 컨트롤 */}
                      <div style={{display:'flex', flexDirection:'column', gap:2}}>
                        <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0}
                          title="위로" style={{width:26, height:24, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor: i===0?'not-allowed':'pointer', fontSize:11}}>▲</button>
                        <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length-1}
                          title="아래로" style={{width:26, height:24, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor: i===blocks.length-1?'not-allowed':'pointer', fontSize:11}}>▼</button>
                      </div>
                      {/* 블록 내용 */}
                      <div style={{flex:1}}>
                        {b.type === 'text' ? (
                          <textarea value={b.text} onChange={e => updateText(b.key, e.target.value)}
                            style={{...inputStyle, height:80, resize:'vertical', lineHeight:1.6}}
                            placeholder="텍스트 입력"/>
                        ) : (
                          <img src={b.previewUrl} alt="이미지 블록" style={{maxWidth:'100%', maxHeight:240, borderRadius:6, border:'1px solid var(--border)', display:'block'}}/>
                        )}
                      </div>
                      {/* 삭제 */}
                      <button type="button" onClick={() => removeBlock(b.key)}
                        title="블록 삭제" style={{width:26, height:24, border:'1px solid var(--border)', borderRadius:4, background:'#fff', color:'var(--danger)', cursor:'pointer', fontSize:12}}>✕</button>
                    </div>
                  ))}
                </div>
                {/* 블록 추가 버튼 */}
                <div style={{display:'flex', gap:8, marginTop:8}}>
                  <button type="button" className="btn btn-s" onClick={addTextBlock}>＋ 텍스트</button>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={addImageBlocks} style={{display:'none'}}/>
                  <button type="button" className="btn btn-s" onClick={() => fileRef.current?.click()}>🖼️ 이미지</button>
                </div>
              </div>

              {/* 본문 미리보기 */}
              {hasPreview && (
                <div style={{marginBottom:12}}>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>👀 미리보기 (실제 표시 모습)</label>
                  <div style={{border:'1px dashed var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', background:'#fff'}}>
                    {title.trim() && <div style={{fontSize:16, fontWeight:700, marginBottom:8}}>{title}</div>}
                    {renderBody(previewNotice)}
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
            : notices.map(n => {
              const imgCount = Array.isArray(n.blocks)
                ? n.blocks.filter(b => b.type === 'image').length
                : (Array.isArray(n.images) ? n.images.length : 0);
              return (
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
                        {imgCount > 0 && <span style={{marginLeft:6, fontSize:11, color:'var(--text3)'}}>🖼️{imgCount}</span>}
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
            );})
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
            {renderBody(selected, { clickableImg: true })}
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
