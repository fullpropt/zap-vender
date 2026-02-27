import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';

type DashboardGlobals = {
  initDashboard?: () => void;
  loadDashboardData?: () => void;
  loadCustomEvents?: (options?: { silent?: boolean }) => void;
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  openCustomEventModal?: (id?: number) => void;
  saveCustomEvent?: () => void;
  deleteCustomEvent?: (id: number) => void;
  exportLeads?: () => void;
  confirmReset?: () => void;
  filterLeads?: () => void;
  toggleSelectAll?: () => void;
  importLeads?: () => void;
  saveLead?: () => void;
  updateLead?: () => void;
  logout?: () => void;
};

function DashboardStyles() {
  return (
    <style>{`
        .dashboard-botconversa { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media (max-width: 900px) { .dashboard-botconversa { grid-template-columns: 1fr; } }
        .stats-period-card, .stats-general-card, .events-personalized-card { background: var(--surface); border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); padding: 24px; border: 1px solid var(--border-color); }
        .stats-period-card h3, .stats-general-card h3, .events-personalized-card h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
        .stats-period-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px; }
        .stats-period-controls .form-input, .stats-period-controls .form-select { height: 38px; padding: 0 12px; }
        .chart-type-toggle { display: flex; gap: 4px; }
        .chart-type-toggle .chart-btn { padding: 8px 12px; border: 1px solid var(--border-color); background: var(--surface-muted); border-radius: 8px; cursor: pointer; color: var(--gray-700); }
        .chart-type-toggle .chart-btn.active { background: rgba(var(--primary-rgb), 0.16); border-color: var(--primary); color: #eafff4; }
        .stats-general-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
        .stats-general-item:last-child { border-bottom: none; }
        .stats-general-label { font-size: 13px; color: var(--gray-600); }
        .stats-general-value { font-weight: 700; font-size: 18px; }
        .events-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .events-header h3 { margin: 0; }
        .events-controls { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-wrap: wrap; }
        .events-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 12px; color: var(--gray-500); }
        .events-summary strong { color: var(--gray-700); }
        .events-list { display: flex; flex-direction: column; gap: 10px; }
        .events-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 12px; align-items: center; padding: 12px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 23, 42, 0.24); }
        .events-row-main { min-width: 0; }
        .events-row-name { font-weight: 700; color: #e7edf7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .events-row-key { font-size: 11px; color: var(--gray-500); }
        .events-row-count { font-size: 13px; color: var(--gray-600); white-space: nowrap; }
        .events-row-last { font-size: 12px; color: var(--gray-500); white-space: nowrap; }
        .events-row-actions { display: inline-flex; gap: 6px; }
        .events-loading, .events-error { padding: 14px; text-align: center; border: 1px dashed var(--border-color); border-radius: 10px; color: var(--gray-500); }
        .info-icon { cursor: help; opacity: 0.7; }
        .events-empty { text-align: center; padding: 40px 20px; color: var(--gray-500); }
        .events-empty-emoji { width: 48px; height: 48px; display: block; margin: 0 auto 16px; opacity: 0.6; background-color: var(--gray-400); }
        .custom-event-status { font-size: 11px; border-radius: 999px; padding: 3px 8px; border: 1px solid rgba(var(--primary-rgb), 0.25); color: var(--gray-500); background: rgba(15, 23, 42, 0.24); white-space: nowrap; }
        .custom-event-status.active { border-color: rgba(var(--primary-rgb), 0.45); color: #d8f4e6; background: rgba(var(--primary-rgb), 0.13); }
        .custom-event-status.inactive { border-color: rgba(148, 163, 184, 0.4); color: #cbd5e1; }
        @media (max-width: 640px) {
          .dashboard-botconversa { gap: 14px; margin-bottom: 16px; }
          .stats-period-card, .stats-general-card, .events-personalized-card { padding: 12px; border-radius: 12px; }
          .stats-period-card h3, .stats-general-card h3, .events-personalized-card h3 { margin-bottom: 12px; font-size: 15px; }
          .stats-period-controls { gap: 8px; }
          .stats-period-controls .form-input, .stats-period-controls .form-select { width: 100%; min-width: 0; }
          .chart-type-toggle { width: 100%; justify-content: flex-start; }
          .chart-type-toggle .chart-btn { flex: 1 1 0; }
          .stats-period-chart canvas { max-height: 150px !important; }
          .stats-general-item { gap: 12px; }
          .stats-general-label { font-size: 12px; }
          .stats-general-value { font-size: 16px; }
          .events-header { gap: 8px; margin-bottom: 12px; }
          .events-controls { width: 100%; margin-left: 0; }
          .events-controls .form-select, .events-controls .btn { width: 100%; }
          .events-row { grid-template-columns: 1fr; gap: 8px; }
          .events-row-count, .events-row-last { white-space: normal; }
          .events-row-actions { justify-content: flex-end; }
          .events-empty { padding: 20px 10px; }
          .events-empty-emoji { width: 34px; height: 34px; margin-bottom: 10px; }
        }
      `}</style>
  );
}

