import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type CampanhasGlobals = {
  initCampanhas?: () => void;
  loadCampaigns?: () => void;
  openModal?: (id: string) => void;
  openCampaignModal?: () => void;
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
            background: var(--surface);
            border: 1px solid var(--border-color);
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
            gap: 10px;
            flex-wrap: wrap;
        }
        .campaign-footer > .badge {
            flex-shrink: 0;
        }
        .campaign-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
            margin-left: auto;
        }
        .campaign-actions .btn {
            flex: 0 0 auto;
        }
        @media (max-width: 900px) {
            .campaign-footer {
                flex-direction: column;
                align-items: center;
            }
            .campaign-footer > .badge {
                margin-bottom: 4px;
            }
            .campaign-actions {
                width: 100%;
                margin-left: 0;
                justify-content: center;
            }
        }
        @media (max-width: 640px) {
            .campaign-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
                padding: 16px;
            }
            .campaign-body {
                padding: 16px;
            }
            .campaign-footer {
                padding: 12px 16px;
            }
            .campaign-stats {
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 10px;
            }
            .campaign-actions {
                gap: 6px;
            }
            .campaign-actions .btn {
                flex: 1 1 calc(50% - 3px);
                min-width: 0;
            }
        }
        @media (max-width: 420px) {
            .campaign-stats {
                grid-template-columns: 1fr;
            }
        }
        .campaigns-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 25px;
        }
        .sender-accounts-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 240px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 8px;
            background: var(--gray-50);
        }
        .campaign-tag-filter {
            position: relative;
        }
        .campaign-tag-filter-toggle {
            width: 100%;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            background: var(--surface);
            color: var(--dark);
            min-height: 42px;
            padding: 10px 38px 10px 12px;
            text-align: left;
            font-size: 14px;
            cursor: pointer;
            position: relative;
        }
        .campaign-tag-filter-toggle::after {
            content: '▾';
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--gray-500);
            font-size: 12px;
        }
        .campaign-tag-filter-menu[hidden] {
            display: none;
        }
        .campaign-tag-filter-menu {
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            right: 0;
            z-index: 40;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            background: var(--surface);
            box-shadow: var(--shadow-lg);
            padding: 10px;
        }
        .campaign-tag-filter-list {
            display: grid;
            gap: 8px;
            max-height: 220px;
            overflow-y: auto;
            margin-top: 10px;
            padding-right: 2px;
        }
        .sender-account-item {
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            background: var(--surface);
            padding: 10px 12px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .sender-account-item.selected {
            border-color: var(--primary);
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent);
        }
        .sender-account-item.disabled {
            opacity: 0.65;
        }
        .sender-account-main {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .sender-account-title {
            font-size: 14px;
            font-weight: 700;
            color: var(--dark);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .sender-account-meta {
            font-size: 12px;
            color: var(--gray-600);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .sender-account-limit {
            font-size: 11px;
            color: var(--gray-600);
            border: 1px solid var(--border-color);
            border-radius: 999px;
            padding: 2px 8px;
            background: var(--gray-50);
            white-space: nowrap;
        }
        .campaign-message-editor {
            position: relative;
        }
        .campaign-message-editor .form-textarea {
            padding-top: 44px;
        }
        .campaign-message-tools {
            position: absolute;
            top: 8px;
            right: 8px;
            z-index: 5;
        }
        .campaign-variable-trigger {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid var(--border-color);
            background: var(--gray-50);
            color: var(--gray-700);
            font-size: 12px;
            font-weight: 600;
            border-radius: 8px;
            padding: 5px 10px;
            cursor: pointer;
        }
        .campaign-variable-trigger:hover {
            border-color: rgba(var(--primary-rgb), 0.45);
            color: var(--dark);
        }
        .campaign-variable-menu[hidden] {
            display: none;
        }
        .campaign-variable-menu {
            position: absolute;
            top: calc(100% + 6px);
            right: 0;
            width: min(300px, 78vw);
            max-height: 260px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            background: var(--surface);
            box-shadow: var(--shadow-lg);
            padding: 8px;
        }
        .campaign-variable-section + .campaign-variable-section {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid var(--border-color);
        }
        .campaign-variable-section-title {
            font-size: 11px;
            font-weight: 700;
            color: var(--gray-600);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 6px;
        }
        .campaign-variable-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .campaign-variable-option {
            width: 100%;
            border: 1px solid transparent;
            border-radius: 8px;
            background: transparent;
            color: var(--dark);
            text-align: left;
            cursor: pointer;
            padding: 6px 8px;
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
        }
        .campaign-variable-option:hover {
            border-color: rgba(var(--primary-rgb), 0.35);
            background: rgba(var(--primary-rgb), 0.08);
        }
        .campaign-variable-token {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
            font-size: 12px;
            font-weight: 700;
            color: var(--primary);
            white-space: nowrap;
        }
        .campaign-variable-label {
            font-size: 12px;
            color: var(--gray-600);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .campaign-variable-empty {
            font-size: 12px;
            color: var(--gray-500);
            margin: 0;
            padding: 2px 0 4px;
        }
        .campaign-variations-panel {
            margin-top: 12px;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            background: color-mix(in srgb, var(--surface) 86%, var(--gray-50) 14%);
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .campaign-variations-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .campaign-variations-title {
            font-size: 13px;
            font-weight: 700;
            color: var(--dark);
            margin: 0;
        }
        .campaign-variations-counter {
            border: 1px solid var(--border-color);
            border-radius: 999px;
            padding: 3px 8px;
            font-size: 11px;
            font-weight: 700;
            color: var(--gray-600);
            background: var(--surface);
            white-space: nowrap;
        }
        .campaign-variations-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .campaign-variations-empty {
            margin: 0;
            font-size: 12px;
            color: var(--gray-500);
        }
        .campaign-variation-card {
            border: 1px solid var(--border-color);
            border-radius: 10px;
            background: var(--surface);
            padding: 10px;
        }
        .campaign-variation-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 8px;
        }
        .campaign-variation-card-title {
            font-size: 12px;
            font-weight: 700;
            color: var(--dark);
            margin: 0;
        }
        .campaign-variation-card-actions {
            display: inline-flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .campaign-variation-action {
            border: 1px solid var(--border-color);
            background: var(--gray-50);
            color: var(--gray-700);
            border-radius: 7px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
        }
        .campaign-variation-action:hover {
            border-color: rgba(var(--primary-rgb), 0.4);
            color: var(--dark);
        }
        .campaign-variation-action.danger:hover {
            border-color: rgba(var(--danger-rgb, 220, 38, 38), 0.35);
            color: var(--danger);
        }
        .campaign-variation-card-preview {
            margin: 0;
            color: var(--gray-700);
            font-size: 13px;
            line-height: 1.45;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .campaign-variation-editor[hidden] {
            display: none;
        }
        .campaign-variation-editor .form-textarea {
            min-height: 120px;
            resize: vertical;
        }
        .campaign-variation-editor-actions {
            margin-top: 8px;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
        }
        .campaign-variation-create-btn {
            align-self: flex-start;
        }
        .campaign-variation-create-btn[disabled] {
            opacity: 0.6;
            cursor: not-allowed;
        }
        @media (max-width: 640px) {
            .campaign-variations-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .campaign-variation-card-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .campaign-variation-editor-actions {
                width: 100%;
                justify-content: stretch;
            }
            .campaign-variation-editor-actions .btn {
                flex: 1 1 auto;
                width: 100%;
            }
        }
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
                      <div className="empty-state-icon icon icon-campaigns icon-lg"></div>
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
                                  </select>
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Distribuição</label>
                                  <select className="form-select" id="campaignDistributionStrategy">
                                      <option value="single">Conta única</option>
                                      <option value="round_robin">Round-robin</option>
                                      <option value="weighted_round_robin">Round-robin por peso</option>
                                      <option value="random">Aleatório</option>
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
                                  <option value="lost">Perdidos (Etapa 4)</option>
                              </select>
                          </div>

                          <div className="form-group">
                              <label className="form-label">Filtrar por Tag (opcional)</label>
                              <div className="campaign-tag-filter">
                                  <button
                                      type="button"
                                      className="campaign-tag-filter-toggle"
                                      id="campaignTagFilterToggle"
                                      aria-haspopup="true"
                                      aria-expanded="false"
                                  >
                                      Todas as tags
                                  </button>
                                  <div className="campaign-tag-filter-menu" id="campaignTagFilterMenu" hidden>
                                      <label className="checkbox-wrapper" style={{ marginBottom: 0 }}>
                                          <input type="checkbox" id="campaignAllTags" defaultChecked />
                                          <span className="checkbox-custom"></span>
                                          Todas as tags
                                      </label>
                                      <div className="campaign-tag-filter-list" id="campaignTagFilterList">
                                          <p style={{ color: 'var(--gray-500)', fontSize: '12px', margin: 0 }}>Carregando tags...</p>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="form-group">
                              <label className="form-label">Contas de Envio (WhatsApp)</label>
                              <div id="campaignSenderAccounts" className="sender-accounts-grid">
                                  <p style={{ color: 'var(--gray-500)', margin: 0 }}>Carregando contas...</p>
                              </div>
                              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
                                  Se nenhuma conta for marcada, a campanha usa automaticamente as contas habilitadas em Configurações &gt; Contas.
                              </p>
                          </div>
      

                          <div className="form-group">
                              <label className="form-label required">Mensagem</label>
                              <div className="campaign-message-editor">
                                  <textarea className="form-textarea" id="campaignMessage" rows="5" placeholder="Digite a mensagem da campanha..."></textarea>
                                  <div className="campaign-message-tools">
                                      <button
                                          type="button"
                                          className="campaign-variable-trigger"
                                          id="campaignMessageVariableToggle"
                                          aria-haspopup="true"
                                          aria-expanded="false"
                                          title="Inserir tag na mensagem"
                                      >
                                          <span className="icon icon-tag icon-sm"></span>
                                          Inserir tag
                                      </button>
                                      <div className="campaign-variable-menu" id="campaignMessageVariableMenu" hidden>
                                          <div className="campaign-variable-section">
                                              <div className="campaign-variable-section-title">Fixas</div>
                                              <div className="campaign-variable-list" id="campaignMessageVariableFixedList"></div>
                                          </div>
                                          <div className="campaign-variable-section">
                                              <div className="campaign-variable-section-title">Personalizadas</div>
                                              <div className="campaign-variable-list" id="campaignMessageVariableCustomList"></div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="campaign-variations-panel">
                                  <div className="campaign-variations-header">
                                      <div>
                                          <p className="campaign-variations-title">Variações</p>
                                      </div>
                                      <span className="campaign-variations-counter" id="campaignMessageVariationsCounter">0/10</span>
                                  </div>

                                  <div className="campaign-variations-list" id="campaignMessageVariationsList"></div>

                                  <div className="campaign-variation-editor" id="campaignMessageVariationEditor" hidden>
                                      <textarea
                                          className="form-textarea campaign-message-variation-input"
                                          id="campaignMessageVariationDraft"
                                          rows={4}
                                          placeholder="Digite a variação da mensagem..."
                                      ></textarea>
                                      <div className="campaign-variation-editor-actions">
                                          <button type="button" className="btn btn-outline" id="campaignCancelVariationBtn">Cancelar</button>
                                          <button type="button" className="btn btn-primary" id="campaignSaveVariationBtn"><span className="icon icon-save icon-sm"></span> Salvar variação</button>
                                      </div>
                                  </div>

                                  <button type="button" className="btn btn-outline campaign-variation-create-btn" id="campaignCreateVariationBtn"><span className="icon icon-add icon-sm"></span> Criar variação</button>
                              </div>
                          </div>
      
                          <div className="form-row">
                              <div className="form-group">
                                  <label className="form-label">Intervalo entre envios (aleatório)</label>
                                  <div className="form-row">
                                      <div className="form-group" style={{ marginBottom: 0 }}>
                                          <input type="number" min={1} step={1} className="form-input" id="campaignDelayMin" defaultValue="5" placeholder="Mínimo (s)" />
                                      </div>
                                      <div className="form-group" style={{ marginBottom: 0 }}>
                                          <input type="number" min={1} step={1} className="form-input" id="campaignDelayMax" defaultValue="15" placeholder="Máximo (s)" />
                                      </div>
                                  </div>
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Início</label>
                                  <input type="datetime-local" className="form-input" id="campaignStart" />
                              </div>
                          </div>
                          <div className="form-group">
                              <label className="form-label">Horário de envio</label>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 13 }}>
                                  <input type="checkbox" id="campaignSendWindowEnabled" />
                                  <span>Limitar disparos por horário</span>
                              </label>
                              <div className="form-row">
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                      <input type="time" className="form-input" id="campaignSendWindowStart" defaultValue="08:00" />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                      <input type="time" className="form-input" id="campaignSendWindowEnd" defaultValue="18:00" />
                                  </div>
                              </div>
                              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--gray-500)' }}>
                                  Ex.: 08:00 às 18:00. Fora desse intervalo, a campanha pausa e continua no próximo dia.
                              </p>
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

