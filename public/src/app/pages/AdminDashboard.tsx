import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clearPersistedAuthSession, clearSessionAuthStorage } from '../../core/authPersistence';
import { brandLogoUrl, brandName } from '../lib/brand';

type AppAdminUser = {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  is_active?: number;
  email_confirmed?: number;
  owner_user_id?: number;
  last_login_at?: string | null;
};

type AppAdminPlan = {
  name?: string;
  code?: string;
  status?: string;
  status_label?: string;
  renewal_date?: string | null;
  provider?: string;
  message?: string;
};

type AppAdminAccount = {
  owner_user_id: number;
  owner?: AppAdminUser | null;
  plan?: AppAdminPlan;
  totals?: {
    total_users?: number;
    active_users?: number;
    inactive_users?: number;
    admin_users?: number;
    pending_email_confirmation?: number;
  };
  users?: AppAdminUser[];
};

type AppAdminOverview = {
  generated_at?: string;
  summary?: {
    total_accounts?: number;
    total_users?: number;
    total_active_users?: number;
    total_inactive_users?: number;
    total_pending_email_confirmation?: number;
    plan_status_breakdown?: Record<string, number>;
  };
  accounts?: AppAdminAccount[];
};

type EmailSettingsResponse = {
  provider?: string;
  appName?: string;
  requestTimeoutMs?: number;
  mailgunFromEmail?: string;
  mailgunFromName?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  mailgunReplyToEmail?: string;
  mailgunReplyToName?: string;
  mailgunApiKeyMasked?: string;
  hasMailgunApiKey?: boolean;
  sendgridFromEmail?: string;
  sendgridFromName?: string;
  sendgridReplyToEmail?: string;
  sendgridReplyToName?: string;
  sendgridApiKeyMasked?: string;
  hasSendgridApiKey?: boolean;
  subjectTemplate?: string;
  htmlTemplate?: string;
  textTemplate?: string;
};

type AdminApiResponse<T> = {
  success?: boolean;
  error?: string;
  overview?: T;
  settings?: T;
  message?: string;
};

type ActiveTab = 'accounts' | 'email';

const DEFAULT_SUBJECT_TEMPLATE = 'Confirme seu cadastro no {{app_name}}';
const DEFAULT_TEXT_TEMPLATE = [
  'Ola {{name}},',
  '',
  'Para concluir seu cadastro no {{app_name}}, confirme seu email no link abaixo:',
  '{{confirmation_url}}',
  '',
  'Este link expira em {{expires_in_text}}.'
].join('\n');
const DEFAULT_HTML_TEMPLATE = [
  '<p>Ola {{name}},</p>',
  '<p>Para concluir seu cadastro no <strong>{{app_name}}</strong>, confirme seu email no link abaixo:</p>',
  '<p><a href="{{confirmation_url}}" target="_blank" rel="noopener noreferrer">Confirmar email</a></p>',
  '<p>Este link expira em {{expires_in_text}}.</p>'
].join('');

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR');
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

