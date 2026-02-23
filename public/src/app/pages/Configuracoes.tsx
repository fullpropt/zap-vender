import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type ConfiguracoesGlobals = {
  initConfiguracoes?: () => void;
  showPanel?: (panel: string) => void;
  saveGeneralSettings?: () => void;
  saveFunnelSettings?: () => void;
  saveCopysSettings?: () => void;
  insertVariable?: (value: string) => void;
  saveNewTemplate?: () => void;
  saveTemplate?: (id: number) => void;
  deleteTemplate?: (id: number) => void;
  replaceTemplateAudio?: (id: number, event: Event) => void;
  updateNewTemplateForm?: () => void;
  connectWhatsApp?: () => void;
  disconnectWhatsApp?: () => void;
  refreshWhatsAppAccounts?: () => Promise<void>;
  saveWhatsAppSessionName?: (sessionId: string) => Promise<void>;
  removeWhatsAppSession?: (sessionId: string) => Promise<void>;
  saveWhatsAppSettings?: () => void;
  saveBusinessHoursSettings?: () => void;
  saveNotificationSettings?: () => Promise<void>;
  createContactField?: () => Promise<void>;
  updateContactField?: (key: string) => Promise<void>;
  deleteContactField?: (key: string) => Promise<void>;
  createSettingsTag?: () => Promise<void>;
  updateSettingsTag?: (id: number) => Promise<void>;
  deleteSettingsTag?: (id: number) => Promise<void>;
  loadUsers?: () => Promise<void>;
  addUser?: () => Promise<void>;
  openEditUserModal?: (id: number) => void;
  updateUser?: () => Promise<void>;
  changePassword?: () => Promise<void>;
  copyApiKey?: () => void;
  regenerateApiKey?: () => void;
  testWebhook?: () => void;
  saveApiSettings?: () => void;
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  logout?: () => void;
};

