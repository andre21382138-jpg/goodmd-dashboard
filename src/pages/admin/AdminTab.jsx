import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function AdminTab({ profile }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = profile?.role === 'admin'; // eslint-disable-line no-unused-vars

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

  const withdraw = async (u) => {
    if (!window.confirm(`${u.name}(${u.email}) 계정을 탈퇴 처리하시겠습니까?\n탈퇴 후에는 로그인이 불가합니다.`)) return;
    const { error } = await supabase.from('profiles').update({ approved: false }).eq('id', u.id);
    if (error) toast(error.message, 'err');
    else { toast(`${u.name} 탈퇴 처리 완료`, 'ok'); fetchUsers(); }
  };

  const pending = users.filter(u => !u.approved);
  const approved = users.filter(u => u.approved); // eslint-disable-line no-unused-vars

  return (
    <div>
      {pending.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid #E65100' }}>
          <div className="card-label" style={{ color: '#E65100' }}>승인 대기 ({pending.length}명)</div>
          <table className="user-table">
            <thead>
              <tr><th>이름</th><th>직책</th><th>점포명</th><th>지점명</th><th>이메일</th><th>가입일</th><th>상태</th><th>처리</th></tr>
            </thead>
            <tbody>
              {pending.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name || '-'}</strong></td>
                  <td>{u.job_title || '-'}</td>
                  <td>{u.department || '-'}</td>
                  <td>{u.branch || '-'}</td>
                  <td>{u.email}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td><span className="status-badge status-wait">대기 중</span></td>
                  <td style={{display:'flex', gap:4}}>
                    <button className="btn btn-success" onClick={() => approve(u.id)}>✓ 승인</button>
                    <button className="btn-danger" style={{padding:'4px 8px', fontSize:11}} onClick={() => withdraw(u)}>탈퇴</button>
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
              <tr><th>이름</th><th>직책</th><th>점포명</th><th>지점명</th><th>이메일</th><th>권한</th><th>상태</th><th>가입일</th><th>권한 변경</th><th>탈퇴</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name || '-'}</strong></td>
                  <td>{u.job_title || '-'}</td>
                  <td>{u.department || '-'}</td>
                  <td>{u.branch || '-'}</td>
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
                      : <button className="btn btn-s" style={{ fontSize: 11 }} onClick={() => setRole(u.id, 'user')}>일반으로</button>
                    }
                  </td>
                  <td>
                    {u.approved && (
                      <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}} onClick={() => withdraw(u)}>탈퇴</button>
                    )}
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
