import { useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type WhatsappGlobals = {
  initWhatsapp?: () => void;
  startConnection?: () => void;
  disconnect?: () => void;
  changeSession?: (sessionId: string, options?: { revealReconnectUi?: boolean }) => void;
  createSessionPrompt?: () => void;
  toggleSidebar?: () => void;
  logout?: () => void;
  api?: {
    get?: (endpoint: string) => Promise<any>;
  };
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration?: number) => void;
};

export default function Whatsapp() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const token = sessionStorage.getItem('selfDashboardToken');
      const expiry = Number(sessionStorage.getItem('selfDashboardExpiry') || 0);
      if (!token || !expiry || Date.now() > expiry) {
        navigate('/login', { replace: true });
        return;
      }

      await import('../../core/app');

      if (cancelled) return;

      const win = window as Window & WhatsappGlobals;
      const allowedStatuses = new Set(['active', 'trialing']);
      try {
        const response = await win.api?.get?.('/api/plan/status');
        const status = String(response?.plan?.status || '').trim().toLowerCase();
        if (!allowedStatuses.has(status)) {
          win.showToast?.('warning', 'Assinatura inativa', 'Sua assinatura não está ativa. Reative para poder usar a aplicação.');
          navigate('/configuracoes?panel=plan', { replace: true });
          return;
        }
      } catch (_) {
        win.showToast?.('warning', 'Assinatura inativa', 'Não foi possível validar a assinatura. Reative seu plano para usar a aplicação.');
        navigate('/configuracoes?panel=plan', { replace: true });
        return;
      }

      const mod = await import('../../pages/whatsapp');

      if (cancelled) return;

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
  }, [navigate]);

  const globals = window as Window & WhatsappGlobals;
  const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (!sidebar || !overlay) return;

    const willOpen = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', willOpen);
    overlay.classList.toggle('active', willOpen);
    document.body.classList.toggle('sidebar-open', willOpen);
  };

  return (
    <div className="whatsapp-react">
            <style>{`
        .whatsapp-react {
            --primary: #1ef2a3;
            --primary-light: #59f7be;
            --primary-dark: #0fbf7d;
            --primary-rgb: 30, 242, 163;
            --success: #22d38b;
            --success-light: #5be5ad;
            --warning: #f59e0b;
            --danger: #f87171;
            --info: #5aa8ff;
            --dark: #edf4ff;
            --gray: #8b9bb2;
            --light: #17283f;
            --lighter: #1a2c42;
            --white: #101f33;
            --border: #2c425d;
            --whatsapp: #25D366;
            --shadow: 0 10px 24px rgba(2, 8, 22, 0.24);
            --shadow-lg: 0 20px 50px rgba(2, 8, 22, 0.46);
        }

        .whatsapp-react .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 20px;
        }

        .whatsapp-react .header-title h1 {
            color: var(--dark);
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 5px;
        }

        .whatsapp-react .header-title p {
            color: #94a3b8;
            font-size: 15px;
        }

        .whatsapp-react .whatsapp-tabs {
            display: flex;
            gap: 10px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .whatsapp-react .whatsapp-tab {
            padding: 8px 16px;
            border-radius: 20px;
            background: var(--lighter);
            color: var(--gray);
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
        }

        .whatsapp-react .whatsapp-tab:hover {
            background: rgba(var(--primary-rgb), 0.18);
            color: var(--primary);
        }

        .whatsapp-react .whatsapp-tab.active {
            background: var(--primary);
            color: #052216;
        }

        .whatsapp-react .whatsapp-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
            width: min(100%, 1060px);
            margin: 0 auto;
        }

        .whatsapp-react .card {
            background: linear-gradient(180deg, rgba(16, 31, 51, 0.96) 0%, rgba(10, 22, 38, 0.98) 100%);
            border-radius: 24px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
            overflow: hidden;
            width: 100%;
        }

        .whatsapp-react .card-header {
            padding: 24px 28px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 15px;
            justify-content: space-between;
            flex-wrap: wrap;
        }

        .whatsapp-react .card-header-icon {
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

        .whatsapp-react .card-header-icon .icon {
            width: 20px;
            height: 20px;
        }

        .whatsapp-react .card-header-icon.green {
            color: var(--success);
            background: rgba(16, 185, 129, 0.08);
            border-color: rgba(16, 185, 129, 0.18);
        }

        .whatsapp-react .card-header-icon.blue {
            color: var(--info);
            background: rgba(59, 130, 246, 0.08);
            border-color: rgba(59, 130, 246, 0.18);
        }

        .whatsapp-react .card-header h2 {
            font-size: 20px;
            font-weight: 700;
            color: var(--dark);
        }
        .whatsapp-react .session-controls {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-left: auto;
            min-width: 0;
        }
        .whatsapp-react .session-controls .form-select {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
        }
        .whatsapp-react .session-controls .btn {
            width: auto;
            padding: 10px 14px;
            font-size: 13px;
        }
        .whatsapp-react .session-list-wrap {
            flex-basis: 100%;
            margin-top: 14px;
        }
        .whatsapp-react .session-list {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
        }
        .whatsapp-react .whatsapp-session-list-empty {
            border: 1px dashed var(--border);
            border-radius: 12px;
            padding: 12px;
            color: var(--gray);
            font-size: 13px;
            text-align: center;
            background: rgba(16, 33, 54, 0.4);
        }
        .whatsapp-react .whatsapp-session-list-item {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: rgba(16, 33, 54, 0.82);
            color: var(--dark);
            padding: 10px 12px;
            text-align: left;
            cursor: pointer;
            transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .whatsapp-react .whatsapp-session-list-item:hover {
            border-color: rgba(var(--primary-rgb), 0.65);
            background: rgba(20, 42, 66, 0.95);
        }
        .whatsapp-react .whatsapp-session-list-item.is-active {
            border-color: rgba(var(--primary-rgb), 0.92);
            background: rgba(20, 50, 74, 0.96);
            box-shadow: 0 0 0 1px rgba(var(--primary-rgb), 0.28);
        }
        .whatsapp-react .whatsapp-session-list-main {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 4px;
        }
        .whatsapp-react .whatsapp-session-list-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        .whatsapp-react .whatsapp-session-list-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--dark);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 100%;
        }
        .whatsapp-react .whatsapp-session-list-status {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 999px;
            border: 1px solid transparent;
            white-space: nowrap;
        }
        .whatsapp-react .whatsapp-session-list-status.connected {
            color: #7ef6c3;
            background: rgba(16, 185, 129, 0.14);
            border-color: rgba(16, 185, 129, 0.4);
        }
        .whatsapp-react .whatsapp-session-list-status.disconnected {
            color: #fca5a5;
            background: rgba(239, 68, 68, 0.14);
            border-color: rgba(239, 68, 68, 0.38);
        }
        .whatsapp-react .whatsapp-session-list-arrow {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            border: 1px solid rgba(120, 142, 166, 0.45);
            color: var(--gray);
            font-size: 12px;
            line-height: 1;
            background: rgba(10, 22, 38, 0.5);
            transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
        }
        .whatsapp-react .whatsapp-session-list-arrow.is-expanded {
            transform: rotate(180deg);
            border-color: rgba(var(--primary-rgb), 0.6);
            color: var(--primary);
            background: rgba(var(--primary-rgb), 0.16);
        }
        .whatsapp-react .whatsapp-session-list-detail {
            display: block;
            color: var(--gray);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .whatsapp-react .connection-idle-state {
            border: 1px dashed var(--border);
            border-radius: 16px;
            background: rgba(16, 33, 54, 0.45);
            padding: 22px;
            margin-bottom: 18px;
            text-align: center;
        }
        .whatsapp-react .connection-idle-state h3 {
            font-size: 18px;
            color: var(--dark);
            margin-bottom: 8px;
        }
        .whatsapp-react .connection-idle-state p {
            color: var(--gray);
            font-size: 14px;
            margin: 0;
        }
        .whatsapp-react .card-body {
            padding: 28px;
        }

        .whatsapp-react .qr-container {
            text-align: center;
            padding: 30px;
        }

        .whatsapp-react .qr-wrapper {
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

        .whatsapp-react #qr-code {
            width: 230px;
            height: 230px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }

        .whatsapp-react #qr-code img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .whatsapp-react .qr-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 230px;
        }

        .whatsapp-react .qr-loading-idle {
            gap: 12px;
            padding: 0 14px;
        }

        .whatsapp-react .qr-idle-arrow {
            font-size: 64px;
            line-height: 1;
            color: var(--whatsapp);
            font-weight: 700;
            animation: qrArrowBounce 1.3s ease-in-out infinite;
        }

        .whatsapp-react .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid var(--border);
            border-top-color: var(--whatsapp);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }

        .whatsapp-react .qr-loading p {
            color: var(--gray);
            font-size: 15px;
        }

        @keyframes qrArrowBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(6px); }
        }

        .whatsapp-react .qr-timer {
            color: var(--gray);
            font-size: 13px;
            margin-top: 15px;
        }

        .whatsapp-react .qr-timer strong {
            color: var(--primary);
        }

        .whatsapp-react .connected-state {
            text-align: center;
            padding: 40px 20px;
        }

        .whatsapp-react .connected-avatar {
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

        .whatsapp-react .connected-state h3 {
            font-size: 22px;
            color: var(--dark);
            margin-bottom: 8px;
        }

        .whatsapp-react .connected-state p {
            color: var(--gray);
            font-size: 15px;
            margin-bottom: 25px;
        }

        .whatsapp-react .connected-info {
            background: var(--lighter);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 25px;
        }

        .whatsapp-react .connected-info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
        }

        .whatsapp-react .connected-info-row:last-child {
            border-bottom: none;
        }

        .whatsapp-react .connected-info-label {
            color: var(--gray);
            font-size: 14px;
        }

        .whatsapp-react .connected-info-value {
            color: var(--dark);
            font-weight: 600;
            font-size: 14px;
        }

        .whatsapp-react .btn {
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

        .whatsapp-react .btn-whatsapp {
            background: var(--whatsapp);
            color: white;
            box-shadow: 0 6px 14px rgba(37, 211, 102, 0.2);
        }

        .whatsapp-react .btn-whatsapp:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(37, 211, 102, 0.25);
        }

        .whatsapp-react .btn-whatsapp:disabled {
            background: var(--gray);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .whatsapp-react .btn-danger {
            background: var(--danger);
            color: white;
            box-shadow: 0 6px 14px rgba(239, 68, 68, 0.2);
        }

        .whatsapp-react .btn-danger:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(239, 68, 68, 0.25);
        }

        .whatsapp-react .btn-outline {
            background: rgba(16, 33, 54, 0.86);
            border: 1px solid var(--border);
            color: var(--dark);
        }

        .whatsapp-react .btn-outline:hover {
            border-color: var(--primary);
            color: #ecfff6;
            background: rgba(var(--primary-rgb), 0.16);
        }

        .whatsapp-react .btn-primary {
            background: var(--primary);
            color: #052216;
            box-shadow: 0 6px 14px rgba(var(--primary-rgb), 0.24);
        }

        .whatsapp-react .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(var(--primary-rgb), 0.3);
        }

        .whatsapp-react .pairing-actions {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed var(--border);
        }

        .whatsapp-react .pairing-label {
            display: block;
            text-align: left;
            color: var(--gray);
            font-size: 12px;
            margin-bottom: 8px;
        }

        .whatsapp-react .pairing-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 8px;
            align-items: center;
        }

        .whatsapp-react .pairing-input {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: rgba(16, 33, 54, 0.9);
            color: var(--dark);
            font-size: 14px;
            padding: 11px 12px;
            min-width: 0;
        }

        .whatsapp-react .pairing-btn {
            width: auto;
            min-width: 130px;
            padding: 11px 14px;
        }

        .whatsapp-react .pairing-help {
            margin-top: 6px;
            text-align: left;
            color: var(--gray);
            font-size: 11px;
            line-height: 1.4;
        }

        .whatsapp-react .pairing-code-box {
            display: none;
            margin-top: 12px;
            border: 1px solid var(--border);
            background: rgba(22, 40, 63, 0.9);
            border-radius: 12px;
            padding: 12px;
            text-align: center;
        }

        .whatsapp-react .pairing-code-box.loading {
            opacity: 0.8;
        }

        .whatsapp-react .pairing-code-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--gray);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .whatsapp-react .pairing-code-value {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
            font-size: 22px;
            font-weight: 700;
            color: var(--dark);
            letter-spacing: 2px;
            margin-bottom: 6px;
        }

        .whatsapp-react .pairing-code-meta {
            color: var(--gray);
            font-size: 12px;
        }

        .whatsapp-react .instructions {
            background: var(--lighter);
            border-radius: 16px;
            padding: 25px;
        }

        .whatsapp-react .instructions h3 {
            font-size: 16px;
            color: var(--dark);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .whatsapp-react .instruction-step {
            display: flex;
            gap: 15px;
            margin-bottom: 16px;
            align-items: flex-start;
        }

        .whatsapp-react .instruction-step:last-child {
            margin-bottom: 0;
        }

        .whatsapp-react .step-number {
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

        .whatsapp-react .step-text {
            color: var(--dark);
            font-size: 14px;
            line-height: 1.6;
            padding-top: 4px;
        }

        .whatsapp-react .toast-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
        }

        .whatsapp-react .toast {
            background: linear-gradient(180deg, rgba(16, 31, 51, 0.97) 0%, rgba(10, 22, 38, 0.98) 100%);
            border: 1px solid var(--border);
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

        .whatsapp-react .toast.success { border-left: 4px solid var(--success); }
        .whatsapp-react .toast.error { border-left: 4px solid var(--danger); }
        .whatsapp-react .toast.warning { border-left: 4px solid var(--warning); }
        .whatsapp-react .toast.info { border-left: 4px solid var(--info); }

        .whatsapp-react .toast-icon { font-size: 22px; }
        .whatsapp-react .toast-message { color: var(--dark); font-size: 14px; flex: 1; }

        @media (max-width: 1200px) {
            .whatsapp-react .whatsapp-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 768px) {
            .whatsapp-react .whatsapp-grid {
                width: 100%;
            }

            .whatsapp-react .header-title h1 {
                font-size: 24px;
            }

            .whatsapp-react .card-header,
            .whatsapp-react .card-body {
                padding: 18px;
            }

            .whatsapp-react .session-controls {
                width: auto;
                margin-left: 0;
            }

            .whatsapp-react .session-controls .btn {
                flex-shrink: 0;
            }

            .whatsapp-react .session-list {
                grid-template-columns: 1fr;
            }

            .whatsapp-react .qr-wrapper {
                min-width: 0;
                width: 100%;
                min-height: 240px;
            }

            .whatsapp-react #qr-code {
                width: 200px;
                height: 200px;
            }

            .whatsapp-react .toast-container {
                right: 12px;
                left: 12px;
                bottom: 12px;
            }

            .whatsapp-react .toast {
                min-width: 0;
                width: 100%;
            }

            .whatsapp-react .pairing-row {
                grid-template-columns: 1fr;
            }

            .whatsapp-react .pairing-btn {
                width: 100%;
            }

            .whatsapp-react .pairing-code-value {
                font-size: 18px;
                letter-spacing: 1.5px;
            }
        }
            `}</style>
      <button className="mobile-menu-toggle" type="button" onClick={toggleSidebar}>
        {'\u2630'}
      </button>
      <div className="sidebar-overlay" onClick={toggleSidebar}></div>

      <aside className="sidebar" id="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/dashboard" className="nav-link">
                  <span className="icon icon-dashboard"></span>Painel de Controle
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/contatos" className="nav-link">
                  <span className="icon icon-contacts"></span>Contatos
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/campanhas" className="nav-link">
                  <span className="icon icon-campaigns"></span>Campanhas
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/inbox" className="nav-link">
                  <span className="icon icon-inbox"></span>Inbox
                  <span className="badge" id="unreadBadge" style={{ display: 'none' }}>0</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Automação</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>Automação
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>Fluxos de Conversa
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>Funil de Vendas
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/whatsapp" className="nav-link active">
                  <span className="icon icon-whatsapp"></span>WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>Configurações
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="whatsapp-status">
            <span className="status-indicator disconnected"></span>
            <span className="whatsapp-status-text">Desconectado</span>
          </div>
          <button className="btn-logout" onClick={() => globals.logout?.()}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
              <div className="header">
                  <div className="header-title">
                      <h1>WhatsApp</h1>
                      <p>Conecte e gerencie suas mensagens</p>
                      <div className="whatsapp-tabs">
                          <Link to="/whatsapp" className="whatsapp-tab active">Conexão</Link>
                          <Link to="/inbox" className="whatsapp-tab">Conversas</Link>
                      </div>
                  </div>
                  
              </div>
              
              <div className="whatsapp-grid">
                  <div className="card">
                      <div className="card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div className="card-header-icon green"><span className="icon icon-whatsapp"></span></div>
                              <h2>Conexão WhatsApp</h2>
                          </div>
                          <div className="session-controls">
                              <select
                                  id="whatsapp-session-select"
                                  className="form-select"
                                  defaultValue=""
                                  onChange={(event) => {
                                    const value = (event.target as HTMLSelectElement).value;
                                    if (value) globals.changeSession?.(value, { revealReconnectUi: true });
                                  }}
                              >
                                  <option value="">Carregando contas...</option>
                              </select>
                              <button type="button" className="btn btn-outline" onClick={() => globals.createSessionPrompt?.()}>
                                  + Nova Conta
                              </button>
                          </div>
                          <div className="session-list-wrap">
                              <div id="whatsapp-session-list" className="session-list">
                                  <div className="whatsapp-session-list-empty">Carregando contas...</div>
                              </div>
                          </div>
                      </div>
                      
                      <div className="card-body">
                          <div
                              id="whatsapp-plan-usage"
                              style={{
                                marginBottom: '16px',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.03)',
                                color: 'var(--gray-400)'
                              }}
                          >
                              Carregando limite do plano...
                          </div>
                          <div id="connection-idle-state"></div>

                          <div id="disconnected-state" style={{ display: 'none' }}>
                              <div className="qr-container">
                                  <div className="qr-wrapper">
                                      <div id="qr-code">
                                          <div className="qr-loading qr-loading-idle">
                                              <div className="qr-idle-arrow" aria-hidden="true">&darr;</div>
                                              <p>Clique no bot&atilde;o abaixo para gerar QR Code de acesso</p>
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
                                      <Link to="/inbox" className="btn btn-primary">Ir para Conversas</Link>
                                      <button className="btn btn-danger" onClick={() => globals.disconnect?.()}>Desconectar</button>
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
