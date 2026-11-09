import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, getGrade, formatNumInput, parseNumInput } from '../../lib/utils';
import { CLAIM_TYPES } from '../../lib/constants';

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ─── 공용 스타일 (단일 블루 톤) ───
const ov = { position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const bg = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' };
const card = { position: 'relative', background: '#fff', borderRadius: 12, width: 'min(720px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: '22px 24px', boxShadow: '0 10px 48px rgba(0,0,0,0.28)' };
const h1 = { fontSize: 17, fontWeight: 800, color: 'var(--text)' };
const sub = { fontSize: 12, color: 'var(--text2)' };
const sect = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '16px 0 8px' };
const fld = { height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' };
const qtyIn = { width: 64, height: 32, padding: '0 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'center', outline: 'none' };
const btnGhost = { height: 40, padding: '0 18px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnPrimary = (disabled) => ({ height: 40, padding: '0 24px', border: 'none', borderRadius: 8, background: disabled ? '#9db4d6' : 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' });

const findProduct = async (code) => {
  const c = String(code || '').trim(); if (!c) return null;
  let { data } = await supabase.from('products').select('name, code').eq('code', c).limit(1);
  if (!data || data.length === 0) ({ data } = await supabase.from('products').select('name, code').eq('erp_code', c).limit(1));
  return data?.[0] ? { name: data[0].name, code: data[0].code || c } : { name: '', code: c, notFound: true };
};
const applyStock = async (movements, sName, bName) => {
  for (const m of (movements || [])) {
    if (!m.code || !m.delta) continue;
    const { data: row } = await supabase.from('store_stock').select('id, stock_qty')
      .eq('store_name', sName).eq('branch_name', bName).eq('product_code', m.code).maybeSingle();
    if (row) await supabase.from('store_stock').update({ stock_qty: (row.stock_qty || 0) + m.delta, updated_at: new Date().toISOString() }).eq('id', row.id);
    else await supabase.from('store_stock').insert({ store_name: sName, branch_name: bName, product_code: m.code, product_name: m.name || null, stock_qty: m.delta, updated_at: new Date().toISOString() });
  }
};

// 사유 선택 (단순변심=빈값 → 반품 시 현황 미기록)
function ReasonPicker({ type, setType, custom, setCustom, detail, setDetail }) {
  return (
    <div>
      <div style={sect}>클레임 사유 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(단순변심은 현황 미기록 · 품질불만 등 선택 시 기록)</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...fld, width: 180 }}>
          <option value="">단순변심</option>{CLAIM_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        {type === '직접입력' && <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="사유 직접 입력" style={{ ...fld, width: 180 }} />}
        {type && <input value={detail} onChange={e => setDetail(e.target.value)} placeholder="상세내용 (선택)" style={{ ...fld, flex: '1 1 200px' }} />}
      </div>
    </div>
  );
}

// ══════════════ 반품(환불) 팝업 ══════════════
export function ReturnModal({ order, storeName, branchName, profile, onClose, onDone }) {
  const [returnDate, setReturnDate] = useState(kstToday());
  const [qtyMap, setQtyMap] = useState({});
  const [reason, setReason] = useState('');
  const [reasonCustom, setReasonCustom] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [refundEdit, setRefundEdit] = useState('');
  const [saving, setSaving] = useState(false);

  const items = order.items;
  const setQty = (id, v, remain) => setQtyMap(m => ({ ...m, [id]: Math.max(0, Math.min(remain, Number(v) || 0)) }));
  const toReturn = items.filter(i => Number(qtyMap[i.id] || 0) > 0);

  const preview = useMemo(() => {
    let cash = 0, pr = 0, pv = 0, q = 0;
    for (const it of items) {
      const qty = Number(qtyMap[it.id] || 0); if (qty <= 0) continue;
      const ratio = qty / it.quantity;
      cash += Math.abs(Number(it.price) || 0) * qty;
      pr += Math.floor((it.points_used || 0) * ratio);
      pv += Math.floor((it.points_earned || 0) * ratio);
      q += qty;
    }
    return { cash, pointsRestore: pr, pointsRevoke: pv, qtySum: q };
  }, [items, qtyMap]);

  const submit = async () => {
    if (toReturn.length === 0) { toast('반품할 수량을 입력해주세요', 'err'); return; }
    if (!returnDate) { toast('반품 날짜를 선택해주세요', 'err'); return; }
    const refundComputed = preview.cash;
    const refundFinal = refundEdit.trim() !== '' ? Number(parseNumInput(refundEdit)) : refundComputed;
    if (!Number.isFinite(refundFinal) || refundFinal < 0) { toast('환불 합계가 유효하지 않습니다', 'err'); return; }
    const overridden = refundFinal !== refundComputed;
    const reasonFinal = reason === '직접입력' ? reasonCustom.trim() : reason;

    if (!window.confirm(`${toReturn.length}개 상품을 반품(환불) 처리할까요?\n\n반품 날짜: ${returnDate}\n환불 금액: ${refundFinal.toLocaleString()}원${overridden ? ` (수정됨)` : ''}\n복구 적립금: ${preview.pointsRestore.toLocaleString()}원 · 회수 적립금: ${preview.pointsRevoke.toLocaleString()}원`)) return;

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const refundRatio = (overridden && refundComputed > 0) ? (refundFinal / refundComputed) : 1;
      let allocated = 0;
      for (let idx = 0; idx < toReturn.length; idx++) {
        const it = toReturn[idx];
        const qty = Number(qtyMap[it.id]);
        const newReturnedQty = (it.returned_qty || 0) + qty;
        const fullyReturned = newReturnedQty >= it.quantity;
        const lineOrig = Math.abs(Number(it.price) || 0) * qty;
        let lineTotal;
        if (idx === toReturn.length - 1) lineTotal = Math.max(0, refundFinal - allocated);
        else { lineTotal = overridden ? Math.round(lineOrig * refundRatio) : lineOrig; allocated += lineTotal; }
        const unitPrice = qty > 0 ? lineTotal / qty : 0;

        const { data: negRow, error: negErr } = await supabase.from('sales').insert({
          sold_at: returnDate, store_name: it.store_name, branch_name: it.branch_name,
          brand_id: it.brand_id, product_id: it.product_id, quantity: qty, price: -Math.abs(unitPrice),
          payment: '반품', memo: `반품 (원본 매출일 ${it.sold_at}, 매출 ID:${it.id})${overridden ? ' · 환불합계 수정' : ''}`,
          created_by: profile.id, customer_id: it.customer_id, points_earned: 0, points_used: 0, delivery_type: 'none',
        }).select('id');
        if (negErr) throw negErr;
        if (!negRow || negRow.length === 0) throw new Error('반품 매출 저장 실패 (RLS)');

        await supabase.from('sales').update({ returned_qty: newReturnedQty, returned_at: fullyReturned ? nowIso : it.returned_at }).eq('id', it.id);

        if (it.product?.code && it.delivery_type !== 'hq') {
          const { data: sr } = await supabase.from('store_stock').select('id, stock_qty')
            .eq('store_name', it.store_name || storeName).eq('branch_name', it.branch_name || branchName).eq('product_code', it.product.code).maybeSingle();
          if (sr) await supabase.from('store_stock').update({ stock_qty: (sr.stock_qty || 0) + qty, updated_at: new Date().toISOString() }).eq('id', sr.id);
        }

        if (it.customer_id && it.customer) {
          const ratio = qty / it.quantity;
          const pUsed = Math.floor((it.points_used || 0) * ratio);
          const pEarn = Math.floor((it.points_earned || 0) * ratio);
          const nTP = Math.max(0, (it.customer.total_points || 0) + pUsed - pEarn);
          const nUP = Math.max(0, (it.customer.used_points || 0) - pUsed);
          const nPur = Math.max(0, (it.customer.total_purchase || 0) - lineTotal);
          await supabase.from('customers').update({ total_points: nTP, used_points: nUP, total_purchase: nPur, grade: getGrade(nPur).grade }).eq('id', it.customer_id);
        }
      }
      // 사유 선택 시에만 클레임 현황 기록 (단순변심=미기록)
      if (reasonFinal) {
        try {
          await supabase.from('store_claims').insert({
            store_name: storeName, branch_name: branchName, worker_name: null,
            customer_name: order.customer?.name || null, customer_phone: order.customer?.phone || null, customer_id: order.customerId || null,
            product_name: toReturn.map(i => `${i.product?.name || ''}×${Number(qtyMap[i.id])}`).join(', '),
            product_code: toReturn.length === 1 ? (toReturn[0].product?.code || null) : null,
            claim_type: reasonFinal, claim_detail: reasonDetail.trim() || null,
            status: '완료', action_type: '환불', source: '반품', stock_movements: [], created_by: profile?.id || null,
          });
        } catch (e) { /* ignore */ }
      }
      toast('반품 처리 완료', 'ok');
      onDone();
    } catch (err) { toast('반품 실패: ' + err.message, 'err'); setSaving(false); }
  };

  return (
    <div style={ov}>
      <div style={bg} onClick={saving ? undefined : onClose} />
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={h1}>↩️ 반품 처리</span>
          <span style={sub}><b>{order.customer?.name || '비회원'}</b> · {order.customer?.phone || '-'} · 판매일 {order.sold_at}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>📅 반품 날짜</span>
          <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={{ ...fld, width: 160, fontWeight: 700 }} />
        </div>

        <div style={sect}>반품할 상품·수량 선택</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f7f8fa', fontSize: 12, color: 'var(--text2)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>상품명</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>단가</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>잔여</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', width: 120 }}>반품 수량</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const remain = it.quantity - (it.returned_qty || 0);
                return (
                  <tr key={it.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{it.product?.name || '-'}</div>
                      {it.product?.code && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{it.product.code} · {it.payment}</div>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{Number(it.price).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{remain}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input type="number" min={0} max={remain} value={qtyMap[it.id] || 0} onChange={e => setQty(it.id, e.target.value, remain)} style={qtyIn} />
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>/{remain}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ReasonPicker type={reason} setType={setReason} custom={reasonCustom} setCustom={setReasonCustom} detail={reasonDetail} setDetail={setReasonDetail} />

        <div style={sect}>환불 합계</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" inputMode="numeric" value={refundEdit === '' ? '' : formatNumInput(refundEdit)}
            onChange={e => setRefundEdit(parseNumInput(e.target.value))} placeholder={preview.cash.toLocaleString()}
            style={{ ...fld, width: 180, height: 40, fontSize: 15, fontWeight: 700, fontFamily: 'var(--mono)', textAlign: 'right' }} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>비우면 자동계산 {preview.cash.toLocaleString()}원</span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>복구 적립금 +{preview.pointsRestore.toLocaleString()} · 회수 −{preview.pointsRevoke.toLocaleString()}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={saving} style={btnGhost}>취소</button>
          <button type="button" onClick={submit} disabled={saving || preview.qtySum === 0} style={btnPrimary(saving || preview.qtySum === 0)}>
            {saving ? '처리 중…' : `반품 처리 (${preview.qtySum}개)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════ 교환 팝업 ══════════════
export function ExchangeModal({ order, storeName, branchName, profile, onClose, onDone }) {
  const [qtyMap, setQtyMap] = useState({});
  const [target, setTarget] = useState({ name: '', code: '', qty: '' });
  const [giftOn, setGiftOn] = useState(false);
  const [gift, setGift] = useState({ name: '', code: '', qty: '' });
  const [reason, setReason] = useState('');
  const [reasonCustom, setReasonCustom] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [saving, setSaving] = useState(false);

  const items = order.items;
  const setQty = (id, v, remain) => setQtyMap(m => ({ ...m, [id]: Math.max(0, Math.min(remain, Number(v) || 0)) }));
  const toEx = items.filter(i => Number(qtyMap[i.id] || 0) > 0);
  const totalQty = toEx.reduce((s, it) => s + Number(qtyMap[it.id]), 0);

  const scan = async (code, setter, defQty) => {
    const p = await findProduct(code); if (!p) return;
    setter(t => ({ ...t, name: p.name, code: p.code, qty: t.qty || defQty }));
    if (p.notFound) toast('상품관리에 없는 코드입니다', 'err'); else toast(`인식: ${p.name}`, 'ok');
  };

  const submit = async () => {
    if (toEx.length === 0) { toast('교환할 상품·수량을 선택해주세요', 'err'); return; }
    if (!target.code) { toast('교환받을 상품을 스캔/입력해주세요', 'err'); return; }
    if (giftOn && !gift.code) { toast('증정 상품을 스캔/입력해주세요', 'err'); return; }
    const exQty = Number(target.qty) || totalQty;
    const giftQty = Number(gift.qty) || 1;
    const reasonFinal = reason === '직접입력' ? reasonCustom.trim() : reason;
    const sameCode = toEx.length === 1 && toEx[0].product?.code === target.code;
    const actionType = sameCode ? '동일상품 교환' : '다른상품 교환';
    const prodNames = toEx.map(i => `${i.product?.name || ''}×${Number(qtyMap[i.id])}`).join(', ');

    if (!window.confirm(`교환 처리할까요?\n\n회수: ${prodNames}\n교환: ${target.name} ×${exQty}` + (giftOn ? `\n증정: ${gift.name} ×${giftQty}` : '') + `\n\n※ 매출·적립금 변화 없음 · 클레임 현황 기록`)) return;

    setSaving(true);
    try {
      const movements = [];
      for (const it of toEx) if (it.product?.code) movements.push({ code: it.product.code, name: it.product?.name, delta: Number(qtyMap[it.id]) });
      movements.push({ code: target.code, name: target.name, delta: -exQty });
      if (giftOn) movements.push({ code: gift.code, name: gift.name, delta: -giftQty });
      await applyStock(movements, storeName, branchName);
      await supabase.from('store_claims').insert({
        store_name: storeName, branch_name: branchName, worker_name: null,
        customer_name: order.customer?.name || null, customer_phone: order.customer?.phone || null, customer_id: order.customerId || null,
        product_name: prodNames, product_code: toEx.length === 1 ? (toEx[0].product?.code || null) : null,
        claim_type: reasonFinal || null, claim_detail: reasonDetail.trim() || null,
        status: '완료', action_type: giftOn ? `${actionType} + 서비스증정` : actionType,
        exchange_product_name: target.name || null, exchange_product_code: target.code || null,
        gift_product_name: giftOn ? (gift.name || null) : null, gift_product_code: giftOn ? (gift.code || null) : null,
        source: '교환·증정', stock_movements: movements, created_by: profile?.id || null,
      });
      toast('교환 처리 완료', 'ok');
      onDone();
    } catch (err) { toast('교환 실패: ' + err.message, 'err'); setSaving(false); }
  };

  const prodInput = (t, setter, defQty, accent) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <input placeholder="📷 바코드 스캔 후 Enter"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scan(e.currentTarget.value, setter, defQty); e.currentTarget.value = ''; } }}
        style={{ ...fld, width: 180, border: `2px solid ${accent}` }} />
      <input value={t.name} onChange={e => setter(s => ({ ...s, name: e.target.value }))} placeholder="상품명" style={{ ...fld, flex: '1 1 160px' }} />
      <input type="number" min={1} value={t.qty} onChange={e => setter(s => ({ ...s, qty: e.target.value }))} placeholder={String(defQty)} title="수량" style={qtyIn} />
      {t.code && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>코드:{t.code}</span>}
    </div>
  );

  return (
    <div style={ov}>
      <div style={bg} onClick={saving ? undefined : onClose} />
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={h1}>🔄 교환 처리</span>
          <span style={sub}><b>{order.customer?.name || '비회원'}</b> · {order.customer?.phone || '-'} · 판매일 {order.sold_at}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>매출·적립금 변화 없이 재고만 반영됩니다.</div>

        <div style={sect}>① 교환할 구매상품·수량</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f7f8fa', fontSize: 12, color: 'var(--text2)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>상품명</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>잔여</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', width: 120 }}>교환 수량</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const remain = it.quantity - (it.returned_qty || 0);
                return (
                  <tr key={it.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{it.product?.name || '-'}</div>
                      {it.product?.code && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{it.product.code}</div>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{remain}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input type="number" min={0} max={remain} value={qtyMap[it.id] || 0} onChange={e => setQty(it.id, e.target.value, remain)} style={qtyIn} />
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>/{remain}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={sect}>② 교환받을 상품 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(수량 기본값 {totalQty || 1})</span></div>
        {prodInput(target, setTarget, totalQty || 1, 'var(--accent)')}

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={giftOn} onChange={e => setGiftOn(e.target.checked)} /> 🎁 서비스증정 추가
          </label>
          {giftOn && <div style={{ marginTop: 8 }}>{prodInput(gift, setGift, 1, '#2e7d32')}</div>}
        </div>

        <ReasonPicker type={reason} setType={setReason} custom={reasonCustom} setCustom={setReasonCustom} detail={reasonDetail} setDetail={setReasonDetail} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={saving} style={btnGhost}>취소</button>
          <button type="button" onClick={submit} disabled={saving || totalQty === 0} style={btnPrimary(saving || totalQty === 0)}>
            {saving ? '처리 중…' : `교환 처리 (${totalQty}개)`}
          </button>
        </div>
      </div>
    </div>
  );
}
