import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type ConversasV2Globals = {
  initConversasV2?: () => void;
  closeAttachModal?: () => void;
  sendFile?: () => void;
};

export default function ConversasV2() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/conversas-v2');

      if (cancelled) return;

      const win = window as Window & ConversasV2Globals;
      if (typeof win.initConversasV2 === 'function') {
        win.initConversasV2();
      } else if (typeof (mod as { initConversasV2?: () => void }).initConversasV2 === 'function') {
        (mod as { initConversasV2?: () => void }).initConversasV2?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & ConversasV2Globals;

  return (
    <div className="conversas-v2-react">
      <style>{`

      `}</style>
          <nav className="sidebar">
              <div className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></div>
              <ul className="sidebar-menu">
                  <li><Link to="/dashboard"><span className="icon icon-dashboard"></span> Painel de Controle</Link></li>
                  <li><Link to="/funil"><span className="icon icon-funnel"></span> Funil de Vendas</Link></li>
                  <li><Link to="/whatsapp"><span className="icon icon-whatsapp"></span> WhatsApp</Link></li>
                  <li><Link to="/conversas-v2" className="active"><span className="icon icon-message"></span> Conversas</Link></li>
                  <li><Link to="/flow-builder"><span className="icon icon-flows"></span> Fluxos</Link></li>
                  <li><Link to="/configuracoes"><span className="icon icon-settings"></span> Configurações</Link></li>
              </ul>
              <div className="sidebar-footer">
                  <Link to="/login" className="btn-logout">Sair</Link>
              </div>
          </nav>
          
          <main className="main-content">
              <div className="header">
                  <div className="header-title">
                      <h1><span className="icon icon-message icon-sm"></span> Conversas</h1>
                      <p>Gerencie suas conversas com leads</p>
                  </div>
                  <div className="header-actions">
                      <div id="connectionStatus" className="connection-badge disconnected">
                          <span className="dot"></span>
                          <span className="text">Desconectado</span>
                      </div>
                  </div>
              </div>
              
              <div className="chat-container">
                  <div className="conversations-list" id="conversationsList">
                      <div className="conversations-header">
                          <h2><span className="icon icon-inbox icon-sm"></span> Inbox</h2>
                          <div className="conversations-tabs">
                              <button className="tab-btn active" data-filter="all">Todos</button>
                              <button className="tab-btn" data-filter="unread">Não lidos</button>
                              <button className="tab-btn" data-filter="bot">Bot Ativo</button>
                          </div>
                          <div className="search-box">
                              <span className="search-icon icon icon-search icon-sm"></span>
                              <input type="text" id="searchContacts" placeholder="Buscar conversa..." />
                          </div>
                      </div>
                      <div className="contacts-list" id="contactsList">
                      </div>
                  </div>
                  
                  <div className="chat-area" id="chatArea">
                      <div className="empty-state" id="emptyState">
                          <div className="icon icon-empty icon-lg"></div>
                          <h3>Inicie uma conversa</h3>
                          <p>Selecione um contato na lista ao lado para começar a conversar</p>
                      </div>
                      
                      <div className="chat-header" id="chatHeader" style={{ display: 'none' }}>
                          <div className="chat-header-avatar" id="chatAvatar">V</div>
                          <div className="chat-header-info">
                              <div className="chat-header-name" id="chatName">Nome do Contato</div>
                              <div className="chat-header-status" id="chatStatus">Online</div>
                          </div>
                          <div className="chat-header-actions">
                              <button className="btn-icon" id="btnToggleBot" title="Ativar/Desativar Bot">
                                  <span className="icon icon-automation icon-sm"></span>
                              </button>
                              <button className="btn-icon" id="btnViewLead" title="Ver Lead">
                                  <span className="icon icon-user icon-sm"></span>
                              </button>
                              <button className="btn-icon" id="btnOpenWhatsApp" title="Abrir no WhatsApp">
                                  <span className="icon icon-whatsapp icon-sm"></span>
                              </button>
                          </div>
                      </div>
                      
                      <div className="messages-container" id="messagesContainer" style={{ display: 'none' }}>
                      </div>
                      
                      <div className="chat-input-area" id="chatInputArea" style={{ display: 'none' }}>
                          <div className="quick-replies" id="quickReplies">
                              <button className="quick-reply-btn" data-message="Olá! Tudo bem?"><span className="icon icon-smile icon-sm"></span> Olá!</button>
                              <button className="quick-reply-btn" data-message="Vou verificar e te retorno em breve!"><span className="icon icon-info icon-sm"></span> Mais informações</button>
                              <button className="quick-reply-btn" data-message="Obrigado pelo contato!"><span className="icon icon-check icon-sm"></span> Agradecer</button>
                              <button className="quick-reply-btn" data-message="Vou retornar em breve!"><span className="icon icon-clock icon-sm"></span> Retorno</button>
                          </div>
                          <div className="chat-input-wrapper">
                              <div className="chat-input-actions">
                                  <button id="btnEmoji" title="Emoji"><span className="icon icon-smile icon-sm"></span></button>
                                  <button id="btnAttach" title="Anexar arquivo"><span className="icon icon-attachment icon-sm"></span></button>
                                  <button id="btnAudio" title="Gravar áudio"><span className="icon icon-message icon-sm"></span></button>
                              </div>
                              <div className="chat-input-field">
                                  <textarea id="messageInput" placeholder="Digite sua mensagem..." rows="1"></textarea>
                              </div>
                              <button className="send-btn" id="btnSend" disabled>
                                  <span className="icon icon-send icon-sm"></span>
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </main>
          
          <div className="toast-container" id="toastContainer"></div>
          
          <div className="modal-overlay" id="attachModal">
              <div className="modal">
                  <div className="modal-header">
                      <h2><span className="icon icon-attachment icon-sm"></span> Enviar Arquivo</h2>
                      <button className="modal-close" onClick={() => globals.closeAttachModal?.()}>&times;</button>
                  </div>
                  <div className="modal-body">
                      <div className="form-group">
                          <label className="form-label">Selecione o arquivo</label>
                          <input type="file" id="fileInput" className="form-input" accept="image/*,application/pdf,.doc,.docx" />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Legenda (opcional)</label>
                          <input type="text" id="fileCaption" className="form-input" placeholder="Digite uma legenda..." />
                      </div>
                      <div id="filePreview" style={{ marginTop: '15px' }}></div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={() => globals.closeAttachModal?.()}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.sendFile?.()}>Enviar</button>
                  </div>
              </div>
          </div>
          
          <input type="file" id="hiddenFileInput" style={{ display: 'none' }} accept="image/*,application/pdf,.doc,.docx" />
          
    </div>
  );
}
