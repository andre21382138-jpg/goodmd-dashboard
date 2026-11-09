import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

// 반품 처리 자리의 조치(처리방법)
// refund=true → 기존 환불(음수 매출·적립금·재고 복구). 나머지는 매출 변화 없이 재고 스왑 + 클레임 기록.
export const RET_ACTIONS = [
  { key: '환불',                     refund: true,  needEx: false, needGift: false },
  { key: '동일상품 교환',             refund: false, needEx: false, needGift: false },
  { key: '동일상품 교환 + 서비스증정', refund: false, needEx: false, needGift: true  },
  { key: '다른상품 교환',             refund: false, needEx: true,  needGift: false },
  { key: '다른상품 교환 + 서비스증정', refund: false, needEx: true,  needGift: true  },
  { key: '본사처리필요',              refund: false, needEx: false, needGift: false },
];
export const getRetAction = (key) => RET_ACTIONS.find(a => a.key === key) || RET_ACTIONS[0];
export const emptyClaimAction = () => ({ action_type: '환불', exchange: { name: '', code: '', qty: '' }, gift: { name: '', code: '', qty: '' } });

const findProduct = async (code) => {
  const c = String(code || '').trim(); if (!c) return null;
  let { data } = await supabase.from('products').select('name, code').eq('code', c).limit(1);
  if (!data || data.length === 0) ({ data } = await supabase.from('products').select('name, code').eq('erp_code', c).limit(1));
  return data?.[0] ? { name: data[0].name, code: data[0].code || c } : { name: '', code: c, notFound: true };
};

