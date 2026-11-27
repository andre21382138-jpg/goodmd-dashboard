import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { useStyle, toast, Toasts } from './lib/utils';
import NoticePage from './pages/notice/NoticePage';
import Sidebar from './components/Sidebar';
import NotificationCenter from './components/NotificationCenter';
import StoreSwitcher from './components/StoreSwitcher';
import UserMenu from './components/UserMenu';
import HeaderNav from './components/HeaderNav';
import HomePage from './pages/home/HomePage';
import CustomerQRPage from './pages/customer/CustomerQRPage';
import CustomerDocPage from './pages/customer/CustomerDocPage';
import CustomerLookupPage from './pages/customer/CustomerLookupPage';
import QrBatchPrintPage from './pages/customer/QrBatchPrintPage';
import ConsentQrBatchPrintPage from './pages/customer/ConsentQrBatchPrintPage';
import AttendanceQrBatchPrintPage from './pages/customer/AttendanceQrBatchPrintPage';
import AttendEventStatsPage from './pages/customer/AttendEventStatsPage';
import CustomerInputPage from './pages/customer/CustomerInputPage';
import MyMembersPage from './pages/customer/MyMembersPage';
import SmsHistoryPage from './pages/customer/SmsHistoryPage';
import SmsUnsubscribeSyncPage from './pages/customer/SmsUnsubscribeSyncPage';
import HQDeliveryRequestPage from './pages/customer/HQDeliveryRequestPage';
import SalesInputPage from './pages/sales/SalesInputPage';
import ExpenseInputPage from './pages/sales/ExpenseInputPage';
import SalesReturnPage from './pages/sales/SalesReturnPage';
import MgrSalesViewPage from './pages/sales/MgrSalesViewPage';
import StoreDeliveryStatusPage from './pages/customer/StoreDeliveryStatusPage';
import ClaimIntakePage from './pages/store/ClaimIntakePage';
import PurchaseOrderHQPage from './pages/order/PurchaseOrderHQPage';
import PurchaseOrderMgrPage from './pages/order/PurchaseOrderMgrPage';
import ScmShippingPage from './pages/order/ScmShippingPage';
import OrderRequestHQPage from './pages/order/OrderRequestHQPage';
import StoreReturnsHQPage from './pages/order/StoreReturnsHQPage';
import DailyChecklistPage from './pages/checklist/DailyChecklistPage';
import DailyChecklistHQPage from './pages/checklist/DailyChecklistHQPage';
import SalesListPage from './pages/sales/SalesListPage';
import LectureSalesPage from './pages/sales/LectureSalesPage';
import BizSalesPage from './pages/sales/BizSalesPage';
import SalesViewHub from './pages/sales/SalesViewHub';
import SalesSettlementPage from './pages/sales/SalesSettlementPage';
import AdminTab from './pages/admin/AdminTab';
import ManagerMgmtPage from './pages/admin/ManagerMgmtPage';
import CenterStockPage from './pages/stock/CenterStockPage';
import StockMgmtPage from './pages/stock/StockMgmtPage';
import StoreStockPage from './pages/stock/StoreStockPage';
import StockRequestPage from './pages/stock/StockRequestPage';
import StoreTransfersPage from './pages/stock/StoreTransfersPage';
import SettlementReportPage from './pages/report/SettlementReportPage';
import UploadPage from './pages/stock/UploadPage';
import UploadHistoryPage from './pages/stock/UploadHistoryPage';
import ProductMgmtPage from './pages/product/ProductMgmtPage';
import StoreInfoPage from './pages/store/StoreInfoPage';
import ClockInOutPage from './pages/attendance/ClockInOutPage';
import MyAttendancePage from './pages/attendance/MyAttendancePage';
import LeavePlanPage from './pages/attendance/LeavePlanPage';
import StoreClosurePage from './pages/attendance/StoreClosurePage';
import AttendanceMgmtPage from './pages/attendance/AttendanceMgmtPage';
import IncentivePage from './pages/salary/IncentivePage';
import JoinPage from './pages/join/JoinPage';
import AttendancePage from './pages/join/AttendancePage';
import ConsentRenewPage from './pages/customer/ConsentRenewPage';
import ConsentRenewMgrPage from './pages/customer/ConsentRenewMgrPage';
import HelpPage from './pages/help/HelpPage';
import CwHomePage from './pages/changwon/CwHomePage';
import CwProductsPage from './pages/changwon/CwProductsPage';
import CwInboundPage from './pages/changwon/CwInboundPage';
import CwOutboundPage from './pages/changwon/CwOutboundPage';
import CwStockPage from './pages/changwon/CwStockPage';

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
    --sidebar: #AED581;
    --sidebar-hover: #9CCC65;
    --sidebar-active: #558B2F;
    --sidebar-text: #1a1a1a;
    --accent:  #E65100;
    --accent2: #1565C0;
    --danger:  #C62828;
    --success: #2E7D32;
    --text:    #0a0a0a;
    --text2:   #2b2b2b;
    --text3:   #555555;
    --radius:  6px;
    --mono:    'Pretendard', 'Apple SD Gothic Neo', sans-serif;
    --sans:    'Noto Sans KR', sans-serif;
    --sidebar-w: 220px;
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 15px; line-height: 1.65; -webkit-font-smoothing: antialiased; }
  /* 고연령 사용자 가독성 — 아주 작은(10~11px) 글씨에 최소 크기 보정 */
  table { font-size: 13px; }

  /* ── AUTH ── */
  .auth-wrap { display: flex; min-height: 100vh; background: #f8f8f8; }
  .auth-hero { flex: 7; min-width: 0; background: linear-gradient(135deg, #0d2238 0%, #1a4d4f 55%, #2e7d32 100%); color: #fff; display: flex; flex-direction: column; padding: 40px 56px; position: relative; overflow: hidden; }
  .auth-hero::before { content: ''; position: absolute; right: -120px; bottom: -120px; width: 480px; height: 480px; background: radial-gradient(circle, rgba(255,214,0,0.18) 0%, transparent 60%); pointer-events: none; }
  .auth-hero-logo { height: 48px; width: auto; background: #fff; padding: 6px 12px; border-radius: 8px; align-self: flex-start; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
  .auth-hero-content { flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: 720px; position: relative; z-index: 1; }
  .auth-hero-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 2px; opacity: 0.75; margin-bottom: 12px; color: #fdd835; }
  .auth-hero-headline { font-size: 44px; font-weight: 800; line-height: 1.15; margin-bottom: 18px; letter-spacing: -1px; }
  .auth-hero-accent { color: #fdd835; }
  .auth-hero-desc { font-size: 15px; line-height: 1.7; opacity: 0.85; margin-bottom: 36px; max-width: 560px; }
  .auth-hero-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; max-width: 640px; }
  .auth-hero-feature { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 18px 16px; }
  .auth-hero-feature-icon { font-size: 26px; margin-bottom: 6px; }
  .auth-hero-feature-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
  .auth-hero-feature-desc { font-size: 12px; opacity: 0.72; }
  .auth-hero-badge { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: rgba(255,214,0,0.15); border: 1px solid rgba(255,214,0,0.5); border-radius: 99px; font-size: 13px; font-weight: 700; color: #fdd835; align-self: flex-start; }
  .auth-hero-footer { position: absolute; bottom: 24px; left: 56px; font-size: 11px; opacity: 0.55; letter-spacing: 0.3px; }
  .auth-panel { flex: 3; min-width: 360px; background: #fff; display: flex; align-items: center; justify-content: center; padding: 40px; }
  .auth-panel-inner { width: 100%; max-width: 320px; }
  .auth-box { width: 100%; }
  .auth-tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 2px solid var(--border); }
  .auth-tab { flex: 1; padding: 12px 8px; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--text3); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 120ms; }
  .auth-tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .auth-logo { text-align: left; margin-bottom: 6px; }
  .auth-logo-icon { font-size: 28px; }
  .auth-logo-text { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--accent); letter-spacing: -0.5px; }
  .auth-sub { text-align: left; font-size: 12px; color: var(--text2); margin-bottom: 20px; }
  @media (max-width: 1024px) {
    .auth-wrap { flex-direction: column; }
    .auth-hero { flex: none; padding: 28px; min-height: auto; }
    .auth-hero-headline { font-size: 28px; }
    .auth-hero-features { grid-template-columns: 1fr; max-width: none; }
    .auth-hero-footer { position: static; margin-top: 16px; }
    .auth-panel { min-width: 0; padding: 28px; }
  }
  .auth-tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 24px; }
  .auth-tab { flex: 1; padding: 8px; background: none; border: none; font-family: var(--sans); font-size: 14px; font-weight: 500; color: var(--text3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 120ms; }
  .auth-tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 5px; }
  .input { width: 100%; height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--sans); font-size: 14px; background: #fafafa; outline: none; transition: border-color 120ms; }
  .input:focus { border-color: var(--accent); background: #fff; }
  .input::placeholder { color: var(--text3); }
  .btn-auth { width: 100%; height: 40px; background: var(--sidebar); border: none; border-radius: var(--radius); font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--sidebar-text); cursor: pointer; transition: background 120ms; margin-top: 4px; }
  .btn-auth:hover { background: var(--sidebar-hover); }
  .btn-auth:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-msg { text-align: center; font-size: 13px; margin-top: 12px; padding: 10px; border-radius: var(--radius); }
  .auth-msg.err { background: #fdecea; color: var(--danger); }
  .auth-msg.ok  { background: #e8f5e9; color: var(--success); }

  /* ── PENDING ── */
  .pending-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
  .pending-box { text-align: center; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 48px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); max-width: 400px; }
  .pending-icon { font-size: 48px; margin-bottom: 16px; }
  .pending-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .pending-desc { font-size: 14px; color: var(--text2); line-height: 1.8; margin-bottom: 20px; }
  .btn-logout-sm { padding: 7px 16px; border: 1px solid var(--border2); border-radius: var(--radius); background: transparent; font-family: var(--sans); font-size: 13px; color: var(--text2); cursor: pointer; }
  .btn-logout-sm:hover { background: var(--bg3); }

  /* ── APP LAYOUT ── */
  .app-layout { display: flex; min-height: 100vh; }

  /* ── SIDEBAR ── */
  .sidebar { width: var(--sidebar-w); background: var(--sidebar); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
  .sidebar-logo { padding: 20px 18px 16px; border-bottom: 1px solid rgba(0,0,0,0.1); }
  .sidebar-logo-icon { font-size: 22px; }
  .sidebar-logo-text { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--sidebar-text); letter-spacing: -0.3px; margin-top: 2px; }
  .sidebar-logo-sub { font-size: 10px; color: rgba(0,0,0,0.55); margin-top: 1px; }
  .sidebar-section { padding: 12px 10px 4px; font-size: 9px; font-weight: 700; color: rgba(0,0,0,0.5); letter-spacing: 2px; text-transform: uppercase; }
  .sidebar-menu { flex: 1; padding: 6px 8px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) transparent; }
  .sidebar-menu::-webkit-scrollbar { width: 4px; }
  .sidebar-menu::-webkit-scrollbar-track { background: transparent; }
  .sidebar-menu::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
  .sidebar-menu::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.35); }
  .flyout-item { display:flex; align-items:center; gap:9px; padding:9px 16px; width:100%; border:none; cursor:pointer; font-size:13px; text-align:left; transition:background 100ms; }
  .flyout-item:hover { background: #e8f5e9 !important; }
  .sidebar-item { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 6px; cursor: pointer; transition: background 120ms; margin-bottom: 2px; font-size: 13px; font-weight: 600; color: #1a1a1a; border: none; background: none; width: 100%; text-align: left; }
  .sidebar-item:hover { background: rgba(0,0,0,0.12); }
  .sidebar-item.on { background: rgba(0,0,0,0.18); font-weight: 700; color: #1a1a1a; }
  .sidebar-item-icon { font-size: 15px; flex-shrink: 0; }
  .sidebar-sub { display: flex; align-items: center; gap: 9px; padding: 7px 10px 7px 34px; border-radius: 6px; cursor: pointer; transition: background 120ms; font-size: 12px; font-weight: 500; color: rgba(0,0,0,0.6); border: none; background: none; width: 100%; text-align: left; }
  .sidebar-sub:hover { background: rgba(0,0,0,0.08); }
  .sidebar-sub.on { background: rgba(0,0,0,0.12); font-weight: 700; color: rgba(0,0,0,0.85); }
  .sidebar-sub-icon { font-size: 12px; }
  .sidebar-chevron { margin-left: auto; font-size: 10px; transition: transform 150ms; color: rgba(0,0,0,0.35); }
  .sidebar-chevron.open { transform: rotate(180deg); }
  .sidebar-bottom { padding: 12px 8px; border-top: 1px solid rgba(0,0,0,0.12); }
  .sidebar-user { padding: 8px 10px; font-size: 11px; color: rgba(0,0,0,0.7); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sidebar-logout { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: rgba(0,0,0,0.7); background: none; border: none; width: 100%; transition: background 120ms; }
  .sidebar-logout:hover { background: rgba(0,0,0,0.12); }

  /* ── CONTENT ── */
  .content { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .content-header { background: #fff; border-bottom: 1px solid var(--border); padding: 0 28px; height: 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
  .content-title { font-size: 16px; font-weight: 700; color: var(--text); }
  .content-body { padding: 24px 28px; flex: 1; }

  /* ── ADMIN ── */
  .admin-badge { display: inline-flex; padding: 2px 8px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--accent); font-family: var(--mono); }
  .user-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .user-table th { background: var(--bg3); padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: var(--text); border-bottom: 2px solid var(--border2); }
  .user-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text); }
  .user-table tr:hover td { background: #fafafa; }
  .user-table tr:last-child td { border-bottom: none; }
  .status-badge { display: inline-flex; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  .status-ok  { background: #e8f5e9; color: var(--success); }
  .status-wait { background: #fff8e1; color: #E65100; }

  /* ── CARDS ── */
  .card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 16px; }
  .card-label { font-size: 13px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .card-label::before { content: ''; display: block; width: 3px; height: 13px; background: var(--sidebar); border-radius: 2px; }

  /* ── DROP ZONE ── */
  .drop { border: 2px dashed var(--border2); border-radius: var(--radius); padding: 44px 24px; text-align: center; cursor: pointer; background: #fafafa; position: relative; transition: all 140ms ease; }
  .drop:hover, .drop.over { border-color: var(--accent); background: #fff8e1; }
  .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .drop-icon { font-size: 28px; margin-bottom: 8px; }
  .drop-main { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .drop-main strong { color: var(--accent); }
  .drop-sub { font-size: 13px; color: var(--text2); font-family: var(--mono); }
  .drop-filename { display: inline-flex; align-items: center; gap: 8px; background: #fff3e0; border: 1px solid #ffcc80; color: var(--accent); font-family: var(--mono); font-size: 13px; padding: 5px 14px; border-radius: var(--radius); margin-top: 10px; }

  /* ── STATS ── */
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
  @media (max-width: 900px) { .stats { grid-template-columns: repeat(3, 1fr); } }
  .stat { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
  .stat-l { font-size: 10px; font-weight: 700; color: var(--text2); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
  .stat-v { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat-u { font-size: 11px; color: var(--text2); margin-top: 4px; }

  /* ── TABS ── */
  .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
  .tab { padding: 9px 20px; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--text2); cursor: pointer; transition: all 120ms; }
  .tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover:not(.on) { color: var(--text); }

  /* ── FILTER ── */
  .fbar { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  .fsel, .finput { height: 34px; padding: 0 10px; border-radius: var(--radius); border: 1px solid var(--border); background: #fff; color: var(--text); font-family: var(--sans); font-size: 13px; outline: none; transition: border-color 120ms; }
  .fsel:focus, .finput:focus { border-color: var(--accent); }
  .finput { min-width: 200px; }
  .finput::placeholder { color: var(--text3); }
  .fbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .fresult { font-size: 13px; color: var(--text2); font-family: var(--mono); font-weight: 600; }
  .fresult b { color: var(--accent); }

  /* ── BUTTONS ── */
  .btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--sans); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 120ms ease; white-space: nowrap; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-p { background: var(--sidebar); color: var(--sidebar-text); border-color: var(--sidebar); }
  .btn-p:hover:not(:disabled) { background: var(--sidebar-hover); }
  .btn-s { background: transparent; color: var(--text); border-color: var(--border2); font-weight: 600; }
  .btn-s:hover:not(:disabled) { background: var(--bg3); }
  .btn-success { background: #e8f5e9; color: var(--success); border-color: #a5d6a7; font-weight: 700; }
  .btn-success:hover:not(:disabled) { background: #c8e6c9; }
  .btn-ghost { background: transparent; color: var(--text2); border: none; font-size: 12px; padding: 4px 8px; cursor: pointer; font-weight: 600; }
  .btn-ghost:hover { color: var(--text); }
  .btn-danger { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: var(--radius); border: 1px solid #ffcdd2; background: #ffebee; color: var(--danger); font-family: var(--sans); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 120ms; }
  .btn-danger:hover { background: #ffcdd2; }

  /* ── TABLE ── */
  .twrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: var(--bg3); border-bottom: 2px solid var(--border2); }
  th { font-size: 11px; font-weight: 700; color: var(--text); letter-spacing: 0.5px; padding: 10px 12px; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; text-transform: uppercase; }
  th:hover { color: var(--accent); }
  th.s-a::after { content: ' ↑'; color: var(--accent); }
  th.s-d::after { content: ' ↓'; color: var(--accent); }
  th.r { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text); font-size: 13px; }
  td.r { text-align: right; font-family: var(--mono); font-size: 13px; font-weight: 600; }
  td.mono { font-family: var(--mono); font-size: 12px; color: var(--text2); }
  tr:hover td { background: #fffde7; }
  tr:last-child td { border-bottom: none; }
  /* 중첩(펼침) 상세 표 — 메인 표(흰색·노란 hover)와 구분되게 파란빛 회색 톤 */
  .nested-table thead th { background: #e7edf5; color: #4a5568; }
  .nested-table tr:hover td { background: #dbe6f5; }
  .badge { display: inline-flex; padding: 2px 9px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  /* 매장/점포 배지 — 알록달록함 줄이고 회색 톤으로 통일 (점포=옅은 채움, 지점=외곽선) */
  .badge-dept  { background: #eef0f2; color: #2b2b2b; border: 1px solid #d6dadf; }
  .badge-store { background: #ffffff; color: #555555; border: 1px solid #d6dadf; }
  .safety-num { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--accent); }
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

  /* ── HISTORY ── */
  .history-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .history-table th { background: var(--bg3); padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text2); border-bottom: 1px solid var(--border); white-space: nowrap; }
  .history-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .history-table tr:last-child td { border-bottom: none; }
  .history-table tr:hover td { background: #fffde7; }
  .active-row td { background: #fff8e1 !important; }
  .active-badge { display: inline-flex; align-items: center; padding: 2px 8px; background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 99px; font-size: 10px; font-weight: 600; color: var(--success); gap: 4px; }
  .btn-danger { background: transparent; color: var(--danger); border: 1px solid #ef9a9a; border-radius: var(--radius); padding: 5px 10px; font-size: 11px; cursor: pointer; transition: all 120ms; font-family: var(--sans); }
  .btn-danger:hover { background: #fdecea; }
  .btn-dl { background: transparent; color: var(--accent2); border: 1px solid #90caf9; border-radius: var(--radius); padding: 5px 10px; font-size: 11px; cursor: pointer; transition: all 120ms; font-family: var(--sans); }
  .btn-dl:hover { background: #e3f2fd; }
  .btn-load { background: var(--sidebar); color: #1a1a1a; border: none; border-radius: var(--radius); padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 120ms; font-family: var(--sans); }
  .btn-load:hover { background: var(--sidebar-hover); }

  /* ── TOAST ── */
  .toasts { position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 6px; }
  .toast { display: flex; align-items: center; gap: 9px; padding: 11px 16px; border-radius: var(--radius); border: 1px solid; font-family: var(--mono); font-size: 11px; min-width: 220px; box-shadow: 0 2px 12px rgba(0,0,0,0.12); animation: tIn 180ms ease; }
  .t-ok  { background: #e8f5e9; border-color: #a5d6a7; color: var(--success); }
  .t-err { background: #fdecea; border-color: #ef9a9a; color: var(--danger); }
  .t-inf { background: #e3f2fd; border-color: #90caf9; color: var(--accent2); }
  @keyframes tIn { from { opacity:0; transform: translateX(10px); } to { opacity:1; transform: none; } }

  /* ═══════════════════════════════════════════════════════════
     THEME: 모던 뉴트럴 v2 (리뉴얼 미리보기 · 커밋 전)
     되돌리려면 이 블록(이 주석부터 끝 주석까지)만 삭제하세요.
     ─ 거의 무채색 · 포인트색은 포커스/선택에만 · 구분선 최소화 · 메뉴 아이콘 제거 · 표 정리
     ═══════════════════════════════════════════════════════════ */
  :root {
    --bg:      #f6f7f9;
    --bg2:     #ffffff;
    --bg3:     #f3f4f6;
    --border:  #ebedf1;
    --border2: #e2e4e9;
    --sidebar: #ffffff;
    --sidebar-hover: #f1f2f5;
    --sidebar-active: #eef0fe;
    --sidebar-text: #1f242c;
    --accent:  #4f46e5;
    --accent2: #4f46e5;
    --danger:  #dc2626;
    --success: #16a34a;
    --text:    #1a1d22;
    --text2:   #4a5160;
    --text3:   #8a909c;
    --radius:  9px;
  }
  /* 사이드바 — 밝은 배경 + 진한 글씨(다크 폐지), 하드 경계선 대신 소프트 섀도로 분리 */
  /* 사이드바 — 콜드 네이비(다크). 글씨/포인트는 아래에서 밝게 반전 */
  .sidebar { background: linear-gradient(185deg, #14243f 0%, #0c1526 100%); border-right: none; box-shadow: 1px 0 30px rgba(0,0,0,0.26);
    --sidebar-text: #f4f6fb; --text: #f4f6fb; --text2: rgba(240,243,250,0.92); --text3: rgba(240,243,250,0.6); --accent: #aab2ff; }
  .sidebar-logo { border-bottom: none; padding-bottom: 6px; }
  .sidebar-logo-text { color: var(--text); }
  .sidebar-logo-sub { color: var(--text3); }
  .sidebar-section { color: var(--text3); font-weight: 700; font-size: 11px; letter-spacing: 0.6px; text-transform: none; padding: 20px 10px 7px 12px; }
  .sidebar-grouptoggle { border-radius: 7px; transition: background 120ms; }
  .sidebar-grouptoggle:hover { background: var(--bg3); color: var(--text2); }
  .sidebar-menu { scrollbar-color: rgba(0,0,0,0.18) transparent; }
  .sidebar-menu::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.16); }
  .sidebar-item-icon, .sidebar-sub-icon { display: none; }
  .sidebar-item { color: var(--text2); font-weight: 500; padding-left: 22px; }
  .sidebar-item:hover { background: var(--bg3); color: var(--text); }
  .sidebar-item.on { background: linear-gradient(90deg, #eceefe 0%, #f4f5fe 100%); color: var(--accent); font-weight: 700; box-shadow: inset 3px 0 0 var(--accent); }
  .sidebar-sub { color: var(--text2); padding-left: 34px; }
  .sidebar-sub:hover { background: var(--bg3); color: var(--text); }
  .sidebar-sub.on { background: #eef0fe; color: var(--accent); }
  .sidebar-chevron { color: var(--text3); }
  .sidebar-bottom { border-top: 1px solid var(--border); }
  .sidebar-user { color: var(--text3); }
  .sidebar-logout { color: var(--text2); }
  .sidebar-logout:hover { background: var(--bg3); color: var(--text); }
  .flyout-item:hover { background: var(--bg3) !important; }
  /* 상단바 — 딱딱한 구분선 제거, 아주 옅은 소프트 섀도로만 분리 */
  .content-header { border-bottom: none; box-shadow: none; }
  /* 주요 버튼 — 단일 포인트색(인디고) + 은은한 그라데이션·그림자 */
  .btn-p { background: linear-gradient(180deg, #5a51e8 0%, #4f46e5 100%); border-color: #4f46e5; color: #fff; box-shadow: 0 1px 2px rgba(79,70,229,0.35), 0 2px 8px rgba(79,70,229,0.2); }
  .btn-p:hover:not(:disabled) { background: linear-gradient(180deg, #4f46e5 0%, #4338ca 100%); }
  .btn-auth { background: var(--accent); color: #fff; }
  .btn-auth:hover { background: #4338ca; }
  .btn-load { background: var(--accent); color: #fff; }
  .btn-load:hover { background: #4338ca; }
  .card-label { text-transform: none; letter-spacing: .2px; font-weight: 700; }
  .card-label::before { background: #d4d7dd; }
  /* 텍스트 탈색 — 숫자·라벨은 무채색, 포인트색은 선택/포커스에만 */
  .stat-l { text-transform: none; letter-spacing: 0; color: var(--text3); font-weight: 600; font-size: 11.5px; }
  .stat-v { color: var(--text); font-weight: 700; }
  .fresult { color: var(--text2); }
  .fresult b { color: var(--text); }
  .auth-logo-text { color: var(--text); }
  .drop-main strong { color: var(--text); }
  .drop-filename { background: #f1f2f4; border-color: #e2e4e9; color: var(--text2); }
  .safety-num { color: var(--text); }
  .wk-total { color: var(--text); }
  .admin-badge { background: #eef0f2; border: 1px solid #e2e4e9; color: var(--text2); }
  .wtab.on { background: #eceef1; border-color: #e2e4e9; color: var(--text); }
  .tab.on, .auth-tab.on { color: var(--text); border-bottom-color: var(--accent); }
  .tab:hover:not(.on) { color: var(--text); }
  .btn-dl { color: var(--text2); border-color: var(--border2); }
  .btn-dl:hover { background: var(--bg3); }
  .status-wait { background: #f4f5f7; color: #6b7280; }
  /* 표 — 대문자/굵은 선 제거, 여백 확대, 무채색 헤더 */
  thead tr { background: #f8f9fb; border-bottom: 1px solid rgba(16,18,23,0.1); }
  th { text-transform: none; letter-spacing: 0.1px; font-weight: 700; color: var(--text2); font-size: 11.5px; padding: 12px 16px; }
  th:hover { color: var(--text); }
  td { padding: 13px 16px; border-bottom: 1px solid #e8eaee; }
  /* 촘촘 모드 — 열이 많은 표(상품별정산 전월비교 등)에서 여백·폰트 축소로 가로폭 절약 */
  .twrap.dense th { padding: 9px 7px; font-size: 11px; }
  .twrap.dense td { padding: 9px 7px; font-size: 12px; }
  /* 배지(점포/지점) — 또렷한 pill: 점포=연회색 채움 / 지점=외곽선 */
  .badge { border-radius: 999px; padding: 3px 11px; font-weight: 600; font-size: 11.5px; }
  .badge-dept  { background: #eceef3; color: var(--text); border: none; font-weight: 700; }
  .badge-store { background: #fff; color: var(--text2); border: 1px solid rgba(16,18,23,0.12); font-weight: 600; }
  tr:hover td { background: #f8f9fb; }
  .user-table th { background: transparent; text-transform: none; color: var(--text); font-weight: 700; border-bottom: 1px solid var(--border2); }
  .user-table tr:hover td { background: #f8f9fb; }
  .history-table th { background: transparent; color: var(--text); font-weight: 700; }
  .history-table tr:hover td { background: #f8f9fb; }
  .active-row td { background: #f3f4f6 !important; }
  .wk-cell.latest-col { background: #f3f4f6; }
  .drop:hover, .drop.over { border-color: var(--accent); background: #f6f7f9; }
  /* 배경 — 흰 카드와 대비가 보이도록 조금 더 또렷한 그레이 */
  html, body, #root { background: #e9ebf1; }
  body { background: linear-gradient(176deg, #edeff4 0%, #e3e6ee 100%); background-attachment: fixed; }
  /* flex 자식이 넓은 표 때문에 페이지를 넓히지 않도록 — 표는 .twrap 안에서만 가로 스크롤 */
  .content { min-width: 0; }
  .twrap { max-width: 100%; }
  /* 카드/표 — 하드 테두리 대신 부드러운 다층 그림자로 '떠 있는' 느낌 */
  .card, .stat { border: 1px solid rgba(16,18,23,0.085); border-radius: 14px; box-shadow: 0 1px 3px rgba(16,18,23,0.035), 0 12px 30px rgba(16,18,23,0.05); }
  /* 로그인 히어로 — 차분한 무채색 잉크 톤 */
  /* 로그인 히어로 — 딥 네이비·인디고 프리미엄 톤 (사이드바와 브랜드 통일) */
  .auth-hero { background: linear-gradient(150deg, #0d1424 0%, #14233c 48%, #1c2b54 100%); }
  .auth-hero::before { background: radial-gradient(circle, rgba(129,140,248,0.22) 0%, transparent 62%); }
  .auth-hero::after { content: ''; position: absolute; left: -150px; top: -130px; width: 440px; height: 440px; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%); pointer-events: none; z-index: 0; }
  .auth-hero-brand { display: inline-flex; align-items: center; gap: 11px; align-self: flex-start; position: relative; z-index: 1; }
  .auth-hero-brand-mark { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg,#6366f1 0%,#4f46e5 100%); color: #fff; display: grid; place-items: center; font-size: 19px; font-weight: 800; letter-spacing: -0.5px; box-shadow: 0 6px 20px rgba(79,70,229,0.45); }
  .auth-hero-brand-text { font-size: 21px; font-weight: 800; letter-spacing: -0.4px; color: #fff; }
  .auth-hero-brand-text span { color: #aab2ff; }
  .auth-hero-eyebrow { color: #aab2ff; opacity: 0.95; letter-spacing: 2.5px; }
  .auth-hero-headline { letter-spacing: -1.2px; }
  .auth-hero-accent { background: linear-gradient(90deg,#c6cbff 0%,#8f97f5 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
  .auth-hero-desc { color: #c3c9da; opacity: 1; max-width: 720px; }
  .auth-hero-desc b { color: #eceefe; }
  .auth-hero-kw { color: #ffd24d; font-weight: 700; }
  .auth-hero-feature { background: linear-gradient(160deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.025) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 10px 30px rgba(0,0,0,0.22); transition: transform 140ms ease, border-color 140ms ease; }
  .auth-hero-feature:hover { transform: translateY(-3px); border-color: rgba(129,140,248,0.45); }
  .auth-hero-feature-icon { font-size: 23px; width: 40px; height: 40px; border-radius: 10px; background: rgba(129,140,248,0.14); display: grid; place-items: center; margin-bottom: 12px; }
  .auth-hero-feature-title { color: #fff; font-weight: 700; }
  .auth-hero-feature-desc { color: rgba(240,243,250,0.6); }
  .auth-hero-badge { background: rgba(129,140,248,0.14); border: 1px solid rgba(129,140,248,0.42); color: #c6cbff; }
  .auth-hero-footer { color: rgba(240,243,250,0.4); }
  /* 토스트 알림 — 색 가득 채운 옛 스타일 → 다크 카드 + 작은 상태 아이콘 */
  .toasts { bottom: 22px; right: 22px; gap: 9px; }
  .toast { background: #fff; color: var(--text); border: 1px solid var(--border2);
    border-radius: 12px; font-family: var(--sans); font-size: 13px; font-weight: 600;
    padding: 12px 15px; min-width: 0; max-width: 340px; gap: 11px; align-items: center;
    box-shadow: 0 8px 26px rgba(16,18,23,0.14); }
  .toast span:first-child { width: 20px; height: 20px; border-radius: 50%; display: grid;
    place-items: center; font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0; }
  .t-ok, .t-err, .t-inf { background: #fff; border-color: var(--border2); color: var(--text); }
  .t-ok  span:first-child { background: #16a34a; }
  .t-err span:first-child { background: #dc2626; }
  .t-inf span:first-child { background: #6b7280; }
  /* 사이드바 다크 — 메뉴/호버/활성/서브/스크롤바 밝게 반전 */
  .sidebar-item { color: #ffffff; font-weight: 600; }
  .sidebar-item:hover, .sidebar-grouptoggle:hover { background: rgba(255,255,255,0.055); color: #fff; }
  .sidebar-item.on { background: linear-gradient(90deg, rgba(150,158,255,0.15) 0%, rgba(150,158,255,0.012) 100%); color: #c6cbff; box-shadow: inset 3px 0 0 #7c84f0; }
  .sidebar-sub { color: rgba(240,243,250,0.82); }
  .sidebar-sub:hover { background: rgba(255,255,255,0.055); color: #fff; }
  .sidebar-sub.on { background: rgba(150,158,255,0.12); color: #c6cbff; }
  .sidebar-menu { scrollbar-color: rgba(255,255,255,0.22) transparent; }
  .sidebar-menu::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
  /* ═══════════ THEME 끝 ═══════════ */

  /* ── 모바일 대응(드로어) — 768px 이하에서만 사이드바를 오프캔버스로 ── */
  .nav-toggle { display: none; background: none; border: none; font-size: 22px; line-height: 1; color: var(--text); cursor: pointer; padding: 4px 8px; margin-left: -6px; flex-shrink: 0; }
  .nav-overlay { display: none; }
  .header-wide { display: flex; align-items: center; gap: 10px; }
  .drawer-actions { display: none; }
  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); transition: transform 220ms ease; box-shadow: 2px 0 24px rgba(0,0,0,0.28); }
    .sidebar.open { transform: translateX(0); }
    .content { margin-left: 0; }
    .content-header { padding: 0 12px; gap: 8px; }
    .content-title { font-size: 15px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .content-body { padding: 16px 14px; }
    .nav-toggle { display: block; }
    .nav-overlay { display: block; position: fixed; inset: 0; z-index: 99; background: rgba(0,0,0,0.42); }
    .header-wide { display: none; }
    .drawer-actions { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 4px; }
    /* 홈 '통합 총 매출' 배너 — 모바일에서 3칸 가로→세로 스택(라벨 왼쪽·값 오른쪽) */
    .ts-banner { padding: 14px 16px !important; }
    .ts-row { flex-direction: column; gap: 0; }
    .ts-div { display: none; }
    .ts-col { padding: 9px 0 !important; text-align: left !important; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border); }
    .ts-col:last-child { border-bottom: none; }
    .ts-label { margin-bottom: 0 !important; flex-shrink: 0; }
    .ts-num { font-size: 17px !important; text-align: right; }
    /* 홈 매출 요약 3카드 — 모바일에서 세로 스택(폭 확보로 금액 줄바꿈 방지) */
    .summary-row { flex-direction: column; }
    /* 매출확인 탭바 — 모바일에서 아이콘 위·라벨 아래, 음절 중간 깨짐 방지(keep-all) */
    .settle-tabs { gap: 6px !important; }
    .settle-tab { flex: 1; min-width: 0; height: auto !important; padding: 8px 4px !important; flex-direction: column !important; gap: 3px !important; font-size: 12px !important; line-height: 1.25; }
    .settle-tab .tab-ico { font-size: 17px; }
    .settle-tab .tab-lbl { word-break: keep-all; text-align: center; }
    /* 매출조회 요약 3카드 — 모바일에서 폰트 축소·트랙 minmax(0)로 화면 안에 작게 배치 */
    .salehub-cards { grid-template-columns: minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) !important; gap: 7px !important; }
    .salehub-card { padding: 11px 9px !important; }
    .salehub-amt { font-size: 12.5px !important; }
    .salehub-amt-lg { font-size: 17px !important; }
  }
`;

// ════════════════════════════════════════════════════════
// STYLE INJECT
// ════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════
// AUTH SCREEN
// ════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'signup-success'

  return (
    <div className="auth-wrap">
      {/* LEFT: 서비스 소개 hero */}
      <div className="auth-hero">
        <div className="auth-hero-brand">
          <span className="auth-hero-brand-mark">P</span>
          <span className="auth-hero-brand-text">PALEO <span>POS</span></span>
        </div>
        <div className="auth-hero-content">
          <div className="auth-hero-eyebrow">PALEO POS · 오프라인 매장 통합 관리</div>
          <h1 className="auth-hero-headline">
            판매 입력부터 매출 정산까지<br/>
            <span className="auth-hero-accent">매장 운영을 한 곳에서.</span>
          </h1>
          <p className="auth-hero-desc">
            오프라인 매장의 <span className="auth-hero-kw">판매 입력·고객 관리·재고 관리·매출 결산</span>을 하나로 묶은 <b>포스(POS) 프로그램</b>.<br/>
            매장 운영에 필요한 모든 기능을 한 화면에서 간편하게.
          </p>
          <div className="auth-hero-features">
            <div className="auth-hero-feature">
              <div className="auth-hero-feature-icon">🛒</div>
              <div className="auth-hero-feature-title">판매 입력</div>
              <div className="auth-hero-feature-desc">빠르고 간편한 판매 등록</div>
            </div>
            <div className="auth-hero-feature">
              <div className="auth-hero-feature-icon">👥</div>
              <div className="auth-hero-feature-title">고객 관리</div>
              <div className="auth-hero-feature-desc">회원·적립·문자 관리</div>
            </div>
            <div className="auth-hero-feature">
              <div className="auth-hero-feature-icon">📊</div>
              <div className="auth-hero-feature-title">재고·매출결산</div>
              <div className="auth-hero-feature-desc">재고 현황·정산 자동화</div>
            </div>
          </div>
        </div>
        <div className="auth-hero-footer">
          © (주)한국스마트물류 · KOREA SMART LOGISTICS
        </div>
      </div>

      {/* RIGHT: 로그인 / 회원가입 패널 */}
      <div className="auth-panel">
        <div className="auth-panel-inner">
          {mode === 'login' && <LoginForm onGoSignup={() => setMode('signup')}/>}
          {mode === 'signup' && (
            <SignupForm
              onBack={() => setMode('login')}
              onSuccess={() => setMode('signup-success')}/>
          )}
          {mode === 'signup-success' && (
            <SignupSuccess onBack={() => setMode('login')}/>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onGoSignup }) {
  const [userId, setUserId] = useState('');
  const [pw, setPw]         = useState('');
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const email = `${userId.trim().toLowerCase()}@kbh.kr`;
    const isNetworkError = (err) => {
      const m = String(err?.message || '').toLowerCase();
      return m.includes('failed to fetch')
          || m.includes('network')
          || m.includes('timeout')
          || m.includes('load failed');
    };
    try {
      // 1차 시도
      let { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      // 네트워크 일시 오류면 1.5초 후 자동 재시도 (콜드 스타트·일시 끊김 대응)
      if (error && isNetworkError(error)) {
        await new Promise(r => setTimeout(r, 1500));
        ({ error } = await supabase.auth.signInWithPassword({ email, password: pw }));
      }
      if (error) throw error;
    } catch (err) {
      let userMsg = String(err.message || err)
        .replace('Invalid login credentials', '아이디 또는 비밀번호가 틀렸습니다');
      if (isNetworkError(err)) {
        userMsg = '네트워크가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요';
      }
      if (String(err.message || err).toLowerCase().includes('rate limit')) {
        userMsg = '로그인 시도가 너무 많습니다. 10분 정도 기다린 뒤 정확한 비밀번호로 한 번만 다시 시도해주세요. (계속 누르면 제한이 길어집니다)';
      }
      setMsg(userMsg);
    }
    setLoading(false);
  };

  return (
    <div className="auth-box">
      <div style={{fontSize:20, fontWeight:800, color:'var(--text)', marginBottom:4, letterSpacing:-0.3}}>로그인</div>
      <div className="auth-sub">계정으로 로그인하세요.</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>아이디</label>
          <input className="input" type="text" value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="예) KBH0001" required autoCapitalize="none" />
        </div>
        <div className="form-group">
          <label>비밀번호</label>
          <div style={{position:'relative'}}>
            <input className="input" type={showPw ? 'text' : 'password'} value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
              onKeyUp={e => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
              onBlur={() => setCapsOn(false)}
              placeholder="비밀번호" required style={{paddingRight:42}}/>
            <button type="button" onClick={() => setShowPw(v => !v)}
              title={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              style={{position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4, lineHeight:1, color:'var(--text3)'}}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
          {capsOn && (
            <div style={{marginTop:6, padding:'6px 10px', background:'#fff3e0', border:'1px solid #ffb74d',
              borderRadius:'var(--radius)', fontSize:12, color:'#e65100', fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
              ⚠️ Caps Lock이 켜져 있습니다
            </div>
          )}
        </div>
        <div style={{display:'flex', gap:8, marginTop:8, alignItems:'stretch'}}>
          <button className="btn-auth" type="submit" disabled={loading} style={{flex:1, marginTop:0}}>
            {loading ? '처리 중...' : '로그인'}
          </button>
          <button type="button" onClick={onGoSignup}
            style={{flex:1, height:40, boxSizing:'border-box', background:'#fff', color:'var(--text)', border:'1px solid var(--border)',
              borderRadius:'var(--radius)', fontSize:14, fontWeight:600, cursor:'pointer', transition:'all 120ms'}}
            onMouseEnter={e => { e.currentTarget.style.background='#fafafa'; e.currentTarget.style.borderColor='var(--text3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='var(--border)'; }}>
            회원가입
          </button>
        </div>
      </form>
      {msg && <div className="auth-msg err">{msg}</div>}
    </div>
  );
}

function SignupForm({ onBack, onSuccess }) {
  const [form, setForm] = useState({
    company: '', businessNo: '', userId: '', pw: '', contactName: '', phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    // 간단한 클라이언트 검증
    if (!form.company.trim() || !form.businessNo.trim() || !form.userId.trim()
        || !form.pw.trim() || !form.contactName.trim() || !form.phone.trim()) {
      setErr('모든 항목을 입력해주세요.'); return;
    }
    if (form.pw.length < 6) { setErr('비밀번호는 6자 이상이어야 합니다.'); return; }
    setSubmitting(true);
    try {
      // TODO(persistence): 실제 배포 시 signup_requests 테이블에 insert
      // await supabase.from('signup_requests').insert({ ... });
      await new Promise(r => setTimeout(r, 400)); // 미리보기: UX용 짧은 지연
      onSuccess();
    } catch (e2) { setErr('제출 실패: ' + e2.message); }
    setSubmitting(false);
  };

  return (
    <div className="auth-box">
      <div style={{fontSize:20, fontWeight:800, color:'var(--text)', marginBottom:4, letterSpacing:-0.3}}>회원가입 요청</div>
      <div className="auth-sub">담당자가 확인 후 회신드립니다.</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>상호</label>
          <input className="input" value={form.company} onChange={set('company')} placeholder="예) (주)홍길동상사"/>
        </div>
        <div className="form-group">
          <label>사업자등록번호</label>
          <input className="input" value={form.businessNo} onChange={set('businessNo')} placeholder="000-00-00000"/>
        </div>
        <div className="form-group">
          <label>아이디</label>
          <input className="input" value={form.userId} onChange={set('userId')} placeholder="영문/숫자" autoCapitalize="none"/>
        </div>
        <div className="form-group">
          <label>비밀번호</label>
          <input className="input" type="password" value={form.pw} onChange={set('pw')} placeholder="6자 이상"/>
        </div>
        <div className="form-group">
          <label>담당자명</label>
          <input className="input" value={form.contactName} onChange={set('contactName')} placeholder="홍길동"/>
        </div>
        <div className="form-group">
          <label>연락처</label>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="010-1234-5678"/>
        </div>
        {err && <div className="auth-msg err">{err}</div>}
        <div style={{display:'flex', gap:8, marginTop:8, alignItems:'stretch'}}>
          <button type="button" onClick={onBack}
            style={{flex:1, height:40, boxSizing:'border-box', background:'#fff', color:'var(--text2)', border:'1px solid var(--border)',
              borderRadius:'var(--radius)', fontSize:14, fontWeight:600, cursor:'pointer'}}>
            취소
          </button>
          <button className="btn-auth" type="submit" disabled={submitting} style={{flex:1.4, marginTop:0}}>
            {submitting ? '제출 중...' : '제출'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SignupSuccess({ onBack }) {
  return (
    <div className="auth-box" style={{textAlign:'center'}}>
      <div style={{fontSize:48, marginBottom:14}}>✉️</div>
      <div style={{fontSize:18, fontWeight:800, color:'var(--text)', marginBottom:8}}>가입 요청이 접수되었습니다</div>
      <div style={{fontSize:13, color:'var(--text2)', lineHeight:1.8, marginBottom:24}}>
        담당자가 영업일 기준 1~2일 내 검토 후<br/>
        등록하신 연락처로 회신드립니다.<br/>
        감사합니다.
      </div>
      <button type="button" onClick={onBack}
        style={{width:'100%', height:40, background:'var(--sidebar)', color:'var(--sidebar-text)',
          border:'none', borderRadius:'var(--radius)', fontSize:14, fontWeight:600, cursor:'pointer'}}>
        로그인 화면으로
      </button>
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


export default function App() {
  useStyle(GLOBAL_CSS);

  // QR 가입 페이지 감지 (?m=매니저ID)
  const joinManagerId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('m');
  }, []);
  // 공개 수신 재동의 페이지 감지 (?rc=1)
  const consentRenew = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('rc');
  }, []);
  // 공개 출석체크 적립 페이지 감지 (?att=매장ID)
  const attendStore = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('att');
  }, []);
  const publicPage = joinManagerId || consentRenew || attendStore;

  // 모든 hooks는 조건부 return 전에 선언해야 함 (Rules of Hooks)
  const [session, setSession]   = useState(null);
  const [realProfile, setRealProfile] = useState(null);
  const [impersonated, setImpersonated] = useState(() => { try { const v = localStorage.getItem('gmd_impersonate'); return v ? JSON.parse(v) : null; } catch { return null; } });
  const [authLoading, setAL]    = useState(true);
  const [page, setPage]         = useState('home');
  const [navOpen, setNavOpen]   = useState(false); // 모바일 사이드바(드로어) 열림 상태
  const [parsed, setParsed]     = useState(null);
  const [filename, setFilename] = useState('');
  const [activeUploadId, setActiveId] = useState(
    () => { const v = localStorage.getItem('gmd_active_id'); return v ? Number(v) : null; }
  );
  const [hasUpdate, setHasUpdate] = useState(false);

  const setActiveUploadId = (id) => {
    setActiveId(id);
    if (id) localStorage.setItem('gmd_active_id', id);
    else localStorage.removeItem('gmd_active_id');
  };

  // 본사 담당자/관리자의 '매장 전환(보기)' — 세션은 유지하고 프로필 컨텍스트만 선택 매장으로 전환
  const canImpersonate = realProfile?.role === 'admin' || realProfile?.job_title === '담당자';
  const profile = useMemo(() => (canImpersonate && impersonated) ? impersonated : realProfile, [canImpersonate, impersonated, realProfile]);
  const startImpersonate = (sp) => { setImpersonated(sp); localStorage.setItem('gmd_impersonate', JSON.stringify(sp)); setPage('home'); };
  const stopImpersonate = () => { setImpersonated(null); localStorage.removeItem('gmd_impersonate'); setPage('home'); };
  // 불완전/미승인 전환 프로필은 자동 해제 (승인대기 화면에 갇히지 않도록)
  useEffect(() => { if (impersonated && !impersonated.approved) { setImpersonated(null); localStorage.removeItem('gmd_impersonate'); } }, [impersonated]);

  useEffect(() => {
    if (publicPage) return; // 공개 페이지(QR 가입·수신 재동의)면 인증 불필요
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setAL(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) { setRealProfile(null); setAL(false); }
    });
    return () => subscription.unsubscribe();
  }, [publicPage]);

  useEffect(() => {
    if (!session || publicPage) return;
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setRealProfile(data); setAL(false); });
  }, [session, publicPage]);

  // SCM 담당자는 본사 택배요청 + 재고관리 메뉴만 접근 가능 — 그 외 페이지로 가지 못하도록 자동 리다이렉트
  const SCM_ALLOWED_PAGES = useMemo(() => new Set([
    'hq_delivery_request',
    'biz_delivery_request',
    'scm_shipping',
    'help',
  ]), []);
  useEffect(() => {
    if (profile?.role === 'scm' && !SCM_ALLOWED_PAGES.has(page)) {
      setPage('hq_delivery_request');
    }
  }, [profile?.role, page, SCM_ALLOWED_PAGES]);

  // 창원지점 계정 — 재고 수불장 4개 메뉴만 접근 가능
  const CHANGWON_ALLOWED_PAGES = useMemo(() => new Set([
    'cw_home', 'cw_products', 'cw_inbound', 'cw_outbound', 'cw_stock', 'help',
  ]), []);
  useEffect(() => {
    if (profile?.role === 'changwon' && !CHANGWON_ALLOWED_PAGES.has(page)) {
      setPage('cw_home');
    }
  }, [profile?.role, page, CHANGWON_ALLOWED_PAGES]);

  // 새 배포 자동 감지 — 5분마다 /build.json 확인. 다르면 상단 배너 안내(자동 reload 안 함, 사용자 안전 보호)
  useEffect(() => {
    let currentBuild = null;
    const check = async () => {
      try {
        const res = await fetch('/build.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (currentBuild == null) {
          currentBuild = data.build;
        } else if (data.build && data.build !== currentBuild) {
          setHasUpdate(true);
        }
      } catch { /* 네트워크 오류는 무시 */ }
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // 글로벌 바코드 스캐너 가드
  // - 판매입력/반품/입고확인 외 페이지에서 스캔 감지 시: 입력 차단 + 안내 토스트
  // - 위 페이지들은 자체 리스너가 처리하므로 여기서는 패스
  useEffect(() => {
    if (!profile?.approved) return;
    const SCANNER_PAGES = ['sales_input', 'sales_return', 'purchase_check'];
    if (SCANNER_PAGES.includes(page)) return;
    const buf = { chars: '', lastTime: 0, startTime: 0 };
    const handler = (e) => {
      const now = Date.now();
      if (e.key === 'Enter') {
        const code = buf.chars.trim();
        const elapsed = now - buf.startTime;
        buf.chars = ''; buf.lastTime = 0; buf.startTime = 0;
        if (code.length >= 3 && elapsed < 800) {
          e.preventDefault();
          // 현재 포커스된 input/textarea에서 스캔된 꼬리 코드 제거
          const el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            const v = el.value || '';
            if (v.endsWith(code)) {
              const nativeSetter = Object.getOwnPropertyDescriptor(
                el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
                'value'
              )?.set;
              const newVal = v.slice(0, -code.length);
              if (nativeSetter) {
                nativeSetter.call(el, newVal);
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                el.value = newVal;
              }
            }
          }
          toast('📷 스캔 감지 — 판매입력 / 반품 / 입고확인 화면에서 스캔해주세요', 'inf');
        }
      } else if (e.key.length === 1) {
        if (now - buf.lastTime > 100) {
          buf.chars = '';
          buf.startTime = now;
        }
        buf.chars += e.key;
        buf.lastTime = now;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [profile?.approved, page]);

  // QR 가입 페이지면 여기서 렌더
  if (joinManagerId) return <><Toasts/><JoinPage managerId={joinManagerId}/></>;
  // 공개 수신 재동의 페이지 (?rc=1)
  if (consentRenew) return <><Toasts/><ConsentRenewPage/></>;
  // 공개 출석체크 적립 페이지 (?att=매장ID)
  if (attendStore) return <><Toasts/><AttendancePage storeId={attendStore}/></>;

  const handleLogout = async () => {
    setImpersonated(null); localStorage.removeItem('gmd_impersonate');
    await supabase.auth.signOut();
    toast('로그아웃 됐습니다', 'inf');
  };

  const isAdmin    = profile?.role === 'admin';
  const isHQ       = profile?.job_title === '담당자';
  const isManager  = profile?.job_title === '매니저';
  const isScm      = profile?.role === 'scm';
  const isChangwon = profile?.role === 'changwon';
  const canSeeMain = isAdmin || isHQ;

  const PAGE_TITLES = {
    help:           '사용 안내',
    home:           `${new Date().getFullYear()}년 ${String(new Date().getMonth()+1).padStart(2,'0')}월 대시보드`,
    product_mgmt:   '상품관리',
    product_add:    '상품추가',
    stock_mgmt:     '재고관리',
    stock_center:   '센터재고',
    stock_store:    '매장재고',
    stock_transfers: '재고이동 내역',
    manager_mgmt:   '매니저 현황',
    incentive:      '급여관리',
    member_mgmt:    '회원 조회',
    qr_print_all:   '매장 QR 인쇄',
    consent_qr_print: '재동의 QR 인쇄',
    attend_qr_print:  '출석체크 QR 인쇄',
    attend_event_stats: '출석 이벤트 현황',
    sms_history:    '문자 내역',
    sms_unsubscribe_sync: '수신거부 동기화',
    hq_delivery_request: '고객 택배요청',
    biz_delivery_request: '특판 발주요청',
    store_info:     '매장주소정보',
    sales_view:          '매출조회',
    sales_settlement:    '매출확인',
    settlement_report:   '결산 리포트',
    sales_list:          '매장 매출',
    biz_sales_view:      '특판 매출',
    lecture_sales_view:  '강좌 매출',
    sales_input:    '판매 입력',
    expense_input:  '지출 입력',
    sales_return:   '반품 접수',
    mgr_sales_view: '매출 조회',
    store_delivery_status: '고객 택배',
    purchase_hq:    '발주진행',
    order_request_hq: '매장 발주요청',
    store_returns_hq: '매장 반품신청',
    daily_checklist: '일일 체크리스트',
    claim_intake: '고객 클레임 현황',
    daily_checklist_hq: '매장 일일 체크',
    scm_shipping:   '매장 발주요청',
    purchase_check: '발주 확인',
    customer_input: '회원 등록',
    customer_qr:    'QR 가입',
    consent_renewal:'수신 재동의',
    customer_doc:   '서류 가입',
    my_members:     '회원 목록',
    stock_request:   '발주 요청',
    stock_mgmt_mgr:  '재고 관리',
    stock_mgr_view:  '재고 현황',
    attendance_mgmt: '근태 관리',
    clock_inout:     '출근/퇴근 체크',
    leave_plan:      '휴무 신청',
    store_closure:   '휴점 등록',
    admin:          '사용자 관리',
    notice:         '공지 사항',
    cw_home:        '창원지점 대시보드',
    cw_products:    '제품현황',
    cw_inbound:     '입고입력',
    cw_outbound:    '출고입력',
    cw_stock:       '재고현황',
  };

  if (authLoading) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><span className="spinner"/></div>;
  }
  if (!session) return <><Toasts/><AuthScreen/></>;
  if (!profile?.approved) return <><Toasts/><PendingScreen email={session.user.email}/></>;

  return (
    <>
      <Toasts/>
      <NotificationCenter profile={profile} setPage={setPage}/>
      {hasUpdate && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:9999,
          background:'#fff3e0', borderBottom:'2px solid var(--accent)',
          padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:14,
          boxShadow:'0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <span style={{fontSize:13, fontWeight:700, color:'#bf360c'}}>
            🔔 새 버전이 배포되었습니다. 작업이 끝나면 새로고침해 주세요.
          </span>
          <button type="button" onClick={() => window.location.reload()}
            style={{
              height:32, padding:'0 14px', border:'none', borderRadius:'var(--radius)',
              background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:700,
              cursor:'pointer', whiteSpace:'nowrap'
            }}>
            지금 새로고침
          </button>
          <button type="button" onClick={() => setHasUpdate(false)}
            style={{
              height:32, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)',
              background:'#fff', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer'
            }}>
            나중에
          </button>
        </div>
      )}
      <div className="app-layout" style={hasUpdate ? {paddingTop:54} : undefined}>
        <Sidebar page={page} setPage={setPage} profile={profile} onLogout={handleLogout}
          canImpersonate={canImpersonate} impersonated={canImpersonate ? impersonated : null}
          onStartImpersonate={startImpersonate} onStopImpersonate={stopImpersonate}
          navOpen={navOpen} onNavClose={() => setNavOpen(false)} realProfile={realProfile}/>
        {/* 모바일 드로어 배경(오버레이) — 탭하면 닫힘 */}
        {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)}/>}
        <div className="content">
          <div className="content-header">
            <button className="nav-toggle" aria-label="메뉴" onClick={() => setNavOpen(o => !o)}>☰</button>
            <div className="content-title">{PAGE_TITLES[page]}</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
              {/* 넓은 액션 묶음 — 모바일에서는 숨기고 사이드바 드로어로 이동(.header-wide) */}
              <div className="header-wide">
                {isManager && profile?.department && !canImpersonate && (
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#eef0fe', border:'1px solid #c7cbf7', borderRadius:20, padding:'5px 12px', flexShrink:0 }}>
                    <div style={{ width:7, height:7, background:'var(--accent)', borderRadius:'50%', flexShrink:0 }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{profile.department}</span>
                    <div style={{ width:1, height:12, background:'#c7cbf7' }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{profile.branch}</span>
                  </div>
                )}
                {canImpersonate && (
                  <StoreSwitcher realProfile={realProfile} impersonated={impersonated}
                    onStartImpersonate={startImpersonate} onStopImpersonate={stopImpersonate}/>
                )}
                {!isScm && !isChangwon && (
                  <HeaderNav profile={profile} page={page} setPage={setPage}
                    isAdmin={isAdmin} isHQ={isHQ} isManager={isManager}/>
                )}
              </div>
              <UserMenu profile={profile} isAdmin={isAdmin} onLogout={handleLogout} setPage={setPage} page={page}/>
            </div>
          </div>
          <div className="content-body">
            {page === 'home'           && <HomePage profile={profile} setPage={setPage}/>}
            {page === 'help'           && <HelpPage profile={profile}/>}
            {page === 'product_mgmt'   && canSeeMain && <ProductMgmtPage subPage={null}/>}
            {page === 'product_add'    && canSeeMain && <ProductMgmtPage subPage="product_add"/>}
            {page === 'stock_mgmt'     && (canSeeMain || isScm) && <StockMgmtPage/>}
            {page === 'stock_center'   && (canSeeMain || isScm) && <CenterStockPage/>}
            {page === 'stock_store'    && (canSeeMain || isScm) && <StoreStockPage profile={profile}/>}
            {page === 'stock_transfers' && (canSeeMain || isScm) && <StoreTransfersPage profile={profile}/>}
            {page === 'manager_mgmt'   && canSeeMain && <ManagerMgmtPage/>}
            {page === 'incentive'      && canSeeMain && <IncentivePage profile={profile}/>}
            {page === 'member_mgmt'    && canSeeMain && <CustomerLookupPage profile={profile}/>}
            {page === 'qr_print_all'   && canSeeMain && <QrBatchPrintPage/>}
            {page === 'consent_qr_print' && canSeeMain && <ConsentQrBatchPrintPage/>}
            {page === 'attend_qr_print' && canSeeMain && <AttendanceQrBatchPrintPage/>}
            {page === 'attend_event_stats' && canSeeMain && <AttendEventStatsPage/>}
            {page === 'sms_history'    && canSeeMain && <SmsHistoryPage/>}
            {page === 'sms_unsubscribe_sync' && canSeeMain && <SmsUnsubscribeSyncPage/>}
            {page === 'hq_delivery_request' && (canSeeMain || isScm) && <HQDeliveryRequestPage profile={profile} view="customer"/>}
            {page === 'biz_delivery_request' && (canSeeMain || isScm) && <HQDeliveryRequestPage profile={profile} view="biz"/>}
            {page === 'store_info'     && (canSeeMain || isScm) && <StoreInfoPage/>}
            {page === 'sales_view'         && canSeeMain && <SalesViewHub setPage={setPage}/>}
            {page === 'sales_settlement'   && canSeeMain && <SalesSettlementPage/>}
            {page === 'settlement_report'  && canSeeMain && <SettlementReportPage profile={profile}/>}
            {page === 'sales_list'          && canSeeMain && <SalesListPage setPage={setPage}/>}
            {page === 'biz_sales_view'      && canSeeMain && <BizSalesPage profile={profile} setPage={setPage} mode="view"/>}
            {page === 'lecture_sales_view'  && canSeeMain && <LectureSalesPage profile={profile} setPage={setPage}/>}
            {page === 'sales_input'    && (isManager || isAdmin || isHQ) && <SalesInputPage profile={profile}/>}
            {page === 'expense_input'  && (isManager || isAdmin || isHQ) && <ExpenseInputPage profile={profile}/>}
            {page === 'sales_return'   && (isManager || isAdmin || isHQ) && <SalesReturnPage profile={profile}/>}
            {page === 'mgr_sales_view' && (isManager || isAdmin || isHQ) && <MgrSalesViewPage profile={profile}/>}
            {page === 'store_delivery_status' && (isManager || isAdmin || isHQ) && <StoreDeliveryStatusPage profile={profile}/>}
            {page === 'purchase_hq'    && (isAdmin || isHQ || isScm) && <PurchaseOrderHQPage profile={profile}/>}
            {page === 'scm_shipping'   && (isScm || isAdmin || isHQ) && <ScmShippingPage profile={profile}/>}
            {page === 'order_request_hq' && (isAdmin || isHQ) && <OrderRequestHQPage profile={profile}/>}
            {page === 'store_returns_hq' && (isAdmin || isHQ) && <StoreReturnsHQPage profile={profile}/>}
            {page === 'daily_checklist' && (isManager || isAdmin || isHQ) && <DailyChecklistPage profile={profile}/>}
            {page === 'claim_intake'   && (isManager || isAdmin || isHQ) && <ClaimIntakePage profile={profile}/>}
            {page === 'daily_checklist_hq' && (isAdmin || isHQ) && <DailyChecklistHQPage/>}
            {page === 'purchase_check' && (isManager || isAdmin || isHQ) && <PurchaseOrderMgrPage profile={profile}/>}
            {page === 'customer_input' && (isManager || isAdmin || isHQ) && <CustomerInputPage profile={profile}/>}
            {page === 'customer_qr'    && (isManager || isAdmin || isHQ) && <CustomerQRPage profile={profile}/>}
            {page === 'consent_renewal'&& (isManager || isAdmin || isHQ) && <ConsentRenewMgrPage/>}
            {page === 'customer_doc'   && (isManager || isAdmin || isHQ) && <CustomerDocPage profile={profile}/>}
            {page === 'my_members'     && (isManager || isAdmin || isHQ) && <MyMembersPage profile={profile}/>}
            {page === 'stock_request'  && (isManager || isAdmin || isHQ) && <StockRequestPage profile={profile}/>}
            {page === 'stock_mgr_view' && (isManager || isAdmin || isHQ) && <StoreStockPage profile={profile}/>}
            {page === 'my_attendance'  && (isManager || isAdmin || isHQ) && <MyAttendancePage profile={profile}/>}
            {page === 'leave_plan'     && (isManager || isAdmin || isHQ) && <LeavePlanPage profile={profile}/>}
            {page === 'store_closure'  && (isManager || isAdmin || isHQ) && <StoreClosurePage profile={profile}/>}
            {page === 'attendance_mgmt'&& canSeeMain && <AttendanceMgmtPage profile={profile}/>}
            {page === 'clock_inout'    && (isManager || isAdmin || isHQ) && <ClockInOutPage profile={profile}/>}
            {page === 'upload'         && canSeeMain && <UploadPage profile={profile} activeUploadId={activeUploadId} setActiveUploadId={setActiveUploadId} parsed={parsed} setParsed={setParsed} filename={filename} setFilename={setFilename}/>}
            {page === 'upload_history' && canSeeMain && <UploadHistoryPage profile={profile} activeUploadId={activeUploadId} setActiveUploadId={setActiveUploadId} setPage={setPage} setParsed={setParsed} setFilename={setFilename}/>}
            {page === 'admin'          && (isAdmin || isHQ) && <AdminTab profile={profile}/>}
            {page === 'notice'         && (isAdmin || isHQ || isManager) && <NoticePage profile={profile}/>}
            {page === 'cw_home'        && (isChangwon || isAdmin || isHQ) && <CwHomePage/>}
            {page === 'cw_products'    && (isChangwon || isAdmin || isHQ) && <CwProductsPage/>}
            {page === 'cw_inbound'     && (isChangwon || isAdmin || isHQ) && <CwInboundPage profile={profile}/>}
            {page === 'cw_outbound'    && (isChangwon || isAdmin || isHQ) && <CwOutboundPage profile={profile}/>}
            {page === 'cw_stock'       && (isChangwon || isAdmin || isHQ) && <CwStockPage/>}
          </div>
        </div>
      </div>
    </>
  );
}
