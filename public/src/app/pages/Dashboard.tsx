import { useEffect } from 'react';
import {
  dashboardAfterMarkup,
  dashboardContentMarkup,
  dashboardShellMarkup
} from '../legacy/dashboardMarkup';

type DashboardGlobals = {
  initDashboard?: () => void;
  loadDashboardData?: () => void;
  openModal?: (id: string) => void;
  exportLeads?: () => void;
  confirmReset?: () => void;
};

function DashboardHeader() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="page-header">
      <div className="page-title">
        <h1>Painel de Controle</h1>
        <p>
          Bem-vindo, <span className="user-name">Usuário</span> |{' '}
          <span className="current-date"></span>
        </p>
      </div>
      <div className="page-actions">
        <button type="button" className="btn btn-outline" onClick={() => globals.loadDashboardData?.()}>
          <span className="icon icon-refresh icon-sm"></span>
          Atualizar
        </button>
        <button type="button" className="btn btn-outline" onClick={() => globals.openModal?.('importModal')}>
          <span className="icon icon-import icon-sm"></span>
          Importar
        </button>
        <button type="button" className="btn btn-success" onClick={() => globals.exportLeads?.()}>
          <span className="icon icon-export icon-sm"></span>
          Exportar
        </button>
        <button type="button" className="btn btn-whatsapp" onClick={() => { window.location.href = 'transmissao.html'; }}>
          <span className="icon icon-batch icon-sm"></span>
          Lote
        </button>
        <button type="button" className="btn btn-outline-danger" onClick={() => globals.confirmReset?.()}>
          <span className="icon icon-reset icon-sm"></span>
          Reset
        </button>
      </div>
    </div>
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

  return (
    <div className="dashboard-react">
      <div dangerouslySetInnerHTML={{ __html: dashboardShellMarkup }} />
      <main className="main-content">
        <DashboardHeader />
        <div dangerouslySetInnerHTML={{ __html: dashboardContentMarkup }} />
      </main>
      <div dangerouslySetInnerHTML={{ __html: dashboardAfterMarkup }} />
    </div>
  );
}