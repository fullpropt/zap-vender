import { useEffect } from 'react';

type TransmissaoGlobals = {
  initTransmissao?: () => void;
  loadQueueStatus?: () => void;
  clearQueue?: () => void;
  pauseQueue?: () => void;
  selectAll?: () => void;
  deselectAll?: () => void;
  filterRecipients?: () => void;
  loadTemplate?: () => void;
  updatePreview?: () => void;
  startBroadcast?: () => void;
  logout?: () => void;
};

export default function Transmissao() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/transmissao');

      if (cancelled) return;

      const win = window as Window & TransmissaoGlobals;
      if (typeof win.initTransmissao === 'function') {
        win.initTransmissao();
      } else if (typeof (mod as { initTransmissao?: () => void }).initTransmissao === 'function') {
        (mod as { initTransmissao?: () => void }).initTransmissao?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & TransmissaoGlobals;

  return (
    <div className="transmissao-react">
      <style>{`
        .broadcast-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
        }
        @media (max-width: 1024px) {
            .broadcast-container { grid-template-columns: 1fr; }
        }
        .recipient-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
        }
        .recipient-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            border-bottom: 1px solid var(--border-color);
            cursor: pointer;
            transition: background 0.2s;
        }
        .recipient-item:hover { background: var(--gray-50); }
        .recipient-item:last-child { border-bottom: none; }
        .recipient-item.selected { background: rgba(var(--primary-rgb), 0.1); }
        .recipient-info { flex: 1; }
        .recipient-name { font-weight: 600; font-size: 14px; }
        .recipient-phone { font-size: 12px; color: var(--gray-500); }
        .message-preview {
            background: var(--whatsapp-light);
            border-radius: 12px;
            padding: 15px;
            margin-top: 15px;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .queue-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
        }
        .queue-item:last-child { border-bottom: none; }
        .queue-status {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }
        .queue-status.pending { background: var(--warning); }
        .queue-status.processing { background: var(--info); animation: pulse 1s infinite; }
        .queue-status.sent { background: var(--success); }
        .queue-status.failed { background: var(--danger); }
        .progress-container {
            background: white;
            border-radius: var(--border-radius-lg);
            padding: 20px;
            box-shadow: var(--shadow-md);
            margin-bottom: 25px;
        }
        .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .progress-stats {
            display: flex;
            gap: 30px;
            margin-top: 15px;
        }
        .progress-stat {
            text-align: center;
        }
        .progress-stat-value {
            font-size: 24px;
            font-weight: 700;
        }
        .progress-stat-label {
            font-size: 12px;
            color: var(--gray-500);
        }
      `}</style>

      <button
        className="mobile-menu-toggle"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      >
        â˜°
      </button>
      <div className="sidebar-overlay"></div>

      <aside className="sidebar">
        <div className="sidebar-header">
          <a href="app.html#/dashboard" className="sidebar-logo">
            <img src="img/logo-self.png" alt="SELF" />
            <span>SELF</span>
          </a>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <ul className="nav-menu">
              <li className="nav-item">
                <a href="app.html#/dashboard" className="nav-link">
                  <span className="icon icon-dashboard"></span>Painel de Controle
                </a>
              </li>
              <li className="nav-item">
                <a href="app.html#/contatos" className="nav-link">
                  <span className="icon icon-contacts"></span>Contatos
                </a>
              </li>
              <li className="nav-item">
                <a href="app.html#/campanhas" className="nav-link">
                  <span className="icon icon-campaigns"></span>Campanhas
                </a>
              </li>
              <li className="nav-item">
                <a href="app.html#/transmissao" className="nav-link active">
                  <span className="icon icon-broadcast"></span>TransmissÃ£o
                </a>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <a href="app.html#/inbox" className="nav-link">
                  <span className="icon icon-inbox"></span>Inbox
                  <span className="badge" style={{ display: 'none' }}>0</span>
                </a>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">AutomaÃ§Ã£o</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <a href="app.html#/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>AutomaÃ§Ã£o
                </a>
              </li>
              <li className="nav-item">
                <a href="app.html#/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>Fluxos de Conversa
                </a>
              </li>
              <li className="nav-item">
                <a href="app.html#/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>Funil de Vendas
                </a>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <a href="app.html#/whatsapp" className="nav-link">
                  <span className="icon icon-whatsapp"></span>WhatsApp
                </a>
              </li>
              <li className="nav-item">
                <a href="app.html#/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>ConfiguraÃ§Ãµes
                </a>
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
            <h1><span className="icon icon-broadcast icon-sm"></span> TransmissÃ£o em Lote</h1>
            <p>Envie mensagens para mÃºltiplos contatos com automaÃ§Ã£o de tempo</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-outline" onClick={() => globals.loadQueueStatus?.()}>
              <span className="icon icon-refresh icon-sm"></span> Atualizar Fila
            </button>
            <button className="btn btn-danger" onClick={() => globals.clearQueue?.()}>
              <span className="icon icon-delete icon-sm"></span> Limpar Fila
            </button>
          </div>
        </div>

        <div className="progress-container" id="queueProgress" style={{ display: 'none' }}>
          <div className="progress-header">
            <div>
              <h3 style={{ margin: 0 }}>
                <span className="icon icon-export icon-sm"></span> Envio em Andamento
              </h3>
              <p style={{ color: 'var(--gray-500)', margin: '5px 0 0' }}>
                Aguarde enquanto as mensagens sÃ£o enviadas
              </p>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => globals.pauseQueue?.()}>
              <span className="icon icon-pause icon-sm"></span> Pausar
            </button>
          </div>
          <div className="progress" style={{ height: '12px' }}>
            <div className="progress-bar" id="progressBar" style={{ width: '0%' }}></div>
          </div>
          <div className="progress-stats">
            <div className="progress-stat">
              <div className="progress-stat-value text-success" id="sentCount">0</div>
              <div className="progress-stat-label">Enviadas</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-value text-warning" id="pendingCount">0</div>
              <div className="progress-stat-label">Pendentes</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-value text-danger" id="failedCount">0</div>
              <div className="progress-stat-label">Falhas</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-value" id="etaTime">--:--</div>
              <div className="progress-stat-label">Tempo Restante</div>
            </div>
          </div>
        </div>

        <div className="broadcast-container">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span className="icon icon-contacts icon-sm"></span> DestinatÃ¡rios</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-sm btn-outline" onClick={() => globals.selectAll?.()}>Selecionar Todos</button>
                <button className="btn btn-sm btn-outline" onClick={() => globals.deselectAll?.()}>Limpar</button>
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <div className="search-box" style={{ maxWidth: '100%' }}>
                  <span className="search-icon icon icon-search icon-sm"></span>
                  <input
                    type="text"
                    id="searchRecipients"
                    placeholder="Buscar contatos..."
                    onKeyUp={() => globals.filterRecipients?.()}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <select className="form-select" id="filterStatus" onChange={() => globals.filterRecipients?.()}>
                    <option value="">Todos os Status</option>
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">ConcluÃ­do</option>
                  </select>
                </div>
                <div className="form-group">
                  <select className="form-select" id="filterTag" onChange={() => globals.filterRecipients?.()}>
                    <option value="">Todas as Tags</option>
                  </select>
                </div>
              </div>
              <div className="recipient-list" id="recipientList">
                <div className="empty-state">
                  <div className="empty-state-icon icon icon-empty icon-lg"></div>
                  <p>Carregando contatos...</p>
                </div>
              </div>
              <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted"><strong id="selectedCount">0</strong> selecionados</span>
                <span className="text-muted"><strong id="totalCount">0</strong> total</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><span className="icon icon-message icon-sm"></span> Mensagem</div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Template</label>
                <select className="form-select" id="templateSelect" onChange={() => globals.loadTemplate?.()}>
                  <option value="">Selecione um template...</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Mensagem</label>
                <textarea
                  className="form-textarea"
                  id="messageContent"
                  rows={6}
                  placeholder={`Digite sua mensagem aqui...\n\nUse variÃ¡veis para personalizar:\n{{nome}} - Nome do contato\n{{veiculo}} - VeÃ­culo\n{{placa}} - Placa`}
                  onKeyUp={() => globals.updatePreview?.()}
                ></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">PrÃ©-visualizaÃ§Ã£o</label>
                <div className="message-preview" id="messagePreview">
                  A mensagem aparecerÃ¡ aqui...
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Intervalo entre mensagens</label>
                  <select className="form-select" id="messageDelay" defaultValue="5000">
                    <option value="2000">2 segundos</option>
                    <option value="3000">3 segundos</option>
                    <option value="5000">5 segundos</option>
                    <option value="10000">10 segundos</option>
                    <option value="15000">15 segundos</option>
                    <option value="30000">30 segundos</option>
                    <option value="60000">1 minuto</option>
                    <option value="120000">2 minutos</option>
                    <option value="300000">5 minutos</option>
                  </select>
                  <p className="form-help">Tempo de espera entre cada envio</p>
                </div>
                <div className="form-group">
                  <label className="form-label">InÃ­cio do envio</label>
                  <select className="form-select" id="startTime">
                    <option value="now">Imediatamente</option>
                    <option value="scheduled">Agendar horÃ¡rio</option>
                  </select>
                </div>
              </div>
              <div className="form-group" id="scheduledTimeGroup" style={{ display: 'none' }}>
                <label className="form-label">Data e Hora</label>
                <input type="datetime-local" className="form-input" id="scheduledDateTime" />
              </div>
              <div className="form-group">
                <label className="checkbox-wrapper">
                  <input type="checkbox" id="randomizeOrder" />
                  <span className="checkbox-custom"></span>
                  <span>Randomizar ordem de envio</span>
                </label>
              </div>
              <div className="form-group">
                <label className="checkbox-wrapper">
                  <input type="checkbox" id="skipSent" />
                  <span className="checkbox-custom"></span>
                  <span>Pular contatos jÃ¡ contatados hoje</span>
                </label>
              </div>
            </div>
            <div className="card-footer">
              <button className="btn btn-whatsapp w-100" onClick={() => globals.startBroadcast?.()} id="startBtn">
                <span className="icon icon-play icon-sm"></span> Iniciar TransmissÃ£o
              </button>
            </div>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header">
            <div className="card-title"><span className="icon icon-message icon-sm"></span> Fila de Mensagens</div>
            <button className="btn btn-sm btn-outline" onClick={() => globals.loadQueueStatus?.()}>
              <span className="icon icon-refresh icon-sm"></span> Atualizar
            </button>
          </div>
          <div className="card-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div id="queueList">
              <div className="empty-state">
                <div className="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhuma mensagem na fila</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