const scanBox = { width: '100%', height: 36, padding: '0 10px', border: '2px solid #6a1b9a', borderRadius: 4, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' };
const fld = { width: '100%', height: 36, padding: '0 10px', border: '1px solid #ce93d8', borderRadius: 4, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' };
const lab = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6a1b9a', marginBottom: 4 };

export default function ClaimActionPicker({ value, onChange, returnedItems = [] }) {
  const a = getRetAction(value.action_type);
  const totalReturned = returnedItems.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const [modal, setModal] = useState(null); // { action, prev }
  const [tEx, setTEx]     = useState({ name: '', code: '', qty: '' });
  const [tGift, setTGift] = useState({ name: '', code: '', qty: '' });

  const setAction = (key) => {
    const na = getRetAction(key);
    if (na.needEx || na.needGift) {
      setTEx(na.needEx ? { name: value.exchange.name, code: value.exchange.code, qty: value.exchange.qty || (totalReturned || '') } : { name: '', code: '', qty: '' });
      setTGift(na.needGift ? { name: value.gift.name, code: value.gift.code, qty: value.gift.qty || 1 } : { name: '', code: '', qty: '' });
      setModal({ action: key, prev: value.action_type });
    } else {
      onChange({ action_type: key, exchange: { name: '', code: '', qty: '' }, gift: { name: '', code: '', qty: '' } });
    }
  };

  const scan = async (code, setter) => {
    const p = await findProduct(code); if (!p) return;
    setter(t => ({ ...t, name: p.name, code: p.code }));
    if (p.notFound) toast('상품관리에 없는 코드입니다', 'err'); else toast(`인식: ${p.name}`, 'ok');
  };

  const confirmModal = () => {
    const na = getRetAction(modal.action);
    if (na.needEx && !tEx.code) { toast('교환할 다른상품을 스캔/입력해주세요', 'err'); return; }
    if (na.needGift && !tGift.code) { toast('서비스증정 상품을 스캔/입력해주세요', 'err'); return; }
    onChange({
      action_type: modal.action,
      exchange: na.needEx ? { name: tEx.name, code: tEx.code, qty: tEx.qty || totalReturned || 1 } : { name: '', code: '', qty: '' },
      gift: na.needGift ? { name: tGift.name, code: tGift.code, qty: tGift.qty || 1 } : { name: '', code: '', qty: '' },
    });
    setModal(null);
  };
  const cancelModal = () => { onChange({ ...value, action_type: modal.prev }); setModal(null); };

  const picker = (title, t, setter, qtyPlaceholder) => (
    <div style={{ marginBottom: 14 }}>
      <label style={lab}>{title}</label>
      <input autoFocus placeholder="📷 바코드 스캔 후 Enter"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scan(e.currentTarget.value, setter); e.currentTarget.value = ''; } }}
        style={{ ...scanBox, marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={t.name} onChange={e => setter(s => ({ ...s, name: e.target.value }))} placeholder="상품명 (직접 입력 가능)" style={{ ...fld, flex: 1 }} />
        <input type="number" min={1} value={t.qty} onChange={e => setter(s => ({ ...s, qty: e.target.value }))} placeholder={String(qtyPlaceholder)} title="수량" style={{ ...fld, width: 72, textAlign: 'center' }} />
      </div>
      {t.code && <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4 }}>코드: {t.code}</div>}
    </div>
  );

  return (
    <div style={{ padding: '12px 14px', background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 'var(--radius)' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6a1b9a', marginBottom: 5 }}>🛠️ 처리방법 *</label>
      <select value={value.action_type} onChange={e => setAction(e.target.value)}
        style={{ height: 36, padding: '0 10px', border: '1px solid #ce93d8', borderRadius: 4, fontSize: 13, background: '#fff', outline: 'none', maxWidth: 340, width: '100%', boxSizing: 'border-box' }}>
        {RET_ACTIONS.map(x => <option key={x.key}>{x.key}</option>)}
      </select>

      {/* 선택된 교환·증정 요약 */}
      {!a.refund && (a.needEx || a.needGift) && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {a.needEx && <span>🔄 교환: <b>{value.exchange.name || '(미지정)'}</b>{value.exchange.qty ? ` ×${value.exchange.qty}` : ''}</span>}
          {a.needGift && <span>🎁 증정: <b>{value.gift.name || '(미지정)'}</b>{value.gift.qty ? ` ×${value.gift.qty}` : ''}</span>}
          <button type="button" onClick={() => setAction(value.action_type)} style={{ fontSize: 11, border: '1px solid #ce93d8', borderRadius: 4, background: '#fff', padding: '2px 8px', cursor: 'pointer', color: '#6a1b9a', fontWeight: 700 }}>상품 다시 선택</button>
        </div>
      )}
      {!a.refund && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6a1b9a' }}>
          💡 교환·증정은 <b>매출·환불 변화 없이</b> 재고만 반영됩니다. 클레임 현황에 기록됩니다.
        </div>
      )}

      {/* 좌: 구매상품(회수) / 우: 교환·증정상품 팝업 */}
      {modal && (() => {
        const na = getRetAction(modal.action);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={cancelModal} />
            <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: 'min(680px, 95vw)', maxHeight: '88vh', overflow: 'auto', padding: '22px 24px', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔄 {modal.action}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>왼쪽 회수 상품을 확인하고, 오른쪽에 교환·증정 상품을 입력하세요</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {/* 왼쪽: 구매상품(회수) */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', background: '#fafafa' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>📦 구매상품 (회수)</div>
                  {returnedItems.length === 0
                    ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>반품(회수)할 상품·수량을 먼저 선택하세요</div>
                    : returnedItems.map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: i < returnedItems.length - 1 ? '1px solid #eee' : 'none' }}>
                        <span style={{ fontSize: 13 }}>{r.name || '(상품)'}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)' }}>×{r.qty}</span>
                      </div>
                    ))}
                  {returnedItems.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '2px solid var(--border)', fontSize: 12, fontWeight: 700 }}>
                      <span>합계</span><span style={{ fontFamily: 'var(--mono)' }}>×{totalReturned}</span>
                    </div>
                  )}
                </div>

                {/* 오른쪽: 교환·증정상품 */}
                <div style={{ border: '1px solid #ce93d8', borderRadius: 8, padding: '12px 14px', background: '#faf4fc' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a', marginBottom: 10 }}>🎁 교환·증정 상품</div>
                  {na.needEx   && picker('🔄 교환할 다른상품 (재고 −수량)', tEx, setTEx, totalReturned || 1)}
                  {na.needGift && picker('🎁 서비스증정 상품 (재고 −수량)', tGift, setTGift, 1)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button type="button" onClick={cancelModal} style={{ height: 40, padding: '0 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button type="button" onClick={confirmModal} style={{ height: 40, padding: '0 24px', border: 'none', borderRadius: 'var(--radius)', background: '#6a1b9a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>확인</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
