import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, GradeBadge, formatNumInput, parseNumInput } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP, CLAIM_TYPES } from '../../lib/constants';
import HqReturnTab from './HqReturnTab';
import ClaimActionPicker, { getRetAction, emptyClaimAction } from './ClaimActionPicker';
import { ReturnModal, ExchangeModal } from './MemberClaimModals';

export default function SalesReturnPage({ profile }) {
  // 본사 계정(매니저가 아닌 admin/hq)이면 점포·지점을 직접 선택해 매장 반품 접수
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore,  setHqStore]  = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const hqBranchOptions = useMemo(() => hqStore ? (STORE_MAP[hqStore] || []) : [], [hqStore]);

  const today = new Date().toISOString().slice(0, 10);
  const [tab,      setTab]      = useState('search'); // 'search' | 'manual'
  const [searchMode, setSearchMode] = useState('date'); // 'date' | 'customer'
  const [fFrom,    setFFrom]    = useState(today);
  const [fTo,      setFTo]      = useState(today);
  const [fSearch,  setFSearch]  = useState('');
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  // 회원반품: 주문건별 [반품]/[교환] 팝업
  const [modalOrder, setModalOrder] = useState(null);
  const [modalType, setModalType]   = useState(null); // 'return' | 'exchange'
  const openModal  = (o, type) => { setModalOrder(o); setModalType(type); };
  const closeModal = () => { setModalOrder(null); setModalType(null); };
  const afterDone  = () => { closeModal(); fetchOrders(); };

  // 직접입력 탭
  const [allProducts, setAllProducts] = useState([]);
  const [mDate,    setMDate]    = useState('');   // 원 판매일 (선택 · 모를 수 있음)
  const [mReturnDate, setMReturnDate] = useState(today); // 반품 날짜 → 음수 매출 row의 sold_at
  const [mSearch,  setMSearch]  = useState('');
  const [mProduct, setMProduct] = useState(null); // {id, name, code, brand_id}
  const [mShowSug, setMShowSug] = useState(false);
  const [mQty,     setMQty]     = useState(1);
  const [mRefund,  setMRefund]  = useState('');   // 환불 합계(직접 입력, 독립값)
  const [mMemo,    setMMemo]    = useState('');
  const [mSaving,  setMSaving]  = useState(false);
  // 비회원반품 클레임 사유 (선택)
  const [mClaimType, setMClaimType]     = useState('');
  const [mClaimCustom, setMClaimCustom] = useState('');
  const [mClaimDetail, setMClaimDetail] = useState('');
  const [mAction, setMAction]           = useState(emptyClaimAction());
  const mActObj = getRetAction(mAction.action_type);

  useEffect(() => {
    if (tab === 'manual' && allProducts.length === 0) {
      supabase.from('products').select('id, name, code, brand_id, price').order('name')
        .then(({ data }) => setAllProducts(data || []));
    }
  }, [tab, allProducts.length]);

  // 바코드 스캐너
  // - manual(직접입력) 탭: 스캔 → 상품 자동 선택 + 단가 기본값
  // - search(반품접수) 탭: 스캔 처리는 없지만 input에 들어간 꼬리 코드를 자동 제거 (안전망)
  const scanBufRef = useRef({ chars: '', lastTime: 0, startTime: 0 });
  useEffect(() => {
    // search 탭은 allProducts 없이도 동작 (input 꼬리 제거만), manual 탭은 allProducts 필요
    if (tab === 'manual' && allProducts.length === 0) return;
    const handler = (e) => {
      if (tab === 'hq') return; // 본사 반품 탭은 자체 입력으로 스캔 처리
      const tg = (e.target?.tagName || '').toLowerCase();
      const isInputFocused = tg === 'input' || tg === 'textarea' || tg === 'select';
      // manual 탭은 input 포커스 중엔 무시(직접 타이핑과 충돌 방지)
      if (tab === 'manual' && isInputFocused) return;
      const now = Date.now();
      const buf = scanBufRef.current;
      if (e.key === 'Enter') {
        const code = buf.chars.trim();
        const elapsed = now - buf.startTime;
        buf.chars = ''; buf.lastTime = 0; buf.startTime = 0;
        if (code.length >= 3 && elapsed < 800) {
          e.preventDefault();
          if (tab === 'manual') {
            const matched = allProducts.find(p => String(p.code || '').trim() === code);
            if (!matched) {
              toast(`상품 매칭 실패 — 코드: ${code}`, 'err');
              return;
            }
            setMProduct({ id: matched.id, name: matched.name, code: matched.code, brand_id: matched.brand_id });
            setMSearch(matched.name);
            if (matched.price) setMRefund(String(matched.price * (Number(mQty)||1)));
            toast(`📷 ${matched.name} 선택됨`, 'ok');
          } else if (tab === 'search') {
            // 반품접수 탭 안전망 — 포커스된 input에 들어간 스캔 꼬리 코드 자동 제거
            if (isInputFocused) {
              const el = document.activeElement;
              if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                const v = el.value || '';
                if (v.endsWith(code)) {
                  const nativeSetter = Object.getOwnPropertyDescriptor(
                    el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
                    'value'
                  )?.set;
                  const newVal = v.slice(0, -code.length);
                  if (nativeSetter) {
                    nativeSetter.call(el, newVal);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                  } else {
                    el.value = newVal;
                  }
                }
              }
            }
            toast('📷 회원반품 탭에서는 스캔이 동작하지 않습니다 — [비회원반품] 탭에서 사용해주세요', 'inf');
          }
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
  }, [tab, allProducts]);

  const fetchOrders = useCallback(async () => {
    // 본사 계정인데 점포/지점 미선택이면 조회 자체를 시도하지 않음
    if (!storeName || !branchName) {
      setOrders([]); setLoading(false); return;
    }
    // 고객정보 조회 모드인데 검색어가 비어있으면 조회 안 함
    if (searchMode === 'customer' && !fSearch.trim()) {
      setOrders([]); setLoading(false);
      toast('고객 이름 또는 연락처를 입력해주세요', 'inf');
      return;
    }
    setLoading(true);
    let q = supabase.from('sales')
      .select('*, product:products(name,code), brand:brands(name), customer:customers(id,name,phone,total_points,used_points,total_purchase,grade)')
      .neq('payment', '구매이력')
      .eq('store_name', storeName)
      .eq('branch_name', branchName)
      .order('sold_at', { ascending: false })
      .order('created_at', { ascending: false });
    // 날짜 조회 모드일 때만 기간 필터 (고객 조회는 전체 기간)
    if (searchMode === 'date') {
      if (fFrom) q = q.gte('sold_at', fFrom);
      if (fTo)   q = q.lte('sold_at', fTo);
    }
    const { data, error } = await q;
    if (error) { toast(error.message, 'err'); setLoading(false); return; }

    // 회원반품 탭: 회원 구매건(customer_id 있음)만, 반품 음수 row 제외
    const active = (data || []).filter(s =>
      (s.quantity - (s.returned_qty||0)) > 0 &&
      s.customer_id &&
      s.payment !== '반품' &&
      (Number(s.price) || 0) >= 0
    );
    let filtered = active;
    if (searchMode === 'customer' && fSearch.trim()) {
      const q2 = fSearch.toLowerCase();
      filtered = filtered.filter(s =>
        (s.customer?.name||'').toLowerCase().includes(q2) ||
        (s.customer?.phone||'').includes(fSearch)
      );
    }
    const grouped = {};
    for (const s of filtered) {
      const key = s.customer_id ? `c-${s.customer_id}-${s.sold_at}` : `s-${s.id}`;
      if (!grouped[key]) grouped[key] = { key, customer: s.customer, customerId: s.customer_id, sold_at: s.sold_at, items: [] };
      grouped[key].items.push(s);
    }
    const list = Object.values(grouped).sort((a,b) => b.sold_at.localeCompare(a.sold_at));
    setOrders(list);
    setLoading(false);
  }, [storeName, branchName, fFrom, fTo, fSearch, searchMode]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const orderTotal = (o) => o.items.reduce((s,i) => {
    const remain = i.quantity - (i.returned_qty||0);
    return s + (i.price * remain);
  }, 0);

  const orderQty = (o) => o.items.reduce((s,i) => s + (i.quantity - (i.returned_qty||0)), 0);

  // 매장재고 반영 (교환·증정 조치용)
  const applyStockMovements = async (movements, sName, bName) => {
    for (const m of (movements || [])) {
      if (!m.code || !m.delta) continue;
      const { data: row } = await supabase.from('store_stock').select('id, stock_qty')
        .eq('store_name', sName).eq('branch_name', bName).eq('product_code', m.code).maybeSingle();
      if (row) await supabase.from('store_stock').update({ stock_qty: (row.stock_qty || 0) + m.delta, updated_at: new Date().toISOString() }).eq('id', row.id);
      else await supabase.from('store_stock').insert({ store_name: sName, branch_name: bName, product_code: m.code, product_name: m.name || null, stock_qty: m.delta, updated_at: new Date().toISOString() });
    }
  };
  // store_claims 기록 (실패해도 처리 자체는 막지 않음)
  const insertClaim = async (row) => {
    try { await supabase.from('store_claims').insert({ ...row, created_by: profile?.id || null }); }
    catch (e) { /* ignore */ }
  };
  // 환불(반품) 건에 사유가 입력된 경우만 클레임 기록 (재고·매출은 반품 로직이 처리 → movements 비움)
  const recordRefundClaim = async ({ claimType, claimDetail, customer, productName, productCode, sName, bName }) => {
    const ct = (claimType || '').trim();
    if (!ct) return; // 사유 미입력 = 일반 반품, 클레임 기록 안 함
    await insertClaim({
      store_name: sName, branch_name: bName, worker_name: null,
      customer_name: customer?.name || null, customer_phone: customer?.phone || null, customer_id: customer?.id || null,
      product_name: productName || null, product_code: productCode || null,
      claim_type: ct, claim_detail: (claimDetail || '').trim() || null,
      status: '완료', action_type: '환불', source: '반품', stock_movements: [],
    });
  };

  // 직접입력 반품 처리
  const handleManualReturn = async () => {
    if (!isStoreMgr && (!storeName || !branchName)) {
      toast('점포와 지점을 먼저 선택해주세요', 'err'); return;
    }
    if (!mProduct) { toast('상품을 선택해주세요', 'err'); return; }
    const qty = Number(mQty) || 0;
    if (qty <= 0)  { toast('수량을 입력해주세요', 'err'); return; }
    const mType = mClaimType === '직접입력' ? mClaimCustom.trim() : mClaimType;

    // ===== 교환·증정·본사처리 — 매출/적립금 변화 없이 재고만 반영 + 클레임 기록 =====
    if (!mActObj.refund) {
      if (mActObj.needEx && !mAction.exchange.code) { toast('교환할 다른상품을 선택해주세요', 'err'); return; }
      if (mActObj.needGift && !mAction.gift.code) { toast('서비스증정 상품을 선택해주세요', 'err'); return; }
      const exQty = Number(mAction.exchange.qty) || qty;
      const giftQty = Number(mAction.gift.qty) || 1;
      const movements = [];
      if (mActObj.needEx) {
        if (mProduct.code) movements.push({ code: mProduct.code, name: mProduct.name, delta: qty });
        movements.push({ code: mAction.exchange.code, name: mAction.exchange.name, delta: -exQty });
      }
      if (mActObj.needGift) movements.push({ code: mAction.gift.code, name: mAction.gift.name, delta: -giftQty });
      if (!window.confirm(`${mAction.action_type} 처리하시겠습니까?\n\n회수상품: ${mProduct.name} ×${qty}` +
        (mActObj.needEx ? `\n교환상품: ${mAction.exchange.name} (−${exQty})` : '') +
        (mActObj.needGift ? `\n증정상품: ${mAction.gift.name} (−${giftQty})` : '') +
        `\n\n※ 매출·적립금 변화 없음 · 클레임 현황에 기록됩니다`)) return;
      setMSaving(true);
      try {
        await applyStockMovements(movements, storeName, branchName);
        await insertClaim({
          store_name: storeName, branch_name: branchName, worker_name: null,
          customer_name: null, customer_phone: null, customer_id: null,
          product_name: mProduct.name, product_code: mProduct.code || null,
          claim_type: mType || null, claim_detail: mClaimDetail.trim() || null,
          status: mAction.action_type === '본사처리필요' ? '본사확인' : '완료',
          action_type: mAction.action_type,
          exchange_product_name: mAction.exchange.name || null, exchange_product_code: mAction.exchange.code || null,
          gift_product_name: mAction.gift.name || null, gift_product_code: mAction.gift.code || null,
          source: '교환·증정', stock_movements: movements,
        });
        toast(`${mAction.action_type} 처리 완료`, 'ok');
        setMProduct(null); setMSearch(''); setMQty(1); setMRefund(''); setMMemo(''); setMDate(''); setMReturnDate(today);
        setMClaimType(''); setMClaimCustom(''); setMClaimDetail(''); setMAction(emptyClaimAction());
      } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
      setMSaving(false);
      return;
    }

    // ===== 환불(반품) — 기존 로직 (음수 매출·재고 복구) =====
    const refundTotal = Number(parseNumInput(mRefund)) || 0;
    if (refundTotal < 0) { toast('환불 합계를 확인해주세요', 'err'); return; }
    if (!mReturnDate) { toast('반품 날짜를 선택해주세요', 'err'); return; }
    if (!window.confirm(`비회원 반품 처리하시겠습니까?\n\n반품 날짜: ${mReturnDate}\n원 판매일: ${mDate || '미상'}\n상품: ${mProduct.name}\n수량: ${qty}개\n환불 합계: ${refundTotal.toLocaleString()}원`)) return;

    setMSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const unitPrice = qty > 0 ? refundTotal / qty : refundTotal; // 합계 = 수량 × 단가가 정확히 맞도록
      // 수기 반품도 음수 매출 row로 저장 — sold_at은 '반품 날짜' (매출조회에 반품일로 잡힘)
      const { error } = await supabase.from('sales').insert({
        sold_at: mReturnDate,
        store_name: storeName,
        branch_name: branchName,
        brand_id: mProduct.brand_id,
        product_id: mProduct.id,
        quantity: qty,
        price: -Math.abs(unitPrice),
        payment: '반품',
        memo: `비회원 반품 접수 (원 판매일 ${mDate || '미상'})` + (mMemo.trim() ? ` · ${mMemo.trim()}` : ''),
        created_by: profile.id,
        returned_qty: 0,
        returned_at: nowIso,
        points_earned: 0,
        points_used: 0,
      });
      if (error) throw error;

      // 매장재고 복구
      if (mProduct.code) {
        const { data: stockRow } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name',  storeName)
          .eq('branch_name', branchName)
          .eq('product_code', mProduct.code)
          .maybeSingle();
        if (stockRow) {
          await supabase.from('store_stock').update({
            stock_qty: (stockRow.stock_qty||0) + qty,
            updated_at: nowIso,
          }).eq('id', stockRow.id);
        }
      }

      // 반품 사유 입력 시 클레임 현황에 기록
      await recordRefundClaim({
        claimType: mType, claimDetail: mClaimDetail,
        customer: null,
        productName: mProduct.name, productCode: mProduct.code || null,
        sName: storeName, bName: branchName,
      });

      toast('수기 반품 접수 완료', 'ok');
      setMProduct(null); setMSearch(''); setMQty(1); setMRefund(''); setMMemo(''); setMDate(''); setMReturnDate(today);
      setMClaimType(''); setMClaimCustom(''); setMClaimDetail(''); setMAction(emptyClaimAction());
    } catch (err) {
      toast('반품 실패: ' + err.message, 'err');
    }
    setMSaving(false);
  };

  // 직접입력 상품 검색 결과
  const mSuggestions = useMemo(() => {
    if (!mSearch || mSearch.length < 1) return [];
    const q = mSearch.toLowerCase();
    return allProducts
      .filter(p => (p.name||'').toLowerCase().includes(q)
                || (p.code||'').toLowerCase().includes(q))
      .slice(0, 10);
  }, [mSearch, allProducts]);

  return (
    <div>
      {/* 탭 */}
      <div className="tabs">
        <button className={`tab ${tab==='search'?'on':''}`} onClick={() => setTab('search')}>회원반품</button>
        <button className={`tab ${tab==='manual'?'on':''}`} onClick={() => setTab('manual')}>비회원반품</button>
        <button className={`tab ${tab==='hq'?'on':''}`} onClick={() => setTab('hq')}>본사 반품</button>
      </div>

      {tab === 'hq' && <HqReturnTab profile={profile}/>}

      {tab === 'search' && (<>
      {/* 필터 */}
      <div className="card">
        <div className="card-label">반품 접수</div>
        {isStoreMgr ? (
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, fontFamily:'var(--mono)' }}>
            📍 {profile.department} · {profile.branch}
          </div>
        ) : (
          <div style={{display:'flex', gap:10, marginBottom:12, flexWrap:'wrap'}}>
            <select className="fsel" value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }}>
              <option value="">점포 선택</option>
              {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="fsel" value={hqBranch} onChange={e => setHqBranch(e.target.value)}
              disabled={!hqStore} style={{background:!hqStore?'#f0f0f0':'#fff'}}>
              <option value="">{hqStore ? '지점 선택' : '먼저 점포 선택'}</option>
              {hqBranchOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {(!storeName || !branchName) && (
              <span style={{fontSize:11, color:'var(--danger)', alignSelf:'center'}}>※ 점포·지점을 선택하면 매출 조회가 시작됩니다</span>
            )}
          </div>
        )}
        {/* 조회 모드 토글 */}
        <div style={{display:'flex', gap:6, marginBottom:10}}>
          <button type="button" onClick={() => setSearchMode('date')}
            style={{height:34, padding:'0 14px', border:'1px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
              borderColor: searchMode==='date' ? 'var(--accent)' : 'var(--border)',
              background: searchMode==='date' ? '#fff3e0' : '#fff',
              color: searchMode==='date' ? 'var(--accent)' : 'var(--text2)'}}>
            📅 날짜로 조회
          </button>
          <button type="button" onClick={() => setSearchMode('customer')}
            style={{height:34, padding:'0 14px', border:'1px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
              borderColor: searchMode==='customer' ? 'var(--accent)' : 'var(--border)',
              background: searchMode==='customer' ? '#fff3e0' : '#fff',
              color: searchMode==='customer' ? 'var(--accent)' : 'var(--text2)'}}>
            👤 고객정보로 조회
          </button>
        </div>

        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          {searchMode === 'date' ? (
            <>
              <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="판매일 시작"/>
              <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
              <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="판매일 종료"/>
              <button className="btn btn-s" onClick={() => { setFFrom(today); setFTo(today); }}>오늘</button>
            </>
          ) : (
            <input className="finput" value={fSearch} onChange={e => setFSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOrders()}
              placeholder="고객명 또는 연락처 입력" style={{flex:'1 1 280px'}} autoFocus/>
          )}
          <div className="fbar-right">
            <button className="btn btn-p" onClick={fetchOrders} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔍 조회'}
            </button>
          </div>
        </div>
        <div style={{fontSize:11, color:'var(--text3)', marginTop:6}}>
          {searchMode === 'date'
            ? '💡 선택한 기간에 판매된 회원 구매내역을 조회합니다'
            : '💡 해당 고객의 전체 기간 구매내역을 조회합니다'}
        </div>
      </div>

      {/* 주문 목록 */}
      {orders.length === 0 && !loading && (
        <div className="empty">
          해당 조건의 주문이 없습니다<br/>
          <span style={{fontSize:11, color:'var(--text3)'}}>날짜와 고객을 입력 후 조회해주세요</span>
        </div>
      )}
      {orders.length > 0 && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{marginBottom:12}}>
            <span className="fresult">총 <b>{orders.length}</b>건의 주문</span>
            <span style={{fontSize:11, color:'var(--text3)', marginLeft:8}}>(주문건별 [반품]/[교환] 버튼으로 처리)</span>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>판매일</th>
                  <th>고객</th>
                  <th>등급</th>
                  <th>연락처</th>
                  <th className="r">상품수</th>
                  <th className="r">총수량</th>
                  <th className="r">미반품 잔여금액</th>
                  <th style={{textAlign:'center', width:160}}>처리</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.key}>
                    <td className="mono">{o.sold_at}</td>
                    <td><strong>{o.customer?.name || <span style={{color:'var(--text3)'}}>비회원</span>}</strong></td>
                    <td>{o.customer?.grade ? <GradeBadge grade={o.customer.grade}/> : '-'}</td>
                    <td className="mono" style={{fontSize:12}}>{o.customer?.phone || '-'}</td>
                    <td className="r" style={{fontFamily:'var(--mono)'}}>{o.items.length}개</td>
                    <td className="r" style={{fontFamily:'var(--mono)'}}>{orderQty(o)}개</td>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{orderTotal(o).toLocaleString()}원</td>
                    <td style={{textAlign:'center', whiteSpace:'nowrap'}}>
                      <button type="button" onClick={() => openModal(o, 'return')}
                        style={{height:30, padding:'0 14px', border:'1px solid var(--accent)', borderRadius:6, background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer'}}>반품</button>
                      <button type="button" onClick={() => openModal(o, 'exchange')}
                        style={{marginLeft:6, height:30, padding:'0 14px', border:'1px solid var(--accent)', borderRadius:6, background:'#fff', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer'}}>교환</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 반품/교환 팝업 */}
      {modalOrder && modalType === 'return' && (
        <ReturnModal order={modalOrder} storeName={storeName} branchName={branchName} profile={profile} onClose={closeModal} onDone={afterDone} />
      )}
      {modalOrder && modalType === 'exchange' && (
        <ExchangeModal order={modalOrder} storeName={storeName} branchName={branchName} profile={profile} onClose={closeModal} onDone={afterDone} />
      )}
      </>)}

      {tab === 'manual' && (
        <div className="card">
          <div className="card-label">직접 입력 반품</div>
          {isStoreMgr ? (
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:14, fontFamily:'var(--mono)' }}>
              📍 {profile.department} · {profile.branch}
            </div>
          ) : (
            <div style={{display:'flex', gap:10, marginBottom:14, flexWrap:'wrap'}}>
              <select className="fsel" value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }}>
                <option value="">점포 선택</option>
                {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="fsel" value={hqBranch} onChange={e => setHqBranch(e.target.value)}
                disabled={!hqStore} style={{background:!hqStore?'#f0f0f0':'#fff'}}>
                <option value="">{hqStore ? '지점 선택' : '먼저 점포 선택'}</option>
                {hqBranchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {(!storeName || !branchName) && (
                <span style={{fontSize:11, color:'var(--danger)', alignSelf:'center'}}>※ 점포·지점을 선택하면 매장재고가 복구될 매장이 결정됩니다</span>
              )}
            </div>
          )}
          <div style={{background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, fontSize:12, color:'#6d4c41'}}>
            💡 비회원 구매건 반품 — 판매일자·상품·수량·환불합계·반품일자를 입력해 접수합니다.
            처리 시 매장재고는 자동 복구됩니다.
          </div>

          {/* 세로 배치: 판매일자 → 상품검색 → 수량 → 환불합계 → 반품일자 → 접수 */}
          <div style={{display:'flex', flexDirection:'column', gap:14, maxWidth:520}}>
            {/* 1) 판매일자 (선택) */}
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>① 판매일자 <span style={{color:'var(--text3)', fontWeight:400}}>(선택 · 모르면 비워두기)</span></label>
              <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
                style={{width:'100%', height:40, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:14, outline:'none', boxSizing:'border-box'}}/>
            </div>

            {/* 2) 상품 검색 */}
            <div style={{position:'relative'}}>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>② 상품 검색</label>
              <input
                value={mProduct ? mProduct.name : mSearch}
                onChange={e => { setMSearch(e.target.value); setMProduct(null); setMShowSug(true); }}
                onFocus={() => setMShowSug(true)}
                onBlur={() => setTimeout(() => setMShowSug(false), 200)}
                style={{width:'100%', height:40, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:14, outline:'none', boxSizing:'border-box', background:'#fff'}}
                placeholder="상품명 또는 상품코드로 검색"
                autoComplete="off"
              />
              {mShowSug && mSuggestions.length > 0 && !mProduct && (
                <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:240, overflowY:'auto', marginTop:2}}>
                  {mSuggestions.map(p => (
                    <div key={p.id}
                      onMouseDown={e => { e.preventDefault(); setMProduct(p); setMSearch(p.name); setMShowSug(false); if (p.price) setMRefund(String(p.price * (Number(mQty)||1))); }}
                      style={{padding:'9px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f7fa'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                      <div>{p.name}</div>
                      <div style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>
                        {p.code && <span>코드: {p.code}</span>}
                        {p.price && <span style={{marginLeft:10}}>판매가: {Number(p.price).toLocaleString()}원</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {mProduct && (
                <div style={{marginTop:4, fontSize:11, color:'var(--success)', fontWeight:600}}>
                  ✅ {mProduct.name} {mProduct.code && <span style={{color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:6}}>({mProduct.code})</span>}
                </div>
              )}
            </div>

            {/* 3) 수량 */}
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>③ 수량</label>
              <input type="number" min={1} value={mQty} onChange={e => setMQty(e.target.value)}
                style={{width:'100%', height:40, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:14, outline:'none', boxSizing:'border-box', textAlign:'right'}}/>
            </div>

            {/* 처리방법 (환불/교환/증정/본사) */}
            <ClaimActionPicker value={mAction} onChange={setMAction}
              returnedItems={mProduct ? [{ name: mProduct.name, code: mProduct.code, qty: Number(mQty) || 0 }] : []} />

            {mActObj.refund && (<>
            {/* 4) 환불 합계 (직접 입력) */}
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:700, color:'#e65100', marginBottom:5}}>④ 환불 합계</label>
              <input type="text" inputMode="numeric" value={formatNumInput(mRefund)}
                onChange={e => setMRefund(parseNumInput(e.target.value))}
                style={{width:'100%', height:44, padding:'0 14px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:16, fontWeight:700, fontFamily:'var(--mono)', outline:'none', boxSizing:'border-box', textAlign:'right', background:'#fff3e0', color:'var(--accent)'}}
                placeholder="0"/>
            </div>

            {/* 5) 반품 날짜 */}
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:700, color:'#e65100', marginBottom:5}}>⑤ 📅 반품 날짜</label>
              <input type="date" value={mReturnDate} onChange={e => setMReturnDate(e.target.value)}
                style={{width:'100%', height:40, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:14, fontWeight:700, color:'var(--accent)', outline:'none', boxSizing:'border-box', background:'#fff3e0'}}/>
            </div>
            </>)}

            {/* 메모 */}
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>메모 (선택)</label>
              <input value={mMemo} onChange={e => setMMemo(e.target.value)}
                style={{width:'100%', height:40, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:14, outline:'none', boxSizing:'border-box'}}
                placeholder="반품 사유 등"/>
            </div>

            {/* 클레임 사유 (선택 — 입력 시 클레임 현황에 기록) */}
            <div style={{padding:'12px 14px', background:'#f3e5f5', border:'1px solid #ce93d8', borderRadius:'var(--radius)'}}>
              <label style={{display:'block', fontSize:11, fontWeight:700, color:'#6a1b9a', marginBottom:5}}>📣 클레임 사유 <span style={{color:'var(--text3)', fontWeight:400}}>(단순변심은 현황 미기록 · 품질불만 등 선택 시 기록)</span></label>
              <select value={mClaimType} onChange={e => setMClaimType(e.target.value)}
                style={{width:'100%', height:38, padding:'0 10px', border:'1px solid #ce93d8', borderRadius:'var(--radius)', fontSize:14, background:'#fff', outline:'none', boxSizing:'border-box'}}>
                <option value="">단순변심</option>{CLAIM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              {mClaimType === '직접입력' && (
                <input value={mClaimCustom} onChange={e => setMClaimCustom(e.target.value)} placeholder="사유 직접 입력"
                  style={{width:'100%', height:38, padding:'0 10px', border:'1px solid #ce93d8', borderRadius:'var(--radius)', fontSize:14, background:'#fff', outline:'none', boxSizing:'border-box', marginTop:8}}/>
              )}
              {mClaimType && (
                <input value={mClaimDetail} onChange={e => setMClaimDetail(e.target.value)} placeholder="상세내용 (선택)"
                  style={{width:'100%', height:38, padding:'0 10px', border:'1px solid #ce93d8', borderRadius:'var(--radius)', fontSize:14, background:'#fff', outline:'none', boxSizing:'border-box', marginTop:8}}/>
              )}
            </div>

            <button className="btn btn-p" disabled={mSaving || !mProduct || !mQty || (mActObj.refund && mRefund === '')}
              style={{width:'100%', justifyContent:'center', height:46, fontWeight:700, fontSize:15}}
              onClick={handleManualReturn}>
              {mSaving ? <span className="spinner"/> : (mActObj.refund ? '↩️ 반품 접수' : `✓ ${mAction.action_type} 접수`)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
