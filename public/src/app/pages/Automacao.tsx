import { useEffect } from 'react';

import { Link } from 'react-router-dom';
type AutomacaoGlobals = {
  initAutomacao?: () => void;
  loadAutomations?: () => void;
  openModal?: (id: string) => void;
  openAutomationModal?: () => void;
  closeModal?: (id: string) => void;
  saveAutomation?: () => void;
  updateActionOptions?: () => void;
  updateTriggerOptions?: () => void;
  logout?: () => void;
};

export default function Automacao() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/automacao');

      if (cancelled) return;

      const win = window as Window & AutomacaoGlobals;
      if (typeof win.initAutomacao === 'function') {
        win.initAutomacao();
      } else if (typeof (mod as { initAutomacao?: () => void }).initAutomacao === 'function') {
        (mod as { initAutomacao?: () => void }).initAutomacao?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & AutomacaoGlobals;

  return (
    <div className="automacao-react">
      <style>{`
.automation-card {
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            overflow: hidden;
            transition: all 0.2s;
        }
        .automation-card:hover { box-shadow: var(--shadow-lg); }
        .automation-header {
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
        }
        .automation-title {
            font-size: 16px;
            font-weight: 700;
            margin: 0;
        }
        .automation-body {
            padding: 20px;
        }
        .automation-trigger {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: var(--gray-50);
            border-radius: var(--border-radius);
            margin-bottom: 15px;
        }
        .automation-trigger-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .automation-trigger-icon.trigger { background: rgba(var(--warning-rgb), 0.2); }
        .automation-trigger-icon.action { background: rgba(var(--success-rgb), 0.2); }
        .automation-arrow {
            text-align: center;
            color: var(--gray-400);
            font-size: 20px;
            margin: 10px 0;
        }
        .automation-footer {
            padding: 15px 20px;
            background: var(--gray-50);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .automations-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
        .toggle-switch {
            position: relative;
            width: 50px;
            height: 26px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--gray-300);
            transition: .3s;
            border-radius: 26px;
        }
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 20px;
            width: 20px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
        }
        input:checked + .toggle-slider {
            background-color: var(--success);
        }
        input:checked + .toggle-slider:before {
            transform: translateX(24px);
        }
      `}</style>
      <button className="mobile-menu-toggle" onClick={() => { document.querySelector('.sidebar')?.classList.toggle('open'); document.querySelector('.sidebar-overlay')?.classList.toggle('active'); }}>☰</button>
          <div className="sidebar-overlay"></div>
      
          <aside className="sidebar">
              <div className="sidebar-header">
                  <Link to="/dashboard" className="sidebar-logo"><img src="img/logo-zapvender.svg" alt="ZapVender" className="brand-logo" /><span className="brand-text">ZapVender</span></Link>
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
                          <li className="nav-item"><Link to="/inbox" className="nav-link"><span className="icon icon-inbox"></span>Inbox<span className="badge" style={{ display: 'none' }}>0</span></Link></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Automação</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/automacao" className="nav-link active"><span className="icon icon-automation"></span>Automação</Link></li>
                          <li className="nav-item"><Link to="/fluxos" className="nav-link"><span className="icon icon-flows"></span>Fluxos de Conversa</Link></li>
                          <li className="nav-item"><Link to="/funil" className="nav-link"><span className="icon icon-funnel"></span>Funil de Vendas</Link></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Sistema</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/whatsapp" className="nav-link"><span className="icon icon-whatsapp"></span>WhatsApp</Link></li>
                          <li className="nav-item"><Link to="/configuracoes" className="nav-link"><span className="icon icon-settings"></span>Configurações</Link></li>
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
              <div className="page-header">
                  <div className="page-title">
                      <h1><span className="icon icon-automation icon-sm"></span> Automação</h1>
                      <p>Configure regras automáticas para seus leads</p>
                  </div>
                  <div className="page-actions">
                      <button className="btn btn-outline" onClick={() => globals.loadAutomations?.()}><span className="icon icon-refresh icon-sm"></span> Atualizar</button>
                      <button className="btn btn-primary" onClick={() => (globals.openAutomationModal ? globals.openAutomationModal() : globals.openModal?.('newAutomationModal'))}><span className="icon icon-add icon-sm"></span> Nova Automação</button>
                  </div>
              </div>
      
              <div className="stats-grid">
                  <div className="stat-card">
                      <div className="stat-icon primary"><span className="icon icon-automation"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="totalAutomations">0</div>
                          <div className="stat-label">Total de Automações</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon success"><span className="icon icon-check"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="activeAutomations">0</div>
                          <div className="stat-label">Ativas</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon info"><span className="icon icon-export"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="totalExecutions">0</div>
                          <div className="stat-label">Execuções (7 dias)</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon warning"><span className="icon icon-bolt"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="lastExecution">-</div>
                          <div className="stat-label">Última Execução</div>
                      </div>
                  </div>
              </div>
      
              <div className="automations-grid" id="automationsList">
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <div className="empty-state-icon icon icon-empty icon-lg"></div>
                      <p>Carregando automações...</p>
                  </div>
              </div>
          </main>
      
          <div className="modal-overlay" id="newAutomationModal">
              <div className="modal modal-lg">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Nova Automação</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('newAutomationModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <form id="automationForm">
                          <input type="hidden" id="automationId" />
                          <div className="form-group">
                              <label className="form-label required">Nome da Automação</label>
                              <input type="text" className="form-input" id="automationName" required placeholder="Ex: Boas-vindas automática" />
                          </div>
                          
                          <div className="form-group">
                              <label className="form-label">Descrição</label>
                              <textarea className="form-textarea" id="automationDescription" rows="2" placeholder="Descreva o que esta automação faz"></textarea>
                          </div>
      
                          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
                          
                          <h4 style={{ marginBottom: '15px' }}><span className="icon icon-bolt icon-sm"></span> Gatilho (Quando executar)</h4>
                          
                          <div className="form-group">
                              <label className="form-label required">Tipo de Gatilho</label>
                              <select className="form-select" id="triggerType" onChange={() => globals.updateTriggerOptions?.()}>
                                  <option value="new_lead">Novo lead cadastrado</option>
                                  <option value="status_change">Mudança de status</option>
                                  <option value="message_received">Mensagem recebida</option>
                                  <option value="keyword">Palavra-chave detectada</option>
                                  <option value="schedule">Agendamento</option>
                                  <option value="inactivity">Inatividade</option>
                              </select>
                          </div>
      
                          <div className="form-group" id="triggerOptionsContainer">
                          </div>
      
                          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
                          
                          <h4 style={{ marginBottom: '15px' }}><span className="icon icon-target icon-sm"></span> Ação (O que fazer)</h4>
                          
                          <div className="form-group">
                              <label className="form-label required">Tipo de Ação</label>
                              <select className="form-select" id="actionType" onChange={() => globals.updateActionOptions?.()}>
                                  <option value="send_message">Enviar mensagem</option>
                                  <option value="change_status">Alterar status</option>
                                  <option value="add_tag">Adicionar tag</option>
                                  <option value="start_flow">Iniciar fluxo</option>
                                  <option value="notify">Notificar equipe</option>
                              </select>
                          </div>
      
                          <div className="form-group" id="actionOptionsContainer">
                          </div>
      
                          <div className="form-group">
                              <label className="form-label">Atraso antes da execução</label>
                              <select className="form-select" id="actionDelay">
                                  <option value="0">Imediatamente</option>
                                  <option value="60">1 minuto</option>
                                  <option value="300">5 minutos</option>
                                  <option value="600">10 minutos</option>
                                  <option value="1800">30 minutos</option>
                                  <option value="3600">1 hora</option>
                                  <option value="86400">24 horas</option>
                              </select>
                          </div>
                      </form>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('newAutomationModal')}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.saveAutomation?.()}><span className="icon icon-save icon-sm"></span> Salvar Automação</button>
                  </div>
              </div>
          </div>
      
    </div>
  );
}
