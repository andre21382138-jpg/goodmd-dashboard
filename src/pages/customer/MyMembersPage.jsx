import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

export default function MyMembersPage({ profile }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [purchases,setPurchases]= useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [fSearch,  setFSearch]  = useState('');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('customers')
      .select('*')
      .eq('manager_name', profile.name)
      .order('joined_at', { ascending: false });
    setMembers(data || []);
    setLoading(false);
  }, [profile.name]);

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
    if (!fSearch) return members;
    const q = fSearch.toLowerCase();
    return members.filter(m => m.name.toLowerCase().includes(q) || m.phone.includes(q));
  }, [members, fSearch]);

  const totalAmt = useMemo(() => purchases.reduce((s,r) => s + r.price * r.quantity, 0), [purchases]);
  const totalQty = useMemo(() => purchases.reduce((s,r) => s + r.quantity, 0), [purchases]);

  const consentCount = useMemo(() => members.filter(m => m.sms_consent).length, [members]);

  return (
    <div>
      {/* 요약 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'총 회원수',      value: members.length + '명' },
          { label:'SMS 동의 회원',  value: consentCount + '명' },
          { label:'미동의 회원',    value: (members.length - consentCount) + '명' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 18px' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap:16 }}>
        {/* 회원 목록 */}
        <div className="card" style={{ padding:'16px 18px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <input className="finput" value={fSearch} onChange={e => setFSearch(e.target.value)}
              placeholder="이름 또는 연락처 검색" style={{ flex:1 }}/>
            {fSearch && <button className="btn-ghost" onClick={() => setFSearch('')}>✕</button>}
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div>
            : filtered.length === 0 ? <div className="empty">등록된 회원이 없습니다</div>
            : filtered.map(m => (
              <div key={m.id} onClick={() => handleSelect(m)}
                style={{
                  padding:'11px 12px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:4,
                  background: selected?.id===m.id ? '#fff8e1' : 'var(--bg3)',
                  border: `1px solid ${selected?.id===m.id ? '#ffcc80' : 'transparent'}`,
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <strong style={{ fontSize:13 }}>{m.name}</strong>
                  <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>{m.joined_at}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)', marginTop:2 }}>{m.phone}</div>
                <div style={{ display:'flex', gap:6, marginTop:5, alignItems:'center' }}>
                  <span className="badge badge-dept" style={{fontSize:10}}>{m.store_name}</span>
                  <span className="badge badge-store" style={{fontSize:10}}>{m.branch_name}</span>
                  <span style={{ fontSize:10, marginLeft:'auto', color: m.sms_consent ? 'var(--success)' : 'var(--text3)', fontWeight:600 }}>
                    {m.sms_consent ? '✅ SMS동의' : 'SMS미동의'}
                  </span>
                </div>
              </div>
            ))
          }
        </div>

        {/* 구매 이력 */}
        {selected && (
          <div className="card">
            <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ fontSize:16, fontWeight:700 }}>{selected.name}</div>
                <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)' }}>{selected.phone}</div>
                {selected.sms_consent
                  ? <span style={{ marginLeft:'auto', fontSize:11, color:'var(--success)', fontWeight:700 }}>✅ SMS동의</span>
                  : <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)' }}>SMS미동의</span>
                }
              </div>
              <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12 }}>
                가입일 <strong>{selected.joined_at}</strong> · <span className="badge badge-dept">{selected.store_name}</span> <span className="badge badge-store">{selected.branch_name}</span>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                {[
                  { label:'구매건수', value: purchases.length + '건' },
                  { label:'구매수량', value: totalQty + '개' },
                  { label:'총 결제금액', value: totalAmt.toLocaleString() + '원' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'7px 14px', textAlign:'center' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{s.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-label">구매 이력</div>
            {loadingP ? <div className="empty"><span className="spinner"/></div> : (
              <div className="twrap">
                <table>
                  <thead>
                    <tr><th>구매일</th><th>점포</th><th>지점</th><th>상품명</th><th className="r">수량</th><th className="r">합계</th><th>결제</th></tr>
                  </thead>
                  <tbody>
                    {purchases.length === 0
                      ? <tr><td colSpan={7} className="empty">구매 이력이 없습니다</td></tr>
                      : purchases.map(p => (
                        <tr key={p.id}>
                          <td className="mono">{p.sold_at}</td>
                          <td><span className="badge badge-dept">{p.store_name}</span></td>
                          <td><span className="badge badge-store">{p.branch_name}</span></td>
                          <td style={{fontSize:12}}>{p.product?.name||'-'}</td>
                          <td className="r">{p.quantity}</td>
                          <td className="r" style={{fontWeight:600,color:'var(--accent)'}}>{(p.price*p.quantity).toLocaleString()}</td>
                          <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>{p.payment}</span></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
            <button className="btn btn-s" style={{marginTop:12, fontSize:11}} onClick={() => setSelected(null)}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}
