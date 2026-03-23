import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// ════════════════════════════════════════════════════════
// SUPABASE
// ════════════════════════════════════════════════════════
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ════════════════════════════════════════════════════════
// GLOBAL CSS
// ════════════════════════════════════════════════════════
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+KR:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #f5f5f5;
    --bg2:     #ffffff;
    --bg3:     #f0f0f0;
    --border:  #e0e0e0;
    --border2: #cccccc;
    --sidebar: #FFD600;
    --sidebar-hover: #FFC200;
    --sidebar-active: #FF8F00;
    --sidebar-text: #1a1a1a;
    --accent:  #FF8F00;
    --accent2: #1565C0;
    --danger:  #C62828;
    --success: #2E7D32;
    --text:    #1a1a1a;
    --text2:   #555555;
    --text3:   #999999;
    --radius:  6px;
    --mono:    'IBM Plex Mono', monospace;
    --sans:    'Noto Sans KR', sans-serif;
    --sidebar-w: 220px;
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 13px; line-height: 1.6; -webkit-font-smoothing: antialiased; }

  /* ── AUTH ── */
  .auth-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
  .auth-box { width: 380px; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .auth-logo { text-align: center; margin-bottom: 6px; }
  .auth-logo-icon { font-size: 36px; }
  .auth-logo-text { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--sidebar-active); letter-spacing: -0.5px; }
  .auth-sub { text-align: center; font-size: 12px; color: var(--text3); margin-bottom: 28px; }
  .auth-tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 24px; }
  .auth-tab { flex: 1; padding: 8px; background: none; border: none; font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--text3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 120ms; }
  .auth-tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: 11px; font-weight: 500; color: var(--text2); margin-bottom: 5px; }
  .input { width: 100%; height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--sans); font-size: 13px; background: #fafafa; outline: none; transition: border-color 120ms; }
  .input:focus { border-color: var(--accent); background: #fff; }
  .input::placeholder { color: var(--text3); }
  .btn-auth { width: 100%; height: 40px; background: var(--sidebar); border: none; border-radius: var(--radius); font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--sidebar-text); cursor: pointer; transition: background 120ms; margin-top: 4px; }
  .btn-auth:hover { background: var(--sidebar-hover); }
  .btn-auth:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-msg { text-align: center; font-size: 12px; margin-top: 12px; padding: 10px; border-radius: var(--radius); }
  .auth-msg.err { background: #fdecea; color: var(--danger); }
  .auth-msg.ok  { background: #e8f5e9; color: var(--success); }

  /* ── PENDING ── */
  .pending-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
  .pending-box { text-align: center; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 48px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); max-width: 400px; }
  .pending-icon { font-size: 48px; margin-bottom: 16px; }
  .pending-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .pending-desc { font-size: 13px; color: var(--text2); line-height: 1.8; margin-bottom: 20px; }
  .btn-logout-sm { padding: 7px 16px; border: 1px solid var(--border2); border-radius: var(--radius); background: transparent; font-family: var(--sans); font-size: 12px; color: var(--text2); cursor: pointer; }
  .btn-logout-sm:hover { background: var(--bg3); }

  /* ── APP LAYOUT ── */
  .app-layout { display: flex; min-height: 100vh; }

  /* ── SIDEBAR ── */
  .sidebar { width: var(--sidebar-w); background: var(--sidebar); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
  .sidebar-logo { padding: 20px 18px 16px; border-bottom: 1px solid rgba(0,0,0,0.1); }
  .sidebar-logo-icon { font-size: 22px; }
  .sidebar-logo-text { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--sidebar-text); letter-spacing: -0.3px; margin-top: 2px; }
  .sidebar-logo-sub { font-size: 10px; color: rgba(0,0,0,0.45); margin-top: 1px; }
  .sidebar-section { padding: 12px 10px 4px; font-size: 9px; font-weight: 700; color: rgba(0,0,0,0.4); letter-spacing: 2px; text-transform: uppercase; }
  .sidebar-menu { flex: 1; padding: 6px 8px; overflow-y: auto; }
  .sidebar-item { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 6px; cursor: pointer; transition: background 120ms; margin-bottom: 2px; font-size: 13px; font-weight: 500; color: var(--sidebar-text); border: none; background: none; width: 100%; text-align: left; }
  .sidebar-item:hover { background: rgba(0,0,0,0.08); }
  .sidebar-item.on { background: rgba(0,0,0,0.15); font-weight: 600; }
  .sidebar-item-icon { font-size: 15px; flex-shrink: 0; }
  .sidebar-bottom { padding: 12px 8px; border-top: 1px solid rgba(0,0,0,0.1); }
  .sidebar-user { padding: 8px 10px; font-size: 11px; color: rgba(0,0,0,0.55); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sidebar-logout { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; color: rgba(0,0,0,0.6); background: none; border: none; width: 100%; transition: background 120ms; }
  .sidebar-logout:hover { background: rgba(0,0,0,0.08); }

  /* ── CONTENT ── */
  .content { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .content-header { background: #fff; border-bottom: 1px solid var(--border); padding: 0 28px; height: 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
  .content-title { font-size: 15px; font-weight: 600; color: var(--text); }
  .content-body { padding: 24px 28px; flex: 1; }

  /* ── ADMIN ── */
  .admin-badge { display: inline-flex; padding: 2px 8px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 4px; font-size: 10px; font-weight: 600; color: var(--accent); font-family: var(--mono); }
  .user-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .user-table th { background: var(--bg3); padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text2); border-bottom: 1px solid var(--border); }
  .user-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .user-table tr:hover td { background: #fafafa; }
  .user-table tr:last-child td { border-bottom: none; }
  .status-badge { display: inline-flex; padding: 2px 9px; border-radius: 99px; font-size: 11px; font-weight: 500; }
  .status-ok  { background: #e8f5e9; color: var(--success); }
  .status-wait { background: #fff8e1; color: #E65100; }

  /* ── CARDS ── */
  .card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 16px; }
  .card-label { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .card-label::before { content: ''; display: block; width: 3px; height: 12px; background: var(--sidebar); border-radius: 2px; }

  /* ── DROP ZONE ── */
  .drop { border: 2px dashed var(--border2); border-radius: var(--radius); padding: 44px 24px; text-align: center; cursor: pointer; background: #fafafa; position: relative; transition: all 140ms ease; }
  .drop:hover, .drop.over { border-color: var(--accent); background: #fff8e1; }
  .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .drop-icon { font-size: 28px; margin-bottom: 8px; }
  .drop-main { font-weight: 500; color: var(--text); margin-bottom: 4px; }
  .drop-main strong { color: var(--accent); }
  .drop-sub { font-size: 11px; color: var(--text3); font-family: var(--mono); }
  .drop-filename { display: inline-flex; align-items: center; gap: 8px; background: #fff3e0; border: 1px solid #ffcc80; color: var(--accent); font-family: var(--mono); font-size: 12px; padding: 5px 14px; border-radius: var(--radius); margin-top: 10px; }

  /* ── STATS ── */
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
  @media (max-width: 900px) { .stats { grid-template-columns: repeat(3, 1fr); } }
  .stat { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
  .stat-l { font-size: 9px; font-weight: 600; color: var(--text3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
  .stat-v { font-family: var(--mono); font-size: 22px; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat-u { font-size: 10px; color: var(--text3); margin-top: 4px; }

  /* ── TABS ── */
  .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
  .tab { padding: 9px 20px; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--text3); cursor: pointer; transition: all 120ms; }
  .tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover:not(.on) { color: var(--text2); }

  /* ── FILTER ── */
  .fbar { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  .fsel, .finput { height: 32px; padding: 0 10px; border-radius: var(--radius); border: 1px solid var(--border); background: #fff; color: var(--text); font-family: var(--sans); font-size: 12px; outline: none; transition: border-color 120ms; }
  .fsel:focus, .finput:focus { border-color: var(--accent); }
  .finput { min-width: 200px; }
  .finput::placeholder { color: var(--text3); }
  .fbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .fresult { font-size: 12px; color: var(--text3); font-family: var(--mono); }
  .fresult b { color: var(--accent); }

  /* ── BUTTONS ── */
  .btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--sans); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 120ms ease; white-space: nowrap; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-p { background: var(--sidebar); color: var(--sidebar-text); border-color: var(--sidebar); }
  .btn-p:hover:not(:disabled) { background: var(--sidebar-hover); }
  .btn-s { background: transparent; color: var(--text2); border-color: var(--border2); }
  .btn-s:hover:not(:disabled) { background: var(--bg3); }
  .btn-success { background: #e8f5e9; color: var(--success); border-color: #a5d6a7; }
  .btn-success:hover:not(:disabled) { background: #c8e6c9; }
  .btn-ghost { background: transparent; color: var(--text3); border: none; font-size: 11px; padding: 4px 8px; cursor: pointer; }
  .btn-ghost:hover { color: var(--text2); }

  /* ── TABLE ── */
  .twrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: var(--bg3); border-bottom: 1px solid var(--border2); }
  th { font-size: 10px; font-weight: 600; color: var(--text2); letter-spacing: 0.8px; padding: 9px 11px; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; text-transform: uppercase; }
  th:hover { color: var(--text); }
  th.s-a::after { content: ' ↑'; color: var(--accent); }
  th.s-d::after { content: ' ↓'; color: var(--accent); }
  th.r { text-align: right; }
  td { padding: 9px 11px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  td.r { text-align: right; font-family: var(--mono); font-size: 12px; }
  td.mono { font-family: var(--mono); font-size: 11px; color: var(--text2); }
  tr:hover td { background: #fffde7; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-flex; padding: 2px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
  .badge-dept  { background: #fff3e0; color: #E65100; border: 1px solid #ffcc80; }
  .badge-store { background: #e3f2fd; color: #1565C0; border: 1px solid #90caf9; }
  .safety-num { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); }
  .wk-head { text-align: center !important; }
  .wk-head.latest { color: #C62828 !important; }
  .wk-cell { text-align: right; font-family: var(--mono); font-size: 12px; }
  .wk-cell.latest-col { background: #fff8e1; }
  .wk-cell.zero { color: var(--text3); }
  .wk-total { font-weight: 700; color: var(--accent); }
  .wtabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .wtab { padding: 4px 12px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--mono); font-size: 10px; color: var(--text2); cursor: default; }
  .wtab.on { background: #fff3e0; border-color: #ffcc80; color: #E65100; }

  /* ── EMPTY / LOADING ── */
  .empty { text-align: center; padding: 60px 24px; font-size: 12px; color: var(--text3); line-height: 2.4; }
  .spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── TOAST ── */
  .toasts { position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 6px; }
  .toast { display: flex; align-items: center; gap: 9px; padding: 11px 16px; border-radius: var(--radius); border: 1px solid; font-family: var(--mono); font-size: 11px; min-width: 220px; box-shadow: 0 2px 12px rgba(0,0,0,0.12); animation: tIn 180ms ease; }
  .t-ok  { background: #e8f5e9; border-color: #a5d6a7; color: var(--success); }
  .t-err { background: #fdecea; border-color: #ef9a9a; color: var(--danger); }
  .t-inf { background: #e3f2fd; border-color: #90caf9; color: var(--accent2); }
  @keyframes tIn { from { opacity:0; transform: translateX(10px); } to { opacity:1; transform: none; } }
`;

// ════════════════════════════════════════════════════════
// STYLE INJECT
// ════════════════════════════════════════════════════════
function useStyle(css) {
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
function toast(msg, type = 'ok') { _toast?.(msg, type); }

function Toasts() {
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
// AUTH SCREEN
// ════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode, setMode]       = useState('login');
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null); // {text, type}

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        if (pw.length < 6) throw new Error('비밀번호는 6자리 이상이어야 합니다');
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg({ text: '회원가입이 완료됐어요. 관리자 승인 후 로그인 가능합니다.', type: 'ok' });
        setMode('login');
      }
    } catch (err) {
      const ko = err.message
        .replace('Invalid login credentials', '이메일 또는 비밀번호가 틀렸습니다')
        .replace('User already registered', '이미 가입된 이메일입니다')
        .replace('Email not confirmed', '이메일 인증이 필요합니다');
      setMsg({ text: ko, type: 'err' });
    }
    setLoading(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-icon">🏬</div>
          <div className="auth-logo-text">재고관리 대시보드</div>
        </div>
        <div className="auth-sub">백화점 매장 판매·재고 관리 시스템</div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'on' : ''}`} onClick={() => { setMode('login'); setMsg(null); }}>로그인</button>
          <button className={`auth-tab ${mode === 'signup' ? 'on' : ''}`} onClick={() => { setMode('signup'); setMsg(null); }}>회원가입</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>이메일</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일 주소" required />
          </div>
          <div className="form-group">
            <label>비밀번호 {mode === 'signup' && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(6자리 이상)</span>}</label>
            <input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="비밀번호" required minLength={6} />
          </div>
          <button className="btn-auth" type="submit" disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입 신청'}
          </button>
        </form>

        {msg && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}

        {mode === 'signup' && (
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 14, lineHeight: 1.7 }}>
            회원가입 후 관리자 승인이 필요합니다.<br />
            승인 완료 후 로그인하실 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PENDING APPROVAL SCREEN
// ════════════════════════════════════════════════════════
function PendingScreen({ email }) {
  const handleLogout = async () => { await supabase.auth.signOut(); };
  return (
    <div className="pending-wrap">
      <div className="pending-box">
        <div className="pending-icon">⏳</div>
        <div className="pending-title">승인 대기 중</div>
        <div className="pending-desc">
          <strong>{email}</strong><br />
          계정 승인을 기다리고 있습니다.<br />
          관리자 승인 후 로그인이 가능합니다.
        </div>
        <button className="btn-logout-sm" onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADMIN — USER MANAGEMENT
// ════════════════════════════════════════════════════════
function AdminTab() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast(error.message, 'err');
    else setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const approve = async (id) => {
    const { error } = await supabase.from('profiles').update({ approved: true }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('승인 완료', 'ok'); fetchUsers(); }
  };

  const setRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('권한 변경 완료', 'ok'); fetchUsers(); }
  };

  const pending = users.filter(u => !u.approved);
  const approved = users.filter(u => u.approved);

  return (
    <div>
      {pending.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid #E65100' }}>
          <div className="card-label" style={{ color: '#E65100' }}>승인 대기 ({pending.length}명)</div>
          <table className="user-table">
            <thead>
              <tr><th>이메일</th><th>가입일</th><th>상태</th><th>처리</th></tr>
            </thead>
            <tbody>
              {pending.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td><span className="status-badge status-wait">대기 중</span></td>
                  <td>
                    <button className="btn btn-success" onClick={() => approve(u.id)}>✓ 승인</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-label">전체 사용자 ({users.length}명)</div>
        {loading ? <div className="empty"><span className="spinner" /></div> : (
          <table className="user-table">
            <thead>
              <tr><th>이메일</th><th>권한</th><th>상태</th><th>가입일</th><th>권한 변경</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    {u.role === 'admin'
                      ? <span className="admin-badge">ADMIN</span>
                      : <span style={{ fontSize: 12, color: 'var(--text2)' }}>일반</span>}
                  </td>
                  <td>
                    <span className={`status-badge ${u.approved ? 'status-ok' : 'status-wait'}`}>
                      {u.approved ? '승인됨' : '대기 중'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td>
                    {u.role !== 'admin'
                      ? <button className="btn btn-s" style={{ fontSize: 11 }} onClick={() => setRole(u.id, 'admin')}>관리자로</button>
                      : <button className="btn btn-s" style={{ fontSize: 11 }} onClick={() => setRole(u.id, 'user')}>일반으로</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// GOODMD PARSING
// ════════════════════════════════════════════════════════
const C = { DATE: 2, DEPT: 3, STORE: 4, TYPE: 7, CODE: 8, NAME: 9, QTY: 11 };
const DATA_START_ROW = 8;
const PERIOD_ROW = 2;

function parseGoodMD(binary) {
  const wb = XLSX.read(binary, { type: 'binary', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const periodStr = String(raw[PERIOD_ROW]?.[0] || '').replace('기간 : ', '').trim();
  const records = [];
  for (let i = DATA_START_ROW; i < raw.length; i++) {
    const row = raw[i];
    if (!row[C.DATE]) continue;
    if (String(row[C.TYPE]).trim() !== '정상') continue;
    const qty = Number(row[C.QTY]);
    if (!qty || qty <= 0) continue;
    let date = row[C.DATE] instanceof Date ? new Date(row[C.DATE]) : new Date(String(row[C.DATE]));
    if (isNaN(date.getTime())) continue;
    records.push({ date, dept: String(row[C.DEPT]).trim(), store: String(row[C.STORE]).trim(), code: String(row[C.CODE]).trim(), name: String(row[C.NAME]).trim(), qty });
  }
  return { records, periodStr };
}

// ════════════════════════════════════════════════════════
// AGGREGATIONS
// ════════════════════════════════════════════════════════
function buildSafetyRows(records) {
  const map = new Map();
  for (const r of records) {
    const key = `${r.dept}|||${r.store}|||${r.code}`;
    if (!map.has(key)) map.set(key, { dept: r.dept, store: r.store, code: r.code, name: r.name, total: 0 });
    map.get(key).total += r.qty;
  }
  return [...map.values()];
}

function weekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function weekSunday(mon) { const d = new Date(mon); d.setDate(d.getDate() + 6); return d; }
function fmtDate(d) { return `${d.getMonth()+1}/${d.getDate()}`; }
function fmtWeek(mon) { return `${fmtDate(mon)}~${fmtDate(weekSunday(mon))}`; }
function isoWeek(date) { return weekMonday(date).toISOString().slice(0, 10); }

function buildWeekPivot(records) {
  const weekSet = new Set(records.map(r => isoWeek(r.date)));
  const weeks = [...weekSet].sort();
  const map = new Map();
  for (const r of records) {
    const key = `${r.dept}|||${r.store}|||${r.code}`;
    if (!map.has(key)) {
      const wq = {};
      weeks.forEach(w => { wq[w] = 0; });
      map.set(key, { dept: r.dept, store: r.store, code: r.code, name: r.name, wq, total: 0 });
    }
    const e = map.get(key);
    e.wq[isoWeek(r.date)] += r.qty;
    e.total += r.qty;
  }
  return { weeks, rows: [...map.values()] };
}

// ════════════════════════════════════════════════════════
// EXCEL EXPORT
// ════════════════════════════════════════════════════════
async function exportSafety(rows, period) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('안전재고현황');
  ws.columns = [
    { key: 'dept', width: 14 }, { key: 'store', width: 16 },
    { key: 'code', width: 18 }, { key: 'name', width: 36 },
    { key: 'total', width: 14 }, { key: 'safe', width: 12 },
  ];
  const hr = ws.addRow(['백화점', '매장', '상품코드', '상품명', `기간 판매수량(${period})`, '안전재고']);
  hr.height = 24;
  hr.eachCell(cell => {
    cell.font = { bold: true, name: 'Malgun Gothic', size: 10, color: { argb: 'FF1A1A1A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD600' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rows.forEach((r, i) => {
    const row = ws.addRow([r.dept, r.store, r.code, r.name, r.total, r.total]);
    row.height = 18;
    row.eachCell((cell, ci) => {
      cell.font = { name: 'Malgun Gothic', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: ci <= 4 ? 'left' : 'center' };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
      if (ci >= 5) cell.font = { name: 'Malgun Gothic', size: 10, bold: true, color: { argb: 'FFBF6000' } };
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `안전재고현황_${period.replace(/\s/g,'')}.xlsx`);
}

async function exportWeekly(rows, weeks, period) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('주간발주참고');
  ws.columns = [
    { key: 'dept', width: 14 }, { key: 'store', width: 16 },
    { key: 'code', width: 18 }, { key: 'name', width: 36 },
    ...weeks.map(() => ({ width: 12 })),
    { key: 'total', width: 10 },
  ];
  const weekLabels = weeks.map((w, i) => `${i+1}주\n${fmtWeek(new Date(w))}`);
  const hr = ws.addRow(['백화점', '매장', '상품코드', '상품명', ...weekLabels, '합계']);
  hr.height = 30;
  hr.eachCell((cell, ci) => {
    cell.font = { bold: true, name: 'Malgun Gothic', size: 10, color: { argb: 'FF1A1A1A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci >= 5 && ci <= 4 + weeks.length ? 'FFFFF3E0' : 'FFFFD600' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  rows.forEach((r, i) => {
    const row = ws.addRow([r.dept, r.store, r.code, r.name, ...weeks.map(w => r.wq[w] || 0), r.total]);
    row.height = 18;
    row.eachCell((cell, ci) => {
      cell.font = { name: 'Malgun Gothic', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: ci <= 4 ? 'left' : 'center' };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
      if (ci === 5 + weeks.length) cell.font.bold = true;
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `주간발주참고_${period.replace(/\s/g,'')}.xlsx`);
}

function dlBlob(buf, filename) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════
// SORT HOOK
// ════════════════════════════════════════════════════════
function useSort(initKey = '') {
  const [key, setKey] = useState(initKey);
  const [dir, setDir] = useState('asc');
  const toggle = (k) => { if (key === k) setDir(d => d === 'asc' ? 'desc' : 'asc'); else { setKey(k); setDir('asc'); } };
  const thClass = (k) => key === k ? (dir === 'asc' ? 's-a' : 's-d') : '';
  return { key, dir, toggle, thClass };
}
function sortRows(rows, key, dir) {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? 0, bv = b[key] ?? 0;
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ko');
    return dir === 'asc' ? cmp : -cmp;
  });
}
function uniq(arr) { return [...new Set(arr)].filter(Boolean).sort((a,b) => a.localeCompare(b,'ko')); }

// ════════════════════════════════════════════════════════
// SAFETY STOCK TAB
// ════════════════════════════════════════════════════════
function SafetyTab({ records, period }) {
  const [fDept, setFDept]   = useState('');
  const [fStore, setFStore] = useState('');
  const [fSearch, setFS]    = useState('');
  const [exporting, setEx]  = useState(false);
  const sort = useSort('dept');

  const allRows = useMemo(() => buildSafetyRows(records), [records]);
  const depts   = useMemo(() => uniq(allRows.map(r => r.dept)), [allRows]);
  const stores  = useMemo(() => uniq((fDept ? allRows.filter(r => r.dept === fDept) : allRows).map(r => r.store)), [allRows, fDept]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (fDept)   rows = rows.filter(r => r.dept === fDept);
    if (fStore)  rows = rows.filter(r => r.store === fStore);
    if (fSearch) { const q = fSearch.toLowerCase(); rows = rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)); }
    return sortRows(rows, sort.key, sort.dir);
  }, [allRows, fDept, fStore, fSearch, sort.key, sort.dir]);

  const totalQty = useMemo(() => filtered.reduce((s,r) => s + r.total, 0), [filtered]);

  return (
    <>
      <div className="fbar">
        <select className="fsel" value={fDept} onChange={e => { setFDept(e.target.value); setFStore(''); }}>
          <option value="">전체 백화점</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
          <option value="">전체 매장</option>
          {stores.map(s => <option key={s}>{s}</option>)}
        </select>
        <input className="finput" placeholder="상품코드 / 상품명 검색" value={fSearch} onChange={e => setFS(e.target.value)} />
        {(fDept || fStore || fSearch) && <button className="btn-ghost" onClick={() => { setFDept(''); setFStore(''); setFS(''); }}>✕ 초기화</button>}
        <div className="fbar-right">
          <span className="fresult"><b>{filtered.length.toLocaleString()}</b>개 · 합계 <b>{totalQty.toLocaleString()}</b>개</span>
          <button className="btn btn-p" onClick={async () => { setEx(true); try { await exportSafety(filtered, period); toast('안전재고 다운로드 완료'); } catch(e) { toast(e.message,'err'); } setEx(false); }} disabled={exporting || !filtered.length}>
            {exporting ? <span className="spinner" /> : '⬇ Excel'}
          </button>
        </div>
      </div>
      <div className="twrap">
        <table>
          <thead>
            <tr>
              <th className={sort.thClass('dept')}  onClick={() => sort.toggle('dept')}>백화점</th>
              <th className={sort.thClass('store')} onClick={() => sort.toggle('store')}>매장</th>
              <th className={sort.thClass('code')}  onClick={() => sort.toggle('code')}>상품코드</th>
              <th className={sort.thClass('name')}  onClick={() => sort.toggle('name')}>상품명</th>
              <th className={'r '+sort.thClass('total')} onClick={() => sort.toggle('total')}>기간 판매수량</th>
              <th className="r">안전재고</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6} className="empty">조회 결과가 없습니다</td></tr>
              : filtered.map((r,i) => (
                <tr key={i}>
                  <td><span className="badge badge-dept">{r.dept}</span></td>
                  <td><span className="badge badge-store">{r.store}</span></td>
                  <td className="mono">{r.code}</td>
                  <td>{r.name}</td>
                  <td className="r">{r.total.toLocaleString()}</td>
                  <td className="r"><span className="safety-num">{r.total.toLocaleString()}</span></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
// WEEKLY TAB
// ════════════════════════════════════════════════════════
function WeeklyTab({ records, period }) {
  const [fDept, setFDept]   = useState('');
  const [fStore, setFStore] = useState('');
  const [fSearch, setFS]    = useState('');
  const [exporting, setEx]  = useState(false);
  const sort = useSort('dept');

  const { weeks, rows: allRows } = useMemo(() => buildWeekPivot(records), [records]);
  const latestWeek = weeks[weeks.length - 1];
  const depts  = useMemo(() => uniq(allRows.map(r => r.dept)), [allRows]);
  const stores = useMemo(() => uniq((fDept ? allRows.filter(r => r.dept === fDept) : allRows).map(r => r.store)), [allRows, fDept]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (fDept)   rows = rows.filter(r => r.dept === fDept);
    if (fStore)  rows = rows.filter(r => r.store === fStore);
    if (fSearch) { const q = fSearch.toLowerCase(); rows = rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)); }
    if (sort.key && sort.key.startsWith('wq_')) {
      const wk = sort.key.replace('wq_','');
      return [...rows].sort((a,b) => { const d=(a.wq[wk]||0)-(b.wq[wk]||0); return sort.dir==='asc'?d:-d; });
    }
    return sortRows(rows, sort.key, sort.dir);
  }, [allRows, fDept, fStore, fSearch, sort.key, sort.dir]);

  const weekTotals = useMemo(() => { const t={}; weeks.forEach(w => { t[w]=filtered.reduce((s,r)=>s+(r.wq[w]||0),0); }); return t; }, [filtered, weeks]);
  const grandTotal = useMemo(() => filtered.reduce((s,r)=>s+r.total,0), [filtered]);

  return (
    <>
      <div className="wtabs">
        {weeks.map((w,i) => (
          <div key={w} className={`wtab ${w===latestWeek?'on':''}`}>
            {w===latestWeek?'★ ':''}{i+1}주차 ({fmtWeek(new Date(w))}) — {(weekTotals[w]||0).toLocaleString()}개
          </div>
        ))}
      </div>
      <div className="fbar">
        <select className="fsel" value={fDept} onChange={e => { setFDept(e.target.value); setFStore(''); }}>
          <option value="">전체 백화점</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
          <option value="">전체 매장</option>
          {stores.map(s => <option key={s}>{s}</option>)}
        </select>
        <input className="finput" placeholder="상품코드 / 상품명 검색" value={fSearch} onChange={e => setFS(e.target.value)} />
        {(fDept || fStore || fSearch) && <button className="btn-ghost" onClick={() => { setFDept(''); setFStore(''); setFS(''); }}>✕ 초기화</button>}
        <div className="fbar-right">
          <span className="fresult"><b>{filtered.length.toLocaleString()}</b>개 · 합계 <b>{grandTotal.toLocaleString()}</b>개</span>
          <button className="btn btn-p" onClick={async () => { setEx(true); try { await exportWeekly(filtered,weeks,period); toast('주간발주 다운로드 완료'); } catch(e) { toast(e.message,'err'); } setEx(false); }} disabled={exporting || !filtered.length}>
            {exporting ? <span className="spinner" /> : '⬇ Excel'}
          </button>
        </div>
      </div>
      <div className="twrap">
        <table>
          <thead>
            <tr>
              <th className={sort.thClass('dept')}  onClick={() => sort.toggle('dept')}>백화점</th>
              <th className={sort.thClass('store')} onClick={() => sort.toggle('store')}>매장</th>
              <th className={sort.thClass('code')}  onClick={() => sort.toggle('code')}>상품코드</th>
              <th className={sort.thClass('name')}  onClick={() => sort.toggle('name')}>상품명</th>
              {weeks.map((w,i) => {
                const isLatest = w===latestWeek;
                const sk = `wq_${w}`;
                return (
                  <th key={w} className={`wk-head r ${isLatest?'latest':''} ${sort.thClass(sk)}`} onClick={() => sort.toggle(sk)}>
                    {isLatest?'★ ':''}{i+1}주<br/><span style={{fontWeight:400,fontSize:9}}>{fmtWeek(new Date(w))}</span>
                  </th>
                );
              })}
              <th className={'r '+sort.thClass('total')} onClick={() => sort.toggle('total')}>합계</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={5+weeks.length} className="empty">조회 결과가 없습니다</td></tr>
              : <>
                  {filtered.map((r,i) => (
                    <tr key={i}>
                      <td><span className="badge badge-dept">{r.dept}</span></td>
                      <td><span className="badge badge-store">{r.store}</span></td>
                      <td className="mono">{r.code}</td>
                      <td>{r.name}</td>
                      {weeks.map(w => {
                        const q = r.wq[w]||0;
                        return <td key={w} className={`wk-cell ${w===latestWeek?'latest-col':''} ${q===0?'zero':''}`}>{q===0?'–':q.toLocaleString()}</td>;
                      })}
                      <td className="r wk-total">{r.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)',borderTop:'2px solid var(--border2)'}}>
                    <td colSpan={4} style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)',padding:'8px 11px'}}>TOTAL ({filtered.length.toLocaleString()}개 항목)</td>
                    {weeks.map(w => <td key={w} className={`wk-cell ${w===latestWeek?'latest-col':''}`} style={{fontWeight:600}}>{(weekTotals[w]||0).toLocaleString()}</td>)}
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)'}}>{grandTotal.toLocaleString()}</td>
                  </tr>
                </>
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
// UPLOAD PAGE
// ════════════════════════════════════════════════════════
function UploadPage() {
  const [parsed, setParsed]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [dragging, setDrag]     = useState(false);
  const [filename, setFilename] = useState('');
  const [tab, setTab]           = useState('safety');
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls 또는 xlsx 파일만 지원합니다', 'err'); return; }
    setLoading(true); setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseGoodMD(e.target.result);
        if (!result.records.length) { toast('정상 전표 데이터가 없습니다', 'err'); setLoading(false); return; }
        setParsed(result);
        toast(`${result.records.length.toLocaleString()}건 파싱 완료 · ${result.periodStr}`);
      } catch(err) { toast('파싱 오류: ' + err.message, 'err'); }
      setLoading(false);
    };
    reader.onerror = () => { toast('파일 읽기 실패', 'err'); setLoading(false); };
    reader.readAsBinaryString(file);
  };

  const stats = useMemo(() => {
    if (!parsed) return null;
    const { records } = parsed;
    const depts  = new Set(records.map(r => r.dept));
    const stores = new Set(records.map(r => r.store));
    const codes  = new Set(records.map(r => r.code));
    const totalQty = records.reduce((s,r) => s+r.qty, 0);
    const dates = records.map(r => r.date.getTime());
    const dayRange = Math.round((Math.max(...dates)-Math.min(...dates))/86400000)+1;
    return { count: records.length, depts: depts.size, stores: stores.size, codes: codes.size, totalQty, dayRange };
  }, [parsed]);

  return (
    <div>
      <div className="card">
        <div className="card-label">굿MD 매출전표조회 파일 업로드</div>
        <div className={`drop ${dragging?'over':''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={e => { handleFile(e.target.files[0]); e.target.value=''; }} />
          {loading
            ? <><div className="drop-icon"><span className="spinner"/></div><div className="drop-main">파싱 중...</div></>
            : parsed
              ? <><div className="drop-icon">✅</div><div className="drop-main">업로드 완료 · <strong>다른 파일</strong>을 올리면 교체됩니다</div><div className="drop-filename">📄 {filename}</div></>
              : <><div className="drop-icon">📂</div><div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div><div className="drop-sub">굿MD → 매출전표조회 다운로드 파일 (.xls / .xlsx)</div></>
          }
        </div>
      </div>

      {stats && (
        <div className="stats">
          <div className="stat"><div className="stat-l">기간</div><div className="stat-v" style={{fontSize:13}}>{parsed.periodStr}</div><div className="stat-u">{stats.dayRange}일</div></div>
          <div className="stat"><div className="stat-l">거래건수</div><div className="stat-v">{stats.count.toLocaleString()}</div><div className="stat-u">정상 전표</div></div>
          <div className="stat"><div className="stat-l">백화점</div><div className="stat-v">{stats.depts}</div><div className="stat-u">개 그룹</div></div>
          <div className="stat"><div className="stat-l">매장</div><div className="stat-v">{stats.stores}</div><div className="stat-u">개 지점</div></div>
          <div className="stat"><div className="stat-l">총 판매수량</div><div className="stat-v">{stats.totalQty.toLocaleString()}</div><div className="stat-u">개 ({stats.codes} 상품)</div></div>
        </div>
      )}

      {parsed && (
        <>
          <div className="tabs">
            <button className={`tab ${tab==='safety'?'on':''}`} onClick={() => setTab('safety')}>안전재고 현황</button>
            <button className={`tab ${tab==='weekly'?'on':''}`} onClick={() => setTab('weekly')}>주간 판매 · 발주참고</button>
          </div>
          <div className="card" style={{padding:'16px 20px'}}>
            {tab==='safety' && <SafetyTab records={parsed.records} period={parsed.periodStr}/>}
            {tab==='weekly' && <WeeklyTab records={parsed.records} period={parsed.periodStr}/>}
          </div>
        </>
      )}

      {!parsed && !loading && (
        <div className="empty">굿MD에서 <strong>매출전표조회</strong> 파일을 다운로드한 뒤<br/>위 영역에 업로드하면 안전재고 및 주간 발주 현황을 바로 확인할 수 있습니다</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════
const MENUS = [
  { key: 'upload', icon: '📊', label: '매출전표조회 업로드' },
];
const ADMIN_MENUS = [
  { key: 'admin', icon: '👥', label: '사용자 관리' },
];

function Sidebar({ page, setPage, profile, onLogout }) {
  const isAdmin = profile?.role === 'admin';
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏬</div>
        <div className="sidebar-logo-text">재고관리</div>
        <div className="sidebar-logo-sub">대시보드</div>
      </div>
      <div className="sidebar-menu">
        <div className="sidebar-section">메뉴</div>
        {MENUS.map(m => (
          <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`} onClick={() => setPage(m.key)}>
            <span className="sidebar-item-icon">{m.icon}</span>{m.label}
          </button>
        ))}
        {isAdmin && (
          <>
            <div className="sidebar-section" style={{marginTop:8}}>관리자</div>
            {ADMIN_MENUS.map(m => (
              <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`} onClick={() => setPage(m.key)}>
                <span className="sidebar-item-icon">{m.icon}</span>{m.label}
              </button>
            ))}
          </>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          {isAdmin && <span className="admin-badge" style={{marginRight:6}}>ADMIN</span>}
          {profile?.email}
        </div>
        <button className="sidebar-logout" onClick={onLogout}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════
export default function App() {
  useStyle(GLOBAL_CSS);

  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [authLoading, setAL]    = useState(true);
  const [page, setPage]         = useState('upload');

  useEffect(() => {
    // 세션 초기화
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setAL(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) { setProfile(null); setAL(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setProfile(data); setAL(false); });
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast('로그아웃 됐습니다', 'inf');
  };

  const PAGE_TITLES = { upload: '매출전표조회 업로드', admin: '사용자 관리' };

  if (authLoading) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><span className="spinner"/></div>;
  }

  if (!session) return <><Toasts/><AuthScreen/></>;

  if (!profile?.approved) return <><Toasts/><PendingScreen email={session.user.email}/></>;

  return (
    <>
      <Toasts/>
      <div className="app-layout">
        <Sidebar page={page} setPage={setPage} profile={profile} onLogout={handleLogout}/>
        <div className="content">
          <div className="content-header">
            <div className="content-title">{PAGE_TITLES[page]}</div>
          </div>
          <div className="content-body">
            {page === 'upload' && <UploadPage/>}
            {page === 'admin'  && <AdminTab/>}
          </div>
        </div>
      </div>
    </>
  );
}
