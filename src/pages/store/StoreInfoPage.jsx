import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { STORE_MAP, STORE_NAMES } from '../../lib/constants';
import { toast } from '../../lib/utils';

export default function StoreInfoPage() {
  const [addresses, setAddresses] = useState([]);   // store_addresses rows
  const [loading,   setLoading]   = useState(true);
  const [fStore,    setFStore]    = useState('');
  const [fKeyword,  setFKeyword]  = useState('');

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('store_addresses').select('*');
    if (error) toast(error.message, 'err');
    else setAddresses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

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
                        onClick={() => { /* Task 3에서 모달 연결 */ }}>편집</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
