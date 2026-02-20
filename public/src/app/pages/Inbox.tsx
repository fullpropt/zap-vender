import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type InboxGlobals = {
  initInbox?: () => void;
  filterConversations?: (filter: string) => void;
  searchConversations?: () => void;
  changeInboxSessionFilter?: (sessionId: string) => void;
  registerCurrentUser?: () => void;
  toggleContactInfo?: (forceOpen?: boolean) => void;
  logout?: () => void;
};

export default function Inbox() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/inbox');

      if (cancelled) return;

      const win = window as Window & InboxGlobals;
      if (typeof win.initInbox === 'function') {
        win.initInbox();
      } else if (typeof (mod as { initInbox?: () => void }).initInbox === 'function') {
        (mod as { initInbox?: () => void }).initInbox?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & InboxGlobals;

  return (
    <div className="inbox-react">
      <style>{`
        .inbox-container {
            display: grid;
            grid-template-columns: 350px 1fr 320px;
            grid-template-rows: 1fr;
            height: calc(100vh - 120px);
            gap: 0;
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-lg);
            overflow: hidden;
        }
        @media (max-width: 1024px) {
            .inbox-container { grid-template-columns: 350px 1fr; }
            .inbox-right-panel { display: none; }
        }
        @media (max-width: 768px) {
            .inbox-container { grid-template-columns: 1fr; }
            .chat-panel { display: none; }
            .chat-panel.active { display: flex; }
            .conversations-panel.hidden { display: none; }
            .inbox-right-panel { display: none; }
        }
        .conversations-panel {
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .conversations-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
        }
        .conversations-header h2 {
            margin: 0 0 15px;
            font-size: 20px;
            color: var(--dark);
        }
        .inbox-session-filter {
            margin-bottom: 12px;
        }
        .inbox-session-filter .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: var(--gray-700);
            margin-bottom: 6px;
        }
        .inbox-session-filter .form-select {
            width: 100%;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: var(--surface);
            color: var(--dark);
            font-size: 13px;
            padding: 9px 10px;
        }
        .inbox-session-highlight {
            margin-bottom: 12px;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(var(--primary-rgb), 0.28);
            border-left: 3px solid rgba(var(--primary-rgb), 0.85);
            background: linear-gradient(
                90deg,
                rgba(var(--primary-rgb), 0.08) 0%,
                rgba(15, 23, 42, 0.22) 38%,
                rgba(15, 23, 42, 0.2) 100%
            );
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .inbox-session-highlight-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: rgba(var(--primary-rgb), 0.9);
            font-weight: 700;
            margin-bottom: 2px;
        }
        .inbox-session-highlight-name {
            font-size: 14px;
            color: var(--dark);
            font-weight: 700;
            line-height: 1.2;
        }
        .inbox-session-highlight-meta {
            font-size: 11px;
            color: var(--gray-600);
            margin-top: 3px;
            line-height: 1.3;
        }
        .inbox-session-highlight-status {
            border-radius: 999px;
            border: 1px solid rgba(var(--primary-rgb), 0.42);
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
        }
        .inbox-session-highlight-status.connected {
            border-color: rgba(var(--primary-rgb), 0.5);
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
        }
        .inbox-session-highlight-status.disconnected {
            border-color: rgba(var(--primary-rgb), 0.3);
            background: rgba(15, 23, 42, 0.24);
            color: var(--gray-700);
        }
        .inbox-session-highlight-status.all {
            border-color: rgba(var(--primary-rgb), 0.42);
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
        }
        .conversations-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .conversations-tabs button {
            padding: 8px 16px;
            border: 1px solid var(--border-color);
            background: var(--gray-100);
            color: var(--gray-800);
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }
        .conversations-tabs button.active {
            background: var(--primary);
            color: white;
        }
        .conversations-list {
            flex: 1;
            overflow-y: auto;
            background: var(--surface);
        }
        .conversation-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 15px 20px;
            cursor: pointer;
            transition: background 0.2s;
            border-bottom: 1px solid var(--border-color);
        }
        .conversation-item:hover { background: rgba(var(--primary-rgb), 0.08); }
        .conversation-item.active { background: rgba(var(--primary-rgb), 0.16); }
        .conversation-item.unread { background: rgba(var(--primary-rgb), 0.1); }
        .conversation-item.unread .conversation-name { font-weight: 700; }
        .conversation-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            color: white;
            font-size: 16px;
            flex-shrink: 0;
        }
        .conversation-info { flex: 1; min-width: 0; }
        .conversation-name-row {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .conversation-name {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .conversation-session-chip {
            flex-shrink: 0;
            max-width: 120px;
            padding: 1px 7px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 600;
            line-height: 1.4;
            color: var(--gray-700);
            background: rgba(var(--primary-rgb), 0.15);
            border: 1px solid rgba(var(--primary-rgb), 0.35);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .conversation-preview {
            font-size: 13px;
            color: var(--gray-700);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .conversation-meta {
            text-align: right;
            flex-shrink: 0;
        }
        .conversation-time {
            font-size: 11px;
            color: var(--gray-600);
        }
        .conversation-badge {
            background: var(--primary);
            color: white;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            margin-top: 5px;
            display: inline-block;
        }
        .chat-panel {
            display: flex;
            flex-direction: column;
            background: var(--surface-muted);
            min-height: 0;
        }
        .chat-header {
            background: var(--surface);
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-bottom: 1px solid var(--border-color);
        }
        .chat-header-info { flex: 1; }
        .chat-header-name { font-weight: 600; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-header-status { font-size: 12px; color: var(--gray-700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            min-height: 0;
        }
        .chat-messages > .chat-messages-stack {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: stretch;
            gap: 10px;
            min-height: min-content;
        }
        .chat-messages .message {
            display: block !important;
            max-width: 70%;
            width: fit-content;
            min-width: 76px;
            margin: 0 !important;
            padding: 10px 15px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
            position: relative;
            word-break: break-word;
        }
        .chat-messages .message.sent {
            background: rgba(var(--primary-rgb), 0.24);
            color: #ecfff6;
            align-self: flex-end;
            margin-left: auto !important;
            border-bottom-right-radius: 4px;
        }
        .chat-messages .message.received {
            background: var(--surface);
            border: 1px solid var(--border-color);
            color: var(--dark);
            align-self: flex-start;
            margin-right: auto !important;
            border-bottom-left-radius: 4px;
        }
        .message-time {
            font-size: 10px;
            color: var(--gray-600);
            margin-top: 5px;
            text-align: right;
        }
        .message-status {
            display: inline-block;
            margin-left: 5px;
        }
        .message-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .message-text,
        .message-caption {
            white-space: pre-wrap;
            word-break: break-word;
        }
        .message-media {
            max-width: 100%;
        }
        .message-media-image {
            display: block;
            width: 100%;
            max-width: 260px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
        }
        .chat-messages .message.sent .message-media-image {
            border-color: rgba(var(--primary-rgb), 0.35);
        }
        .message-media-audio {
            display: block;
            width: min(260px, 100%);
            max-width: 100%;
        }
        .message-media-video {
            display: block;
            width: 100%;
            max-width: 280px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: #000;
        }
        .chat-messages .message.sent .message-media-video {
            border-color: rgba(var(--primary-rgb), 0.35);
        }
        .message-document-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            max-width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.12);
            color: inherit;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
        }
        .message-document-link span:last-child {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .chat-messages .message.sent .message-document-link {
            border-color: rgba(var(--primary-rgb), 0.35);
            background: rgba(var(--primary-rgb), 0.16);
        }
        .chat-input {
            background: var(--surface);
            border-top: 1px solid var(--border-color);
            padding: 15px 20px;
            display: flex;
            gap: 15px;
            align-items: flex-end;
        }
        .chat-input textarea {
            flex: 1;
            border: 1px solid var(--border-color);
            border-radius: 20px;
            background: var(--surface-muted);
            color: var(--dark);
            padding: 12px 20px;
            font-size: 14px;
            resize: none;
            max-height: 120px;
            font-family: inherit;
        }
        .chat-input textarea::placeholder { color: var(--gray-500); }
        .chat-input textarea:focus {
            outline: none;
            border-color: var(--primary);
        }
        .chat-input button {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background: var(--whatsapp);
            color: white;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }
        .chat-input button:hover { transform: scale(1.05); }
        .quick-reply-toolbar {
            position: relative;
            display: flex;
            justify-content: flex-start;
            padding: 10px 20px 0;
            background: var(--surface);
            border-top: 1px solid var(--border-color);
        }
        .quick-reply-trigger {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 36px;
            border-radius: 999px;
            padding: 0 14px;
            font-weight: 600;
        }
        .quick-reply-picker {
            display: none;
            position: absolute;
            left: 20px;
            right: 20px;
            bottom: calc(100% + 8px);
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            padding: 8px;
            max-height: 220px;
            overflow-y: auto;
            z-index: 10;
        }
        .quick-reply-picker.open {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .quick-reply-option {
            width: 100%;
            border: 1px solid transparent;
            border-radius: 10px;
            background: transparent;
            color: var(--dark);
            text-align: left;
            font-size: 13px;
            padding: 10px 12px;
            cursor: pointer;
        }
        .quick-reply-option:hover {
            background: rgba(var(--primary-rgb), 0.1);
            border-color: var(--border-color);
        }
        .quick-reply-empty {
            padding: 10px 12px;
            font-size: 13px;
            color: var(--gray-700);
        }
        .chat-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--gray-700);
            background: var(--surface-muted);
        }
        .chat-empty-icon { font-size: 80px; margin-bottom: 20px; opacity: 0.5; }
        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 10px 15px;
            background: var(--surface);
            border-radius: 12px;
            align-self: flex-start;
        }
        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--gray-400);
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-5px); }
        }
        .contact-info-panel { display: none; }
        .inbox-right-panel {
            background: var(--surface);
            border-left: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            padding: 24px;
            min-height: 0;
        }
        .inbox-right-panel-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .inbox-right-panel-content.ready { align-items: stretch; justify-content: flex-start; text-align: left; }
        .inbox-right-panel-robot { font-size: 64px; margin-bottom: 20px; opacity: 0.6; }
        .inbox-right-panel p { color: var(--gray-700); line-height: 1.5; margin: 0 0 16px; font-size: 14px; }
        .inbox-right-panel .btn-register-user { background: var(--whatsapp, #25d366); color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 14px; }
        .inbox-right-panel .btn-register-user:hover { opacity: 0.9; }
        .inbox-main-content { padding: 20px; }
        .chat-header-actions { display: flex; gap: 8px; align-items: center; }
        .chat-back-btn { display: none; }
        .contact-info-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.64);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity var(--transition), visibility var(--transition);
            z-index: 3390;
        }
        .contact-info-backdrop.active {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .contact-card { width: 100%; display: flex; flex-direction: column; gap: 16px; text-align: left; }
        .contact-card-empty { width: 100%; max-width: 260px; }
        .contact-card-header { display: flex; align-items: center; gap: 12px; }
        .contact-card-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-weight: 700;
        }
        .contact-card-title { font-size: 16px; font-weight: 700; color: var(--dark); }
        .contact-card-subtitle { font-size: 12px; color: var(--gray-600); margin-top: 2px; }
        .contact-card-section {
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 12px;
            background: rgba(15, 23, 42, 0.18);
        }
        .contact-card-section-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: var(--gray-600);
            margin-bottom: 10px;
        }
        .contact-info-grid,
        .contact-card-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .contact-info-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: baseline;
            font-size: 13px;
        }
        .contact-info-label { color: var(--gray-600); }
        .contact-info-value {
            color: var(--dark);
            font-weight: 600;
            text-align: right;
            max-width: 60%;
            word-break: break-word;
        }
        .contact-tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .contact-tag-chip {
            display: inline-flex;
            align-items: center;
            border: 1px solid var(--border-color);
            border-radius: 999px;
            padding: 3px 10px;
            font-size: 12px;
            color: var(--gray-700);
            background: rgba(var(--primary-rgb), 0.12);
        }
        .contact-card-muted { color: var(--gray-600); font-size: 12px; margin: 0; }
        .contact-card-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .contact-card-actions .btn { width: 100%; }

        @media (max-width: 1024px) {
            .inbox-container {
                grid-template-columns: 340px 1fr !important;
                height: calc(100vh - 105px);
            }
            .inbox-right-panel {
                display: flex !important;
                position: fixed;
                right: 0;
                top: 0;
                width: min(92vw, 360px);
                height: 100vh;
                z-index: 3400;
                transform: translateX(100%);
                transition: transform var(--transition);
                box-shadow: -12px 0 28px rgba(0, 0, 0, 0.28);
            }
            .inbox-right-panel.active {
                transform: translateX(0);
            }
        }

        @media (max-width: 768px) {
            .inbox-main-content { padding: 8px !important; }
            .inbox-container {
                grid-template-columns: 1fr !important;
                border-radius: 12px;
                height: calc(100vh - 86px);
            }
            .conversations-panel {
                display: flex !important;
                border-right: none;
            }
            .conversations-panel.hidden {
                display: none !important;
            }
            .chat-panel {
                display: none !important;
            }
            .chat-panel.active {
                display: flex !important;
            }
            .chat-header {
                padding: 10px 12px;
                gap: 10px;
            }
            .chat-back-btn {
                display: inline-flex;
            }
            .chat-header-actions {
                gap: 6px;
            }
            .chat-header-actions .btn.btn-icon {
                width: 34px;
                height: 34px;
            }
            .chat-messages {
                padding: 10px 12px;
            }
            .chat-messages .message {
                max-width: 86%;
                font-size: 13px;
            }
            .quick-reply-toolbar {
                padding: 8px 12px 0;
            }
            .chat-input {
                padding: 10px 12px;
                gap: 10px;
            }
            .chat-input button {
                width: 42px;
                height: 42px;
            }
            .conversations-header {
                padding: 14px 12px;
            }
            .conversations-header h2 {
                font-size: 18px;
                margin-bottom: 10px;
            }
            .inbox-session-highlight {
                padding: 8px 10px;
                gap: 8px;
            }
            .inbox-session-highlight-name {
                font-size: 13px;
            }
            .inbox-session-highlight-status {
                font-size: 10px;
                padding: 3px 8px;
            }
            .conversations-tabs {
                margin-bottom: 10px;
            }
            .conversations-list .conversation-item {
                padding: 12px;
            }
            .contact-card-actions {
                grid-template-columns: 1fr;
            }
        }
      `}</style>

      <button
        className="mobile-menu-toggle"
        type="button"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      >
        {'\u2630'}
      </button>
      <div
        className="sidebar-overlay"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      ></div>

      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
        </div>
        <nav className="sidebar-nav">
                            <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/inbox" className="nav-link active">
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
                <Link to="/whatsapp" className="nav-link">
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

      <main className="main-content inbox-main-content">
        <div className="inbox-container">
          <div className="conversations-panel" id="conversationsPanel">
            <div className="conversations-header">
              <h2><span className="icon icon-inbox icon-sm"></span> Inbox</h2>
              <div className="inbox-session-filter">
                <label className="form-label" htmlFor="inboxSessionFilter">Conta WhatsApp</label>
                <select
                  id="inboxSessionFilter"
                  className="form-select"
                  defaultValue=""
                  onChange={(event) => globals.changeInboxSessionFilter?.((event.target as HTMLSelectElement).value)}
                >
                  <option value="">Todas as contas</option>
                </select>
              </div>
              <div className="inbox-session-highlight" id="inboxSessionIndicator">
                <div>
                  <div className="inbox-session-highlight-label">Conta exibida</div>
                  <div className="inbox-session-highlight-name">Todas as contas</div>
                  <div className="inbox-session-highlight-meta">Mostrando conversas de todas as contas</div>
                </div>
                <span className="inbox-session-highlight-status all">Filtro geral</span>
              </div>
              <div className="conversations-tabs">
                <button id="filterAllBtn" className="active" onClick={() => globals.filterConversations?.('all')}>Todos</button>
                <button id="filterUnreadBtn" onClick={() => globals.filterConversations?.('unread')}>Não lidos</button>
              </div>
              <div className="search-box" style={{ maxWidth: '100%' }}>
                <span className="search-icon icon icon-search icon-sm"></span>
                <input
                  type="text"
                  id="searchConversations"
                  placeholder="Buscar conversa..."
                  onKeyUp={() => globals.searchConversations?.()}
                />
              </div>
            </div>
            <div className="conversations-list" id="conversationsList">
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Carregando conversas...</p>
              </div>
            </div>
          </div>

          <div className="chat-panel" id="chatPanel">
            <div className="chat-empty">
              <div className="chat-empty-icon icon icon-empty icon-lg"></div>
              <h3>Nenhum chat selecionado</h3>
              <p>Selecione uma conversa da lista ao lado para começar a conversar</p>
            </div>
          </div>

          <div className="inbox-right-panel" id="inboxRightPanel">
            <div className="inbox-right-panel-content" id="inboxRightContent">
              <span className="inbox-right-panel-robot icon icon-automation icon-lg"></span>
              <p><strong>Este cliente ainda não está cadastrado na sua audiência.</strong></p>
              <p>Vamos cadastrá-lo para que o cartão do usuário dele apareça aqui?</p>
              <button className="btn-register-user" onClick={() => globals.registerCurrentUser?.()}>
                SIM! Cadastrar este usuário
              </button>
            </div>
          </div>
        </div>
        <div className="contact-info-backdrop" id="contactInfoBackdrop" onClick={() => globals.toggleContactInfo?.(false)}></div>
      </main>
    </div>
  );
}
