import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// 실제 화면 위에 스포트라이트(한 영역만 밝게 + 나머지 어둡게) + 설명 말풍선으로
// 단계별 따라하기 안내를 보여주는 컴포넌트.
//  steps: [{ selector: 'data-tour 값', title, body }]
//  containerRef: 대상 요소를 찾을 컨테이너 (해당 실제 화면이 렌더된 영역)
//  onClose: 종료 콜백
export default function GuideTour({ steps, containerRef, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[i];
  const PAD = 8;

  const measure = useCallback(() => {
    const root = containerRef?.current;
    if (!root || !step) { setRect(null); return; }
    const el = step.selector ? root.querySelector(`[data-tour="${step.selector}"]`) : null;
    if (el) {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [step, containerRef]);

  useEffect(() => {
    measure();
    const t1 = setTimeout(measure, 250); // 스크롤/레이아웃 반영 후 재측정
    const t2 = setTimeout(measure, 550);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!step) return null;
  const last = i === steps.length - 1;
  const next = () => { if (last) onClose(); else setI(v => v + 1); };

  const hole = rect ? {
    top: rect.top - PAD, left: rect.left - PAD,
    width: rect.width + PAD * 2, height: rect.height + PAD * 2,
  } : null;

  // 말풍선 위치: 홀 아래에 두되 화면 하단이면 위로
  const vh = window.innerHeight, vw = window.innerWidth;
  const CAP_W = Math.min(360, vw - 32);
  let capTop, capLeft;
  if (hole) {
    const below = hole.top + hole.height + 14;
    const wantAbove = below + 190 > vh;
    capTop = wantAbove ? Math.max(12, hole.top - 190 - 14) : below;
    capLeft = Math.min(Math.max(12, hole.left), vw - CAP_W - 12);
  } else {
    capTop = vh / 2 - 90; capLeft = vw / 2 - CAP_W / 2;
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, fontFamily: 'var(--sans)' }}>
      {/* 클릭 차단 레이어 (투어 중 실제 화면 조작 방지) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 100000 }} />
      {/* 스포트라이트 (홀 없으면 전체 어둡게) */}
      {hole ? (
        <div style={{
          position: 'fixed', top: hole.top, left: hole.left, width: hole.width, height: hole.height,
          borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
          border: '2px solid #ffb300', zIndex: 100001, pointerEvents: 'none',
          transition: 'top 220ms, left 220ms, width 220ms, height 220ms',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 100001, pointerEvents: 'none' }} />
      )}

      {/* 설명 말풍선 */}
      <div style={{
        position: 'fixed', top: capTop, left: capLeft, width: CAP_W, zIndex: 100002,
        background: '#fff', borderRadius: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        padding: '16px 18px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--accent)', borderRadius: 20, padding: '2px 10px' }}>
            {i + 1} / {steps.length}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{step.title}</span>
          <button onClick={onClose} title="닫기" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.75, whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{step.body}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <button onClick={onClose}
            style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}>
            건너뛰기
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {i > 0 && (
              <button onClick={() => setI(v => Math.max(0, v - 1))}
                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                이전
              </button>
            )}
            <button onClick={next}
              style={{ height: 34, padding: '0 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {last ? '완료' : 'SKIP ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
