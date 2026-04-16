import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq } from '../../lib/utils';

// ── AttendanceCalendarModal ──────────────────────────────
function AttendanceCalendarModal({ member, year, month, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    supabase.from('attendance').select('*')
      .eq('manager_name', member.name)
      .gte('work_date', from).lte('work_date', to)
      .then(({ data }) => { setRecords(data || []); setLoading(false); });
  }, [member.name, year, month]);

  const recMap = {};
  records.forEach(r => { recMap[r.work_date] = r; });

  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const duration = (ci, co) => {
    if (!ci || !co) return '';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}h${m%60}m`;
  };
  const dailySalary = (dateStr) => {
    if (member.salary_type === '월급') return null;
    const dow = new Date(dateStr).getDay();
    const isFriSatSun = dow === 0 || dow === 5 || dow === 6;
    return (member.salary || 0) + (isFriSatSun ? (member.extra_pay || 0) : 0);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const dayNames = ['일','월','화','수','목','금','토'];

  return (
    <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
      onClick={onClose}>
      <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
      <div style={{position:'relative', background:'#fff', borderRadius:16, padding:'28px 28px', width:'min(940px, 96vw)', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
        onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', alignItems:'center', marginBottom:20}}>
          <div>
            <div style={{fontSize:20, fontWeight:700}}>{member.display_name || member.name} 출근표</div>
            <div style={{fontSize:13, color:'var(--text2)', marginTop:3}}>
              {year}년 {month}월 · {member.store?.branch} · {member.salary_type}
              {member.salary_type === '일급' && ` (기본 ${(member.salary||0).toLocaleString()}원${member.extra_pay ? ` / 금토일 +${(member.extra_pay).toLocaleString()}원` : ''})`}
            </div>
          </div>
          <button onClick={onClose}
            style={{marginLeft:'auto', background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginBottom:6}}>
              {dayNames.map((d,i) => (
                <div key={d} style={{textAlign:'center', fontSize:13, fontWeight:700, padding:'8px 0',
                  background:'#f5f5f5', borderRadius:6,
                  color: i===0?'#c62828':i===6?'#1565C0':'var(--text3)'}}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6}}>
              {Array.from({length: firstDow}).map((_,i) => <div key={`e${i}`}/>)}
              {Array.from({length: daysInMonth}).map((_,i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const dow = (firstDow + i) % 7;
                const isSun = dow === 0, isSat = dow === 6, isFri = dow === 5;
                const rec = recMap[dateStr];
                const sal = dailySalary(dateStr);
                const isWeekend = isSun || isSat || isFri;

                return (
                  <div key={day} style={{
                    borderRadius:8, padding:'8px 8px', minHeight:110,
                    background: rec ? (isWeekend ? '#fff3e0' : '#e8f5e9') : '#fafafa',
                    border: `1px solid ${rec ? (isWeekend ? '#ffcc80' : '#a5d6a7') : '#e0e0e0'}`,
                  }}>
                    <div style={{fontSize:14, fontWeight:700, marginBottom:5,
                      color: isSun?'#c62828': isSat?'#1565C0': isFri?'#2e7d32':'var(--text)'}}>
                      {day}
                    </div>
                    {rec ? (
                      <div style={{fontSize:11, lineHeight:1.9}}>
                        {rec.clock_in  && <div style={{color:'#2E7D32', fontWeight:600}}>↑ {fmt(rec.clock_in)}</div>}
                        {rec.clock_out && <div style={{color:'#C62828', fontWeight:600}}>↓ {fmt(rec.clock_out)}</div>}
                        {rec.clock_in && rec.clock_out && (
                          <div style={{color:'var(--text2)', fontWeight:600}}>{duration(rec.clock_in, rec.clock_out)}</div>
                        )}
                        {sal !== null && (
                          <div style={{color:'var(--accent)', fontWeight:700, marginTop:3, fontSize:12}}>
                            {sal.toLocaleString()}원
                          </div>
                        )}
                        {member.salary_type === '월급' && rec && (
                          <div style={{color:'#1565C0', fontSize:10, marginTop:2}}>월급제</div>
                        )}
                      </div>
                    ) : (
                      <div style={{fontSize:11, color:'#ccc', marginTop:6}}>휴무</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{marginTop:20, padding:'14px 20px', background:'#f8f8f8', borderRadius:10, display:'flex', gap:32, flexWrap:'wrap', alignItems:'center'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>출근일수</div>
                <div style={{fontSize:20, fontWeight:700, fontFamily:'var(--mono)'}}>{records.length}일</div>
              </div>
              {member.salary_type === '일급' && (
                <>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>평일</div>
                    <div style={{fontSize:20, fontWeight:700, fontFamily:'var(--mono)'}}>{records.filter(r => {const d=new Date(r.work_date).getDay(); return d!==0&&d!==5&&d!==6;}).length}일</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>금·토·일</div>
                    <div style={{fontSize:20, fontWeight:700, fontFamily:'var(--mono)', color:'var(--success)'}}>{records.filter(r => {const d=new Date(r.work_date).getDay(); return d===0||d===5||d===6;}).length}일</div>
                  </div>
                </>
              )}
              <div style={{marginLeft:'auto', textAlign:'right'}}>
                <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>이번 달 지급액</div>
                <div style={{fontSize:24, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{member.salary.toLocaleString()}원</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── TargetIncentiveTab ───────────────────────────────────
function TargetIncentiveTab() {
  const now = new Date();
  const prevM  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonStr = `${prevM.getFullYear()}-${String(prevM.getMonth()+1).padStart(2,'0')}`;
  const curMonStr  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [selMonth, setSelMonth] = useState(curMonStr);
  const [stores,   setStores]   = useState([]);
  const [sales,    setSales]    = useState({});
  const [targets,  setTargets]  = useState({});
  const [editing,  setEditing]  = useState({});
  const [saving,   setSaving]   = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: profiles } = await supabase.from('profiles')
        .select('id, department, branch').eq('approved', true)
        .neq('role','admin').neq('job_title','담당자').order('department');
      setStores((profiles||[]).filter(p => p.branch));
      const prevFrom = `${prevMonStr}-01`;
      const prevLast = new Date(prevM.getFullYear(), prevM.getMonth()+1, 0).getDate();
      const prevTo   = `${prevMonStr}-${String(prevLast).padStart(2,'0')}`;
      const { data: salesData } = await supabase.from('sales')
        .select('branch_name, price, quantity').gte('sold_at', prevFrom).lte('sold_at', prevTo);
      const salesMap = {};
      (salesData||[]).forEach(s => {
        if (!salesMap[s.branch_name]) salesMap[s.branch_name] = 0;
        salesMap[s.branch_name] += (s.price||0) * (s.quantity||0);
      });
      setSales(salesMap);
      const { data: tData } = await supabase.from('incentive_targets')
        .select('branch_name, target_amount').eq('target_month', selMonth);
      const tMap = {};
      (tData||[]).forEach(t => { tMap[t.branch_name] = t.target_amount; });
      setTargets(tMap);
      setLoading(false);
    };
    load();
  }, [selMonth]);

  const handleSave = async (store) => {
    const branch = store.branch;
    const amount = Number(String(editing[branch]||'').replace(/,/g,''));
    if (!amount) return;
    setSaving(p => ({...p, [branch]: true}));
    await supabase.from('incentive_targets').upsert({
      store_name: store.department, branch_name: branch,
      target_month: selMonth, target_amount: amount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_name,target_month' });
    setTargets(p => ({...p, [branch]: amount}));
    setEditing(p => ({...p, [branch]: ''}));
    setSaving(p => ({...p, [branch]: false}));
    toast(`${branch} 목표매출 저장`, 'ok');
  };

  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const fmtAmt = (v) => v ? Number(v).toLocaleString() + '원' : '-';
  const achieveRate = (branch) => {
    const t = targets[branch], s = sales[branch];
    if (!t || !s) return null;
    return Math.round(s / t * 100);
  };

  return (
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:13, fontWeight:700}}>목표 월</span>
        <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
          style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{fontSize:12, color:'var(--text3)'}}>전월 매출: {prevMonStr} 기준</span>
      </div>
      {loading ? <div className="empty"><span className="spinner"/></div> : (
        <div className="twrap">
          <table>
            <thead><tr><th>점포</th><th>지점명</th><th className="r">전월 매출</th><th className="r">목표 매출</th><th className="r">달성률</th><th style={{width:200}}>목표 설정</th></tr></thead>
            <tbody>
              {stores.map(s => {
                const branch=s.branch, prevSal=sales[branch]||0, target=targets[branch], rate=achieveRate(branch);
                return (
                  <tr key={s.id}>
                    <td style={{fontSize:13}}><span className="badge badge-dept">{s.department}</span></td>
                    <td style={{fontSize:13}}><span className="badge badge-store">{branch}</span></td>
                    <td className="r" style={{fontSize:13,fontFamily:'var(--mono)',fontWeight:600}}>{prevSal>0?prevSal.toLocaleString()+'원':'-'}</td>
                    <td className="r" style={{fontSize:13,fontFamily:'var(--mono)',fontWeight:700,color:target?'var(--accent)':'var(--text3)'}}>{fmtAmt(target)}</td>
                    <td className="r">{rate!==null?<span style={{padding:'2px 8px',borderRadius:4,fontSize:12,fontWeight:700,background:rate>=100?'#e8f5e9':rate>=80?'#fff3e0':'#ffebee',color:rate>=100?'var(--success)':rate>=80?'var(--accent)':'var(--danger)'}}>{rate}%</span>:'-'}</td>
                    <td style={{padding:'8px 12px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <input type="text" value={editing[branch]??(target?target.toLocaleString():'')}
                          onChange={e=>setEditing(p=>({...p,[branch]:e.target.value.replace(/[^0-9]/g,'')}))}
                          placeholder="금액 입력"
                          style={{flex:1,height:32,padding:'0 8px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:12,fontFamily:'var(--mono)',outline:'none'}}/>
                        <button className="btn btn-p" style={{height:32,padding:'0 12px',fontSize:12}}
                          disabled={saving[branch]} onClick={()=>handleSave(s)}>
                          {saving[branch]?<span className="spinner"/>:'저장'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── MemberIncentiveTab ───────────────────────────────────
function MemberIncentiveTab() {
  const now = new Date();
  const curMonStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [selMonth, setSelMonth] = useState(curMonStr);
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(null);

  const calcIncentive = (amt) => {
    if (amt >= 200000) return 3000;
    if (amt >= 100000) return 2000;
    if (amt >= 20000)  return 1000;
    return 0;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = `${selMonth}-01`;
    const lastDay = new Date(selMonth.split('-')[0], selMonth.split('-')[1], 0).getDate();
    const to = `${selMonth}-${String(lastDay).padStart(2,'0')}`;

    const { data: newMembers } = await supabase.from('customers')
      .select('id, name, phone, manager_name, branch_name, store_name')
      .eq('sms_consent', true)
      .gte('joined_at', from).lte('joined_at', to);

    if (!newMembers?.length) { setRows([]); setLoading(false); return; }

    const memberIds = newMembers.map(m => m.id);
    const { data: salesData } = await supabase.from('sales')
      .select('customer_id, price, quantity')
      .in('customer_id', memberIds)
      .gte('sold_at', from).lte('sold_at', to);

    const salesMap = {};
    (salesData||[]).forEach(s => {
      if (!salesMap[s.customer_id]) salesMap[s.customer_id] = 0;
      salesMap[s.customer_id] += (s.price||0) * (s.quantity||0);
    });

    const managerMap = {};
    newMembers.forEach(m => {
      const purchaseAmt = salesMap[m.id] || 0;
      const incentive   = calcIncentive(purchaseAmt);
      if (!m.manager_name) return;
      if (!managerMap[m.manager_name]) {
        managerMap[m.manager_name] = { manager_name:m.manager_name, branch_name:m.branch_name, store_name:m.store_name, members:[], totalIncentive:0 };
      }
      managerMap[m.manager_name].members.push({...m, purchaseAmt, incentive});
      managerMap[m.manager_name].totalIncentive += incentive;
    });

    setRows(Object.values(managerMap).sort((a,b) => b.totalIncentive-a.totalIncentive));
    setLoading(false);
  }, [selMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grandTotal = rows.reduce((s,r) => s+r.totalIncentive, 0);

  return (
    <div>
      <div style={{background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:'var(--radius)', padding:'10px 16px', marginBottom:12, fontSize:12, color:'#1565C0', lineHeight:1.8}}>
        📌 <strong>회원가입 매출 혜택 기준</strong> — SMS 수신동의 + 가입월 내 구매 시<br/>
        2만원 이상 <strong>1,000원</strong> · 10만원 이상 <strong>2,000원</strong> · 20만원 이상 <strong>3,000원</strong>
      </div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:13, fontWeight:700}}>조회 월</span>
          <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
            style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div style={{marginLeft:'auto', textAlign:'right'}}>
            <div style={{fontSize:11, color:'var(--text3)'}}>총 인센티브</div>
            <div style={{fontSize:18, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{grandTotal.toLocaleString()}원</div>
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : rows.length===0 ? (
          <div className="empty">{selMonth} 해당 데이터가 없습니다</div>
        ) : (
          <div className="twrap">
            <table>
              <thead><tr><th>점포</th><th>지점</th><th>담당 매니저</th><th className="r">가입+구매 회원수</th><th className="r">인센티브 합계</th><th></th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <>
                    <tr key={r.manager_name} style={{background:expanded===r.manager_name?'#fffde7':''}}>
                      <td><span className="badge badge-dept">{r.store_name}</span></td>
                      <td><span className="badge badge-store">{r.branch_name}</span></td>
                      <td style={{fontSize:13, fontWeight:700}}>{r.manager_name}</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:600}}>{r.members.length}명</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)'}}>{r.totalIncentive.toLocaleString()}원</td>
                      <td><button className="btn btn-s" style={{fontSize:11}} onClick={()=>setExpanded(expanded===r.manager_name?null:r.manager_name)}>{expanded===r.manager_name?'▲ 닫기':'▼ 상세'}</button></td>
                    </tr>
                    {expanded===r.manager_name && (
                      <tr key={r.manager_name+'_d'}>
                        <td colSpan={6} style={{padding:0, background:'#fffde7'}}>
                          <div style={{padding:'8px 16px 16px'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, marginTop:8}}>
                              <thead>
                                <tr style={{background:'#fff3e0'}}>
                                  <th style={{padding:'6px 10px', textAlign:'left', fontWeight:600, color:'var(--text2)'}}>회원명</th>
                                  <th style={{padding:'6px 10px', textAlign:'left', fontWeight:600, color:'var(--text2)'}}>연락처</th>
                                  <th style={{padding:'6px 10px', textAlign:'right', fontWeight:600, color:'var(--text2)'}}>당월 구매금액</th>
                                  <th style={{padding:'6px 10px', textAlign:'right', fontWeight:600, color:'var(--text2)'}}>인센티브</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.members.map(m => (
                                  <tr key={m.id} style={{borderBottom:'1px solid #ffcc80'}}>
                                    <td style={{padding:'7px 10px', fontWeight:600}}>{m.name}</td>
                                    <td style={{padding:'7px 10px', fontFamily:'var(--mono)', fontSize:11}}>{m.phone}</td>
                                    <td style={{padding:'7px 10px', textAlign:'right', fontFamily:'var(--mono)'}}>{m.purchaseAmt.toLocaleString()}원</td>
                                    <td style={{padding:'7px 10px', textAlign:'right', fontFamily:'var(--mono)', fontWeight:700, color:m.incentive>0?'var(--accent)':'var(--text3)'}}>
                                      {m.incentive>0?`${m.incentive.toLocaleString()}원`:'해당없음'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                <tr style={{background:'var(--bg3)', borderTop:'2px solid var(--border2)'}}>
                  <td colSpan={5} style={{padding:'10px 11px', fontWeight:700}}>합계</td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)', padding:'10px 11px'}}>{grandTotal.toLocaleString()}원</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── IncentiveTab ─────────────────────────────────────────
function IncentiveTab() {
  const [subTab, setSubTab] = useState('target');
  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[{key:'target',label:'🎯 목표매출 달성 혜택'},{key:'member',label:'👥 회원가입 매출 혜택'}].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{height:36, padding:'0 18px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 120ms',
              borderColor: subTab===t.key ? 'var(--accent)' : 'var(--border)',
              background: subTab===t.key ? '#fff3e0' : '#fff',
              color: subTab===t.key ? 'var(--accent)' : 'var(--text2)'}}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'target' && <TargetIncentiveTab/>}
      {subTab === 'member' && <MemberIncentiveTab/>}
    </div>
  );
}

// ── SalaryConditionTab ───────────────────────────────────
function SalaryConditionTab({ profile }) {
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [fStore,    setFStore]    = useState('');
  const [fBranch,   setFBranch]   = useState('');
  const [fJob,      setFJob]      = useState('');
  const [editing,   setEditing]   = useState(null);
  const [editData,  setEditData]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [histTarget, setHistTarget] = useState(null);
  const [history,   setHistory]   = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('store_members')
      .select('*, store:profiles!store_account_id(department, branch)')
      .order('store_account_id');
    setMembers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const stores   = useMemo(() => uniq(members.map(m => m.store?.department).filter(Boolean)), [members]);
  const branches = useMemo(() => uniq((fStore ? members.filter(m => m.store?.department===fStore) : members).map(m => m.store?.branch).filter(Boolean)), [members, fStore]);
  const filtered = useMemo(() => {
    let r = members;
    if (fStore)  r = r.filter(m => m.store?.department===fStore);
    if (fBranch) r = r.filter(m => m.store?.branch===fBranch);
    if (fJob)    r = r.filter(m => m.job_title===fJob);
    return r;
  }, [members, fStore, fBranch, fJob]);

  const startEdit = (m) => {
    setEditing(m.id);
    setEditData({ salary_type: m.salary_type, salary: m.salary||0, extra_pay: m.extra_pay||0, affiliation: m.affiliation||'', job_title: m.job_title||'' });
  };

  const saveEdit = async (m) => {
    setSaving(true);
    await supabase.from('salary_history').insert({
      store_member_id: m.id,
      branch_name: m.store?.branch,
      member_name: m.name,
      changed_by: profile?.name,
      salary_type: editData.salary_type,
      salary: Number(editData.salary),
      extra_pay: Number(editData.extra_pay),
    });
    const { error } = await supabase.from('store_members').update({
      salary_type: editData.salary_type,
      salary: Number(editData.salary),
      extra_pay: Number(editData.extra_pay),
      affiliation: editData.affiliation,
      job_title: editData.job_title,
    }).eq('id', m.id);
    if (error) toast(error.message, 'err');
    else { toast(`${m.display_name||m.name} 정보 수정 완료`, 'ok'); setEditing(null); fetchMembers(); }
    setSaving(false);
  };

  const showHistory = async (m) => {
    setHistTarget({ id: m.id, name: m.display_name || m.name });
    setHistLoading(true);
    const { data } = await supabase.from('salary_history')
      .select('*').eq('store_member_id', m.id)
      .order('changed_at', { ascending: false }).limit(20);
    setHistory(data || []);
    setHistLoading(false);
  };

  const td = { fontSize:13, color:'var(--text)' };
  const iStyle = { height:32, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, fontFamily:'var(--mono)', outline:'none', background:'#fff' };

  return (
    <div>
      {histTarget && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setHistTarget(null)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, padding:'28px 24px', width:'min(560px, 92vw)', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', alignItems:'center', marginBottom:16}}>
              <div style={{fontSize:17, fontWeight:700}}>{histTarget.name} 급여 변경 이력</div>
              <button onClick={() => setHistTarget(null)} style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
            </div>
            {histLoading ? <div className="empty"><span className="spinner"/></div> : (
              history.length === 0
                ? <div className="empty">변경 이력이 없습니다</div>
                : <div className="twrap">
                    <table>
                      <thead><tr><th>변경일시</th><th>급여방법</th><th className="r">기본급여</th><th className="r">금토일 추가</th><th>변경자</th></tr></thead>
                      <tbody>
                        {history.map(h => (
                          <tr key={h.id}>
                            <td className="mono" style={{fontSize:11}}>{new Date(h.changed_at).toLocaleString('ko-KR')}</td>
                            <td><span style={{padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                              background: h.salary_type==='월급'?'#e3f2fd':'#f3e5f5',
                              color: h.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>{h.salary_type}</span></td>
                            <td className="r" style={{fontFamily:'var(--mono)', fontWeight:600}}>{(h.salary||0).toLocaleString()}원</td>
                            <td className="r" style={{fontFamily:'var(--mono)', color:'var(--success)'}}>{h.extra_pay>0?`+${(h.extra_pay).toLocaleString()}원`:'-'}</td>
                            <td style={{fontSize:12, color:'var(--text2)'}}>{h.changed_by||'-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{padding:'16px 20px'}}>
        <div className="fbar">
          <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
            <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="fsel" value={fJob} onChange={e => setFJob(e.target.value)}>
            <option value="">전체 직급</option>
            <option value="매니저">매니저</option>
            <option value="부매니저">부매니저</option>
          </select>
          {(fStore||fBranch||fJob) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); setFJob(''); }}>✕ 초기화</button>}
          <div className="fbar-right"><span className="fresult">근무자 <b>{filtered.length}</b>명</span></div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>점포</th><th>지점</th><th>소속</th><th>직급</th><th>이름</th><th>연락처</th><th>급여방법</th><th className="r">기본급여</th><th className="r">금·토·일 추가</th><th>관리</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={10} className="empty">근무자가 없습니다</td></tr>
                  : filtered.map(m => {
                    const isEditing = editing === m.id;
                    return (
                      <tr key={m.id}>
                        <td><span className="badge badge-dept">{m.store?.department}</span></td>
                        <td><span className="badge badge-store">{m.store?.branch}</span></td>
                        <td style={td}>
                          {isEditing ? (
                            <select value={editData.affiliation} onChange={e => setEditData(p=>({...p, affiliation:e.target.value}))}
                              style={{...iStyle, width:100}}>
                              <option value="한국생활건강">한국생활건강</option>
                              <option value="신우">신우</option>
                              <option value="사업소득">사업소득</option>
                            </select>
                          ) : m.affiliation || '-'}
                        </td>
                        <td>
                          {isEditing ? (
                            <select value={editData.job_title} onChange={e => setEditData(p=>({...p, job_title:e.target.value}))}
                              style={{...iStyle, width:90}}>
                              <option value="매니저">매니저</option>
                              <option value="부매니저">부매니저</option>
                            </select>
                          ) : (
                            <span style={{...td, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</span>
                          )}
                        </td>
                        <td style={{...td, fontWeight:700}}>{m.display_name || m.name}</td>
                        <td style={td}>{m.phone || '-'}</td>
                        <td>
                          {isEditing ? (
                            <select value={editData.salary_type} onChange={e => setEditData(p=>({...p, salary_type:e.target.value}))}
                              style={{...iStyle, width:70}}>
                              <option value="월급">월급</option>
                              <option value="일급">일급</option>
                            </select>
                          ) : (
                            <span style={{padding:'2px 8px', borderRadius:4, fontSize:12, fontWeight:600,
                              background: m.salary_type==='월급'?'#e3f2fd':'#f3e5f5',
                              color: m.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>
                              {m.salary_type}
                            </span>
                          )}
                        </td>
                        <td className="r">
                          {isEditing ? (
                            <input type="number" value={editData.salary} onChange={e => setEditData(p=>({...p, salary:e.target.value}))}
                              style={{...iStyle, width:100, textAlign:'right'}}/>
                          ) : (
                            <span style={{...td, fontWeight:700, fontFamily:'var(--mono)'}}>{(m.salary||0).toLocaleString()}원</span>
                          )}
                        </td>
                        <td className="r">
                          {isEditing ? (
                            <input type="number" value={editData.extra_pay} onChange={e => setEditData(p=>({...p, extra_pay:e.target.value}))}
                              style={{...iStyle, width:80, textAlign:'right'}}/>
                          ) : (
                            <span style={{...td, fontFamily:'var(--mono)', color: m.extra_pay>0?'var(--success)':'var(--text3)'}}>
                              {m.extra_pay > 0 ? `+${(m.extra_pay).toLocaleString()}원` : '-'}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{display:'flex', gap:4}}>
                              <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}} onClick={() => saveEdit(m)} disabled={saving}>
                                {saving ? <span className="spinner"/> : '저장'}
                              </button>
                              <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(null)}>취소</button>
                            </div>
                          ) : (
                            <div style={{display:'flex', gap:4}}>
                              <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => startEdit(m)}>수정</button>
                              <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => showHistory(m)}>이력</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SalaryCalcTab ────────────────────────────────────────
function SalaryCalcTab() {
  const now = new Date();
  const defaultYear  = now.getMonth() === 0 ? now.getFullYear()-1 : now.getFullYear();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const [selYear,   setSelYear]   = useState(defaultYear);
  const [selMonth,  setSelMonth]  = useState(defaultMonth);
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [fStore,    setFStore]    = useState('');
  const [calTarget, setCalTarget] = useState(null);

  const calcSalary = useCallback(async () => {
    setLoading(true);
    const from = `${selYear}-${String(selMonth).padStart(2,'0')}-01`;
    const lastDay = new Date(selYear, selMonth, 0).getDate();
    const to = `${selYear}-${String(selMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

    const { data: members } = await supabase.from('store_members')
      .select('*, store:profiles!store_account_id(department, branch)');
    const { data: att } = await supabase.from('attendance')
      .select('manager_name, work_date').gte('work_date', from).lte('work_date', to);

    const calcIncentive = (amt) => {
      if (amt >= 200000) return 3000;
      if (amt >= 100000) return 2000;
      if (amt >= 20000)  return 1000;
      return 0;
    };
    const { data: newCustomers } = await supabase.from('customers')
      .select('id, manager_name').eq('sms_consent', true)
      .gte('joined_at', from).lte('joined_at', to);
    const custIds = (newCustomers||[]).map(c => c.id);
    let custSalesMap = {};
    if (custIds.length > 0) {
      const { data: custSales } = await supabase.from('sales')
        .select('customer_id, price, quantity')
        .in('customer_id', custIds)
        .gte('sold_at', from).lte('sold_at', to);
      (custSales||[]).forEach(s => {
        if (!custSalesMap[s.customer_id]) custSalesMap[s.customer_id] = 0;
        custSalesMap[s.customer_id] += (s.price||0) * (s.quantity||0);
      });
    }
    const managerIncentiveMap = {};
    (newCustomers||[]).forEach(c => {
      if (!c.manager_name) return;
      const inc = calcIncentive(custSalesMap[c.id] || 0);
      if (!managerIncentiveMap[c.manager_name]) managerIncentiveMap[c.manager_name] = 0;
      managerIncentiveMap[c.manager_name] += inc;
    });

    const attMap = {};
    (att || []).forEach(r => {
      if (!attMap[r.manager_name]) attMap[r.manager_name] = [];
      attMap[r.manager_name].push(r.work_date);
    });

    const result = (members || []).map(m => {
      const dates = attMap[m.name] || [];
      let salary = 0, weekdays = 0, weekends = 0;
      if (m.salary_type === '월급') {
        salary = m.salary || 0;
      } else {
        dates.forEach(d => {
          const dow = new Date(d).getDay();
          const isFriSatSun = dow === 0 || dow === 5 || dow === 6;
          if (isFriSatSun) { salary += (m.salary||0) + (m.extra_pay||0); weekends++; }
          else             { salary += (m.salary||0); weekdays++; }
        });
      }
      const memberIncentive = managerIncentiveMap[m.name] || 0;
      return { ...m, totalDays: dates.length, weekdays, weekends, salary, memberIncentive, totalPay: salary + memberIncentive };
    });

    setRows(result.sort((a,b) => (a.store?.department||'').localeCompare(b.store?.department||'')));
    setLoading(false);
  }, [selYear, selMonth]);

  useEffect(() => { calcSalary(); }, [calcSalary]);

  const stores = useMemo(() => uniq(rows.map(r => r.store?.department).filter(Boolean)), [rows]);
  const filtered = useMemo(() => fStore ? rows.filter(r => r.store?.department===fStore) : rows, [rows, fStore]);
  const totalSalary = useMemo(() => filtered.reduce((s,r) => s+r.totalPay, 0), [filtered]);
  const years  = Array.from({length:5}, (_,i) => now.getFullYear() - i);
  const months = Array.from({length:12}, (_,i) => i+1);

  return (
    <div>
      {calTarget && (
        <AttendanceCalendarModal member={calTarget} year={selYear} month={selMonth}
          onClose={() => setCalTarget(null)} />
      )}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'14px 20px', borderBottom:'1px solid var(--border)'}}>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
            style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
            {months.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          {fStore && <button className="btn-ghost" onClick={() => setFStore('')}>✕</button>}
          <div style={{marginLeft:'auto', textAlign:'right'}}>
            <div style={{fontSize:11, color:'var(--text3)', marginBottom:2}}>총 인건비</div>
            <div style={{fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{totalSalary.toLocaleString()}원</div>
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>점포</th><th>지점</th><th>직급</th><th>이름</th><th>급여방법</th><th className="r">출근 (평일/금토일)</th><th className="r">기본급여</th><th className="r">회원 인센티브</th><th className="r">합계 지급액</th><th style={{width:70, textAlign:'center'}}>상세</th></tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td style={{padding:'12px 12px'}}><span className="badge badge-dept">{m.store?.department}</span></td>
                    <td style={{padding:'12px 12px'}}><span className="badge badge-store">{m.store?.branch}</span></td>
                    <td style={{padding:'12px 12px', fontSize:13, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</td>
                    <td style={{padding:'12px 12px', fontSize:13, fontWeight:700}}>{m.display_name || m.name}</td>
                    <td style={{padding:'12px 12px'}}><span style={{padding:'2px 8px', borderRadius:4, fontSize:12, fontWeight:600, background: m.salary_type==='월급'?'#e3f2fd':'#f3e5f5', color: m.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>{m.salary_type}</span></td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)'}}>
                      {m.salary_type==='월급' ? '-' : (
                        <span>{m.totalDays}일 <span style={{fontSize:11, color:'var(--text3)'}}>({m.weekdays}/{m.weekends})</span></span>
                      )}
                    </td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)', color:'var(--text2)'}}>{m.salary.toLocaleString()}원</td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)', fontWeight: m.memberIncentive>0?700:400, color: m.memberIncentive>0?'var(--success)':'var(--text3)'}}>
                      {m.memberIncentive>0 ? `+${m.memberIncentive.toLocaleString()}원` : '-'}
                    </td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{m.totalPay.toLocaleString()}원</td>
                    <td style={{padding:'12px 6px', textAlign:'center'}}>
                      <button className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}} onClick={() => setCalTarget(m)}>상세보기</button>
                    </td>
                  </tr>
                ))}
                <tr style={{background:'var(--bg3)', borderTop:'2px solid var(--border2)'}}>
                  <td colSpan={6} style={{padding:'10px 11px', fontWeight:700}}>합계</td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:600, padding:'10px 11px', color:'var(--text2)'}}>{filtered.reduce((s,r)=>s+r.salary,0).toLocaleString()}원</td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, padding:'10px 11px', color:'var(--success)'}}>
                    {filtered.reduce((s,r)=>s+r.memberIncentive,0)>0?`+${filtered.reduce((s,r)=>s+r.memberIncentive,0).toLocaleString()}원`:'-'}
                  </td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)', padding:'10px 11px'}}>{totalSalary.toLocaleString()}원</td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── IncentivePage (default export) ──────────────────────
export default function IncentivePage({ profile }) {
  const [tab, setTab] = useState('condition');

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[{key:'condition',label:'📋 급여 조건'},{key:'incentive',label:'🏆 인센티브'},{key:'calc',label:'🧮 급여 계산'}].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ height:38, padding:'0 20px', border:'2px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 120ms',
              borderColor: tab===t.key ? 'var(--accent)' : 'var(--border)',
              background: tab===t.key ? '#fff3e0' : '#fff',
              color: tab===t.key ? 'var(--accent)' : 'var(--text2)' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'condition'  && <SalaryConditionTab profile={profile}/>}
      {tab === 'incentive'  && <IncentiveTab/>}
      {tab === 'calc'       && <SalaryCalcTab/>}
    </div>
  );
}
