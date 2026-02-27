import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type FunilGlobals = {
  initFunil?: () => void;
  loadFunnel?: (options?: { forceRefresh?: boolean; silent?: boolean }) => void;
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
            width: min(100%, 760px);
            margin: 0 auto 24px;
            padding: 20px 16px 16px;
            background: linear-gradient(
                180deg,
                rgba(var(--primary-rgb), 0.08) 0%,
                rgba(15, 23, 42, 0.14) 100%
            );
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            gap: 8px;
        }
        .funnel-stage-visual {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 64px;
            padding: 10px 14px;
            margin: 0;
            color: var(--dark);
            font-weight: 600;
            text-align: center;
            cursor: pointer;
            transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
            position: relative;
            border: 1px solid rgba(var(--primary-rgb), 0.22);
            background: rgba(15, 23, 42, 0.18);
        }
        .funnel-stage-visual:hover {
            transform: translateY(-1px);
            border-color: rgba(var(--primary-rgb), 0.45);
            background: rgba(var(--primary-rgb), 0.08);
        }
        .funnel-stage-visual:nth-child(1) {
            width: 100%;
            border-radius: 10px 10px 4px 4px;
            background: rgba(var(--primary-rgb), 0.16);
        }
        .funnel-stage-visual:nth-child(2) {
            width: 92%;
            background: rgba(var(--primary-rgb), 0.12);
        }
        .funnel-stage-visual:nth-child(3) {
            width: 84%;
            background: rgba(var(--primary-rgb), 0.09);
        }
        .funnel-stage-visual:nth-child(4) {
            width: 76%;
            border-radius: 4px 4px 10px 10px;
            background: rgba(var(--primary-rgb), 0.06);
        }
        .funnel-stage-info {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .funnel-stage-count {
            font-size: 22px;
            font-weight: 800;
            line-height: 1;
        }
        .funnel-stage-name {
            font-size: 13px;
            color: var(--gray-800);
            margin-top: 4px;
        }
        .funnel-stage-percent {
            font-size: 11px;
            color: var(--gray-600);
            margin-top: 2px;
        }
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
            .funnel-visual {
                width: 100%;
                padding: 14px 10px 12px;
            }
            .funnel-stage-visual {
                min-height: 56px;
                padding: 8px 10px;
            }
            .funnel-stage-visual:nth-child(1) { width: 100%; }
            .funnel-stage-visual:nth-child(2) { width: 95%; }
            .funnel-stage-visual:nth-child(3) { width: 90%; }
            .funnel-stage-visual:nth-child(4) { width: 85%; }
            .funnel-stage-count { font-size: 18px; }
            .funnel-stage-name { font-size: 12px; }
            .funnel-stage-percent { font-size: 10px; }
        }
        .kanban-column {
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            min-height: 400px;
            display: flex;
            flex-direction: column;
            transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
        }
        .kanban-column.drop-active {
            border-color: rgba(var(--primary-rgb), 0.7);
            box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.22);
            background: rgba(var(--primary-rgb), 0.06);
        }
        .kanban-column.drop-active .kanban-header {
            background: rgba(var(--primary-rgb), 0.15);
        }
        .kanban-header {
            padding: 15px 20px;
            border-bottom: 3px solid;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(var(--primary-rgb), 0.06);
        }
        .kanban-header.stage-1 { border-color: rgba(var(--primary-rgb), 0.9); }
        .kanban-header.stage-2 { border-color: rgba(var(--primary-rgb), 0.72); }
        .kanban-header.stage-3 { border-color: rgba(var(--primary-rgb), 0.56); }
        .kanban-header.stage-4 { border-color: rgba(var(--primary-rgb), 0.38); }
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
            max-height: 560px;
            min-height: 340px;
            flex: 1;
            overflow-y: auto;
            transition: background-color 0.16s ease;
        }
        .kanban-column.drop-active .kanban-body {
            background: rgba(var(--primary-rgb), 0.09);
        }
        .kanban-card {
            background: var(--surface-muted);
            border: 1px solid var(--border-color);
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
            width: 16px;
            height: 16px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.4);
        }
        .stage-item-info { flex: 1; }
      `}</style>
      <button className="mobile-menu-toggle" onClick={() => { document.querySelector('.sidebar')?.classList.toggle('open'); document.querySelector('.sidebar-overlay')?.classList.toggle('active'); }}>☰</button>
          <div className="sidebar-overlay"></div>
      
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
                      <button className="btn btn-outline" onClick={() => globals.loadFunnel?.({ forceRefresh: true })}><span className="icon icon-refresh icon-sm"></span> Atualizar</button>
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
                          <div className="funnel-stage-name" id="stage1Label">Novo</div>
                          <div className="funnel-stage-percent">100%</div>
                      </div>
                  </div>
                  <div className="funnel-stage-visual" onClick={() => globals.filterByStage?.(2)}>
                      <div className="funnel-stage-info">
                          <div className="funnel-stage-count" id="stage2Count">0</div>
                          <div className="funnel-stage-name" id="stage2Label">Em Andamento</div>
                          <div className="funnel-stage-percent" id="stage2Percent">0%</div>
                      </div>
                  </div>
                  <div className="funnel-stage-visual" onClick={() => globals.filterByStage?.(3)}>
                      <div className="funnel-stage-info">
                          <div className="funnel-stage-count" id="stage3Count">0</div>
                          <div className="funnel-stage-name" id="stage3Label">Concluído</div>
                          <div className="funnel-stage-percent" id="stage3Percent">0%</div>
                      </div>
                  </div>
                  <div className="funnel-stage-visual" onClick={() => globals.filterByStage?.(4)}>
                      <div className="funnel-stage-info">
                          <div className="funnel-stage-count" id="stage4Count">0</div>
                          <div className="funnel-stage-name" id="stage4Label">Perdido</div>
                          <div className="funnel-stage-percent" id="stage4Percent">0%</div>
                      </div>
                  </div>
              </div>
      
              <div className="kanban-container" id="kanbanView">
                  <div className="kanban-column" data-stage="1">
                      <div className="kanban-header stage-1">
                          <span className="kanban-title"><span className="icon icon-spark icon-sm"></span> <span id="kanbanStage1Label">Novo</span></span>
                          <span className="kanban-count" id="kanban1Count">0</span>
                      </div>
                      <div className="kanban-body" id="kanban1Body"></div>
                  </div>
                  <div className="kanban-column" data-stage="2">
                      <div className="kanban-header stage-2">
                          <span className="kanban-title"><span className="icon icon-clock icon-sm"></span> <span id="kanbanStage2Label">Em Andamento</span></span>
                          <span className="kanban-count" id="kanban2Count">0</span>
                      </div>
                      <div className="kanban-body" id="kanban2Body"></div>
                  </div>
                  <div className="kanban-column" data-stage="3">
                      <div className="kanban-header stage-3">
                          <span className="kanban-title"><span className="icon icon-check icon-sm"></span> <span id="kanbanStage3Label">Concluído</span></span>
                          <span className="kanban-count" id="kanban3Count">0</span>
                      </div>
                      <div className="kanban-body" id="kanban3Body"></div>
                  </div>
                  <div className="kanban-column" data-stage="4">
                      <div className="kanban-header stage-4">
                          <span className="kanban-title"><span className="icon icon-close icon-sm"></span> <span id="kanbanStage4Label">Perdido</span></span>
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
                              <div className="stage-color" style={{ background: 'rgba(var(--primary-rgb), 0.95)' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" defaultValue="Novo" id="stage1Name" />
                                  <input type="text" className="form-input mt-2" defaultValue="Lead recém cadastrado" id="stage1Desc" placeholder="Descrição" />
                              </div>
                          </div>
                          <div className="stage-item">
                              <div className="stage-color" style={{ background: 'rgba(var(--primary-rgb), 0.75)' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" defaultValue="Em Andamento" id="stage2Name" />
                                  <input type="text" className="form-input mt-2" defaultValue="Em negociação" id="stage2Desc" placeholder="Descrição" />
                              </div>
                          </div>
                          <div className="stage-item">
                              <div className="stage-color" style={{ background: 'rgba(var(--primary-rgb), 0.55)' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" defaultValue="Concluído" id="stage3Name" />
                                  <input type="text" className="form-input mt-2" defaultValue="Venda realizada" id="stage3Desc" placeholder="Descrição" />
                              </div>
                          </div>
                          <div className="stage-item">
                              <div className="stage-color" style={{ background: 'rgba(var(--primary-rgb), 0.35)' }}></div>
                              <div className="stage-item-info">
                                  <input type="text" className="form-input" defaultValue="Perdido" id="stage4Name" />
                                  <input type="text" className="form-input mt-2" defaultValue="Não converteu" id="stage4Desc" placeholder="Descrição" />
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
