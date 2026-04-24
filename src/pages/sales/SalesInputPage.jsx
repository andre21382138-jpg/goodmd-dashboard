import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, GradeBadge, getGrade, formatPhone } from '../../lib/utils';

export default function SalesInputPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [soldAt,    setSoldAt]   = useState(today);
  const [memo,      setMemo]     = useState('');
  const [brands,    setBrands]   = useState([]);
  const [allProducts, setAllProducts] = useState([]); // 전체 상품
  const [saving,    setSaving]   = useState(false);
  const [recentSales, setRecent] = useState([]);

  const PAYMENTS = ['카드','현금','증정','시식','적립금사용'];

  // 상품 라인 (여러 개)
  const newLine = () => ({
    id: Date.now()+Math.random(),
    brandId:'', productId:'', productSearch:'', showSuggestions:false,
    quantity:1, normalPrice:'', discount:'0', price:'',
    payment:'카드',
    pointCustomer:null,  // {id,name,phone,total_points,used_points,grade}
    pointsUsed:0,
  });
  const [lines, setLines] = useState([newLine()]);

  // 적립금 사용 모달 (라인별)
  const [pointsModalLine, setPointsModalLine] = useState(null); // line.id
  const [pmSearch,   setPmSearch]   = useState('');
  const [pmResults,  setPmResults]  = useState([]);
  const [pmSearching,setPmSearching]= useState(false);
  const [pmCustomer, setPmCustomer] = useState(null);
  const [pmAmount,   setPmAmount]   = useState('');

  // 회원 연결
  const [memberMode,   setMemberMode]   = useState('none');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults,setMemberResults]= useState([]);
  const [selectedMember,setSelMember]  = useState(null);
  const [searching,    setSearching]    = useState(false);
  // 신규 회원등록
  const [custName,    setCustName]    = useState('');
  const [custPhone,   setCustPhone]   = useState('');
  const [custBirthday,setCustBirthday]= useState('');
  const [managerName, setManagerName] = useState('');

  const searchMembers = async () => {
    if (!memberSearch.trim()) return;
    setSearching(true);
    const { data } = await supabase.from('customers')
      .select('*')
      .or(`name.ilike.%${memberSearch}%,phone.ilike.%${memberSearch}%`)
      .limit(10);
    setMemberResults(data || []);
    setSearching(false);
  };

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
    supabase.from('products').select('*').order('name').then(({ data }) => setAllProducts(data || []));
  }, []);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name), customer:customers(name,phone)')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecent(data || []);
  }, [profile.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  // 라인 업데이트 헬퍼
  const updateLine = (id, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'productId') {
        const prod = allProducts.find(p => String(p.id) === String(value));
        if (prod?.price) { updated.normalPrice = prod.price; updated.discount = '0'; updated.price = prod.price; }
        if (prod) updated.brandId = String(prod.brand_id);
        updated.showSuggestions = false;
      }
      if (field === 'normalPrice' || field === 'discount') {
        const np = Number(field==='normalPrice' ? value : updated.normalPrice) || 0;
        const dc = Number(field==='discount'    ? value : updated.discount)    || 0;
        const pu = Number(updated.pointsUsed) || 0;
        updated.price = Math.max(0, np - dc - pu);
      }
      if (field === 'price') {
        const np = Number(updated.normalPrice) || 0;
        const sp = Number(value) || 0;
        const pu = Number(updated.pointsUsed) || 0;
        updated.discount = String(Math.max(0, np - sp - pu));
      }
      return updated;
    }));
  };

  // 적립금사용 직접 적용 (모달 확정)
  const applyPointsToLine = (lineId, customer, usedAmt) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const np = Number(l.normalPrice) || 0;
      const dc = Number(l.discount) || 0;
      const pu = Number(usedAmt) || 0;
      const newPrice = Math.max(0, np - dc - pu);
      return { ...l, payment: pu > 0 ? '적립금사용' : l.payment, pointCustomer: pu > 0 ? customer : null, pointsUsed: pu, price: newPrice };
    }));
  };

  const addLine = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id) => setLines(prev => prev.filter(l => l.id !== id));

  const openPointsModal = (line) => {
    if (!line.productId) { toast('먼저 상품을 선택해주세요', 'err'); return; }
    setPointsModalLine(line.id);
    setPmCustomer(line.pointCustomer || null);
    setPmAmount(line.pointsUsed ? String(line.pointsUsed) : '');
    setPmSearch('');
    setPmResults([]);
  };
  const closePointsModal = () => {
    setPointsModalLine(null);
    setPmCustomer(null);
    setPmSearch(''); setPmResults([]); setPmAmount('');
  };
  const searchPointsMember = async () => {
    if (!pmSearch.trim()) return;
    setPmSearching(true);
    const { data } = await supabase.from('customers')
      .select('*')
      .or(`name.ilike.%${pmSearch}%,phone.ilike.%${pmSearch}%`)
      .limit(10);
    setPmResults(data || []);
    setPmSearching(false);
  };
  const confirmPoints = () => {
    const line = lines.find(l => l.id === pointsModalLine);
    if (!line) return;
    const amt = Number(pmAmount) || 0;
    if (amt <= 0) { toast('사용 금액을 입력해주세요', 'err'); return; }
    if (!pmCustomer) { toast('회원을 선택해주세요', 'err'); return; }
    if (amt > (pmCustomer.total_points || 0)) { toast(`사용가능 적립금(${(pmCustomer.total_points||0).toLocaleString()}원)을 초과합니다`, 'err'); return; }
    const np = Number(line.normalPrice) || 0;
    const dc = Number(line.discount) || 0;
    const maxAllowed = Math.max(0, np - dc);
    if (amt > maxAllowed) { toast(`상품가(${maxAllowed.toLocaleString()}원)를 초과할 수 없습니다`, 'err'); return; }
    applyPointsToLine(pointsModalLine, pmCustomer, amt);
    toast(`${pmCustomer.name} 적립금 ${amt.toLocaleString()}원 사용 적용`, 'ok');
    closePointsModal();
  };
  const clearPoints = () => {
    applyPointsToLine(pointsModalLine, null, 0);
    toast('적립금 사용 해제', 'inf');
    closePointsModal();
  };

  const totalAmt = lines.reduce((s, l) => s + (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0), 0);

  const resetForm = () => {
    setLines([newLine()]); setMemo('');
    setCustName(''); setCustPhone(''); setCustBirthday(''); setManagerName('');
    setMemberMode('none'); setMemberSearch(''); setMemberResults([]); setSelMember(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = lines.filter(l => l.brandId && l.productId);
    if (validLines.length === 0) { toast('상품을 하나 이상 선택해주세요', 'err'); return; }
    if (memberMode === 'search' && !selectedMember) { toast('회원을 선택해주세요', 'err'); return; }
    if (memberMode === 'new') {
      if (!custName.trim()) { toast('고객 이름을 입력해주세요', 'err'); return; }
      if (custPhone.replace(/\D/g,'').length < 10) { toast('연락처를 올바르게 입력해주세요', 'err'); return; }
    }
    setSaving(true);
    try {
      let customerId = null;
      let customer = null;
      if (memberMode === 'search') {
        customerId = selectedMember.id;
        customer = selectedMember;
      } else if (memberMode === 'new') {
        const { data: custData, error: custErr } = await supabase.from('customers').insert({
          joined_at: soldAt, name: custName.trim(), phone: custPhone,
          birthday: custBirthday || null, store_name: profile.department,
          branch_name: profile.branch, manager_name: managerName.trim() || null,
          sms_consent: false, sms_consent_at: null, created_by: profile.id,
          grade: '패밀리', total_purchase: 0, total_points: 0,
        }).select().single();
        if (custErr) throw custErr;
        customerId = custData.id;
        customer = custData;
      }

      // 이번 판매 총액
      const saleTotal = validLines.reduce((s,l) => s + (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0), 0);

      // 판매 저장
      for (const l of validLines) {
        const lineAmt = (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0);
        const linePoints = customerId ? Math.floor(lineAmt * getGrade(customer?.total_purchase||0).rate) : 0;
        const pointsUsedLine = Number(l.pointsUsed) || 0;
        const { error } = await supabase.from('sales').insert({
          sold_at: soldAt, store_name: profile.department, branch_name: profile.branch,
          brand_id: Number(l.brandId), product_id: Number(l.productId),
          quantity: Number(l.quantity), price: Number(String(l.price).replace(/,/g,'')),
          payment: l.payment || '카드', memo: memo.trim() || null, created_by: profile.id,
          customer_id: customerId, points_earned: linePoints,
          points_used: pointsUsedLine,
        });
        if (error) throw error;

        // 적립금 사용 회원 계정 업데이트
        if (pointsUsedLine > 0 && l.pointCustomer?.id) {
          const newTotalPoints = Math.max(0, (l.pointCustomer.total_points||0) - pointsUsedLine);
          const newUsedPoints  = (l.pointCustomer.used_points||0) + pointsUsedLine;
          await supabase.from('customers').update({
            total_points: newTotalPoints,
            used_points: newUsedPoints,
          }).eq('id', l.pointCustomer.id);
        }

        // 매장재고 자동 차감
        const prod = allProducts.find(p => String(p.id) === String(l.productId));
        if (prod?.code) {
          const { data: stockRow } = await supabase.from('store_stock')
            .select('id, stock_qty')
            .eq('store_name',  profile.department)
            .eq('branch_name', profile.branch)
            .eq('product_code', prod.code)
            .maybeSingle();
          if (stockRow) {
            const newQty = Math.max(0, (stockRow.stock_qty||0) - (Number(l.quantity)||0));
            await supabase.from('store_stock')
              .update({ stock_qty: newQty, updated_at: new Date().toISOString() })
              .eq('id', stockRow.id);
          }
        }
      }

      // 회원 누적 구매액/등급/적립금 업데이트
      if (customerId) {
        const prevTotal = customer?.total_purchase || 0;
        const newTotal = prevTotal + saleTotal;
        const newGrade = getGrade(newTotal);
        const earnedPoints = Math.floor(saleTotal * newGrade.rate);
        const newPoints = (customer?.total_points || 0) + earnedPoints;
        await supabase.from('customers').update({
          total_purchase: newTotal,
          grade: newGrade.grade,
          total_points: newPoints,
        }).eq('id', customerId);
      }

      const modeMsg = memberMode === 'search'
        ? `${validLines.length}건 저장 + 적립금 ${Math.floor(saleTotal * getGrade(customer?.total_purchase||0).rate).toLocaleString()}원 적립 완료`
        : memberMode === 'new' ? `${validLines.length}건 저장 + 회원등록 완료`
        : `${validLines.length}건 판매 입력 완료`;
      toast(modeMsg, 'ok');
      resetForm(); fetchRecent();
    } catch(err) {
      toast('저장 실패: ' + err.message, 'err');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 판매 내역을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchRecent(); }
  };

  const inputStyle = { width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="card">
        <div className="card-label">판매 입력</div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
        <form onSubmit={handleSubmit}>
          {/* 판매날짜 */}
          <div style={{ marginBottom:14, maxWidth:260 }}>
            <label style={labelStyle}>판매날짜</label>
            <input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} style={inputStyle} required />
          </div>

          {/* 상품 목록 섹션 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              🛍️ 상품 목록
            </div>

            {/* 헤더 라벨 */}
            <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 1fr) 60px 100px 100px 100px 320px 34px 34px', gap:6, padding:'0 4px 6px', fontSize:11, fontWeight:700, color:'var(--text3)' }}>
              <div>상품검색</div>
              <div style={{textAlign:'center'}}>수량</div>
              <div style={{textAlign:'center'}}>정상가</div>
              <div style={{textAlign:'center'}}>할인금액</div>
              <div style={{textAlign:'center'}}>판매가</div>
              <div style={{textAlign:'center'}}>결제</div>
              <div></div>
              <div></div>
            </div>

            {lines.map((l, idx) => {
              const suggestions = l.productSearch && l.productSearch.length >= 1
                ? allProducts
                    .filter(p => {
                      const q = l.productSearch.toLowerCase();
                      return (p.name||'').toLowerCase().includes(q)
                          || (p.code||'').toLowerCase().includes(q)
                          || (p.erp_code||'').toLowerCase().includes(q);
                    })
                    .sort((a,b) => {
                      const aD = a.name.includes('[단종]') ? 1 : 0;
                      const bD = b.name.includes('[단종]') ? 1 : 0;
                      return aD - bD;
                    })
                    .slice(0, 10)
                : [];
              const selectedProd = allProducts.find(p => String(p.id) === String(l.productId));
              const lineSubtotal = (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0);
              const isLast = idx === lines.length - 1;

              return (
              <div key={l.id} style={{ background: idx%2===0?'#fafafa':'#f0f7ff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 8px', marginBottom:6 }}>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 1fr) 60px 100px 100px 100px 320px 34px 34px', gap:6, alignItems:'center' }}>
                  {/* 상품검색 */}
                  <div style={{ position:'relative' }}>
                    <input
                      value={l.productSearch !== undefined ? l.productSearch : (selectedProd?.name || '')}
                      onChange={e => {
                        updateLine(l.id,'productSearch',e.target.value);
                        updateLine(l.id,'productId','');
                        updateLine(l.id,'showSuggestions',true);
                      }}
                      onFocus={() => updateLine(l.id,'showSuggestions',true)}
                      onBlur={() => setTimeout(() => updateLine(l.id,'showSuggestions',false), 200)}
                      style={{...inputStyle, background:'#fff'}}
                      placeholder="상품명 검색"
                      autoComplete="off"
                    />
                    {l.showSuggestions && suggestions.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto', marginTop:2 }}>
                        {suggestions.map(p => {
                          const brand = brands.find(b => b.id === p.brand_id);
                          return (
                          <div key={p.id}
                            onMouseDown={e => { e.preventDefault(); updateLine(l.id,'productId',String(p.id)); updateLine(l.id,'productSearch',p.name); }}
                            style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0' }}
                            onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                            onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                            <div style={{display:'flex', alignItems:'center'}}>
                              {brand && <span style={{fontSize:11, color:'var(--accent)', fontWeight:700, marginRight:6}}>[{brand.name}]</span>}
                              <span>{p.name}</span>
                              <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto', fontFamily:'var(--mono)' }}>{Number(p.price).toLocaleString()}원</span>
                            </div>
                            {(p.code || p.erp_code) && (
                              <div style={{display:'flex', gap:10, marginTop:3, fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)'}}>
                                {p.code && <span>상품코드: <strong style={{color:'var(--text2)'}}>{p.code}</strong></span>}
                                {p.erp_code && <span>ERP: <strong style={{color:'var(--text2)'}}>{p.erp_code}</strong></span>}
                              </div>
                            )}
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                  {/* 수량 */}
                  <input type="number" min={1} value={l.quantity} onChange={e => updateLine(l.id,'quantity',e.target.value)} style={{...inputStyle, textAlign:'center'}} required />
                  {/* 정상가 */}
                  <input type="number" min={0} value={l.normalPrice} onChange={e => updateLine(l.id,'normalPrice',e.target.value)} style={{...inputStyle, textAlign:'right'}} placeholder="0" />
                  {/* 할인금액 */}
                  <input type="number" min={0} value={l.discount} onChange={e => updateLine(l.id,'discount',e.target.value)} style={{...inputStyle, textAlign:'right', color:'var(--danger)'}} placeholder="0" />
                  {/* 판매가 */}
                  <input type="number" min={0} value={l.price} onChange={e => updateLine(l.id,'price',e.target.value)} style={{...inputStyle, textAlign:'right', fontWeight:700, color:'var(--accent)'}} placeholder="0" required />
                  {/* 결제 */}
                  <div style={{ display:'flex', gap:2 }}>
                    {PAYMENTS.map(p => {
                      const isPoint = p === '적립금사용';
                      const active = l.payment === p || (isPoint && l.pointsUsed > 0);
                      return (
                      <button key={p} type="button"
                        onClick={() => isPoint ? openPointsModal(l) : updateLine(l.id,'payment',p)}
                        style={{ flex:isPoint ? 1.6 : 1, height:38, border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)', padding:0,
                          borderColor: active ? (isPoint ? '#7b1fa2' : 'var(--accent)') : 'var(--border)',
                          background: active ? (isPoint ? '#f3e5f5' : '#fff3e0') : '#fff',
                          color: active ? (isPoint ? '#6a1b9a' : 'var(--accent)') : 'var(--text2)',
                          fontWeight: active ? 700 : 500, fontSize: isPoint ? 11 : 12, whiteSpace:'nowrap' }}>{p}</button>
                    )})}
                  </div>
                  {/* + 추가 (마지막 라인에만) */}
                  {isLast ? (
                    <button type="button" onClick={addLine}
                      title="상품 추가"
                      style={{ height:38, width:36, border:'1px solid var(--accent)', background:'#fff3e0', color:'var(--accent)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:18, fontWeight:700, lineHeight:1, padding:0 }}>+</button>
                  ) : <div/>}
                  {/* ✕ 삭제 */}
                  {lines.length > 1 ? (
                    <button type="button" onClick={() => removeLine(l.id)}
                      title="삭제"
                      style={{ height:38, width:36, border:'1px solid var(--border)', background:'#fff', color:'var(--danger)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>✕</button>
                  ) : <div/>}
                </div>
                {l.productId && (
                  <div style={{ marginTop:6, fontSize:11, display:'flex', alignItems:'center', gap:10, fontFamily:'var(--mono)' }}>
                    {/* 좌측: 상품코드 · ERP */}
                    <div style={{display:'flex', gap:10, color:'var(--text3)'}}>
                      {selectedProd?.code && <span>상품코드: <strong style={{color:'var(--text2)'}}>{selectedProd.code}</strong></span>}
                      {selectedProd?.erp_code && <span>ERP: <strong style={{color:'var(--text2)'}}>{selectedProd.erp_code}</strong></span>}
                    </div>
                    {/* 우측: 소계 / 할인 / 적립금 */}
                    <div style={{marginLeft:'auto', textAlign:'right', color:'var(--text2)'}}>
                      {lineSubtotal > 0 && <>소계: <strong style={{color:'var(--accent)'}}>{lineSubtotal.toLocaleString()}원</strong></>}
                      {Number(l.discount) > 0 && <span style={{color:'var(--danger)', marginLeft:8}}>할인 -{(Number(l.quantity)*Number(l.discount)).toLocaleString()}원</span>}
                      {l.pointsUsed > 0 && l.pointCustomer && (
                        <span style={{color:'#6a1b9a', marginLeft:8}}>
                          💳 {l.pointCustomer.name} 적립금 -{Number(l.pointsUsed).toLocaleString()}원 사용
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              );
            })}

            {/* 합계 */}
            {lines.length > 1 && (
              <div style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', textAlign:'right', fontSize:14, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>
                총 합계: {totalAmt.toLocaleString()}원 ({lines.filter(l=>l.brandId&&l.productId).length}개 상품)
              </div>
            )}
          </div>

          {/* 메모 섹션 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10 }}>📝 메모</div>
            <input value={memo} onChange={e => setMemo(e.target.value)} style={inputStyle} placeholder="특이사항 입력... (선택)" />
          </div>

          {/* 회원적립 섹션 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10 }}>🙋 회원 적립</div>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {[
                { key:'none',   label:'없음' },
                { key:'search', label:'기존 회원 검색' },
                { key:'new',    label:'신규 회원등록' },
              ].map(opt => (
                <button key={opt.key} type="button"
                  onClick={() => { setMemberMode(opt.key); setSelMember(null); setMemberResults([]); setMemberSearch(''); }}
                  style={{
                    padding:'7px 16px', border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)',
                    borderColor: memberMode===opt.key ? 'var(--accent)' : 'var(--border)',
                    background:  memberMode===opt.key ? '#fff3e0' : '#fafafa',
                    color:       memberMode===opt.key ? 'var(--accent)' : 'var(--text2)',
                    fontWeight:  memberMode===opt.key ? 700 : 500, fontSize:12,
                  }}>{opt.label}</button>
              ))}
            </div>

            {/* 기존 회원 검색 */}
            {memberMode === 'search' && (
              <div style={{ background:'#f0f7ff', border:'1px solid #90caf9', borderRadius:'var(--radius)', padding:14 }}>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && (e.preventDefault(), searchMembers())}
                    style={{...inputStyle, flex:1}} placeholder="이름 또는 연락처로 검색" />
                  <button type="button" className="btn btn-s" onClick={searchMembers} disabled={searching}>
                    {searching ? <span className="spinner"/> : '검색'}
                  </button>
                </div>
                {selectedMember && (
                  <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:'var(--radius)', padding:'8px 12px', marginBottom:8 }}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <strong style={{color:'var(--success)'}}>{selectedMember.name}</strong>
                        <GradeBadge grade={selectedMember.grade || '패밀리'}/>
                        <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)'}}>{selectedMember.phone}</span>
                        {selectedMember.manager_name && <span style={{fontSize:11, color:'var(--text3)'}}>담당: {selectedMember.manager_name}</span>}
                      </div>
                      <button type="button" className="btn-ghost" onClick={() => setSelMember(null)}>✕</button>
                    </div>
                    {totalAmt > 0 && (
                      <div style={{marginTop:6, padding:'6px 10px', background:'#fff', borderRadius:6, fontSize:12, color:'var(--text2)'}}>
                        💰 이번 구매 적립 예정:&nbsp;
                        <strong style={{color:'var(--accent)'}}>
                          {Math.floor(totalAmt * getGrade(selectedMember.total_purchase||0).rate).toLocaleString()}원
                        </strong>
                        &nbsp;({(getGrade(selectedMember.total_purchase||0).rate*100)}% · {getGrade(selectedMember.total_purchase||0).grade} 등급)
                      </div>
                    )}
                  </div>
                )}
                {memberResults.length > 0 && !selectedMember && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                    {memberResults.map(m => (
                      <div key={m.id} onClick={() => { setSelMember(m); setMemberResults([]); }}
                        style={{ padding:'9px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', background:'#fff', fontSize:13 }}
                        onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                        onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <strong>{m.name}</strong>
                          <GradeBadge grade={m.grade || '패밀리'}/>
                          <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)'}}>{m.phone}</span>
                          <span style={{fontSize:11, color:'var(--text3)'}}>{m.store_name} · {m.branch_name}</span>
                          {m.manager_name && <span style={{fontSize:11, color:'var(--accent)'}}>담당: {m.manager_name}</span>}
                        </div>
                        <div style={{fontSize:11, color:'var(--text3)', marginTop:3}}>
                          누적구매: {(m.total_purchase||0).toLocaleString()}원 · 적립금: {(m.total_points||0).toLocaleString()}원
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {memberResults.length === 0 && memberSearch && !searching && !selectedMember && (
                  <div style={{fontSize:12, color:'var(--text3)'}}>검색 결과가 없습니다</div>
                )}
              </div>
            )}

            {/* 신규 회원등록 */}
            {memberMode === 'new' && (
              <div style={{ background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <label style={labelStyle}>고객 이름</label>
                    <input value={custName} onChange={e => setCustName(e.target.value)}
                      style={inputStyle} placeholder="홍길동" />
                  </div>
                  <div>
                    <label style={labelStyle}>연락처</label>
                    <input value={custPhone} onChange={e => setCustPhone(formatPhone(e.target.value))}
                      style={inputStyle} placeholder="010-0000-0000" />
                  </div>
                  <div>
                    <label style={labelStyle}>생일 <span style={{color:'var(--text3)',fontWeight:400}}>(선택)</span></label>
                    <input type="date" value={custBirthday} onChange={e => setCustBirthday(e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>담당 매니저 이름</label>
                    <input value={managerName} onChange={e => setManagerName(e.target.value)}
                      style={inputStyle} placeholder="매니저 이름 입력" />
                  </div>
                </div>
                <div style={{fontSize:12, color:'var(--text3)', marginTop:6, padding:'6px 0'}}>
                  💡 SMS 수신동의는 QR코드 가입으로만 처리됩니다
                </div>
              </div>
            )}
          </div>

          <button className="btn btn-p" type="submit" disabled={saving}
            style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> :
              memberMode === 'search' ? '✓ 판매 + 회원 적립' :
              memberMode === 'new'    ? '✓ 판매 + 신규 회원등록' :
                                       '✓ 판매 입력 저장'}
          </button>
        </form>
      </div>

      {/* 적립금 사용 모달 */}
      {pointsModalLine && (() => {
        const line = lines.find(l => l.id === pointsModalLine);
        const np = Number(line?.normalPrice)||0, dc = Number(line?.discount)||0;
        const maxAllowed = Math.max(0, np - dc);
        return (
          <div style={{position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
            <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(500px,95vw)', boxShadow:'0 8px 40px rgba(0,0,0,0.25)', padding:'24px'}}>
              <div style={{display:'flex', alignItems:'center', marginBottom:18}}>
                <div style={{fontSize:17, fontWeight:700, color:'#6a1b9a'}}>💳 적립금 사용</div>
                <button type="button" onClick={closePointsModal} style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
              </div>

              {!pmCustomer ? (
                <>
                  <div style={{fontSize:12, color:'var(--text2)', marginBottom:10}}>회원을 검색하세요 (이름 또는 연락처)</div>
                  <div style={{display:'flex', gap:8, marginBottom:10}}>
                    <input value={pmSearch} onChange={e => setPmSearch(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && (e.preventDefault(), searchPointsMember())}
                      style={{...inputStyle, flex:1}} placeholder="홍길동 또는 010-1234-5678" autoFocus/>
                    <button type="button" className="btn btn-s" onClick={searchPointsMember} disabled={pmSearching}>
                      {pmSearching ? <span className="spinner"/> : '검색'}
                    </button>
                  </div>
                  {pmResults.length > 0 && (
                    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden', maxHeight:280, overflowY:'auto' }}>
                      {pmResults.map(m => (
                        <div key={m.id} onClick={() => setPmCustomer(m)}
                          style={{ padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', background:'#fff', fontSize:13 }}
                          onMouseEnter={e => e.currentTarget.style.background='#f3e5f5'}
                          onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                          <div style={{display:'flex', alignItems:'center', gap:8}}>
                            <strong>{m.name}</strong>
                            <GradeBadge grade={m.grade || '패밀리'}/>
                            <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)'}}>{m.phone}</span>
                          </div>
                          <div style={{fontSize:12, color:'#6a1b9a', marginTop:3, fontWeight:700}}>
                            사용가능 적립금: {(m.total_points||0).toLocaleString()}원
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {pmResults.length === 0 && pmSearch && !pmSearching && (
                    <div style={{fontSize:12, color:'var(--text3)'}}>검색 결과가 없습니다</div>
                  )}
                </>
              ) : (
                <>
                  {/* 선택된 회원 */}
                  <div style={{ background:'#f3e5f5', border:'1px solid #ce93d8', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:14 }}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <strong style={{fontSize:14}}>{pmCustomer.name}</strong>
                        <GradeBadge grade={pmCustomer.grade || '패밀리'}/>
                        <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)'}}>{pmCustomer.phone}</span>
                      </div>
                      <button type="button" className="btn-ghost" onClick={() => setPmCustomer(null)}>변경</button>
                    </div>
                    <div style={{fontSize:13, color:'#6a1b9a', fontWeight:700, textAlign:'center', padding:'6px 0', background:'#fff', borderRadius:6}}>
                      사용가능 적립금: <span style={{fontSize:16}}>{(pmCustomer.total_points||0).toLocaleString()}원</span>
                    </div>
                  </div>

                  {/* 금액 입력 */}
                  <div style={{marginBottom:14}}>
                    <label style={labelStyle}>사용할 금액 (원)</label>
                    <input type="number" min={0} value={pmAmount}
                      max={Math.min(pmCustomer.total_points||0, maxAllowed)}
                      onChange={e => setPmAmount(e.target.value)}
                      style={{...inputStyle, fontWeight:700, fontSize:15, textAlign:'right'}}
                      placeholder="0" autoFocus/>
                    <div style={{fontSize:11, color:'var(--text3)', marginTop:6, display:'flex', justifyContent:'space-between'}}>
                      <span>상품 최대: {maxAllowed.toLocaleString()}원</span>
                      <span>적립금 잔액: {(pmCustomer.total_points||0).toLocaleString()}원</span>
                    </div>
                    <div style={{display:'flex', gap:6, marginTop:8}}>
                      {[1000, 5000, 10000, Math.min(pmCustomer.total_points||0, maxAllowed)].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map(amt => (
                        <button key={amt} type="button"
                          onClick={() => setPmAmount(String(amt))}
                          style={{flex:1, height:30, fontSize:11, border:'1px solid var(--border)', borderRadius:6, background:'#fafafa', cursor:'pointer', color:'var(--text2)'}}>
                          {amt === Math.min(pmCustomer.total_points||0, maxAllowed) ? '전액' : `${amt.toLocaleString()}원`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 사용 후 미리보기 */}
                  {Number(pmAmount) > 0 && (
                    <div style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, fontSize:12 }}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                        <span>상품가</span><strong>{maxAllowed.toLocaleString()}원</strong>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4, color:'#6a1b9a'}}>
                        <span>적립금 사용</span><strong>-{Number(pmAmount).toLocaleString()}원</strong>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', paddingTop:6, borderTop:'1px solid #ffcc80', color:'var(--accent)', fontWeight:700}}>
                        <span>최종 판매가</span><strong>{Math.max(0, maxAllowed - Number(pmAmount)).toLocaleString()}원</strong>
                      </div>
                    </div>
                  )}

                  <div style={{display:'flex', gap:8}}>
                    {line?.pointsUsed > 0 && (
                      <button type="button" className="btn btn-s" style={{height:42, padding:'0 14px'}} onClick={clearPoints}>
                        사용 해제
                      </button>
                    )}
                    <button type="button" className="btn btn-s" style={{flex:1, justifyContent:'center', height:42}} onClick={closePointsModal}>
                      취소
                    </button>
                    <button type="button" className="btn btn-p" style={{flex:1, justifyContent:'center', height:42, fontWeight:700, background:'#7b1fa2', borderColor:'#7b1fa2'}}
                      onClick={confirmPoints}>
                      확인
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 최근 입력 내역 */}
      <div className="card">
        <div className="card-label">최근 입력 내역 (10건)</div>
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th>판매일</th><th>브랜드</th><th>상품명</th>
                <th className="r">수량</th><th className="r">판매가</th>
                <th>결제</th><th>고객</th><th>메모</th><th></th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0
                ? <tr><td colSpan={9} className="empty">입력된 판매 내역이 없습니다</td></tr>
                : recentSales.map(s => (
                  <tr key={s.id}>
                    <td className="mono">{s.sold_at}</td>
                    <td>{s.brand?.name || '-'}</td>
                    <td>{s.product?.name || '-'}</td>
                    <td className="r">{s.quantity}</td>
                    <td className="r">{Number(s.price).toLocaleString()}원</td>
                    <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9'}}>{s.payment}</span></td>
                    <td style={{fontSize:12}}>{s.customer ? <span style={{color:'var(--success)',fontWeight:600}}>👤 {s.customer.name}</span> : '-'}</td>
                    <td style={{fontSize:11,color:'var(--text2)'}}>{s.memo || '-'}</td>
                    <td><button className="btn-danger" onClick={() => handleDelete(s.id)}>삭제</button></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
