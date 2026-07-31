import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { SC, S_DATA_START, S_PERIOD_ROW, GRADE_TABLE } from './constants';
import { supabase } from './supabase';

// ════════════════════════════════════════════════════════
// GLOBAL STYLE INJECTOR
// ════════════════════════════════════════════════════════
export function useStyle(css) {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════
let _toast = null;
export function toast(msg, type = 'ok') { _toast?.(msg, type); }

export function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    _toast = (msg, type) => {
      const id = Date.now();
      setList(p => [...p, { id, msg, type }]);
      setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3200);
    };
  }, []);
  const icon = { ok: '✓', err: '✕', inf: 'ℹ' };
  return (
    <div className="toasts">
      {list.map(t => (
        <div key={t.id} className={`toast t-${t.type}`}>
          <span>{icon[t.type]}</span><span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 정렬 훅
// ════════════════════════════════════════════════════════
export function useSort(initKey = '') {
  const [key, setKey] = useState(initKey);
  const [dir, setDir] = useState('asc');
  const toggle = (k) => { if (key === k) setDir(d => d === 'asc' ? 'desc' : 'asc'); else { setKey(k); setDir('asc'); } };
  const thClass = (k) => key === k ? (dir === 'asc' ? 's-a' : 's-d') : '';
  return { key, dir, toggle, thClass };
}

export function sortRows(rows, key, dir) {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? 0, bv = b[key] ?? 0;
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ko');
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function uniq(arr) {
  return [...new Set(arr)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
}

// ════════════════════════════════════════════════════════
// 금액 콤마 포맷 (text input용)
// ════════════════════════════════════════════════════════
// 입력 문자열을 천단위 콤마 표시 문자열로. 음수/빈값 허용.
export function formatNumInput(val) {
  if (val === '' || val == null) return '';
  const s = String(val);
  const neg = s.trim().startsWith('-');
  const digits = s.replace(/[^\d]/g, '');
  if (digits === '') return neg ? '-' : '';
  const out = Number(digits).toLocaleString('en-US');
  return neg ? `-${out}` : out;
}
// 콤마 포함 문자열에서 숫자만 추출 (저장/계산용)
export function parseNumInput(val) {
  if (val === '' || val == null) return '';
  const s = String(val).trim();
  const neg = s.startsWith('-');
  const digits = s.replace(/[^\d]/g, '');
  if (digits === '') return neg ? '-' : '';
  return (neg ? '-' : '') + digits;
}

// ════════════════════════════════════════════════════════
// 전화번호 포맷
// ════════════════════════════════════════════════════════
export function formatPhone(val) {
  const num = val.replace(/\D/g, '').slice(0, 11);
  if (num.length < 4) return num;
  if (num.length < 8) return `${num.slice(0,3)}-${num.slice(3)}`;
  return `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`;
}

// ════════════════════════════════════════════════════════
// 회원 등급 유틸
// ════════════════════════════════════════════════════════
export const getGrade = (total) =>
  GRADE_TABLE.find(g => total >= g.min) || GRADE_TABLE[GRADE_TABLE.length - 1];

// 판매 1건 삭제 시 원복: 회원 적립금(적립 회수+사용 복원)·구매액·등급, 매장재고.
// sale에는 customer_id, points_earned, points_used, price, quantity, store_name,
// branch_name, delivery_type, payment, product:{code}(또는 product_code)가 필요.
// 같은 회원 여러 건은 순차(await)로 호출해야 정확히 누적된다.
export async function reverseSaleEffects(sale) {
  if (!sale) return;
  if (sale.customer_id) {
    const { data: cust } = await supabase.from('customers')
      .select('total_points, used_points, total_purchase, purchase_qty').eq('id', sale.customer_id).single();
    if (cust) {
      const lineAmt  = (Number(sale.price) || 0) * (Number(sale.quantity) || 0);
      const newPurch = Math.max(0, (cust.total_purchase || 0) - lineAmt);
      await supabase.from('customers').update({
        total_points:   Math.max(0, (cust.total_points || 0) - (sale.points_earned || 0) + (sale.points_used || 0)),
        used_points:    Math.max(0, (cust.used_points || 0) - (sale.points_used || 0)),
        total_purchase: newPurch,
        grade:          getGrade(newPurch).grade,
        purchase_qty:   Math.max(0, (cust.purchase_qty || 0) - (Number(sale.quantity) || 0)),  // 구매수량 원복
      }).eq('id', sale.customer_id);
    }
  }
  const code = sale.product?.code || sale.product_code;
  if (code && sale.delivery_type !== 'hq' && sale.payment !== '강좌매출') {
    const { data: stockRow } = await supabase.from('store_stock')
      .select('id, stock_qty')
      .eq('store_name', sale.store_name).eq('branch_name', sale.branch_name).eq('product_code', code)
      .maybeSingle();
    if (stockRow) {
      await supabase.from('store_stock')
        .update({ stock_qty: (stockRow.stock_qty || 0) + (Number(sale.quantity) || 0), updated_at: new Date().toISOString() })
        .eq('id', stockRow.id);
    }
  }
}

// 해당 (회원, 판매일)에 남은 판매가 없으면 구매건수(방문) 1 감소.
// 판매 삭제 후 호출하며, 한 방문(같은 날짜)당 1번만 호출해야 함(중복 호출 시 과다 차감).
export async function decrementVisitIfEmpty(customerId, soldAt) {
  if (!customerId || !soldAt) return;
  const { count } = await supabase.from('sales').select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId).eq('sold_at', soldAt).neq('payment', '구매이력');
  if ((count || 0) === 0) {
    const { data: c } = await supabase.from('customers').select('purchase_count').eq('id', customerId).single();
    if (c) await supabase.from('customers').update({ purchase_count: Math.max(0, (c.purchase_count || 0) - 1) }).eq('id', customerId);
  }
}

export const GradeBadge = ({ grade }) => {
  const g = GRADE_TABLE.find(x => x.grade === grade) || GRADE_TABLE[GRADE_TABLE.length - 1];
  return (
    <span style={{ padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, background:g.bg, color:g.color, whiteSpace:'nowrap' }}>
      {g.grade}
    </span>
  );
};

// ════════════════════════════════════════════════════════
// 안전재고 엑셀 파싱
// ════════════════════════════════════════════════════════
export function parseSubul(binary) {
  const wb = XLSX.read(binary, { type: 'binary' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const periodStr = String(raw[S_PERIOD_ROW]?.[0] || '')
    .replace('조회기간 :', '').replace('조회기간:', '').trim();
  const rows = [];
  for (let i = S_DATA_START; i < raw.length; i++) {
    const row = raw[i];
    const dept  = String(row[SC.DEPT]  || '').trim();
    const store = String(row[SC.STORE] || '').trim();
    const code  = String(row[SC.CODE]  || '').trim();
    const name  = String(row[SC.NAME]  || '').trim();
    if (!dept || !code || dept === '합계') continue;
    const stock = Number(row[SC.STOCK]) || 0;
    const sales = Number(row[SC.SALES]) || 0;
    rows.push({ dept, store, code, name, stock, sales });
  }
  return { rows, periodStr };
}

// ════════════════════════════════════════════════════════
// 파일 다운로드
// ════════════════════════════════════════════════════════
export function dlBlob(buf, filename) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
