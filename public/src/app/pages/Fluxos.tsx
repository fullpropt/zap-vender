import { useEffect } from 'react';

type FluxosGlobals = {
  initFluxos?: () => void;
  loadFlows?: () => void;
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  addStep?: () => void;
  removeStep?: (index: number) => void;
  saveFlow?: () => void;
  saveFlowChanges?: () => void;
  logout?: () => void;
};

export default function Fluxos() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/fluxos');

      if (cancelled) return;

      const win = window as Window & FluxosGlobals;
      if (typeof win.initFluxos === 'function') {
        win.initFluxos();
      } else if (typeof (mod as { initFluxos?: () => void }).initFluxos === 'function') {
        (mod as { initFluxos?: () => void }).initFluxos?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & FluxosGlobals;

  return (
    <div className="fluxos-react">
      <style>{`
.flows-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
        .flow-card {
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            overflow: hidden;
            transition: all 0.2s;
        }
        .flow-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .flow-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .flow-title { font-size: 18px; font-weight: 700; margin: 0 0 5px; }
        .flow-description { font-size: 13px; color: var(--gray-500); }
        .flow-body { padding: 20px; }
        .flow-steps {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .flow-step {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: var(--gray-50);
            border-radius: var(--border-radius);
            font-size: 13px;
        }
        .flow-step-number {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        }
        .flow-step-connector {
            width: 2px;
            height: 15px;
            background: var(--gray-300);
            margin-left: 11px;
        }
        .flow-footer {
            padding: 15px 20px;
            background: var(--gray-50);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .flow-stats {
            display: flex;
            gap: 20px;
            font-size: 12px;
            color: var(--gray-500);
        }
        .flow-stat strong { color: var(--gray-700); }
        .flow-editor {
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-lg);
            min-height: 500px;
        }
        .flow-editor-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .flow-editor-body {
            padding: 20px;
        }
        .step-item {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            align-items: flex-start;
        }
        .step-item-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            flex-shrink: 0;
        }
        .step-item-content {
            flex: 1;
            background: var(--gray-50);
            border-radius: var(--border-radius);
            padding: 15px;
        }
        .step-item-actions {
            display: flex;
            gap: 5px;
        }
      `}</style>
      <button className="mobile-menu-toggle" onClick={() => { document.querySelector('.sidebar')?.classList.toggle('open'); document.querySelector('.sidebar-overlay')?.classList.toggle('active'); }}>☰</button>
          <div className="sidebar-overlay"></div>
      
          <aside className="sidebar">
              <div className="sidebar-header">
                  <a href="app.html#/dashboard" className="sidebar-logo">
                      <img src="img/logo-self.png" alt="SELF" /><span>SELF</span>
                  </a>
              </div>
              <nav className="sidebar-nav">
                  <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><a href="app.html#/dashboard" className="nav-link"><span className="icon icon-dashboard"></span>Painel de Controle</a></li>
                          <li className="nav-item"><a href="app.html#/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</a></li>
                          <li className="nav-item"><a href="app.html#/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</a></li>
                          <li className="nav-item"><a href="app.html#/transmissao" className="nav-link"><span className="icon icon-broadcast"></span>Transmissão</a></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><a href="app.html#/inbox" className="nav-link"><span className="icon icon-inbox"></span>Inbox</a></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Automação</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><a href="app.html#/automacao" className="nav-link"><span className="icon icon-automation"></span>Automação</a></li>
                          <li className="nav-item"><a href="app.html#/fluxos" className="nav-link active"><span className="icon icon-flows"></span>Fluxos de Conversa</a></li>
                          <li className="nav-item"><a href="app.html#/funil" className="nav-link"><span className="icon icon-funnel"></span>Funil de Vendas</a></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Sistema</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><a href="app.html#/whatsapp" className="nav-link"><span className="icon icon-whatsapp"></span>WhatsApp</a></li>
                          <li className="nav-item"><a href="app.html#/configuracoes" className="nav-link"><span className="icon icon-settings"></span>Configurações</a></li>
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
                      <h1><span className="icon icon-flows icon-sm"></span> Fluxos de Conversa</h1>
                      <p>Crie sequências de mensagens automáticas</p>
                  </div>
                  <div className="page-actions">
                      <button className="btn btn-outline" onClick={() => globals.loadFlows?.()}><span className="icon icon-refresh icon-sm"></span> Atualizar</button>
                      <button className="btn btn-primary" onClick={() => globals.openModal?.('newFlowModal')}><span className="icon icon-add icon-sm"></span> Novo Fluxo</button>
                  </div>
              </div>
      
              <div className="stats-grid">
                  <div className="stat-card">
                      <div className="stat-icon primary"><span className="icon icon-flows"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="totalFlows">0</div>
                          <div className="stat-label">Total de Fluxos</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon success"><span className="icon icon-check"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="activeFlows">0</div>
                          <div className="stat-label">Ativos</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon info"><span className="icon icon-contacts"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="inFlows">0</div>
                          <div className="stat-label">Leads em Fluxos</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon warning"><span className="icon icon-export"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="sentMessages">0</div>
                          <div className="stat-label">Mensagens Enviadas</div>
                      </div>
                  </div>
              </div>
      
              <div className="flows-grid" id="flowsList">
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <div className="empty-state-icon icon icon-empty icon-lg"></div>
                      <p>Carregando fluxos...</p>
                  </div>
              </div>
          </main>
      
          <div className="modal-overlay" id="newFlowModal">
              <div className="modal modal-lg">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Novo Fluxo de Conversa</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('newFlowModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <form id="flowForm">
                          <div className="form-row">
                              <div className="form-group">
                                  <label className="form-label required">Nome do Fluxo</label>
                                  <input type="text" className="form-input" id="flowName" required placeholder="Ex: Sequência de Boas-vindas" />
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Gatilho</label>
                                  <select className="form-select" id="flowTrigger">
                                      <option value="manual">Manual</option>
                                      <option value="new_lead">Novo Lead</option>
                                      <option value="keyword">Palavra-chave</option>
                                  </select>
                              </div>
                          </div>
                          
                          <div className="form-group">
                              <label className="form-label">Descrição</label>
                              <textarea className="form-textarea" id="flowDescription" rows="2" placeholder="Descreva o objetivo deste fluxo"></textarea>
                          </div>
      
                          <hr style={{ margin: '20px 0' }} />
                          
                          <h4 style={{ marginBottom: '15px' }}><span className="icon icon-list icon-sm"></span> Etapas do Fluxo</h4>
                          
                          <div id="flowSteps">
                              <div className="step-item" data-step="1">
                                  <div className="step-item-number">1</div>
                                  <div className="step-item-content">
                                      <div className="form-group" style={{ marginBottom: '10px' }}>
                                          <label className="form-label">Mensagem</label>
                                          <textarea className="form-textarea step-message" rows="3" placeholder="Olá {{nome}}! Seja bem-vindo..."></textarea>
                                      </div>
                                      <div className="form-row">
                                          <div className="form-group">
                                              <label className="form-label">Aguardar</label>
                                              <select className="form-select step-delay">
                                                  <option value="0">Imediatamente</option>
                                                  <option value="60">1 minuto</option>
                                                  <option value="300">5 minutos</option>
                                                  <option value="3600">1 hora</option>
                                                  <option value="86400">24 horas</option>
                                              </select>
                                          </div>
                                          <div className="form-group">
                                              <label className="form-label">Condição</label>
                                              <select className="form-select step-condition">
                                                  <option value="always">Sempre enviar</option>
                                                  <option value="no_reply">Se não responder</option>
                                                  <option value="replied">Se responder</option>
                                              </select>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="step-item-actions">
                                      <button type="button" className="btn btn-sm btn-outline-danger btn-icon" onClick={() => globals.removeStep?.(1)} title="Remover"><span className="icon icon-delete icon-sm"></span></button>
                                  </div>
                              </div>
                          </div>
                          
                          <button type="button" className="btn btn-outline w-100 mt-3" onClick={() => globals.addStep?.()}>
                              <span className="icon icon-add icon-sm"></span> Adicionar Etapa
                          </button>
                      </form>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('newFlowModal')}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.saveFlow?.()}><span className="icon icon-save icon-sm"></span> Salvar Fluxo</button>
                  </div>
              </div>
          </div>
      
          <div className="modal-overlay" id="flowEditorModal">
              <div className="modal modal-xl">
                  <div className="modal-header">
                      <h3 className="modal-title" id="editorTitle"><span className="icon icon-edit icon-sm"></span> Editor de Fluxo</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('flowEditorModal')}>×</button>
                  </div>
                  <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                      <div id="flowEditorContent"></div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('flowEditorModal')}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.saveFlowChanges?.()}><span className="icon icon-save icon-sm"></span> Salvar Alterações</button>
                  </div>
              </div>
          </div>
      
    </div>
  );
}
