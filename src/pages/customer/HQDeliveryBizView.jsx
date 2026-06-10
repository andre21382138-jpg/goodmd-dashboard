import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { ORDER_CONSTANTS } from '../../lib/constants';
import { DELIVERY_HEADERS } from './HQDeliveryRequestPage';

// 특판 택배·용차 뷰 (biz_sales 기반)
// kind: 'courier' (택배) | 'truck' (용차)
export default function HQDeliveryBizView({ kind, profile }) {
  const isCourier = kind === 'courier';
  const deliveryMethod = isCourier ? '택배' : '용차';

  const [tab,     setTab]     = useState('pending'); // 'pending' | 'dispatched'
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const fileInputRef = useRef(null);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const minusDays = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  // 발송완료 탭 필터 (기간만 — 거래처는 단순화 위해 생략)
  const [fFrom, setFFrom] = useState(minusDays(30));
  const [fTo,   setFTo]   = useState(todayStr());

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('biz_sales')
      .select(`id, sold_at, company_id, company_name, product_name, quantity,
               supply_price, memo, delivery_method,
               recipient_name, recipient_phone, recipient_address,
               delivery_status, dispatched_at, tracking_number,
               product:products(name, code)`)
      .eq('delivery_method', deliveryMethod)
      .eq('delivery_status', tab);
    if (tab === 'pending') {
      q = q.order('sold_at', { ascending: false }).limit(300);
    } else {
      if (fFrom) q = q.gte('dispatched_at', `${fFrom}T00:00:00`);
      if (fTo)   q = q.lte('dispatched_at', `${fTo}T23:59:59`);
      q = q.order('dispatched_at', { ascending: false }).limit(500);
    }
    const { data, error } = await q;
    if (error) toast(error.message, 'err');
    else setRows(data || []);
    setLoading(false);
  }, [tab, deliveryMethod, fFrom, fTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 발송처리 (단건)
  const handleDispatch = async (row) => {
    const ok = window.confirm(
      `'${row.company_name}' / ${row.product_name} ${row.quantity}개\n` +
      `${isCourier ? '택배' : '용차'} 발송처리하시겠습니까?`
    );
    if (!ok) return;
    setProcessing(row.id);
    try {
      const { error } = await supabase.from('biz_sales').update({
        delivery_status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        dispatched_by: profile.id,
      }).eq('id', row.id);
      if (error) throw error;
      toast('발송처리 완료', 'ok');
      fetchData();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setProcessing(null);
    }
  };

  // 송장 일괄 업로드 — 31컬럼 양식: row[23]에서 SIDB:<id>, row[1]에서 송장번호
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let totalRows = 0;
      const updates = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        if (!r || !Array.isArray(r) || r.length === 0) continue;
        const sidCell = String(r[23] || '').trim();
        const m = sidCell.match(/SIDB:(\d+)/);
        if (!m) continue; // 다운로드된 특판 데이터 행이 아님
        totalRows++;
        const trkCell = String(r[1] || '').trim();
        if (!trkCell) continue;
        updates.push({ id: Number(m[1]), tracking: trkCell });
      }
      if (totalRows === 0) {
        toast('업로드 가능한 행이 없습니다 (SIDB 누락)', 'err');
        setUploading(false);
        return;
      }
      if (updates.length === 0) {
        toast(`송장번호 입력된 행이 없습니다 (전체 ${totalRows}건 모두 미입력)`, 'err');
        setUploading(false);
        return;
      }
      const nowIso = new Date().toISOString();
      let ok = 0, fail = 0;
      for (const u of updates) {
        const { error } = await supabase.from('biz_sales').update({
          tracking_number: u.tracking,
          delivery_status: 'dispatched',
          dispatched_at: nowIso,
          dispatched_by: profile.id,
        }).eq('id', u.id);
        if (error) fail++; else ok++;
      }
      const parts = [`처리 ${ok}건`];
      if (fail > 0) parts.push(`실패 ${fail}건`);
      const noTracking = totalRows - updates.length;
      if (noTracking > 0) parts.push(`미입력 ${noTracking}건은 대기 그대로`);
      toast(`송장번호 등록 완료 — ${parts.join(' / ')}`, fail > 0 ? 'err' : 'ok');
      setTab('dispatched');
      fetchData();
    } catch (err) {
      toast('업로드 실패: ' + (err.message || err), 'err');
    }
    setUploading(false);
  };

  // 발송대기 엑셀 다운로드 — 매장 본사요청과 동일한 31컬럼 양식
  const handleDownload = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { dlBlob } = await import('../../lib/utils');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('특판 택배요청');
      ws.addRow(DELIVERY_HEADERS);

      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      const ymd    = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const yymmdd = `${String(now.getFullYear()).slice(-2)}.${pad(now.getMonth()+1)}.${pad(now.getDate())}`;

      let seq = 0;
      for (const r of rows) {
        seq += 1;
        const orderNo  = `${ymd}-${String(seq).padStart(4,'0')}`;
        const soldDate = r.sold_at ? new Date(r.sold_at) : null;
        const companyFull = r.company_name || '';
        ws.addRow([
          soldDate,                                  // 0  발송일
          '',                                        // 1  송장번호
          orderNo,                                   // 2  주문번호
          ORDER_CONSTANTS.CHANNEL,                   // 3  채널
          companyFull,                               // 4  매장명 → 거래처명
          r.recipient_name || '',                    // 5  수취인명
          0,                                         // 6  결제금액
          1,                                         // 7  주문수량
          '',                                        // 8  상품명
          '',                                        // 9  옵션
          r.product_name || r.product?.name || '',   // 10 품명
          r.recipient_name || '',                    // 11 수취인명
          '',                                        // 12 (우편번호)
          r.recipient_address || '',                 // 13 주소
          r.recipient_phone || '',                   // 14 수취인 전화1
          '',                                        // 15 수취인 전화2
          r.memo || '',                              // 16 배송메세지
          '',                                        // 17 상품번호
          companyFull,                               // 18 주문자명 → 거래처명 자동 입력
          ORDER_CONSTANTS.ORDERER_PHONE,             // 19 주문자 연락처1
          ORDER_CONSTANTS.ORDERER_PHONE,             // 20 주문자 연락처2
          '',                                        // 21 수수료
          '',                                        // 22 수수료액
          `SIDB:${r.id}`,                            // 23 공란 — biz_sale_id (특판 prefix)
          '',                                        // 24 사방넷
          '',                                        // 25 주문일
          '',                                        // 26 주문자 ID
          '',                                        // 27 물류바코드
          '',                                        // 28 송장전송일
          r.product?.code || '',                     // 29 ERP코드
          r.quantity || 0,                           // 30 수량
        ]);
      }

      ws.getColumn(1).numFmt = 'yyyy-mm-dd';
      ws.columns.forEach(col => {
        let max = 8;
        col.eachCell({ includeEmpty:false }, cell => {
          const v = cell.value == null ? '' : String(cell.value);
          if (v.length > max) max = Math.min(40, v.length + 2);
        });
        col.width = Math.max(max, 8);
      });
      const buf = await wb.xlsx.writeBuffer();
      dlBlob(buf, `특판택배요청_${yymmdd}_전송건.xlsx`);
      toast(`엑셀 다운로드 완료 (${seq}건)`, 'ok');
    } catch (err) {
      toast('다운로드 실패: ' + (err.message || err), 'err');
    }
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='pending'?'on':''}`} onClick={() => setTab('pending')}>
          📦 발송 대기
        </button>
        <button className={`tab ${tab==='dispatched'?'on':''}`} onClick={() => setTab('dispatched')}>
          ✅ 발송 완료
        </button>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        {tab === 'dispatched' && (
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap'}}>
            <input type="date" className="fsel" value={fFrom}
              onChange={e => setFFrom(e.target.value || todayStr())}
              style={{height:32, padding:'0 8px', fontSize:12}}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={fTo}
              onChange={e => setFTo(e.target.value || todayStr())}
              style={{height:32, padding:'0 8px', fontSize:12}}/>
            <button className="btn btn-s" onClick={() => { setFFrom(minusDays(30)); setFTo(todayStr()); }}>최근 30일</button>
            <button className="btn btn-s" onClick={() => { setFFrom(minusDays(90)); setFTo(todayStr()); }}>최근 3개월</button>
          </div>
        )}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:8, flexWrap:'wrap'}}>
          <span className="fresult">
            {tab === 'pending'
              ? <>발송 대기 중인 특판 {isCourier?'택배':'용차'} 요청 — <b>{rows.length}</b>건</>
              : <>발송 완료 — <b>{rows.length}</b>건 <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>{fFrom} ~ {fTo}</span></>}
          </span>
          <div style={{display:'flex', gap:8}}>
            {tab === 'pending' && isCourier && rows.length > 0 && (
              <>
                <button type="button" onClick={handleDownload}
                  title="특판 택배요청 엑셀 다운로드 (송장 받기용)"
                  style={{height:30, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background:'#fff3e0', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  📥 엑셀 다운로드
                </button>
                <input ref={fileInputRef} type="file" accept=".xls,.xlsx"
                  onChange={handleUploadFile} style={{display:'none'}}/>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  title="송장번호 채워진 엑셀 업로드 → 자동 발송완료"
                  style={{height:30, padding:'0 12px', border:'1px solid #2e7d32', borderRadius:'var(--radius)', background:'#e8f5e9', color:'#2e7d32', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  {uploading ? <span className="spinner"/> : '📤 송장 업로드'}
                </button>
              </>
            )}
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
          : rows.length === 0 ? <div className="empty">
              {tab === 'pending' ? `발송 대기 중인 특판 ${isCourier?'택배':'용차'} 요청이 없습니다` : '발송 완료 이력이 없습니다'}
            </div>
          : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>거래처</th>
                  <th>상품명</th>
                  <th className="r" style={{width:60}}>수량</th>
                  <th>받는사람</th>
                  <th>주소</th>
                  <th>연락처</th>
                  <th>메모</th>
                  {isCourier && <th style={{textAlign:'center', width:160}}>송장번호</th>}
                  <th style={{textAlign:'center', width:130}}>
                    {tab === 'pending' ? '작업' : '발송일'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="mono" style={{fontSize:11}}>{r.sold_at}</td>
                    <td style={{fontSize:12, fontWeight:600}}>{r.company_name || '-'}</td>
                    <td style={{fontSize:12}}>{r.product_name || r.product?.name || '-'}</td>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{r.quantity}</td>
                    <td style={{fontSize:12}}>{r.recipient_name || '-'}</td>
                    <td style={{fontSize:11, color:'var(--text2)'}}>{r.recipient_address || '-'}</td>
                    <td className="mono" style={{fontSize:11, color:'var(--text2)'}}>{r.recipient_phone || '-'}</td>
                    <td style={{fontSize:11, color:'var(--text3)'}}>{r.memo || '-'}</td>
                    {isCourier && (
                      <td style={{textAlign:'center', fontSize:11, fontFamily:'var(--mono)'}}>
                        {r.tracking_number ? (
                          <div style={{display:'flex', alignItems:'center', gap:6, justifyContent:'center', flexWrap:'wrap'}}>
                            <span style={{fontWeight:700}}>📦 {r.tracking_number}</span>
                            <button type="button"
                              onClick={() => window.open(`https://tracker.delivery/#/kr.cjlogistics/${r.tracking_number}`, '_blank', 'noopener,noreferrer')}
                              title="CJ대한통운 배송조회 (새 창)"
                              style={{height:24, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:4, background:'#fff3e0', color:'var(--accent)', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                              🔍 조회
                            </button>
                          </div>
                        ) : <span style={{color:'var(--text3)'}}>-</span>}
                      </td>
                    )}
                    <td style={{textAlign:'center'}}>
                      {tab === 'pending' ? (
                        <button className="btn btn-p" onClick={() => handleDispatch(r)} disabled={processing === r.id}
                          style={{padding:'0 14px', height:30, fontWeight:700, fontSize:12}}>
                          {processing === r.id ? <span className="spinner"/> : '✓ 발송처리'}
                        </button>
                      ) : (
                        r.dispatched_at && (
                          <span style={{fontSize:11, color:'var(--success)', fontWeight:600}}>
                            {new Date(r.dispatched_at).toLocaleDateString('ko-KR')}
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
