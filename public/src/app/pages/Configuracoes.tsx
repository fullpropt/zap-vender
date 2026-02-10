import { useEffect } from 'react';

import { Link } from 'react-router-dom';
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
  saveWhatsAppSettings?: () => void;
  saveNotificationSettings?: () => void;
  addUser?: () => void;
  changePassword?: () => void;
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
            background: white;
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
        }
        .settings-nav-item:hover { background: var(--gray-100); }
        .settings-nav-item.active { background: rgba(var(--primary-rgb), 0.1); color: var(--primary); font-weight: 600; }
        .settings-panel {
            background: white;
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
        .connection-status-card { background: white; border-radius: var(--border-radius); padding: 30px; border: 1px solid var(--border-color); }
        .connection-icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; margin-bottom: 20px; }
        .connection-icon.success { background: #10b981; color: white; }
        .connection-icon.disconnected { background: var(--gray-200); color: var(--gray-600); }
        .connection-status-card h4 { margin: 0 0 12px; font-size: 20px; }
        .connection-status-card p { margin: 0 0 12px; color: var(--gray-600); line-height: 1.5; }
        .connection-info { font-size: 13px; color: var(--gray-500); background: var(--gray-50); padding: 15px; border-radius: 8px; margin: 15px 0 !important; }
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
                      <div className="settings-nav-item active" onClick={() => globals.showPanel?.('conexao')}><span className="icon icon-whatsapp icon-sm"></span> Conexão</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('general')}><span className="icon icon-building icon-sm"></span> Campos</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('labels')}><span className="icon icon-tag icon-sm"></span> Etiquetas</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('quick')}><span className="icon icon-bolt icon-sm"></span> Respostas rápidas</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('team')}><span className="icon icon-contacts icon-sm"></span> Equipe</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('hours')}><span className="icon icon-clock icon-sm"></span> Horários</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('flows')}><span className="icon icon-flows icon-sm"></span> Fluxos Padrões</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('funnel')}><span className="icon icon-funnel icon-sm"></span> Funil de Vendas</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('copys')}><span className="icon icon-templates icon-sm"></span> Copys e Mensagens</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('whatsapp')}><span className="icon icon-whatsapp icon-sm"></span> WhatsApp</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('notifications')}><span className="icon icon-bell icon-sm"></span> Notificações</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('users')}><span className="icon icon-user icon-sm"></span> Usuários</div>
                      <div className="settings-nav-item" onClick={() => globals.showPanel?.('api')}><span className="icon icon-plug icon-sm"></span> API e Webhooks</div>
                  </nav>
      
                  <div className="settings-panels">
                      <div className="settings-panel active" id="panel-conexao">
                          <h3 className="settings-section-title">Conexão</h3>
                          <div className="connection-status-card" id="connectionStatusCard">
                              <div className="connection-success" id="connectionSuccess" style={{ display: 'none' }}>
                                  <div className="connection-icon success">✓</div>
                                  <h4>Automação está ligada</h4>
                                  <p>O número de WhatsApp <strong id="connectedPhone">+55...</strong> está conectado à Companhia.</p>
                                  <p className="connection-info">Seu WhatsApp foi conectado com sucesso. Automação continuará funcionando mesmo com o celular desligado. Porém, se você não acessar o aplicativo do WhatsApp nos próximos 14 dias, seu telefone será desconectado automaticamente pelo WhatsApp por motivos de segurança.</p>
                                  <button className="btn btn-danger" onClick={() => globals.disconnectWhatsApp?.()}>Desconectar</button>
                              </div>
                              <div className="connection-disconnected" id="connectionDisconnected">
                                  <div className="connection-icon disconnected">!</div>
                                  <h4>WhatsApp desconectado</h4>
                                  <p>Conecte seu WhatsApp em <Link to="/whatsapp">WhatsApp → Conectar</Link> para ativar a automação.</p>
                              </div>
                          </div>
                      </div>
      
                      <div className="settings-panel" id="panel-general">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-building icon-sm"></span> Informações da Empresa</h3>
                              <div className="form-group">
                                  <label className="form-label">Nome da Empresa</label>
                                  <input type="text" className="form-input" id="companyName" defaultValue="SELF Proteção Veicular" />
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
      
                      <div className="settings-panel" id="panel-labels"><h3 className="settings-section-title">Etiquetas</h3><p className="text-muted">Em breve.</p></div>
                      <div className="settings-panel" id="panel-quick"><h3 className="settings-section-title">Respostas rápidas</h3><p className="text-muted">Em breve.</p></div>
                      <div className="settings-panel" id="panel-team"><h3 className="settings-section-title">Equipe</h3><p className="text-muted">Em breve.</p></div>
                      <div className="settings-panel" id="panel-hours"><h3 className="settings-section-title">Horários</h3><p className="text-muted">Em breve.</p></div>
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
      
                      <div className="settings-panel" id="panel-copys">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-templates icon-sm"></span> Templates de Mensagens</h3>
                              <p className="text-muted mb-3">Crie e gerencie templates de mensagens. Use as vari??veis:</p>
                              
                              <div className="mb-4">
                                  <span className="variable-tag" onClick={() => globals.insertVariable?.('{{nome}}')}>{'{{nome}}'}</span>
                                  <span className="variable-tag" onClick={() => globals.insertVariable?.('{{telefone}}')}>{'{{telefone}}'}</span>
                                  <span className="variable-tag" onClick={() => globals.insertVariable?.('{{veiculo}}')}>{'{{veiculo}}'}</span>
                                  <span className="variable-tag" onClick={() => globals.insertVariable?.('{{placa}}')}>{'{{placa}}'}</span>
                                  <span className="variable-tag" onClick={() => globals.insertVariable?.('{{empresa}}')}>{'{{empresa}}'}</span>
                              </div>

                              <div className="copy-card">
                                  <div className="copy-card-header">
                                      <span className="copy-card-title">Templates personalizados</span>
                                  </div>
                                  <div id="templatesList"></div>
                                  <p className="text-muted" id="templatesEmpty" style={{ marginTop: '12px' }}>Nenhum template criado ainda.</p>
                              </div>

                              <button className="btn btn-outline w-100 mt-3" onClick={() => globals.openModal?.('addTemplateModal')}><span className="icon icon-add icon-sm"></span> Adicionar Template</button>
                          </div>
                          <button className="btn btn-primary" onClick={() => globals.saveCopysSettings?.()}><span className="icon icon-save icon-sm"></span> Salvar Templates</button>
                      </div>

                      <div className="settings-panel" id="panel-whatsapp">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-whatsapp icon-sm"></span> Conexão WhatsApp</h3>
                              <div className="alert alert-info mb-4">
                                  <strong>Status:</strong> <span id="whatsappStatusText">Verificando...</span>
                              </div>
                              <div id="qrCodeContainer" style={{ textAlign: 'center', display: 'none' }}>
                                  <p className="mb-3">Escaneie o QR Code com seu WhatsApp:</p>
                                  <div id="qrCode" style={{ display: 'inline-block', padding: '20px', background: 'white', borderRadius: '10px' }}></div>
                              </div>
                              <div className="mt-4">
                                  <button className="btn btn-primary" onClick={() => globals.connectWhatsApp?.()}><span className="icon icon-link icon-sm"></span> Conectar WhatsApp</button>
                                  <button className="btn btn-outline-danger ml-2" onClick={() => globals.disconnectWhatsApp?.()}><span className="icon icon-plug icon-sm"></span> Desconectar</button>
                              </div>
                          </div>
      
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-settings icon-sm"></span> Configurações de Envio</h3>
                              <div className="form-group">
                                  <label className="form-label">Intervalo entre mensagens (segundos)</label>
                                  <input type="number" className="form-input" id="messageInterval" defaultValue="30" min="10" max="300" />
                                  <small className="text-muted">Mínimo: 10s | Máximo: 300s</small>
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Limite de mensagens por hora</label>
                                  <input type="number" className="form-input" id="messagesPerHour" defaultValue="60" min="10" max="200" />
                              </div>
                              <div className="form-group">
                                  <label className="form-label">Horário de funcionamento</label>
                                  <div className="form-row">
                                      <input type="time" className="form-input" id="workStart" defaultValue="08:00" />
                                      <input type="time" className="form-input" id="workEnd" defaultValue="18:00" />
                                  </div>
                              </div>
                          </div>
                          <button className="btn btn-primary" onClick={() => globals.saveWhatsAppSettings?.()}><span className="icon icon-save icon-sm"></span> Salvar Configurações</button>
                      </div>
      
                      <div className="settings-panel" id="panel-notifications">
                          <div className="settings-section">
                              <h3 className="settings-section-title"><span className="icon icon-bell icon-sm"></span> Preferências de Notificação</h3>
                              <div className="form-group">
                                  <label className="checkbox-wrapper">
                                      <input type="checkbox" id="notifyNewLead" checked />
                                      <span className="checkbox-custom"></span>
                                      Notificar novos leads
                                  </label>
                              </div>
                              <div className="form-group">
                                  <label className="checkbox-wrapper">
                                      <input type="checkbox" id="notifyNewMessage" checked />
                                      <span className="checkbox-custom"></span>
                                      Notificar novas mensagens
                                  </label>
                              </div>
                              <div className="form-group">
                                  <label className="checkbox-wrapper">
                                      <input type="checkbox" id="notifySound" checked />
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
                                              <td>Admin</td>
                                              <td>admin@self.com</td>
                                              <td><span className="badge badge-primary">Administrador</span></td>
                                              <td><span className="badge badge-success">Ativo</span></td>
                                              <td><button className="btn btn-sm btn-outline"><span className="icon icon-edit icon-sm"></span></button></td>
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
                              <option value="user">Usuário</option>
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
      
          <div className="modal-overlay" id="addTemplateModal">
              <div className="modal">
                  <div className="modal-header">
                      <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Novo Template</h3>
                      <button className="modal-close" onClick={() => globals.closeModal?.('addTemplateModal')}>×</button>
                  </div>
                  <div className="modal-body">
                      <div className="form-group">
                          <label className="form-label required">Nome do Template</label>
                          <input type="text" className="form-input" id="newTemplateName" required placeholder="Ex: Promoção" />
                      </div>
                      <div className="form-group">
                          <label className="form-label required">Tipo</label>
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
                              <small className="text-muted">Envie um áudio (ogg/mp3/wav). Ele ficará salvo para uso no Inbox.</small>
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
