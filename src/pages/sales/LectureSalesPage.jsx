import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, formatNumInput, parseNumInput } from '../../lib/utils';
import SalesTabNav from './SalesTabNav';

export default function LectureSalesPage({ profile, setPage }) {
  const today = new Date().toISOString().slice(0,10);
  const [tab, setTab] = useState('list');

  // 입력 폼
  const [soldAt,     setSoldAt]    = useState(today);
  const [storeName,  setStoreName] = useState('');
  const [branchName, setBranchName]= useState('');
  const [attendees,  setAttendees] = useState('');
  const [price,      setPrice]     = useState('');
  const [memo,       setMemo]      = useState('');
  const [saving,     setSaving]    = useState(false);

  // 데이터
  const [stores,   setStores]   = useState([]);
  const [branches, setBranches] = useState([]);
  const [sales,    setSales]    = useState([]);
  const [loading,  setLoading]  = useState(false);

  // 조회 필터
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const curMonStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  const months = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  });
  const [fMonth,  setFMonth]  = useState(curMonStr);
  const [fStore,  setFStore]  = useState('');
  const [fBranch, setFBranch] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('department,branch').eq('approved',true)
      .neq('role','admin').neq('job_title','담당자')
      .then(({data})=>{
        const depts = [...new Set((data||[]).map(p=>p.department).filter(Boolean))].sort();
        setStores(depts);
      });
  }, []);

  useEffect(()=>{
    if (!storeName) { setBranches([]); setBranchName(''); return; }
    supabase.from('profiles').select('branch').eq('approved',true).eq('department',storeName)
      .then(({data})=>{
        const br = [...new Set((data||[]).map(p=>p.branch).filter(Boolean))].sort();
        setBranches(br);
      });
  }, [storeName]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const from = `${fMonth}-01`;
    const lastDay = new Date(fMonth.split('-')[0], fMonth.split('-')[1], 0).getDate();
    const to = `${fMonth}-${pad(lastDay)}`;
    let q = supabase.from('lecture_sales')
      .select('*')
      .gte('sold_at', from).lte('sold_at', to)
      .order('sold_at', {ascending:false});
    if (fStore)  q = q.eq('store_name',  fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    const {data} = await q;
    setSales(data||[]);
    setLoading(false);
  }, [fMonth, fStore, fBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{ if(tab==='list') fetchSales(); }, [fetchSales, tab]);

  const handleSubmit = async () => {
    if (!storeName)  { toast('점포명을 선택해주세요','err'); return; }
    if (!branchName) { toast('지점명을 선택해주세요','err'); return; }
    if (!price || Number(price)<=0) { toast('매출액을 입력해주세요','err'); return; }
    setSaving(true);
    const {error} = await supabase.from('lecture_sales').insert({
      sold_at: soldAt, store_name: storeName, branch_name: branchName,
      quantity: Number(attendees)||0,
      price: Number(price)||0,
      memo: memo.trim()||null, created_by: profile.id,
    });
    setSaving(false);
    if (error) { toast(error.message,'err'); return; }
    toast('강좌 매출 등록 완료','ok');
    setStoreName(''); setBranchName(''); setAttendees(''); setPrice(''); setMemo(''); setSoldAt(today);
  };

  const totalAmt = sales.reduce((s,r)=>s+(r.price||0),0);
  const totalAttendees = sales.reduce((s,r)=>s+(r.quantity||0),0);
  const inputStyle = {height:36,padding:'0 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,fontFamily:'var(--sans)',outline:'none',width:'100%'};
  const labelStyle = {display:'block',fontSize:11,fontWeight:600,color:'var(--text2)',marginBottom:4};

  return (
    <div>
      {setPage && <SalesTabNav current="lecture_sales_view" setPage={setPage}/>}
      <div style={{background:'#f3e5f5', border:'1px solid #ce93d8', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:16, fontSize:12, color:'#6a1b9a', lineHeight:1.7}}>
        ℹ️ 강좌매출 입력은 이제 <strong>매장 판매입력</strong>에서 출고방식을 <strong>'강좌매출'</strong>로 선택합니다. 이 화면은 <strong>과거 강좌매출 조회</strong> 전용입니다.
      </div>

      {false && tab==='input' && (
        <div className="card">
          <div className="card-label">강좌 매출 입력</div>
          <div style={{display:'grid',gridTemplateColumns:'150px 1fr 1fr',gap:12,marginBottom:12}}>
            <div>
              <label style={labelStyle}>매출일 <span style={{color:'var(--danger)'}}>*</span></label>
              <input type="date" value={soldAt} onChange={e=>setSoldAt(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>점포명 <span style={{color:'var(--danger)'}}>*</span></label>
              <select value={storeName} onChange={e=>{setStoreName(e.target.value);setBranchName('');}} style={inputStyle}>
                <option value="">-- 점포 선택 --</option>
                {stores.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>지점명 <span style={{color:'var(--danger)'}}>*</span></label>
              <select value={branchName} onChange={e=>setBranchName(e.target.value)} style={{...inputStyle,background:!storeName?'#f0f0f0':'#fff'}} disabled={!storeName}>
                <option value="">-- 지점 선택 --</option>
                {branches.map(b=><option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div>
              <label style={labelStyle}>강좌 인원수 (명)</label>
              <input type="number" min={0} value={attendees} onChange={e=>setAttendees(e.target.value)}
                placeholder="0" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>매출액 (원) <span style={{color:'var(--danger)'}}>*</span></label>
              <input type="text" inputMode="numeric" value={formatNumInput(price)} onChange={e=>setPrice(parseNumInput(e.target.value))}
                placeholder="0" style={{...inputStyle,fontWeight:700,color:'var(--accent)'}}/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>메모</label>
            <textarea value={memo} onChange={e=>setMemo(e.target.value)}
              placeholder="메모 입력 (엔터키로 줄바꿈 가능)"
              style={{width:'100%',minHeight:80,padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,fontFamily:'var(--sans)',outline:'none',resize:'vertical',lineHeight:1.6,boxSizing:'border-box'}}/>
          </div>
          <button className="btn btn-p" onClick={handleSubmit} disabled={saving} style={{width:'100%',height:40,fontSize:14,justifyContent:'center'}}>
            {saving?<span className="spinner"/>:'✅ 강좌 매출 등록'}
          </button>
        </div>
      )}

      {tab==='list' && (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 20px',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
            <select value={fMonth} onChange={e=>setFMonth(e.target.value)}
              style={{height:36,padding:'0 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,fontFamily:'var(--sans)',outline:'none'}}>
              {months.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <select value={fStore} onChange={e=>{setFStore(e.target.value);setFBranch('');}}
              style={{height:36,padding:'0 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,fontFamily:'var(--sans)',outline:'none'}}>
              <option value="">전체 점포</option>
              {stores.map(s=><option key={s}>{s}</option>)}
            </select>
            {fStore && (
              <select value={fBranch} onChange={e=>setFBranch(e.target.value)}
                style={{height:36,padding:'0 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,fontFamily:'var(--sans)',outline:'none'}}>
                <option value="">전체 지점</option>
                {sales.filter((s,i,a)=>a.findIndex(x=>x.branch_name===s.branch_name)===i && s.store_name===fStore).map(s=><option key={s.branch_name}>{s.branch_name}</option>)}
              </select>
            )}
            {(fStore||fBranch) && <button className="btn-ghost" onClick={()=>{setFStore('');setFBranch('');}}>✕</button>}
            <div style={{marginLeft:'auto',textAlign:'right'}}>
              <div style={{fontSize:11,color:'var(--text3)'}}>총 매출</div>
              <div style={{fontSize:18,fontWeight:700,color:'var(--accent)',fontFamily:'var(--mono)'}}>{totalAmt.toLocaleString()}원</div>
            </div>
          </div>
          {loading?<div className="empty"><span className="spinner"/></div>:sales.length===0?(
            <div className="empty">데이터가 없습니다</div>
          ):(
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>날짜</th><th>점포</th><th>지점</th><th className="r">인원수</th><th className="r">매출액</th><th>메모</th></tr>
                </thead>
                <tbody>
                  {sales.map(s=>(
                    <tr key={s.id}>
                      <td className="mono" style={{fontSize:12}}>{s.sold_at}</td>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{s.quantity||0}명</td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'#1565C0'}}>{(s.price||0).toLocaleString()}원</td>
                      <td style={{fontSize:12,color:'var(--text2)',whiteSpace:'pre-wrap',maxWidth:200}}>{s.memo||'-'}</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)',borderTop:'2px solid var(--border2)'}}>
                    <td colSpan={3} style={{padding:'10px 11px',fontWeight:700}}>합계</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,padding:'10px 11px'}}>{totalAttendees}명</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:14,color:'#1565C0',padding:'10px 11px'}}>{totalAmt.toLocaleString()}원</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
