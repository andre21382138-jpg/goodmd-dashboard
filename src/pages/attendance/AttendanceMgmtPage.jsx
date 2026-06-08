import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob } from '../../lib/utils';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const firstOfMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
};
const minus = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const DOW = ['일','월','화','수','목','금','토'];

export default function AttendanceMgmtPage({ profile }) {
  const canEdit = !!profile && (profile.role === 'admin' || profile.job_title === '담당자');
  const [editCell, setEditCell] = useState(null); // { row, ds, attId, clock_in, clock_out }
  const [editIn,   setEditIn]   = useState('');
  const [editOut,  setEditOut]  = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (row, ds) => {
    if (!canEdit) return;
    const c = row.cells[ds];
    setEditCell({ row, ds, attId: c.attId });
    // ISO → 'HH:MM' (KST 환경에 맞춰 local)
    const toHm = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };
    setEditIn(toHm(c.clock_in));
    setEditOut(toHm(c.clock_out));
  };
  const closeEdit = () => { setEditCell(null); setEditIn(''); setEditOut(''); };

  const hmToIso = (date, hm) => {
    if (!hm || !/^\d{2}:\d{2}$/.test(hm)) return null;
    const [h, m] = hm.split(':').map(Number);
    const d = new Date(date + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const saveEdit = async () => {
    if (!editCell) return;
    const { row, ds, attId } = editCell;
    const inIso  = hmToIso(ds, editIn);
    const outIso = hmToIso(ds, editOut);
    setEditSaving(true);
    let error;
    if (attId) {
      // 기존 row 업데이트
      ({ error } = await supabase.from('attendance').update({
        clock_in:  inIso,
        clock_out: outIso,
      }).eq('id', attId));
    } else if (inIso || outIso) {
      // 신규 row 삽입 (해당 매장·매니저·날짜로)
      // store_account_id 가져오기 — storeMembers에서 매칭
      const sm = storeMembers.find(m =>
        m.name === row.name && m.store_name === row.store_name && m.branch_name === row.branch_name);
      const managerId = sm?.store_account_id || null;
      if (!managerId) {
        toast('이 행은 매장 등록 정보가 없어 신규 추가가 불가합니다 (기타근무자 등)', 'err');
        setEditSaving(false);
        return;
      }
      ({ error } = await supabase.from('attendance').insert({
        manager_id:   managerId,
        manager_name: row.name,
        store_name:   row.store_name,
        branch_name:  row.branch_name,
        work_date:    ds,
        clock_in:     inIso,
        clock_out:    outIso,
      }));
    }
    setEditSaving(false);
    if (error) { toast(error.message, 'err'); return; }
    toast('수정 완료', 'ok');
    closeEdit();
    fetchAll();
  };

  const deleteAtt = async () => {
    if (!editCell?.attId) return;
    if (!window.confirm(`${editCell.row.display_name} - ${editCell.ds} 출퇴근 기록을 삭제하시겠습니까?`)) return;
    setEditSaving(true);
    const { error } = await supabase.from('attendance').delete().eq('id', editCell.attId);
    setEditSaving(false);
    if (error) { toast(error.message, 'err'); return; }
    toast('삭제 완료', 'inf');
    closeEdit();
    fetchAll();
  };

  const [tab,         setTab]         = useState('attendance');
  const [records,     setRecords]     = useState([]);
  const [storeMembers,setStoreMembers]= useState([]);
  const [plans,       setPlans]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fStore,      setFStore]      = useState('');
  const [fManager,    setFManager]    = useState('');
  const [fFrom,       setFFrom]       = useState(minus(4));
  const [fTo,         setFTo]         = useState(todayStr());

  // 근무자별 이력 탭 (history)
  const [hStore,      setHStore]      = useState('');
  const [hMemberKey,  setHMemberKey]  = useState(''); // store_members.id
  const [hFrom,       setHFrom]       = useState(firstOfMonthStr());
  const [hTo,         setHTo]         = useState(todayStr());
  const [hRecords,    setHRecords]    = useState([]);
  const [hLoading,    setHLoading]    = useState(false);

  const [closures, setClosures] = useState([]); // 휴점일 데이터

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: att }, { data: lp }, { data: sm }, { data: cl }] = await Promise.all([
      supabase.from('attendance').select('*')
        .gte('work_date', fFrom).lte('work_date', fTo)
        .order('work_date', { ascending: true }),
      supabase.from('leave_plans').select('*')
        .order('created_at', { ascending: false }),
      supabase.from('store_members')
        .select('id, name, display_name, job_title, store_account_id, store:profiles!store_account_id(department, branch)')
        .order('id', { ascending: true }),
      supabase.from('store_closures').select('store_name, branch_name, dates'),
    ]);
    setClosures(cl || []);
    setRecords(att || []);
    setPlans(lp || []);
    setStoreMembers((sm || []).map(m => ({
      sm_id: m.id,
      name: m.name,
      display_name: m.display_name || m.name,
      job_title: m.job_title,
      store_account_id: m.store_account_id,
      store_name: m.store?.department || '',
      branch_name: m.store?.branch || '',
    })));
    setLoading(false);
  }, [fFrom, fTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const duration = (ci, co) => {
    if (!ci || !co) return '-';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}h ${m%60}m`;
  };

  // 매장 = 등록된 모든 매장 (출퇴근 기록 없어도 표시)
  const stores = useMemo(() =>
    [...new Set(storeMembers.map(m => m.store_name).filter(Boolean))].sort(),
    [storeMembers]
  );
  const managers = useMemo(() => {
    const ms = storeMembers
      .filter(m => !fStore || m.store_name === fStore)
      .map(m => m.display_name)
      .filter(Boolean);
    return [...new Set(ms)].sort();
  }, [storeMembers, fStore]);

  // 조회 기간의 날짜 리스트 (헤더 컬럼용)
  const dateList = useMemo(() => {
    const arr = [];
    if (!fFrom || !fTo) return arr;
    const start = new Date(fFrom);
    const end   = new Date(fTo);
    if (isNaN(start) || isNaN(end) || start > end) return arr;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
    return arr;
  }, [fFrom, fTo]);

  // 매장 매니저별 × 일자별 셀 구성 (피벗).
  // 각 셀: { clock_in, clock_out, isClosed, isOnLeave }
  const displayRows = useMemo(() => {
    // attendance lookup
    const attLookup = new Map(); // 'store|branch|name|date' → rec
    for (const r of records) {
      attLookup.set(`${r.store_name}|${r.branch_name}|${r.manager_name}|${r.work_date}`, r);
    }
    // 매장별 휴점일 set
    const closureMap = new Map();
    for (const c of closures) {
      const key = `${c.store_name}|${c.branch_name}`;
      if (!closureMap.has(key)) closureMap.set(key, new Set());
      for (const d of (c.dates || [])) closureMap.get(key).add(d);
    }
    // 매니저별 휴무신청 set (manager_id + manager_name 기준)
    const leaveMap = new Map();
    for (const p of plans) {
      const key = `${p.manager_id}|${p.manager_name}`;
      if (!leaveMap.has(key)) leaveMap.set(key, new Set());
      for (const d of (p.dates || [])) leaveMap.get(key).add(d);
    }

    const buildCells = (storeName, branchName, accountId, name) => {
      const out = {};
      for (const ds of dateList) {
        const rec = attLookup.get(`${storeName}|${branchName}|${name}|${ds}`);
        out[ds] = {
          clock_in:  rec?.clock_in  || null,
          clock_out: rec?.clock_out || null,
          attId:     rec?.id        || null,
          isClosed:  closureMap.get(`${storeName}|${branchName}`)?.has(ds) || false,
          isOnLeave: leaveMap.get(`${accountId}|${name}`)?.has(ds) || false,
        };
      }
      return out;
    };

    const usedRecordIds = new Set();
    const rows = storeMembers
      .filter(m => m.store_name && m.branch_name)
      .map(m => {
        const cells = buildCells(m.store_name, m.branch_name, m.store_account_id, m.name);
        for (const ds of dateList) {
          if (cells[ds].attId) usedRecordIds.add(cells[ds].attId);
        }
        return {
          key: `sm-${m.sm_id}`,
          name: m.name,
          display_name: m.display_name,
          job_title: m.job_title,
          store_name: m.store_name,
          branch_name: m.branch_name,
          cells,
          isExtra: false,
        };
      });

    // 기타근무자 (storeMembers에 없는 attendance) — name 기준 그룹화
    const extraGroups = new Map();
    for (const r of records) {
      if (usedRecordIds.has(r.id)) continue;
      const gk = `${r.store_name}|${r.branch_name}|${r.manager_name}`;
      if (!extraGroups.has(gk)) {
        const cells = {};
        for (const ds of dateList) {
          cells[ds] = { clock_in:null, clock_out:null, attId:null, isClosed:false, isOnLeave:false };
        }
        extraGroups.set(gk, {
          key: `extra-${gk}`,
          name: r.manager_name,
          display_name: r.manager_name,
          job_title: '기타근무자',
          store_name: r.store_name || '',
          branch_name: r.branch_name || '',
          cells,
          isExtra: true,
        });
      }
      const g = extraGroups.get(gk);
      if (g.cells[r.work_date]) {
        g.cells[r.work_date].clock_in = r.clock_in;
        g.cells[r.work_date].clock_out = r.clock_out;
        g.cells[r.work_date].attId = r.id;
      }
    }
    // 점포·지점·직책 순 정렬 (같은 매장끼리 묶이도록)
    const all = [...rows, ...extraGroups.values()];
    const titleRank = (t) => t === '매니저' ? 0 : t === '부매니저' ? 1 : t === '기타근무자' ? 3 : 2;
    all.sort((a, b) => {
      if (a.store_name !== b.store_name) return (a.store_name || '').localeCompare(b.store_name || '');
      if (a.branch_name !== b.branch_name) return (a.branch_name || '').localeCompare(b.branch_name || '');
      return titleRank(a.job_title) - titleRank(b.job_title);
    });
    return all;
  }, [records, storeMembers, plans, closures, dateList]);

  const filteredAtt = useMemo(() => {
    let r = displayRows;
    if (fStore)   r = r.filter(x => x.store_name === fStore);
    if (fManager) r = r.filter(x => x.display_name === fManager);
    // 그룹화 정보: 같은 (store, branch) 행끼리 묶어 rowSpan 처리
    const groupSizes = new Map();
    for (const x of r) {
      const k = `${x.store_name}|${x.branch_name}`;
      groupSizes.set(k, (groupSizes.get(k) || 0) + 1);
    }
    const seen = new Set();
    return r.map(x => {
      const k = `${x.store_name}|${x.branch_name}`;
      const isFirstOfGroup = !seen.has(k);
      seen.add(k);
      return { ...x, isFirstOfGroup, groupSize: groupSizes.get(k) };
    });
  }, [displayRows, fStore, fManager]);

  const stat = useMemo(() => {
    const memberCount = filteredAtt.length;
    return { memberCount, days: dateList.length };
  }, [filteredAtt, dateList]);

  const newPlanCount = plans.filter(p => p.status === 'pending').length;

  // 근무자별 이력 — 점포·근무자·기간 변경 시 자동 조회
  const hMember = useMemo(
    () => storeMembers.find(m => String(m.sm_id) === String(hMemberKey)),
    [storeMembers, hMemberKey]
  );
  const fetchHistory = useCallback(async () => {
    if (!hMember || !hFrom || !hTo) { setHRecords([]); return; }
    setHLoading(true);
    const { data } = await supabase.from('attendance').select('*')
      .eq('manager_id', hMember.store_account_id)
      .eq('manager_name', hMember.name)
      .gte('work_date', hFrom).lte('work_date', hTo)
      .order('work_date', { ascending: false });
    setHRecords(data || []);
    setHLoading(false);
  }, [hMember, hFrom, hTo]);
  useEffect(() => {
    if (tab !== 'history') return;
    fetchHistory();
  }, [tab, fetchHistory]);

  // 기간 내 모든 날짜 × attendance 매핑 (미체크 표시 포함)
  const hDisplayRows = useMemo(() => {
    if (!hMember || !hFrom || !hTo) return [];
    const lookup = new Map();
    for (const r of hRecords) lookup.set(r.work_date, r);
    // 해당 매장 휴점일 set
    const closureSet = new Set();
    for (const c of closures) {
      if (c.store_name === hMember.store_name && c.branch_name === hMember.branch_name) {
        (c.dates || []).forEach(d => closureSet.add(d));
      }
    }
    const rows = [];
    const start = new Date(hFrom);
    const end   = new Date(hTo);
    if (isNaN(start) || isNaN(end) || start > end) return [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const rec = lookup.get(ds);
      rows.push({
        date: ds, dow: DOW[d.getDay()],
        clock_in: rec?.clock_in || null,
        clock_out: rec?.clock_out || null,
        isClosed: closureSet.has(ds),
      });
    }
    return rows.reverse(); // 최신 날짜가 위로
  }, [hMember, hFrom, hTo, hRecords, closures]);

  const hStat = useMemo(() => {
    const total    = hDisplayRows.length;
    const worked   = hDisplayRows.filter(r => r.clock_in).length;
    const closedDays = hDisplayRows.filter(r => r.isClosed && !r.clock_in).length;
    const missing  = total - worked - closedDays;
    const totalMin = hDisplayRows.reduce((s,r) => {
      if (!r.clock_in || !r.clock_out) return s;
      return s + Math.round((new Date(r.clock_out) - new Date(r.clock_in)) / 60000);
    }, 0);
    const hours = `${Math.floor(totalMin/60)}h ${totalMin%60}m`;
    return { total, worked, missing, closedDays, hours };
  }, [hDisplayRows]);

  const handleDownloadAttendance = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('출퇴근현황');

      // 헤더: 점포 / 지점 / 근무자 / 직책 / [일자별 컬럼...]
      const header = ['점포', '지점', '근무자', '직책', ...dateList.map(ds => {
        const dow = new Date(ds).getDay();
        return `${ds.slice(5)} (${DOW[dow]})`;
      })];
      const hr = ws.addRow(header);
      hr.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFEEEEEE'} };
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
      });
      hr.height = 28;

      // 데이터 행 (근무자 단위)
      for (const r of filteredAtt) {
        const row = ws.addRow([
          r.store_name || '-',
          r.branch_name || '-',
          r.display_name || r.name || '-',
          r.job_title || (r.isExtra ? '기타근무자' : '-'),
          ...dateList.map(ds => {
            const c = r.cells[ds];
            if (c.clock_in || c.clock_out) {
              const inTxt  = c.clock_in  ? fmt(c.clock_in)  : '-';
              const outTxt = c.clock_out ? fmt(c.clock_out) : '-';
              return `${inTxt}\n${outTxt}`;
            }
            if (c.isClosed)  return '휴점';
            if (c.isOnLeave) return '휴무';
            return '미체크';
          }),
        ]);
        row.eachCell({ includeEmpty:true }, (cell, colNum) => {
          cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
          cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
          if (colNum > 4) {
            const v = String(cell.value || '');
            if (v === '휴점')   cell.font = { color:{argb:'FF6A1B9A'}, bold:true };
            else if (v === '휴무') cell.font = { color:{argb:'FF1565C0'}, bold:true };
            else if (v === '미체크') cell.font = { color:{argb:'FFC62828'}, bold:true };
          }
        });
        row.height = 32; // 출근/퇴근 두 줄 표시 위함
      }

      // 컬럼 폭
      ws.getColumn(1).width = 14;  // 점포
      ws.getColumn(2).width = 14;  // 지점
      ws.getColumn(3).width = 10;  // 근무자
      ws.getColumn(4).width = 8;   // 직책
      for (let i = 5; i <= 4 + dateList.length; i++) {
        ws.getColumn(i).width = 12;
      }

      // 같은 점포·지점 행 병합 (화면 rowSpan과 동일 효과)
      // filteredAtt[i] → 엑셀 row (i+2)  [헤더가 row 1]
      let groupStart = 2;
      for (let i = 1; i < filteredAtt.length; i++) {
        const cur = filteredAtt[i];
        const prev = filteredAtt[i - 1];
        if (cur.store_name !== prev.store_name || cur.branch_name !== prev.branch_name) {
          const groupEnd = i + 1; // 직전 그룹 마지막 엑셀 row
          if (groupEnd > groupStart) {
            ws.mergeCells(groupStart, 1, groupEnd, 1);
            ws.mergeCells(groupStart, 2, groupEnd, 2);
          }
          groupStart = i + 2; // 새 그룹 시작 엑셀 row
        }
      }
      // 마지막 그룹 마무리
      if (filteredAtt.length > 0) {
        const lastEnd = filteredAtt.length + 1;
        if (lastEnd > groupStart) {
          ws.mergeCells(groupStart, 1, lastEnd, 1);
          ws.mergeCells(groupStart, 2, lastEnd, 2);
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      dlBlob(buf, `출퇴근현황_${fFrom}_${fTo}.xlsx`);
      toast(`엑셀 다운로드 완료 (${filteredAtt.length}명 × ${dateList.length}일)`, 'ok');
    } catch (err) {
      toast('다운로드 실패: ' + (err.message || err), 'err');
    }
  };

  const updatePlanStatus = async (id, status) => {
    const { error } = await supabase.from('leave_plans').update({ status }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast(status === 'approved' ? '확인 완료' : '반려 처리', 'ok'); fetchAll(); }
  };

  return (
    <div>
      {/* 출퇴근 시각 편집 모달 (본사 담당자·어드민만) */}
      {editCell && (
        <div style={{position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}} onClick={() => !editSaving && closeEdit()}/>
          <div style={{position:'relative', background:'#fff', borderRadius:12, padding:'22px 24px', width:380, maxWidth:'92vw', boxShadow:'0 8px 40px rgba(0,0,0,0.22)'}}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>출퇴근 시각 수정</div>
            <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>
              {editCell.row.store_name} · {editCell.row.branch_name} · <strong>{editCell.row.display_name}</strong> · {editCell.ds}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18}}>
              <div>
                <label style={{display:'block', fontSize:11, color:'var(--text2)', fontWeight:600, marginBottom:4}}>출근 시각</label>
                <input type="time" value={editIn} onChange={e => setEditIn(e.target.value)}
                  style={{width:'100%', height:38, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:14, outline:'none'}}/>
              </div>
              <div>
                <label style={{display:'block', fontSize:11, color:'var(--text2)', fontWeight:600, marginBottom:4}}>퇴근 시각</label>
                <input type="time" value={editOut} onChange={e => setEditOut(e.target.value)}
                  style={{width:'100%', height:38, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:14, outline:'none'}}/>
              </div>
            </div>
            <div style={{fontSize:11, color:'var(--text3)', marginBottom:14, lineHeight:1.5}}>
              💡 빈 칸으로 두면 시각이 비워집니다. 둘 다 비우려면 [삭제] 사용 권장.
            </div>
            <div style={{display:'flex', gap:8}}>
              {editCell.attId && (
                <button type="button" onClick={deleteAtt} disabled={editSaving}
                  style={{flex:1, height:40, border:'1px solid var(--danger)', background:'#fff', color:'var(--danger)', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer'}}>
                  🗑️ 삭제
                </button>
              )}
              <button type="button" onClick={closeEdit} disabled={editSaving}
                style={{flex:1, height:40, border:'1px solid var(--border)', background:'#fff', color:'var(--text2)', borderRadius:'var(--radius)', fontSize:13, fontWeight:600, cursor:'pointer'}}>
                취소
              </button>
              <button type="button" onClick={saveEdit} disabled={editSaving}
                style={{flex:2, height:40, border:'none', background:'var(--accent)', color:'#fff', borderRadius:'var(--radius)', fontSize:14, fontWeight:700, cursor:'pointer'}}>
                {editSaving ? <span className="spinner"/> : '✅ 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab==='attendance'?'on':''}`} onClick={() => setTab('attendance')}>출퇴근 현황</button>
        <button className={`tab ${tab==='history'?'on':''}`} onClick={() => setTab('history')}>근무자별 이력</button>
        <button className={`tab ${tab==='leave'?'on':''}`} onClick={() => setTab('leave')}>
          연차계획
          {newPlanCount > 0 && (
            <span style={{marginLeft:6, background:'var(--danger)', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700}}>
              NEW {newPlanCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'attendance' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar" style={{flexWrap:'wrap'}}>
            <input type="date" className="fsel" value={fFrom}
              onChange={e => setFFrom(e.target.value || todayStr())}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={fTo}
              onChange={e => setFTo(e.target.value || todayStr())}/>
            <button className="btn btn-s" onClick={() => { setFFrom(todayStr()); setFTo(todayStr()); }}>오늘</button>
            <button className="btn btn-s" onClick={() => { setFFrom(minus(4)); setFTo(todayStr()); }}>최근 5일</button>
            <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFManager(''); }}>
              <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={fManager} onChange={e => setFManager(e.target.value)}>
              <option value="">전체 근무자</option>{managers.map(m => <option key={m}>{m}</option>)}
            </select>
            <button type="button" onClick={handleDownloadAttendance}
              title={`${fFrom} ~ ${fTo} 출퇴근현황을 엑셀로 다운로드`}
              style={{height:30, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background:'#fff3e0', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
              📥 엑셀
            </button>
            {(fStore||fManager) && (
              <button className="btn-ghost" onClick={() => { setFStore(''); setFManager(''); }}>✕ 초기화</button>
            )}
            <div className="fbar-right" style={{display:'flex', alignItems:'center', gap:14}}>
              <span className="fresult">근무자 <b>{stat.memberCount}</b>명 · 기간 <b>{stat.days}</b>일</span>
            </div>
          </div>

          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>점포</th>
                    <th>지점</th>
                    <th>근무자</th>
                    {dateList.map(ds => {
                      const dow = new Date(ds).getDay();
                      return (
                        <th key={ds} style={{textAlign:'center', minWidth:90}}>
                          <div style={{fontSize:11, fontWeight:700}}>{ds.slice(5)}</div>
                          <div style={{fontSize:10, fontWeight:600, color: dow===0?'var(--danger)':dow===6?'var(--accent2)':'var(--text3)'}}>{DOW[dow]}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredAtt.length === 0
                    ? <tr><td colSpan={3 + dateList.length} className="empty">등록된 근무자가 없습니다</td></tr>
                    : filteredAtt.map(r => (
                      <tr key={r.key} style={r.isFirstOfGroup ? {borderTop:'2px solid var(--border2)'} : {}}>
                        {r.isFirstOfGroup && (
                          <td rowSpan={r.groupSize} style={{verticalAlign:'middle', background:'#fafafa'}}>
                            <span className="badge badge-dept">{r.store_name || '-'}</span>
                          </td>
                        )}
                        {r.isFirstOfGroup && (
                          <td rowSpan={r.groupSize} style={{verticalAlign:'middle', background:'#fafafa'}}>
                            <span className="badge badge-store">{r.branch_name || '-'}</span>
                          </td>
                        )}
                        <td>
                          <strong>{r.display_name}</strong>
                          {r.job_title && r.job_title !== '매니저' && (
                            <span style={{fontSize:10, color:'var(--text3)', marginLeft:6}}>{r.job_title}</span>
                          )}
                        </td>
                        {dateList.map(ds => {
                          const c = r.cells[ds];
                          const cellClickable = canEdit && !r.isExtra;
                          const onClickCell = cellClickable ? () => openEdit(r, ds) : undefined;
                          const cellStyle = cellClickable ? { cursor:'pointer' } : {};
                          if (c.clock_in || c.clock_out) {
                            return (
                              <td key={ds} onClick={onClickCell}
                                title={cellClickable ? '클릭해 수정' : ''}
                                style={{textAlign:'center', fontFamily:'var(--mono)', fontSize:11, lineHeight:1.5, ...cellStyle}}>
                                <div style={{color:'var(--success)', fontWeight:700}}>{c.clock_in ? fmt(c.clock_in) : '-'}</div>
                                <div style={{color:'var(--accent)', fontWeight:600}}>{c.clock_out ? fmt(c.clock_out) : '-'}</div>
                              </td>
                            );
                          }
                          const label = c.isClosed ? '🏪 휴점' : c.isOnLeave ? '📅 휴무' : '미체크';
                          const colors = c.isClosed
                            ? { bg:'#f3e5f5', fg:'#6a1b9a', bd:'#ce93d8' }
                            : c.isOnLeave
                            ? { bg:'#e3f2fd', fg:'#1565C0', bd:'#90caf9' }
                            : { bg:'#ffebee', fg:'var(--danger)', bd:'#f48fb1' };
                          return (
                            <td key={ds} onClick={onClickCell}
                              title={cellClickable ? '클릭해 수정' : ''}
                              style={{textAlign:'center', background: c.isClosed?'#faf5fc':c.isOnLeave?'#f7fbfe':'#fafafa', ...cellStyle}}>
                              <span style={{padding:'2px 8px', background:colors.bg, color:colors.fg, border:`1px solid ${colors.bd}`, borderRadius:3, fontSize:11, fontWeight:700, whiteSpace:'nowrap'}}>
                                {label}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar" style={{flexWrap:'wrap'}}>
            <select className="fsel" value={hStore}
              onChange={e => { setHStore(e.target.value); setHMemberKey(''); }}>
              <option value="">점포 선택</option>
              {stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={hMemberKey}
              onChange={e => setHMemberKey(e.target.value)} disabled={!hStore}
              style={{background:!hStore?'#f0f0f0':'#fff'}}>
              <option value="">근무자 선택</option>
              {storeMembers
                .filter(m => m.store_name === hStore)
                .map(m => (
                  <option key={m.sm_id} value={m.sm_id}>
                    {m.branch_name ? `[${m.branch_name}] ` : ''}{m.display_name}{m.job_title === '부매니저' ? ' (부)' : ''}
                  </option>
                ))
              }
            </select>
            <input type="date" className="fsel" value={hFrom} onChange={e => setHFrom(e.target.value)}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={hTo} onChange={e => setHTo(e.target.value)}/>
            <button className="btn btn-s" onClick={() => { setHFrom(firstOfMonthStr()); setHTo(todayStr()); }}>이번달</button>
            <div className="fbar-right" style={{display:'flex', alignItems:'center', gap:14}}>
              {hMember && (
                <>
                  <span className="fresult">대상기간 <b>{hStat.total}</b>일</span>
                  <span style={{fontSize:12, color:'var(--success)', fontWeight:700}}>근무 {hStat.worked}</span>
                  {hStat.closedDays > 0 && <span style={{fontSize:12, color:'#6a1b9a', fontWeight:700}}>휴점 {hStat.closedDays}</span>}
                  <span style={{fontSize:12, color:'var(--danger)', fontWeight:700}}>미체크 {hStat.missing}</span>
                  <span style={{fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)', fontWeight:700}}>총 {hStat.hours}</span>
                </>
              )}
            </div>
          </div>

          {!hMember
            ? <div className="empty" style={{padding:'40px 0', color:'var(--text3)'}}>점포와 근무자를 선택하면 이력이 표시됩니다</div>
            : hLoading
              ? <div className="empty"><span className="spinner"/></div>
              : (
                <div className="twrap">
                  <table>
                    <thead><tr><th>날짜</th><th>요일</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr></thead>
                    <tbody>
                      {hDisplayRows.length === 0
                        ? <tr><td colSpan={5} className="empty">기간을 선택해주세요</td></tr>
                        : hDisplayRows.map(r => (
                          <tr key={r.date} style={r.isClosed ? {background:'#f3e5f5'} : (!r.clock_in ? {background:'#fafafa'} : {})}>
                            <td className="mono">{r.date}</td>
                            <td style={{
                              fontSize:12, fontWeight:600,
                              color: r.dow === '일' ? 'var(--danger)' : r.dow === '토' ? 'var(--accent2)' : 'var(--text2)',
                            }}>{r.dow}</td>
                            <td>
                              {r.clock_in
                                ? <span style={{fontFamily:'var(--mono)', color:'var(--success)', fontWeight:600}}>{fmt(r.clock_in)}</span>
                                : r.isClosed
                                  ? <span style={{padding:'2px 8px', background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', borderRadius:3, fontSize:11, fontWeight:700}}>🏪 휴점</span>
                                  : <span style={{padding:'2px 8px', background:'#ffebee', color:'var(--danger)', border:'1px solid #f48fb1', borderRadius:3, fontSize:11, fontWeight:700}}>미체크</span>
                              }
                            </td>
                            <td style={{fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:600}}>{fmt(r.clock_out)}</td>
                            <td className="mono" style={{color:'var(--text2)'}}>{duration(r.clock_in, r.clock_out)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>
      )}

      {tab === 'leave' && (
        <div className="card" style={{padding:'16px 20px'}}>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>신청월</th><th>매니저</th><th>점포</th><th>지점</th><th>선택날짜</th><th>일수</th><th>메모</th><th>제출일</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {plans.length === 0
                    ? <tr><td colSpan={9} className="empty">연차계획 신청 내역이 없습니다</td></tr>
                    : plans.map(p => (
                      <tr key={p.id}>
                        <td className="mono" style={{fontWeight:700}}>{p.target_month}</td>
                        <td><strong>{p.manager_name}</strong></td>
                        <td><span className="badge badge-dept">{p.store_name}</span></td>
                        <td><span className="badge badge-store">{p.branch_name}</span></td>
                        <td style={{fontSize:11, color:'var(--text2)', maxWidth:200}}><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{(p.dates||[]).map(d=><span key={d} style={{background:'#fff3e0',color:'var(--accent)',border:'1px solid #ffcc80',borderRadius:3,padding:'1px 6px',fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{d}</span>)}</div></td>
                        <td style={{textAlign:'center', fontWeight:700, color:'var(--accent)'}}>{(p.dates||[]).length}일</td>
                        <td style={{fontSize:11, color:'var(--text3)'}}>{p.memo||'-'}</td>
                        <td className="mono" style={{fontSize:11}}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                        <td>
                          {p.status === 'pending' ? (
                            <div style={{display:'flex', gap:4}}>
                              <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}}
                                onClick={() => updatePlanStatus(p.id, 'approved')}>확인</button>
                              <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}}
                                onClick={() => updatePlanStatus(p.id, 'rejected')}>반려</button>
                            </div>
                          ) : (
                            <span style={{
                              padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                              background: p.status==='approved'?'#e8f5e9':'#ffebee',
                              color: p.status==='approved'?'var(--success)':'var(--danger)',
                            }}>
                              {p.status==='approved'?'✅ 확인':'❌ 반려'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
