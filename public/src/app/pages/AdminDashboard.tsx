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
  is_primary_admin?: boolean;
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

type AdminApiResponse = {
  success?: boolean;
  error?: string;
  overview?: AppAdminOverview;
  settings?: EmailSettingsResponse;
  message?: string;
  disabled_users?: number;
};

type AccountEditDraft = {
  ownerUserId: number;
  name: string;
  email: string;
  isActive: boolean;
  planName: string;
  planCode: string;
  planStatus: string;
  planProvider: string;
  planMessage: string;
  planRenewalDate: string;
};

type UserEditDraft = {
  userId: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  emailConfirmed: boolean;
  isPrimaryAdmin: boolean;
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

const PLAN_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'trialing', label: 'Em teste' },
  { value: 'past_due', label: 'Pagamento pendente' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'expired', label: 'Expirado' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'unknown', label: 'Nao configurado' }
];

const USER_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'agent', label: 'Agente' }
];

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR');
}

function formatDateInput(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 1 || value === '1';
}

function normalizePlanStatus(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return PLAN_STATUS_OPTIONS.some((item) => item.value === normalized) ? normalized : 'unknown';
}

function planStatusLabel(value: unknown) {
  const normalized = normalizePlanStatus(value);
  return PLAN_STATUS_OPTIONS.find((item) => item.value === normalized)?.label || 'Nao configurado';
}

function normalizeRole(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return USER_ROLE_OPTIONS.some((item) => item.value === normalized) ? normalized : 'agent';
}