function DashboardHeader() {
  return (
    <div className="page-header">
      <div className="page-title">
        <h1>Painel de Controle</h1>
        <p>
          Bem-vindo, <span className="user-name">Usuário</span> |{' '}
          <span className="current-date"></span>
        </p>
      </div>
    </div>
  );
}

function StatsPeriod() {
  return (
    <div className="dashboard-botconversa">
      <div className="stats-period-card">
        <h3>Estatísticas por período</h3>
        <div className="stats-period-controls">
          <input type="date" className="form-input" id="statsStartDate" />
          <input type="date" className="form-input" id="statsEndDate" />
          <select className="form-select" id="statsMetric" style={{ width: 'auto' }}>
            <option value="novos_contatos">Novos Contatos</option>
            <option value="mensagens">Mensagens</option>
            <option value="interacoes">Interações</option>
          </select>
          <div className="chart-type-toggle">
            <button type="button" className="chart-btn active" data-chart-type="line" title="Gráfico de linhas">
              <span className="icon icon-chart-line icon-sm"></span>
            </button>
            <button type="button" className="chart-btn" data-chart-type="bar" title="Gráfico de barras">
              <span className="icon icon-chart-bar icon-sm"></span>
            </button>
          </div>
        </div>
        <div className="stats-period-chart" id="statsPeriodChart">
          <canvas id="statsChart" style={{ maxHeight: '200px' }}></canvas>
        </div>
      </div>
      <div className="stats-general-card">
        <h3>Estatísticas gerais</h3>
        <div className="stats-general-item">
          <span className="stats-general-label">Contatos que interagiram</span>
          <span className="stats-general-value" id="statsContacts">0</span>
        </div>
        <div className="stats-general-item">
          <span className="stats-general-label">Mensagem enviada pelo contato</span>
          <span className="stats-general-value" id="statsMessages">0</span>
        </div>
        <div className="stats-general-item">
          <span className="stats-general-label">Interações/Inscrito</span>
          <span className="stats-general-value" id="statsInteractionsPer">0</span>
        </div>
      </div>
    </div>
  );
}

function EventsCard() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="events-personalized-card" style={{ marginBottom: '24px' }}>
      <div className="events-header">
        <h3>
          Eventos personalizados{' '}
          <span
            className="info-icon"
            title="Crie eventos personalizados, integre-os em fluxos com o Bloco de Ação e rastreie suas estatísticas."
          >
            <span className="icon icon-info icon-sm"></span>
          </span>
        </h3>
        <div className="events-controls">
          <select className="form-select" id="customEventsPeriod" style={{ width: 'auto' }}>
            <option value="this_month">Este mês</option>
            <option value="week">Semana</option>
            <option value="year">Ano</option>
            <option value="last_30_days">Últimos 30 dias</option>
          </select>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => globals.openCustomEventModal?.()}>
            Criar
          </button>
        </div>
      </div>
      <div id="customEventsList">
        <div className="events-loading">Carregando eventos personalizados...</div>
      </div>
    </div>
  );
}

