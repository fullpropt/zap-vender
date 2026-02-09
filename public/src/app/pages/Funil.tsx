import { useEffect } from 'react';

import { Link } from 'react-router-dom';
type FunilGlobals = {
  initFunil?: () => void;
  loadFunnel?: () => void;
  toggleView?: () => void;
  filterByStage?: (stage: number | string) => void;
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  openLeadWhatsApp?: () => void;
  saveStagesConfig?: () => void;
  logout?: () => void;
};

export default function Funil() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/funil');

      if (cancelled) return;

      const win = window as Window & FunilGlobals;
      if (typeof win.initFunil === 'function') {
        win.initFunil();
      } else if (typeof (mod as { initFunil?: () => void }).initFunil === 'function') {
        (mod as { initFunil?: () => void }).initFunil?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & FunilGlobals;

  return (
    <div className="funil-react">
      <style>{`
.funnel-visual {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            margin-bottom: 30px;
        }
        .funnel-stage-visual {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 5px 0;
            color: white;
            font-weight: 600;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
        }
        .funnel-stage-visual:hover { transform: scale(1.02); }
        .funnel-stage-visual:nth-child(1) { width: 100%; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 10px 10px 0 0; }
        .funnel-stage-visual:nth-child(2) { width: 85%; background: linear-gradient(135deg, #f093fb, #f5576c); }
        .funnel-stage-visual:nth-child(3) { width: 70%; background: linear-gradient(135deg, #4facfe, #00f2fe); }
        .funnel-stage-visual:nth-child(4) { width: 55%; background: linear-gradient(135deg, #43e97b, #38f9d7); border-radius: 0 0 10px 10px; }
        .funnel-stage-info {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .funnel-stage-count { font-size: 28px; font-weight: 800; }
        .funnel-stage-name { font-size: 14px; opacity: 0.9; }
        .funnel-stage-percent { font-size: 12px; opacity: 0.8; margin-top: 5px; }
        .kanban-container {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            overflow-x: auto;
            padding-bottom: 20px;
        }
        @media (max-width: 1200px) {
            .kanban-container { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
            .kanban-container { grid-template-columns: 1fr; }
        }
        .kanban-column {
            background: var(--gray-100);
            border-radius: var(--border-radius-lg);
            min-height: 400px;
        }
        .kanban-header {
            padding: 15px 20px;
            border-bottom: 3px solid;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .kanban-header.stage-1 { border-color: #667eea; }
        .kanban-header.stage-2 { border-color: #f5576c; }
        .kanban-header.stage-3 { border-color: #4facfe; }
        .kanban-header.stage-4 { border-color: #43e97b; }
        .kanban-title { font-weight: 700; font-size: 14px; }
        .kanban-count {
            background: var(--gray-200);
            padding: 2px 10px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
        }
        .kanban-body {
            padding: 15px;
            max-height: 500px;
            overflow-y: auto;
        }
        .kanban-card {
            background: white;
            border-radius: var(--border-radius);
            padding: 15px;
            margin-bottom: 10px;
            box-shadow: var(--shadow-sm);
            cursor: grab;
            transition: all 0.2s;
        }
        .kanban-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .kanban-card.dragging { opacity: 0.5; }
        .kanban-card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .kanban-card-name { font-weight: 600; font-size: 14px; }
        .kanban-card-phone { font-size: 12px; color: var(--gray-500); }
        .kanban-card-vehicle { font-size: 12px; color: var(--gray-600); margin-top: 5px; }
        .kanban-card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--gray-100);
        }
        .kanban-card-date { font-size: 11px; color: var(--gray-400); }
        .stage-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: var(--gray-50);
            border-radius: var(--border-radius);
            margin-bottom: 10px;
        }
        .stage-color {
            width: 20px;
            height: 20px;
            border-radius: 5px;
        }
        .stage-item-info { flex: 1; }
      `}</style>
      <button className="mobile-menu-toggle" onClick={() => { document.querySelector('.sidebar')?.classList.toggle('open'); document.querySelector('.sidebar-overlay')?.classList.toggle('active'); }}>☰</button>
          <div className="sidebar-overlay"></div>
      
          <aside className="sidebar">
              <div className="sidebar-header">
                  <Link to="/dashboard" className="sidebar-logo">
                      <img src="img/logo-self.png" alt="SELF" /><span>SELF</span>
                  </Link>
              </div>
              <nav className="sidebar-nav">
                  <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
                          <li className="nav-item"><Link to="/transmissao" className="nav-link"><span className="icon icon-broadcast"></span>Transmissão</Link></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/inbox" className="nav-link"><span className="icon icon-inbox"></span>Inbox</Link></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Automação</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/automacao" className="nav-link"><span className="icon icon-automation"></span>Automação</Link></li>
                          <li className="nav-item"><Link to="/fluxos" className="nav-link"><span className="icon icon-flows"></span>Fluxos de Conversa</Link></li>
                          <li className="nav-item"><Link to="/funil" className="nav-link active"><span className="icon icon-funnel"></span>Funil de Vendas</Link></li>
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
                      <h1><span className="icon icon-funnel icon-sm"></span> Funil de Vendas</h1>
                      <p>Visualize e gerencie seu pipeline de vendas</p>
                  </div>
                  <div className="page-actions">
                      <button className="btn btn-outline" onClick={() => globals.loadFunnel?.()}><span className="icon icon-refresh icon-sm"></span> Atualizar</button>
                      <button className="btn btn-outline" onClick={() => globals.toggleView?.()}>
                          <span id="viewIcon"><span className="icon icon-chart-bar icon-sm"></span></span> <span id="viewText">Kanban</span>
                      </button>
                      <button className="btn btn-primary" onClick={() => globals.openModal?.('configModal')}><span className="icon icon-settings icon-sm"></span> Configurar Etapas</button>
                  </div>
              </div>
      
              <div className="funnel-visual" id="funnelVisual">
                  <div className="funnel-stage-visual" onClick={() => globals.filterByStage?.(1)}>
                      <div className="funnel-stage-info">
                          <div className="funnel-stage-count" id="stage1Count">0</div>
                          <div className="funnel-stage-name">Novo</div>
                          <div className="funnel-stage-percent">100%</div>
                      </div>
                  </div>
                  <div className="funnel-stage-visual" onClick={() => globals.filterByStage?.(2)}>
                      <div className="funnel-stage-info">
                          <div className="funnel-stage-count" id="stage2Count">0</div>
                          <div className="funnel-stage-name">Em Andamento</div>
                          <div className="funnel-stage-percent" id="stage2Percent">0%</div>
                      </div>
                  </div>
                  <div className="funnel-stage-visual" onClick={() => globals.filterByStage?.(3)}>
                      <div className="funnel-stage-info">
                          <div className="funnel-stage-count" id="stage3Count">0</div>
                          <div className="funnel-stage-name">Concluído</div>
                          <div className="funnel-stage-percent" id="stage3Percent">0%</div>
                      </div>
                  </div>
                  <div className="funnel-stage-visual" onClick={() => globals.filterByStage?.(4)}>
                      <div className="funnel-stage-info">
                          <div className="funnel-stage-count" id="stage4Count">0</div>
                          <div className="funnel-stage-name">Perdido</div>
                          <div className="funnel-stage-percent" id="stage4Percent">0%</div>
                      </div>
                  </div>
              </div>
      
              <div className="kanban-container" id="kanbanView">
                  <div className="kanban-column" data-stage="1">
                      <div className="kanban-header stage-1">
                          <span className="kanban-title"><span className="icon icon-spark icon-sm"></span> Novo</span>
                          <span className="kanban-count" id="kanban1Count">0</span>
                      </div>
                      <div className="kanban-body" id="kanban1Body"></div>
                  </div>
                  <div className="kanban-column" data-stage="2">
                      <div className="kanban-header stage-2">
                          <span className="kanban-title"><span className="icon icon-clock icon-sm"></span> Em Andamento</span>
                          <span className="kanban-count" id="kanban2Count">0</span>
                      </div>
                      <div className="kanban-body" id="kanban2Body"></div>
                  </div>
                  <div className="kanban-column" data-stage="3">
                      <div className="kanban-header stage-3">
                          <span className="kanban-title"><span className="icon icon-check icon-sm"></span> Concluído</span>
                          <span className="kanban-count" id="kanban3Count">0</span>
                      </div>
                      <div className="kanban-body" id="kanban3Body"></div>
                  </div>
                  <div className="kanban-column" data-stage="4">
                      <div className="kanban-header stage-4">
                          <span className="kanban-title"><span className="icon icon-close icon-sm"></span> Perdido</span>
                          <span className="kanban-count" id="kanban4Count">0</span>
                      </div>
                      <div className="kanban-body" id="kanban4Body"></div>
                  </div>
              </div>
          </main>
      
          <div className="modal-overlay" id="configModal">
              <div className="modal modal-lg">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-settings icon-sm"></span> Configurar Etapas do Funil</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('configModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <p className="text-muted mb-4">Configure as etapas do seu funil de vendas. Cada etapa representa um estágio no processo de conversão.</p>
                      
                      <div id="stagesConfig">
                          <div className="stage-item">
                              <div className="stage-color" style={{ background: '#667eea' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" value="Novo" id="stage1Name" />
                                  <input type="text" className="form-input mt-2" value="Lead recém cadastrado" id="stage1Desc" placeholder="Descrição" />
                              </div>
                          </div>
                          <div className="stage-item">
                              <div className="stage-color" style={{ background: '#f5576c' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" value="Em Andamento" id="stage2Name" />
                                  <input type="text" className="form-input mt-2" value="Em negociação" id="stage2Desc" placeholder="Descrição" />
                              </div>
                          </div>
                          <div className="stage-item">
                              <div className="stage-color" style={{ background: '#4facfe' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" value="Concluído" id="stage3Name" />
                                  <input type="text" className="form-input mt-2" value="Venda realizada" id="stage3Desc" placeholder="Descrição" />
                              </div>
                          </div>
                          <div className="stage-item">
                              <div className="stage-color" style={{ background: '#43e97b' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" value="Perdido" id="stage4Name" />
                                  <input type="text" className="form-input mt-2" value="Não converteu" id="stage4Desc" placeholder="Descrição" />
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('configModal')}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.saveStagesConfig?.()}><span className="icon icon-save icon-sm"></span> Salvar Configurações</button>
                  </div>
              </div>
          </div>
      
          <div className="modal-overlay" id="leadModal">
              <div className="modal">
                  <div className="modal-header">
                      <h3 className="modal-title" id="leadModalTitle"><span className="icon icon-user icon-sm"></span> Detalhes do Lead</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('leadModal')}>×</button>
                  </div>
                  <div className="modal-body" id="leadModalBody"></div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('leadModal')}>Fechar</button>
                      <button className="btn btn-whatsapp" onClick={() => globals.openLeadWhatsApp?.()}><span className="icon icon-whatsapp icon-sm"></span> WhatsApp</button>
                  </div>
              </div>
          </div>
      
    </div>
  );
}
