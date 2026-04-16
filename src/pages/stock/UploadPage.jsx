import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, parseSubul } from '../../lib/utils';
import SafetyTab from './SafetyTab';

export default function UploadPage({ profile, activeUploadId, setActiveUploadId, parsed, setParsed, filename, setFilename }) {
  const [loading, setLoading] = useState(false);
  const [dragging, setDrag]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (activeUploadId && !parsed) loadFromHistory(activeUploadId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFromHistory = async (id) => {
    setLoading(true);
    try {
      const { data: rec } = await supabase
        .from('upload_history').select('*').eq('id', id).single();
      if (!rec) { setLoading(false); return; }
      const { data: fileData, error } = await supabase.storage
        .from('uploads').download(rec.storage_path);
      if (error) throw error;
      const arrayBuf = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let str = '';
      for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
      const result = parseSubul(str);
      setParsed(result);
      setFilename(rec.filename);
    } catch(e) {
      toast('파일 로드 실패: ' + e.message, 'err');
    }
    setLoading(false);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls 또는 xlsx 파일만 지원합니다', 'err'); return; }
    setLoading(true); setFilename(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = parseSubul(e.target.result);
        if (!result.rows.length) { toast('데이터가 없습니다', 'err'); setLoading(false); return; }
        setParsed(result);

        setSaving(true);
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('uploads').upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        const { data: hist, error: histErr } = await supabase
          .from('upload_history').insert({
            filename: file.name,
            storage_path: path,
            period_str: result.periodStr,
            row_count: result.rows.length,
            uploaded_by: profile.id,
          }).select().single();
        if (histErr) throw histErr;

        setActiveUploadId(hist.id);
        toast(`업로드 완료 · ${result.rows.length.toLocaleString()}개 항목 저장됨`);
      } catch(err) {
        toast('업로드 오류: ' + err.message, 'err');
      }
      setSaving(false);
      setLoading(false);
    };
    reader.onerror = () => { toast('파일 읽기 실패', 'err'); setLoading(false); };
    reader.readAsBinaryString(file);
  };

  const handleReset = async () => {
    if (!window.confirm('현재 파일을 초기화하시겠습니까?\n(업로드 이력은 유지됩니다)')) return;
    setParsed(null);
    setFilename('');
    setActiveUploadId(null);
    toast('초기화됐습니다', 'inf');
  };

  const stats = useMemo(() => {
    if (!parsed) return null;
    const { rows } = parsed;
    const depts   = new Set(rows.map(r => r.dept));
    const stores  = new Set(rows.map(r => r.store));
    const codes   = new Set(rows.map(r => r.code));
    const totalSales = rows.reduce((s,r) => s+r.sales, 0);
    const totalStock = rows.reduce((s,r) => s+r.stock, 0);
    const shortCount = rows.filter(r => r.stock < r.sales).length;
    return { depts: depts.size, stores: stores.size, codes: codes.size, totalSales, totalStock, shortCount };
  }, [parsed]);

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
          <div className="card-label" style={{ margin:0, padding:0, border:'none' }}>굿MD 상품별점별수불현황 파일 업로드</div>
          {parsed && (
            <button className="btn-danger" onClick={handleReset}>✕ 초기화</button>
          )}
        </div>

        <div className={`drop ${dragging?'over':''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".xls,.xlsx"
            onClick={e => e.stopPropagation()}
            onChange={e => { handleFile(e.target.files[0]); e.target.value=''; }} />
          {loading || saving
            ? <><div className="drop-icon"><span className="spinner"/></div>
                <div className="drop-main">{saving ? 'Supabase에 저장 중...' : '파싱 중...'}</div></>
            : parsed
              ? <><div className="drop-icon">✅</div>
                  <div className="drop-main"><strong>다른 파일</strong>을 올리면 교체 업로드됩니다</div>
                  <div className="drop-filename">📄 {filename}</div></>
              : <><div className="drop-icon">📂</div>
                  <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
                  <div className="drop-sub">굿MD → 상품별점별수불현황 (.xls / .xlsx)</div></>
          }
        </div>
      </div>

      {stats && (
        <div className="stats">
          <div className="stat">
            <div className="stat-l">기간</div>
            <div className="stat-v" style={{fontSize:15, lineHeight:1.3}}>{parsed.periodStr}</div>
          </div>
          <div className="stat">
            <div className="stat-l">백화점 / 매장</div>
            <div className="stat-v">{stats.depts} <span style={{fontSize:13, fontWeight:400, color:'var(--text2)'}}>그룹</span> · {stats.stores} <span style={{fontSize:13, fontWeight:400, color:'var(--text2)'}}>지점</span></div>
            <div className="stat-u">{stats.codes}개 상품</div>
          </div>
          <div className="stat">
            <div className="stat-l">총 판매수량</div>
            <div className="stat-v">{stats.totalSales.toLocaleString()}</div>
            <div className="stat-u">개</div>
          </div>
          <div className="stat">
            <div className="stat-l">총 현재재고</div>
            <div className="stat-v">{stats.totalStock.toLocaleString()}</div>
            <div className="stat-u">개</div>
          </div>
          <div className="stat" style={stats.shortCount > 0 ? {borderColor:'#ffc107'} : {}}>
            <div className="stat-l">재고 부족</div>
            <div className="stat-v" style={{color: stats.shortCount > 0 ? 'var(--danger)' : 'var(--success)'}}>
              {stats.shortCount}
            </div>
            <div className="stat-u">개 항목</div>
          </div>
        </div>
      )}

      {parsed && (
        <div className="card" style={{padding:'16px 20px'}}>
          <SafetyTab rows={parsed.rows} period={parsed.periodStr} />
        </div>
      )}

      {!parsed && !loading && (
        <div className="empty">
          굿MD에서 <strong>상품별점별수불현황</strong> 파일을 다운로드한 뒤<br/>
          위 영역에 업로드하면 안전재고 현황을 바로 확인할 수 있습니다<br/>
          <span style={{fontSize:11,color:'var(--text3)'}}>업로드한 파일은 자동 저장되어 누적 관리됩니다</span>
        </div>
      )}
    </div>
  );
}
