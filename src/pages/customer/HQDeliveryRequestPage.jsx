import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob } from '../../lib/utils';
import { ORDER_CONSTANTS } from '../../lib/constants';

// 31-컬럼 발주 양식 헤더 (sample: 매장발주_26.05.21_전송건.xls)
const DELIVERY_HEADERS = [
  '발송일','송장번호','주문번호','채널','매장명','수취인명','결제금액','주문수량',
  '상품명','옵션','품명','수취인명','','주소','수취인 천화번호1','수취인 전화번호2',
  '배송메세지','상품번호','주문자명','주문자 연락처1','주문자 연락처2','수수료','수수료액','공란',
  '사방넷주문번호','주문일','주문자 ID','물류바코드(88코드)','송장전송일','ERP코드','수량'
];

async function exportDeliveryRequests(groups) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('택배요청');

  // 헤더 행
  ws.addRow(DELIVERY_HEADERS);

  // 오늘 날짜 YYYYMMDD (주문번호 prefix)
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const yymmdd = `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;

  // 그룹의 각 라인을 한 행씩 추가, 라인별로 -NNNN 부여
  let seq = 0;
  for (const g of groups) {
    const storeFull = `${g.store_name || ''}${g.branch_name || ''}`;
    for (const it of g.items) {
      seq += 1;
      const orderNo = `${ymd}-${String(seq).padStart(4,'0')}`;
      const soldDate = g.sold_at ? new Date(g.sold_at) : null;
      ws.addRow([
        soldDate,                                  // 0  발송일
        '',                                        // 1  송장번호
        orderNo,                                   // 2  주문번호
        ORDER_CONSTANTS.CHANNEL,                   // 3  채널
        storeFull,                                 // 4  매장명
        g.recipient_name || '',                    // 5  수취인명
        0,                                         // 6  결제금액
        1,                                         // 7  주문수량
        '',                                        // 8  상품명
        '',                                        // 9  옵션
        it.product?.name || '',                    // 10 품명
        g.recipient_name || '',                    // 11 수취인명
        '',                                        // 12 (우편번호 자리, 빈)
        g.recipient_address || '',                 // 13 주소
        g.recipient_phone || '',                   // 14 수취인 천화번호1
        '',                                        // 15 수취인 전화번호2
        g.delivery_notes || '',                    // 16 배송메세지
        '',                                        // 17 상품번호
        g.recipient_name || '',                    // 18 주문자명 (사용자 스펙: 받는사람)
        ORDER_CONSTANTS.ORDERER_PHONE,             // 19 주문자 연락처1
        ORDER_CONSTANTS.ORDERER_PHONE,             // 20 주문자 연락처2
        '',                                        // 21 수수료
        '',                                        // 22 수수료액
        '',                                        // 23 공란
        '',                                        // 24 사방넷주문번호
        '',                                        // 25 주문일
        '',                                        // 26 주문자 ID
        '',                                        // 27 물류바코드(88코드)
        '',                                        // 28 송장전송일
        it.product?.code || '',                    // 29 ERP코드 (현재 product.code 사용 — 별도 erp_code 컬럼 있으면 그쪽으로 교체)
        it.quantity || 0,                          // 30 수량
      ]);
    }
  }

  // 발송일 컬럼 날짜 서식
  ws.getColumn(1).numFmt = 'yyyy-mm-dd';

  // 컬럼 폭 자동
  ws.columns.forEach((col, idx) => {
    let max = 8;
    col.eachCell({ includeEmpty: false }, cell => {
      const v = cell.value == null ? '' : String(cell.value);
      if (v.length > max) max = Math.min(40, v.length + 2);
    });
    col.width = Math.max(max, 8);
  });

  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `택배요청_${yymmdd}_전송건.xlsx`);
  return seq;
}

function groupKey(s) {
  return `${s.sold_at}|${s.recipient_phone || ''}|${s.customer_id || ''}|${s.store_name}|${s.branch_name}`;
}

function groupSales(rows) {
  const map = new Map();
  for (const s of (rows || [])) {
    const k = groupKey(s);
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        sold_at: s.sold_at,
        store_name: s.store_name,
        branch_name: s.branch_name,
        recipient_name: s.recipient_name,
        recipient_phone: s.recipient_phone,
        recipient_address: s.recipient_address,
        delivery_notes: s.delivery_notes,
        dispatched_at: s.dispatched_at,
        items: [],
      });
    }
    map.get(k).items.push(s);
  }
  return [...map.values()].sort((a, b) =>
    (b.sold_at || '').localeCompare(a.sold_at || '')
  );
}

export default function HQDeliveryRequestPage({ profile }) {
  const [tab, setTab] = useState('pending');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const limit = tab === 'pending' ? 200 : 50;
    const { data, error } = await supabase.from('sales')
      .select(`id, sold_at, store_name, branch_name, quantity, price,
               recipient_name, recipient_phone, recipient_address, delivery_notes,
               dispatched_at, customer_id,
               product:products(name, code)`)
      .eq('delivery_type', 'hq')
      .eq('delivery_status', tab)
      .order(tab === 'pending' ? 'sold_at' : 'dispatched_at', { ascending: false })
      .limit(limit);
    if (error) toast(error.message, 'err');
    else setGroups(groupSales(data));
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDispatch = async (group) => {
    const ok = window.confirm(
      `${group.recipient_name}님 (${group.recipient_phone})\n` +
      `${group.items.length}개 상품을 발송처리하시겠습니까?\n\n` +
      `처리 후 매장 매출조회에서 "✅ 본사발송 완료"로 표시됩니다.`
    );
    if (!ok) return;
    setProcessing(group.key);
    try {
      const ids = group.items.map(it => it.id);
      const { error } = await supabase.from('sales').update({
        delivery_status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        dispatched_by: profile.id,
      }).in('id', ids);
      if (error) throw error;
      toast(`${ids.length}건 발송처리 완료`, 'ok');
      fetchData();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setProcessing(null);
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
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:8, flexWrap:'wrap'}}>
          <span className="fresult">
            {tab === 'pending'
              ? <>발송 대기 중인 본사 택배 요청 — <b>{groups.length}</b>건</>
              : <>발송 완료 — <b>{groups.length}</b>건 <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>(최근 50건만 표시)</span></>}
          </span>
          <div style={{display:'flex', gap:8}}>
            {tab === 'pending' && groups.length > 0 && (
              <button type="button" onClick={async () => {
                try {
                  const count = await exportDeliveryRequests(groups);
                  toast(`엑셀 다운로드 완료 (${count}건)`, 'ok');
                } catch (e) {
                  toast('다운로드 실패: ' + (e.message || e), 'err');
                }
              }}
                title="현재 발송 대기 건 전체를 매장발주 양식(.xlsx)으로 다운로드"
                style={{height:30, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background:'#fff3e0', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6}}>
                📥 엑셀 다운로드
              </button>
            )}
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
          : groups.length === 0 ? <div className="empty">
              {tab === 'pending' ? '발송 대기 중인 요청이 없습니다' : '발송 완료 이력이 없습니다'}
            </div>
          : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>매장</th>
                  <th>상품명</th>
                  <th className="r" style={{width:60}}>수량</th>
                  <th>받는사람</th>
                  <th>주소</th>
                  <th>연락처</th>
                  <th>요청사항</th>
                  <th style={{textAlign:'center', width:130}}>
                    {tab === 'pending' ? '작업' : '발송일'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((g, gIdx) => {
                  const isProc = processing === g.key;
                  // 그룹 시각적 구분: 짝수 그룹 흰색, 홀수 그룹 매우 옅은 노랑
                  const groupBg = gIdx % 2 === 0 ? '#fff' : '#fffdf5';
                  return g.items.map((it, iIdx) => (
                    <tr key={it.id} style={{background: groupBg}}>
                      <td className="mono" style={{fontSize:11}}>{iIdx === 0 ? g.sold_at : ''}</td>
                      <td style={{fontSize:11}}>
                        {iIdx === 0 ? (
                          <><span className="badge badge-dept">{g.store_name}</span> <span className="badge badge-store">{g.branch_name}</span></>
                        ) : ''}
                      </td>
                      <td style={{fontSize:12}}>{it.product?.name || '-'}</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{it.quantity}</td>
                      <td style={{fontSize:12, fontWeight: iIdx === 0 ? 700 : 400}}>
                        {iIdx === 0 ? g.recipient_name : ''}
                      </td>
                      <td style={{fontSize:11, color:'var(--text2)'}}>
                        {iIdx === 0 ? g.recipient_address : ''}
                      </td>
                      <td className="mono" style={{fontSize:11, color:'var(--text2)'}}>
                        {iIdx === 0 ? g.recipient_phone : ''}
                      </td>
                      <td style={{fontSize:11, color:'var(--text3)'}}>
                        {iIdx === 0 ? (g.delivery_notes || '-') : ''}
                      </td>
                      <td style={{textAlign:'center'}}>
                        {iIdx === 0 && tab === 'pending' && (
                          <button className="btn btn-p" onClick={() => handleDispatch(g)} disabled={isProc}
                            style={{padding:'0 14px', height:30, fontWeight:700, fontSize:12}}>
                            {isProc ? <span className="spinner"/> : '✓ 발송처리'}
                          </button>
                        )}
                        {iIdx === 0 && tab === 'dispatched' && g.dispatched_at && (
                          <span style={{fontSize:11, color:'var(--success)', fontWeight:600}}>
                            {new Date(g.dispatched_at).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
