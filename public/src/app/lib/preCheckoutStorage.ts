export const PRE_CHECKOUT_OBJECTIVE_OPTIONS = [
  { value: 'organizar_leads', label: 'Organizar meus leads' },
  { value: 'automatizar_atendimento', label: 'Automatizar atendimento' },
  { value: 'aumentar_vendas', label: 'Aumentar minhas vendas' },
  { value: 'melhorar_whatsapp', label: 'Melhorar meu atendimento no WhatsApp' },
  { value: 'outro', label: 'Outro' }
] as const;

export type PreCheckoutObjective = typeof PRE_CHECKOUT_OBJECTIVE_OPTIONS[number]['value'];

export type PreCheckoutField =
  | 'fullName'
  | 'email'
  | 'whatsapp'
  | 'companyName'
  | 'primaryObjective';

export type PreCheckoutFieldErrors = Partial<Record<PreCheckoutField, string>>;

export interface PreCheckoutFormValues {
  fullName: string;
  email: string;
  whatsapp: string;
  companyName: string;
  primaryObjective: PreCheckoutObjective | '';
}

interface PreCheckoutDraftPayload {
  planKey: string;
  values: PreCheckoutFormValues;
  updatedAt: string;
}

interface PreCheckoutSubmissionPayload extends PreCheckoutDraftPayload {
  leadCaptureId?: number | null;
}

const PRE_CHECKOUT_DRAFT_KEY = 'zapvender.preCheckoutDraft.v1';
const PRE_CHECKOUT_SUBMISSION_KEY = 'zapvender.preCheckoutLead.v1';

function isBrowserRuntime() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeText(value: unknown, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown) {
  return normalizeText(value, 160).toLowerCase();
}

export function formatPreCheckoutWhatsappInput(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function extractWhatsappDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 18);
}

function normalizeObjective(value: unknown): PreCheckoutObjective | '' {
  const normalized = normalizeText(value, 80).toLowerCase();
  if (!normalized) return '';
  const option = PRE_CHECKOUT_OBJECTIVE_OPTIONS.find((item) => item.value === normalized);
  return option ? option.value : 'outro';
}

export function createEmptyPreCheckoutValues(): PreCheckoutFormValues {
  return {
    fullName: '',
    email: '',
    whatsapp: '',
    companyName: '',
    primaryObjective: ''
  };
}

export function normalizePreCheckoutValues(raw: Partial<PreCheckoutFormValues> | null | undefined): PreCheckoutFormValues {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    fullName: normalizeText(source.fullName, 120),
    email: normalizeEmail(source.email),
    whatsapp: formatPreCheckoutWhatsappInput(source.whatsapp),
    companyName: normalizeText(source.companyName, 120),
    primaryObjective: normalizeObjective(source.primaryObjective)
  };
}

function safeReadJson<T>(key: string): T | null {
  if (!isBrowserRuntime()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (_) {
    return null;
  }
}

function safeWriteJson(key: string, value: unknown) {
  if (!isBrowserRuntime()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Sem ação: falha de quota/localStorage indisponível.
  }
}

export function loadPreCheckoutDraft() {
  const payload = safeReadJson<PreCheckoutDraftPayload>(PRE_CHECKOUT_DRAFT_KEY);
  if (!payload || typeof payload !== 'object') return null;

  return {
    planKey: normalizeText(payload.planKey, 40).toLowerCase() || 'premium',
    values: normalizePreCheckoutValues(payload.values),
    updatedAt: normalizeText(payload.updatedAt, 60)
  };
}

export function savePreCheckoutDraft(planKey: string, values: PreCheckoutFormValues) {
  safeWriteJson(PRE_CHECKOUT_DRAFT_KEY, {
    planKey: normalizeText(planKey, 40).toLowerCase() || 'premium',
    values: normalizePreCheckoutValues(values),
    updatedAt: new Date().toISOString()
  } satisfies PreCheckoutDraftPayload);
}

export function savePreCheckoutSubmission(planKey: string, values: PreCheckoutFormValues, leadCaptureId?: number | null) {
  safeWriteJson(PRE_CHECKOUT_SUBMISSION_KEY, {
    planKey: normalizeText(planKey, 40).toLowerCase() || 'premium',
    values: normalizePreCheckoutValues(values),
    leadCaptureId: Number.isInteger(Number(leadCaptureId)) ? Number(leadCaptureId) : null,
    updatedAt: new Date().toISOString()
  } satisfies PreCheckoutSubmissionPayload);
}

export function validatePreCheckout(values: PreCheckoutFormValues): PreCheckoutFieldErrors {
  const errors: PreCheckoutFieldErrors = {};

  if (values.fullName.trim().length < 3) {
    errors.fullName = 'Informe seu nome completo.';
  }

  const email = normalizeEmail(values.email);
  if (!email) {
    errors.email = 'Informe um e-mail válido.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'E-mail inválido.';
  }

  const whatsappDigits = extractWhatsappDigits(values.whatsapp);
  if (whatsappDigits.length < 10) {
    errors.whatsapp = 'Informe um telefone com DDD.';
  }

  if (values.companyName.trim().length < 2) {
    errors.companyName = 'Informe o nome da sua empresa.';
  }

  if (!values.primaryObjective) {
    errors.primaryObjective = 'Selecione seu principal objetivo.';
  }

  return errors;
}
