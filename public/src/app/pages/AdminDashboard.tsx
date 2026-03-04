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
  company_name?: string;
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

type EmailPreviewPayload = {
  subject?: string;
  html?: string;
  text?: string;
};

type SupportInboxMessageItem = {
  id: number;
  provider?: string;
  from_name?: string | null;
  from_email?: string;
  to_email?: string;
  subject?: string;
  body_text?: string | null;
  body_html?: string | null;
  received_at?: string;
  is_read?: number;
};

type SupportInboxPayload = {
  messages?: SupportInboxMessageItem[];
  unreadCount?: number;
};

type AdminApiResponse = {
  success?: boolean;
  error?: string;
  overview?: AppAdminOverview;
  settings?: EmailSettingsResponse;
  preview?: EmailPreviewPayload;
  inbox?: SupportInboxPayload;
  supportMessage?: SupportInboxMessageItem;
  message?: string;
  disabled_users?: number;
  reactivated_users?: number;
  deleted_users?: number;
  deleted_account?: boolean;
};

type AccountEditDraft = {
  ownerUserId: number;
  companyName: string;
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

type UserActionConfirmDraft = {
  userId: number;
  name: string;
  isActive: boolean;
};

type AccountActionConfirmDraft = {
  ownerUserId: number;
  companyName: string;
  mode: 'deactivate' | 'delete';
};

type ActiveTab = 'accounts' | 'email';
type EmailSection = 'delivery' | 'inbox';

const DEFAULT_SUBJECT_TEMPLATE = 'Confirme seu cadastro no {{app_name}}';
const DEFAULT_TEXT_TEMPLATE = [
  'Olá {{name}},',
  '',
  'Recebemos seu cadastro no {{app_name}}.',
  'Para ativar sua conta, confirme seu e-mail no link abaixo:',
  '{{confirmation_url}}',
  '',
  'Este link expira em {{expires_in_text}}.',
  '',
  '---',
  'ZapVender | Plataforma de atendimento e automação para WhatsApp',
  'Suporte: {{company_email}}'
].join('\n');
const DEFAULT_HTML_TEMPLATE = [
  '<!doctype html>',
  '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
  '<body style="margin:0;padding:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#142033;">',
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:24px 12px;">',
  '<tr><td align="center">',
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e9f1;">',
  '<tr><td style="background:#040b09;background-image:radial-gradient(520px 180px at 50% -22%, rgba(35,198,111,0.22), rgba(35,198,111,0) 72%),linear-gradient(135deg,#061511 0%,#0b2a22 52%,#07130f 100%);padding:24px 20px;" align="center">',
  '<img src="{{logo_url}}" alt="ZapVender" style="display:block;height:52px;width:auto;max-width:240px;margin:0 auto;">',
  '</td></tr>',
  '<tr><td style="padding:28px 24px;">',
  '<p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#142033;">Olá {{name}},</p>',
  '<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#344054;">Recebemos seu cadastro no <strong>{{app_name}}</strong>. Para ativar sua conta, confirme seu e-mail clicando no botão abaixo.</p>',
  '<p style="margin:0 0 20px 0;"><a href="{{confirmation_url}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#1dbf73;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Confirmar e-mail</a></p>',
  '<p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">Este link expira em {{expires_in_text}}.</p>',
  '</td></tr>',
  '<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e4e9f1;">',
  '<p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#667085;"><strong>ZapVender</strong> | Plataforma de atendimento e automação para WhatsApp.</p>',
  '<p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">Suporte: <a href="mailto:{{company_email}}" style="color:#0f766e;text-decoration:none;">{{company_email}}</a></p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body></html>'
].join('');

const PLAN_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'trialing', label: 'Em teste' },
  { value: 'past_due', label: 'Pagamento pendente' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'expired', label: 'Expirado' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'unknown', label: 'Não configurado' }
];

const USER_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Usuário' }
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
  return PLAN_STATUS_OPTIONS.find((item) => item.value === normalized)?.label || 'Não configurado';
}

function normalizeRole(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'admin' ? 'admin' : 'agent';
}

