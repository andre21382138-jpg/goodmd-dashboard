import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { GradeBadge } from '../../lib/utils';

const PAGE_SIZE = 100;

export default function MyMembersPage({ profile }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [purchases,setPurchases]= useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [fSearch,  setFSearch]  = useState('');
  const [fMine,    setFMine]    = useState(false);
  const [page,     setPage]     = useState(0);

  // Supabase 1000행 제한 우회 — 전체 조회
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const CHUNK = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from('customers')
        .select('*')
        .eq('store_name', profile.department)
        .eq('branch_name', profile.branch)
        .order('joined_at', { ascending: false })
        .range(from, from + CHUNK - 1);
      if (error) break;
      if (!data?.length) break;
      all = all.concat(data);
      if (data.length < CHUNK) break;
      from += CHUNK;
    }
    setMembers(all);
    setLoading(false);
  }, [profile.department, profile.branch]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const fetchPurchases = async (customerId) => {
    setLoadingP(true);
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name)')
      .eq('customer_id', customerId)
      .order('sold_at', { ascending: false });
    setPurchases(data || []);
    setLoadingP(false);
  };

  const handleSelect = (m) => { setSelected(m); fetchPurchases(m.id); };

  const filtered = useMemo(() => {
    let r = members;
    if (fMine) r = r.filter(m => m.manager_name === profile.name);
    if (fSearch) {
      const q = fSearch.toLowerCase();
      r = r.filter(m => m.name.toLowerCase().includes(q) || m.phone.includes(q));
    }
    return r;
  }, [members, fSearch, fMine, profile.name]);

  useEffect(() => { setPage(0); }, [fSearch, fMine]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageMembers = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  const mineCount = useMemo(() => members.filter(m => m.manager_name === profile.name).length, [members, profile.name]);
  const totalAmt  = useMemo(() => purchases.reduce((s,r) => s + r.price * r.quantity, 0), [purchases]);
  const totalQty  = useMemo(() => purchases.reduce((s,r) => s + r.quantity, 0), [purchases]);
  const consentCount = useMemo(() => members.filter(m => m.sms_consent).length, [members]);

  return (
    <div>
      {/* 요약 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'매장 전체 회원',  value: members.length + '명' },
          { label:'내 담당 회원',    value: mineCount + '명' },
          { label:'SMS 동의',        value: consentCount + '명' },
          { label:'미동의',          value: (members.length - consentCount) + '명' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 18px' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 회원 목록 (테이블) */}
      <div className="card" style={{ padding:'16px 20px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input className="finput" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="이름 또는 연락처 검색" style={{ flex:1, maxWidth:340 }}/>
          {fSearch && <button className="btn-ghost" onClick={() => setFSearch('')}>✕</button>}
          <div style={{marginLeft:'auto', display:'flex', gap:6}}>
            <button type="button" onClick={() => setFMine(false)}
              style={{ height:34, padding:'0 14px', border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)', fontSize:12, fontWeight:700,
                borderColor: !fMine ? 'var(--accent)' : 'var(--border)',
                background: !fMine ? '#fff3e0' : '#fff',
                color: !fMine ? 'var(--accent)' : 'var(--text2)' }}>
              🏬 매장 전체 ({members.length})
            </button>
            <button type="button" onClick={() => setFMine(true)}
              style={{ height:34, padding:'0 14px', border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)', fontSize:12, fontWeight:700,
                borderColor: fMine ? 'var(--accent)' : 'var(--border)',
                background: fMine ? '#fff3e0' : '#fff',
                color: fMine ? 'var(--accent)' : 'var(--text2)' }}>
              👤 내 담당 ({mineCount})
            </button>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
          : filtered.length === 0 ? <div className="empty">등록된 회원이 없습니다</div>
          : <>
            <div style={{fontSize:11, color:'var(--text3)', marginBottom:6, textAlign:'right'}}>
              {filtered.length.toLocaleString()}명 중 {page*PAGE_SIZE+1}-{Math.min((page+1)*PAGE_SIZE, filtered.length)}
            </div>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>등급</th>
                    <th>휴대폰번호</th>
                    <th className="r">구매횟수</th>
                    <th className="r">총 구매금액</th>
                    <th className="r">사용가능 적립금</th>
                    <th>회원가입일</th>
                    <th>담당매니저</th>
                    <th style={{textAlign:'center'}}>SMS</th>
                  </tr>
                </thead>
                <tbody>
                  {pageMembers.map(m => (
                    <tr key={m.id} style={{cursor:'pointer'}} onClick={() => handleSelect(m)}>
                      <td><strong style={{fontSize:13}}>{m.name}</strong></td>
                      <td><GradeBadge grade={m.grade || '패밀리'}/></td>
                      <td className="mono" style={{fontSize:12}}>{m.phone}</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontSize:12}}>{(m.purchase_count||0).toLocaleString()}건</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontSize:12, fontWeight:600}}>{(m.total_purchase||0).toLocaleString()}원</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontSize:12, color:(m.total_points||0)>0?'var(--success)':'var(--text3)', fontWeight:700}}>{(m.total_points||0).toLocaleString()}원</td>
                      <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{m.joined_at}</td>
                      <td style={{fontSize:12}}>
                        {m.manager_name === profile.name
                          ? <span style={{fontWeight:700, color:'var(--accent)'}}>👤 내 담당</span>
                          : m.manager_name
                            ? <span style={{color:'var(--text2)'}}>{m.manager_name}</span>
                            : <span style={{color:'var(--text3)'}}>미지정</span>
                        }
                      </td>
                      <td style={{textAlign:'center'}}>
                        {m.sms_consent
                          ? <span style={{color:'var(--success)', fontWeight:700, fontSize:11}}>✅</span>
                          : <span style={{color:'var(--text3)', fontSize:11}}>미동의</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (() => {
              const delta = 4;
              let start = Math.max(0, page - delta);
              let end   = Math.min(totalPages-1, page + delta);
              if (end - start < delta*2) { start = Math.max(0, end - delta*2); end = Math.min(totalPages-1, start + delta*2); }
              const pages = []; for (let i=start; i<=end; i++) pages.push(i);
              const btn = (active, disabled) => ({
                height: 30, minWidth: 30, padding:'0 8px', border:'1px solid', borderRadius:'var(--radius)',
                fontSize: 12, fontWeight: active ? 700 : 400, cursor: disabled ? 'default' : 'pointer',
                borderColor: active ? 'var(--accent)' : 'var(--border)',
                background: active ? '#fff3e0' : '#fff',
                color: active ? 'var(--accent)' : disabled ? 'var(--text3)' : 'var(--text2)',
                opacity: disabled ? 0.5 : 1,
              });
              return (
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'14px 0', borderTop:'1px solid var(--border)', marginTop:8, flexWrap:'wrap'}}>
                  <button style={btn(false, page===0)} disabled={page===0} onClick={() => setPage(0)}>«</button>
                  <button style={btn(false, page===0)} disabled={page===0} onClick={() => setPage(page-1)}>‹</button>
                  {start > 0 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                  {pages.map(p => <button key={p} style={btn(p===page)} onClick={() => setPage(p)}>{p+1}</button>)}
                  {end < totalPages-1 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                  <button style={btn(false, page===totalPages-1)} disabled={page===totalPages-1} onClick={() => setPage(page+1)}>›</button>
                  <button style={btn(false, page===totalPages-1)} disabled={page===totalPages-1} onClick={() => setPage(totalPages-1)}>»</button>
                  <span style={{fontSize:11, color:'var(--text3)', marginLeft:8}}>{page+1} / {totalPages}페이지</span>
                </div>
              );
            })()}
          </>
        }
      </div>

      {/* 회원 상세 모달 */}
      {selected && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => setSelected(null)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(900px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div style={{padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
              <div style={{fontSize:18, fontWeight:700}}>{selected.name}</div>
              <GradeBadge grade={selected.grade || '패밀리'}/>
              <div style={{fontFamily:'var(--mono)', fontSize:13, color:'var(--text2)'}}>{selected.phone}</div>
              {selected.birthday && <div style={{fontSize:12, color:'var(--text3)'}}>🎂 {selected.birthday}</div>}
              {selected.sms_consent
                ? <span style={{ fontSize:11, color:'var(--success)', fontWeight:700 }}>✅ SMS동의</span>
                : <span style={{ fontSize:11, color:'var(--text3)' }}>SMS미동의</span>
              }
              <button onClick={() => setSelected(null)}
                style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
            </div>

            <div style={{padding:'16px 24px'}}>
              {/* 정보 */}
              <div style={{display:'flex', flexWrap:'wrap', gap:8, fontSize:12, marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--border)'}}>
                <span style={{color:'var(--text3)'}}>가입일</span><strong>{selected.joined_at}</strong>
                <span style={{color:'var(--border2)'}}>|</span>
                <span className="badge badge-dept">{selected.store_name}</span>
                <span className="badge badge-store">{selected.branch_name}</span>
                {selected.manager_name && <>
                  <span style={{color:'var(--border2)'}}>|</span>
                  <span style={{color:'var(--text3)'}}>담당</span>
                  <strong style={{color:'var(--accent)'}}>{selected.manager_name}</strong>
                </>}
              </div>

              {/* 통계 카드 - 사용가능 적립금 추가 */}
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                {[
                  { label:'구매건수',        value: purchases.length + '건' },
                  { label:'구매수량',        value: totalQty + '개' },
                  { label:'총 결제금액',     value: totalAmt.toLocaleString() + '원' },
                  { label:'사용가능 적립금', value: (selected.total_points||0).toLocaleString() + '원', color:'var(--success)' },
                ].map(s => (
                  <div key={s.label} style={{ flex:1, minWidth:140, background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', textAlign:'center' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{s.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color: s.color || 'var(--accent)', fontFamily:'var(--mono)', marginTop:4 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* 구매 이력 */}
              <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>구매 이력</div>
              {loadingP ? <div className="empty"><span className="spinner"/></div> : (
                <div className="twrap">
                  <table>
                    <thead>
                      <tr><th>구매일</th><th>브랜드</th><th>상품명</th><th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th><th>결제</th></tr>
                    </thead>
                    <tbody>
                      {purchases.length === 0
                        ? <tr><td colSpan={7} className="empty">구매 이력이 없습니다</td></tr>
                        : purchases.map(p => (
                          <tr key={p.id}>
                            <td className="mono">{p.sold_at}</td>
                            <td>{p.brand?.name||'-'}</td>
                            <td style={{fontSize:12}}>{p.product?.name||'-'}</td>
                            <td className="r">{p.quantity}</td>
                            <td className="r">{Number(p.price).toLocaleString()}</td>
                            <td className="r" style={{fontWeight:600,color:'var(--accent)'}}>{(p.price*p.quantity).toLocaleString()}</td>
                            <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>{p.payment}</span></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{marginTop:12, fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)', textAlign:'right'}}>
                총 {purchases.length}건 · {totalAmt.toLocaleString()}원
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
