import { useEffect } from 'react';

import { Link } from 'react-router-dom';
type ContatosGlobals = {
  initContacts?: () => void;
  loadContacts?: () => void;
  exportContacts?: () => void;
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  saveContact?: () => void;
  updateContact?: () => void;
  openWhatsApp?: () => void;
  importContacts?: () => void;
  bulkSendMessage?: () => void;
  bulkChangeStatus?: () => void;
  bulkAddTag?: () => void;
  bulkDelete?: () => void;
  clearSelection?: () => void;
  filterContacts?: () => void;
  toggleSelectAll?: () => void;
  changePage?: (delta: number) => void;
  sendBulkMessage?: () => void;
  loadTemplate?: () => void;
  switchTab?: (tab: string) => void;
  logout?: () => void;
};

export default function Contatos() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/contatos');

      if (cancelled) return;

      const win = window as Window & ContatosGlobals;
      if (typeof win.initContacts === 'function') {
        win.initContacts();
      } else if (typeof (mod as { initContacts?: () => void }).initContacts === 'function') {
        (mod as { initContacts?: () => void }).initContacts?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & ContatosGlobals;

  return (
    <div className="contatos-react">
      <button
        className="mobile-menu-toggle"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      >
        ???
      </button>
      <div className="sidebar-overlay"></div>

      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo">
            <img src="img/logo-self.png" alt="SELF" />
            <span>SELF</span>
          </Link>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/dashboard" className="nav-link">
                  <span className="icon icon-dashboard"></span>Painel de Controle
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/contatos" className="nav-link active">
                  <span className="icon icon-contacts"></span>Contatos
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/campanhas" className="nav-link">
                  <span className="icon icon-campaigns"></span>Campanhas
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/transmissao" className="nav-link">
                  <span className="icon icon-broadcast"></span>Transmiss??o
                </Link>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/inbox" className="nav-link">
                  <span className="icon icon-inbox"></span>Inbox
                  <span className="badge" style={{ display: 'none' }}>0</span>
                </Link>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Automa????o</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>Automa????o
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>Fluxos de Conversa
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>Funil de Vendas
                </Link>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/whatsapp" className="nav-link">
                  <span className="icon icon-whatsapp"></span>WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>Configura????es
                </Link>
              </li>
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
            <h1><span className="icon icon-contacts icon-sm"></span> Contatos</h1>
            <p>Gerencie todos os seus leads e contatos</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-outline" onClick={() => globals.loadContacts?.()}>
              <span className="icon icon-refresh icon-sm"></span> Atualizar
            </button>
            <button className="btn btn-outline" onClick={() => globals.openModal?.('importModal')}>
              <span className="icon icon-import icon-sm"></span> Importar
            </button>
            <button className="btn btn-success" onClick={() => globals.exportContacts?.()}>
              <span className="icon icon-export icon-sm"></span> Exportar
            </button>
            <button className="btn btn-primary" onClick={() => globals.openModal?.('addContactModal')}>
              <span className="icon icon-add icon-sm"></span> Novo Contato
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><span className="icon icon-contacts"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="totalContacts">0</div>
              <div className="stat-label">Total de Contatos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success"><span className="icon icon-check"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="activeContacts">0</div>
              <div className="stat-label">Ativos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning"><span className="icon icon-spark"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="newContacts">0</div>
              <div className="stat-label">Novos (7 dias)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon info"><span className="icon icon-whatsapp"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="withWhatsapp">0</div>
              <div className="stat-label">Com WhatsApp</div>
            </div>
          </div>
        </div>

        <div className="card mb-4" id="bulkActions" style={{ display: 'none' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <span><strong id="selectedCount">0</strong> contatos selecionados</span>
            <button className="btn btn-sm btn-whatsapp" onClick={() => globals.bulkSendMessage?.()}>
              <span className="icon icon-whatsapp icon-sm"></span> Enviar Mensagem
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => globals.bulkChangeStatus?.()}>
              <span className="icon icon-refresh icon-sm"></span> Alterar Status
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => globals.bulkAddTag?.()}>
              <span className="icon icon-tag icon-sm"></span> Adicionar Tag
            </button>
            <button className="btn btn-sm btn-outline-danger" onClick={() => globals.bulkDelete?.()}>
              <span className="icon icon-delete icon-sm"></span> Excluir
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => globals.clearSelection?.()}>
              <span className="icon icon-close icon-sm"></span> Limpar Sele????o
            </button>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <div className="table-title"><span className="icon icon-contacts icon-sm"></span> Lista de Contatos</div>
            <div className="table-filters">
              <div className="search-box">
                <span className="search-icon icon icon-search icon-sm"></span>
                <input type="text" id="searchContacts" placeholder="Buscar..." onKeyUp={() => globals.filterContacts?.()} />
              </div>
              <select className="form-select" id="filterStatus" onChange={() => globals.filterContacts?.()} style={{ width: 'auto' }}>
                <option value="">Todos os Status</option>
                <option value="1">Novo</option>
                <option value="2">Em Andamento</option>
                <option value="3">Conclu??do</option>
                <option value="4">Perdido</option>
              </select>
              <select className="form-select" id="filterTag" onChange={() => globals.filterContacts?.()} style={{ width: 'auto' }}>
                <option value="">Todas as Tags</option>
              </select>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>
                    <label className="checkbox-wrapper">
                      <input type="checkbox" id="selectAll" onChange={() => globals.toggleSelectAll?.()} />
                      <span className="checkbox-custom"></span>
                    </label>
                  </th>
                  <th>Contato</th>
                  <th>WhatsApp</th>
                  <th>Ve??culo</th>
                  <th>Placa</th>
                  <th>Status</th>
                  <th>Tags</th>
                  <th>??ltima Intera????o</th>
                  <th>A????es</th>
                </tr>
              </thead>
              <tbody id="contactsTableBody">
                <tr>
                  <td colSpan={9} className="table-empty">
                    <div className="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Carregando contatos...</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="paginationInfo">Mostrando 0 de 0 contatos</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button className="btn btn-sm btn-outline" id="prevPage" onClick={() => globals.changePage?.(-1)} disabled>
                ??? Anterior
              </button>
              <button className="btn btn-sm btn-outline" id="nextPage" onClick={() => globals.changePage?.(1)} disabled>
                Pr??ximo ???
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="modal-overlay" id="addContactModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Novo Contato</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('addContactModal')}>??</button>
          </div>
          <div className="modal-body">
            <form id="addContactForm">
              <div className="form-group">
                <label className="form-label required">Nome Completo</label>
                <input type="text" className="form-input" id="contactName" required placeholder="Digite o nome" />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="contactPhone" required placeholder="27999999999" />
                <p className="form-help">Apenas n??meros com DDD</p>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ve??culo</label>
                  <input type="text" className="form-input" id="contactVehicle" placeholder="Ex: Honda Civic 2020" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa</label>
                  <input type="text" className="form-input" id="contactPlate" placeholder="ABC1234" style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="contactEmail" placeholder="email@exemplo.com" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" id="contactStatus">
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Conclu??do</option>
                    <option value="4">Perdido</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Origem</label>
                  <select className="form-select" id="contactSource">
                    <option value="manual">Manual</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="site">Site</option>
                    <option value="indicacao">Indica????o</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observa????es</label>
                <textarea className="form-textarea" id="contactNotes" rows={3} placeholder="Anota????es sobre o contato..."></textarea>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('addContactModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.saveContact?.()}>Salvar Contato</button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="editContactModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-edit icon-sm"></span> Editar Contato</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('editContactModal')}>??</button>
          </div>
          <div className="modal-body">
            <div className="tabs">
              <button className="tab active" onClick={() => globals.switchTab?.('info')}>
                <span className="icon icon-info icon-sm"></span> Informa????es
              </button>
              <button className="tab" onClick={() => globals.switchTab?.('history')}>
                <span className="icon icon-clock icon-sm"></span> Hist??rico
              </button>
              <button className="tab" onClick={() => globals.switchTab?.('messages')}>
                <span className="icon icon-message icon-sm"></span> Mensagens
              </button>
            </div>

            <div className="tab-content active" id="tab-info">
              <form id="editContactForm">
                <input type="hidden" id="editContactId" />
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Nome</label>
                    <input type="text" className="form-input" id="editContactName" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">WhatsApp</label>
                    <input type="tel" className="form-input" id="editContactPhone" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ve??culo</label>
                    <input type="text" className="form-input" id="editContactVehicle" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Placa</label>
                    <input type="text" className="form-input" id="editContactPlate" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" id="editContactEmail" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" id="editContactStatus">
                      <option value="1">Novo</option>
                      <option value="2">Em Andamento</option>
                      <option value="3">Conclu??do</option>
                      <option value="4">Perdido</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observa????es</label>
                  <textarea className="form-textarea" id="editContactNotes" rows={3}></textarea>
                </div>
              </form>
            </div>

            <div className="tab-content" id="tab-history">
              <div id="contactHistory" className="empty-state">
                <div className="empty-state-icon icon icon-clock icon-lg"></div>
                <p>Nenhum hist??rico dispon??vel</p>
              </div>
            </div>

            <div className="tab-content" id="tab-messages">
              <div id="contactMessages" className="empty-state">
                <div className="empty-state-icon icon icon-message icon-lg"></div>
                <p>Nenhuma mensagem trocada</p>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('editContactModal')}>Cancelar</button>
            <button className="btn btn-whatsapp" onClick={() => globals.openWhatsApp?.()}>
              <span className="icon icon-whatsapp icon-sm"></span> WhatsApp
            </button>
            <button className="btn btn-primary" onClick={() => globals.updateContact?.()}>Salvar Altera????es</button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="importModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-import icon-sm"></span> Importar Contatos</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('importModal')}>??</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Arquivo CSV</label>
              <input type="file" className="form-input" id="importFile" accept=".csv,.txt" />
              <p className="form-help">Colunas: nome, telefone, veiculo, placa, email</p>
            </div>
            <div className="form-group">
              <label className="form-label">Ou cole os dados</label>
              <textarea
                className="form-textarea"
                id="importText"
                rows={8}
                placeholder={`nome,telefone,veiculo,placa
Jo??o Silva,27999999999,Honda Civic,ABC1234`}
              ></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Status inicial</label>
              <select className="form-select" id="importStatus">
                <option value="1">Novo</option>
                <option value="2">Em Andamento</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('importModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.importContacts?.()}>Importar</button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="bulkMessageModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-whatsapp icon-sm"></span> Enviar Mensagem em Lote</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('bulkMessageModal')}>??</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Destinat??rios</label>
              <p className="text-muted"><span id="bulkRecipients">0</span> contatos selecionados</p>
            </div>
            <div className="form-group">
              <label className="form-label">Template</label>
              <select className="form-select" id="bulkTemplate" onChange={() => globals.loadTemplate?.()}>
                <option value="">Selecione um template...</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Mensagem</label>
              <textarea
                className="form-textarea"
                id="bulkMessage"
                rows={5}
                placeholder={`Digite a mensagem...
Use {{nome}} para personalizar`}
              ></textarea>
              <p className="form-help">Vari??veis: {{nome}}, {{veiculo}}, {{placa}}</p>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Intervalo entre mensagens</label>
                <select className="form-select" id="bulkDelay" defaultValue="5000">
                  <option value="3000">3 segundos</option>
                  <option value="5000">5 segundos</option>
                  <option value="10000">10 segundos</option>
                  <option value="30000">30 segundos</option>
                  <option value="60000">1 minuto</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">In??cio</label>
                <select className="form-select" id="bulkStart">
                  <option value="now">Imediatamente</option>
                  <option value="scheduled">Agendar</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('bulkMessageModal')}>Cancelar</button>
            <button className="btn btn-whatsapp" onClick={() => globals.sendBulkMessage?.()}>
              <span className="icon icon-whatsapp icon-sm"></span> Enviar para Todos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
