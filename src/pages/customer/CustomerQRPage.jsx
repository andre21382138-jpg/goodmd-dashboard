import React from 'react';
import { toast } from '../../lib/utils';

export default function CustomerQRPage({ profile }) {
  const joinUrl = `${window.location.origin}${window.location.pathname}?m=${profile.id}`;
  const qrImg   = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(joinUrl)}&margin=12`;

  const handlePrint = () => {
    const w = window.open('');
    w.document.write(`<html><head><title>회원가입 QR코드</title></head>
      <body style="text-align:center;padding:40px;font-family:sans-serif">
        <h2>${profile.department} ${profile.branch}</h2>
        <p style="color:#888">(주)한국생활건강 회원가입</p>
        <img src="${qrImg}" style="width:280px;margin:16px 0"/>
        <p style="font-size:11px;color:#bbb">${joinUrl}</p>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`);
  };

  return (
    <div>
      <div className="card" style={{maxWidth:520}}>
        <div style={{textAlign:'center', padding:'8px 0 20px'}}>
          <div style={{fontSize:40, marginBottom:12}}>📱</div>
          <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>매장 QR코드</div>
          <div style={{fontSize:13, color:'var(--text2)', lineHeight:1.8, marginBottom:20}}>
            카운터에 출력해두세요.<br/>
            고객이 스캔하면 <strong>담당자를 직접 선택</strong>하고 가입합니다.
          </div>
          <img src={qrImg} alt="QR코드" style={{width:240, height:240, borderRadius:8, border:'1px solid var(--border)', marginBottom:16}}/>
          <div style={{fontSize:11, color:'var(--text3)', wordBreak:'break-all', marginBottom:20}}>{joinUrl}</div>
          <div style={{display:'flex', gap:10, justifyContent:'center'}}>
            <button className="btn btn-s" onClick={() => { navigator.clipboard?.writeText(joinUrl); toast('URL 복사됨', 'ok'); }}>🔗 URL 복사</button>
            <button className="btn btn-p" onClick={handlePrint}>🖨️ QR 인쇄</button>
          </div>
        </div>
        <div style={{background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:12, color:'#1b5e20', lineHeight:1.8}}>
          ✅ QR코드로 가입한 고객은 <strong>SMS 수신동의</strong>를 직접 체크하므로 별도 서면 동의서가 필요 없습니다.
        </div>
      </div>
    </div>
  );
}
