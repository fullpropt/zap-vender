import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type ConversasGlobals = {
  initConversas?: () => void;
  filterConversations?: (filter: string) => void;
  searchConversations?: () => void;
  showConversationsList?: () => void;
  viewLeadDetails?: () => void;
  openWhatsAppWeb?: () => void;
  sendMessage?: () => void;
  useTemplate?: (text: string) => void;
  handleKeyDown?: (event: KeyboardEvent) => void;
  autoResize?: (textarea: HTMLTextAreaElement) => void;
  toggleSidebar?: () => void;
  logout?: () => void;
};

export default function Conversas() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/conversas');

      if (cancelled) return;

      const win = window as Window & ConversasGlobals;
      if (typeof win.initConversas === 'function') {
        win.initConversas();
      } else if (typeof (mod as { initConversas?: () => void }).initConversas === 'function') {
        (mod as { initConversas?: () => void }).initConversas?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & ConversasGlobals;

  return (
    <div className="conversas-react">
      <style>{`
:root {
            --primary: #178C49;
            --primary-light: #1FAE5E;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --dark: #1e293b;
            --gray: #64748b;
            --light: #f1f5f9;
            --lighter: #f8fafc;
            --white: #ffffff;
            --border: #e2e8f0;
            --whatsapp: #25D366;
        }
        
        .inbox-container {
            display: grid;
            grid-template-columns: 380px 1fr;
            height: calc(100vh - 100px);
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 4px 25px rgba(0,0,0,0.08);
        }
        
        /* SIDEBAR DE CONVERSAS */
        .inbox-sidebar {
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            background: #fafbfc;
        }
        
        .inbox-header {
            padding: 20px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            color: white;
        }
        
        .inbox-header h2 {
            font-size: 20px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .inbox-filters {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .filter-btn {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .filter-btn:hover,
        .filter-btn.active {
            background: white;
            color: var(--primary);
        }
        
        .search-box {
            background: rgba(255,255,255,0.95);
            border: none;
            border-radius: 10px;
            padding: 12px 15px;
            padding-left: 40px;
            color: var(--dark);
            width: 100%;
            font-size: 14px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: 12px center;
        }
        
        .search-box::placeholder {
            color: var(--gray);
        }
        
        .search-box:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(90, 42, 107, 0.2);
        }
        
        /* Lista de Conversas */
        .conversations-list {
            flex: 1;
            overflow-y: auto;
        }
        
        .conversation-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: all 0.2s;
            background: white;
        }
        
        .conversation-item:hover {
            background: var(--lighter);
        }
        
        .conversation-item.active {
            background: rgba(90, 42, 107, 0.08);
            border-left: 4px solid var(--primary);
        }
        
        .conversation-item.unread {
            background: #f0f9ff;
        }
        
        .conversation-item.unread .conversation-name {
            font-weight: 700;
        }
        
        .conversation-avatar {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 18px;
            flex-shrink: 0;
            position: relative;
        }
        
        .conversation-avatar .online-dot {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 12px;
            height: 12px;
            background: var(--success);
            border: 2px solid white;
            border-radius: 50%;
        }
        
        .conversation-info {
            flex: 1;
            min-width: 0;
        }
        
        .conversation-name {
            font-size: 15px;
            font-weight: 600;
            color: var(--dark);
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .conversation-preview {
            font-size: 13px;
            color: var(--gray);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .conversation-preview .check {
            color: var(--info);
            font-size: 14px;
        }
        
        .conversation-meta {
            text-align: right;
            flex-shrink: 0;
        }
        
        .conversation-time {
            font-size: 11px;
            color: var(--gray);
            display: block;
            margin-bottom: 5px;
        }
        
        .unread-badge {
            background: var(--primary);
            color: white;
            border-radius: 12px;
            padding: 3px 8px;
            font-size: 11px;
            font-weight: 700;
            display: inline-block;
        }
        
        /* ÁREA DE CHAT */
        .chat-area {
            display: flex;
            flex-direction: column;
            background: white;
        }
        
        .chat-header {
            background: linear-gradient(135deg, var(--whatsapp) 0%, #128C7E 100%);
            color: white;
            padding: 16px 25px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .chat-header-left {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .chat-header-avatar {
            width: 45px;
            height: 45px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        
        .chat-header-info h3 {
            font-size: 16px;
            margin-bottom: 3px;
        }
        
        .chat-header-info p {
            font-size: 12px;
            opacity: 0.9;
        }
        
        .chat-header-actions {
            display: flex;
            gap: 10px;
        }
        
        .chat-header-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 10px 14px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .chat-header-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        
        /* Mensagens */
        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: #e5ddd5;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4ccc4' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        
        .chat-empty {
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--gray);
            text-align: center;
        }
        
        .chat-empty .icon {
            font-size: 80px;
            margin-bottom: 20px;
            opacity: 0.4;
        }
        
        .chat-empty h3 {
            font-size: 20px;
            color: var(--dark);
            margin-bottom: 10px;
        }
        
        .chat-empty p {
            font-size: 14px;
            max-width: 300px;
            line-height: 1.6;
        }
        
        .chat-date-divider {
            text-align: center;
            margin: 20px 0;
        }
        
        .chat-date-divider span {
            background: rgba(225, 218, 208, 0.9);
            color: var(--gray);
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .chat-message {
            max-width: 65%;
            margin-bottom: 8px;
            padding: 10px 14px;
            border-radius: 10px;
            font-size: 14px;
            line-height: 1.5;
            position: relative;
            word-wrap: break-word;
            animation: messageSlide 0.2s ease;
        }
        
        @keyframes messageSlide {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .chat-message.sent {
            background: #dcf8c6;
            margin-left: auto;
            border-bottom-right-radius: 4px;
        }
        
        .chat-message.received {
            background: white;
            margin-right: auto;
            border-bottom-left-radius: 4px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
        
        .chat-message .message-text {
            margin-bottom: 4px;
        }
        
        .chat-message .message-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 5px;
            font-size: 11px;
            color: #667781;
        }
        
        .chat-message .status-icon {
            font-size: 14px;
        }
        
        .chat-message .status-icon.read {
            color: #53bdeb;
        }
        
        /* Input de Mensagem */
        .chat-input-container {
            padding: 15px 20px;
            background: #f0f2f5;
            border-top: 1px solid var(--border);
        }
        
        .chat-input-wrapper {
            display: flex;
            gap: 12px;
            align-items: flex-end;
        }
        
        .chat-input-actions {
            display: flex;
            gap: 8px;
        }
        
        .chat-action-btn {
            background: transparent;
            border: none;
            color: var(--gray);
            font-size: 22px;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            transition: all 0.2s;
        }
        
        .chat-action-btn:hover {
            background: var(--light);
            color: var(--primary);
        }
        
        .chat-input {
            flex: 1;
            background: white;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px 18px;
            font-size: 15px;
            font-family: inherit;
            resize: none;
            max-height: 120px;
            min-height: 48px;
            line-height: 1.4;
        }
        
        .chat-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(90, 42, 107, 0.1);
        }
        
        .chat-send-btn {
            background: var(--whatsapp);
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            cursor: pointer;
            font-size: 22px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .chat-send-btn:hover {
            background: #20BA5A;
            transform: scale(1.05);
        }
        
        .chat-send-btn:disabled {
            background: var(--gray);
            cursor: not-allowed;
            transform: scale(1);
        }
        
        /* Templates rápidos */
        .quick-templates {
            padding: 10px 20px;
            background: white;
            border-top: 1px solid var(--border);
            display: flex;
            gap: 10px;
            overflow-x: auto;
        }
        
        .quick-template {
            background: var(--lighter);
            border: 1px solid var(--border);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            color: var(--dark);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
        }
        
        .quick-template:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
        
        /* Aviso de conexão */
        .connection-warning {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px 25px;
            text-align: center;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }
        
        .connection-warning a {
            color: var(--primary);
            font-weight: 600;
            text-decoration: none;
        }
        
        .connection-warning a:hover {
            text-decoration: underline;
        }
        
        /* Estado vazio da lista */
        .conversations-empty {
            padding: 50px 20px;
            text-align: center;
            color: var(--gray);
        }
        
        .conversations-empty .icon {
            font-size: 64px;
            display: block;
            margin-bottom: 15px;
            opacity: 0.4;
        }
        
        .conversations-empty h3 {
            font-size: 16px;
            color: var(--dark);
            margin-bottom: 8px;
        }
        
        .conversations-empty p {
            font-size: 13px;
            line-height: 1.6;
        }
        
        /* Typing indicator */
        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 10px 14px;
            background: white;
            border-radius: 10px;
            width: fit-content;
            margin-bottom: 8px;
        }
        
        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--gray);
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        
        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-5px); }
        }
        
        /* Responsive */
        @media (max-width: 900px) {
            .inbox-container {
                grid-template-columns: 1fr;
                height: auto;
            }
            
            .inbox-sidebar {
                max-height: 50vh;
            }
            
            .inbox-sidebar.hidden {
                display: none;
            }
            
            .chat-area.hidden {
                display: none;
            }
            
            .back-btn {
                display: flex !important;
            }
        }
        
        .back-btn {
            display: none;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 8px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 18px;
            margin-right: 10px;
        }
      `}</style>
          <aside className="sidebar" id="sidebar">
              <div className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></div>
              
              <ul className="sidebar-menu">
                  <li>
                      <Link to="/dashboard">
                          <span className="icon icon-dashboard"></span>
                          Painel de Controle
                      </Link>
                  </li>
                  <li>
                      <Link to="/funil">
                          <span className="icon icon-funnel"></span>
                          Funil de Vendas
                      </Link>
                  </li>
                  <li>
                      <Link to="/whatsapp">
                          <span className="icon icon-whatsapp"></span>
                          WhatsApp
                      </Link>
                  </li>
                  <li>
                      <Link to="/conversas" className="active">
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
                      <h1><span className="icon icon-message icon-sm"></span> Conversas</h1>
                      <p>Gerencie suas conversas com leads</p>
                  </div>
              </div>
              
              <div className="connection-warning" id="connection-warning" style={{ display: 'none', marginBottom: '20px', borderRadius: '12px' }}>
                  <span className="icon icon-warning icon-sm"></span>
                  <span>WhatsApp não está conectado.</span>
                  <Link to="/whatsapp">Conectar agora →</Link>
              </div>
              
              <div className="inbox-container">
                  <div className="inbox-sidebar" id="inbox-sidebar">
                      <div className="inbox-header">
                          <h2>
                              <span className="icon icon-inbox icon-sm"></span>
                              Inbox
                          </h2>
                          <div className="inbox-filters">
                              <button className="filter-btn active" onClick={() => globals.filterConversations?.('all')}>Todos</button>
                              <button className="filter-btn" onClick={() => globals.filterConversations?.('unread')}>Não lidos</button>
                          </div>
                          <input type="text" className="search-box" placeholder="Buscar conversa..." id="search-input" onInput={() => globals.searchConversations?.()} />
                      </div>
                      
                      <div className="conversations-list" id="conversations-list">
                      </div>
                  </div>
                  
                  <div className="chat-area" id="chat-area">
                      <div className="chat-header" id="chat-header" style={{ display: 'none' }}>
                          <div className="chat-header-left">
                              <button className="back-btn" onClick={() => globals.showConversationsList?.()}>←</button>
                              <div className="chat-header-avatar" id="chat-avatar"><span className="icon icon-user icon-sm"></span></div>
                              <div className="chat-header-info">
                                  <h3 id="chat-name">Selecione uma conversa</h3>
                                  <p id="chat-phone">-</p>
                              </div>
                          </div>
                          <div className="chat-header-actions">
                              <button className="chat-header-btn" onClick={() => globals.viewLeadDetails?.()}>
                                  <span className="icon icon-user icon-sm"></span>
                                  Ver Lead
                              </button>
                              <button className="chat-header-btn" onClick={() => globals.openWhatsAppWeb?.()}>
                                  <span className="icon icon-link icon-sm"></span>
                                  Abrir no WhatsApp
                              </button>
                          </div>
                      </div>
                      
                      <div className="chat-messages" id="chat-messages">
                          <div className="chat-empty" id="chat-empty">
                              <span className="icon icon-empty icon-lg"></span>
                              <h3>Nenhum chat selecionado</h3>
                              <p>Selecione uma conversa da lista ao lado para começar a conversar</p>
                          </div>
                      </div>
                      
                      <div className="quick-templates" id="quick-templates" style={{ display: 'none' }}>
                          <button className="quick-template" onClick={() => globals.useTemplate?.('Olá! Tudo bem?')}><span className="icon icon-smile icon-sm"></span> Olá!</button>
                          <button className="quick-template" onClick={() => globals.useTemplate?.('Posso te ajudar com mais informações sobre proteção veicular?')}><span className="icon icon-info icon-sm"></span> Mais informações</button>
                          <button className="quick-template" onClick={() => globals.useTemplate?.('Obrigado pelo contato! Qualquer dúvida, estou à disposição.')}><span className="icon icon-check icon-sm"></span> Agradecer</button>
                          <button className="quick-template" onClick={() => globals.useTemplate?.('Vou verificar e te retorno em breve!')}><span className="icon icon-clock icon-sm"></span> Retorno</button>
                      </div>
                      
                      <div className="chat-input-container" id="chat-input-container" style={{ display: 'none' }}>
                          <div className="chat-input-wrapper">
                              <div className="chat-input-actions">
                                  <button className="chat-action-btn" title="Emoji"><span className="icon icon-smile icon-sm"></span></button>
                                  <button className="chat-action-btn" title="Anexar"><span className="icon icon-attachment icon-sm"></span></button>
                              </div>
                              <textarea 
                                  className="chat-input" 
                                  id="message-input" 
                                  placeholder="Digite sua mensagem..." 
                                  rows="1"
                                  onKeydown={(event) => globals.handleKeyDown?.(event as KeyboardEvent)}
                                  onInput={(event) => globals.autoResize?.(event.currentTarget as HTMLTextAreaElement)}
                              ></textarea>
                              <button className="chat-send-btn" id="send-btn" onClick={() => globals.sendMessage?.()}>
                                  <span className="icon icon-send icon-sm"></span>
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </main>
          
          <div className="toast-container" id="toast-container"></div>
          
    </div>
  );
}
