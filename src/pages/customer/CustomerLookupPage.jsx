import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, GradeBadge, formatPhone } from '../../lib/utils';

function byteLen(str) {
  let len = 0;
  for (const ch of str) len += ch.charCodeAt(0) > 127 ? 2 : 1;
  return len;
}

function consentStatus(c) {
  if (!c.sms_consent_at) {
    return { label: c.sms_consent ? '동의 (만료일 미설정)' : '미동의', color:'#666', tone:'gray' };
  }
  const consentDate = new Date(c.sms_consent_at);
  const expiry = new Date(consentDate); expiry.setFullYear(expiry.getFullYear() + 1);
  const today = new Date();
  const daysToExpiry = Math.ceil((expiry - today) / (1000*60*60*24));
  if (!c.sms_consent) {
    return { label: '🚫 거부', color:'#c62828', tone:'red', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  if (daysToExpiry <= 14 && daysToExpiry > 0) {
    return { label: `⏳ ${daysToExpiry}일 후 만료`, color:'#e65100', tone:'orange', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  if (daysToExpiry <= 0) {
    return { label: '만료됨', color:'#c62828', tone:'red', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
  }
  return { label: `✅ 동의`, color:'#2e7d32', tone:'green', expireStr: expiry.toISOString().slice(0,10), daysToExpiry };
}

export default function CustomerLookupPage({ profile }) {
  const isManager = profile?.job_title === '매니저';
  const canUpload = profile?.role === 'admin' || profile?.job_title === '담당자'; // 본사 일괄 업데이트 전용

  // 회원정보 엑셀 일괄 업데이트
  const memberUploadRef = useRef(null);
  const [memberUploading, setMemberUploading] = useState(false);
  const [memberProgress, setMemberProgress] = useState('');
  const [memberResult, setMemberResult] = useState(null); // {ins, upd, fail, skipped}
  const [search,     setSearch]    = useState('');
  const [fStore,     setFStore]    = useState('');
  const [fBranch,    setFBranch]   = useState('');
  const [fFrom,      setFFrom]     = useState('');
  const [fTo,        setFTo]       = useState('');
  const [fConsent,   setFConsent]  = useState(''); // '' | valid | expired | none
  const [fNewOnly,   setFNewOnly]  = useState(false);
  const [fGrade,     setFGrade]    = useState('');
  const [consentStats, setConsentStats] = useState(null); // {total, valid, expired, none}

  // 동의일+1년 만료 기준 시각 (now-1년)
  const consentCutoffISO = useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString();
  }, []);
  const [customers,  setCustomers] = useState([]);
  const [selected,   setSelected]  = useState(null);
  // 회원 정보 수정 (이름·휴대폰만)
  const [editInfo,   setEditInfo]  = useState(false);
  const [eName,      setEName]     = useState('');
  const [ePhone,     setEPhone]    = useState('');
  const [savingInfo, setSavingInfo]= useState(false);
  const [purchases,  setPurchases] = useState([]);
  const [loading,    setLoading]   = useState(false);
  const [loadingP,   setLoadingP]  = useState(false);
  const [allStores,  setAllStores] = useState([]);
  const [page,       setPage]      = useState(0);
  const [totalCount, setTotalCount]= useState(0);
  const [hasMore,    setHasMore]   = useState(false); // eslint-disable-line no-unused-vars

  // 체크박스 선택 (현재 페이지)
  const [checkedIds, setCheckedIds] = useState(new Set());

  // SMS 모달
  const [smsModal,      setSmsModal]      = useState(false);
  const [smsMsg,        setSmsMsg]        = useState('');
  const [smsSender,     setSmsSender]     = useState(() => {
    try { return localStorage.getItem('sms_sender') || '07078742777'; } catch { return '07078742777'; }
  });
  const [sending,       setSending]       = useState(false);
  const [bulkTargets,   setBulkTargets]   = useState(null); // 전체 발송 시 override
  const [loadingBulk,   setLoadingBulk]   = useState(false);
  const [testPhone,     setTestPhone]     = useState('');
  const [sendingTest,   setSendingTest]   = useState(false);
  const [preview,       setPreview]       = useState(false);
  const [sendResult,    setSendResult]    = useState(null);
  const [isScheduled,   setIsScheduled]   = useState(false);  // 예약발송 토글
  const [scheduleAt,    setScheduleAt]    = useState('');      // datetime-local 값

  // 점포 목록 로드 (profiles에서)
  useEffect(() => {
    supabase.from('profiles').select('department').eq('approved', true)
      .neq('role','admin').neq('job_title','담당자')
      .then(({ data }) => {
        const stores = [...new Set((data||[]).map(d => d.department))].filter(Boolean).sort();
        setAllStores(stores);
      });
  }, []);

  // 마케팅 동의 현황 집계 (전체/유효/만료/미동의) — head count만 조회
  const loadConsentStats = useCallback(async () => {
    const base = () => supabase.from('customers').select('*', { count: 'exact', head: true });
    const [tot, none, valid] = await Promise.all([
      base(),
      base().eq('sms_consent', false),
      base().eq('sms_consent', true).gte('sms_consent_at', consentCutoffISO),
    ]);
    const total = tot.count || 0, noneC = none.count || 0, validC = valid.count || 0;
    setConsentStats({ total, valid: validC, none: noneC, expired: Math.max(0, total - noneC - validC) });
  }, [consentCutoffISO]);
  useEffect(() => { loadConsentStats(); }, [loadConsentStats]);

  const [allBranches, setAllBranches] = useState([]);
  useEffect(() => {
    if (!fStore) { setAllBranches([]); return; }
    supabase.from('profiles').select('branch').eq('approved', true)
      .eq('department', fStore).neq('role','admin').neq('job_title','담당자')
      .then(({ data }) => {
        const branches = [...new Set((data||[]).map(d => d.branch))].filter(Boolean).sort();
        setAllBranches(branches);
      });
  }, [fStore]);

  const PAGE_SIZE = 200;

  const fetchCustomers = useCallback(async (pg = 0, consentOverride) => {
    const consent = consentOverride !== undefined ? consentOverride : fConsent;
    setLoading(true);
    setPage(pg);
    setCheckedIds(new Set());
    let q = supabase.from('customers')
      .select('*', { count: 'exact' })
      .order('joined_at', { ascending: false });
    if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    if (fStore)  q = q.eq('store_name', fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    if (fFrom)   q = q.gte('joined_at', fFrom);
    if (fTo)     q = q.lte('joined_at', fTo);
    if (fGrade)  q = q.eq('grade', fGrade);
    if (fNewOnly) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      q = q.gte('joined_at', oneYearAgo.toISOString().slice(0,10));
    }
    // 마케팅 동의 상태 필터
    if (consent === 'valid') {        // 동의 + 유효(동의일+1년 안 지남)
      q = q.eq('sms_consent', true).gte('sms_consent_at', consentCutoffISO);
    } else if (consent === 'expired') { // 동의했으나 만료(동의일 < 오늘-1년 또는 동의일 없음)
      q = q.eq('sms_consent', true).or(`sms_consent_at.lt.${consentCutoffISO},sms_consent_at.is.null`);
    } else if (consent === 'none') {  // 미동의
      q = q.eq('sms_consent', false);
    }
    const { data, count, error } = await q.range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);
    if (error) { toast(error.message, 'err'); setLoading(false); return; }
    setCustomers(data || []);
    setTotalCount(count || 0);
    setSelected(null); setPurchases([]);
    setLoading(false);
  }, [search, fStore, fBranch, fFrom, fTo, fConsent, fNewOnly, fGrade, consentCutoffISO]);

  // 필터 조건 전체 SMS동의 회원 가져오기 (Supabase 1000행 제한 우회)
  const fetchAllSmsTargets = useCallback(async () => {
    setLoadingBulk(true);
    const CHUNK = 1000;
    let all = [];
    let from = 0;

    const buildQuery = () => {
      let q = supabase.from('customers')
        .select('id, name, phone')
        .eq('sms_consent', true)
        .order('joined_at', { ascending: false });
      if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      if (fStore)  q = q.eq('store_name', fStore);
      if (fBranch) q = q.eq('branch_name', fBranch);
      if (fFrom)   q = q.gte('joined_at', fFrom);
      if (fTo)     q = q.lte('joined_at', fTo);
      if (fGrade)  q = q.eq('grade', fGrade);
      if (fNewOnly) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        q = q.gte('joined_at', oneYearAgo.toISOString().slice(0,10));
      }
      // 발송 대상은 항상 동의자(true) — 유효/만료만 추가로 구분
      if (fConsent === 'valid')   q = q.gte('sms_consent_at', consentCutoffISO);
      if (fConsent === 'expired') q = q.or(`sms_consent_at.lt.${consentCutoffISO},sms_consent_at.is.null`);
      return q;
    };

    while (true) {
      const { data, error } = await buildQuery().range(from, from + CHUNK - 1);
      if (error) { toast(error.message, 'err'); setLoadingBulk(false); return; }
      if (!data?.length) break;
      all = all.concat(data);
      if (data.length < CHUNK) break;
      from += CHUNK;
    }

    setLoadingBulk(false);
    if (!all.length) { toast('SMS동의 회원이 없습니다', 'inf'); return; }
    setBulkTargets(all);
    setSmsModal(true);
  }, [search, fStore, fBranch, fFrom, fTo, fGrade, fNewOnly, fConsent, consentCutoffISO]);

  // 점포 변경시 지점 초기화
  const handleStoreChange = (val) => { setFStore(val); setFBranch(''); };

  const fetchPurchases = async (customerId) => {
    setLoadingP(true);
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name)')
      .eq('customer_id', customerId)
      .order('sold_at', { ascending: false });
    setPurchases(data || []);
    setLoadingP(false);
  };

  const handleSelect = (c) => { setSelected(c); setEditInfo(false); fetchPurchases(c.id); };

  // 회원 이름·휴대폰 수정
  const openEditInfo = () => { setEName(selected?.name || ''); setEPhone(selected?.phone || ''); setEditInfo(true); };
  const saveInfo = async () => {
    const name = eName.trim();
    const phone = formatPhone(ePhone);
    if (!name) { toast('이름을 입력해주세요', 'err'); return; }
    if (phone.replace(/\D/g, '').length < 10) { toast('휴대폰 번호를 정확히 입력해주세요', 'err'); return; }
    setSavingInfo(true);
    const { error } = await supabase.from('customers').update({ name, phone }).eq('id', selected.id);
    if (error) { toast(error.message, 'err'); setSavingInfo(false); return; }
    toast('회원 정보 수정 완료', 'ok');
    setSelected({ ...selected, name, phone });
    setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, name, phone } : c));
    setEditInfo(false);
    setSavingInfo(false);
  };

  const handleToggleConsent = async (customer) => {
    if (customer.sms_consent) {
      // 동의 → 거부 처리
      const ok = window.confirm(
        `${customer.name}님의 마케팅 수신동의를 거부 처리합니다.\n\n` +
        '⚠️ 시스템 DB만 업데이트되며, 실제 SMS 차단은\n' +
        '회원이 0808092009로 직접 거부 통화하거나\n' +
        '운영자가 문자나라 대시보드에서 수동 등록해야\n' +
        '적용됩니다.\n\n진행하시겠습니까?'
      );
      if (!ok) return;
      const { error } = await supabase.from('customers').update({
        sms_consent: false,
        sms_unsubscribed_at: new Date().toISOString(),
      }).eq('id', customer.id);
      if (error) { toast(error.message, 'err'); return; }
      toast('거부 처리 완료', 'ok');
      fetchCustomers();
      if (selected?.id === customer.id) {
        setSelected({ ...selected, sms_consent: false, sms_unsubscribed_at: new Date().toISOString() });
      }
    } else {
      // 거부 → 동의 (재동의)
      const ok = window.confirm(
        `${customer.name}님의 마케팅 수신동의를 다시 활성화합니다.\n\n` +
        '⚠️ 회원이 직접 매장에서 동의 의사를 명시적으로\n' +
        '표현한 경우에만 진행해주세요.\n\n' +
        '· 동의일 = 오늘\n· 만료일 = 1년 후\n\n진행하시겠습니까?'
      );
      if (!ok) return;
      const newConsentAt = new Date().toISOString();
      const { error } = await supabase.from('customers').update({
        sms_consent: true,
        sms_consent_at: newConsentAt,
        sms_unsubscribed_at: null,
      }).eq('id', customer.id);
      if (error) { toast(error.message, 'err'); return; }
      toast('동의 처리 완료', 'ok');
      fetchCustomers();
      if (selected?.id === customer.id) {
        setSelected({ ...selected, sms_consent: true, sms_consent_at: newConsentAt, sms_unsubscribed_at: null });
      }
    }
  };

  const withdrawCustomer = async (c, e) => {
    e.stopPropagation();
    if (!window.confirm(`[${c.name}] 회원을 탈퇴 처리하시겠습니까?\n\n이름: ${c.name}\n연락처: ${c.phone}\n점포: ${c.store_name} ${c.branch_name}\n\n탈퇴 후에는 회원 정보가 삭제됩니다.`)) return;
    const { data, error } = await supabase.from('customers').delete().eq('id', c.id).select('id');
    if (error) { toast(error.message, 'err'); return; }
    if (!data || data.length === 0) {
      toast('탈퇴 권한이 없습니다 (RLS). 본사 담당자 삭제 정책이 필요합니다.', 'err');
      return;
    }
    toast(`${c.name} 회원 탈퇴 처리 완료`, 'ok');
    if (selected?.id === c.id) setSelected(null);
    fetchCustomers();
  };

  // 테스트 발송 (본인 번호)
  const handleTestSend = async () => {
    const phone = testPhone.replace(/\D/g, '');
    if (phone.length < 10) { toast('휴대폰 번호를 확인해주세요', 'err'); return; }
    if (!smsSender.replace(/\D/g,'')) { toast('발신번호를 입력해주세요', 'err'); return; }
    if (!smsMsg.trim()) { toast('메시지를 입력해주세요', 'err'); return; }
    setSendingTest(true);
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivers: [{ name: '테스트', phone }],
          message: smsMsg,
          sender: smsSender,
        }),
      });
      const result = await res.json();
      if (!res.ok) toast(result.error || '테스트 발송 실패', 'err');
      else if (result.ok === 1) toast(`✅ 테스트 발송 성공 → ${testPhone}`, 'ok');
      else toast(`테스트 발송 실패: ${result.failed?.[0] || '알 수 없는 오류'}`, 'err');
    } catch(e) {
      toast('네트워크 오류: ' + e.message, 'err');
    }
    setSendingTest(false);
  };

  // 체크박스 토글
  const toggleCheck = (e, id) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 전체 선택 / 해제 (SMS동의 회원만)
  const smsConsentIds = useMemo(() => customers.filter(c => c.sms_consent).map(c => c.id), [customers]);
  const allChecked = smsConsentIds.length > 0 && smsConsentIds.every(id => checkedIds.has(id));
  const toggleAll = (e) => {
    e.stopPropagation();
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(smsConsentIds));
    }
  };

  // 선택된 수신자 목록 (bulkTargets 우선)
  const checkedCustomers = useMemo(
    () => bulkTargets ?? customers.filter(c => checkedIds.has(c.id)),
    [bulkTargets, customers, checkedIds]
  );

  // SMS 발송 (즉시 or 예약)
  const handleSendSms = async () => {
    if (!smsSender.replace(/\D/g,'')) { toast('발신번호를 입력해주세요', 'err'); return; }
    if (!smsMsg.trim()) { toast('메시지를 입력해주세요', 'err'); return; }
    if (checkedCustomers.length === 0) { toast('수신자를 선택해주세요', 'err'); return; }
    if (isScheduled) {
      if (!scheduleAt) { toast('예약 일시를 선택해주세요', 'err'); return; }
      if (new Date(scheduleAt) <= new Date()) { toast('예약 시간은 현재보다 미래여야 합니다', 'err'); return; }
      setSending(true);
      const { error } = await supabase.from('sms_schedules').insert({
        scheduled_at: new Date(scheduleAt).toISOString(),
        message: smsMsg,
        sender: smsSender,
        receivers: checkedCustomers.map(c => ({ name: c.name, phone: c.phone })),
      });
      setSending(false);
      if (error) { toast(error.message, 'err'); return; }
      toast(`예약 완료 — ${new Date(scheduleAt).toLocaleString('ko-KR')} 발송 예정`, 'ok');
      setSmsModal(false); setSmsMsg(''); setSmsSender(''); setBulkTargets(null); setIsScheduled(false); setScheduleAt(''); setCheckedIds(new Set()); setIsScheduled(false); setScheduleAt('');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivers: checkedCustomers.map(c => ({ name: c.name, phone: c.phone })),
          message: smsMsg,
          sender: smsSender,
        }),
      });
      const result = await res.json();
      if (!res.ok) { toast(result.error || 'SMS 발송 실패', 'err'); }
      else {
        if (result.details?.length) {
          const sentAt = new Date().toISOString();
          const rows = result.details.map(d => ({
            sent_at: sentAt, message: smsMsg, sender: smsSender,
            receiver: d.phone, receiver_name: d.name, status: d.status,
          }));
          for (let i = 0; i < rows.length; i += 500) {
            await supabase.from('sms_logs').insert(rows.slice(i, i + 500));
          }
        }
        setSendResult({ ...result, total: checkedCustomers.length });
        setSmsModal(false); setSmsMsg(''); setSmsSender(''); setBulkTargets(null); setIsScheduled(false); setScheduleAt(''); setCheckedIds(new Set());
      }
    } catch(e) {
      toast('네트워크 오류: ' + e.message, 'err');
    }
    setSending(false);
  };

  // 단건 문자 버튼 (행 내)
  const handleSingleSms = (e, c) => {
    e.stopPropagation();
    if (!c.sms_consent) { toast('SMS 수신 미동의 회원입니다', 'err'); return; }
    setCheckedIds(new Set([c.id]));
    setSmsModal(true);
  };

  const effQty = (r) => Math.max(0, (r.quantity||0) - (r.returned_qty||0));
  const totalAmt = useMemo(() => purchases.reduce((s,r) => s + r.price * effQty(r), 0), [purchases]);
  const totalQty = useMemo(() => purchases.reduce((s,r) => s + effQty(r), 0), [purchases]); // eslint-disable-line no-unused-vars

  const msgBytes = byteLen(smsMsg);

  // ══════════════════════════════════════════════════════════
  // 회원정보 엑셀 일괄 업데이트 (본사 전용)
  // - 헤더가 6~7행 2줄로 나뉘어 있어 토큰별로 컬럼을 탐지
  // - 매칭 기준: 휴대폰(숫자만) + 이름  → 같으면 갱신, 없으면 신규 추가
  // - 가입그룹의 'D _ ' 접두어 제거. 앱에 없는 매장도 엑셀 값 그대로 등록
  // ══════════════════════════════════════════════════════════
  const handleMemberUploadClick = () => memberUploadRef.current?.click();
  const handleMemberUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm(
      '회원정보 엑셀을 앱에 일괄 반영합니다.\n\n' +
      '• 휴대폰+이름이 같은 기존 회원 → 적립금·등급 등 엑셀 값으로 갱신\n' +
      '• 없는 회원 → 신규 추가\n\n' +
      '대량(수만 건) 처리라 수 분이 걸릴 수 있습니다. 계속할까요?'
    )) return;

    setMemberUploading(true);
    setMemberResult(null);
    setMemberProgress('파일 읽는 중...');
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // 헤더 토큰 → 컬럼 인덱스 (첫 12행에서 탐색, 줄바꿈/공백 무시)
      const norm = v => String(v ?? '').replace(/\s/g, '');
      const findCol = (...tokens) => {
        for (let i = 0; i < Math.min(rows.length, 12); i++) {
          const r = rows[i] || [];
          for (let c = 0; c < r.length; c++) {
            if (tokens.some(t => norm(r[c]) === norm(t))) return c;
          }
        }
        return -1;
      };
      const col = {
        name:   findCol('고객명'),
        phone:  findCol('휴대전화번호'),
        group:  findCol('가입그룹'),
        store:  findCol('가입매장'),
        joined: findCol('가입일'),
        birth:  findCol('생년월일'),
        gender: findCol('성별'),
        grade:  findCol('등급'),
        avail:  findCol('가용포인트'),
        used:   findCol('사용포인트'),
        pcnt:   findCol('구매횟수'),
        pqty:   findCol('구매수량'),
        pamt:   findCol('구매금액'),
        sms:    findCol('SMS수신여부'),
      };
      if (col.name === -1 || col.phone === -1) {
        toast('헤더(고객명/휴대전화번호 컬럼)를 찾지 못했습니다', 'err');
        setMemberUploading(false); setMemberProgress(''); return;
      }

      // 엑셀 날짜 직렬값 → YYYY-MM-DD (UTC 기준, 타임존 오차 방지)
      const serialToYmd = (v) => {
        if (v == null || v === '') return null;
        if (typeof v === 'number' && v > 0) {
          const d = new Date(Math.round((v - 25569) * 86400 * 1000));
          if (isNaN(d)) return null;
          const p = n => String(n).padStart(2, '0');
          return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`;
        }
        const s = String(v).trim();
        const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
        if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
        return null;
      };
      const numOf = (v) => {
        const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? n : 0;
      };
      const cell = (r, c) => (c === -1 ? '' : r[c]);

      // 유효 데이터 추출 + 파일 내 중복(휴대폰+이름) 제거(마지막 행 우선)
      const byKey = new Map();
      let skipped = 0;
      for (const r of rows) {
        const name = String(cell(r, col.name) ?? '').trim();
        const phoneRaw = String(cell(r, col.phone) ?? '').trim();
        const digits = phoneRaw.replace(/\D/g, '');
        if (!name || digits.length < 10) { skipped++; continue; } // 합계행·빈행 제외
        const groupRaw = String(cell(r, col.group) ?? '').trim();
        if (groupRaw.includes('테스트')) { skipped++; continue; }   // 테스트 데이터 제외
        const store_name = groupRaw.replace(/^D\s*_\s*/, '').trim();
        const rec = {
          key: `${digits}|${name}`,
          name,
          phone: formatPhone(phoneRaw),
          store_name,
          branch_name: String(cell(r, col.store) ?? '').trim() || null,
          joined_at: serialToYmd(cell(r, col.joined)),
          birthday: serialToYmd(cell(r, col.birth)),
          gender: ['여','남'].includes(String(cell(r, col.gender)).trim()) ? String(cell(r, col.gender)).trim() : null,
          grade: String(cell(r, col.grade) ?? '').trim() || null,
          total_points: numOf(cell(r, col.avail)),
          used_points: numOf(cell(r, col.used)),
          purchase_count: numOf(cell(r, col.pcnt)),
          purchase_qty: numOf(cell(r, col.pqty)),
          total_purchase: numOf(cell(r, col.pamt)),
          sms_consent: String(cell(r, col.sms)).trim() === '1',
        };
        byKey.set(rec.key, rec); // 같은 휴대폰+이름이면 마지막 행으로 덮어씀
      }
      const records = [...byKey.values()];
      if (records.length === 0) {
        toast('반영할 회원 데이터가 없습니다', 'err');
        setMemberUploading(false); setMemberProgress(''); return;
      }

      // 기존 회원 전체 조회 (휴대폰숫자+이름 → id) — 1000행 제한 페이징
      setMemberProgress('기존 회원 확인 중...');
      const existing = new Map();
      let start = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase.from('customers')
          .select('id, phone, name').order('id').range(start, start + PAGE - 1);
        if (error) break;
        if (!data || data.length === 0) break;
        for (const ex of data) {
          const k = `${String(ex.phone || '').replace(/\D/g, '')}|${String(ex.name || '').trim()}`;
          if (!existing.has(k)) existing.set(k, ex.id);
        }
        if (data.length < PAGE) break;
        start += PAGE;
      }

      const updates = [];
      const inserts = [];
      for (const rec of records) {
        const { key, ...fields } = rec;
        const id = existing.get(key);
        if (id) {
          updates.push({ id, fields }); // manager_name·sms_consent_at은 보존(미포함)
        } else {
          // 신규: 동의일은 가입일을 기준으로 설정 (엑셀에 동의일 컬럼이 없음)
          inserts.push({
            ...fields,
            sms_consent_at: fields.sms_consent ? fields.joined_at : null,
            manager_name: null,
            created_by: profile?.id || null,
          });
        }
      }

      let ok = 0, fail = 0;
      // INSERT (배치 500)
      const INS = 500;
      for (let i = 0; i < inserts.length; i += INS) {
        const slice = inserts.slice(i, i + INS);
        const { error } = await supabase.from('customers').insert(slice);
        if (error) fail += slice.length; else ok += slice.length;
        setMemberProgress(`신규 추가 ${Math.min(i + INS, inserts.length).toLocaleString()} / ${inserts.length.toLocaleString()}`);
      }
      // UPDATE (id별, 동시 80건)
      const UPD = 80;
      for (let i = 0; i < updates.length; i += UPD) {
        const slice = updates.slice(i, i + UPD);
        const results = await Promise.all(slice.map(u =>
          supabase.from('customers').update(u.fields).eq('id', u.id)
        ));
        for (const { error } of results) { if (error) fail++; else ok++; }
        setMemberProgress(`기존 갱신 ${Math.min(i + UPD, updates.length).toLocaleString()} / ${updates.length.toLocaleString()}`);
      }

      const parts = [
        `신규 ${inserts.length.toLocaleString()}건`,
        `갱신 ${updates.length.toLocaleString()}건`,
      ];
      if (fail > 0) parts.push(`실패 ${fail.toLocaleString()}건`);
      if (skipped > 0) parts.push(`제외 ${skipped.toLocaleString()}행`);
      toast(`회원 반영 완료 — ${parts.join(' / ')}`, fail > 0 ? 'err' : 'ok');
      setMemberResult({ ins: inserts.length, upd: updates.length, fail, skipped });
    } catch (err) {
      toast('업로드 실패: ' + (err.message || err), 'err');
    }
    setMemberUploading(false);
    setMemberProgress('');
  };

  return (
    <div>
      {/* 검색·필터 */}
      <div className="card">
        <div className="card-label">회원 조회</div>
        {/* 마케팅 동의 현황 — 클릭하면 해당 조건으로 조회 */}
        {consentStats && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
            {[
              { key:'',        label:'전체 회원',          val:consentStats.total,   color:'#37474f', bg:'#eceff1' },
              { key:'valid',   label:'동의 (유효·1년미만)', val:consentStats.valid,   color:'#2e7d32', bg:'#e8f5e9' },
              { key:'expired', label:'동의 (만료)',         val:consentStats.expired, color:'#e65100', bg:'#fff3e0' },
              { key:'none',    label:'미동의',             val:consentStats.none,    color:'#c62828', bg:'#ffebee' },
            ].map(s => (
              <button key={s.key || 'all'} type="button"
                onClick={() => { setFConsent(s.key); fetchCustomers(0, s.key); }}
                style={{ flex:'1 1 160px', minWidth:140, textAlign:'left', cursor:'pointer',
                  padding:'10px 14px', borderRadius:'var(--radius)', background:s.bg,
                  border:`2px solid ${fConsent === s.key ? s.color : 'transparent'}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:800, color:s.color, fontFamily:'var(--mono)' }}>
                  {s.val.toLocaleString()}<span style={{ fontSize:12, fontWeight:600, marginLeft:2 }}>명</span>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="fbar" style={{ flexWrap:'wrap', gap:8 }}>
          <input className="finput" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 연락처 검색" style={{ height:34 }}
            onKeyDown={e => e.key==='Enter' && fetchCustomers()} />
          <select className="fsel" value={fStore} onChange={e => handleStoreChange(e.target.value)}>
            <option value="">전체 점포</option>
            {allStores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)}
            disabled={!fStore} style={{ background: !fStore ? '#f0f0f0' : '#fff' }}>
            <option value="">전체 지점</option>
            {allBranches.map(b => <option key={b}>{b}</option>)}
          </select>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="가입일 시작" />
          <span style={{fontSize:12,color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="가입일 종료" />
          <select className="fsel" value={fConsent}
            onChange={e => { setFConsent(e.target.value); fetchCustomers(0, e.target.value); }}
            title="마케팅 수신동의 상태">
            <option value="">마케팅동의 전체</option>
            <option value="valid">동의(유효·1년미만)</option>
            <option value="expired">동의(만료)</option>
            <option value="none">미동의</option>
          </select>
          <button type="button"
            onClick={() => setFNewOnly(p => !p)}
            title="가입한 지 1년 미만인 회원"
            style={{ height:34, padding:'0 14px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
              borderColor: fNewOnly ? '#1565C0' : 'var(--border)',
              background: fNewOnly ? '#e3f2fd' : '#fff',
              color: fNewOnly ? '#1565C0' : 'var(--text2)' }}>
            {fNewOnly ? '✅ 가입 1년 미만' : '📅 가입 1년 미만'}
          </button>
          <select className="fsel" value={fGrade} onChange={e => setFGrade(e.target.value)}>
            <option value="">전체 등급</option>
            {['VVIP','VIP','로얄','골드','실버','패밀리'].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {(search||fStore||fBranch||fFrom||fTo||fConsent||fNewOnly||fGrade) &&
            <button className="btn-ghost" onClick={() => { setSearch(''); setFStore(''); setFBranch(''); setFFrom(''); setFTo(''); setFConsent(''); setFNewOnly(false); setFGrade(''); setCustomers([]); setSelected(null); setPage(0); setTotalCount(0); setHasMore(false); setCheckedIds(new Set()); }}>✕ 초기화</button>}
          <div className="fbar-right" style={{display:'flex', gap:8, alignItems:'center'}}>
            {canUpload && (
              <>
                <input ref={memberUploadRef} type="file" accept=".xls,.xlsx"
                  onChange={handleMemberUploadFile} style={{display:'none'}}/>
                <button type="button" onClick={handleMemberUploadClick} disabled={memberUploading}
                  title="회원정보 취합 엑셀을 일괄 반영 (휴대폰+이름 기준 갱신/추가)"
                  style={{height:34, padding:'0 14px', border:'1px solid #2e7d32', borderRadius:'var(--radius)',
                    background:'#e8f5e9', color:'#2e7d32', fontSize:12, fontWeight:700,
                    cursor: memberUploading ? 'not-allowed' : 'pointer', whiteSpace:'nowrap'}}>
                  {memberUploading ? <span className="spinner"/> : '📥 회원 일괄 업데이트'}
                </button>
              </>
            )}
            <button className="btn btn-p" onClick={() => fetchCustomers(0)} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔍 조회'}
            </button>
          </div>
          {memberUploading && memberProgress && (
            <div style={{width:'100%', marginTop:8, padding:'8px 12px', background:'#e8f5e9',
              border:'1px solid #a5d6a7', borderRadius:'var(--radius)', fontSize:12, color:'#2e7d32', fontWeight:600}}>
              ⏳ {memberProgress} — 창을 닫지 마세요
            </div>
          )}
          {!memberUploading && memberResult && (
            <div style={{width:'100%', marginTop:8, padding:'12px 14px',
              background: memberResult.fail > 0 ? '#fff3e0' : '#e8f5e9',
              border:`1px solid ${memberResult.fail > 0 ? '#ffb74d' : '#a5d6a7'}`,
              borderRadius:'var(--radius)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <span style={{fontSize:13, fontWeight:700, color: memberResult.fail > 0 ? '#e65100' : '#2e7d32'}}>
                ✅ 회원 일괄 업데이트 완료
              </span>
              <span style={{fontSize:13, color:'var(--text)'}}>
                신규 추가 <b>{memberResult.ins.toLocaleString()}</b>건 ·
                기존 갱신 <b>{memberResult.upd.toLocaleString()}</b>건
                {memberResult.fail > 0 && <> · <span style={{color:'var(--danger)'}}>실패 <b>{memberResult.fail.toLocaleString()}</b>건</span></>}
                {memberResult.skipped > 0 && <span style={{color:'var(--text3)'}}> · 제외 {memberResult.skipped.toLocaleString()}행</span>}
              </span>
              <button type="button" onClick={() => setMemberResult(null)}
                style={{marginLeft:'auto', height:28, padding:'0 12px', border:'1px solid var(--border)',
                  borderRadius:'var(--radius)', background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer'}}>
                닫기
              </button>
            </div>
          )}
        </div>
      </div>

      {customers.length > 0 && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8}}>
            <span className="fresult">총 <b>{totalCount.toLocaleString()}</b>명 · 이 페이지 <b>{customers.length}</b>명 · SMS동의 <b>{customers.filter(c=>c.sms_consent).length}</b>명</span>
            <div style={{display:'flex', gap:8}}>
              {checkedIds.size > 0 && (
                <button
                  className="btn btn-p"
                  style={{padding:'6px 18px', fontSize:13, fontWeight:700}}
                  onClick={() => setSmsModal(true)}>
                  📨 선택 {checkedIds.size}명 문자 발송
                </button>
              )}
              <button
                className="btn btn-s"
                style={{padding:'6px 18px', fontSize:13, fontWeight:700}}
                onClick={fetchAllSmsTargets}
                disabled={loadingBulk}
                title="현재 필터 조건의 SMS동의 회원 전체에게 발송">
                {loadingBulk ? <span className="spinner"/> : `📡 필터 전체 일괄발송`}
              </button>
            </div>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{textAlign:'center', width:36}}>
                    <input type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      title="SMS동의 회원 전체 선택"
                      style={{cursor:'pointer', width:15, height:15}}/>
                  </th>
                  <th>가입일</th>
                  <th>이름</th>
                  <th>등급</th>
                  <th>성별</th>
                  <th>휴대폰번호</th>
                  <th>생일</th>
                  <th>점포</th>
                  <th>지점</th>
                  <th>담당매니저</th>
                  <th className="r">남은적립금</th>
                  <th className="r">사용적립금</th>
                  <th className="r">구매건수</th>
                  <th className="r">구매수량</th>
                  <th className="r">총구매금액</th>
                  <th style={{textAlign:'center'}}>마케팅동의</th>
                  <th></th>
                  {!isManager && <th></th>}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} style={{cursor:'pointer'}} onClick={() => handleSelect(c)}>
                    <td style={{textAlign:'center'}} onClick={e => e.stopPropagation()}>
                      {c.sms_consent ? (
                        <input type="checkbox"
                          checked={checkedIds.has(c.id)}
                          onChange={e => toggleCheck(e, c.id)}
                          style={{cursor:'pointer', width:15, height:15}}/>
                      ) : (
                        <span style={{color:'var(--text3)', fontSize:12}}>-</span>
                      )}
                    </td>
                    <td className="mono" style={{fontSize:11}}>{c.joined_at}</td>
                    <td><strong style={{fontSize:13}}>{c.name}</strong></td>
                    <td><GradeBadge grade={c.grade || '패밀리'}/></td>
                    <td style={{fontSize:13}}>{c.gender || '-'}</td>
                    <td className="mono" style={{fontSize:12}}>{c.phone}</td>
                    <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{c.birthday || '-'}</td>
                    <td><span className="badge badge-dept">{c.store_name}</span></td>
                    <td><span className="badge badge-store">{c.branch_name}</span></td>
                    <td style={{fontSize:12, color:'var(--accent)', fontWeight:600}}>{c.manager_name || '-'}</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', color: (c.total_points||0)>0?'var(--success)':'var(--text3)', whiteSpace:'nowrap'}}>{(c.total_points||0).toLocaleString()}원</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', color:'var(--text3)', whiteSpace:'nowrap'}}>{(c.used_points||0).toLocaleString()}원</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', whiteSpace:'nowrap'}}>{(c.purchase_count||0)}건</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', whiteSpace:'nowrap'}}>{(c.purchase_qty||0)}개</td>
                    <td className="r" style={{fontSize:12, fontFamily:'var(--mono)', fontWeight:600, whiteSpace:'nowrap'}}>{(c.total_purchase||0).toLocaleString()}원</td>
                    <td style={{textAlign:'center'}}>
                      {(() => {
                        const st = consentStatus(c);
                        return (
                          <span style={{
                            display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700,
                            background: st.tone==='green' ? '#e8f5e9' : st.tone==='orange' ? '#fff3e0' : st.tone==='red' ? '#ffebee' : '#f5f5f5',
                            color: st.color,
                            border: `1px solid ${st.tone==='green' ? '#a5d6a7' : st.tone==='orange' ? '#ffcc80' : st.tone==='red' ? '#ef9a9a' : '#ddd'}`,
                          }} title={st.expireStr ? `만료일: ${st.expireStr}` : ''}>
                            {st.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <button
                        className="btn btn-s"
                        style={{fontSize:11, padding:'3px 10px', opacity: c.sms_consent ? 1 : 0.35}}
                        title={c.sms_consent ? '문자 발송' : 'SMS 미동의 회원'}
                        onClick={e => handleSingleSms(e, c)}>
                        📱 문자
                      </button>
                    </td>
                    {!isManager && (
                      <td>
                        <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}}
                          onClick={e => withdrawCustomer(c, e)}>
                          탈퇴
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 페이지 네비게이션 */}
          {totalCount > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(totalCount / PAGE_SIZE);
            const visiblePages = [];
            const delta = 4;
            let start = Math.max(0, page - delta);
            let end   = Math.min(totalPages - 1, page + delta);
            if (end - start < delta * 2) {
              start = Math.max(0, end - delta * 2);
              end   = Math.min(totalPages - 1, start + delta * 2);
            }
            for (let i = start; i <= end; i++) visiblePages.push(i);
            const btnStyle = (active) => ({
              height: 32, minWidth: 32, padding: '0 8px', border: '1px solid',
              borderRadius: 'var(--radius)', fontSize: 13, fontWeight: active ? 700 : 400,
              cursor: 'pointer',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              background: active ? '#fff3e0' : '#fff',
              color: active ? 'var(--accent)' : 'var(--text2)',
            });
            return (
              <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'14px 0', borderTop:'1px solid var(--border)', flexWrap:'wrap'}}>
                <button style={btnStyle(false)} disabled={page===0} onClick={() => fetchCustomers(0)}>«</button>
                <button style={btnStyle(false)} disabled={page===0} onClick={() => fetchCustomers(page-1)}>‹</button>
                {start > 0 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                {visiblePages.map(p => (
                  <button key={p} style={btnStyle(p===page)} onClick={() => fetchCustomers(p)}>{p+1}</button>
                ))}
                {end < totalPages-1 && <span style={{padding:'0 4px', color:'var(--text3)'}}>...</span>}
                <button style={btnStyle(false)} disabled={page===totalPages-1} onClick={() => fetchCustomers(page+1)}>›</button>
                <button style={btnStyle(false)} disabled={page===totalPages-1} onClick={() => fetchCustomers(totalPages-1)}>»</button>
                <span style={{fontSize:12, color:'var(--text3)', marginLeft:8}}>
                  {page+1} / {totalPages}페이지 (총 {totalCount.toLocaleString()}명)
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* SMS 발송 모달 */}
      {smsModal && (
        <div style={{position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(520px,95vw)', boxShadow:'0 8px 40px rgba(0,0,0,0.25)', padding:'24px'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', alignItems:'center', marginBottom:18}}>
              <div style={{fontSize:17, fontWeight:700}}>📨 마케팅 SMS 발송</div>
              <button onClick={() => { if (!sending) { setSmsModal(false); setSmsMsg(''); setSmsSender(''); setBulkTargets(null); setIsScheduled(false); setScheduleAt(''); } }}
                style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
            </div>

            {/* 수신자 요약 */}
            <div style={{background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, fontSize:13}}>
              <span style={{fontWeight:700, color:'var(--accent)'}}>수신자 {checkedCustomers.length}명</span>
              <span style={{color:'var(--text2)', marginLeft:8}}>
                {checkedCustomers.slice(0,5).map(c => c.name).join(', ')}{checkedCustomers.length > 5 ? ` 외 ${checkedCustomers.length - 5}명` : ''}
              </span>
            </div>

            {/* 발신번호 */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:6}}>발신번호 <span style={{fontWeight:400, color:'var(--text3)'}}>(문자나라에 사전등록된 번호)</span></label>
              <input
                value={smsSender}
                onChange={e => { setSmsSender(e.target.value); try { localStorage.setItem('sms_sender', e.target.value); } catch {} }}
                placeholder="01012345678"
                style={{width:'100%', height:36, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--mono)', outline:'none', boxSizing:'border-box'}}
              />
            </div>

            {/* 메시지 입력 */}
            <div style={{marginBottom:6}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:6}}>메시지 내용</label>
              <textarea
                value={smsMsg}
                onChange={e => setSmsMsg(e.target.value)}
                rows={6}
                placeholder="발송할 메시지를 입력하세요"
                style={{width:'100%', padding:'10px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', resize:'vertical', outline:'none', boxSizing:'border-box'}}
              />
            </div>

            {/* 바이트 카운터 + 미리보기 */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, fontSize:12}}>
              <button
                type="button"
                onClick={() => setPreview(true)}
                disabled={!smsMsg.trim()}
                style={{height:28, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:12, fontWeight:600, cursor:'pointer', background:'#fff', color:'var(--text2)'}}>
                📱 미리보기
              </button>
              <span style={{color: msgBytes > 2000 ? 'var(--err, #d32f2f)' : msgBytes > 90 ? '#f57c00' : 'var(--text3)'}}>
                {msgBytes} byte{msgBytes <= 90 ? ` (단문 SMS)` : msgBytes <= 2000 ? ` (장문 LMS)` : ` ⚠ 2000byte 초과`}
              </span>
            </div>

            {/* 예약 발송 토글 */}
            <div style={{background:'#f3e5f5', border:'1px solid #ce93d8', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:14}}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom: isScheduled ? 10 : 0}}>
                <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:700, color:'#6a1b9a'}}>
                  <input type="checkbox" checked={isScheduled} onChange={e => { setIsScheduled(e.target.checked); setScheduleAt(''); }}
                    style={{width:16, height:16, cursor:'pointer', accentColor:'#7b1fa2'}}/>
                  🕐 예약 발송
                </label>
                {isScheduled && <span style={{fontSize:11, color:'#8e24aa'}}>지정한 시간에 자동 발송됩니다</span>}
              </div>
              {isScheduled && (
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={e => setScheduleAt(e.target.value)}
                  min={new Date(Date.now() + 60000).toISOString().slice(0,16)}
                  style={{width:'100%', height:36, padding:'0 10px', border:'1px solid #ce93d8', borderRadius:'var(--radius)', fontSize:13, outline:'none', boxSizing:'border-box', background:'#fff'}}
                />
              )}
            </div>

            {/* 테스트 발송 */}
            <div style={{background:'#fffde7', border:'1px dashed #f9a825', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:14}}>
              <div style={{fontSize:12, fontWeight:700, color:'#f57f17', marginBottom:8}}>🧪 테스트 발송 (본인 번호로 먼저 확인)</div>
              <div style={{display:'flex', gap:8}}>
                <input
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  style={{flex:1, height:34, padding:'0 10px', border:'1px solid #f9a825', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--mono)', outline:'none'}}
                />
                <button
                  className="btn btn-s"
                  style={{whiteSpace:'nowrap', padding:'0 14px', height:34, borderColor:'#f9a825', color:'#f57f17', fontWeight:700}}
                  onClick={handleTestSend}
                  disabled={sendingTest || !smsMsg.trim() || !smsSender.replace(/\D/g,'')}>
                  {sendingTest ? <span className="spinner"/> : '테스트 발송'}
                </button>
              </div>
            </div>

            <div style={{display:'flex', gap:10}}>
              <button className="btn btn-s" style={{flex:1, justifyContent:'center', height:42}}
                onClick={() => { setSmsModal(false); setSmsMsg(''); setSmsSender(''); setBulkTargets(null); setIsScheduled(false); setScheduleAt(''); }} disabled={sending}>
                취소
              </button>
              <button className="btn btn-p" style={{flex:2, justifyContent:'center', height:42, fontWeight:700}}
                onClick={handleSendSms} disabled={sending || !smsMsg.trim() || !smsSender.replace(/\D/g,'') || msgBytes > 2000 || (isScheduled && !scheduleAt)}>
                {sending ? <span className="spinner"/> : isScheduled ? `🕐 ${checkedCustomers.length}명 예약 등록` : `📨 ${checkedCustomers.length}명에게 발송`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {preview && (
        <div style={{position:'fixed', inset:0, zIndex:11000, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => setPreview(false)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.6)'}}/>
          <div style={{position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:12}}
            onClick={e => e.stopPropagation()}>
            <div style={{color:'#fff', fontSize:13, fontWeight:600, opacity:0.8}}>📱 수신자에게 보이는 화면</div>
            {/* 폰 외곽 */}
            <div style={{
              width:280, background:'#1a1a1a', borderRadius:36, padding:'16px 10px',
              boxShadow:'0 0 0 2px #444, 0 20px 60px rgba(0,0,0,0.6)',
              position:'relative',
            }}>
              {/* 노치 */}
              <div style={{width:80, height:6, background:'#333', borderRadius:3, margin:'0 auto 14px'}}/>
              {/* 화면 */}
              <div style={{background:'#f2f2f7', borderRadius:24, minHeight:360, padding:'16px 12px', display:'flex', flexDirection:'column', gap:8}}>
                {/* 발신번호 */}
                <div style={{textAlign:'center', fontSize:11, color:'#8e8e93', marginBottom:4}}>
                  {smsSender || '발신번호'}
                </div>
                {/* 말풍선 */}
                <div style={{display:'flex', justifyContent:'flex-start'}}>
                  <div style={{
                    background:'#fff', borderRadius:'0 16px 16px 16px',
                    padding:'10px 14px', maxWidth:'85%',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.12)',
                    fontSize:13, lineHeight:1.6, color:'#000',
                    whiteSpace:'pre-wrap', wordBreak:'break-all',
                  }}>
                    <span style={{color:'#8e8e93', fontSize:11}}>[Web발신]{'\n'}</span>
                    {smsMsg}
                  </div>
                </div>
                {/* 시간 */}
                <div style={{fontSize:10, color:'#8e8e93', marginLeft:4}}>
                  {new Date().toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})}
                </div>
              </div>
              {/* 홈버튼 */}
              <div style={{width:40, height:40, background:'#333', borderRadius:'50%', margin:'12px auto 0', border:'2px solid #444'}}/>
            </div>
            <button onClick={() => setPreview(false)}
              style={{color:'#fff', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:20, padding:'8px 24px', fontSize:13, cursor:'pointer', fontWeight:600}}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 전송 결과 모달 */}
      {sendResult && (
        <div style={{position:'fixed', inset:0, zIndex:10500, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => setSendResult(null)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(480px,95vw)', boxShadow:'0 8px 40px rgba(0,0,0,0.25)', padding:'28px 24px'}}
            onClick={e => e.stopPropagation()}>
            <div style={{textAlign:'center', marginBottom:20}}>
              {sendResult.failCount === 0
                ? <div style={{fontSize:40}}>✅</div>
                : <div style={{fontSize:40}}>⚠️</div>
              }
              <div style={{fontSize:18, fontWeight:700, marginTop:8}}>전송 결과</div>
            </div>

            {/* 요약 카드 */}
            <div style={{display:'flex', gap:10, marginBottom:20}}>
              <div style={{flex:1, background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:12, padding:'14px', textAlign:'center'}}>
                <div style={{fontSize:11, color:'#388e3c', fontWeight:600, marginBottom:4}}>발송 성공</div>
                <div style={{fontSize:28, fontWeight:800, color:'#2e7d32', fontFamily:'var(--mono)'}}>{sendResult.ok}</div>
                <div style={{fontSize:11, color:'#388e3c'}}>건</div>
              </div>
              <div style={{flex:1, background: sendResult.failCount > 0 ? '#fce4ec' : '#f5f5f5', border:`1px solid ${sendResult.failCount > 0 ? '#f48fb1' : '#e0e0e0'}`, borderRadius:12, padding:'14px', textAlign:'center'}}>
                <div style={{fontSize:11, color: sendResult.failCount > 0 ? '#c62828' : '#9e9e9e', fontWeight:600, marginBottom:4}}>발송 실패</div>
                <div style={{fontSize:28, fontWeight:800, color: sendResult.failCount > 0 ? '#b71c1c' : '#9e9e9e', fontFamily:'var(--mono)'}}>{sendResult.failCount}</div>
                <div style={{fontSize:11, color: sendResult.failCount > 0 ? '#c62828' : '#9e9e9e'}}>건</div>
              </div>
              <div style={{flex:1, background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:12, padding:'14px', textAlign:'center'}}>
                <div style={{fontSize:11, color:'#1565c0', fontWeight:600, marginBottom:4}}>전체</div>
                <div style={{fontSize:28, fontWeight:800, color:'#0d47a1', fontFamily:'var(--mono)'}}>{sendResult.total}</div>
                <div style={{fontSize:11, color:'#1565c0'}}>명</div>
              </div>
            </div>

            {/* 실패 목록 */}
            {sendResult.failCount > 0 && (
              <div style={{background:'#fafafa', border:'1px solid var(--border)', borderRadius:8, padding:'12px', marginBottom:16, maxHeight:160, overflowY:'auto'}}>
                <div style={{fontSize:12, fontWeight:700, color:'#c62828', marginBottom:8}}>실패 목록</div>
                {sendResult.failed.map((f, i) => (
                  <div key={i} style={{fontSize:12, color:'var(--text2)', padding:'3px 0', borderBottom:'1px solid #f0f0f0'}}>
                    {f}
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-p" style={{width:'100%', justifyContent:'center', height:42, fontWeight:700}}
              onClick={() => setSendResult(null)}>
              확인
            </button>
          </div>
        </div>
      )}

      {/* 회원 상세 팝업 모달 */}
      {selected && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => setSelected(null)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(900px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div style={{padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
              {editInfo ? (
                <>
                  <input value={eName} onChange={e => setEName(e.target.value)} placeholder="이름"
                    style={{height:34, width:130, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:14, fontWeight:700, outline:'none'}}/>
                  <input value={ePhone} onChange={e => setEPhone(formatPhone(e.target.value))} placeholder="휴대폰번호" inputMode="numeric"
                    style={{height:34, width:150, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--mono)', outline:'none'}}/>
                  <button onClick={saveInfo} disabled={savingInfo} className="btn btn-p" style={{height:34, padding:'0 14px', fontSize:13}}>
                    {savingInfo ? <span className="spinner"/> : '저장'}
                  </button>
                  <button onClick={() => setEditInfo(false)} className="btn btn-s" style={{height:34, padding:'0 12px', fontSize:13}}>취소</button>
                </>
              ) : (
                <>
                  <div style={{fontSize:18, fontWeight:700}}>{selected.name}</div>
                  <GradeBadge grade={selected.grade || '패밀리'}/>
                  {selected.gender && <span style={{fontSize:13, color:'var(--text2)'}}>{selected.gender}</span>}
                  <div style={{fontFamily:'var(--mono)', fontSize:13, color:'var(--text2)'}}>{selected.phone}</div>
                  {selected.birthday && <div style={{fontSize:12, color:'var(--text3)'}}>🎂 {selected.birthday}</div>}
                  {canUpload && (
                    <button onClick={openEditInfo} title="이름·휴대폰 수정"
                      style={{height:30, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background:'#fff3e0', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                      ✏️ 정보 수정
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setSelected(null)}
                style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
            </div>
            <div style={{padding:'16px 24px'}}>
              {/* 기본 정보 */}
              <div style={{display:'flex', flexWrap:'wrap', gap:8, fontSize:12, marginBottom:16, paddingBottom:14, borderBottom:'1px solid var(--border)'}}>
                <span style={{color:'var(--text3)'}}>가입일</span><strong>{selected.joined_at}</strong>
                <span style={{color:'var(--border2)'}}>|</span>
                <span className="badge badge-dept">{selected.store_name}</span>
                <span className="badge badge-store">{selected.branch_name}</span>
                {selected.manager_name && (<><span style={{color:'var(--border2)'}}>|</span><span style={{color:'var(--text3)'}}>담당</span><strong style={{color:'var(--accent)'}}>{selected.manager_name}</strong></>)}
                <span style={{color:'var(--border2)'}}>|</span>
                {(() => {
                  const st = consentStatus(selected);
                  return (
                    <span style={{color: st.color, fontWeight:700}}>{st.label}</span>
                  );
                })()}
              </div>
              {/* 통계 카드 */}
              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
                {[
                  {label:'등급',       value: selected.grade||'패밀리', grade:true},
                  {label:'누적구매',   value: (selected.total_purchase||0).toLocaleString()+'원'},
                  {label:'남은적립금', value: (selected.total_points||0).toLocaleString()+'원', color:'var(--success)'},
                  {label:'사용적립금', value: (selected.used_points||0).toLocaleString()+'원'},
                  {label:'구매건수',   value: (selected.purchase_count||purchases.length)+'건'},
                  {label:'구매수량',   value: (selected.purchase_qty||purchases.reduce((s,p)=>s+p.quantity,0))+'개'},
                ].map(s => (
                  <div key={s.label} style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'7px 14px', textAlign:'center', minWidth:90}}>
                    <div style={{fontSize:10, fontWeight:600, color:'var(--text2)', marginBottom:3}}>{s.label}</div>
                    <div style={{fontSize:14, fontWeight:700, color: s.color||'var(--accent)', fontFamily:'var(--mono)'}}>
                      {s.grade ? <GradeBadge grade={s.value}/> : s.value}
                    </div>
                  </div>
                ))}
              </div>
              {/* 마케팅 수신동의 관리 */}
              <div style={{padding:'12px 14px', border:'1px solid var(--border)', borderRadius:6, marginBottom:16, background:'#fafafa'}}>
                <div style={{fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:8, letterSpacing:0.3}}>마케팅 수신동의 관리</div>
                {(() => {
                  const st = consentStatus(selected);
                  return (
                    <>
                      <div style={{fontSize:13, marginBottom:6}}>
                        상태 : <span style={{color: st.color, fontWeight:700}}>{st.label}</span>
                        {st.expireStr && <span style={{marginLeft:10, color:'var(--text3)', fontSize:11}}>만료일: {st.expireStr}</span>}
                      </div>
                      {selected.sms_consent_at && (
                        <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>
                          동의일: {String(selected.sms_consent_at).slice(0,10)}
                        </div>
                      )}
                      {selected.sms_unsubscribed_at && (
                        <div style={{fontSize:11, color:'var(--text3)', marginBottom:8}}>
                          거부일: {String(selected.sms_unsubscribed_at).slice(0,10)}
                        </div>
                      )}
                      <button type="button" onClick={() => handleToggleConsent(selected)}
                        style={{height:30, padding:'0 14px', borderRadius:4, fontSize:12, fontWeight:700, cursor:'pointer',
                          border: selected.sms_consent ? '1px solid #ef9a9a' : '1px solid #a5d6a7',
                          background: selected.sms_consent ? '#fff' : '#e8f5e9',
                          color: selected.sms_consent ? '#c62828' : '#2e7d32'}}>
                        {selected.sms_consent ? '거부 처리' : '동의 처리'}
                      </button>
                    </>
                  );
                })()}
              </div>
              {/* 구매 이력 */}
              <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>구매 이력</div>
              {loadingP ? <div className="empty"><span className="spinner"/></div> : (
                <div className="twrap">
                  <table>
                    <thead>
                      <tr>
                        <th>구매일</th><th>점포</th><th>지점</th>
                        <th>브랜드</th><th>상품명</th>
                        <th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th>
                        <th className="r">적립금사용</th>
                        <th>결제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.length === 0
                        ? <tr><td colSpan={10} className="empty">구매 이력이 없습니다</td></tr>
                        : purchases.map(p => {
                          const fully = (p.returned_qty||0) >= (p.quantity||0);
                          const partial = (p.returned_qty||0) > 0 && !fully;
                          const eff = effQty(p);
                          const strike = fully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                          return (
                          <tr key={p.id} style={fully?{background:'#fafafa'}:{}}>
                            <td className="mono" style={strike}>{p.sold_at}</td>
                            <td><span className="badge badge-dept" style={fully?{opacity:0.5}:{}}>{p.store_name}</span></td>
                            <td><span className="badge badge-store" style={fully?{opacity:0.5}:{}}>{p.branch_name}</span></td>
                            <td style={strike}>{p.brand?.name||'-'}</td>
                            <td style={strike}>
                              {p.product?.name||'-'}
                              {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                              {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {p.returned_qty}</span>}
                            </td>
                            <td className="r" style={strike}>{eff}</td>
                            <td className="r" style={strike}>{Number(p.price).toLocaleString()}</td>
                            <td className="r" style={{fontWeight:600, ...strike}}>{(p.price*eff).toLocaleString()}</td>
                            <td className="r" style={{color: (p.points_used||0) > 0 ? '#6a1b9a' : 'var(--text3)', fontWeight: (p.points_used||0) > 0 ? 700 : 400, fontFamily:'var(--mono)', ...(fully?{opacity:0.5}:{})}}>
                              {(p.points_used||0) > 0 ? `-${Number(p.points_used).toLocaleString()}` : '-'}
                            </td>
                            <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, ...(fully?{opacity:0.5}:{})}}>{p.payment}</span></td>
                          </tr>
                        )})
                      }
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{marginTop:12, fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)'}}>
                총 {purchases.length}건 · {totalAmt.toLocaleString()}원
              </div>
            </div>
          </div>
        </div>
      )}

      {customers.length === 0 && !loading && (
        <div className="empty">
          조건을 설정하고 <strong>조회</strong> 버튼을 눌러주세요<br/>
          <span style={{fontSize:11,color:'var(--text3)'}}>이름·연락처 검색, 점포·지점·날짜 필터 사용 가능 · 조건 없이 조회하면 전체 회원 표시</span>
        </div>
      )}
    </div>
  );
}
