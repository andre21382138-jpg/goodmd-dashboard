import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { STORE_MAP, STORE_NAMES } from '../../lib/constants';
import { toast } from '../../lib/utils';

export default function StoreInfoPage() {
  const [addresses, setAddresses] = useState([]);   // store_addresses rows
  const [loading,   setLoading]   = useState(true);
  const [fStore,    setFStore]    = useState('');
  const [fKeyword,  setFKeyword]  = useState('');
  const [editing,    setEditing]    = useState(null);  // {key, store_name, branch_name, ...} | null
  const [eForm,      setEForm]      = useState({ shopping_mall_id:'', postal_code:'', address:'', recipient_phone:'' });
  const [saving,     setSaving]     = useState(false);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('store_addresses').select('*');
    if (error) toast(error.message, 'err');
    else setAddresses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const openEdit = (row) => {
    setEditing(row);
    setEForm({
      shopping_mall_id: row.shopping_mall_id || '',
      postal_code:      row.postal_code || '',
      address:          row.address || '',
      recipient_phone:  row.recipient_phone || '',
    });
  };
  const closeEdit = () => { setEditing(null); setSaving(false); };

  const saveEdit = async () => {
    if (!editing) return;
    if (!eForm.shopping_mall_id.trim()) { toast('쇼핑몰ID는 필수입니다', 'err'); return; }
    setSaving(true);
    const payload = {
      store_name:  editing.store_name,
      branch_name: editing.branch_name,
      shopping_mall_id: eForm.shopping_mall_id.trim(),
      postal_code:      eForm.postal_code.trim() || null,
      address:          eForm.address.trim() || null,
      recipient_phone:  eForm.recipient_phone.trim() || null,
      updated_at:       new Date().toISOString(),
    };
    const { error } = await supabase.from('store_addresses')
      .upsert(payload, { onConflict: 'store_name,branch_name' });
    setSaving(false);
    if (error) { toast(error.message, 'err'); return; }
    toast('저장 완료', 'ok');
    closeEdit();
    fetchAddresses();
  };

  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => { if (e.key === 'Escape') closeEdit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const allRows = useMemo(() => {
    const addrMap = new Map();
    for (const a of addresses) {
      addrMap.set(`${a.store_name}|${a.branch_name}`, a);
    }
    const rows = [];
    for (const store_name of STORE_NAMES) {
      for (const branch_name of STORE_MAP[store_name]) {
        const key = `${store_name}|${branch_name}`;
        const addr = addrMap.get(key) || null;
        const complete = !!(addr && addr.shopping_mall_id && addr.postal_code && addr.address && addr.recipient_phone);
        rows.push({
          key, store_name, branch_name,
          shopping_mall_id: addr?.shopping_mall_id || '',
          postal_code: addr?.postal_code || '',
          address: addr?.address || '',
          recipient_phone: addr?.recipient_phone || '',
          complete, addr,
        });
      }
    }
    return rows;
  }, [addresses]);

  const filtered = useMemo(() => {
    let r = allRows;
    if (fStore) r = r.filter(x => x.store_name === fStore);
    if (fKeyword.trim()) {
      const kw = fKeyword.toLowerCase();
      r = r.filter(x =>
        x.branch_name.toLowerCase().includes(kw) ||
        x.shopping_mall_id.toLowerCase().includes(kw)
      );
    }
    return r;
  }, [allRows, fStore, fKeyword]);

  const completeCount = useMemo(() => allRows.filter(r => r.complete).length, [allRows]);

  return (
    <>
      <div className="card">
      <div className="card-label">매장 정보</div>
      <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
        <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
          <option value="">전체 백화점</option>
          {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="finput" value={fKeyword} onChange={e => setFKeyword(e.target.value)}
          placeholder="🔍 점포명·쇼핑몰ID 검색" style={{minWidth:240}}/>
        {(fStore || fKeyword) &&
          <button className="btn-ghost" onClick={() => { setFStore(''); setFKeyword(''); }}>✕ 초기화</button>}
        <div className="fbar-right">
          <span className="fresult">
            <b>{filtered.length.toLocaleString()}</b>개 매장 ·
            <b style={{marginLeft:6, color:'var(--success)'}}>{completeCount}</b> 등록 ·
            <b style={{marginLeft:6, color:'var(--danger)'}}>{allRows.length - completeCount}</b> 미설정
          </span>
        </div>
      </div>
      {loading ? <div className="empty"><span className="spinner"/></div> : (
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th>백화점</th>
                <th>점포</th>
                <th>쇼핑몰ID</th>
                <th>우편번호</th>
                <th>주소</th>
                <th>수취인 전화</th>
                <th style={{textAlign:'center', width:60}}>상태</th>
                <th style={{textAlign:'center', width:80}}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8} className="empty">조회된 매장이 없습니다</td></tr>
                : filtered.map(r => (
                  <tr key={r.key}>
                    <td><span className="badge badge-dept">{r.store_name}</span></td>
                    <td><span className="badge badge-store">{r.branch_name}</span></td>
                    <td className="mono">{r.shopping_mall_id || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td className="mono">{r.postal_code || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td style={{fontSize:12}}>{r.address || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td className="mono">{r.recipient_phone || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td style={{textAlign:'center', fontSize:14}}>{r.complete ? '✅' : '⚠️'}</td>
                    <td style={{textAlign:'center'}}>
                      <button className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}}
                        onClick={() => openEdit(r)}>편집</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
      </div>
      {editing && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={closeEdit}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(560px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{padding:'20px 24px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:17, fontWeight:700}}>매장 정보 편집</div>
                <div style={{fontSize:12, color:'var(--text2)', marginTop:4}}>
                  <span className="badge badge-dept" style={{marginRight:6}}>{editing.store_name}</span>
                  <span className="badge badge-store">{editing.branch_name}</span>
                </div>
              </div>
              <button onClick={closeEdit}
                style={{height:30, padding:'0 12px', border:'1px solid var(--border)', borderRadius:6, background:'#fff', fontSize:12, cursor:'pointer'}}>✕ 닫기</button>
            </div>
            <div style={{padding:'18px 24px'}}>
              <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:10, alignItems:'center', marginBottom:10}}>
                <label style={{fontSize:12, fontWeight:600}}>쇼핑몰ID *</label>
                <input value={eForm.shopping_mall_id} onChange={e => setEForm(p => ({...p, shopping_mall_id:e.target.value}))}
                  placeholder="예: 롯관악점팔레오"
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontFamily:'var(--mono)'}}/>
                <label style={{fontSize:12, fontWeight:600}}>우편번호</label>
                <input value={eForm.postal_code} onChange={e => setEForm(p => ({...p, postal_code:e.target.value}))}
                  placeholder="예: 06141"
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontFamily:'var(--mono)'}}/>
                <label style={{fontSize:12, fontWeight:600}}>주소</label>
                <input value={eForm.address} onChange={e => setEForm(p => ({...p, address:e.target.value}))}
                  placeholder="예: 서울 관악구 ..."
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13}}/>
                <label style={{fontSize:12, fontWeight:600}}>수취인 전화</label>
                <input value={eForm.recipient_phone} onChange={e => setEForm(p => ({...p, recipient_phone:e.target.value}))}
                  placeholder="010-0000-0000"
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontFamily:'var(--mono)'}}/>
              </div>
            </div>
            <div style={{padding:'14px 24px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={closeEdit} disabled={saving}>취소</button>
              <button className="btn btn-p" onClick={saveEdit} disabled={saving}>
                {saving ? <span className="spinner"/> : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