async function adminApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${window.location.origin}${endpoint}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearSessionAuthStorage();
    clearPersistedAuthSession();
    window.location.hash = '#/login';
    throw new Error('Sessao expirada');
  }

  if (!response.ok) {
    throw new Error(String(data?.error || 'Falha na requisicao'));
  }

  return data as T;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('accounts');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingEmailSettings, setLoadingEmailSettings] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [overview, setOverview] = useState<AppAdminOverview | null>(null);
  const [provider, setProvider] = useState('mailgun');
  const [appName, setAppName] = useState('ZapVender');
  const [requestTimeoutMs, setRequestTimeoutMs] = useState(10000);
  const [mailgunDomain, setMailgunDomain] = useState('');
  const [mailgunBaseUrl, setMailgunBaseUrl] = useState('https://api.mailgun.net');
  const [mailgunFromEmail, setMailgunFromEmail] = useState('');
  const [mailgunFromName, setMailgunFromName] = useState('ZapVender');
  const [mailgunReplyToEmail, setMailgunReplyToEmail] = useState('');
  const [mailgunReplyToName, setMailgunReplyToName] = useState('');
  const [mailgunApiKeyInput, setMailgunApiKeyInput] = useState('');
  const [removeMailgunApiKey, setRemoveMailgunApiKey] = useState(false);
  const [mailgunApiKeyMasked, setMailgunApiKeyMasked] = useState('');
  const [hasMailgunApiKey, setHasMailgunApiKey] = useState(false);
  const [sendgridFromEmail, setSendgridFromEmail] = useState('');
  const [sendgridFromName, setSendgridFromName] = useState('ZapVender');
  const [sendgridReplyToEmail, setSendgridReplyToEmail] = useState('');
  const [sendgridReplyToName, setSendgridReplyToName] = useState('');
  const [sendgridApiKeyInput, setSendgridApiKeyInput] = useState('');
  const [removeSendgridApiKey, setRemoveSendgridApiKey] = useState(false);
  const [sendgridApiKeyMasked, setSendgridApiKeyMasked] = useState('');
  const [hasSendgridApiKey, setHasSendgridApiKey] = useState(false);
  const [subjectTemplate, setSubjectTemplate] = useState(DEFAULT_SUBJECT_TEMPLATE);
  const [htmlTemplate, setHtmlTemplate] = useState(DEFAULT_HTML_TEMPLATE);
  const [textTemplate, setTextTemplate] = useState(DEFAULT_TEXT_TEMPLATE);
  const [savingEmailSettings, setSavingEmailSettings] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      if (cancelled) return;
      await Promise.all([loadOverview(), loadEmailSettings()]);
    };

    const loadOverview = async () => {
      setLoadingOverview(true);
      setOverviewError('');
      try {
        const response = await adminApiRequest<AdminApiResponse<AppAdminOverview>>('/api/admin/dashboard/overview');
        if (cancelled) return;
        setOverview(response?.overview || null);
      } catch (error) {
        if (cancelled) return;
        setOverviewError(error instanceof Error ? error.message : 'Falha ao carregar dashboard');
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    };

    const loadEmailSettings = async () => {
      setLoadingEmailSettings(true);
      setEmailError('');
      try {
        const response = await adminApiRequest<AdminApiResponse<EmailSettingsResponse>>('/api/admin/dashboard/email-settings');
        if (cancelled) return;
        const settings = response?.settings || {};

        setProvider(String(settings.provider || 'mailgun'));
        setAppName(String(settings.appName || 'ZapVender'));
        setRequestTimeoutMs(Number(settings.requestTimeoutMs || 10000));
        setMailgunDomain(String(settings.mailgunDomain || ''));
        setMailgunBaseUrl(String(settings.mailgunBaseUrl || 'https://api.mailgun.net'));
        setMailgunFromEmail(String(settings.mailgunFromEmail || ''));
        setMailgunFromName(String(settings.mailgunFromName || 'ZapVender'));
        setMailgunReplyToEmail(String(settings.mailgunReplyToEmail || ''));
        setMailgunReplyToName(String(settings.mailgunReplyToName || ''));
        setMailgunApiKeyMasked(String(settings.mailgunApiKeyMasked || ''));
        setHasMailgunApiKey(normalizeBoolean(settings.hasMailgunApiKey));
        setMailgunApiKeyInput('');
        setRemoveMailgunApiKey(false);
        setSendgridFromEmail(String(settings.sendgridFromEmail || ''));
        setSendgridFromName(String(settings.sendgridFromName || 'ZapVender'));
        setSendgridReplyToEmail(String(settings.sendgridReplyToEmail || ''));
        setSendgridReplyToName(String(settings.sendgridReplyToName || ''));
        setSendgridApiKeyMasked(String(settings.sendgridApiKeyMasked || ''));
        setHasSendgridApiKey(normalizeBoolean(settings.hasSendgridApiKey));
        setSendgridApiKeyInput('');
        setRemoveSendgridApiKey(false);
        setSubjectTemplate(String(settings.subjectTemplate || DEFAULT_SUBJECT_TEMPLATE));
        setHtmlTemplate(String(settings.htmlTemplate || DEFAULT_HTML_TEMPLATE));
        setTextTemplate(String(settings.textTemplate || DEFAULT_TEXT_TEMPLATE));
      } catch (error) {
        if (cancelled) return;
        setEmailError(error instanceof Error ? error.message : 'Falha ao carregar configuracoes');
      } finally {
        if (!cancelled) {
          setLoadingEmailSettings(false);
        }
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => overview?.summary || {}, [overview]);
  const accounts = useMemo(() => Array.isArray(overview?.accounts) ? overview.accounts : [], [overview]);

  const handleLogout = async () => {
    const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
    if (token) {
      try {
        await fetch(`${window.location.origin}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: '{}'
        });
      } catch (_) {
        // noop
      }
    }
    clearSessionAuthStorage();
    clearPersistedAuthSession();
    window.location.hash = '#/login';
  };

  const saveEmailSettings = async () => {
    setSavingEmailSettings(true);
    setEmailError('');
    setEmailSuccess('');

    try {
      const payload: Record<string, unknown> = {
        provider,
        appName,
        requestTimeoutMs,
        mailgunDomain,
        mailgunBaseUrl,
        mailgunFromEmail,
        mailgunFromName,
        mailgunReplyToEmail,
        mailgunReplyToName,
        sendgridFromEmail,
        sendgridFromName,
        sendgridReplyToEmail,
        sendgridReplyToName,
        subjectTemplate,
        htmlTemplate,
        textTemplate
      };

      if (removeMailgunApiKey) {
        payload.mailgunApiKey = '';
      } else if (String(mailgunApiKeyInput || '').trim()) {
        payload.mailgunApiKey = String(mailgunApiKeyInput || '').trim();
      }

      if (removeSendgridApiKey) {
        payload.sendgridApiKey = '';
      } else if (String(sendgridApiKeyInput || '').trim()) {
        payload.sendgridApiKey = String(sendgridApiKeyInput || '').trim();
      }

      const response = await adminApiRequest<AdminApiResponse<EmailSettingsResponse>>(
        '/api/admin/dashboard/email-settings',
        {
          method: 'PUT',
          body: JSON.stringify(payload)
        }
      );
      const settings = response?.settings || {};

      setProvider(String(settings.provider || 'mailgun'));
      setAppName(String(settings.appName || 'ZapVender'));
      setRequestTimeoutMs(Number(settings.requestTimeoutMs || 10000));
      setMailgunDomain(String(settings.mailgunDomain || ''));
      setMailgunBaseUrl(String(settings.mailgunBaseUrl || 'https://api.mailgun.net'));
      setMailgunFromEmail(String(settings.mailgunFromEmail || ''));
      setMailgunFromName(String(settings.mailgunFromName || 'ZapVender'));
      setMailgunReplyToEmail(String(settings.mailgunReplyToEmail || ''));
      setMailgunReplyToName(String(settings.mailgunReplyToName || ''));
      setMailgunApiKeyMasked(String(settings.mailgunApiKeyMasked || ''));
      setHasMailgunApiKey(normalizeBoolean(settings.hasMailgunApiKey));
      setMailgunApiKeyInput('');
      setRemoveMailgunApiKey(false);
      setSendgridFromEmail(String(settings.sendgridFromEmail || ''));
      setSendgridFromName(String(settings.sendgridFromName || 'ZapVender'));
      setSendgridReplyToEmail(String(settings.sendgridReplyToEmail || ''));
      setSendgridReplyToName(String(settings.sendgridReplyToName || ''));
      setSendgridApiKeyMasked(String(settings.sendgridApiKeyMasked || ''));
      setHasSendgridApiKey(normalizeBoolean(settings.hasSendgridApiKey));
      setSendgridApiKeyInput('');
      setRemoveSendgridApiKey(false);
      setSubjectTemplate(String(settings.subjectTemplate || DEFAULT_SUBJECT_TEMPLATE));
      setHtmlTemplate(String(settings.htmlTemplate || DEFAULT_HTML_TEMPLATE));
      setTextTemplate(String(settings.textTemplate || DEFAULT_TEXT_TEMPLATE));
      setEmailSuccess('Configuracoes salvas com sucesso.');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Falha ao salvar configuracoes');
    } finally {
      setSavingEmailSettings(false);
    }
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    setEmailError('');
    setEmailSuccess('');
    try {
      const response = await adminApiRequest<AdminApiResponse<EmailSettingsResponse>>(
        '/api/admin/dashboard/email-settings/test',
        {
          method: 'POST',
          body: JSON.stringify({ email: testEmail })
        }
      );
      setEmailSuccess(String(response?.message || 'Email de teste enviado com sucesso.'));
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Falha ao enviar email de teste');
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <div className="admin-dashboard-react">
      <style>{`
        .admin-dashboard-react .admin-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .admin-dashboard-react .admin-tab-btn { border: 1px solid var(--border-color); background: var(--surface-muted); color: var(--gray-700); padding: 10px 14px; border-radius: 10px; cursor: pointer; }
        .admin-dashboard-react .admin-tab-btn.active { background: rgba(var(--primary-rgb), 0.16); border-color: rgba(var(--primary-rgb), 0.35); color: #eafff4; font-weight: 700; }
        .admin-dashboard-react .admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .admin-dashboard-react .admin-stat { background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; }
        .admin-dashboard-react .admin-stat-label { color: var(--gray-600); font-size: 12px; margin-bottom: 6px; }
        .admin-dashboard-react .admin-stat-value { color: var(--gray-900); font-size: 22px; font-weight: 700; }
        .admin-dashboard-react .admin-account-card { background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 14px; overflow: hidden; }
        .admin-dashboard-react .admin-account-head { padding: 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .admin-dashboard-react .admin-account-name { font-size: 16px; font-weight: 700; color: var(--gray-900); }
        .admin-dashboard-react .admin-account-meta { color: var(--gray-600); font-size: 12px; }
        .admin-dashboard-react .admin-account-plan { text-align: right; }
        .admin-dashboard-react .admin-account-users { padding: 14px; }
        .admin-dashboard-react .admin-table-wrap { overflow-x: auto; }
        .admin-dashboard-react .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .admin-dashboard-react .admin-table th, .admin-dashboard-react .admin-table td { padding: 9px 10px; border-bottom: 1px solid var(--border-color); text-align: left; }
        .admin-dashboard-react .admin-table th { color: var(--gray-600); font-weight: 600; }
        .admin-dashboard-react .admin-table tr:last-child td { border-bottom: none; }
        .admin-dashboard-react .admin-settings-card { background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
        .admin-dashboard-react .admin-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .admin-dashboard-react .admin-form-group { margin-bottom: 12px; }
        .admin-dashboard-react .admin-form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: var(--gray-700); }
        .admin-dashboard-react .admin-form-group input, .admin-dashboard-react .admin-form-group select, .admin-dashboard-react .admin-form-group textarea { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--surface-muted); color: var(--gray-900); }
        .admin-dashboard-react .admin-form-group textarea { min-height: 120px; resize: vertical; font-family: monospace; font-size: 12px; }
        .admin-dashboard-react .admin-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
        .admin-dashboard-react .admin-muted { color: var(--gray-600); font-size: 12px; }
        .admin-dashboard-react .admin-error { color: #ef4444; margin-top: 10px; }
        .admin-dashboard-react .admin-success { color: #16a34a; margin-top: 10px; }
        @media (max-width: 900px) {
          .admin-dashboard-react .admin-settings-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <button
        className="mobile-menu-toggle"
        type="button"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      >
        {'\u2630'}
      </button>
      <div className="sidebar-overlay"></div>

      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <ul className="nav-menu">
              <li className="nav-item"><Link to="/dashboard" className="nav-link"><span className="icon icon-dashboard"></span>Painel</Link></li>
              <li className="nav-item"><Link to="/admin-dashboard" className="nav-link active"><span className="icon icon-settings"></span>Admin da Aplicacao</Link></li>
            </ul>
          </div>
        </nav>
        <div className="sidebar-footer">
          <button className="btn-logout" type="button" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div className="page-title">
            <h1>Dashboard Administrativo</h1>
            <p>Visao global de usuarios, planos e configuracao de envio de email.</p>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')} type="button">
            Contas e Planos
          </button>
          <button className={`admin-tab-btn ${activeTab === 'email' ? 'active' : ''}`} onClick={() => setActiveTab('email')} type="button">
            Configuracao de Email
          </button>
        </div>

        {activeTab === 'accounts' && (
          <>
            {loadingOverview && <div className="admin-muted">Carregando dados...</div>}
            {!loadingOverview && overviewError && <div className="admin-error">{overviewError}</div>}
            {!loadingOverview && !overviewError && (
              <>
                <div className="admin-grid">
                  <div className="admin-stat">
                    <div className="admin-stat-label">Contas</div>
                    <div className="admin-stat-value">{Number(summary.total_accounts || 0)}</div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">Usuarios</div>
                    <div className="admin-stat-value">{Number(summary.total_users || 0)}</div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">Usuarios ativos</div>
                    <div className="admin-stat-value">{Number(summary.total_active_users || 0)}</div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">Emails pendentes</div>
                    <div className="admin-stat-value">{Number(summary.total_pending_email_confirmation || 0)}</div>
                  </div>
                </div>

                <div className="admin-muted" style={{ marginBottom: 12 }}>
                  Ultima atualizacao: {formatDateTime(overview?.generated_at)}
                </div>

                {accounts.map((account) => (
                  <div className="admin-account-card" key={account.owner_user_id}>
                    <div className="admin-account-head">
                      <div>
                        <div className="admin-account-name">{String(account.owner?.name || account.owner?.email || `Conta ${account.owner_user_id}`)}</div>
                        <div className="admin-account-meta">
                          Owner ID: {account.owner_user_id} | Email: {String(account.owner?.email || '-')}
                        </div>
                        <div className="admin-account-meta">
                          Usuarios: {Number(account.totals?.total_users || 0)} | Ativos: {Number(account.totals?.active_users || 0)} | Pendentes de confirmacao: {Number(account.totals?.pending_email_confirmation || 0)}
                        </div>
                      </div>
                      <div className="admin-account-plan">
                        <div><strong>{String(account.plan?.name || 'Plano nao configurado')}</strong></div>
                        <div className="admin-account-meta">Status: {String(account.plan?.status_label || account.plan?.status || 'Nao configurado')}</div>
                        <div className="admin-account-meta">Provider: {String(account.plan?.provider || '-')}</div>
                        <div className="admin-account-meta">Renovacao: {formatDateTime(account.plan?.renewal_date)}</div>
                      </div>
                    </div>
                    <div className="admin-account-users">
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>Email</th>
                              <th>Perfil</th>
                              <th>Status</th>
                              <th>Email</th>
                              <th>Ultimo Login</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Array.isArray(account.users) ? account.users : []).map((item) => (
                              <tr key={`${account.owner_user_id}-${item.id || item.email}`}>
                                <td>{String(item.name || '-')}</td>
                                <td>{String(item.email || '-')}</td>
                                <td>{String(item.role || '-')}</td>
                                <td>{Number(item.is_active) > 0 ? 'Ativo' : 'Inativo'}</td>
                                <td>{Number(item.email_confirmed) > 0 ? 'Confirmado' : 'Pendente'}</td>
                                <td>{formatDateTime(item.last_login_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {activeTab === 'email' && (
          <div className="admin-settings-card">
            {loadingEmailSettings ? (
              <div className="admin-muted">Carregando configuracoes...</div>
            ) : (
              <>
                <div className="admin-settings-grid">
                  <div className="admin-form-group">
                    <label>Provider</label>
                    <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                      <option value="mailgun">Mailgun</option>
                      <option value="sendgrid">SendGrid</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Nome da aplicacao</label>
                    <input value={appName} onChange={(event) => setAppName(event.target.value)} />
                  </div>
                  <div className="admin-form-group">
                    <label>Timeout da requisicao (ms)</label>
                    <input type="number" min={1000} max={60000} value={requestTimeoutMs} onChange={(event) => setRequestTimeoutMs(Number(event.target.value || 10000))} />
                  </div>
                  {provider === 'mailgun' && (
                    <>
                      <div className="admin-form-group">
                        <label>MAILGUN_DOMAIN</label>
                        <input value={mailgunDomain} onChange={(event) => setMailgunDomain(event.target.value)} placeholder="mg.seu-dominio.com" />
                      </div>
                      <div className="admin-form-group">
                        <label>MAILGUN_BASE_URL</label>
                        <input value={mailgunBaseUrl} onChange={(event) => setMailgunBaseUrl(event.target.value)} placeholder="https://api.mailgun.net" />
                      </div>
                      <div className="admin-form-group">
                        <label>MAILGUN_FROM_EMAIL</label>
                        <input value={mailgunFromEmail} onChange={(event) => setMailgunFromEmail(event.target.value)} placeholder="no-reply@seu-dominio.com" />
                      </div>
                      <div className="admin-form-group">
                        <label>MAILGUN_FROM_NAME</label>
                        <input value={mailgunFromName} onChange={(event) => setMailgunFromName(event.target.value)} placeholder="ZapVender" />
                      </div>
                      <div className="admin-form-group">
                        <label>MAILGUN_REPLY_TO_EMAIL (opcional)</label>
                        <input value={mailgunReplyToEmail} onChange={(event) => setMailgunReplyToEmail(event.target.value)} placeholder="suporte@seu-dominio.com" />
                      </div>
                      <div className="admin-form-group">
                        <label>MAILGUN_REPLY_TO_NAME (opcional)</label>
                        <input value={mailgunReplyToName} onChange={(event) => setMailgunReplyToName(event.target.value)} />
                      </div>
                      <div className="admin-form-group">
                        <label>MAILGUN_API_KEY</label>
                        <input
                          type="password"
                          value={mailgunApiKeyInput}
                          onChange={(event) => setMailgunApiKeyInput(event.target.value)}
                          placeholder={hasMailgunApiKey ? 'Chave ja configurada. Preencha apenas se quiser substituir.' : 'Cole a API key do Mailgun'}
                        />
                        <div className="admin-muted">
                          Atual: {hasMailgunApiKey ? mailgunApiKeyMasked || 'Configurada' : 'Nao configurada'}
                        </div>
                        <label style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
                          <input type="checkbox" checked={removeMailgunApiKey} onChange={(event) => setRemoveMailgunApiKey(event.target.checked)} />
                          Remover chave salva
                        </label>
                      </div>
                    </>
                  )}
                  {provider === 'sendgrid' && (
                    <>
                      <div className="admin-form-group">
                        <label>SendGrid FROM email</label>
                        <input value={sendgridFromEmail} onChange={(event) => setSendgridFromEmail(event.target.value)} placeholder="no-reply@seu-dominio.com" />
                      </div>
                      <div className="admin-form-group">
                        <label>SendGrid FROM nome</label>
                        <input value={sendgridFromName} onChange={(event) => setSendgridFromName(event.target.value)} placeholder="ZapVender" />
                      </div>
                      <div className="admin-form-group">
                        <label>Reply-To email (opcional)</label>
                        <input value={sendgridReplyToEmail} onChange={(event) => setSendgridReplyToEmail(event.target.value)} placeholder="suporte@seu-dominio.com" />
                      </div>
                      <div className="admin-form-group">
                        <label>Reply-To nome (opcional)</label>
                        <input value={sendgridReplyToName} onChange={(event) => setSendgridReplyToName(event.target.value)} />
                      </div>
                      <div className="admin-form-group">
                        <label>SENDGRID_API_KEY</label>
                        <input
                          type="password"
                          value={sendgridApiKeyInput}
                          onChange={(event) => setSendgridApiKeyInput(event.target.value)}
                          placeholder={hasSendgridApiKey ? 'Chave ja configurada. Preencha apenas se quiser substituir.' : 'Cole a API key do SendGrid'}
                        />
                        <div className="admin-muted">
                          Atual: {hasSendgridApiKey ? sendgridApiKeyMasked || 'Configurada' : 'Nao configurada'}
                        </div>
                        <label style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
                          <input type="checkbox" checked={removeSendgridApiKey} onChange={(event) => setRemoveSendgridApiKey(event.target.checked)} />
                          Remover chave salva
                        </label>
                      </div>
                    </>
                  )}
                </div>

                <div className="admin-form-group">
                  <label>Template - Assunto</label>
                  <input value={subjectTemplate} onChange={(event) => setSubjectTemplate(event.target.value)} />
                </div>
                <div className="admin-form-group">
                  <label>Template - HTML</label>
                  <textarea value={htmlTemplate} onChange={(event) => setHtmlTemplate(event.target.value)} />
                </div>
                <div className="admin-form-group">
                  <label>Template - Texto</label>
                  <textarea value={textTemplate} onChange={(event) => setTextTemplate(event.target.value)} />
                </div>
                <div className="admin-muted">
                  Variaveis disponiveis: {'{{name}}'}, {'{{email}}'}, {'{{confirmation_url}}'}, {'{{app_name}}'}, {'{{expires_in_text}}'}
                </div>

                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={saveEmailSettings} disabled={savingEmailSettings}>
                    {savingEmailSettings ? 'Salvando...' : 'Salvar configuracoes'}
                  </button>
                  <input
                    type="email"
                    className="form-input"
                    style={{ maxWidth: 320 }}
                    placeholder="email@destino.com"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                  />
                  <button type="button" className="btn btn-outline" onClick={sendTestEmail} disabled={sendingTestEmail}>
                    {sendingTestEmail ? 'Enviando teste...' : 'Enviar teste'}
                  </button>
                </div>

                {emailError && <div className="admin-error">{emailError}</div>}
                {emailSuccess && <div className="admin-success">{emailSuccess}</div>}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
