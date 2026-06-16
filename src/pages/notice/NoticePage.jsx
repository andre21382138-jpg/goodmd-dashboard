import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const NOTICE_BUCKET = 'notice-images';

// 신뢰된 작성자(본사)만 작성하지만 최소한의 안전 정리 — script/on* 제거
function sanitizeHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

const COLORS = ['#222222', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ffffff'];
const SIZES = [
  { label: '작게',   val: '2' },
  { label: '보통',   val: '3' },
  { label: '크게',   val: '5' },
  { label: '아주크게', val: '7' },
];

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
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef(null);
  const fileRef   = useRef(null);
  const videoRef  = useRef(null);
  const [lightbox, setLightbox] = useState(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [editId, setEditId] = useState(null); // 수정 중인 공지 id (null=신규)

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
    setEditId(null);
    setWriting(true);
    setTitle('');
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = ''; }, 0);
  };
  // 기존 공지 수정 — 에디터에 내용 로드 (레거시 blocks/content도 HTML로 변환)
  const startEdit = (n) => {
    setEditId(n.id);
    setWriting(true);
    setTitle(n.title || '');
    let html = n.body_html;
    if (!html) {
      // 레거시 → HTML 합성
      if (Array.isArray(n.blocks) && n.blocks.length > 0) {
        html = n.blocks.map(b => b.type === 'text'
          ? `<p>${(b.text||'').replace(/</g,'&lt;').replace(/\n/g,'<br/>')}</p>`
          : `<img src="${b.url}" style="max-width:100%;border-radius:8px;display:block;margin:8px 0;" />`).join('');
      } else {
        const text = (n.content || '').replace(/</g,'&lt;').replace(/\n/g,'<br/>');
        const imgs = Array.isArray(n.images) ? n.images.map(u => `<img src="${u}" style="max-width:100%;border-radius:8px;display:block;margin:8px 0;" />`).join('') : '';
        html = (text ? `<p>${text}</p>` : '') + imgs;
      }
    }
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(html || ''); }, 0);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const resetForm = () => {
    setWriting(false); setTitle(''); setEditId(null);
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  // 서식 명령
  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    try { document.execCommand('styleWithCSS', false, true); } catch {}
    document.execCommand(cmd, false, val);
  };

  // 이미지 삽입 — 현재 커서 위치에
  const handleInsertImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length !== files.length) toast('이미지 파일만 첨부할 수 있습니다', 'inf');
    const tooBig = imgs.find(f => f.size > 10 * 1024 * 1024);
    if (tooBig) { toast(`이미지는 10MB 이하만 가능 (${tooBig.name})`, 'err'); return; }
    if (imgs.length === 0) return;
    setUploading(true);
    try {
      editorRef.current?.focus();
      for (const file of imgs) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(NOTICE_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(NOTICE_BUCKET).getPublicUrl(path);
        const html = `<img src="${pub.publicUrl}" style="max-width:100%;border-radius:8px;display:block;margin:8px 0;" /><p><br/></p>`;
        document.execCommand('insertHTML', false, html);
      }
    } catch (err) {
      toast('이미지 업로드 실패: ' + (err.message || err), 'err');
    }
    setUploading(false);
  };

  // 영상 삽입 — 커서 위치에 <video controls>
  const handleInsertVideos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const vids = files.filter(f => f.type.startsWith('video/'));
    if (vids.length !== files.length) toast('영상 파일만 첨부할 수 있습니다', 'inf');
    const tooBig = vids.find(f => f.size > 50 * 1024 * 1024);
    if (tooBig) { toast(`영상은 50MB 이하만 가능 (${tooBig.name})`, 'err'); return; }
    if (vids.length === 0) return;
    setUploading(true);
    try {
      editorRef.current?.focus();
      for (const file of vids) {
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
        const path = `${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(NOTICE_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(NOTICE_BUCKET).getPublicUrl(path);
        const html = `<video src="${pub.publicUrl}" controls playsinline style="max-width:100%;border-radius:8px;display:block;margin:8px 0;"></video><p><br/></p>`;
        document.execCommand('insertHTML', false, html);
      }
    } catch (err) {
      toast('영상 업로드 실패: ' + (err.message || err), 'err');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast('제목을 입력해주세요', 'err'); return; }
    const html = sanitizeHtml(editorRef.current?.innerHTML || '');
    const textOnly = (editorRef.current?.innerText || '').trim();
    if (!textOnly && !/<img/i.test(html) && !/<video/i.test(html)) { toast('내용을 입력해주세요', 'err'); return; }
    setSaving(true);
    try {
      if (editId) {
        // 수정 — body_html/content/blocks(레거시 무효화) 갱신
        const { data: updated, error } = await supabase.from('notices').update({
          title: title.trim(),
          body_html: html,
          content: textOnly,
          blocks: null, images: null, // 레거시 필드는 비워 body_html 단일 소스로
        }).eq('id', editId).select();
        if (error) throw error;
        if (!updated || updated.length === 0) {
          // RLS UPDATE 정책 누락 등으로 0건 반영된 경우
          toast('수정 권한이 없어 반영되지 않았습니다 (notices UPDATE 정책 확인 필요)', 'err');
          setSaving(false);
          return;
        }
        toast('공지사항 수정 완료', 'ok');
        // 상세 선택이 이 공지면 갱신
        if (selected?.id === editId) {
          setSelected({ ...selected, title: title.trim(), body_html: html, content: textOnly, blocks: null, images: null });
        }
      } else {
        const { error } = await supabase.from('notices').insert({
          title: title.trim(),
          body_html: html,
          content: textOnly,   // 검색/레거시용 평문
          created_by: profile.id,
        });
        if (error) throw error;
        toast('공지사항 등록 완료', 'ok');
      }
      resetForm();
      fetchNotices();
    } catch (err) {
      toast((editId ? '수정' : '등록') + ' 실패: ' + (err.message || err), 'err');
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
  const toolBtn = { height:30, minWidth:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 };

  // 본문 렌더 — body_html 우선, 없으면 레거시(blocks → content+images)
  const renderBody = (n, { clickableImg = false } = {}) => {
    if (n.body_html) {
      return (
        <div className="notice-body"
          style={{fontSize:14, lineHeight:1.8, color:'var(--text)', wordBreak:'break-word'}}
          onClick={clickableImg ? (e) => { if (e.target.tagName === 'IMG') setLightbox(e.target.src); } : undefined}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.body_html) }}/>
      );
    }
    const imgStyle = { maxWidth:'100%', borderRadius:8, border:'1px solid var(--border)', cursor: clickableImg ? 'zoom-in' : 'default' };
    if (Array.isArray(n.blocks) && n.blocks.length > 0) {
      return (
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {n.blocks.map((b, i) => b.type === 'text'
            ? <div key={i} style={{fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap'}}>{b.text}</div>
            : <img key={i} src={b.url} alt="" style={imgStyle} onClick={clickableImg ? () => setLightbox(b.url) : undefined}/>
          )}
        </div>
      );
    }
    return (
      <>
        {n.content && <div style={{fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap'}}>{n.content}</div>}
        {Array.isArray(n.images) && n.images.length > 0 && (
          <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:16}}>
            {n.images.map((url, i) => <img key={i} src={url} alt="" style={imgStyle} onClick={clickableImg ? () => setLightbox(url) : undefined}/>)}
          </div>
        )}
      </>
    );
  };

  const imgCountOf = (n) => {
    if (n.body_html) return (n.body_html.match(/<img/gi) || []).length;
    if (Array.isArray(n.blocks)) return n.blocks.filter(b => b.type === 'image').length;
    return Array.isArray(n.images) ? n.images.length : 0;
  };

  return (
    <div>
      {/* 작성 폼 */}
      {canWrite && (
        <div className="card" style={{marginBottom:14}}>
          {!writing ? (
            <button className="btn btn-p" onClick={startWriting}>+ 공지사항 작성</button>
          ) : (
            <>
              <div className="card-label">{editId ? '공지사항 수정' : '공지사항 작성'}</div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>제목</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="공지사항 제목"/>
              </div>

              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>내용</label>
              {/* 서식 툴바 */}
              <div style={{display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', padding:8, border:'1px solid var(--border)', borderBottom:'none', borderTopLeftRadius:'var(--radius)', borderTopRightRadius:'var(--radius)', background:'#fafafa'}}>
                <button type="button" style={{...toolBtn, fontWeight:800}} onMouseDown={e=>e.preventDefault()} onClick={() => exec('bold')} title="굵게">B</button>
                <div style={{width:1, height:20, background:'var(--border)', margin:'0 2px'}}/>
                {SIZES.map(s => (
                  <button key={s.val} type="button" style={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={() => exec('fontSize', s.val)} title={`글자 ${s.label}`}>{s.label}</button>
                ))}
                <div style={{width:1, height:20, background:'var(--border)', margin:'0 2px'}}/>
                {/* 색상 */}
                <div style={{position:'relative'}}>
                  <button type="button" style={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={() => setColorOpen(o=>!o)} title="글자 색상">🎨 색상</button>
                  {colorOpen && (
                    <div style={{position:'absolute', top:'100%', left:0, zIndex:60, marginTop:4, background:'#fff', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.15)', padding:8, display:'flex', gap:6, flexWrap:'wrap', width:160}}>
                      {COLORS.map(c => (
                        <button key={c} type="button" onMouseDown={e=>e.preventDefault()}
                          onClick={() => { exec('foreColor', c); setColorOpen(false); }}
                          title={c}
                          style={{width:26, height:26, borderRadius:'50%', border:'1px solid #ccc', background:c, cursor:'pointer'}}/>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{width:1, height:20, background:'var(--border)', margin:'0 2px'}}/>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleInsertImages} style={{display:'none'}}/>
                <button type="button" style={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={() => fileRef.current?.click()} disabled={uploading} title="이미지 삽입">
                  {uploading ? '업로드중…' : '🖼️ 이미지'}
                </button>
                <input ref={videoRef} type="file" accept="video/*" multiple onChange={handleInsertVideos} style={{display:'none'}}/>
                <button type="button" style={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={() => videoRef.current?.click()} disabled={uploading} title="영상 삽입 (mp4·webm, 50MB 이하)">
                  {uploading ? '업로드중…' : '🎬 영상'}
                </button>
              </div>
              {/* 편집 영역 */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                style={{minHeight:200, maxHeight:480, overflowY:'auto', padding:'12px 14px', border:'1px solid var(--border)', borderBottomLeftRadius:'var(--radius)', borderBottomRightRadius:'var(--radius)', background:'#fff', fontSize:14, lineHeight:1.8, outline:'none'}}
              />
              <div style={{fontSize:11, color:'var(--text3)', marginTop:6}}>
                💡 텍스트를 드래그해 선택한 뒤 굵게·크기·색상을 적용하세요. 이미지·영상은 커서 위치에 삽입됩니다 (영상: mp4·webm, 50MB 이하).
              </div>

              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button className="btn btn-p" onClick={handleSave} disabled={saving || uploading}>{saving ? <span className="spinner"/> : (editId ? '수정 완료' : '등록')}</button>
                <button className="btn btn-s" onClick={resetForm} disabled={saving}>취소</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 목록 (상세 미선택 시) */}
      {!selected && (
        <div className="card" style={{padding:'14px 16px'}}>
          <div className="card-label">공지사항 목록</div>
          {loading ? <div className="empty"><span className="spinner"/></div>
            : notices.length === 0 ? <div className="empty">등록된 공지사항이 없습니다</div>
            : notices.map(n => {
              const imgCount = imgCountOf(n);
              return (
              <div key={n.id} onClick={() => setSelected(n)}
                style={{padding:'11px 12px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:4,
                  background: 'var(--bg3)', border: '1px solid transparent'}}>
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
      )}

      {/* 상세 (선택 시 전체 너비) */}
      {selected && (
        <div className="card">
          {/* 목록으로 돌아가기 */}
          <button className="btn btn-s" style={{fontSize:12, marginBottom:14}} onClick={() => setSelected(null)}>
            ← 목록으로 돌아가기
          </button>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)'}}>
            <div>
              <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>{selected.title}</div>
              <div style={{fontSize:12, color:'var(--text3)'}}>
                {selected.author?.job_title === '담당자' ? '담당자' : selected.author?.role === 'admin' ? '관리자' : (selected.author?.name || '-')} · {new Date(selected.created_at).toLocaleString('ko-KR')}
              </div>
            </div>
            {(isAdmin || (isHQ && selected.created_by === profile?.id)) && (
              <div style={{display:'flex', gap:6}}>
                <button className="btn btn-s" style={{fontSize:11}} onClick={() => startEdit(selected)}>✏️ 수정</button>
                <button className="btn-danger" onClick={() => handleDelete(selected.id)}>삭제</button>
              </div>
            )}
          </div>
          {renderBody(selected, { clickableImg: true })}
        </div>
      )}

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
