import React, { useState, useMemo, useRef } from 'react';

const label = (p) => `${p.product_name || '(이름없음)'} [${p.erp_code || '-'}]`;

// 제품 검색 → 입력 텍스트가 포함된 상품을 바로 아래 리스트로 표시 → 클릭해 선택
export default function ProductPicker({ products, value, onChange }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const selected = useMemo(() => products.find(p => String(p.id) === String(value)), [products, value]);

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return [];
    return products
      .filter(p => `${p.erp_code || ''} ${p.product_name || ''}`.toLowerCase().includes(t))
      .slice(0, 20);
  }, [products, text]);

  const pick = (p) => {
    onChange(String(p.id), p);
    setText('');
    setOpen(false);
  };
  const clear = () => { onChange('', null); setText(''); setOpen(false); };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--sidebar)', background: '#f1f8e9', borderRadius: 'var(--radius)' }}>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
          <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(selected)}</span>
          <button type="button" onClick={clear}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            변경 ✕
          </button>
        </div>
      ) : (
        <>
          <input className="input" value={text} autoCapitalize="none"
            placeholder="ERP코드·상품명 입력"
            onChange={e => { setText(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)} />
          {open && text.trim() && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
              background: '#fff', border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
              boxShadow: '0 6px 24px rgba(0,0,0,0.13)', maxHeight: 280, overflowY: 'auto' }}>
              {matches.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>검색 결과가 없습니다</div>
              ) : matches.map(p => (
                <button key={p.id} type="button" className="flyout-item"
                  onMouseDown={() => pick(p)}
                  style={{ width: '100%', background: '#fff' }}>
                  <span style={{ display: 'block', width: '100%' }}>
                    <span style={{ fontWeight: 600 }}>{p.product_name || '(이름없음)'}</span>
                    <span style={{ marginLeft: 6, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{p.erp_code || '-'}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
