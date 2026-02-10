import { useEffect } from 'react';

import { Link } from 'react-router-dom';
type CampanhasGlobals = {
  initCampanhas?: () => void;
  loadCampaigns?: () => void;
  openModal?: (id: string) => void;
  openCampaignModal?: () => void;
  openBroadcastModal?: () => void;
  closeModal?: (id: string) => void;
  saveCampaign?: (status: 'active' | 'draft') => void;
  switchCampaignTab?: (tab: string) => void;
  logout?: () => void;
};

export default function Campanhas() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/campanhas');

      if (cancelled) return;

      const win = window as Window & CampanhasGlobals;
      if (typeof win.initCampanhas === 'function') {
        win.initCampanhas();
      } else if (typeof (mod as { initCampanhas?: () => void }).initCampanhas === 'function') {
        (mod as { initCampanhas?: () => void }).initCampanhas?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & CampanhasGlobals;

  return (
    <div className="campanhas-react">
      <style>{`
.campaign-card {
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .campaign-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-lg);
        }
        .campaign-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .campaign-title {
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 5px;
        }
        .campaign-date {
            font-size: 12px;
            color: var(--gray-500);
        }
        .campaign-body {
            padding: 20px;
        }
        .campaign-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        .campaign-stat {
            text-align: center;
            padding: 10px;
            background: var(--gray-50);
            border-radius: var(--border-radius);
        }
        .campaign-stat-value {
            font-size: 20px;
            font-weight: 700;
        }
        .campaign-stat-label {
            font-size: 11px;
            color: var(--gray-500);
            text-transform: uppercase;
        }
        .campaign-progress {
            margin-top: 15px;
        }
        .campaign-footer {
            padding: 15px 20px;
            background: var(--gray-50);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .campaigns-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
      `}</style>
      <button className="mobile-menu-toggle" onClick={() => { document.querySelector('.sidebar')?.classList.toggle('open'); document.querySelector('.sidebar-overlay')?.classList.toggle('active'); }}>☰</button>
          <div className="sidebar-overlay"></div>
      
          <aside className="sidebar">
              <div className="sidebar-header">
                  <Link to="/dashboard" className="sidebar-logo"><span className="brand-text">ZapVender</span></Link>
              </div>
              <nav className="sidebar-nav">
                                    <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link active"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
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
                          <li className="nav-item"><Link to="/automacao" className="nav-link"><span className="icon icon-automation"></span>Automação</Link></li>
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
                      <h1><span className="icon icon-campaigns icon-sm"></span> Campanhas</h1>
                      <p>Gerencie suas campanhas de marketing</p>
                  </div>
                  <div className="page-actions">
                      <button className="btn btn-outline" onClick={() => globals.loadCampaigns?.()}><span className="icon icon-refresh icon-sm"></span> Atualizar</button>
                      <button className="btn btn-outline" onClick={() => globals.openBroadcastModal?.()}><span className="icon icon-broadcast icon-sm"></span> Nova Transmissão</button>
                      <button className="btn btn-primary" onClick={() => (globals.openCampaignModal ? globals.openCampaignModal() : globals.openModal?.('newCampaignModal'))}><span className="icon icon-add icon-sm"></span> Nova Campanha</button>
                  </div>
              </div>
      
              <div className="stats-grid">
                  <div className="stat-card">
                      <div className="stat-icon primary"><span className="icon icon-campaigns"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="totalCampaigns">0</div>
                          <div className="stat-label">Total de Campanhas</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon success"><span className="icon icon-check"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="activeCampaigns">0</div>
                          <div className="stat-label">Ativas</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon info"><span className="icon icon-export"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="totalSent">0</div>
                          <div className="stat-label">Mensagens Enviadas</div>
                      </div>
                  </div>
                  <div className="stat-card">
                      <div className="stat-icon warning"><span className="icon icon-chart-bar"></span></div>
                      <div className="stat-content">
                          <div className="stat-value" id="avgResponse">0%</div>
                          <div className="stat-label">Taxa de Resposta</div>
                      </div>
                  </div>
              </div>
      
              <div className="campaigns-grid" id="campaignsList">
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <div className="empty-state-icon icon icon-empty icon-lg"></div>
                      <p>Carregando campanhas...</p>
                  </div>
              </div>
          </main>
      
          <div className="modal-overlay" id="newCampaignModal">
              <div className="modal modal-lg">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Nova Campanha</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('newCampaignModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <form id="campaignForm">
                          <input type="hidden" id="campaignId" />
                          <div className="form-group">
                              <label className="form-label required">Nome da Campanha</label>
                              <input type="text" className="form-input" id="campaignName" required placeholder="Ex: Promoção Janeiro" />
                          </div>
                          
                          <div className="form-group">
                              <label className="form-label">Descrição</label>
                              <textarea className="form-textarea" id="campaignDescription" rows="2" placeholder="Descreva o objetivo da campanha"></textarea>
                          </div>
      
                          <div className="form-row">
                              <div className="form-group">
                                  <label className="form-label">Tipo</label>
                                  <select className="form-select" id="campaignType">
                                      <option value="broadcast">Transmissão Única</option>
                                      <option value="drip">Sequência (Drip)</option>
                                      <option value="trigger">Gatilho</option>
                                  </select>
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Status</label>
                                  <select className="form-select" id="campaignStatus">
                                      <option value="draft">Rascunho</option>
                                      <option value="active">Ativa</option>
                                      <option value="paused">Pausada</option>
                                  </select>
                              </div>
                          </div>
      
                          <div className="form-group">
                              <label className="form-label">Segmentação</label>
                              <select className="form-select" id="campaignSegment">
                                  <option value="all">Todos os Contatos</option>
                                  <option value="new">Novos (Etapa 1)</option>
                                  <option value="progress">Em Andamento (Etapa 2)</option>
                                  <option value="concluded">Concluídos (Etapa 3)</option>
                              </select>
                          </div>
      
                          <div className="form-group">
                              <label className="form-label required">Mensagem</label>
                              <textarea className="form-textarea" id="campaignMessage" rows="5" placeholder="Digite a mensagem da campanha...
      
      Variáveis disponíveis:
      {{nome}} - Nome do contato
      {{veiculo}} - Veículo
      {{placa}} - Placa"></textarea>
                          </div>
      
                          <div className="form-row">
                              <div className="form-group">
                                  <label className="form-label">Intervalo entre envios</label>
                                  <select className="form-select" id="campaignDelay" defaultValue="5000">
                                      <option value="3000">3 segundos</option>
                                      <option value="5000">5 segundos</option>
                                      <option value="10000">10 segundos</option>
                                      <option value="30000">30 segundos</option>
                                  </select>
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Início</label>
                                  <input type="datetime-local" className="form-input" id="campaignStart" />
                              </div>
                          </div>
                      </form>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('newCampaignModal')}>Cancelar</button>
                      <button className="btn btn-outline" onClick={() => globals.saveCampaign?.('draft')}><span className="icon icon-save icon-sm"></span> Salvar Rascunho</button>
                      <button className="btn btn-primary" onClick={() => globals.saveCampaign?.('active')}><span className="icon icon-rocket icon-sm"></span> Criar e Ativar</button>
                  </div>
              </div>
          </div>
      
          <div className="modal-overlay" id="campaignDetailsModal">
              <div className="modal modal-lg">
                  <div className="modal-header">
                      <h3 className="modal-title" id="detailsTitle"><span className="icon icon-campaigns icon-sm"></span> Detalhes da Campanha</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('campaignDetailsModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <div className="tabs">
                          <button className="tab active" onClick={() => globals.switchCampaignTab?.('overview')}><span className="icon icon-chart-bar icon-sm"></span> Visão Geral</button>
                          <button className="tab" onClick={() => globals.switchCampaignTab?.('messages')}><span className="icon icon-message icon-sm"></span> Mensagens</button>
                          <button className="tab" onClick={() => globals.switchCampaignTab?.('recipients')}><span className="icon icon-contacts icon-sm"></span> Destinatários</button>
                      </div>
                      
                      <div className="tab-content active" id="tab-overview">
                          <div id="campaignOverview"></div>
                      </div>
                      
                      <div className="tab-content" id="tab-messages">
                          <div id="campaignMessages"></div>
                      </div>
                      
                      <div className="tab-content" id="tab-recipients">
                          <div id="campaignRecipients"></div>
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('campaignDetailsModal')}>Fechar</button>
                      <button className="btn btn-primary" id="campaignActionBtn"><span className="icon icon-play icon-sm"></span> Iniciar</button>
                  </div>
              </div>
          </div>
      
    </div>
  );
}