function StatsCards() {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon primary"><span className="icon icon-contacts"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="totalLeads">0</div>
          <div className="stat-label">Total de Leads</div>
          <div className="stat-change positive" id="leadsChange">+0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon success"><span className="icon icon-check"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="completedLeads">0</div>
          <div className="stat-label">Concluídos</div>
          <div className="stat-change positive" id="completedChange">+0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon warning"><span className="icon icon-clock"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="pendingLeads">0</div>
          <div className="stat-label">Em Andamento</div>
          <div className="stat-change negative" id="pendingChange">-0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon info"><span className="icon icon-chart-bar"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="conversionRate">0.0%</div>
          <div className="stat-label">Conversão</div>
          <div className="stat-change positive" id="conversionChange">+0%</div>
        </div>
      </div>
    </div>
  );
}

function Funnel() {
  return (
    <div className="funnel-container">
      <div className="funnel-title"><span className="icon icon-funnel icon-sm"></span> Funil de Conversão</div>
      <div className="funnel-stages" id="funnelStages">
        <div className="funnel-stage" data-stage="1">
          <div className="funnel-value" id="funnel1">0</div>
          <div className="funnel-label">Etapa 1</div>
          <div className="funnel-percent">100%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="2">
          <div className="funnel-value" id="funnel2">0</div>
          <div className="funnel-label">Etapa 2</div>
          <div className="funnel-percent" id="funnel2Percent">0%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="3">
          <div className="funnel-value" id="funnel3">0</div>
          <div className="funnel-label">Etapa 3</div>
          <div className="funnel-percent" id="funnel3Percent">0%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="4">
          <div className="funnel-value" id="funnel4">0</div>
          <div className="funnel-label">Concluído</div>
          <div className="funnel-percent" id="funnel4Percent">0%</div>
        </div>
      </div>
    </div>
  );
}

