import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, formatNumInput, parseNumInput } from '../../lib/utils';
import { STORE_MAP } from '../../lib/constants';
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
  const [detail,  setDetail]  = useState(null); // 행 클릭 시 상품 상세 모달

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
    // 신규 강좌매출: 판매입력에서 결제 '강좌매출'로 등록된 sales
    let sq = supabase.from('sales')
      .select('id, sold_at, store_name, branch_name, quantity, price, memo, created_at, product:products(name), brand:brands(name), seller:profiles(name)')
      .eq('payment', '강좌매출')
      .gte('sold_at', from).lte('sold_at', to);
    if (fStore)  sq = sq.eq('store_name',  fStore);
    if (fBranch) sq = sq.eq('branch_name', fBranch);
    // 과거 강좌매출: lecture_sales (레거시)
    let lq = supabase.from('lecture_sales')
      .select('id, sold_at, store_name, branch_name, quantity, price, memo')
      .gte('sold_at', from).lte('sold_at', to);
    if (fStore)  lq = lq.eq('store_name',  fStore);
    if (fBranch) lq = lq.eq('branch_name', fBranch);
    const [{ data: sRows }, { data: lRows }] = await Promise.all([sq, lq]);
    const merged = [
      ...(sRows || []).map(r => ({ ...r, amount: (Number(r.price)||0) * (Number(r.quantity)||0) })),
      ...(lRows || []).map(r => ({ ...r, amount: Number(r.price)||0 })),
    ].sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)));
    setSales(merged);
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

  const totalAmt = sales.reduce((s,r)=>s+(r.amount||0),0);
  const totalAttendees = sales.reduce((s,r)=>s+(r.quantity||0),0);
  const inputStyle = {height:36,padding:'0 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,fontFamily:'var(--sans)',outline:'none',width:'100%'};
  const labelStyle = {display:'block',fontSize:11,fontWeight:600,color:'var(--text2)',marginBottom:4};

  return (
    <div>
      {setPage && <SalesTabNav current="lecture_sales_view" setPage={setPage}/>}
      <div style={{background:'#f3e5f5', border:'1px solid #ce93d8', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:16, fontSize:12, color:'#6a1b9a', lineHeight:1.7}}>
        ℹ️ 강좌매출 입력은 <strong>매장 판매입력</strong>에서 출고방식을 <strong>'강좌매출'</strong>로 선택합니다. 이 화면은 판매입력으로 등록된 강좌매출을 <strong>조회</strong>합니다. (매출액 = 판매가 × 수량)
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
                {(STORE_MAP[fStore]||[]).map(b=><option key={b}>{b}</option>)}
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
                  <tr><th>날짜</th><th>점포</th><th>지점</th><th>상품명</th><th className="r">수량</th><th className="r">매출액</th><th>메모</th></tr>
                </thead>
                <tbody>
                  {sales.map((s,i)=>(
                    <tr key={`${s.sold_at}-${s.id}-${i}`} onClick={()=>setDetail(s)}
                      style={{cursor:'pointer'}} title="클릭하여 상품 상세 보기"
                      onMouseEnter={e=>e.currentTarget.style.background='#faf5ff'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td className="mono" style={{fontSize:12}}>{s.sold_at}</td>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td style={{fontSize:12,fontWeight:600}}>{s.product?.name||'-'}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{s.quantity||0}</td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'#1565C0'}}>{(s.amount||0).toLocaleString()}원</td>
                      <td style={{fontSize:12,color:'var(--text2)',whiteSpace:'pre-wrap',maxWidth:200}}>{s.memo||'-'}</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)',borderTop:'2px solid var(--border2)'}}>
                    <td colSpan={4} style={{padding:'10px 11px',fontWeight:700}}>합계</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,padding:'10px 11px'}}>{totalAttendees}</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:14,color:'#1565C0',padding:'10px 11px'}}>{totalAmt.toLocaleString()}원</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 강좌매출 상세 모달 */}
      {detail && (
        <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setDetail(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative',background:'#fff',borderRadius:14,width:'min(460px,94vw)',boxShadow:'0 8px 40px rgba(0,0,0,0.2)',overflow:'hidden'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,background:'#f3e5f5'}}>
              <div style={{fontSize:15,fontWeight:700,color:'#6a1b9a'}}>🎓 강좌매출 상세</div>
              <button onClick={()=>setDetail(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#999'}}>✕</button>
            </div>
            <div style={{padding:'18px 20px'}}>
              <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>{detail.product?.name||'(상품 정보 없음)'}</div>
              <div style={{fontSize:12,color:'var(--text2)',marginBottom:16}}>{detail.brand?.name||'-'}</div>
              {[
                ['판매일', detail.sold_at + (detail.created_at ? ` ${new Date(detail.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}` : '')],
                ['점포 / 지점', `${detail.store_name||'-'} ${detail.branch_name||''}`.trim()],
                ['매니저', detail.seller?.name||'-'],
                ['수량', `${detail.quantity||0}개`],
                ['판매가', `${(Number(detail.price)||0).toLocaleString()}원`],
                ['매출액', `${(detail.amount||0).toLocaleString()}원`],
                ['메모', detail.memo||'-'],
              ].map(([k,v])=>(
                <div key={k} style={{display:'flex',gap:12,padding:'7px 0',borderTop:'1px solid var(--border)',fontSize:13}}>
                  <div style={{width:80,color:'var(--text3)',fontWeight:600,flexShrink:0}}>{k}</div>
                  <div style={{fontWeight:600,color:k==='매출액'?'#1565C0':'var(--text)',whiteSpace:'pre-wrap'}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
