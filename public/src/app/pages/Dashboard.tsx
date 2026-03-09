import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';

type DashboardGlobals = {
  initDashboard?: () => void;
  loadDashboardData?: () => void;
  loadCustomEvents?: (options?: { silent?: boolean }) => void;
  toggleOnboardingStep?: (stepId: string, checked?: boolean) => void;
  goToOnboardingStep?: (stepId: string) => void;
  resetOnboardingChecklist?: () => void;
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
        .dashboard-react .sidebar .nav-link:not(.active) {
          background: transparent !important;
          border: 1px solid transparent !important;
          box-shadow: none !important;
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
        }
        .dashboard-botconversa { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media (max-width: 900px) { .dashboard-botconversa { grid-template-columns: 1fr; } }
        .stats-period-card, .stats-general-card, .events-personalized-card { background: var(--surface); border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); padding: 24px; border: 1px solid var(--border-color); }
        .stats-period-card h3, .stats-general-card h3, .events-personalized-card h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
        .stats-period-controls {
          display: grid;
          grid-template-columns: minmax(140px, 1fr) minmax(140px, 1fr) minmax(180px, 1fr) auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 20px;
        }
        .stats-period-controls .form-input,
        .stats-period-controls .form-select {
          width: 100%;
          min-width: 0;
          height: 40px;
          padding: 0 12px;
          box-sizing: border-box;
        }
        .chart-type-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--surface-muted);
          justify-self: end;
        }
        .chart-type-toggle .chart-btn {
          min-width: 88px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          color: var(--gray-600);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .chart-type-toggle .chart-btn.active {
          background: rgba(var(--primary-rgb), 0.22);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: #eafff4;
        }
        .chart-type-toggle .chart-btn .icon {
          width: 14px;
          height: 14px;
        }
        .chart-type-toggle .chart-btn .chart-btn-label {
          line-height: 1;
        }
        @media (max-width: 900px) {
          .stats-period-controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .stats-period-controls .chart-type-toggle {
            grid-column: 1 / -1;
            justify-self: start;
          }
        }
        .stats-general-card { display: flex; flex-direction: column; gap: 0; }
        .stats-general-card h3 { text-align: left; margin-bottom: 10px; }
        .stats-general-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 12px 0;
          border-bottom: 1px solid var(--gray-100);
        }
        .stats-general-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .stats-general-label {
          font-size: 13px;
          color: var(--gray-600);
          line-height: 1.3;
        }
        .stats-general-value {
          font-weight: 700;
          font-size: 18px;
          margin-left: 12px;
          flex-shrink: 0;
        }
        .events-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .events-header h3 { margin: 0; }
        .events-controls { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-wrap: wrap; }
        .events-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 12px; color: var(--gray-500); }
        .events-summary strong { color: var(--gray-700); }
        .events-list { display: flex; flex-direction: column; gap: 10px; }
        .events-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 12px; align-items: center; padding: 12px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(12, 24, 40, 0.58); }
        .events-row-main { min-width: 0; }
        .events-row-name { font-weight: 700; color: var(--dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .events-row-key { font-size: 11px; color: var(--gray-500); }
        .events-row-count { font-size: 13px; color: var(--gray-600); white-space: nowrap; }
        .events-row-last { font-size: 12px; color: var(--gray-500); white-space: nowrap; }
        .events-row-actions { display: inline-flex; gap: 6px; }
        .events-loading, .events-error { padding: 14px; text-align: center; border: 1px dashed var(--border-color); border-radius: 10px; color: var(--gray-500); }
        .info-icon { cursor: help; opacity: 0.7; }
        .events-empty { text-align: center; padding: 40px 20px; color: var(--gray-500); }
        .events-empty-emoji { width: 48px; height: 48px; display: block; margin: 0 auto 16px; opacity: 0.6; background-color: var(--gray-400); }
        .custom-event-status { font-size: 11px; border-radius: 999px; padding: 3px 8px; border: 1px solid rgba(var(--primary-rgb), 0.25); color: var(--gray-500); background: rgba(12, 24, 40, 0.58); white-space: nowrap; }
        .custom-event-status.active { border-color: rgba(var(--primary-rgb), 0.45); color: #d8f4e6; background: rgba(var(--primary-rgb), 0.13); }
        .custom-event-status.inactive { border-color: rgba(148, 163, 184, 0.4); color: var(--gray-800); }
        .onboarding-card {
          margin-bottom: 24px;
          padding: 22px;
          border-radius: var(--border-radius-lg);
          border: 1px solid rgba(var(--primary-rgb), 0.32);
          box-shadow: var(--shadow-md);
          background:
            radial-gradient(circle at 16% 0%, rgba(var(--primary-rgb), 0.22), transparent 56%),
            linear-gradient(165deg, rgba(9, 18, 34, 0.98), rgba(6, 14, 28, 0.98));
        }
        .onboarding-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .onboarding-card-header h3 {
          margin: 0;
          font-size: 20px;
          color: #effaf7;
        }
        .onboarding-card-header p {
          margin: 6px 0 0;
          font-size: 13px;
          color: rgba(220, 236, 243, 0.8);
        }
        .onboarding-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(300px, 1.2fr);
          gap: 16px;
        }
        .onboarding-video-wrap {
          min-height: 210px;
          border-radius: 14px;
          border: 1px solid rgba(var(--primary-rgb), 0.24);
          background: rgba(6, 15, 30, 0.72);
          overflow: hidden;
        }
        .onboarding-video-placeholder {
          min-height: inherit;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 6px;
          text-align: center;
          padding: 18px;
          color: rgba(220, 236, 243, 0.82);
          font-size: 13px;
        }
        .onboarding-video-frame {
          width: 100%;
          height: 100%;
          min-height: 210px;
          border: 0;
          display: block;
        }
        .onboarding-video-open {
          margin-top: 10px;
          width: 100%;
          justify-content: center;
        }
        .onboarding-progress {
          margin-bottom: 12px;
        }
        .onboarding-progress-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .onboarding-progress-text {
          font-size: 13px;
          color: rgba(226, 242, 248, 0.88);
        }
        .onboarding-progress-track {
          width: 100%;
          height: 9px;
          border-radius: 999px;
          background: rgba(13, 31, 51, 0.9);
          border: 1px solid rgba(var(--primary-rgb), 0.2);
          overflow: hidden;
        }
        .onboarding-progress-fill {
          height: 100%;
          width: 0;
          border-radius: inherit;
          background: linear-gradient(90deg, #11d48f 0%, #20f0c0 100%);
          transition: width 0.25s ease;
        }
        .onboarding-steps {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .onboarding-step {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 11px;
          border-radius: 12px;
          border: 1px solid rgba(var(--primary-rgb), 0.16);
          background: rgba(8, 21, 38, 0.72);
        }
        .onboarding-step.is-complete {
          border-color: rgba(var(--primary-rgb), 0.46);
          box-shadow: inset 0 0 0 1px rgba(var(--primary-rgb), 0.2);
          background: rgba(12, 35, 55, 0.72);
        }
        .onboarding-step-info {
          min-width: 0;
        }
        .onboarding-step-title {
          margin: 0;
          color: #e7f8f2;
          font-size: 14px;
          font-weight: 600;
        }
        .onboarding-step-description {
          margin: 3px 0 0;
          color: rgba(194, 214, 224, 0.86);
          font-size: 12px;
        }
        .onboarding-step .checkbox-wrapper {
          margin-right: 2px;
        }
        .onboarding-actions {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
        }
        @media (max-width: 980px) {
          .onboarding-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .events-create-btn,
          .events-empty-create-btn { display: none !important; }
        }
        @media (max-width: 640px) {
          .dashboard-botconversa { gap: 14px; margin-bottom: 16px; }
          .stats-period-card, .stats-general-card, .events-personalized-card { padding: 12px; border-radius: 12px; }
          .stats-period-card h3, .stats-general-card h3, .events-personalized-card h3 { margin-bottom: 12px; font-size: 15px; }
          .onboarding-card { padding: 14px; border-radius: 12px; margin-bottom: 16px; }
          .onboarding-card-header { flex-direction: column; margin-bottom: 12px; }
          .onboarding-card-header h3 { font-size: 18px; }
          .onboarding-step { grid-template-columns: auto minmax(0, 1fr); }
          .onboarding-step .btn { grid-column: 2; justify-self: flex-start; }
          .onboarding-actions { justify-content: flex-start; }
          .dashboard-react .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .dashboard-react .stats-grid .stat-card {
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            gap: 8px;
            min-width: 0;
            padding: 12px;
            border-radius: 12px;
          }
          .dashboard-react .stats-grid .stat-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
          }
          .dashboard-react .stats-grid .stat-icon .icon {
            width: 16px;
            height: 16px;
          }
          .dashboard-react .stats-grid .stat-content {
            width: 100%;
            min-width: 0;
            text-align: left;
          }
          .dashboard-react .stats-grid .stat-value { font-size: 20px; }
          .dashboard-react .stats-grid .stat-label { font-size: 11px; line-height: 1.2; }
          .dashboard-react .stats-grid .stat-change {
            margin-top: 6px;
            font-size: 10px;
            padding: 2px 6px;
          }
          .stats-period-controls {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            align-items: stretch;
          }
          .stats-period-controls .form-input,
          .stats-period-controls .form-select {
            width: 100%;
            min-width: 0;
            height: 42px;
            padding: 0 12px;
            font-size: 12px;
            line-height: 1.2;
            border-radius: 12px;
            box-sizing: border-box;
            font-variant-numeric: tabular-nums;
            overflow: hidden;
          }
          .stats-period-controls input[type="date"] {
            padding-left: 8px;
            padding-right: 24px;
            font-size: 11px;
            letter-spacing: -0.01em;
          }
          .stats-period-controls input[type="date"]::-webkit-datetime-edit {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding: 0;
          }
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-text,
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-day-field,
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-month-field,
          .stats-period-controls input[type="date"]::-webkit-datetime-edit-year-field {
            padding: 0;
          }
          .stats-period-controls input[type="date"]::-webkit-calendar-picker-indicator {
            opacity: 0.9;
            cursor: pointer;
            margin-left: 4px;
          }
          .stats-period-controls .form-select {
            padding-left: 8px;
            padding-right: 24px;
            font-size: 11px;
            text-overflow: ellipsis;
            background-position: right 8px center;
            background-size: 9px;
          }
          .stats-period-controls .chart-type-toggle {
            grid-column: 1 / -1;
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            padding: 0;
            border: none;
            border-radius: 0;
            background: transparent;
            justify-self: stretch;
          }
          .stats-period-controls .chart-type-toggle .chart-btn {
            width: 100%;
            min-height: 40px;
            min-width: 0;
            border: 1px solid var(--border-color);
            background: var(--surface-muted);
          }
          .stats-period-chart canvas { max-height: 150px !important; }
          .stats-general-card {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            align-items: stretch;
          }
          .stats-general-card h3 {
            grid-column: 1 / -1;
            text-align: center;
            margin-bottom: 4px;
          }
          .stats-general-item {
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            gap: 4px;
            padding: 8px 6px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.24);
          }
          .stats-general-item:last-child { padding-bottom: 8px; }
          .stats-general-label { font-size: 12px; }
          .stats-general-value { font-size: 18px; margin-left: 0; }
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
          <select className="form-select" id="statsMetric">
            <option value="novos_contatos">Novos Contatos</option>
            <option value="mensagens">Mensagens</option>
            <option value="interacoes">Interações</option>
          </select>
          <div className="chart-type-toggle">
            <button type="button" className="chart-btn active" data-chart-type="line" title="Gráfico de linhas">
              <span className="icon icon-chart-line icon-sm"></span>
              <span className="chart-btn-label">Linha</span>
            </button>
            <button type="button" className="chart-btn" data-chart-type="bar" title="Gráfico de barras">
              <span className="icon icon-chart-bar icon-sm"></span>
              <span className="chart-btn-label">Barras</span>
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
          <span className="stats-general-label">Contatos com interação</span>
          <span className="stats-general-value" id="statsContacts">0</span>
        </div>
        <div className="stats-general-item">
          <span className="stats-general-label">Mensagens do contato</span>
          <span className="stats-general-value" id="statsMessages">0</span>
        </div>
        <div className="stats-general-item">
          <span className="stats-general-label">Interações por inscrito</span>
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
          <button className="btn btn-primary btn-sm events-create-btn" type="button" onClick={() => globals.openCustomEventModal?.()}>
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

const ONBOARDING_STEPS = [
  {
    id: 'connect_whatsapp',
    title: 'Conecte seu WhatsApp',
    description: 'Abra a tela de WhatsApp e conecte a primeira sessão.',
    actionLabel: 'Conectar'
  },
  {
    id: 'create_first_contact',
    title: 'Cadastre um contato',
    description: 'Crie um contato de teste para validar o fluxo.',
    actionLabel: 'Abrir contatos'
  },
  {
    id: 'open_inbox',
    title: 'Abra o Inbox',
    description: 'Inicie uma conversa para testar o atendimento.',
    actionLabel: 'Abrir inbox'
  },
  {
    id: 'create_tags',
    title: 'Crie tags',
    description: 'Cadastre etiquetas para segmentar contatos e campanhas.',
    actionLabel: 'Abrir tags'
  },
  {
    id: 'create_campaign',
    title: 'Monte uma campanha',
    description: 'Configure uma campanha simples e revise as métricas.',
    actionLabel: 'Abrir campanhas'
  },
  {
    id: 'create_flow',
    title: 'Publique um fluxo',
    description: 'Crie um fluxo de conversa com etapas de automação.',
    actionLabel: 'Abrir fluxos'
  }
] as const;

function OnboardingCard() {
  const globals = window as Window & DashboardGlobals;

  return (
    <section className="onboarding-card" id="dashboardOnboardingCard">
      <div className="onboarding-card-header">
        <div>
          <h3>Primeiros passos no ZapVender</h3>
          <p>Use este checklist para configurar sua conta e acelerar a ativação.</p>
        </div>
        <span className="badge badge-success" id="onboardingCompletedBadge" style={{ display: 'none' }}>
          Checklist concluído
        </span>
      </div>

      <div className="onboarding-grid">
        <div>
          <div className="onboarding-video-wrap">
            <div className="onboarding-video-placeholder" id="onboardingVideoPlaceholder">
              <strong>Vídeo inicial ainda não configurado</strong>
              <span id="onboardingVideoHint">Defina `onboarding_video_url` em Configurações para exibir aqui.</span>
            </div>
            <iframe
              id="onboardingVideoFrame"
              className="onboarding-video-frame"
              title="Guia de primeiros passos"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ display: 'none' }}
            ></iframe>
          </div>
          <a
            id="onboardingVideoOpenLink"
            className="btn btn-outline btn-sm onboarding-video-open"
            href="#/configuracoes"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'none' }}
          >
            Abrir vídeo em nova aba
          </a>
        </div>

        <div>
          <div className="onboarding-progress">
            <div className="onboarding-progress-head">
              <span className="onboarding-progress-text" id="onboardingProgressText">0/6 etapas concluídas</span>
            </div>
            <div className="onboarding-progress-track">
              <div className="onboarding-progress-fill" id="onboardingProgressFill"></div>
            </div>
          </div>

          <div className="onboarding-steps">
            {ONBOARDING_STEPS.map((step) => (
              <div className="onboarding-step" id={`onboarding-row-${step.id}`} key={step.id}>
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    id={`onboarding-step-${step.id}`}
                    onChange={(event) => globals.toggleOnboardingStep?.(step.id, event.currentTarget.checked)}
                  />
                  <span className="checkbox-custom"></span>
                </label>

                <div className="onboarding-step-info">
                  <p className="onboarding-step-title">{step.title}</p>
                  <p className="onboarding-step-description">{step.description}</p>
                </div>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => globals.goToOnboardingStep?.(step.id)}
                >
                  {step.actionLabel}
                </button>
              </div>
            ))}
          </div>

          <div className="onboarding-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => globals.resetOnboardingChecklist?.()}
            >
              Reiniciar checklist
            </button>
          </div>
        </div>
      </div>
    </section>
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
        <OnboardingCard />
        <StatsPeriod />
        <EventsCard />
        <StatsCards />
        <Funnel />
      </main>
      <LeadModals />
    </div>
  );
}
