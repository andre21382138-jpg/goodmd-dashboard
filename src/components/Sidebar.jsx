import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { HQ_MENUS, MANAGER_MENUS, ADMIN_MENUS } from '../lib/constants';
import { toast } from '../lib/utils';

function ClockModal({ type, members, todayMap, onConfirm, onClose }) {
  const [selMember, setSelMember] = useState(null);
  const label = type === 'in' ? '출근' : '퇴근';
  const color = type === 'in' ? '#2E7D32' : '#C62828';

  // 체크 가능한 근무자 필터
  const available = members.filter(m => {
    const rec = todayMap[m.name];
    if (type === 'in') return !rec;              // 출근 기록 없는 사람만
    return rec && !rec.clock_out;                // 출근했고 퇴근 안 한 사람만
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }}/>
      <div style={{ position:'relative', background:'#fff', borderRadius:16, padding:'28px 24px', width:320, maxWidth:'90vw', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        {/* 타이틀 */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>{type === 'in' ? '🟢' : '🔴'}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#111' }}>{label} 체크</div>
          <div style={{ fontSize:13, color:'#888', marginTop:4 }}>근무자를 선택하세요</div>
        </div>

        {/* 근무자 버튼 */}
        {available.length === 0 ? (
          <div style={{ textAlign:'center', padding:'16px 0', fontSize:13, color:'#999' }}>
            {type === 'in' ? '모든 근무자가 이미 출근 체크했습니다' : '퇴근 체크할 근무자가 없습니다'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
            {available.map(m => (
              <button key={m.name} type="button"
                onClick={() => setSelMember(selMember?.name === m.name ? null : m)}
                style={{ height:56, border:'2px solid', borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer', transition:'all 120ms',
                  borderColor: selMember?.name === m.name ? color : '#e0e0e0',
                  background: selMember?.name === m.name ? (type==='in'?'#e8f5e9':'#ffebee') : '#fafafa',
                  color: selMember?.name === m.name ? color : '#555',
                }}>
                {m.display_name || m.name}
                <div style={{ fontSize:11, fontWeight:400, marginTop:3, color: selMember?.name===m.name ? color : '#999' }}>{m.job_title}</div>
              </button>
            ))}
          </div>
        )}

        {/* 확인 / 취소 버튼 */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose}
            style={{ flex:1, height:44, border:'1px solid #e0e0e0', borderRadius:10, background:'#fafafa', fontSize:14, fontWeight:600, color:'#888', cursor:'pointer' }}>
            취소
          </button>
          <button onClick={() => selMember && onConfirm(selMember)}
            disabled={!selMember}
            style={{ flex:2, height:44, border:'none', borderRadius:10, background: selMember ? color : '#e0e0e0', fontSize:14, fontWeight:700, color: selMember ? '#fff' : '#bbb', cursor: selMember ? 'pointer' : 'default', transition:'all 120ms' }}>
            {selMember ? `${selMember.display_name || selMember.name} ${label} 확인` : `${label} 확인`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarClockPanel({ profile, setPage }) {
  const [members,  setMembers]  = useState([]);
  const [loaded,   setLoaded]   = useState(false);
  const [popup,    setPopup]    = useState(null); // 'in' | 'out'
  const [saving,   setSaving]   = useState(false);
  const [todayMap, setTodayMap] = useState({}); // name → attendance record
  const [lpReminder, setLpReminder] = useState(null); // {name, display_name} 휴무계획 미제출 알림

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const dateLabel = () => {
    const d = new Date();
    const days = ['일','월','화','수','목','금','토'];
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };
  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const fetchToday = useCallback(async () => {
    const { data } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id).eq('work_date', todayStr());
    const map = {};
    (data || []).forEach(r => { map[r.manager_name] = r; });
    setTodayMap(map);
  }, [profile.id]);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); setLoaded(true); });
    fetchToday();
  }, [profile.id, fetchToday]);

  const handleConfirm = async (member) => {
    if (saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const rec = todayMap[member.name];
    if (popup === 'in') {
      const { data, error } = await supabase.from('attendance').insert({
        manager_id: profile.id, manager_name: member.name,
        store_name: profile.department, branch_name: profile.branch,
        work_date: todayStr(), clock_in: now,
      }).select().single();
      if (!error) {
        setTodayMap(prev => ({ ...prev, [member.name]: data }));
        toast(`${member.display_name || member.name} 출근 체크 완료 ✅`, 'ok');
        // 휴무계획 미제출 체크 (매월 20~25일)
        const today = new Date();
        const day = today.getDate();
        if (day >= 20 && day <= 25) {
          const nextM = new Date(today.getFullYear(), today.getMonth()+1, 1);
          const nextMonStr = `${nextM.getFullYear()}-${String(nextM.getMonth()+1).padStart(2,'0')}`;
          const { data: lp } = await supabase.from('leave_plans')
            .select('id')
            .eq('manager_id', profile.id)
            .eq('manager_name', member.name)
            .eq('target_month', nextMonStr)
            .maybeSingle();
          if (!lp) setLpReminder({ name: member.name, display_name: member.display_name || member.name, target_month: nextMonStr });
        }
      }
    } else {
      const { data, error } = await supabase.from('attendance')
        .update({ clock_out: now }).eq('id', rec.id).select().single();
      if (!error) {
        setTodayMap(prev => ({ ...prev, [member.name]: data }));
        toast(`${member.display_name || member.name} 퇴근 체크 완료 ✅`, 'ok');
      }
    }
    setSaving(false);
    setPopup(null);
  };

  if (!loaded) return null;

  const allIn   = members.length > 0 && members.every(m => todayMap[m.name]);
  const anyOut  = members.some(m => todayMap[m.name]?.clock_out);
  const canOut  = members.some(m => todayMap[m.name] && !todayMap[m.name]?.clock_out);

  return (
    <>
      {popup && (
        <ClockModal type={popup} members={members} todayMap={todayMap}
          onConfirm={handleConfirm} onClose={() => setPopup(null)} />
      )}
      {lpReminder && (
        <div style={{position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, padding:'28px 24px', width:380, maxWidth:'90vw', boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
            <div style={{textAlign:'center', marginBottom:18}}>
              <div style={{fontSize:32, marginBottom:8}}>📅</div>
              <div style={{fontSize:17, fontWeight:700, color:'#111', marginBottom:6}}>
                {lpReminder.display_name}님,
              </div>
              <div style={{fontSize:14, color:'#444', lineHeight:1.5}}>
                <strong style={{color:'#c62828'}}>{lpReminder.target_month}</strong> 휴무계획을<br/>
                아직 신청하지 않으셨습니다.
              </div>
              <div style={{fontSize:12, color:'#888', marginTop:8}}>
                지금 신청하러 가시겠습니까?
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={() => setLpReminder(null)}
                style={{flex:1, height:44, border:'1px solid #e0e0e0', borderRadius:10, background:'#fafafa', fontSize:14, fontWeight:600, color:'#888', cursor:'pointer'}}>
                나중에
              </button>
              <button onClick={() => { setLpReminder(null); if (setPage) setPage('leave_plan'); }}
                style={{flex:2, height:44, border:'none', borderRadius:10, background:'#c62828', fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer'}}>
                지금 신청하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ padding:'8px', borderBottom:'1px solid rgba(0,0,0,0.1)' }}>
        <div style={{ background:'#fff', borderRadius:8, border:'1px solid rgba(0,0,0,0.08)', padding:'10px 10px 8px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#888', textAlign:'center', marginBottom:8 }}>
            {dateLabel()}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:6 }}>
            <button
              onClick={() => setPopup('in')}
              disabled={saving || allIn}
              style={{ height:32, border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor: allIn ? 'default' : 'pointer',
                background: allIn ? '#f5f5f5' : '#2E7D32', color: allIn ? '#aaa' : '#fff' }}>
              {allIn ? '✅ 출근' : '출근'}
            </button>
            <button
              onClick={() => setPopup('out')}
              disabled={saving || !canOut}
              style={{ height:32, border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor: !canOut ? 'default' : 'pointer',
                background: !canOut ? '#f5f5f5' : '#C62828', color: !canOut ? '#aaa' : '#fff' }}>
              {anyOut && !canOut ? '✅ 퇴근' : '퇴근'}
            </button>
          </div>
          {/* 근무자별 현황 */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {members.map(m => {
              const rec = todayMap[m.name];
              return (
                <div key={m.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontFamily:'var(--mono)' }}>
                  <span style={{ fontWeight:700, color:'#666', minWidth:40 }}>{m.display_name || m.name}</span>
                  {rec?.clock_in  && <span style={{ color:'#2E7D32', fontWeight:700 }}>↑{fmt(rec.clock_in)}</span>}
                  {rec?.clock_out && <span style={{ color:'var(--accent)', fontWeight:700 }}>↓{fmt(rec.clock_out)}</span>}
                  {!rec && <span style={{ color:'#ccc' }}>미체크</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ page, setPage, profile, onLogout }) {
  const isAdmin    = profile?.role === 'admin';
  const isHQ       = profile?.job_title === '담당자';
  const isManager  = profile?.job_title === '매니저';
  const canSeeMain = isAdmin || isHQ;
  const [newPlanCount,  setNewPlanCount]  = useState(0);
  const [hasNewNotice,  setHasNewNotice]  = useState(false);

  useEffect(() => {
    if (!canSeeMain) return;
    supabase.from('leave_plans').select('id', { count: 'exact' }).eq('status', 'pending')
      .then(({ count }) => setNewPlanCount(count || 0));
  }, [canSeeMain]);

  // 새 공지 여부 확인 (담당자·매니저·관리자 모두)
  useEffect(() => {
    if (!profile?.id) return;
    const storageKey = `notice_last_read_${profile.id}`;
    supabase.from('notices').select('created_at').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const latestAt = data[0].created_at;
        const lastRead = localStorage.getItem(storageKey);
        setHasNewNotice(!lastRead || latestAt > lastRead);
      });
  }, [profile?.id]);

  const handleNoticeClick = () => {
    const storageKey = `notice_last_read_${profile?.id}`;
    localStorage.setItem(storageKey, new Date().toISOString());
    setHasNewNotice(false);
    setPage('notice');
  };
  const [flyoutKey, setFlyoutKey] = useState(null);
  const [flyoutY,   setFlyoutY]   = useState(0);

  const isOn = (key) => page === key;

  const handleParentClick = (e, m) => {
    if (m.sub?.length) {
      const rect = e.currentTarget.getBoundingClientRect();
      setFlyoutKey(prev => prev === m.key ? null : m.key);
      setFlyoutY(rect.top);
      setPage(m.key);
    } else {
      setFlyoutKey(null);
      setPage(m.key);
    }
  };

  const allMenus = [...HQ_MENUS, ...MANAGER_MENUS];
  const flyoutParent = allMenus.find(m => m.key === flyoutKey);
  const flyoutItems  = flyoutParent?.sub || [];

  return (
    <div className="sidebar">
      {/* 홈 버튼 */}
      <button
        onClick={() => setPage('home')}
        style={{
          display:'flex', alignItems:'center', gap:10, padding: isAdmin ? '10px 18px' : '0 18px',
          background: page==='home' ? 'rgba(0,0,0,0.08)' : 'transparent',
          border:'none', borderBottom:'1px solid rgba(0,0,0,0.1)',
          cursor:'pointer', width:'100%', textAlign:'left', transition:'background 120ms',
          height: isAdmin ? 'auto' : '52px', flexShrink:0,
        }}
        onMouseEnter={e => { if(page!=='home') e.currentTarget.style.background='rgba(0,0,0,0.05)'; }}
        onMouseLeave={e => { if(page!=='home') e.currentTarget.style.background='transparent'; }}
      >
        {!isAdmin && <span style={{ fontSize:22 }}>🏬</span>}
        <div>
          {isAdmin ? (
            <>
              <div style={{ fontSize:10, fontWeight:600, color:'var(--sidebar-text)', opacity:0.75, lineHeight:1.3, letterSpacing:0.2 }}>
                서비스이용기간
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color:'var(--sidebar-text)', lineHeight:1.3 }}>
                2027. 04. 09까지
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--sidebar-text)', lineHeight:1.3, marginTop:2 }}>
                (주)한국생활건강
              </div>
            </>
          ) : (
            <div style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:'var(--sidebar-text)', lineHeight:1.2 }}>백화점팀 관리시스템</div>
          )}
        </div>
      </button>

      {/* 출퇴근 카드 (매니저 전용) */}
      {isManager && <SidebarClockPanel profile={profile} setPage={setPage}/>}

      <div className="sidebar-menu">
        {/* 본사 메뉴 */}
        {canSeeMain && (
          <>
            <div className="sidebar-section">본사</div>
            {HQ_MENUS.map(m => {
              const hasSub = m.sub && m.sub.length > 0;
              const isActive = isOn(m.key) || (hasSub && m.sub.some(s => isOn(s.key)));
              const isOpen = flyoutKey === m.key;
              return (
                <button key={m.key}
                  className={`sidebar-item ${isActive?'on':''}`}
                  onClick={e => handleParentClick(e, m)}>
                  <span className="sidebar-item-icon">{m.icon}</span>
                  {m.label}
                  {m.key==='attendance_mgmt' && newPlanCount > 0 && (
                    <span style={{marginLeft:'auto', background:'var(--danger)', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:9, fontWeight:700}}>NEW</span>
                  )}
                  {hasSub && <span className="sidebar-chevron" style={{color: isOpen ? '#1a1a1a' : undefined}}>▶</span>}
                </button>
              );
            })}
          </>
        )}
        {/* 매장 메뉴 */}
        {(isManager || isAdmin || isHQ) && (
          <>
            <div className="sidebar-section" style={{marginTop: canSeeMain ? 8 : 0}}>매장</div>
            {MANAGER_MENUS.map(m => {
              const hasSub = m.sub && m.sub.length > 0;
              const isActive = page===m.key || (hasSub && m.sub.some(s => page===s.key));
              const isOpen = flyoutKey === m.key;
              return (
                <button key={m.key}
                  className={`sidebar-item ${isActive?'on':''}`}
                  onClick={e => handleParentClick(e, m)}>
                  <span className="sidebar-item-icon">{m.icon}</span>
                  {m.label}
                  {hasSub && <span className="sidebar-chevron" style={{color: isOpen ? '#1a1a1a' : undefined}}>▶</span>}
                </button>
              );
            })}
          </>
        )}
        {/* 관리자 메뉴 */}
        {(isAdmin || isHQ) && (
          <>
            <div className="sidebar-section" style={{marginTop:8}}>관리자</div>
            {isAdmin && ADMIN_MENUS.map(m => (
              <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`}
                onClick={() => m.key === 'notice' ? handleNoticeClick() : setPage(m.key)}>
                <span className="sidebar-item-icon">{m.icon}</span>{m.label}
                {m.key === 'notice' && hasNewNotice && (
                  <span style={{marginLeft:'auto', background:'#e53935', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:9, fontWeight:700, letterSpacing:0.5}}>NEW</span>
                )}
              </button>
            ))}
            {!isAdmin && (
              <button className={`sidebar-item ${page==='admin'?'on':''}`} onClick={() => setPage('admin')}>
                <span className="sidebar-item-icon">🔐</span>사용자 관리
              </button>
            )}
          </>
        )}
        {/* 공지사항 - 담당자/매니저 열람 */}
        {(isHQ || isManager) && (
          <>
            <div className="sidebar-section" style={{marginTop:8}}>공지</div>
            <button className={`sidebar-item ${page==='notice'?'on':''}`} onClick={handleNoticeClick}>
              <span className="sidebar-item-icon">📢</span>공지 사항
              {hasNewNotice && (
                <span style={{marginLeft:'auto', background:'#e53935', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:9, fontWeight:700, letterSpacing:0.5}}>NEW</span>
              )}
            </button>
          </>
        )}
        {!canSeeMain && !isManager && !isAdmin && (
          <div style={{ padding:'12px 10px', fontSize:12, color:'rgba(0,0,0,0.5)', lineHeight:1.7 }}>
            접근 가능한 메뉴가 없습니다.
          </div>
        )}
      </div>
      {/* 플라이아웃 서브메뉴 */}
      {flyoutKey && flyoutItems.length > 0 && (
        <>
          <div style={{position:'fixed', inset:0, zIndex:199}} onClick={() => setFlyoutKey(null)}/>
          <div style={{position:'fixed', left:224, top:flyoutY, zIndex:200, background:'#fff',
            border:'1px solid #e0e0e0', borderRadius:10, boxShadow:'0 6px 24px rgba(0,0,0,0.13)',
            minWidth:170, padding:'6px 0', overflow:'hidden'}}>
            <div style={{padding:'6px 14px 6px', fontSize:10, fontWeight:700, color:'#aaa', letterSpacing:1, borderBottom:'1px solid #f0f0f0', marginBottom:4}}>
              {flyoutParent?.icon} {flyoutParent?.label}
            </div>
            {flyoutItems.map(s => (
              <button key={s.key}
                className="flyout-item"
                onClick={() => { setPage(s.key); setFlyoutKey(null); }}
                style={{background: page===s.key ? '#fff8e1' : '#fff',
                  color: page===s.key ? '#E65100' : '#1a1a1a',
                  fontWeight: page===s.key ? 700 : 500}}>
                <span style={{fontSize:14}}>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-bottom">
        <button className={`sidebar-item ${page==='help'?'on':''}`} onClick={() => setPage('help')}
          style={{marginBottom:6, width:'100%'}}>
          <span className="sidebar-item-icon">❓</span>사용 안내
        </button>
        <div className="sidebar-user">
          {isAdmin && <span className="admin-badge" style={{marginRight:6}}>ADMIN</span>}
          {profile?.name && <strong style={{marginRight:4}}>{profile.name}</strong>}
          {profile?.email}
        </div>
        <button className="sidebar-logout" onClick={onLogout}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </div>
  );
}