function LeadsTable() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-title"><span className="icon icon-contacts icon-sm"></span> Leads Recentes</div>
        <div className="table-filters contacts-table-filters">
          <div className="search-box contacts-search-box">
            <span className="search-icon icon icon-search icon-sm"></span>
            <input
              type="text"
              id="searchLeads"
              placeholder="Buscar..."
              onKeyUp={() => globals.filterLeads?.()}
            />
          </div>
          <select
            className="form-select contacts-filter-select"
            id="filterStatus"
            onChange={() => globals.filterLeads?.()}
          >
            <option value="">Todos os Status</option>
            <option value="1">Novo</option>
            <option value="2">Em Andamento</option>
            <option value="3">Concluído</option>
            <option value="4">Perdido</option>
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
              <th>Status</th>
              <th>Tags</th>
              <th>Última Interação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="leadsTableBody">
            <tr>
              <td colSpan={7} className="table-empty">
                <div className="table-empty-icon icon icon-empty icon-lg"></div>
                <p>Carregando leads...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadModals() {
  const globals = window as Window & DashboardGlobals;

  return (
    <>
      <div className="modal-overlay" id="importModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-import icon-sm"></span> Importar Leads</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('importModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Arquivo CSV</label>
              <input type="file" className="form-input" id="importFile" accept=".csv,.txt" />
              <p className="form-help">
                Formato esperado: nome, telefone, veículo, placa (separados por vírgula)
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Ou cole os dados aqui</label>
              <textarea
                className="form-textarea"
                id="importText"
                rows={10}
                placeholder={`nome,telefone,veiculo,placa\nJoão Silva,27999999999,Honda Civic 2020,ABC1234\nMaria Santos,27988888888,Toyota Corolla 2021,XYZ5678`}
              ></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Tag para importação (opcional)</label>
              <input
                type="text"
                className="form-input"
                id="importTag"
                placeholder="Ex: Prioridade, Premium, Indicação"
              />
              <p className="form-help">Aplicada em todos os leads importados.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('importModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.importLeads?.()}>
              Importar
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="addLeadModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Adicionar Lead</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('addLeadModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="addLeadForm">
              <div className="form-group">
                <label className="form-label required">Nome</label>
                <input type="text" className="form-input" id="leadName" required placeholder="Nome completo" />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="leadPhone" required placeholder="27999999999" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Veículo</label>
                  <input type="text" className="form-input" id="leadVehicle" placeholder="Ex: Honda Civic 2020" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa</label>
                  <input type="text" className="form-input" id="leadPlate" placeholder="ABC1234" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="leadEmail" placeholder="email@exemplo.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Status Inicial</label>
                <select className="form-select" id="leadStatus">
                  <option value="1">Novo</option>
                  <option value="2">Em Andamento</option>
                </select>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('addLeadModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.saveLead?.()}>
              Salvar Lead
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="editLeadModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-edit icon-sm"></span> Editar Lead</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('editLeadModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="editLeadForm">
              <input type="hidden" id="editLeadId" />
              <div className="form-group">
                <label className="form-label required">Nome</label>
                <input type="text" className="form-input" id="editLeadName" required />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="editLeadPhone" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Veículo</label>
                  <input type="text" className="form-input" id="editLeadVehicle" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa</label>
                  <input type="text" className="form-input" id="editLeadPlate" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="editLeadEmail" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" id="editLeadStatus">
                  <option value="1">Novo</option>
                  <option value="2">Em Andamento</option>
                  <option value="3">Concluído</option>
                  <option value="4">Perdido</option>
                </select>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('editLeadModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.updateLead?.()}>
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="customEventModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title" id="customEventModalTitle">
              <span className="icon icon-add icon-sm"></span> Novo Evento
            </h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('customEventModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="customEventForm">
              <input type="hidden" id="customEventId" />
              <div className="form-group">
                <label className="form-label required">Nome do evento</label>
                <input type="text" className="form-input" id="customEventName" placeholder="Ex.: Conversa Qualificada" />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição (opcional)</label>
                <textarea
                  className="form-textarea"
                  id="customEventDescription"
                  rows={3}
                  placeholder="Explique quando este evento deve ser disparado"
                ></textarea>
              </div>
              <div className="form-group">
                <label className="checkbox-wrapper" style={{ gap: '8px' }}>
                  <input type="checkbox" id="customEventActive" defaultChecked />
                  <span className="checkbox-custom"></span>
                  Evento ativo
                </label>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('customEventModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.saveCustomEvent?.()}>
              Salvar Evento
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function FloatingAddLeadButton() {
  const globals = window as Window & DashboardGlobals;

  return (
    <button
      type="button"
      className="btn btn-whatsapp btn-icon"
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        boxShadow: 'var(--shadow-lg)'
      }}
      onClick={() => globals.openModal?.('addLeadModal')}
      title="Adicionar Lead"
    >
      <span className="icon icon-add icon-lg"></span>
    </button>
  );
}

export default function Dashboard() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/dashboard');

      if (cancelled) return;

      const win = window as Window & DashboardGlobals;
      if (typeof win.initDashboard === 'function') {
        win.initDashboard();
      } else if (typeof (mod as { initDashboard?: () => void }).initDashboard === 'function') {
        (mod as { initDashboard?: () => void }).initDashboard?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & DashboardGlobals;
  const toggleSidebar = () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
  };

  return (
    <div className="dashboard-react">
      <DashboardStyles />
      <button className="mobile-menu-toggle" type="button" onClick={toggleSidebar}>
        {'\u2630'}
      </button>
      <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
        </div>

        <nav className="sidebar-nav">
                            <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link active"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/inbox" className="nav-link">
                  <span className="icon icon-inbox"></span>
                  Inbox
                  <span className="badge" style={{ display: 'none' }}>0</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Automação</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>
                  Automação
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>
                  Fluxos de Conversa
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>
                  Funil de Vendas
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/whatsapp" className="nav-link">
                  <span className="icon icon-whatsapp"></span>
                  WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>
                  Configurações
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
          <button className="btn-logout" type="button" onClick={() => globals.logout?.()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main-content">
        <DashboardHeader />
        <StatsPeriod />
        <EventsCard />
        <StatsCards />
        <Funnel />
      </main>
      <LeadModals />
      <FloatingAddLeadButton />
    </div>
  );
}