export default function Configuracoes() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/configuracoes');

      if (cancelled) return;

      const win = window as Window & ConfiguracoesGlobals;
      if (typeof win.initConfiguracoes === 'function') {
        win.initConfiguracoes();
      } else if (typeof (mod as { initConfiguracoes?: () => void }).initConfiguracoes === 'function') {
        (mod as { initConfiguracoes?: () => void }).initConfiguracoes?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & ConfiguracoesGlobals;

  return (
    <div className="configuracoes-react">
      <style>{`
.settings-container {
            display: grid;
            grid-template-columns: 250px 1fr;
            gap: 30px;
        }
        @media (max-width: 768px) {
            .settings-container { grid-template-columns: 1fr; }
        }
        .settings-nav {
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            padding: 20px;
            height: fit-content;
            position: sticky;
            top: 20px;
        }
        .settings-nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all 0.2s;
            margin-bottom: 5px;
            color: var(--gray-800);
        }
        .settings-nav-item:hover { background: var(--gray-50); color: var(--dark); }
        .settings-nav-item.active { background: rgba(var(--primary-rgb), 0.16); color: #eafff4; font-weight: 700; border: 1px solid rgba(var(--primary-rgb), 0.35); }
        .settings-panel {
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            padding: 30px;
            display: none;
        }
        .settings-panel.active { display: block; }
        .settings-section {
            margin-bottom: 30px;
            padding-bottom: 30px;
            border-bottom: 1px solid var(--border-color);
        }
        .settings-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .settings-section-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .copy-card {
            background: var(--gray-50);
            border-radius: var(--border-radius);
            padding: 20px;
            margin-bottom: 15px;
        }
        .copy-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .copy-card-title { font-weight: 600; }
        .copy-card-actions { display: flex; gap: 10px; }
        .variable-tag {
            display: inline-block;
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 12px;
            margin: 3px;
            cursor: pointer;
        }
        .variable-tag:hover { background: rgba(var(--primary-rgb), 0.2); }
        .connection-status-card { background: var(--surface-muted); border-radius: var(--border-radius); padding: 30px; border: 1px solid var(--border-color); }
        .connection-icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; margin-bottom: 20px; }
        .connection-icon.success { background: #10b981; color: white; }
        .connection-icon.disconnected { background: var(--gray-200); color: var(--gray-800); }
        .connection-status-card h4 { margin: 0 0 12px; font-size: 20px; }
        .connection-status-card p { margin: 0 0 12px; color: var(--gray-800); line-height: 1.5; }
        .connection-info { font-size: 13px; color: var(--gray-700); background: var(--gray-50); padding: 15px; border-radius: 8px; margin: 15px 0 !important; border: 1px solid var(--border-color); }
        .connection-accounts-list {
            display: grid;
            gap: 12px;
        }
        .connection-account-item {
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 14px;
            background: var(--gray-50);
        }
        .connection-account-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .connection-account-session {
            font-size: 12px;
            color: var(--gray-700);
            word-break: break-word;
        }
        .connection-status-pill {
            border-radius: 999px;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid transparent;
            white-space: nowrap;
        }
        .connection-status-pill.connected {
            color: #166534;
            background: rgba(16, 185, 129, 0.16);
            border-color: rgba(16, 185, 129, 0.3);
        }
        .connection-status-pill.disconnected {
            color: #7f1d1d;
            background: rgba(239, 68, 68, 0.12);
            border-color: rgba(239, 68, 68, 0.25);
        }
        .connection-account-body {
            display: grid;
            grid-template-columns: minmax(220px, 1fr) 120px 170px auto auto;
            gap: 10px;
            align-items: end;
        }
        .connection-account-body .form-group {
            margin-bottom: 0;
        }
        .connection-account-body .btn {
            width: auto;
            white-space: nowrap;
        }
        .connection-account-inline-field .form-label {
            font-size: 11px;
            margin-bottom: 6px;
        }
        .connection-campaign-toggle {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--gray-700);
            white-space: nowrap;
            padding-bottom: 9px;
        }
        .connection-campaign-toggle input {
            width: 16px;
            height: 16px;
        }
        @media (max-width: 768px) {
            .connection-account-body {
                grid-template-columns: 1fr;
            }
            .connection-account-body .btn {
                width: 100%;
            }
        }
      `}</style>
      <button className="mobile-menu-toggle" type="button" onClick={() => { document.querySelector('.sidebar')?.classList.toggle('open'); document.querySelector('.sidebar-overlay')?.classList.toggle('active'); }}>☰</button>
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
                          <li className="nav-item"><Link to="/funil" className="nav-link"><span className="icon icon-funnel"></span>Funil de Vendas</Link></li>
                      </ul>
                  </div>
                  <div className="nav-section">
                      <div className="nav-section-title">Sistema</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/whatsapp" className="nav-link"><span className="icon icon-whatsapp"></span>WhatsApp</Link></li>
                          <li className="nav-item"><Link to="/configuracoes" className="nav-link active"><span className="icon icon-settings"></span>Configurações</Link></li>
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
                      <h1><span className="icon icon-settings icon-sm"></span> Configurações</h1>
                      <p>Gerencie as configurações do sistema</p>
                  </div>
              </div>
      
              <div className="settings-container">
                  <nav className="settings-nav">
                      <div className="settings-nav-item active" onClick={() => globals.showPanel?.('conexao')}><span className="icon icon-whatsapp icon-sm"></span> Contas</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('general')}><span className="icon icon-building icon-sm"></span> Campos</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('contact-fields')}><span className="icon icon-contacts icon-sm"></span> Campos Dinâmicos</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('labels')}><span className="icon icon-tag icon-sm"></span> Etiquetas</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('quick')}><span className="icon icon-bolt icon-sm"></span> Respostas rápidas</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('hours')}><span className="icon icon-clock icon-sm"></span> Horários</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('flows')}><span className="icon icon-flows icon-sm"></span> Fluxos Padrões</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('funnel')}><span className="icon icon-funnel icon-sm"></span> Funil de Vendas</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('notifications')}><span className="icon icon-bell icon-sm"></span> Notificações</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('users')}><span className="icon icon-user icon-sm"></span> Usuários</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('api')}><span className="icon icon-plug icon-sm"></span> API e Webhooks</div>
                  </nav>
      
                  <div className="settings-panels">
                      <div className="settings-panel active" id="panel-conexao">
                          <h3 className="settings-section-title">Contas</h3>
                          <div className="connection-status-card" id="connectionStatusCard">
                              <h4 style={{ marginTop: 0 }}>Contas WhatsApp</h4>
                              <p className="connection-info">
                                  Gerencie nome de exibição, participação em campanhas, peso e limite diário de cada conta.
                              </p>
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                  <button className="btn btn-outline" onClick={() => globals.refreshWhatsAppAccounts?.()}>Atualizar lista</button>
                                  <Link to="/whatsapp" className="btn btn-primary">Ir para WhatsApp</Link>
                              </div>
                              <div className="connection-accounts-list" id="connectionAccountsList">
                                  <p style={{ color: 'var(--gray-500)', margin: 0 }}>Carregando contas...</p>
                              </div>
                          </div>
                      </div>
      
                      <div className="settings-panel" id="panel-general">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-building icon-sm"></span> Informações da Empresa</h3>
                              <div className="form-group">
                                  <label className="form-label">Nome da Empresa</label>
                                  <input type="text" className="form-input" id="companyName" defaultValue="ZapVender" />
                              </div>
                              <div className="form-row">
                                  <div className="form-group">
                                      <label className="form-label">CNPJ</label>
                                      <input type="text" className="form-input" id="companyCnpj" placeholder="00.000.000/0000-00" />
                                  </div>
                                  <div className="form-group">
                                      <label className="form-label">Telefone</label>
                                      <input type="text" className="form-input" id="companyPhone" placeholder="(00) 00000-0000" />
                                  </div>
                              </div>
                              <div className="form-group">
                                  <label className="form-label">E-mail</label>
                                  <input type="email" className="form-input" id="companyEmail" placeholder="contato@empresa.com" />
                              </div>
                          </div>
                          <button className="btn btn-primary" onClick={() => globals.saveGeneralSettings?.()}><span className="icon icon-save icon-sm"></span> Salvar Configurações</button>
                      </div>
      
                      <div className="settings-panel" id="panel-contact-fields">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-contacts icon-sm"></span> Campos Dinâmicos</h3>
                              <p className="text-muted mb-3">Esses campos aparecem no cadastro de contato e viram vari&aacute;veis para respostas r&aacute;pidas.</p>

                              <div className="copy-card">
                                  <div className="copy-card-header">
                                      <span className="copy-card-title">Campos padr&atilde;o (fixos)</span>
                                  </div>
                                  <div id="defaultContactFieldsList"></div>
                              </div>

                              <div className="copy-card" style={{ marginTop: '18px' }}>
                                  <div className="copy-card-header">
                                      <span className="copy-card-title">Novo campo personalizado</span>
                                  </div>
                                  <div className="form-row">
                                      <div className="form-group">
                                          <label className="form-label required">Nome do campo</label>
                                          <input type="text" className="form-input" id="newContactFieldLabel" placeholder="Ex.: Cidade" />
                                      </div>
                                      <div className="form-group">
                                          <label className="form-label">Placeholder</label>
                                          <input type="text" className="form-input" id="newContactFieldPlaceholder" placeholder="Opcional" />
                                      </div>
                                  </div>
                                  <button className="btn btn-primary" onClick={() => globals.createContactField?.()}>
                                      <span className="icon icon-add icon-sm"></span> Adicionar campo
                                  </button>
                              </div>

                              <div className="table-container" style={{ marginTop: '18px' }}>
                                  <table className="data-table">
                                      <thead>
                                          <tr>
                                              <th>Vari&aacute;vel</th>
                                              <th>R&oacute;tulo</th>
                                              <th>Placeholder</th>
                                              <th>{'Ações'}</th>
                                          </tr>
                                      </thead>
                                      <tbody id="contactFieldsTableBody">
                                          <tr>
                                              <td colSpan={4} className="table-empty">
                                                  <div className="table-empty-icon icon icon-empty icon-lg"></div>
                                                  <p>Carregando campos...</p>
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>

                      <div className="settings-panel" id="panel-labels">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-tag icon-sm"></span> Etiquetas</h3>
                              <p className="text-muted mb-3">Gerencie todas as tags usadas em contatos e campanhas.</p>

                              <div className="copy-card">
                                  <div className="copy-card-header">
                                      <span className="copy-card-title">Nova etiqueta</span>
                                  </div>
                                  <div className="form-row">
                                      <div className="form-group">
                                          <label className="form-label required">Nome</label>
                                          <input type="text" className="form-input" id="newTagName" placeholder="Ex.: Lead quente" />
                                      </div>
                                      <div className="form-group" style={{ maxWidth: '140px' }}>
                                          <label className="form-label">Cor</label>
                                          <input type="color" className="form-input" id="newTagColor" defaultValue="#5a2a6b" style={{ height: '45px' }} />
                                      </div>
                                  </div>
                                  <div className="form-group">
                                      <label className="form-label">{'Descrição'}</label>
                                      <input type="text" className="form-input" id="newTagDescription" placeholder="Opcional" />
                                  </div>
                                  <button className="btn btn-primary" onClick={() => globals.createSettingsTag?.()}>
                                      <span className="icon icon-add icon-sm"></span> Adicionar etiqueta
                                  </button>
                              </div>

                              <div className="table-container" style={{ marginTop: '18px' }}>
                                  <table className="data-table">
                                      <thead>
                                          <tr>
                                              <th>Nome</th>
                                              <th>Cor</th>
                                              <th>{'Descrição'}</th>
                                              <th>{'Ações'}</th>
                                          </tr>
                                      </thead>
                                      <tbody id="settingsTagsTableBody">
                                          <tr>
                                              <td colSpan={4} className="table-empty">
                                                  <div className="table-empty-icon icon icon-empty icon-lg"></div>
                                                  <p>Carregando etiquetas...</p>
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>
                      <div className="settings-panel" id="panel-quick">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-bolt icon-sm"></span> Respostas rápidas</h3>
                              <p className="text-muted mb-3">Crie respostas de texto e áudio para usar no Inbox.</p>

                              <div className="mb-4" id="contactVariablesList"></div>

                              <div className="copy-card">
                                  <div className="copy-card-header">
                                      <span className="copy-card-title">Respostas cadastradas</span>
                                  </div>
                                  <div id="templatesList"></div>
                                  <p className="text-muted" id="templatesEmpty" style={{ marginTop: '12px' }}>Nenhuma resposta rápida cadastrada.</p>
                              </div>

                              <button className="btn btn-outline w-100 mt-3" onClick={() => globals.openModal?.('addTemplateModal')}><span className="icon icon-add icon-sm"></span> Nova resposta rápida</button>
                          </div>
                          <button className="btn btn-primary" onClick={() => globals.saveCopysSettings?.()}><span className="icon icon-save icon-sm"></span> Salvar respostas rápidas</button>
                      </div>
                      <div className="settings-panel" id="panel-hours">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-clock icon-sm"></span> Horários de funcionamento</h3>
                              <p className="text-muted mb-3">Defina quando transmissões e campanhas podem enviar mensagens.</p>

                              <div className="copy-card">
                                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <label className="checkbox-wrapper">
                                          <input type="checkbox" id="businessHoursEnabled" />
                                          <span className="checkbox-custom"></span>
                                      </label>
                                      <label className="form-label" htmlFor="businessHoursEnabled" style={{ margin: 0 }}>Ativar controle de horários</label>
                                  </div>

                                  <div className="form-row">
                                      <div className="form-group">
                                          <label className="form-label">Início do expediente</label>
                                          <input type="time" className="form-input" id="businessHoursStart" defaultValue="08:00" />
                                      </div>
                                      <div className="form-group">
                                          <label className="form-label">Fim do expediente</label>
                                          <input type="time" className="form-input" id="businessHoursEnd" defaultValue="18:00" />
                                      </div>
                                  </div>

                                  <div className="form-group">
                                      <label className="form-label">Mensagem automática fora do horário</label>
                                      <textarea
                                          className="form-textarea"
                                          id="outsideHoursAutoReplyMessage"
                                          rows={4}
                                          placeholder="Olá! Nosso atendimento está fora do horário no momento. Retornaremos assim que estivermos online."
                                      ></textarea>
                                      <p className="form-help">Enviada quando receber mensagem fora do expediente.</p>
                                  </div>
                              </div>

                              <button className="btn btn-primary" onClick={() => globals.saveBusinessHoursSettings?.()}>
                                  <span className="icon icon-save icon-sm"></span> Salvar horários
                              </button>
                          </div>
                      </div>
                      <div className="settings-panel" id="panel-flows"><h3 className="settings-section-title">Fluxos Padrões</h3><p className="text-muted">Em breve.</p></div>
      
                      <div className="settings-panel" id="panel-funnel">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-funnel icon-sm"></span> Etapas do Funil</h3>
                              <p className="text-muted mb-4">Configure as etapas do seu funil de vendas.</p>
                              
                              <div id="funnelStages">
                                  <div className="copy-card" data-stage="1">
                                      <div className="copy-card-header"><span className="copy-card-title">Etapa 1</span></div>
                                      <div className="form-row">
                                          <div className="form-group">
                                              <label className="form-label">Nome</label>
                                              <input type="text" className="form-input" defaultValue="Novo" id="funnel1Name" />
                                          </div>
                                          <div className="form-group">
                                              <label className="form-label">Cor</label>
                                              <input type="color" className="form-input" defaultValue="#667eea" id="funnel1Color" style={{ height: '45px' }} />
                                          </div>
                                      </div>
                                      <div className="form-group">
                                          <label className="form-label">Descrição</label>
                                          <input type="text" className="form-input" defaultValue="Lead recém cadastrado" id="funnel1Desc" />
                                      </div>
                                  </div>
      
                                  <div className="copy-card" data-stage="2">
                                      <div className="copy-card-header"><span className="copy-card-title">Etapa 2</span></div>
                                      <div className="form-row">
                                          <div className="form-group">
                                              <label className="form-label">Nome</label>
                                              <input type="text" className="form-input" defaultValue="Em Andamento" id="funnel2Name" />
                                          </div>
                                          <div className="form-group">
                                              <label className="form-label">Cor</label>
                                              <input type="color" className="form-input" defaultValue="#f5576c" id="funnel2Color" style={{ height: '45px' }} />
                                          </div>
                                      </div>
                                      <div className="form-group">
                                          <label className="form-label">Descrição</label>
                                          <input type="text" className="form-input" defaultValue="Em negociação" id="funnel2Desc" />
                                      </div>
                                  </div>
      
                                  <div className="copy-card" data-stage="3">
                                      <div className="copy-card-header"><span className="copy-card-title">Etapa 3</span></div>
                                      <div className="form-row">
                                          <div className="form-group">
                                              <label className="form-label">Nome</label>
                                              <input type="text" className="form-input" defaultValue="Concluído" id="funnel3Name" />
                                          </div>
                                          <div className="form-group">
                                              <label className="form-label">Cor</label>
                                              <input type="color" className="form-input" defaultValue="#43e97b" id="funnel3Color" style={{ height: '45px' }} />
                                          </div>
                                      </div>
                                      <div className="form-group">
                                          <label className="form-label">Descrição</label>
                                          <input type="text" className="form-input" defaultValue="Venda realizada" id="funnel3Desc" />
                                      </div>
                                  </div>
      
                                  <div className="copy-card" data-stage="4">
                                      <div className="copy-card-header"><span className="copy-card-title">Etapa 4</span></div>
                                      <div className="form-row">
                                          <div className="form-group">
                                              <label className="form-label">Nome</label>
                                              <input type="text" className="form-input" defaultValue="Perdido" id="funnel4Name" />
                                          </div>
                                          <div className="form-group">
                                              <label className="form-label">Cor</label>
                                              <input type="color" className="form-input" defaultValue="#6b7280" id="funnel4Color" style={{ height: '45px' }} />
                                          </div>
                                      </div>
                                      <div className="form-group">
                                          <label className="form-label">Descrição</label>
                                          <input type="text" className="form-input" defaultValue="Não converteu" id="funnel4Desc" />
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <button className="btn btn-primary" onClick={() => globals.saveFunnelSettings?.()}><span className="icon icon-save icon-sm"></span> Salvar Funil</button>
                      </div>
      
                      <div className="settings-panel" id="panel-notifications">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-bell icon-sm"></span> Preferências de Notificação</h3>
                              <div className="form-group">
                                  <label className="checkbox-wrapper">
                                      <input type="checkbox" id="notifyNewLead" defaultChecked />
                                      <span className="checkbox-custom"></span>
                                      Notificar novos leads
                                  </label>
                              </div>
                              <div className="form-group">
                                  <label className="checkbox-wrapper">
                                      <input type="checkbox" id="notifyNewMessage" defaultChecked />
                                      <span className="checkbox-custom"></span>
                                      Notificar novas mensagens
                                  </label>
                              </div>
                              <div className="form-group">
                                  <label className="checkbox-wrapper">
                                      <input type="checkbox" id="notifySound" defaultChecked />
                                      <span className="checkbox-custom"></span>
                                      Som de notificação
                                  </label>
                              </div>
                          </div>
                          <button className="btn btn-primary" onClick={() => globals.saveNotificationSettings?.()}><span className="icon icon-save icon-sm"></span> Salvar Notificações</button>
                      </div>
      
                      <div className="settings-panel" id="panel-users">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-user icon-sm"></span> Gerenciar Usuários</h3>
                              <div className="table-container">
                                  <table className="data-table">
                                      <thead>
                                          <tr>
                                              <th>Nome</th>
                                              <th>E-mail</th>
                                              <th>Função</th>
                                              <th>Status</th>
                                              <th>Ações</th>
                                          </tr>
                                      </thead>
                                      <tbody id="usersTableBody">
                                          <tr>
                                              <td colSpan={5} className="table-empty">
                                                  <div className="table-empty-icon icon icon-empty icon-lg"></div>
                                                  <p>Carregando usuários...</p>
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                              <button className="btn btn-primary mt-4" onClick={() => globals.openModal?.('addUserModal')}><span className="icon icon-add icon-sm"></span> Adicionar Usuário</button>
                          </div>
      
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-lock icon-sm"></span> Alterar Senha</h3>
                              <div className="form-group">
                                  <label className="form-label">Senha Atual</label>
                                  <input type="password" className="form-input" id="currentPassword" />
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Nova Senha</label>
                                  <input type="password" className="form-input" id="newPassword" />
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Confirmar Nova Senha</label>
                                  <input type="password" className="form-input" id="confirmPassword" />
                              </div>
                              <button className="btn btn-primary" onClick={() => globals.changePassword?.()}><span className="icon icon-lock icon-sm"></span> Alterar Senha</button>
                          </div>
                      </div>
      
                      <div className="settings-panel" id="panel-api">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-lock icon-sm"></span> Chaves de API</h3>
                              <div className="form-group">
                                  <label className="form-label">API Key</label>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                      <input type="text" className="form-input" id="apiKey" defaultValue="sk_live_xxxxxxxxxxxx" readOnly style={{ fontFamily: 'monospace' }} />
                                      <button className="btn btn-outline" onClick={() => globals.copyApiKey?.()}><span className="icon icon-templates icon-sm"></span></button>
                                      <button className="btn btn-outline" onClick={() => globals.regenerateApiKey?.()}><span className="icon icon-refresh icon-sm"></span></button>
                                  </div>
                              </div>
                          </div>
      
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-link icon-sm"></span> Webhooks</h3>
                              <p className="text-muted mb-4">Configure URLs para receber notificações de eventos.</p>
                              <div className="form-group">
                                  <label className="form-label">URL do Webhook (Novo Lead)</label>
                                  <input type="url" className="form-input" id="webhookNewLead" placeholder="https://seu-site.com/webhook/new-lead" />
                              </div>
                              <div className="form-group">
                                  <label className="form-label">URL do Webhook (Nova Mensagem)</label>
                                  <input type="url" className="form-input" id="webhookNewMessage" placeholder="https://seu-site.com/webhook/new-message" />
                              </div>
                              <button className="btn btn-outline" onClick={() => globals.testWebhook?.()}>Testar Webhook</button>
                          </div>
                          <button className="btn btn-primary" onClick={() => globals.saveApiSettings?.()}><span className="icon icon-save icon-sm"></span> Salvar Configurações</button>
                      </div>
                  </div>
              </div>
          </main>
      
          <div className="modal-overlay" id="addUserModal">
              <div className="modal">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Adicionar Usuário</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('addUserModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <div className="form-group">
                          <label className="form-label required">Nome</label>
                          <input type="text" className="form-input" id="newUserName" required />
                      </div>
                      <div className="form-group">
                          <label className="form-label required">E-mail</label>
                          <input type="email" className="form-input" id="newUserEmail" required />
                      </div>
                      <div className="form-group">
                          <label className="form-label required">Senha</label>
                          <input type="password" className="form-input" id="newUserPassword" required />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Função</label>
                          <select className="form-select" id="newUserRole">
                              <option value="agent">Usuário</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="admin">Administrador</option>
                          </select>
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('addUserModal')}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.addUser?.()}><span className="icon icon-add icon-sm"></span> Adicionar</button>
                  </div>
              </div>
          </div>

          <div className="modal-overlay" id="editUserModal">
              <div className="modal">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-edit icon-sm"></span> Editar Usuário</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('editUserModal')}>{'\u00D7'}</button>
                  </div>
                  <div className="modal-body">
                      <input type="hidden" id="editUserId" />
                      <div className="form-group">
                          <label className="form-label required">Nome</label>
                          <input type="text" className="form-input" id="editUserName" required />
                      </div>
                      <div className="form-group">
                          <label className="form-label required">E-mail</label>
                          <input type="email" className="form-input" id="editUserEmail" required />
                      </div>
                      <div className="form-row">
                          <div className="form-group">
                              <label className="form-label">Função</label>
                              <select className="form-select" id="editUserRole">
                                  <option value="agent">Usuário</option>
                                  <option value="supervisor">Supervisor</option>
                                  <option value="admin">Administrador</option>
                              </select>
                          </div>
                          <div className="form-group">
                              <label className="form-label">Status</label>
                              <select className="form-select" id="editUserActive">
                                  <option value="1">Ativo</option>
                                  <option value="0">Inativo</option>
                              </select>
                          </div>
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('editUserModal')}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.updateUser?.()}><span className="icon icon-save icon-sm"></span> Salvar</button>
                  </div>
              </div>
          </div>
      
          <div className="modal-overlay" id="addTemplateModal">
              <div className="modal">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Nova resposta rápida</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('addTemplateModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <div className="form-group">
                          <label className="form-label required">Título da resposta</label>
                          <input type="text" className="form-input" id="newTemplateName" required placeholder="Ex.: Primeiro contato" />
                      </div>
                      <div className="form-group">
                          <label className="form-label required">Tipo de conteúdo</label>
                          <select className="form-select" id="newTemplateType" onChange={() => globals.updateNewTemplateForm?.()}>
                              <option value="text">Texto</option>
                              <option value="audio">Áudio</option>
                          </select>
                      </div>
                      <div className="form-group">
                          <div id="newTemplateTextGroup">
                              <label className="form-label required">Mensagem</label>
                              <textarea className="form-textarea" id="newTemplateMessage" rows="6" required placeholder="Digite a mensagem..."></textarea>
                          </div>
                          <div id="newTemplateAudioGroup" style={{ display: 'none' }}>
                              <label className="form-label required">Arquivo de áudio</label>
                              <input type="file" className="form-input" id="newTemplateAudio" accept="audio/*" />
                              <small className="text-muted">Envie um áudio (ogg/mp3/wav) para usar como resposta rápida no Inbox.</small>
                          </div>
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => globals.closeModal?.('addTemplateModal')}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => globals.saveNewTemplate?.()}><span className="icon icon-save icon-sm"></span> Salvar</button>
                  </div>
              </div>
          </div>
      
    </div>
  );
}
