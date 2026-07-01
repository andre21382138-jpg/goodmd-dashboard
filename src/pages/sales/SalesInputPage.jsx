import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, GradeBadge, getGrade, formatPhone, formatNumInput, parseNumInput } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

export default function SalesInputPage({ profile }) {
  // 본사 계정(매니저가 아닌 admin/hq)이면 점포·지점을 직접 선택. 매장 매니저는 자기 매장 자동.
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore,  setHqStore]  = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const hqBranchOptions = useMemo(() => hqStore ? (STORE_MAP[hqStore] || []) : [], [hqStore]);

  const today = new Date().toISOString().slice(0, 10);
  const [soldAt,    setSoldAt]   = useState(today);
  const [memo,      setMemo]     = useState('');
  // 본사발송 요청 배송지 정보 (한 거래에 본사요청 라인이 1개 이상이면 사용)
  const [recipName,       setRecipName]       = useState('');
  const [recipPhone,      setRecipPhone]      = useState('');
  const [recipAddr,       setRecipAddr]       = useState('');       // (우편번호) 도로명 (검색으로 자동 채움)
  const [recipAddrDetail, setRecipAddrDetail] = useState('');       // 상세주소 (직접 입력)
  const [deliveryNotes,   setDeliveryNotes]   = useState('');

  // 다음(카카오) 우편번호 검색
  const openAddrSearch = () => {
    const launch = () => {
      // eslint-disable-next-line no-new, new-cap
      new window.daum.Postcode({
        oncomplete: (data) => {
          const addr = data.roadAddress || data.jibunAddress || '';
          const zip = data.zonecode ? `(${data.zonecode}) ` : '';
          setRecipAddr(`${zip}${addr}`);
          setTimeout(() => {
            const el = document.getElementById('recip-addr-detail');
            if (el) el.focus();
          }, 0);
        },
      }).open();
    };
    if (window.daum?.Postcode) {
      launch();
    } else {
      const script = document.createElement('script');
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.onload  = launch;
      script.onerror = () => toast('주소 검색 서비스 로드 실패', 'err');
      document.body.appendChild(script);
    }
  };
  const [brands,    setBrands]   = useState([]);
  const [allProducts, setAllProducts] = useState([]); // 전체 상품
  const [saving,    setSaving]   = useState(false);
  const [recentSales, setRecent] = useState([]);

  const PAYMENTS = ['카드','현금','증정','시식'];

  // 상품 라인 (여러 개)
  const newLine = () => ({
    id: Date.now()+Math.random(),
    brandId:'', productId:'', productSearch:'', showSuggestions:false,
    quantity:1, normalPrice:'', discount:'0', price:'',
    payment:'',  // 결제수단 미선택 — 매니저가 카드/현금/증정/시식 중 명시적으로 선택해야 저장 가능

    delivery:'none',  // 'none' | 'store' | 'hq'
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
  const [custConsent, setCustConsent] = useState(false); // 마케팅(SMS) 수신동의 — 동의 시 서류 별도 보관
  const [managerName, setManagerName] = useState('');

  const searchMembers = async () => {
    const q = memberSearch.trim();
    if (!/^\d{4}$/.test(q)) {
      toast('휴대폰 뒷 4자리(숫자)를 입력해주세요', 'err');
      return;
    }
    setSearching(true);
    // 휴대폰 뒷 4자리 매칭 (예: "5678" → 010-1234-5678 매칭)
    const { data } = await supabase.from('customers')
      .select('*')
      .ilike('phone', `%${q}`)
      .limit(50);
    setMemberResults(data || []);
    setSearching(false);
  };

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
    supabase.from('products').select('*').order('name').then(({ data }) => setAllProducts(data || []));
  }, []);

  // 바코드 스캐너 (페이지 내 한정)
  // - HID 키보드 방식 스캐너: 빠른 연속 keystroke + Enter
  // - input/textarea/select 포커스 중에는 비활성 (직접 타이핑 보호)
  // - 매칭: products.code === 스캔코드
  // - 같은 상품 재스캔 → 수량 +1, 첫 빈 라인이 있으면 채움, 없으면 새 라인 추가
  const scanBufRef = useRef({ chars: '', lastTime: 0, startTime: 0 });
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const now = Date.now();
      const buf = scanBufRef.current;
      if (e.key === 'Enter') {
        const code = buf.chars.trim();
        const elapsed = now - buf.startTime;
        buf.chars = '';
        if (code.length >= 3 && elapsed < 800) {
          e.preventDefault();
          const prod = allProducts.find(p => String(p.code || '').trim() === code);
          if (!prod) {
            toast(`등록되지 않은 코드: ${code}`, 'err');
            return;
          }
          if (prod.is_sales_stopped) {
            // 판매중지 상품도 매장 재고 소진을 위해 판매는 허용 (발주만 차단)
            toast(`'${prod.name}'은(는) 판매중지 상품입니다 (재고 소진 판매)`, 'inf');
          }
          setLines(prev => {
            const idx = prev.findIndex(l => String(l.productId) === String(prod.id));
            if (idx >= 0) {
              const updated = [...prev];
              const newQty = (Number(updated[idx].quantity) || 0) + 1;
              updated[idx] = { ...updated[idx], quantity: newQty };
              return updated;
            }
            const fill = {
              brandId: String(prod.brand_id || ''),
              productId: String(prod.id),
              productSearch: prod.name || '',
              showSuggestions: false,
              normalPrice: prod.price || '',
              discount: '0',
              price: prod.price || '',
              quantity: 1,
            };
            const emptyIdx = prev.findIndex(l => !l.productId);
            if (emptyIdx >= 0) {
              const updated = [...prev];
              updated[emptyIdx] = { ...updated[emptyIdx], ...fill };
              return updated;
            }
            return [...prev, { ...newLine(), ...fill }];
          });
          toast(`📷 ${prod.name} 추가`, 'ok');
        }
      } else if (e.key.length === 1) {
        if (now - buf.lastTime > 100) {
          buf.chars = '';
          buf.startTime = now;
        }
        buf.chars += e.key;
        buf.lastTime = now;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts]);

  const fetchRecent = useCallback(async () => {
    // 당일(로컬 0시 이후) 입력한 판매 전체 — created_at 기준
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name), customer:customers(name,phone)')
      .eq('created_by', profile.id)
      .gte('created_at', startOfToday.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);
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
        const effQty = Math.max(Number(updated.quantity) || 0, 1);
        const inputUnit = (Number(parseNumInput(value)) || 0) / effQty;
        if (field === 'normalPrice') updated.normalPrice = inputUnit;
        else                          updated.discount    = inputUnit;
        const np = Number(updated.normalPrice) || 0;
        const dc = Number(updated.discount)    || 0;
        const pu = Number(updated.pointsUsed)  || 0;
        // pu(적립금)는 라인 전체 금액이므로 단가에서는 effQty로 나눠 차감
        updated.price = Math.max(0, np - dc - pu / effQty);
      }
      if (field === 'price') {
        const effQty = Math.max(Number(updated.quantity) || 0, 1);
        const inputUnit = (Number(parseNumInput(value)) || 0) / effQty;
        updated.price = inputUnit;
        const np = Number(updated.normalPrice) || 0;
        const sp = Number(updated.price) || 0;
        const pu = Number(updated.pointsUsed) || 0;
        updated.discount = Math.max(0, np - sp - pu / effQty);
      }
      if (field === 'quantity') {
        // 수량 변경 시 적립금 단가환산(pu/qty)이 달라지므로 price 재계산
        const effQty = Math.max(Number(value) || 0, 1);
        const np = Number(updated.normalPrice) || 0;
        const dc = Number(updated.discount) || 0;
        const pu = Number(updated.pointsUsed) || 0;
        if (pu > 0) updated.price = Math.max(0, np - dc - pu / effQty);
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
      const qty = Math.max(Number(l.quantity) || 0, 1);
      // pu는 라인 전체 적립금이므로 단가에서는 qty로 나눠 차감
      const newPrice = Math.max(0, np - dc - pu / qty);
      // 적립금사용은 결제수단이 아니라 '공제' — 기존 payment(카드/현금 등)는 유지
      return { ...l, pointCustomer: pu > 0 ? customer : null, pointsUsed: pu, price: newPrice };
    }));
  };

  const addLine = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id) => setLines(prev => {
    if (prev.length <= 1) return [newLine()];
    return prev.filter(l => l.id !== id);
  });

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
    const q = pmSearch.trim();
    if (!/^\d{4}$/.test(q)) {
      toast('휴대폰 뒷 4자리(숫자)를 입력해주세요', 'err');
      return;
    }
    setPmSearching(true);
    // 휴대폰 뒷 4자리 매칭
    const { data } = await supabase.from('customers')
      .select('*')
      .ilike('phone', `%${q}`)
      .limit(50);
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
    // 회원적립 영역 자동 동기화: 적립금 사용 회원을 그대로 적립 대상 회원으로 설정
    // (선택돼 있던 다른 회원/비회원 모드는 그대로 두어 매니저 의도를 보존)
    if (memberMode === 'none' && !selectedMember) {
      setMemberMode('search');
      setSelMember(pmCustomer);
      setMemberSearch(pmCustomer.phone || '');
      setMemberResults([]);
      toast(`${pmCustomer.name}님을 적립 회원으로 자동 선택했습니다`, 'inf');
    }
    const np = Number(line.normalPrice) || 0;
    const dc = Number(line.discount) || 0;
    const qty = Math.max(Number(line.quantity) || 0, 1);
    const maxAllowed = Math.max(0, (np - dc) * qty);
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
    setRecipName(''); setRecipPhone(''); setRecipAddr(''); setRecipAddrDetail(''); setDeliveryNotes('');
    setCustName(''); setCustPhone(''); setCustBirthday(''); setManagerName(''); setCustConsent(false);
    setMemberMode('none'); setMemberSearch(''); setMemberResults([]); setSelMember(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 본사 계정은 점포/지점 선택 필수
    if (!isStoreMgr) {
      if (!storeName)  { toast('점포를 선택해주세요', 'err'); return; }
      if (!branchName) { toast('지점을 선택해주세요', 'err'); return; }
    }
    const validLines = lines.filter(l => l.brandId && l.productId);
    if (validLines.length === 0) { toast('상품을 하나 이상 선택해주세요', 'err'); return; }
    // 적립금 사용 여부와 무관하게 결제수단(카드/현금/증정/시식) 선택 필수
    const noPaymentLine = validLines.find(l => !l.payment || l.payment === '적립금사용');
    if (noPaymentLine) {
      const prod = allProducts.find(p => String(p.id) === String(noPaymentLine.productId));
      toast(`결제수단을 선택해주세요${prod ? ` (${prod.name})` : ''}`, 'err');
      return;
    }
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
          birthday: custBirthday || null, store_name: storeName,
          branch_name: branchName, manager_name: managerName.trim() || null,
          sms_consent: custConsent, sms_consent_at: custConsent ? new Date().toISOString() : null, created_by: profile.id,
          grade: '패밀리', total_purchase: 0, total_points: 0,
        }).select().single();
        if (custErr) throw custErr;
        customerId = custData.id;
        customer = custData;
      }

      // 본사발송 요청 라인이 있으면 배송지 필수 검증
      const hasHqRequest = validLines.some(l => l.delivery === 'hq');
      if (hasHqRequest) {
        if (!recipName.trim() || !recipPhone.trim() || !recipAddr.trim()) {
          toast('본사 발송 요청 배송지(받는사람·연락처·주소)를 모두 입력해주세요', 'err');
          setSaving(false);
          return;
        }
      }

      // 이번 판매 총액
      const saleTotal = validLines.reduce((s,l) => s + (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0), 0);

      // 판매 저장
      for (const l of validLines) {
        const lineAmt = (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0);
        const linePoints = customerId ? Math.floor(lineAmt * getGrade(customer?.total_purchase||0).rate) : 0;
        const pointsUsedLine = Number(l.pointsUsed) || 0;
        const dType = l.delivery || 'none';
        const deliveryFields = dType === 'hq'
          ? {
              delivery_type: 'hq',
              delivery_status: 'pending',
              recipient_name: recipName.trim(),
              recipient_phone: recipPhone.trim(),
              recipient_address: (recipAddr.trim() + (recipAddrDetail.trim() ? ' ' + recipAddrDetail.trim() : '')).trim(),
              delivery_notes: deliveryNotes.trim() || null,
              delivery_requested: true,
            }
          : dType === 'store'
          ? { delivery_type: 'store', delivery_requested: true }
          : dType === 'lecture'
          ? { delivery_type: 'lecture', delivery_requested: false } // 강좌매출 — 재고차감 없음
          : { delivery_type: 'none', delivery_requested: false };
        const { error } = await supabase.from('sales').insert({
          sold_at: soldAt, store_name: storeName, branch_name: branchName,
          brand_id: Number(l.brandId), product_id: Number(l.productId),
          quantity: Number(l.quantity), price: Number(String(l.price).replace(/,/g,'')),
          payment: l.payment || '카드', memo: memo.trim() || null, created_by: profile.id,
          customer_id: customerId, points_earned: linePoints,
          points_used: pointsUsedLine,
          ...deliveryFields,
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

        // 매장재고 자동 차감 — 본사 택배요청(hq)·강좌매출(lecture)은 매장 재고 차감 제외
        const prod = allProducts.find(p => String(p.id) === String(l.productId));
        if (prod?.code && dType !== 'hq' && dType !== 'lecture') {
          const { data: stockRow } = await supabase.from('store_stock')
            .select('id, stock_qty')
            .eq('store_name',  storeName)
            .eq('branch_name', branchName)
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
        {isStoreMgr ? (
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
            📍 {profile.department} · {profile.branch}
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
            <div>
              <label style={labelStyle}>점포 <span style={{color:'var(--danger)'}}>*</span></label>
              <select value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }} style={inputStyle} required>
                <option value="">점포 선택</option>
                {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>지점 <span style={{color:'var(--danger)'}}>*</span></label>
              <select value={hqBranch} onChange={e => setHqBranch(e.target.value)} style={{...inputStyle, background:!hqStore?'#f0f0f0':'#fff'}} disabled={!hqStore} required>
                <option value="">{hqStore ? '지점 선택' : '먼저 점포 선택'}</option>
                {hqBranchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        )}
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
            <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 1fr) 60px 100px 100px 100px 220px 110px 80px 72px 34px', gap:6, padding:'0 4px 6px', fontSize:11, fontWeight:700, color:'var(--text3)' }}>
              <div>상품검색</div>
              <div style={{textAlign:'center'}}>수량</div>
              <div style={{textAlign:'center'}}>정상가</div>
              <div style={{textAlign:'center'}}>할인금액</div>
              <div style={{textAlign:'center'}}>판매가</div>
              <div style={{textAlign:'center'}}>결제</div>
              <div style={{textAlign:'center', color:'#6a1b9a'}}>적립금</div>
              <div style={{textAlign:'center'}}>택배</div>
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
                      // 판매중지·단종 상품은 목록 하단으로
                      const aD = (a.is_sales_stopped || a.name.includes('[단종]')) ? 1 : 0;
                      const bD = (b.is_sales_stopped || b.name.includes('[단종]')) ? 1 : 0;
                      return aD - bD;
                    })
                    .slice(0, 10)
                : [];
              const selectedProd = allProducts.find(p => String(p.id) === String(l.productId));
              const lineSubtotal = (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0);
              const effQtyDisplay = Math.max(Number(l.quantity) || 0, 1);
              // 0원도 표시되도록 — 빈 값('', null, undefined)만 빈 칸으로
              const isEmpty = v => v === '' || v == null;
              const totalNormal   = isEmpty(l.normalPrice) ? '' : Number(l.normalPrice) * effQtyDisplay;
              const totalDiscount = isEmpty(l.discount)    ? '' : Number(l.discount)    * effQtyDisplay;
              const totalPrice    = isEmpty(l.price)       ? '' : Number(l.price)       * effQtyDisplay;
              const isLast = idx === lines.length - 1;

              return (
              <div key={l.id} style={{ background: idx%2===0?'#fafafa':'#f0f7ff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 8px', marginBottom:6 }}>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 1fr) 60px 100px 100px 100px 220px 110px 80px 72px 34px', gap:6, alignItems:'center' }}>
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
                              <span style={{color: p.is_sales_stopped ? 'var(--text3)' : undefined}}>{p.name}</span>
                              {p.is_sales_stopped && <span style={{fontSize:10, fontWeight:700, color:'var(--danger)', background:'#ffebee', border:'1px solid #ef9a9a', borderRadius:4, padding:'1px 5px', marginLeft:6}}>판매중지</span>}
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
                  {/* 정상가 (수량 × 단가) */}
                  <input type="text" inputMode="numeric" value={formatNumInput(totalNormal === '' ? '' : String(Math.round(totalNormal)))} onChange={e => updateLine(l.id,'normalPrice',parseNumInput(e.target.value))} style={{...inputStyle, textAlign:'right'}} placeholder="0" />
                  {/* 할인금액 (수량 × 단가) */}
                  <input type="text" inputMode="numeric" value={formatNumInput(totalDiscount === '' ? '' : String(Math.round(totalDiscount)))} onChange={e => updateLine(l.id,'discount',parseNumInput(e.target.value))} style={{...inputStyle, textAlign:'right', color:'var(--danger)'}} placeholder="0" />
                  {/* 판매가 (수량 × 단가) — 0 허용 (증정·시식) */}
                  <input type="text" inputMode="numeric" value={formatNumInput(totalPrice === '' ? '' : String(Math.round(totalPrice)))} onChange={e => updateLine(l.id,'price',parseNumInput(e.target.value))} style={{...inputStyle, textAlign:'right', fontWeight:700, color:'var(--accent)'}} placeholder="0" />
                  {/* 결제 */}
                  <div style={{ display:'flex', gap:2 }}>
                    {PAYMENTS.map(p => {
                      const active = l.payment === p;
                      return (
                      <button key={p} type="button"
                        onClick={() => updateLine(l.id,'payment',p)}
                        style={{ flex:1, height:38, border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)', padding:0,
                          borderColor: active ? 'var(--accent)' : 'var(--border)',
                          background: active ? '#fff3e0' : '#fff',
                          color: active ? 'var(--accent)' : 'var(--text2)',
                          fontWeight: active ? 700 : 500, fontSize:12, whiteSpace:'nowrap' }}>{p}</button>
                    )})}
                  </div>
                  {/* 적립금사용 (결제와 분리된 공제 항목) */}
                  <button type="button"
                    onClick={() => openPointsModal(l)}
                    style={{ height:38, border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)', padding:'0 6px',
                      borderColor: l.pointsUsed > 0 ? '#7b1fa2' : 'var(--border)',
                      background: l.pointsUsed > 0 ? '#f3e5f5' : '#fff',
                      color: l.pointsUsed > 0 ? '#6a1b9a' : 'var(--text2)',
                      fontWeight: l.pointsUsed > 0 ? 700 : 500, fontSize:11, whiteSpace:'nowrap', lineHeight:1.2 }}
                    title="적립금 사용">
                    {l.pointsUsed > 0
                      ? <>💳<br/>-{Number(l.pointsUsed).toLocaleString()}원</>
                      : <>💳 적립금<br/>사용</>}
                  </button>
                  {/* 택배 종류 드롭다운 */}
                  <select value={l.delivery || 'none'}
                    onChange={e => updateLine(l.id, 'delivery', e.target.value)}
                    title="택배 발송 종류"
                    style={{
                      height:38, padding:'0 6px',
                      border:'1px solid',
                      borderRadius:'var(--radius)', cursor:'pointer',
                      borderColor: l.delivery === 'none' || !l.delivery ? 'var(--border)' : '#e65100',
                      background: l.delivery === 'none' || !l.delivery ? '#fff' : '#fff3e0',
                      color: l.delivery === 'none' || !l.delivery ? 'var(--text2)' : '#e65100',
                      fontWeight: l.delivery === 'none' || !l.delivery ? 500 : 700, fontSize:12,
                      outline:'none', appearance:'auto'
                    }}>
                    <option value="none">없음</option>
                    <option value="store">매장발송</option>
                    <option value="hq">본사요청</option>
                    <option value="lecture">강좌매출</option>
                  </select>
                  {/* 추가 (마지막 라인에만) */}
                  {isLast ? (
                    <button type="button" onClick={addLine}
                      title="상품 추가"
                      style={{ height:38, width:'100%', border:'1px solid var(--accent)', background:'#fff3e0', color:'var(--accent)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:12, fontWeight:700, lineHeight:1, padding:0, whiteSpace:'nowrap' }}>상품추가</button>
                  ) : <div/>}
                  {/* ✕ 삭제 (마지막 라인이면 빈 라인으로 초기화) */}
                  <button type="button" onClick={() => removeLine(l.id)}
                    title={lines.length > 1 ? '삭제' : '초기화'}
                    style={{ height:38, width:36, border:'1px solid var(--border)', background:'#fff', color:'var(--danger)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>✕</button>
                </div>
                {/* 1개당 단가 (수량 > 1일 때) */}
                {l.productId && Number(l.quantity) > 1 && (
                  <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 1fr) 60px 100px 100px 100px 220px 110px 80px 72px 34px', gap:6, marginTop:4, fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                    <div/><div/>
                    <div style={{textAlign:'right', paddingRight:4}}>
                      {Number(l.normalPrice) > 0 && <>1개당 {Math.round(Number(l.normalPrice)).toLocaleString()}원</>}
                    </div>
                    <div/>
                    <div style={{textAlign:'right', paddingRight:4, color:'var(--accent)'}}>
                      {Number(l.price) > 0 && <>1개당 {Math.round(Number(l.price)).toLocaleString()}원</>}
                    </div>
                    <div/><div/><div/><div/>
                    <div/>
                  </div>
                )}
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

          {/* 본사 발송 배송지 (본사요청 라인이 있을 때만 표시) */}
          {lines.some(l => l.delivery === 'hq') && (
            <div style={{ background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#e65100', marginBottom:10 }}>
                📦 본사 발송 배송지 정보 *
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={labelStyle}>받는사람 *</label>
                  <input value={recipName} onChange={e => setRecipName(e.target.value)}
                    style={inputStyle} placeholder="예: 홍길동" />
                </div>
                <div>
                  <label style={labelStyle}>연락처 *</label>
                  <input value={recipPhone} onChange={e => setRecipPhone(e.target.value)}
                    style={inputStyle} placeholder="010-1234-5678" />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={labelStyle}>주소 *</label>
                <div style={{ display:'flex', gap:6 }}>
                  <input value={recipAddr} onChange={e => setRecipAddr(e.target.value)}
                    style={{...inputStyle, flex:1}} placeholder="🔍 주소검색 버튼 또는 직접 입력" />
                  <button type="button" onClick={openAddrSearch}
                    title="다음(카카오) 우편번호 검색"
                    style={{ height:38, padding:'0 14px', border:'1px solid var(--accent)', background:'#fff3e0', color:'var(--accent)', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    🔍 주소검색
                  </button>
                </div>
                <input id="recip-addr-detail" value={recipAddrDetail} onChange={e => setRecipAddrDetail(e.target.value)}
                  style={{...inputStyle, marginTop:6}} placeholder="상세주소 (동·호수 등, 선택)" />
              </div>
              <div>
                <label style={labelStyle}>요청사항</label>
                <input value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                  style={inputStyle} placeholder="예: 부재 시 경비실에 (선택)" />
              </div>
            </div>
          )}

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
                  <input value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={e => e.key==='Enter' && (e.preventDefault(), searchMembers())}
                    inputMode="numeric" maxLength={4}
                    style={{...inputStyle, flex:1}} placeholder="휴대폰 뒷 4자리 (예: 5678)" />
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
                {/* 마케팅(SMS) 수신동의 */}
                <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                  <label style={{...labelStyle, marginBottom:0}}>마케팅 수신동의</label>
                  <div style={{display:'flex', gap:6}}>
                    <button type="button" onClick={() => setCustConsent(false)}
                      style={{
                        height:34, padding:'0 16px', border:'1px solid', borderRadius:'var(--radius)',
                        fontSize:13, fontWeight:700, cursor:'pointer',
                        borderColor: !custConsent ? 'var(--text2)' : 'var(--border)',
                        background:  !custConsent ? '#eceff1' : '#fff',
                        color:       !custConsent ? 'var(--text)' : 'var(--text3)',
                      }}>미동의</button>
                    <button type="button" onClick={() => setCustConsent(true)}
                      style={{
                        height:34, padding:'0 16px', border:'1px solid', borderRadius:'var(--radius)',
                        fontSize:13, fontWeight:700, cursor:'pointer',
                        borderColor: custConsent ? 'var(--success)' : 'var(--border)',
                        background:  custConsent ? '#e8f5e9' : '#fff',
                        color:       custConsent ? 'var(--success)' : 'var(--text3)',
                      }}>동의</button>
                  </div>
                  {custConsent && (
                    <span style={{fontSize:11, color:'var(--success)', fontWeight:600}}>
                      ✅ 동의 서류를 받아 보관해주세요
                    </span>
                  )}
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
        const qty = Math.max(Number(line?.quantity)||0, 1);
        const maxAllowed = Math.max(0, (np - dc) * qty);
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
                  <div style={{fontSize:12, color:'var(--text2)', marginBottom:10}}>회원 휴대폰 뒷 4자리를 입력하세요</div>
                  <div style={{display:'flex', gap:8, marginBottom:10}}>
                    <input value={pmSearch}
                      onChange={e => setPmSearch(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      onKeyDown={e => e.key==='Enter' && (e.preventDefault(), searchPointsMember())}
                      inputMode="numeric" maxLength={4}
                      style={{...inputStyle, flex:1}} placeholder="휴대폰 뒷 4자리 (예: 5678)" autoFocus/>
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

      {/* 오늘 입력 내역 */}
      <div className="card">
        <div className="card-label">오늘 입력 내역 ({recentSales.length}건)</div>
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th>판매일</th><th>브랜드</th><th>상품명</th>
                <th className="r">수량</th><th className="r">판매가</th><th className="r">합계금액</th>
                <th>결제</th><th>출고방식</th><th>고객</th><th>메모</th><th></th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0
                ? <tr><td colSpan={11} className="empty">입력된 판매 내역이 없습니다</td></tr>
                : recentSales.map(s => {
                  const fully = (s.returned_qty||0) >= (s.quantity||0);
                  const partial = (s.returned_qty||0) > 0 && !fully;
                  const effQ = Math.max(0, (s.quantity||0) - (s.returned_qty||0));
                  const strike = fully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                  return (
                  <tr key={s.id} style={fully ? {background:'#fafafa'} : {}}>
                    <td className="mono" style={strike}>{s.sold_at}</td>
                    <td style={strike}>{s.brand?.name || '-'}</td>
                    <td style={strike}>
                      {s.product?.name || '-'}
                      {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                      {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {s.returned_qty}</span>}
                    </td>
                    <td className="r" style={strike}>{effQ}</td>
                    <td className="r" style={strike}>{Number(s.price).toLocaleString()}원</td>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', ...strike}}>{(effQ * Number(s.price||0)).toLocaleString()}원</td>
                    <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9', ...(fully?{opacity:0.5}:{})}}>{s.payment}</span></td>
                    <td style={strike}>
                      {(!s.delivery_type || s.delivery_type === 'none') && <span style={{fontSize:10, fontWeight:700, color:'#455a64', background:'#eceff1', border:'1px solid #b0bec5', padding:'1px 6px', borderRadius:3}}>매장판매</span>}
                      {s.delivery_type === 'lecture' && <span style={{fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>강좌매출</span>}
                      {s.delivery_type === 'store' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(매장)</span>}
                      {s.delivery_type === 'hq' && s.delivery_status !== 'dispatched' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(본사)</span>}
                      {s.delivery_type === 'hq' && s.delivery_status === 'dispatched' && <span style={{fontSize:10, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 6px', borderRadius:3}}>택배(본사)</span>}
                    </td>
                    <td style={{fontSize:12, ...strike}}>
                      {s.customer ? <span style={{color:'var(--success)',fontWeight:600}}>👤 {s.customer.name}</span> : '-'}
                    </td>
                    <td style={{fontSize:11,color:'var(--text2)', ...strike}}>{s.memo || '-'}</td>
                    <td><button className="btn-danger" onClick={() => handleDelete(s.id)}>삭제</button></td>
                  </tr>
                )})
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
