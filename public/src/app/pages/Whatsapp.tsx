import { useEffect } from 'react';

import { Link } from 'react-router-dom';
type WhatsappGlobals = {
  initWhatsapp?: () => void;
  startConnection?: () => void;
  disconnect?: () => void;
  toggleSidebar?: () => void;
  logout?: () => void;
};

export default function Whatsapp() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/whatsapp');

      if (cancelled) return;

      const win = window as Window & WhatsappGlobals;
      if (typeof win.initWhatsapp === 'function') {
        win.initWhatsapp();
      } else if (typeof (mod as { initWhatsapp?: () => void }).initWhatsapp === 'function') {
        (mod as { initWhatsapp?: () => void }).initWhatsapp?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & WhatsappGlobals;

  return (
    <div className="whatsapp-react">
      <style>{`
* { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #6d28d9;
            --primary-light: #7c3aed;
            --primary-dark: #5b21b6;
            --success: #10b981;
            --success-light: #34d399;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --dark: #0f172a;
            --gray: #64748b;
            --light: #f5f6fb;
            --lighter: #f8fafc;
            --white: #ffffff;
            --border: #e5e7eb;
            --whatsapp: #25D366;
            --shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
            --shadow-lg: 0 20px 50px rgba(15, 23, 42, 0.2);
        }
        
        html { scroll-behavior: smooth; }
        body { 
            font-family: 'Inter', sans-serif; 
            background: var(--light);
            min-height: 100vh; 
            overflow-x: hidden; 
        }
        
        /* SIDEBAR */
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 280px;
            height: 100vh;
            background: linear-gradient(180deg, #4c1d95 0%, #3b136f 100%);
            color: white;
            padding: 25px;
            z-index: 1000;
            transition: transform 0.3s ease;
            display: flex;
            flex-direction: column;
        }
        
        .sidebar-logo {
            padding: 15px 0 25px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 25px;
            text-align: center;
        }
        
        .sidebar-logo img {
            height: 55px;
            border-radius: 12px;
        }
        
        .sidebar-menu {
            list-style: none;
            flex: 1;
        }
        
        .sidebar-menu li {
            margin-bottom: 8px;
        }
        
        .sidebar-menu a {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 18px;
            color: rgba(255,255,255,0.8);
            text-decoration: none;
            border-radius: 12px;
            transition: all 0.3s;
            font-size: 15px;
            font-weight: 500;
        }
        
        .sidebar-menu a:hover,
        .sidebar-menu a.active {
            background: rgba(255,255,255,0.16);
            color: white;
            transform: translateX(2px);
        }
        
        .sidebar-menu .icon {
            width: 18px;
            height: 18px;
            display: inline-block;
            background-color: currentColor;
            -webkit-mask-size: contain;
            -webkit-mask-repeat: no-repeat;
            -webkit-mask-position: center;
            mask-size: contain;
            mask-repeat: no-repeat;
            mask-position: center;
            font-size: 0;
        }

        .icon-dashboard { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3L3 10h2v10h6v-6h2v6h6V10h2z'/%3E%3C/svg%3E"); mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3L3 10h2v10h6v-6h2v6h6V10h2z'/%3E%3C/svg%3E"); }
        .icon-funnel { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M3 5h18l-7 8v5l-4 2v-7L3 5z'/%3E%3C/svg%3E"); mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M3 5h18l-7 8v5l-4 2v-7L3 5z'/%3E%3C/svg%3E"); }
        .icon-whatsapp { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 5h16v10H8l-4 4V5z'/%3E%3C/svg%3E"); mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 5h16v10H8l-4 4V5z'/%3E%3C/svg%3E"); }
        .icon-message { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 4h16v12H7l-3 3V4z'/%3E%3C/svg%3E"); mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 4h16v12H7l-3 3V4z'/%3E%3C/svg%3E"); }
        .icon-settings { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4l-2.1-.7a7.9 7.9 0 0 0-.7-1.7l1.2-1.9-1.4-1.4-1.9 1.2a7.9 7.9 0 0 0-1.7-.7L12 3 9.4 3.8a7.9 7.9 0 0 0-1.7.7L5.8 3.3 4.4 4.7l1.2 1.9a7.9 7.9 0 0 0-.7 1.7L3 12l2.1.7c.2.6.4 1.2.7 1.7l-1.2 1.9 1.4 1.4 1.9-1.2c.5.3 1.1.5 1.7.7L12 21l2.6-.8c.6-.2 1.2-.4 1.7-.7l1.9 1.2 1.4-1.4-1.2-1.9c.3-.5.5-1.1.7-1.7L21 12z'/%3E%3C/svg%3E"); mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4l-2.1-.7a7.9 7.9 0 0 0-.7-1.7l1.2-1.9-1.4-1.4-1.9 1.2a7.9 7.9 0 0 0-1.7-.7L12 3 9.4 3.8a7.9 7.9 0 0 0-1.7.7L5.8 3.3 4.4 4.7l1.2 1.9a7.9 7.9 0 0 0-.7 1.7L3 12l2.1.7c.2.6.4 1.2.7 1.7l-1.2 1.9 1.4 1.4 1.9-1.2c.5.3 1.1.5 1.7.7L12 21l2.6-.8c.6-.2 1.2-.4 1.7-.7l1.9 1.2 1.4-1.4-1.2-1.9c.3-.5.5-1.1.7-1.7L21 12z'/%3E%3C/svg%3E"); }
        .icon-contacts { -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M16 14c2.2 0 4 1.8 4 4v3H4v-3c0-2.2 1.8-4 4-4h8zM12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'/%3E%3C/svg%3E"); mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M16 14c2.2 0 4 1.8 4 4v3H4v-3c0-2.2 1.8-4 4-4h8zM12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'/%3E%3C/svg%3E"); }
        
        .sidebar-footer {
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
        }
        
        .btn-logout {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding: 14px 18px;
            background: rgba(239, 68, 68, 0.18);
            border: none;
            border-radius: 12px;
            color: #fca5a5;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-logout:hover {
            background: rgba(239, 68, 68, 0.4);
            color: white;
        }
        
        /* MOBILE MENU */
        .mobile-menu-toggle {
            display: none;
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1100;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 14px 18px;
            font-size: 22px;
            cursor: pointer;
            box-shadow: var(--shadow);
        }
        
        .sidebar-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            z-index: 999;
        }
        
        /* MAIN CONTENT */
        .main-content {
            margin-left: 280px;
            padding: 30px;
            transition: margin-left 0.3s ease;
            min-height: 100vh;
        }
        
        /* HEADER */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .header-title h1 {
            color: var(--dark);
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 5px;
        }
        
        .header-title p {
            color: var(--gray);
            font-size: 15px;
        }
        
        .status-badge {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 14px;
        }
        
        .status-badge.connected {
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
        }
        
        .status-badge.disconnected {
            background: rgba(239, 68, 68, 0.1);
            color: var(--danger);
        }
        
        .status-badge .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        .status-badge.connected .dot {
            background: var(--success);
        }
        
        .status-badge.disconnected .dot {
            background: var(--danger);
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.9); }
        }
        
        /* MAIN GRID */
        .whatsapp-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        
        /* CARD */
        .card {
            background: white;
            border-radius: 24px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
            overflow: hidden;
        }
        
        .card-header {
            padding: 24px 28px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .card-header-icon {
            width: 50px;
            height: 50px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
            border: 1px solid var(--border);
            background: var(--lighter);
        }

        .card-header-icon .icon {
            width: 20px;
            height: 20px;
        }
        
        .card-header-icon.green {
            color: var(--success);
            background: rgba(16, 185, 129, 0.08);
            border-color: rgba(16, 185, 129, 0.18);
        }
        
        .card-header-icon.blue {
            color: var(--info);
            background: rgba(59, 130, 246, 0.08);
            border-color: rgba(59, 130, 246, 0.18);
        }
        
        .card-header h2 {
            font-size: 20px;
            font-weight: 700;
            color: var(--dark);
        }
        
        .card-body {
            padding: 28px;
        }
        
        /* QR CODE SECTION */
        .qr-container {
            text-align: center;
            padding: 30px;
        }
        
        .qr-wrapper {
            background: white;
            padding: 25px;
            border-radius: 20px;
            display: inline-block;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
            margin-bottom: 25px;
            position: relative;
            min-width: 280px;
            min-height: 280px;
        }
        
        #qr-code {
            width: 230px;
            height: 230px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }
        
        #qr-code img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        .qr-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 230px;
        }
        
        .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid var(--border);
            border-top-color: var(--whatsapp);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .qr-loading p {
            color: var(--gray);
            font-size: 15px;
        }
        
        .qr-timer {
            color: var(--gray);
            font-size: 13px;
            margin-top: 15px;
        }
        
        .qr-timer strong {
            color: var(--primary);
        }
        
        /* CONNECTED STATE */
        .connected-state {
            text-align: center;
            padding: 40px 20px;
        }
        
        .connected-avatar {
            width: 100px;
            height: 100px;
            background: var(--success);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 700;
            color: white;
            margin: 0 auto 25px;
            box-shadow: 0 10px 24px rgba(16, 185, 129, 0.3);
        }
        
        .connected-state h3 {
            font-size: 22px;
            color: var(--dark);
            margin-bottom: 8px;
        }
        
        .connected-state p {
            color: var(--gray);
            font-size: 15px;
            margin-bottom: 25px;
        }
        
        .connected-info {
            background: var(--lighter);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 25px;
        }
        
        .connected-info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
        }
        
        .connected-info-row:last-child {
            border-bottom: none;
        }
        
        .connected-info-label {
            color: var(--gray);
            font-size: 14px;
        }
        
        .connected-info-value {
            color: var(--dark);
            font-weight: 600;
            font-size: 14px;
        }
        
        /* BUTTONS */
        .btn {
            padding: 16px 28px;
            border: none;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.3s;
            width: 100%;
        }
        
        .btn-whatsapp {
            background: var(--whatsapp);
            color: white;
            box-shadow: 0 6px 14px rgba(37, 211, 102, 0.2);
        }
        
        .btn-whatsapp:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(37, 211, 102, 0.25);
        }
        
        .btn-whatsapp:disabled {
            background: var(--gray);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .btn-danger {
            background: var(--danger);
            color: white;
            box-shadow: 0 6px 14px rgba(239, 68, 68, 0.2);
        }
        
        .btn-danger:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(239, 68, 68, 0.25);
        }
        
        .btn-outline {
            background: white;
            border: 1px solid var(--border);
            color: var(--dark);
        }
        
        .btn-outline:hover {
            border-color: var(--primary);
            color: var(--primary);
        }
        
        .btn-primary {
            background: var(--primary);
            color: white;
            box-shadow: 0 6px 14px rgba(109, 40, 217, 0.2);
        }
        
        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(109, 40, 217, 0.25);
        }
        
        /* INSTRUCTIONS */
        .instructions {
            background: var(--lighter);
            border-radius: 16px;
            padding: 25px;
        }
        
        .instructions h3 {
            font-size: 16px;
            color: var(--dark);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .instruction-step {
            display: flex;
            gap: 15px;
            margin-bottom: 16px;
            align-items: flex-start;
        }
        
        .instruction-step:last-child {
            margin-bottom: 0;
        }
        
        .step-number {
            width: 32px;
            height: 32px;
            background: var(--primary);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            flex-shrink: 0;
        }
        
        .step-text {
            color: var(--dark);
            font-size: 14px;
            line-height: 1.6;
            padding-top: 4px;
        }
        
        /* CONTACTS SECTION */
        .contacts-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .contacts-header h3 {
            font-size: 16px;
            color: var(--dark);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .contacts-count {
            background: var(--primary);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .contacts-list {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .contact-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            border-radius: 12px;
            transition: all 0.2s;
            cursor: pointer;
        }
        
        .contact-item:hover {
            background: var(--lighter);
        }
        
        .contact-avatar {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 18px;
        }
        
        .contact-info {
            flex: 1;
        }
        
        .contact-name {
            font-weight: 600;
            color: var(--dark);
            font-size: 15px;
        }
        
        .contact-phone {
            color: var(--gray);
            font-size: 13px;
        }
        
        .contact-action {
            background: var(--whatsapp);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 10px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.3px;
            transition: all 0.2s;
        }
        
        .contact-action:hover {
            transform: scale(1.1);
        }
        
        .contacts-empty {
            text-align: center;
            padding: 50px 20px;
            color: var(--gray);
        }
        
        .contacts-empty .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 15px;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: var(--lighter);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--gray);
            font-size: 14px;
            font-weight: 600;
        }
        
        /* TOAST */
        .toast-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
        }
        
        .toast {
            background: white;
            padding: 16px 24px;
            border-radius: 14px;
            box-shadow: var(--shadow-lg);
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 12px;
            animation: slideIn 0.3s ease;
            min-width: 280px;
        }
        
        .toast.success { border-left: 4px solid var(--success); }
        .toast.error { border-left: 4px solid var(--danger); }
        .toast.warning { border-left: 4px solid var(--warning); }
        .toast.info { border-left: 4px solid var(--info); }
        
        .toast-icon { font-size: 22px; }
        .toast-message { color: var(--dark); font-size: 14px; flex: 1; }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .toast.fade-out {
            animation: slideOut 0.3s ease forwards;
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        /* RESPONSIVE */
        @media (max-width: 1200px) {
            .whatsapp-grid {
                grid-template-columns: 1fr;
            }
        }
        
        @media (max-width: 768px) {
            .mobile-menu-toggle {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .sidebar {
                transform: translateX(-100%);
                width: 85%;
                max-width: 320px;
            }
            
            .sidebar.active {
                transform: translateX(0);
            }
            
            .sidebar-overlay.active {
                display: block;
            }
            
            .main-content {
                margin-left: 0;
                padding: 80px 16px 20px;
            }
            
            .header {
                flex-direction: column;
                align-items: stretch;
            }
            
            .header-title h1 {
                font-size: 24px;
            }
            
            .qr-wrapper {
                min-width: 240px;
                min-height: 240px;
            }
            
            #qr-code {
                width: 200px;
                height: 200px;
            }
        }
      `}</style>
          <aside className="sidebar" id="sidebar">
              <div className="sidebar-logo">
                  <img src="img/logo-self.png" alt="SELF Proteção Veicular" />
              </div>
              
              <ul className="sidebar-menu">
                  <li>
                      <Link to="/dashboard">
                          <span className="icon icon-dashboard"></span>
                          Dashboard
                      </Link>
                  </li>
                  <li>
                      <Link to="/funil">
                          <span className="icon icon-funnel"></span>
                          Funil de Vendas
                      </Link>
                  </li>
                  <li>
                      <Link to="/whatsapp" className="active">
                          <span className="icon icon-whatsapp"></span>
                          WhatsApp
                      </Link>
                  </li>
                  <li>
                      <Link to="/conversas">
                          <span className="icon icon-message"></span>
                          Conversas
                      </Link>
                  </li>
                  <li>
                      <Link to="/configuracoes">
                          <span className="icon icon-settings"></span>
                          Configurações
                      </Link>
                  </li>
              </ul>
              
              <div className="sidebar-footer">
                  <button className="btn-logout" onClick={() => globals.logout?.()}>Sair</button>
              </div>
          </aside>
          
          <button className="mobile-menu-toggle" onClick={() => globals.toggleSidebar?.()}>☰</button>
          <div className="sidebar-overlay" onClick={() => globals.toggleSidebar?.()}></div>
          
          <main className="main-content">
              <div className="header">
                  <div className="header-title">
                      <h1>WhatsApp</h1>
                      <p>Conecte e gerencie suas mensagens</p>
                  </div>
                  
                  <div className="status-badge disconnected" id="status-badge">
                      <span className="dot"></span>
                      <span id="status-text">Desconectado</span>
                  </div>
              </div>
              
              <div className="whatsapp-grid">
                  <div className="card">
                      <div className="card-header">
                          <div className="card-header-icon green"><span className="icon icon-whatsapp"></span></div>
                          <h2>Conexão WhatsApp</h2>
                      </div>
                      
                      <div className="card-body">
                          <div id="disconnected-state">
                              <div className="qr-container">
                                  <div className="qr-wrapper">
                                      <div id="qr-code">
                                          <div className="qr-loading">
                                              <div className="spinner"></div>
                                              <p>Aguardando conexão...</p>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <p className="qr-timer" id="qr-timer" style={{ display: 'none' }}>
                                      Por segurança, o QR Code será atualizado em <strong id="timer-countdown">30</strong> segundos
                                  </p>
                                  
                                  <button className="btn btn-whatsapp" id="connect-btn" onClick={() => globals.startConnection?.()}>Conectar WhatsApp</button>
                              </div>
                              
                              <div className="instructions">
                                  <h3>Como conectar</h3>
                                  <div className="instruction-step">
                                      <span className="step-number">1</span>
                                      <span className="step-text">Clique em "Conectar WhatsApp" acima</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">2</span>
                                      <span className="step-text">Abra o WhatsApp no seu celular</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">3</span>
                                      <span className="step-text">Vá em Configurações &gt; Dispositivos conectados</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">4</span>
                                      <span className="step-text">Toque em "Conectar dispositivo"</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">5</span>
                                      <span className="step-text">Escaneie o QR Code que aparecer</span>
                                  </div>
                              </div>
                          </div>
                          
                          <div id="connected-state" style={{ display: 'none' }}>
                                  <div className="connected-state">
                                      <div className="connected-avatar">OK</div>
                                  <h3>WhatsApp Conectado!</h3>
                                  <p>Seu WhatsApp está conectado e pronto para uso</p>
                                  
                                  <div className="connected-info">
                                      <div className="connected-info-row">
                                          <span className="connected-info-label">Nome</span>
                                          <span className="connected-info-value" id="user-name">-</span>
                                      </div>
                                      <div className="connected-info-row">
                                          <span className="connected-info-label">Número</span>
                                          <span className="connected-info-value" id="user-phone">-</span>
                                      </div>
                                      <div className="connected-info-row">
                                          <span className="connected-info-label">Status</span>
                                          <span className="connected-info-value" style={{ color: 'var(--success)' }}>Online</span>
                                      </div>
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
                                      <Link to="/conversas" className="btn btn-primary">Ir para Conversas</Link>
                                      <button className="btn btn-danger" onClick={() => globals.disconnect?.()}>Desconectar</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="card">
                      <div className="card-header">
                          <div className="card-header-icon blue"><span className="icon icon-contacts"></span></div>
                          <h2>Contatos Recentes</h2>
                      </div>
                      
                      <div className="card-body">
                          <div id="contacts-container">
                              <div className="contacts-empty" id="contacts-empty">
                                  <span className="icon icon-contacts"></span>
                                  <h3>Conecte o WhatsApp</h3>
                                  <p>Conecte seu WhatsApp para ver os contatos recentes</p>
                              </div>
                              
                              <div id="contacts-list-wrapper" style={{ display: 'none' }}>
                                  <div className="contacts-header">
                                      <h3>
                                          Lista de Contatos
                                      </h3>
                                      <span className="contacts-count" id="contacts-count">0</span>
                                  </div>
                                  <div className="contacts-list" id="contacts-list">
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </main>
          
          <div className="toast-container" id="toast-container"></div>
          
    </div>
  );
}
