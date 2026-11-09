import React from 'react';
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
export const emptyClaimAction = () => ({ action_type: '환불', exchange: { name: '', code: '' }, gift: { name: '', code: '' } });

const findProduct = async (code) => {
  const c = String(code || '').trim(); if (!c) return null;
  let { data } = await supabase.from('products').select('name, code').eq('code', c).limit(1);
  if (!data || data.length === 0) ({ data } = await supabase.from('products').select('name, code').eq('erp_code', c).limit(1));
  return data?.[0] ? { name: data[0].name, code: data[0].code || c } : { name: '', code: c, notFound: true };
};

const scanBox = { height: 34, padding: '0 10px', border: '2px solid #6a1b9a', borderRadius: 4, fontSize: 13, outline: 'none', width: 220, background: '#fff', boxSizing: 'border-box' };
const nameBox = { height: 34, padding: '0 10px', border: '1px solid #ce93d8', borderRadius: 4, fontSize: 13, outline: 'none', flex: '1 1 160px', background: '#fff', boxSizing: 'border-box' };

export default function ClaimActionPicker({ value, onChange }) {
  const a = getRetAction(value.action_type);
  const setAction = (key) => {
    const na = getRetAction(key);
    onChange({
      action_type: key,
      exchange: na.needEx ? value.exchange : { name: '', code: '' },
      gift: na.needGift ? value.gift : { name: '', code: '' },
    });
  };
  const scan = async (code, field) => {
    const p = await findProduct(code); if (!p) return;
    onChange({ ...value, [field]: { name: p.name, code: p.code } });
    if (p.notFound) toast('상품관리에 없는 코드입니다', 'err'); else toast(`인식: ${p.name}`, 'ok');
  };

  const picker = (field, label) => {
    const t = value[field] || { name: '', code: '' };
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6a1b9a', marginBottom: 4 }}>{label}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="📷 바코드 스캔 후 Enter"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scan(e.currentTarget.value, field); e.currentTarget.value = ''; } }}
            style={scanBox} />
          <input value={t.name} onChange={e => onChange({ ...value, [field]: { ...t, name: e.target.value } })}
            placeholder="상품명 (직접 입력 가능)" style={nameBox} />
          {t.code && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>코드: {t.code}</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '12px 14px', background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 'var(--radius)' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6a1b9a', marginBottom: 5 }}>🛠️ 처리방법 *</label>
      <select value={value.action_type} onChange={e => setAction(e.target.value)}
        style={{ height: 36, padding: '0 10px', border: '1px solid #ce93d8', borderRadius: 4, fontSize: 13, background: '#fff', outline: 'none', maxWidth: 340, width: '100%', boxSizing: 'border-box' }}>
        {RET_ACTIONS.map(x => <option key={x.key}>{x.key}</option>)}
      </select>
      {a.needEx   && picker('exchange', '🔄 교환할 다른상품 (재고 −수량)')}
      {a.needGift && picker('gift', '🎁 서비스증정 상품 (재고 −1)')}
      {!a.refund && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6a1b9a' }}>
          💡 교환·증정은 <b>매출·환불 변화 없이</b> 재고만 반영됩니다{a.needEx && ' (회수상품 +수량 · 교환상품 −수량)'}{a.needGift && ' · 증정상품 −1'}. 클레임 현황에 기록됩니다.
        </div>
      )}
    </div>
  );
}