function roleLabel(value: unknown) {
  return normalizeRole(value) === 'admin' ? 'Admin' : 'Usuário';
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
    throw new Error('Sessão expirada');
  }

  if (!response.ok) {
    throw new Error(String(data?.error || 'Falha na requisição'));
  }

  return data as AdminApiResponse;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('accounts');
  const [emailSection, setEmailSection] = useState<EmailSection>('delivery');
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
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewName, setPreviewName] = useState('Usuario');
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
  const [emailPreview, setEmailPreview] = useState<EmailPreviewPayload | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [loadingSupportInbox, setLoadingSupportInbox] = useState(true);
  const [supportInboxError, setSupportInboxError] = useState('');
  const [supportInboxMessages, setSupportInboxMessages] = useState<SupportInboxMessageItem[]>([]);
  const [supportInboxUnreadCount, setSupportInboxUnreadCount] = useState(0);
  const [selectedSupportMessageId, setSelectedSupportMessageId] = useState<number | null>(null);
  const [updatingSupportMessageId, setUpdatingSupportMessageId] = useState<number | null>(null);

  const [accountDraft, setAccountDraft] = useState<AccountEditDraft | null>(null);
  const [userDraft, setUserDraft] = useState<UserEditDraft | null>(null);
  const [userActionConfirmDraft, setUserActionConfirmDraft] = useState<UserActionConfirmDraft | null>(null);
  const [accountActionConfirmDraft, setAccountActionConfirmDraft] = useState<AccountActionConfirmDraft | null>(null);

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
      setOverviewError(error instanceof Error ? error.message : 'Falha ao carregar o dashboard');
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
      setEmailError(error instanceof Error ? error.message : 'Falha ao carregar configurações');
    } finally {
      setLoadingEmailSettings(false);
    }
  };

  const loadSupportInbox = async (options: { silent?: boolean } = {}) => {
    const silent = options.silent === true;
    if (!silent) setLoadingSupportInbox(true);
    if (!silent) setSupportInboxError('');

    try {
      const response = await adminApiRequest('/api/admin/dashboard/email-support-inbox?limit=50');
      const inbox = response?.inbox || {};
      const messages = Array.isArray(inbox.messages) ? inbox.messages : [];
      setSupportInboxMessages(messages);
      setSupportInboxUnreadCount(Number(inbox.unreadCount || 0));

      setSelectedSupportMessageId((current) => {
        if (current && messages.some((item) => Number(item.id) === Number(current))) {
          return current;
        }
        const firstId = Number(messages[0]?.id || 0);
        return firstId > 0 ? firstId : null;
      });
    } catch (error) {
      setSupportInboxError(error instanceof Error ? error.message : 'Falha ao carregar caixa de entrada');
    } finally {
      if (!silent) setLoadingSupportInbox(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      await import('../../core/app');
      if (cancelled) return;
      await Promise.all([loadOverview(), loadEmailSettings(), loadSupportInbox()]);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'email' || emailSection !== 'inbox') return;
    if (loadingSupportInbox) return;
    if (supportInboxMessages.length > 0) return;
    void loadSupportInbox();
  }, [activeTab, emailSection]);

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
      companyName: String(account.company_name || account.owner?.name || ''),
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
    if (!accountDraft.companyName.trim()) {
      setOverviewError('Informe o nome da empresa da conta');
      return;
    }
    if (!accountDraft.name.trim()) {
      setOverviewError('Informe o nome do admin principal da conta');
      return;
    }
    if (!isValidEmailAddress(accountDraft.email)) {
      setOverviewError('Informe um e-mail válido para a conta');
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
          company_name: accountDraft.companyName.trim(),
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
  const openAccountActionConfirm = (account: AppAdminAccount, mode: 'deactivate' | 'delete') => {
    const ownerUserId = Number(account.owner_user_id || 0);
    if (!ownerUserId) return;
    setOverviewError('');
    setOverviewMessage('');
    setAccountActionConfirmDraft({
      ownerUserId,
      companyName: String(account.company_name || account.owner?.name || account.owner?.email || `Conta ${ownerUserId}`),
      mode
    });
  };

  const deactivateAccount = async (ownerUserId: number) => {
    if (!ownerUserId) return;

    const busyKey = `account-deactivate-${ownerUserId}`;
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

  const reactivateAccount = async (ownerUserId: number) => {
    if (!ownerUserId) return;

    const busyKey = `account-reactivate-${ownerUserId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      const response = await adminApiRequest(`/api/admin/dashboard/accounts/${ownerUserId}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_active: 1,
          reactivate_all_users: 1
        })
      });
      const reactivatedUsers = Number(response?.reactivated_users || 0);
      setOverviewMessage(
        reactivatedUsers > 0
          ? `Conta reativada. ${reactivatedUsers} usuario(s) reativados.`
          : 'Conta reativada com sucesso.'
      );
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao reativar conta');
    } finally {
      setOverviewBusyKey('');
    }
  };

  const deleteAccount = async (ownerUserId: number) => {
    if (!ownerUserId) return;

    const busyKey = `account-delete-${ownerUserId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      const response = await adminApiRequest(`/api/admin/dashboard/accounts/${ownerUserId}?mode=delete`, { method: 'DELETE' });
      const deletedUsers = Number(response?.deleted_users || 0);
      setOverviewMessage(
        deletedUsers > 0
          ? `Conta excluida com sucesso. ${deletedUsers} usuario(s) removidos.`
          : 'Conta excluida com sucesso.'
      );
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao excluir conta');
    } finally {
      setOverviewBusyKey('');
    }
  };

  const confirmAccountAction = async () => {
    if (!accountActionConfirmDraft) return;
    const { ownerUserId, mode } = accountActionConfirmDraft;
    if (mode === 'deactivate') {
      await deactivateAccount(ownerUserId);
    } else {
      await deleteAccount(ownerUserId);
    }
    setAccountActionConfirmDraft(null);
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

  const openUserActionConfirm = (user: AppAdminUser) => {
    const userId = Number(user.id || 0);
    if (!userId) return;
    if (user.is_primary_admin === true) {
      setOverviewError('O admin principal deve ser gerenciado pela conta.');
      return;
    }

    setOverviewError('');
    setOverviewMessage('');
    setUserActionConfirmDraft({
      userId,
      name: String(user.name || user.email || `Usuário ${userId}`),
      isActive: Number(user.is_active) > 0
    });
  };

  const submitUserEdit = async () => {
    if (!userDraft) return;
    if (!userDraft.name.trim()) {
      setOverviewError('Informe o nome do usuário');
      return;
    }
    if (!isValidEmailAddress(userDraft.email)) {
      setOverviewError('Informe um e-mail válido para o usuário');
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
      setOverviewMessage('Usuário atualizado com sucesso.');
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao atualizar usuário');
    } finally {
      setOverviewBusyKey('');
    }
  };

  const confirmUserAction = async () => {
    if (!userActionConfirmDraft) return;
    const { userId, isActive } = userActionConfirmDraft;
    const busyKey = `user-delete-${userId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      const endpoint = isActive
        ? `/api/admin/dashboard/users/${userId}`
        : `/api/admin/dashboard/users/${userId}?mode=delete`;
      await adminApiRequest(endpoint, { method: 'DELETE' });
      setUserActionConfirmDraft(null);
      setOverviewMessage(isActive ? 'Usuário desativado com sucesso.' : 'Usuário excluído com sucesso.');
      await loadOverview({ silent: true });
    } catch (error) {
      setUserActionConfirmDraft(null);
      setOverviewError(error instanceof Error ? error.message : (isActive ? 'Falha ao desativar usuário' : 'Falha ao excluir usuário'));
    } finally {
      setOverviewBusyKey('');
    }
  };

  const reactivateUser = async (user: AppAdminUser) => {
    const userId = Number(user.id || 0);
    if (!userId) return;
    if (Number(user.is_active) > 0) return;

    const busyKey = `user-reactivate-${userId}`;
    setOverviewBusyKey(busyKey);
    setOverviewError('');
    setOverviewMessage('');
    try {
      await adminApiRequest(`/api/admin/dashboard/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: 1 })
      });
      setOverviewMessage('Usuário reativado com sucesso.');
      await loadOverview({ silent: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Falha ao reativar usuário');
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
      setEmailSuccess('Configurações salvas com sucesso.');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Falha ao salvar configurações');
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

  const previewEmailTemplate = async () => {
    setLoadingEmailPreview(true);
    setEmailError('');
    setEmailSuccess('');
    try {
      const response = await adminApiRequest('/api/admin/dashboard/email-settings/preview', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          appName,
          requestTimeoutMs,
          subjectTemplate,
          htmlTemplate,
          textTemplate,
          previewName,
          previewEmail
        })
      });
      const preview = response?.preview || null;
      if (!preview || (!preview.subject && !preview.html && !preview.text)) {
        throw new Error('Nao foi possivel gerar a pre-visualizacao');
      }
      setEmailPreview(preview);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Falha ao gerar pre-visualizacao');
    } finally {
      setLoadingEmailPreview(false);
    }
  };

  const markSupportMessageRead = async (messageId: number, isRead = true) => {
    if (!messageId || updatingSupportMessageId) return;
    const previous = supportInboxMessages.find((item) => Number(item.id) === Number(messageId));
    const wasRead = Number(previous?.is_read || 0) > 0;
    setUpdatingSupportMessageId(messageId);
    setSupportInboxError('');

    try {
      await adminApiRequest(`/api/admin/dashboard/email-support-inbox/${messageId}/read`, {
        method: 'POST',
        body: JSON.stringify({ isRead })
      });

      setSupportInboxMessages((current) => current.map((item) => (
        Number(item.id) === Number(messageId)
          ? { ...item, is_read: isRead ? 1 : 0 }
          : item
      )));
      if (wasRead !== isRead) {
        setSupportInboxUnreadCount((current) => Math.max(0, current + (isRead ? -1 : 1)));
      }
    } catch (error) {
      setSupportInboxError(error instanceof Error ? error.message : 'Falha ao atualizar mensagem');
    } finally {
      setUpdatingSupportMessageId(null);
    }
  };

  const selectedSupportMessage = useMemo(
    () => supportInboxMessages.find((item) => Number(item.id) === Number(selectedSupportMessageId)) || null,
    [supportInboxMessages, selectedSupportMessageId]
  );

  const accountEditBusy = accountDraft && overviewBusyKey === `account-edit-${accountDraft.ownerUserId}`;
  const accountActionBusy = accountActionConfirmDraft
    && overviewBusyKey === `account-${accountActionConfirmDraft.mode}-${accountActionConfirmDraft.ownerUserId}`;
  const userEditBusy = userDraft && overviewBusyKey === `user-edit-${userDraft.userId}`;
  const userActionBusy = userActionConfirmDraft && overviewBusyKey === `user-delete-${userActionConfirmDraft.userId}`;

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
        .admin-dashboard-react .admin-email-sections { display: inline-flex; gap: 8px; margin-bottom: 14px; padding: 4px; border: 1px solid var(--border-color); border-radius: 999px; background: rgba(15, 23, 42, 0.36); }
        .admin-dashboard-react .admin-email-section-btn { border: none; border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 600; color: var(--gray-600); background: transparent; cursor: pointer; }
        .admin-dashboard-react .admin-email-section-btn.active { background: rgba(var(--primary-rgb), 0.2); color: #e8fff4; }
        .admin-dashboard-react .admin-email-block { border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; margin-bottom: 12px; background: rgba(15, 23, 42, 0.24); }
        .admin-dashboard-react .admin-email-block h3 { margin: 0 0 8px 0; font-size: 14px; color: #e5eefc; }
        .admin-dashboard-react .admin-email-block p { margin: 0 0 10px 0; font-size: 12px; color: var(--gray-600); }
        .admin-dashboard-react .admin-inbox-layout { display: grid; grid-template-columns: 320px 1fr; gap: 12px; min-height: 440px; }
        .admin-dashboard-react .admin-inbox-list { border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 23, 42, 0.25); overflow: auto; max-height: 560px; }
        .admin-dashboard-react .admin-inbox-item { width: 100%; border: none; border-bottom: 1px solid var(--border-color); background: transparent; color: inherit; text-align: left; padding: 12px; cursor: pointer; }
        .admin-dashboard-react .admin-inbox-item:last-child { border-bottom: none; }
        .admin-dashboard-react .admin-inbox-item.active { background: rgba(var(--primary-rgb), 0.12); }
        .admin-dashboard-react .admin-inbox-item-subject { font-size: 13px; font-weight: 600; color: #e6eefb; margin-bottom: 4px; }
        .admin-dashboard-react .admin-inbox-item-meta { font-size: 11px; color: var(--gray-600); display: flex; justify-content: space-between; gap: 8px; }
        .admin-dashboard-react .admin-inbox-item-unread { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; border-radius: 999px; background: rgba(34, 197, 94, 0.2); color: #86efac; font-size: 10px; font-weight: 700; padding: 0 6px; }
        .admin-dashboard-react .admin-inbox-detail { border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 23, 42, 0.25); padding: 14px; }
        .admin-dashboard-react .admin-inbox-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .admin-dashboard-react .admin-inbox-subject { margin: 0; font-size: 16px; color: #edf4ff; }
        .admin-dashboard-react .admin-inbox-body { border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; background: rgba(2, 10, 18, 0.45); min-height: 240px; max-height: 420px; overflow: auto; white-space: pre-wrap; font-size: 12px; color: #dce7f7; }
        .admin-dashboard-react .admin-inbox-empty { border: 1px dashed var(--border-color); border-radius: 10px; padding: 24px; text-align: center; color: var(--gray-600); }
        .admin-dashboard-react .admin-muted { color: var(--gray-600); font-size: 12px; }
        .admin-dashboard-react .admin-section-title { margin-bottom: 10px; font-size: 15px; color: #dce6f7; font-weight: 700; }
        .admin-dashboard-react .admin-empty { border: 1px dashed rgba(148, 163, 184, 0.35); border-radius: 12px; padding: 20px; text-align: center; color: var(--gray-600); background: rgba(15, 23, 42, 0.3); }
        .admin-dashboard-react .admin-modal-note { margin-top: 6px; color: var(--gray-600); font-size: 12px; }
        @media (max-width: 1100px) { .admin-dashboard-react .admin-plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 980px) { .admin-dashboard-react .admin-inbox-layout { grid-template-columns: 1fr; } }
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
            <p>Gestão central de contas, usuários e configuração de e-mail da plataforma.</p>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')} type="button">Contas e Planos</button>
          <button className={`admin-tab-btn ${activeTab === 'email' ? 'active' : ''}`} onClick={() => setActiveTab('email')} type="button">Configuração de E-mail</button>
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
                    <div className="admin-stat"><div className="admin-stat-label">Usuários</div><div className="admin-stat-value">{Number(summary.total_users || 0)}</div></div>
                    <div className="admin-stat"><div className="admin-stat-label">Usuários ativos</div><div className="admin-stat-value">{Number(summary.total_active_users || 0)}</div></div>
                    <div className="admin-stat"><div className="admin-stat-label">Emails pendentes</div><div className="admin-stat-value">{Number(summary.total_pending_email_confirmation || 0)}</div></div>
                  </div>
                  <div className="admin-breakdown">
                    {Object.entries(summary.plan_status_breakdown || {}).map(([status, total]) => (
                      <span className="admin-badge" key={status}>{planStatusLabel(status)} <strong>{Number(total || 0)}</strong></span>
                    ))}
                  </div>
                  <div className="admin-muted" style={{ marginTop: 10 }}>Última atualização: {formatDateTime(overview?.generated_at)}</div>
                </div>

                {accounts.length === 0 && <div className="admin-empty">Nenhuma conta encontrada para gerenciamento.</div>}

                {accounts.map((account) => {
                  const ownerActive = Number(account.owner?.is_active) > 0;
                  const accountIsEditing = overviewBusyKey === `account-edit-${account.owner_user_id}`;
                  const accountIsDeactivating = overviewBusyKey === `account-deactivate-${account.owner_user_id}`;
                  const accountIsReactivating = overviewBusyKey === `account-reactivate-${account.owner_user_id}`;
                  const accountIsDeleting = overviewBusyKey === `account-delete-${account.owner_user_id}`;
                  const accountBusy = accountIsEditing || accountIsDeactivating || accountIsReactivating || accountIsDeleting;
                  return (
                    <div className="admin-account-card" key={account.owner_user_id}>
                      <div className="admin-account-head">
                        <div>
                          <h3 className="admin-account-name">{String(account.company_name || account.owner?.name || account.owner?.email || `Conta ${account.owner_user_id}`)}</h3>
                          <div className="admin-account-meta">Owner ID: {account.owner_user_id} | Email: {String(account.owner?.email || '-')}</div>
                          <div className="admin-account-tags">
                            <span className={`admin-pill ${ownerActive ? 'is-active' : 'is-inactive'}`}>{ownerActive ? 'Conta ativa' : 'Conta inativa'}</span>
                            <span className="admin-pill">Plano: {String(account.plan?.status_label || planStatusLabel(account.plan?.status))}</span>
                            <span className="admin-pill">Usuários: {Number(account.totals?.total_users || 0)}</span>
                            <span className="admin-pill">Pendentes: {Number(account.totals?.pending_email_confirmation || 0)}</span>
                          </div>
                        </div>
                        <div className="admin-account-actions">
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openAccountEditor(account)} disabled={accountBusy}>Editar conta</button>
                          {ownerActive ? (
                            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => openAccountActionConfirm(account, 'deactivate')} disabled={accountBusy}>{accountIsDeactivating ? 'Desativando...' : 'Desativar conta'}</button>
                          ) : (
                            <>
                              <button type="button" className="btn btn-success btn-sm" onClick={() => reactivateAccount(account.owner_user_id)} disabled={accountBusy}>{accountIsReactivating ? 'Reativando...' : 'Reativar conta'}</button>
                              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => openAccountActionConfirm(account, 'delete')} disabled={accountBusy}>{accountIsDeleting ? 'Excluindo...' : 'Excluir conta'}</button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="admin-plan-grid">
                        <div className="admin-plan-card"><div className="admin-plan-label">Nome do plano</div><div className="admin-plan-value">{String(account.plan?.name || 'Não configurado')}</div></div>
                        <div className="admin-plan-card"><div className="admin-plan-label">Status</div><div className="admin-plan-value">{String(account.plan?.status_label || planStatusLabel(account.plan?.status))}</div></div>
                        <div className="admin-plan-card"><div className="admin-plan-label">Provider</div><div className="admin-plan-value">{String(account.plan?.provider || '-')}</div></div>
                        <div className="admin-plan-card"><div className="admin-plan-label">Renovação</div><div className="admin-plan-value">{formatDateTime(account.plan?.renewal_date)}</div></div>
                      </div>

                      <div className="admin-account-users">
                        <div className="admin-section-title">Usuários da conta</div>
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th><th>Email</th><th>Último login</th><th>Ações</th></tr>
                            </thead>
                            <tbody>
                              {(Array.isArray(account.users) ? account.users : []).map((item) => {
                                const userId = Number(item.id || 0);
                                const isActive = Number(item.is_active) > 0;
                                const isDeleting = overviewBusyKey === `user-delete-${userId}`;
                                const isReactivating = overviewBusyKey === `user-reactivate-${userId}`;
                                const disableDelete = item.is_primary_admin === true;
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
                                        {isActive ? (
                                          <button
                                            type="button"
                                            className="btn btn-outline-danger btn-sm"
                                            onClick={() => openUserActionConfirm(item)}
                                            disabled={disableDelete || isDeleting || isReactivating}
                                            title={item.is_primary_admin ? 'Admin principal deve ser gerenciado na conta' : ''}
                                          >
                                            {isDeleting ? 'Desativando...' : 'Desativar'}
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              className="btn btn-success btn-sm"
                                              onClick={() => reactivateUser(item)}
                                              disabled={isDeleting || isReactivating}
                                            >
                                              {isReactivating ? 'Reativando...' : 'Reativar'}
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-outline-danger btn-sm"
                                              onClick={() => openUserActionConfirm(item)}
                                              disabled={disableDelete || isDeleting || isReactivating}
                                              title={item.is_primary_admin ? 'Admin principal deve ser gerenciado na conta' : ''}
                                            >
                                              {isDeleting ? 'Excluindo...' : 'Excluir'}
                                            </button>
                                          </>
                                        )}
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
            <div className="admin-email-sections">
              <button
                type="button"
                className={`admin-email-section-btn ${emailSection === 'delivery' ? 'active' : ''}`}
                onClick={() => setEmailSection('delivery')}
              >
                Envio e template
              </button>
              <button
                type="button"
                className={`admin-email-section-btn ${emailSection === 'inbox' ? 'active' : ''}`}
                onClick={() => setEmailSection('inbox')}
              >
                Caixa suporte ({supportInboxUnreadCount})
              </button>
            </div>

            {emailSection === 'delivery' && (loadingEmailSettings ? (
              <div className="admin-muted">Carregando configurações...</div>
            ) : (
              <>
                <div className="admin-email-block">
                  <h3>Canal de envio</h3>
                  <p>Defina provider, remetente e autenticação.</p>
                  <div className="admin-settings-grid">
                    <div className="admin-form-group"><label>Provider</label><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="mailgun">Mailgun</option><option value="sendgrid">SendGrid</option></select></div>
                    <div className="admin-form-group"><label>Nome da aplicação</label><input value={appName} onChange={(event) => setAppName(event.target.value)} /></div>
                    <div className="admin-form-group"><label>Timeout da requisição (ms)</label><input type="number" min={1000} max={60000} value={requestTimeoutMs} onChange={(event) => setRequestTimeoutMs(Number(event.target.value || 10000))} /></div>

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
                          <input type="password" value={mailgunApiKeyInput} onChange={(event) => setMailgunApiKeyInput(event.target.value)} placeholder={hasMailgunApiKey ? 'Chave já configurada. Preencha apenas se quiser substituir.' : 'Cole a API key do Mailgun'} />
                          <div className="admin-muted">Atual: {hasMailgunApiKey ? mailgunApiKeyMasked || 'Configurada' : 'Não configurada'}</div>
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
                          <input type="password" value={sendgridApiKeyInput} onChange={(event) => setSendgridApiKeyInput(event.target.value)} placeholder={hasSendgridApiKey ? 'Chave já configurada. Preencha apenas se quiser substituir.' : 'Cole a API key do SendGrid'} />
                          <div className="admin-muted">Atual: {hasSendgridApiKey ? sendgridApiKeyMasked || 'Configurada' : 'Não configurada'}</div>
                          <label style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={removeSendgridApiKey} onChange={(event) => setRemoveSendgridApiKey(event.target.checked)} />Remover chave salva</label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="admin-email-block">
                  <h3>Template de confirmação</h3>
                  <p>Edite o assunto e o conteúdo do e-mail de cadastro.</p>
                  <div className="admin-form-group"><label>Template - Assunto</label><input value={subjectTemplate} onChange={(event) => setSubjectTemplate(event.target.value)} /></div>
                  <div className="admin-form-group"><label>Template - HTML</label><textarea value={htmlTemplate} onChange={(event) => setHtmlTemplate(event.target.value)} /></div>
                  <div className="admin-form-group"><label>Template - Texto</label><textarea value={textTemplate} onChange={(event) => setTextTemplate(event.target.value)} /></div>
                  <div className="admin-muted">Variáveis: {'{{name}}'}, {'{{email}}'}, {'{{confirmation_url}}'}, {'{{app_name}}'}, {'{{expires_in_text}}'}, {'{{app_url}}'}, {'{{logo_url}}'}, {'{{company_name}}'}, {'{{company_website}}'}, {'{{company_email}}'}</div>

                  <div className="admin-actions">
                    <input type="text" className="form-input" style={{ maxWidth: 220 }} placeholder="Nome para preview" value={previewName} onChange={(event) => setPreviewName(event.target.value)} />
                    <input type="email" className="form-input" style={{ maxWidth: 320 }} placeholder="email para preview" value={previewEmail} onChange={(event) => setPreviewEmail(event.target.value)} />
                    <button type="button" className="btn btn-outline" onClick={previewEmailTemplate} disabled={loadingEmailPreview}>{loadingEmailPreview ? 'Gerando preview...' : 'Pre-visualizar'}</button>
                  </div>
                </div>

                <div className="admin-email-block">
                  <h3>Ações rápidas</h3>
                  <p>Salve as configurações e valide com envio de teste.</p>
                  <div className="admin-actions">
                    <button type="button" className="btn btn-primary" onClick={saveEmailSettings} disabled={savingEmailSettings}>{savingEmailSettings ? 'Salvando...' : 'Salvar configurações'}</button>
                    <input type="email" className="form-input" style={{ maxWidth: 320 }} placeholder="email@destino.com" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} />
                    <button type="button" className="btn btn-outline" onClick={sendTestEmail} disabled={sendingTestEmail}>{sendingTestEmail ? 'Enviando teste...' : 'Enviar teste'}</button>
                  </div>
                </div>

                {emailError && <div className="admin-alert admin-alert-error" style={{ marginTop: 12 }}>{emailError}</div>}
                {emailSuccess && <div className="admin-alert admin-alert-success" style={{ marginTop: 12 }}>{emailSuccess}</div>}
              </>
            ))}

            {emailSection === 'inbox' && (
              <>
                <div className="admin-email-block">
                  <h3>Caixa de entrada - suporte@zapvender.com</h3>
                  <p>Mensagens recebidas pelo webhook de entrada de e-mail.</p>
                  <div className="admin-muted">Endpoint de entrada: <code>/webhooks/support-inbox/incoming</code></div>
                  <div className="admin-actions">
                    <button type="button" className="btn btn-outline" onClick={() => loadSupportInbox()} disabled={loadingSupportInbox}>
                      {loadingSupportInbox ? 'Atualizando...' : 'Atualizar caixa'}
                    </button>
                    <span className="admin-muted">Não lidas: {supportInboxUnreadCount}</span>
                  </div>
                </div>

                {supportInboxError && <div className="admin-alert admin-alert-error">{supportInboxError}</div>}

                {loadingSupportInbox ? (
                  <div className="admin-muted">Carregando caixa de entrada...</div>
                ) : supportInboxMessages.length === 0 ? (
                  <div className="admin-inbox-empty">Nenhum e-mail recebido em suporte@zapvender.com até agora.</div>
                ) : (
                  <div className="admin-inbox-layout">
                    <div className="admin-inbox-list">
                      {supportInboxMessages.map((item) => {
                        const itemId = Number(item.id || 0);
                        const isActive = Number(selectedSupportMessageId || 0) === itemId;
                        const isUnread = Number(item.is_read || 0) <= 0;
                        const sender = String(item.from_name || '').trim() || String(item.from_email || '-');
                        return (
                          <button
                            key={itemId}
                            type="button"
                            className={`admin-inbox-item ${isActive ? 'active' : ''}`}
                            onClick={() => setSelectedSupportMessageId(itemId)}
                          >
                            <div className="admin-inbox-item-subject">{String(item.subject || '(Sem assunto)')}</div>
                            <div className="admin-inbox-item-meta">
                              <span>{sender}</span>
                              <span>{formatDateTime(item.received_at)}</span>
                            </div>
                            {isUnread && <span className="admin-inbox-item-unread">nova</span>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="admin-inbox-detail">
                      {selectedSupportMessage ? (
                        <>
                          <div className="admin-inbox-header">
                            <div>
                              <h4 className="admin-inbox-subject">{String(selectedSupportMessage.subject || '(Sem assunto)')}</h4>
                              <div className="admin-muted">
                                De: {String(selectedSupportMessage.from_name || '').trim() || '-'} &lt;{String(selectedSupportMessage.from_email || '-')}&gt; | Para: {String(selectedSupportMessage.to_email || 'support@zapvender.com')}
                              </div>
                              <div className="admin-muted">Recebido em: {formatDateTime(selectedSupportMessage.received_at)}</div>
                            </div>
                            <div className="admin-actions">
                              {Number(selectedSupportMessage.is_read || 0) > 0 ? (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => markSupportMessageRead(Number(selectedSupportMessage.id), false)}
                                  disabled={updatingSupportMessageId === Number(selectedSupportMessage.id)}
                                >
                                  Marcar como não lida
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => markSupportMessageRead(Number(selectedSupportMessage.id), true)}
                                  disabled={updatingSupportMessageId === Number(selectedSupportMessage.id)}
                                >
                                  Marcar como lida
                                </button>
                              )}
                            </div>
                          </div>
                          {String(selectedSupportMessage.body_text || '').trim() ? (
                            <div className="admin-inbox-body">{String(selectedSupportMessage.body_text || '')}</div>
                          ) : String(selectedSupportMessage.body_html || '').trim() ? (
                            <iframe
                              title={`support-inbox-${selectedSupportMessage.id}`}
                              srcDoc={String(selectedSupportMessage.body_html || '')}
                              sandbox="allow-popups allow-popups-to-escape-sandbox"
                              referrerPolicy="no-referrer"
                              style={{
                                width: '100%',
                                minHeight: 280,
                                border: '1px solid var(--border-color)',
                                borderRadius: 10,
                                background: '#fff'
                              }}
                            />
                          ) : (
                            <div className="admin-inbox-empty">Mensagem sem conteúdo disponível.</div>
                          )}
                        </>
                      ) : (
                        <div className="admin-inbox-empty">Selecione um e-mail para visualizar.</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
      {emailPreview && (
        <div className="modal-overlay active">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="modal-title">Pre-visualizacao do e-mail</h3>
              <button type="button" className="modal-close" onClick={() => setEmailPreview(null)}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Assunto</label>
                <input className="form-input" value={String(emailPreview.subject || '')} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">HTML renderizado</label>
                <iframe
                  title="Email preview"
                  srcDoc={String(emailPreview.html || '')}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    minHeight: 360,
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    background: '#fff'
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Texto renderizado</label>
                <textarea className="form-textarea" rows={8} value={String(emailPreview.text || '')} readOnly />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setEmailPreview(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
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
                  <label className="form-label">Nome da empresa</label>
                  <input className="form-input" value={accountDraft.companyName} onChange={(event) => setAccountDraft({ ...accountDraft, companyName: event.target.value })} />
                </div>
              </div>
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
                  <label className="form-label">Código do plano</label>
                  <input className="form-input" value={accountDraft.planCode} onChange={(event) => setAccountDraft({ ...accountDraft, planCode: event.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Provider do plano</label>
                  <input className="form-input" value={accountDraft.planProvider} onChange={(event) => setAccountDraft({ ...accountDraft, planProvider: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Data de renovação</label>
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
              <h3 className="modal-title">Editar usuário</h3>
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
              {userDraft.isPrimaryAdmin && <div className="admin-modal-note">Este usuário é o admin principal da conta. Algumas alterações ficam bloqueadas por segurança.</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setUserDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={submitUserEdit} disabled={Boolean(userEditBusy)}>{userEditBusy ? 'Salvando...' : 'Salvar usuário'}</button>
            </div>
          </div>
        </div>
      )}
      {accountActionConfirmDraft && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{accountActionConfirmDraft.mode === 'deactivate' ? 'Confirmar desativação da conta' : 'Confirmar exclusão da conta'}</h3>
              <button type="button" className="modal-close" onClick={() => setAccountActionConfirmDraft(null)} disabled={Boolean(accountActionBusy)}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <p className="admin-muted" style={{ margin: 0 }}>
                {accountActionConfirmDraft.mode === 'deactivate'
                  ? `Deseja desativar a conta "${accountActionConfirmDraft.companyName}"? Todos os usuários vinculados serão bloqueados.`
                  : `Deseja excluir permanentemente a conta "${accountActionConfirmDraft.companyName}"?`}
              </p>
              {accountActionConfirmDraft.mode === 'delete' && (
                <div className="admin-modal-note">Esta ação não pode ser desfeita.</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setAccountActionConfirmDraft(null)} disabled={Boolean(accountActionBusy)}>Cancelar</button>
              <button type="button" className="btn btn-outline-danger" onClick={confirmAccountAction} disabled={Boolean(accountActionBusy)}>
                {accountActionBusy
                  ? (accountActionConfirmDraft.mode === 'deactivate' ? 'Desativando...' : 'Excluindo...')
                  : (accountActionConfirmDraft.mode === 'deactivate' ? 'Desativar conta' : 'Excluir conta')}
              </button>
            </div>
          </div>
        </div>
      )}
      {userActionConfirmDraft && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{userActionConfirmDraft.isActive ? 'Confirmar desativação' : 'Confirmar exclusão'}</h3>
              <button type="button" className="modal-close" onClick={() => setUserActionConfirmDraft(null)} disabled={Boolean(userActionBusy)}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <p className="admin-muted" style={{ margin: 0 }}>
                {userActionConfirmDraft.isActive
                  ? `Deseja desativar o usuário "${userActionConfirmDraft.name}"?`
                  : `Deseja excluir permanentemente o usuário "${userActionConfirmDraft.name}"?`}
              </p>
              {!userActionConfirmDraft.isActive && (
                <div className="admin-modal-note">Esta ação não pode ser desfeita.</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setUserActionConfirmDraft(null)} disabled={Boolean(userActionBusy)}>Cancelar</button>
              <button type="button" className="btn btn-outline-danger" onClick={confirmUserAction} disabled={Boolean(userActionBusy)}>
                {userActionBusy ? (userActionConfirmDraft.isActive ? 'Desativando...' : 'Excluindo...') : (userActionConfirmDraft.isActive ? 'Desativar usuário' : 'Excluir usuário')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
