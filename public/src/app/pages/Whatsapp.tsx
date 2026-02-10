import { useEffect } from 'react';

import { Link } from 'react-router-dom';
type WhatsappGlobals = {
  initWhatsapp?: () => void;
  startConnection?: () => void;
  disconnect?: () => void;
  toggleSidebar?: () => void;
  logout?: () => void;
};

export default function Whatsapp() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/whatsapp');

      if (cancelled) return;

      const win = window as Window & WhatsappGlobals;
      if (typeof win.initWhatsapp === 'function') {
        win.initWhatsapp();
      } else if (typeof (mod as { initWhatsapp?: () => void }).initWhatsapp === 'function') {
        (mod as { initWhatsapp?: () => void }).initWhatsapp?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & WhatsappGlobals;
  const toggleSidebar = () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
  };

  return (
    <div className="whatsapp-react">
            <style>{`
        .whatsapp-react {
            --primary: #178C49;
            --primary-light: #1FAE5E;
            --primary-dark: #0F6D35;
            --success: #10b981;
            --success-light: #34d399;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --dark: #0f172a;
            --gray: #64748b;
            --light: #f5f6fb;
            --lighter: #f8fafc;
            --white: #ffffff;
            --border: #e5e7eb;
            --whatsapp: #25D366;
            --shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
            --shadow-lg: 0 20px 50px rgba(15, 23, 42, 0.2);
        }

        .whatsapp-react .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 20px;
        }

        .whatsapp-react .header-title h1 {
            color: var(--dark);
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 5px;
        }

        .whatsapp-react .header-title p {
            color: var(--gray);
            font-size: 15px;
        }

        .whatsapp-react .whatsapp-tabs {
            display: flex;
            gap: 10px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .whatsapp-react .whatsapp-tab {
            padding: 8px 16px;
            border-radius: 20px;
            background: var(--lighter);
            color: var(--gray);
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
        }

        .whatsapp-react .whatsapp-tab:hover {
            background: rgba(109, 40, 217, 0.12);
            color: var(--primary);
        }

        .whatsapp-react .whatsapp-tab.active {
            background: var(--primary);
            color: white;
        }

        .whatsapp-react .status-badge {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 14px;
        }

        .whatsapp-react .status-badge.connected {
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
        }

        .whatsapp-react .status-badge.disconnected {
            background: rgba(239, 68, 68, 0.1);
            color: var(--danger);
        }

        .whatsapp-react .status-badge .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        .whatsapp-react .status-badge.connected .dot {
            background: var(--success);
        }

        .whatsapp-react .status-badge.disconnected .dot {
            background: var(--danger);
        }

        .whatsapp-react .whatsapp-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }

        .whatsapp-react .card {
            background: white;
            border-radius: 24px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
            overflow: hidden;
        }

        .whatsapp-react .card-header {
            padding: 24px 28px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .whatsapp-react .card-header-icon {
            width: 50px;
            height: 50px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
            border: 1px solid var(--border);
            background: var(--lighter);
        }

        .whatsapp-react .card-header-icon .icon {
            width: 20px;
            height: 20px;
        }

        .whatsapp-react .card-header-icon.green {
            color: var(--success);
            background: rgba(16, 185, 129, 0.08);
            border-color: rgba(16, 185, 129, 0.18);
        }

        .whatsapp-react .card-header-icon.blue {
            color: var(--info);
            background: rgba(59, 130, 246, 0.08);
            border-color: rgba(59, 130, 246, 0.18);
        }

        .whatsapp-react .card-header h2 {
            font-size: 20px;
            font-weight: 700;
            color: var(--dark);
        }

        .whatsapp-react .card-body {
            padding: 28px;
        }

        .whatsapp-react .qr-container {
            text-align: center;
            padding: 30px;
        }

        .whatsapp-react .qr-wrapper {
            background: white;
            padding: 25px;
            border-radius: 20px;
            display: inline-block;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
            margin-bottom: 25px;
            position: relative;
            min-width: 280px;
            min-height: 280px;
        }

        .whatsapp-react #qr-code {
            width: 230px;
            height: 230px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }

        .whatsapp-react #qr-code img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .whatsapp-react .qr-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 230px;
        }

        .whatsapp-react .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid var(--border);
            border-top-color: var(--whatsapp);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }

        .whatsapp-react .qr-loading p {
            color: var(--gray);
            font-size: 15px;
        }

        .whatsapp-react .qr-timer {
            color: var(--gray);
            font-size: 13px;
            margin-top: 15px;
        }

        .whatsapp-react .qr-timer strong {
            color: var(--primary);
        }

        .whatsapp-react .connected-state {
            text-align: center;
            padding: 40px 20px;
        }

        .whatsapp-react .connected-avatar {
            width: 100px;
            height: 100px;
            background: var(--success);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 700;
            color: white;
            margin: 0 auto 25px;
            box-shadow: 0 10px 24px rgba(16, 185, 129, 0.3);
        }

        .whatsapp-react .connected-state h3 {
            font-size: 22px;
            color: var(--dark);
            margin-bottom: 8px;
        }

        .whatsapp-react .connected-state p {
            color: var(--gray);
            font-size: 15px;
            margin-bottom: 25px;
        }

        .whatsapp-react .connected-info {
            background: var(--lighter);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 25px;
        }

        .whatsapp-react .connected-info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
        }

        .whatsapp-react .connected-info-row:last-child {
            border-bottom: none;
        }

        .whatsapp-react .connected-info-label {
            color: var(--gray);
            font-size: 14px;
        }

        .whatsapp-react .connected-info-value {
            color: var(--dark);
            font-weight: 600;
            font-size: 14px;
        }

        .whatsapp-react .btn {
            padding: 16px 28px;
            border: none;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.3s;
            width: 100%;
        }

        .whatsapp-react .btn-whatsapp {
            background: var(--whatsapp);
            color: white;
            box-shadow: 0 6px 14px rgba(37, 211, 102, 0.2);
        }

        .whatsapp-react .btn-whatsapp:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(37, 211, 102, 0.25);
        }

        .whatsapp-react .btn-whatsapp:disabled {
            background: var(--gray);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .whatsapp-react .btn-danger {
            background: var(--danger);
            color: white;
            box-shadow: 0 6px 14px rgba(239, 68, 68, 0.2);
        }

        .whatsapp-react .btn-danger:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(239, 68, 68, 0.25);
        }

        .whatsapp-react .btn-outline {
            background: white;
            border: 1px solid var(--border);
            color: var(--dark);
        }

        .whatsapp-react .btn-outline:hover {
            border-color: var(--primary);
            color: var(--primary);
        }

        .whatsapp-react .btn-primary {
            background: var(--primary);
            color: white;
            box-shadow: 0 6px 14px rgba(109, 40, 217, 0.2);
        }

        .whatsapp-react .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(109, 40, 217, 0.25);
        }

        .whatsapp-react .instructions {
            background: var(--lighter);
            border-radius: 16px;
            padding: 25px;
        }

        .whatsapp-react .instructions h3 {
            font-size: 16px;
            color: var(--dark);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .whatsapp-react .instruction-step {
            display: flex;
            gap: 15px;
            margin-bottom: 16px;
            align-items: flex-start;
        }

        .whatsapp-react .instruction-step:last-child {
            margin-bottom: 0;
        }

        .whatsapp-react .step-number {
            width: 32px;
            height: 32px;
            background: var(--primary);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            flex-shrink: 0;
        }

        .whatsapp-react .step-text {
            color: var(--dark);
            font-size: 14px;
            line-height: 1.6;
            padding-top: 4px;
        }

        .whatsapp-react .contacts-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .whatsapp-react .contacts-header h3 {
            font-size: 16px;
            color: var(--dark);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .whatsapp-react .contacts-count {
            background: var(--primary);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .whatsapp-react .contacts-list {
            max-height: 400px;
            overflow-y: auto;
        }

        .whatsapp-react .contact-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            border-radius: 12px;
            transition: all 0.2s;
            cursor: pointer;
        }

        .whatsapp-react .contact-item:hover {
            background: var(--lighter);
        }

        .whatsapp-react .contact-avatar {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 18px;
        }

        .whatsapp-react .contact-info {
            flex: 1;
        }

        .whatsapp-react .contact-name {
            font-weight: 600;
            color: var(--dark);
            font-size: 15px;
        }

        .whatsapp-react .contact-phone {
            color: var(--gray);
            font-size: 13px;
        }

        .whatsapp-react .contact-action {
            background: var(--whatsapp);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 10px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.3px;
            transition: all 0.2s;
        }

        .whatsapp-react .contact-action:hover {
            transform: scale(1.1);
        }

        .whatsapp-react .contacts-empty {
            text-align: center;
            padding: 50px 20px;
            color: var(--gray);
        }

        .whatsapp-react .contacts-empty .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 15px;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: var(--lighter);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--gray);
            font-size: 14px;
            font-weight: 600;
        }

        .whatsapp-react .toast-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
        }

        .whatsapp-react .toast {
            background: white;
            padding: 16px 24px;
            border-radius: 14px;
            box-shadow: var(--shadow-lg);
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 12px;
            animation: slideIn 0.3s ease;
            min-width: 280px;
        }

        .whatsapp-react .toast.success { border-left: 4px solid var(--success); }
        .whatsapp-react .toast.error { border-left: 4px solid var(--danger); }
        .whatsapp-react .toast.warning { border-left: 4px solid var(--warning); }
        .whatsapp-react .toast.info { border-left: 4px solid var(--info); }

        .whatsapp-react .toast-icon { font-size: 22px; }
        .whatsapp-react .toast-message { color: var(--dark); font-size: 14px; flex: 1; }

        @media (max-width: 1200px) {
            .whatsapp-react .whatsapp-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 768px) {
            .whatsapp-react .header-title h1 {
                font-size: 24px;
            }

            .whatsapp-react .qr-wrapper {
                min-width: 240px;
                min-height: 240px;
            }

            .whatsapp-react #qr-code {
                width: 200px;
                height: 200px;
            }
        }
            `}</style>
      <button className="mobile-menu-toggle" type="button" onClick={toggleSidebar}>
        {'\u2630'}
      </button>
      <div className="sidebar-overlay" onClick={toggleSidebar}></div>

      <aside className="sidebar" id="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src="img/logo-zapvender.svg" alt="ZapVender" className="brand-logo" /><span className="brand-text">ZapVender</span></Link>
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
                <Link to="/contatos" className="nav-link">
                  <span className="icon icon-contacts"></span>Contatos
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/campanhas" className="nav-link">
                  <span className="icon icon-campaigns"></span>Campanhas
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
                  <span className="badge" id="unreadBadge" style={{ display: 'none' }}>0</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Automação</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>Automação
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
                <Link to="/whatsapp" className="nav-link active">
                  <span className="icon icon-whatsapp"></span>WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>Configurações
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
              <div className="header">
                  <div className="header-title">
                      <h1>WhatsApp</h1>
                      <p>Conecte e gerencie suas mensagens</p>
                      <div className="whatsapp-tabs">
                          <Link to="/whatsapp" className="whatsapp-tab active">Conexão</Link>
                          <Link to="/inbox" className="whatsapp-tab">Conversas</Link>
                      </div>
                  </div>
                  
                  <div className="status-badge disconnected" id="status-badge">
                      <span className="dot"></span>
                      <span id="status-text">Desconectado</span>
                  </div>
              </div>
              
              <div className="whatsapp-grid">
                  <div className="card">
                      <div className="card-header">
                          <div className="card-header-icon green"><span className="icon icon-whatsapp"></span></div>
                          <h2>Conexão WhatsApp</h2>
                      </div>
                      
                      <div className="card-body">
                          <div id="disconnected-state">
                              <div className="qr-container">
                                  <div className="qr-wrapper">
                                      <div id="qr-code">
                                          <div className="qr-loading">
                                              <div className="spinner"></div>
                                              <p>Aguardando conexão...</p>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <p className="qr-timer" id="qr-timer" style={{ display: 'none' }}>
                                      Por segurança, o QR Code será atualizado em <strong id="timer-countdown">30</strong> segundos
                                  </p>
                                  
                                  <button className="btn btn-whatsapp" id="connect-btn" onClick={() => globals.startConnection?.()}>Conectar WhatsApp</button>
                              </div>
                              
                              <div className="instructions">
                                  <h3>Como conectar</h3>
                                  <div className="instruction-step">
                                      <span className="step-number">1</span>
                                      <span className="step-text">Clique em "Conectar WhatsApp" acima</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">2</span>
                                      <span className="step-text">Abra o WhatsApp no seu celular</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">3</span>
                                      <span className="step-text">Vá em Configurações &gt; Dispositivos conectados</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">4</span>
                                      <span className="step-text">Toque em "Conectar dispositivo"</span>
                                  </div>
                                  <div className="instruction-step">
                                      <span className="step-number">5</span>
                                      <span className="step-text">Escaneie o QR Code que aparecer</span>
                                  </div>
                              </div>
                          </div>
                          
                          <div id="connected-state" style={{ display: 'none' }}>
                                  <div className="connected-state">
                                      <div className="connected-avatar">OK</div>
                                  <h3>WhatsApp Conectado!</h3>
                                  <p>Seu WhatsApp está conectado e pronto para uso</p>
                                  
                                  <div className="connected-info">
                                      <div className="connected-info-row">
                                          <span className="connected-info-label">Nome</span>
                                          <span className="connected-info-value" id="user-name">-</span>
                                      </div>
                                      <div className="connected-info-row">
                                          <span className="connected-info-label">Número</span>
                                          <span className="connected-info-value" id="user-phone">-</span>
                                      </div>
                                      <div className="connected-info-row">
                                          <span className="connected-info-label">Status</span>
                                          <span className="connected-info-value" style={{ color: 'var(--success)' }}>Online</span>
                                      </div>
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
                                      <Link to="/inbox" className="btn btn-primary">Ir para Conversas</Link>
                                      <button className="btn btn-danger" onClick={() => globals.disconnect?.()}>Desconectar</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="card">
                      <div className="card-header">
                          <div className="card-header-icon blue"><span className="icon icon-contacts"></span></div>
                          <h2>Contatos Recentes</h2>
                      </div>
                      
                      <div className="card-body">
                          <div id="contacts-container">
                              <div className="contacts-empty" id="contacts-empty">
                                  <span className="icon icon-contacts"></span>
                                  <h3>Conecte o WhatsApp</h3>
                                  <p>Conecte seu WhatsApp para ver os contatos recentes</p>
                              </div>
                              
                              <div id="contacts-list-wrapper" style={{ display: 'none' }}>
                                  <div className="contacts-header">
                                      <h3>
                                          Lista de Contatos
                                      </h3>
                                      <span className="contacts-count" id="contacts-count">0</span>
                                  </div>
                                  <div className="contacts-list" id="contacts-list">
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </main>
          
          <div className="toast-container" id="toast-container"></div>
          
    </div>
  );
}