function roleLabel(value: unknown) {
  const normalized = normalizeRole(value);
  return USER_ROLE_OPTIONS.find((item) => item.value === normalized)?.label || 'Agente';
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function adminApiRequest(endpoint: string, options: RequestInit = {}): Promise<AdminApiResponse> {
  const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {})
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

  return data as AdminApiResponse;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('accounts');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingEmailSettings, setLoadingEmailSettings] = useState(true);
  const [overview, setOverview] = useState<AppAdminOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [overviewMessage, setOverviewMessage] = useState('');
  const [overviewBusyKey, setOverviewBusyKey] = useState('');

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
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const [accountDraft, setAccountDraft] = useState<AccountEditDraft | null>(null);
  const [userDraft, setUserDraft] = useState<UserEditDraft | null>(null);

  const summary = useMemo(() => overview?.summary || {}, [overview]);
  const accounts = useMemo(() => (Array.isArray(overview?.accounts) ? overview.accounts : []), [overview]);

  const loadOverview = async (options: { silent?: boolean } = {}) => {
    const silent = options.silent === true;
    if (!silent) setLoadingOverview(true);
    try {
      const response = await adminApiRequest('/api/admin/dashboard/overview');
      setOverview(response?.overview || null);
      if (!silent) setOverviewError('');
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao carregar dashboard');
    } finally {
      if (!silent) setLoadingOverview(false);
    }
  };

  const loadEmailSettings = async () => {
    setLoadingEmailSettings(true);
    setEmailError('');
    try {
      const response = await adminApiRequest('/api/admin/dashboard/email-settings');
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
      setEmailError(error instanceof Error ? error.message : 'Falha ao carregar configuracoes');
    } finally {
      setLoadingEmailSettings(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      await import('../../core/app');
      if (cancelled) return;
      await Promise.all([loadOverview(), loadEmailSettings()]);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
    if (token) {
      try {
        await fetch(`${window.location.origin}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
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
  const openAccountEditor = (account: AppAdminAccount) => {
    setOverviewError('');
    setOverviewMessage('');
    setAccountDraft({
      ownerUserId: Number(account.owner_user_id || 0),
      name: String(account.owner?.name || ''),
      email: String(account.owner?.email || ''),
      isActive: Number(account.owner?.is_active) > 0,
      planName: String(account.plan?.name || ''),
      planCode: String(account.plan?.code || ''),
      planStatus: normalizePlanStatus(account.plan?.status),
      planProvider: String(account.plan?.provider || ''),
      planMessage: String(account.plan?.message || ''),
      planRenewalDate: formatDateInput(account.plan?.renewal_date)
    });
  };

  const submitAccountEdit = async () => {
    if (!accountDraft) return;
    if (!accountDraft.name.trim()) {
      setOverviewError('Informe o nome do admin principal da conta');
      return;
    }
    if (!isValidEmailAddress(accountDraft.email)) {
      setOverviewError('Informe um e-mail valido para a conta');
      return;
    }

    const busyKey = `account-edit-${accountDraft.ownerUserId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      await adminApiRequest(`/api/admin/dashboard/accounts/${accountDraft.ownerUserId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: accountDraft.name.trim(),
          email: accountDraft.email.trim().toLowerCase(),
          is_active: accountDraft.isActive ? 1 : 0,
          plan: {
            name: accountDraft.planName.trim(),
            code: accountDraft.planCode.trim(),
            status: normalizePlanStatus(accountDraft.planStatus),
            provider: accountDraft.planProvider.trim(),
            message: accountDraft.planMessage.trim(),
            renewal_date: accountDraft.planRenewalDate || null
          }
        })
      });

      setAccountDraft(null);
      setOverviewMessage('Conta atualizada com sucesso.');
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao atualizar conta');
    } finally {
      setOverviewBusyKey('');
    }
  };

  const deactivateAccount = async (ownerUserId: number) => {
    if (!ownerUserId) return;
    const confirmed = window.confirm('Desativar esta conta vai bloquear todos os usuarios vinculados. Deseja continuar?');
    if (!confirmed) return;

    const busyKey = `account-delete-${ownerUserId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      const response = await adminApiRequest(`/api/admin/dashboard/accounts/${ownerUserId}`, { method: 'DELETE' });
      const disabledUsers = Number(response?.disabled_users || 0);
      setOverviewMessage(disabledUsers > 0 ? `Conta desativada. ${disabledUsers} usuario(s) bloqueados.` : 'Conta desativada com sucesso.');
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao desativar conta');
    } finally {
      setOverviewBusyKey('');
    }
  };

  const openUserEditor = (user: AppAdminUser) => {
    setOverviewError('');
    setOverviewMessage('');
    setUserDraft({
      userId: Number(user.id || 0),
      name: String(user.name || ''),
      email: String(user.email || ''),
      role: normalizeRole(user.role),
      isActive: Number(user.is_active) > 0,
      emailConfirmed: Number(user.email_confirmed) > 0,
      isPrimaryAdmin: user.is_primary_admin === true
    });
  };

  const submitUserEdit = async () => {
    if (!userDraft) return;
    if (!userDraft.name.trim()) {
      setOverviewError('Informe o nome do usuario');
      return;
    }
    if (!isValidEmailAddress(userDraft.email)) {
      setOverviewError('Informe um e-mail valido para o usuario');
      return;
    }

    const busyKey = `user-edit-${userDraft.userId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      await adminApiRequest(`/api/admin/dashboard/users/${userDraft.userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: userDraft.name.trim(),
          email: userDraft.email.trim().toLowerCase(),
          role: normalizeRole(userDraft.role),
          is_active: userDraft.isActive ? 1 : 0,
          email_confirmed: userDraft.emailConfirmed ? 1 : 0
        })
      });

      setUserDraft(null);
      setOverviewMessage('Usuario atualizado com sucesso.');
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao atualizar usuario');
    } finally {
      setOverviewBusyKey('');
    }
  };

  const deactivateUser = async (user: AppAdminUser) => {
    const userId = Number(user.id || 0);
    if (!userId) return;
    if (user.is_primary_admin === true) {
      setOverviewError('O admin principal deve ser gerenciado pela conta.');
      return;
    }

    const confirmed = window.confirm('Deseja desativar este usuario?');
    if (!confirmed) return;

    const busyKey = `user-delete-${userId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      await adminApiRequest(`/api/admin/dashboard/users/${userId}`, { method: 'DELETE' });
      setOverviewMessage('Usuario desativado com sucesso.');
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao desativar usuario');
    } finally {
      setOverviewBusyKey('');
    }
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

      const response = await adminApiRequest('/api/admin/dashboard/email-settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
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
      const response = await adminApiRequest('/api/admin/dashboard/email-settings/test', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail })
      });
      setEmailSuccess(String(response?.message || 'Email de teste enviado com sucesso.'));
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Falha ao enviar email de teste');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const accountEditBusy = accountDraft && overviewBusyKey === `account-edit-${accountDraft.ownerUserId}`;
  const userEditBusy = userDraft && overviewBusyKey === `user-edit-${userDraft.userId}`;

  return (
    <div className="admin-dashboard-react">
      <style>{`
        .admin-dashboard-react .admin-tabs { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .admin-dashboard-react .admin-tab-btn { border: 1px solid var(--border-color); background: var(--surface-muted); color: var(--gray-700); padding: 10px 14px; border-radius: 10px; cursor: pointer; }
        .admin-dashboard-react .admin-tab-btn.active { background: linear-gradient(120deg, rgba(var(--primary-rgb), 0.24) 0%, rgba(16, 148, 98, 0.12) 100%); border-color: rgba(var(--primary-rgb), 0.45); color: #eafff4; font-weight: 700; }
        .admin-dashboard-react .admin-overview-hero { border: 1px solid rgba(var(--primary-rgb), 0.2); background: radial-gradient(520px 180px at 0% 0%, rgba(var(--primary-rgb), 0.16), rgba(24, 36, 54, 0) 58%), var(--surface); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
        .admin-dashboard-react .admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .admin-dashboard-react .admin-stat { background: linear-gradient(180deg, rgba(35, 50, 71, 0.75), rgba(24, 36, 54, 0.88)); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; }
        .admin-dashboard-react .admin-stat-label { color: var(--gray-600); font-size: 12px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .admin-dashboard-react .admin-stat-value { color: var(--gray-900); font-size: 24px; font-weight: 700; line-height: 1.1; }
        .admin-dashboard-react .admin-breakdown { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .admin-dashboard-react .admin-badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; border: 1px solid rgba(148, 163, 184, 0.36); background: rgba(15, 23, 42, 0.46); color: var(--gray-700); font-size: 12px; padding: 5px 10px; }
        .admin-dashboard-react .admin-badge strong { color: #d8e3f4; font-weight: 700; }
        .admin-dashboard-react .admin-alert { margin-bottom: 12px; border-radius: 10px; padding: 10px 12px; border: 1px solid transparent; font-size: 13px; }
        .admin-dashboard-react .admin-alert-error { border-color: rgba(248, 113, 113, 0.45); background: rgba(59, 21, 27, 0.65); color: #fca5a5; }
        .admin-dashboard-react .admin-alert-success { border-color: rgba(34, 197, 94, 0.42); background: rgba(19, 52, 35, 0.66); color: #86efac; }
        .admin-dashboard-react .admin-account-card { background: linear-gradient(180deg, rgba(24, 36, 54, 0.94), rgba(15, 23, 42, 0.96)); border: 1px solid rgba(49, 65, 87, 0.95); border-radius: 14px; margin-bottom: 14px; overflow: hidden; }
        .admin-dashboard-react .admin-account-head { padding: 14px; border-bottom: 1px solid rgba(49, 65, 87, 0.95); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .admin-dashboard-react .admin-account-name { margin: 0; font-size: 18px; font-weight: 700; color: #e6f4ec; }
        .admin-dashboard-react .admin-account-meta { color: var(--gray-600); font-size: 12px; margin-top: 4px; }
        .admin-dashboard-react .admin-account-tags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
        .admin-dashboard-react .admin-pill { display: inline-flex; align-items: center; font-size: 11px; line-height: 1; border-radius: 999px; padding: 6px 10px; border: 1px solid rgba(148, 163, 184, 0.34); background: rgba(15, 23, 42, 0.42); color: #dbe7f7; }
        .admin-dashboard-react .admin-pill.is-active { border-color: rgba(34, 197, 94, 0.45); background: rgba(19, 52, 35, 0.7); color: #86efac; }
        .admin-dashboard-react .admin-pill.is-inactive { border-color: rgba(248, 113, 113, 0.42); background: rgba(59, 21, 27, 0.7); color: #fca5a5; }
        .admin-dashboard-react .admin-account-actions { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
        .admin-dashboard-react .admin-plan-grid { padding: 12px 14px; border-bottom: 1px solid rgba(49, 65, 87, 0.95); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .admin-dashboard-react .admin-plan-card { border: 1px solid rgba(49, 65, 87, 0.9); border-radius: 10px; padding: 10px; background: rgba(15, 23, 42, 0.35); }
        .admin-dashboard-react .admin-plan-label { color: var(--gray-600); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .admin-dashboard-react .admin-plan-value { font-size: 13px; color: #e2ebfa; font-weight: 600; word-break: break-word; }
        .admin-dashboard-react .admin-account-users { padding: 14px; }
        .admin-dashboard-react .admin-table-wrap { overflow-x: auto; }
        .admin-dashboard-react .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .admin-dashboard-react .admin-table th, .admin-dashboard-react .admin-table td { padding: 9px 10px; border-bottom: 1px solid var(--border-color); text-align: left; white-space: nowrap; }
        .admin-dashboard-react .admin-table th { color: var(--gray-600); font-weight: 600; }
        .admin-dashboard-react .admin-table tr:last-child td { border-bottom: none; }
        .admin-dashboard-react .admin-user-actions { display: inline-flex; gap: 6px; }
        .admin-dashboard-react .admin-settings-card { background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
        .admin-dashboard-react .admin-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .admin-dashboard-react .admin-form-group { margin-bottom: 12px; }
        .admin-dashboard-react .admin-form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: var(--gray-700); }
        .admin-dashboard-react .admin-form-group input, .admin-dashboard-react .admin-form-group select, .admin-dashboard-react .admin-form-group textarea { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--surface-muted); color: var(--gray-900); }
        .admin-dashboard-react .admin-form-group textarea { min-height: 120px; resize: vertical; font-family: monospace; font-size: 12px; }
        .admin-dashboard-react .admin-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
        .admin-dashboard-react .admin-muted { color: var(--gray-600); font-size: 12px; }
        .admin-dashboard-react .admin-section-title { margin-bottom: 10px; font-size: 15px; color: #dce6f7; font-weight: 700; }
        .admin-dashboard-react .admin-empty { border: 1px dashed rgba(148, 163, 184, 0.35); border-radius: 12px; padding: 20px; text-align: center; color: var(--gray-600); background: rgba(15, 23, 42, 0.3); }
        .admin-dashboard-react .admin-modal-note { margin-top: 6px; color: var(--gray-600); font-size: 12px; }
        @media (max-width: 1100px) { .admin-dashboard-react .admin-plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 900px) { .admin-dashboard-react .admin-settings-grid { grid-template-columns: 1fr; } .admin-dashboard-react .admin-plan-grid { grid-template-columns: 1fr; } }
      `}</style>
      <button className="mobile-menu-toggle" type="button" onClick={() => { document.querySelector('.sidebar')?.classList.toggle('open'); document.querySelector('.sidebar-overlay')?.classList.toggle('active'); }}>
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
            <p>Gestao central de contas, usuarios e configuracao de email da plataforma.</p>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')} type="button">Contas e Planos</button>
          <button className={`admin-tab-btn ${activeTab === 'email' ? 'active' : ''}`} onClick={() => setActiveTab('email')} type="button">Configuracao de Email</button>
        </div>

        {activeTab === 'accounts' && (
          <>
            {overviewError && <div className="admin-alert admin-alert-error">{overviewError}</div>}
            {overviewMessage && <div className="admin-alert admin-alert-success">{overviewMessage}</div>}

            {loadingOverview ? (
              <div className="admin-muted">Carregando dados...</div>
            ) : (
              <>
                <div className="admin-overview-hero">
                  <div className="admin-grid">
                    <div className="admin-stat"><div className="admin-stat-label">Contas</div><div className="admin-stat-value">{Number(summary.total_accounts || 0)}</div></div>
                    <div className="admin-stat"><div className="admin-stat-label">Usuarios</div><div className="admin-stat-value">{Number(summary.total_users || 0)}</div></div>
                    <div className="admin-stat"><div className="admin-stat-label">Usuarios ativos</div><div className="admin-stat-value">{Number(summary.total_active_users || 0)}</div></div>
                    <div className="admin-stat"><div className="admin-stat-label">Emails pendentes</div><div className="admin-stat-value">{Number(summary.total_pending_email_confirmation || 0)}</div></div>
                  </div>
                  <div className="admin-breakdown">
                    {Object.entries(summary.plan_status_breakdown || {}).map(([status, total]) => (
                      <span className="admin-badge" key={status}>{planStatusLabel(status)} <strong>{Number(total || 0)}</strong></span>
                    ))}
                  </div>
                  <div className="admin-muted" style={{ marginTop: 10 }}>Ultima atualizacao: {formatDateTime(overview?.generated_at)}</div>
                </div>

                {accounts.length === 0 && <div className="admin-empty">Nenhuma conta encontrada para gerenciamento.</div>}

                {accounts.map((account) => {
                  const ownerActive = Number(account.owner?.is_active) > 0;
                  const accountBusy = overviewBusyKey === `account-edit-${account.owner_user_id}` || overviewBusyKey === `account-delete-${account.owner_user_id}`;
                  return (
                    <div className="admin-account-card" key={account.owner_user_id}>
                      <div className="admin-account-head">
                        <div>
                          <h3 className="admin-account-name">{String(account.owner?.name || account.owner?.email || `Conta ${account.owner_user_id}`)}</h3>
                          <div className="admin-account-meta">Owner ID: {account.owner_user_id} | Email: {String(account.owner?.email || '-')}</div>
                          <div className="admin-account-tags">
                            <span className={`admin-pill ${ownerActive ? 'is-active' : 'is-inactive'}`}>{ownerActive ? 'Conta ativa' : 'Conta inativa'}</span>
                            <span className="admin-pill">Plano: {String(account.plan?.status_label || planStatusLabel(account.plan?.status))}</span>
                            <span className="admin-pill">Usuarios: {Number(account.totals?.total_users || 0)}</span>
                            <span className="admin-pill">Pendentes: {Number(account.totals?.pending_email_confirmation || 0)}</span>
                          </div>
                        </div>
                        <div className="admin-account-actions">
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openAccountEditor(account)} disabled={accountBusy}>Editar conta</button>
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deactivateAccount(account.owner_user_id)} disabled={accountBusy}>{overviewBusyKey === `account-delete-${account.owner_user_id}` ? 'Desativando...' : 'Desativar conta'}</button>
                        </div>
                      </div>

                      <div className="admin-plan-grid">
                        <div className="admin-plan-card"><div className="admin-plan-label">Nome do plano</div><div className="admin-plan-value">{String(account.plan?.name || 'Nao configurado')}</div></div>
                        <div className="admin-plan-card"><div className="admin-plan-label">Status</div><div className="admin-plan-value">{String(account.plan?.status_label || planStatusLabel(account.plan?.status))}</div></div>
                        <div className="admin-plan-card"><div className="admin-plan-label">Provider</div><div className="admin-plan-value">{String(account.plan?.provider || '-')}</div></div>
                        <div className="admin-plan-card"><div className="admin-plan-label">Renovacao</div><div className="admin-plan-value">{formatDateTime(account.plan?.renewal_date)}</div></div>
                      </div>

                      <div className="admin-account-users">
                        <div className="admin-section-title">Usuarios da conta</div>
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th><th>Email</th><th>Ultimo login</th><th>Acoes</th></tr>
                            </thead>
                            <tbody>
                              {(Array.isArray(account.users) ? account.users : []).map((item) => {
                                const userId = Number(item.id || 0);
                                const isActive = Number(item.is_active) > 0;
                                const isDeleting = overviewBusyKey === `user-delete-${userId}`;
                                const disableDelete = item.is_primary_admin === true || !isActive;
                                return (
                                  <tr key={`${account.owner_user_id}-${item.id || item.email}`}>
                                    <td>{String(item.name || '-')}</td>
                                    <td>{String(item.email || '-')}</td>
                                    <td>{roleLabel(item.role)}</td>
                                    <td>{isActive ? 'Ativo' : 'Inativo'}</td>
                                    <td>{Number(item.email_confirmed) > 0 ? 'Confirmado' : 'Pendente'}</td>
                                    <td>{formatDateTime(item.last_login_at)}</td>
                                    <td>
                                      <div className="admin-user-actions">
                                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openUserEditor(item)}>Editar</button>
                                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deactivateUser(item)} disabled={disableDelete || isDeleting} title={item.is_primary_admin ? 'Admin principal deve ser gerenciado na conta' : ''}>{isDeleting ? 'Desativando...' : 'Desativar'}</button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  <div className="admin-form-group"><label>Provider</label><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="mailgun">Mailgun</option><option value="sendgrid">SendGrid</option></select></div>
                  <div className="admin-form-group"><label>Nome da aplicacao</label><input value={appName} onChange={(event) => setAppName(event.target.value)} /></div>
                  <div className="admin-form-group"><label>Timeout da requisicao (ms)</label><input type="number" min={1000} max={60000} value={requestTimeoutMs} onChange={(event) => setRequestTimeoutMs(Number(event.target.value || 10000))} /></div>

                  {provider === 'mailgun' && (
                    <>
                      <div className="admin-form-group"><label>MAILGUN_DOMAIN</label><input value={mailgunDomain} onChange={(event) => setMailgunDomain(event.target.value)} placeholder="mg.seu-dominio.com" /></div>
                      <div className="admin-form-group"><label>MAILGUN_BASE_URL</label><input value={mailgunBaseUrl} onChange={(event) => setMailgunBaseUrl(event.target.value)} placeholder="https://api.mailgun.net" /></div>
                      <div className="admin-form-group"><label>MAILGUN_FROM_EMAIL</label><input value={mailgunFromEmail} onChange={(event) => setMailgunFromEmail(event.target.value)} placeholder="no-reply@seu-dominio.com" /></div>
                      <div className="admin-form-group"><label>MAILGUN_FROM_NAME</label><input value={mailgunFromName} onChange={(event) => setMailgunFromName(event.target.value)} placeholder="ZapVender" /></div>
                      <div className="admin-form-group"><label>MAILGUN_REPLY_TO_EMAIL (opcional)</label><input value={mailgunReplyToEmail} onChange={(event) => setMailgunReplyToEmail(event.target.value)} placeholder="suporte@seu-dominio.com" /></div>
                      <div className="admin-form-group"><label>MAILGUN_REPLY_TO_NAME (opcional)</label><input value={mailgunReplyToName} onChange={(event) => setMailgunReplyToName(event.target.value)} /></div>
                      <div className="admin-form-group">
                        <label>MAILGUN_API_KEY</label>
                        <input type="password" value={mailgunApiKeyInput} onChange={(event) => setMailgunApiKeyInput(event.target.value)} placeholder={hasMailgunApiKey ? 'Chave ja configurada. Preencha apenas se quiser substituir.' : 'Cole a API key do Mailgun'} />
                        <div className="admin-muted">Atual: {hasMailgunApiKey ? mailgunApiKeyMasked || 'Configurada' : 'Nao configurada'}</div>
                        <label style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={removeMailgunApiKey} onChange={(event) => setRemoveMailgunApiKey(event.target.checked)} />Remover chave salva</label>
                      </div>
                    </>
                  )}

                  {provider === 'sendgrid' && (
                    <>
                      <div className="admin-form-group"><label>SendGrid FROM email</label><input value={sendgridFromEmail} onChange={(event) => setSendgridFromEmail(event.target.value)} placeholder="no-reply@seu-dominio.com" /></div>
                      <div className="admin-form-group"><label>SendGrid FROM nome</label><input value={sendgridFromName} onChange={(event) => setSendgridFromName(event.target.value)} placeholder="ZapVender" /></div>
                      <div className="admin-form-group"><label>Reply-To email (opcional)</label><input value={sendgridReplyToEmail} onChange={(event) => setSendgridReplyToEmail(event.target.value)} placeholder="suporte@seu-dominio.com" /></div>
                      <div className="admin-form-group"><label>Reply-To nome (opcional)</label><input value={sendgridReplyToName} onChange={(event) => setSendgridReplyToName(event.target.value)} /></div>
                      <div className="admin-form-group">
                        <label>SENDGRID_API_KEY</label>
                        <input type="password" value={sendgridApiKeyInput} onChange={(event) => setSendgridApiKeyInput(event.target.value)} placeholder={hasSendgridApiKey ? 'Chave ja configurada. Preencha apenas se quiser substituir.' : 'Cole a API key do SendGrid'} />
                        <div className="admin-muted">Atual: {hasSendgridApiKey ? sendgridApiKeyMasked || 'Configurada' : 'Nao configurada'}</div>
                        <label style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={removeSendgridApiKey} onChange={(event) => setRemoveSendgridApiKey(event.target.checked)} />Remover chave salva</label>
                      </div>
                    </>
                  )}
                </div>

                <div className="admin-form-group"><label>Template - Assunto</label><input value={subjectTemplate} onChange={(event) => setSubjectTemplate(event.target.value)} /></div>
                <div className="admin-form-group"><label>Template - HTML</label><textarea value={htmlTemplate} onChange={(event) => setHtmlTemplate(event.target.value)} /></div>
                <div className="admin-form-group"><label>Template - Texto</label><textarea value={textTemplate} onChange={(event) => setTextTemplate(event.target.value)} /></div>
                <div className="admin-muted">Variaveis disponiveis: {'{{name}}'}, {'{{email}}'}, {'{{confirmation_url}}'}, {'{{app_name}}'}, {'{{expires_in_text}}'}</div>

                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={saveEmailSettings} disabled={savingEmailSettings}>{savingEmailSettings ? 'Salvando...' : 'Salvar configuracoes'}</button>
                  <input type="email" className="form-input" style={{ maxWidth: 320 }} placeholder="email@destino.com" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} />
                  <button type="button" className="btn btn-outline" onClick={sendTestEmail} disabled={sendingTestEmail}>{sendingTestEmail ? 'Enviando teste...' : 'Enviar teste'}</button>
                </div>

                {emailError && <div className="admin-alert admin-alert-error" style={{ marginTop: 12 }}>{emailError}</div>}
                {emailSuccess && <div className="admin-alert admin-alert-success" style={{ marginTop: 12 }}>{emailSuccess}</div>}
              </>
            )}
          </div>
        )}
      </main>
      {accountDraft && (
        <div className="modal-overlay active">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="modal-title">Editar conta</h3>
              <button type="button" className="modal-close" onClick={() => setAccountDraft(null)}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nome do admin principal</label>
                  <input className="form-input" value={accountDraft.name} onChange={(event) => setAccountDraft({ ...accountDraft, name: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email do admin principal</label>
                  <input className="form-input" type="email" value={accountDraft.email} onChange={(event) => setAccountDraft({ ...accountDraft, email: event.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Conta ativa</label>
                  <select className="form-select" value={accountDraft.isActive ? '1' : '0'} onChange={(event) => setAccountDraft({ ...accountDraft, isActive: event.target.value === '1' })}>
                    <option value="1">Ativa</option>
                    <option value="0">Inativa</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status do plano</label>
                  <select className="form-select" value={accountDraft.planStatus} onChange={(event) => setAccountDraft({ ...accountDraft, planStatus: event.target.value })}>
                    {PLAN_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nome do plano</label>
                  <input className="form-input" value={accountDraft.planName} onChange={(event) => setAccountDraft({ ...accountDraft, planName: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Codigo do plano</label>
                  <input className="form-input" value={accountDraft.planCode} onChange={(event) => setAccountDraft({ ...accountDraft, planCode: event.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Provider do plano</label>
                  <input className="form-input" value={accountDraft.planProvider} onChange={(event) => setAccountDraft({ ...accountDraft, planProvider: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Data de renovacao</label>
                  <input className="form-input" type="date" value={accountDraft.planRenewalDate} onChange={(event) => setAccountDraft({ ...accountDraft, planRenewalDate: event.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mensagem interna do plano</label>
                <textarea className="form-textarea" rows={3} value={accountDraft.planMessage} onChange={(event) => setAccountDraft({ ...accountDraft, planMessage: event.target.value })}></textarea>
                <div className="admin-modal-note">Esse texto aparece no resumo administrativo e no status interno da conta.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setAccountDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={submitAccountEdit} disabled={Boolean(accountEditBusy)}>{accountEditBusy ? 'Salvando...' : 'Salvar conta'}</button>
            </div>
          </div>
        </div>
      )}

      {userDraft && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Editar usuario</h3>
              <button type="button" className="modal-close" onClick={() => setUserDraft(null)}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" value={userDraft.name} onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={userDraft.email} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Perfil</label>
                  <select className="form-select" value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value })} disabled={userDraft.isPrimaryAdmin}>
                    {USER_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={userDraft.isActive ? '1' : '0'} onChange={(event) => setUserDraft({ ...userDraft, isActive: event.target.value === '1' })} disabled={userDraft.isPrimaryAdmin}>
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="checkbox-wrapper" style={{ gap: '8px' }}>
                  <input type="checkbox" checked={userDraft.emailConfirmed} onChange={(event) => setUserDraft({ ...userDraft, emailConfirmed: event.target.checked })} />
                  <span className="checkbox-custom"></span>
                  Email confirmado
                </label>
              </div>
              {userDraft.isPrimaryAdmin && <div className="admin-modal-note">Este usuario e o admin principal da conta. Algumas alteracoes ficam bloqueadas por seguranca.</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setUserDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={submitUserEdit} disabled={Boolean(userEditBusy)}>{userEditBusy ? 'Salvando...' : 'Salvar usuario'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
