import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { brandFullLogoUrl, brandName } from '../lib/brand';
import {
  extractWhatsappDigits,
  formatPreCheckoutWhatsappInput,
  loadPreCheckoutDraft,
  loadPreCheckoutSubmission,
  normalizePreCheckoutValues
} from '../lib/preCheckoutStorage';
import './public-checkout.css';

type CheckoutPlan = {
  key: string;
  name: string;
  amountCents: number;
  trialDays: number;
  accent: string;
  accentSoft: string;
  summary: string;
  bullets: string[];
};

type CheckoutFormValues = {
  fullName: string;
  email: string;
  whatsapp: string;
  companyName: string;
  primaryObjective: string;
  documentType: 'cpf' | 'cnpj';
  documentNumber: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
};

type CheckoutConfigResponse = {
  success?: boolean;
  plan?: {
    key?: string;
    code?: string;
    name?: string;
    amount_cents?: number;
    trial_days?: number;
  };
  pagarme?: {
    public_key_configured?: boolean;
    public_key?: string;
  };
  error?: string;
};

const PLAN_CATALOG: Record<string, CheckoutPlan> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    amountCents: 9700,
    trialDays: 0,
    accent: '#22c55e',
    accentSoft: 'rgba(34, 197, 94, 0.16)',
    summary: '1 conexão WhatsApp e até 1000 contatos para começar sem fricção.',
    bullets: ['1 conexão WhatsApp', 'Até 1000 contatos', 'Fluxos e inbox incluídos']
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    amountCents: 19700,
    trialDays: 7,
    accent: '#cfd7e6',
    accentSoft: 'rgba(207, 215, 230, 0.16)',
    summary: '3 conexões WhatsApp, contatos ilimitados e 7 dias grátis para ativar sem cobrança do plano hoje.',
    bullets: ['3 conexões WhatsApp', 'Contatos ilimitados', '7 dias grátis']
  },
  advanced: {
    key: 'advanced',
    name: 'Avançado',
    amountCents: 39700,
    trialDays: 0,
    accent: '#eab308',
    accentSoft: 'rgba(234, 179, 8, 0.16)',
    summary: '5 conexões WhatsApp, contatos ilimitados e operação mais robusta.',
    bullets: ['5 conexões WhatsApp', 'Contatos ilimitados', 'Escala para equipe']
  }
};

function normalizePlanKey(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'avancado' || normalized === 'avançado') return 'advanced';
  if (normalized === 'starter' || normalized === 'advanced' || normalized === 'premium') {
    return normalized;
  }
  return 'premium';
}

function readJsonSafely(response: Response) {
  return response.text().then((raw) => {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  });
}

function getFieldFromSearch(search: string, candidates: string[]) {
  const params = new URLSearchParams(search);
  for (const candidate of candidates) {
    const value = String(params.get(candidate) || '').trim();
    if (value) return value;
  }
  return '';
}

function digitsOnly(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function formatCurrencyBRL(amountCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format((Number(amountCents || 0) || 0) / 100);
}

function formatDocumentInput(value: string, documentType: 'cpf' | 'cnpj') {
  const digits = digitsOnly(value);
  if (documentType === 'cnpj') {
    const normalized = digits.slice(0, 14);
    if (normalized.length <= 2) return normalized;
    if (normalized.length <= 5) return `${normalized.slice(0, 2)}.${normalized.slice(2)}`;
    if (normalized.length <= 8) return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5)}`;
    if (normalized.length <= 12) return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8)}`;
    return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`;
  }

  const normalized = digits.slice(0, 11);
  if (normalized.length <= 3) return normalized;
  if (normalized.length <= 6) return `${normalized.slice(0, 3)}.${normalized.slice(3)}`;
  if (normalized.length <= 9) return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6)}`;
  return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-${normalized.slice(9)}`;
}

function formatCardNumber(value: string) {
  return digitsOnly(value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
}

function formatCardExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function parseExpiryParts(value: string) {
  const digits = digitsOnly(value);
  if (digits.length !== 4) return { month: '', year: '' };
  const month = digits.slice(0, 2);
  const monthNumber = Number(month);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return { month: '', year: '' };
  }
  return { month, year: `20${digits.slice(2, 4)}` };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function validateForm(values: CheckoutFormValues) {
  const errors: Partial<Record<keyof CheckoutFormValues, string>> = {};

  if (String(values.fullName || '').trim().length < 3) errors.fullName = 'Informe seu nome completo.';
  if (!isValidEmail(values.email)) errors.email = 'Informe um e-mail válido.';
  if (digitsOnly(values.whatsapp).length < 10) errors.whatsapp = 'Informe um telefone com DDD.';

  const documentDigits = digitsOnly(values.documentNumber);
  if (values.documentType === 'cnpj') {
    if (documentDigits.length !== 14) errors.documentNumber = 'Informe um CNPJ válido.';
  } else if (documentDigits.length !== 11) {
    errors.documentNumber = 'Informe um CPF válido.';
  }

  if (String(values.cardHolderName || '').trim().length < 3) errors.cardHolderName = 'Informe o nome do cartão.';
  if (digitsOnly(values.cardNumber).length < 13) errors.cardNumber = 'Número do cartão inválido.';
  if (!parseExpiryParts(values.cardExpiry).month) errors.cardExpiry = 'Validade inválida.';
  if (digitsOnly(values.cardCvv).length < 3) errors.cardCvv = 'CVV inválido.';

  return errors;
}

function resolveInitialValues(planKey: string, search: string) {
  const submission = loadPreCheckoutSubmission();
  const draft = loadPreCheckoutDraft();
  const baseSource =
    submission && submission.planKey === planKey
      ? submission
      : draft && draft.planKey === planKey
        ? { values: draft.values, leadCaptureId: null }
        : null;

  const prefillFromSearch = normalizePreCheckoutValues({
    fullName: getFieldFromSearch(search, ['prefill_name', 'name']),
    email: getFieldFromSearch(search, ['prefill_email', 'email']),
    whatsapp: getFieldFromSearch(search, ['prefill_whatsapp', 'whatsapp', 'phone']),
    companyName: getFieldFromSearch(search, ['prefill_company_name', 'company_name']),
    primaryObjective: getFieldFromSearch(search, ['prefill_objective', 'objective'])
  });

  const leadCaptureIdRaw = Number(getFieldFromSearch(search, ['lead_capture_id', 'leadCaptureId']));
  const leadCaptureId = Number.isInteger(leadCaptureIdRaw) && leadCaptureIdRaw > 0
    ? leadCaptureIdRaw
    : (baseSource?.leadCaptureId || null);

  const baseValues = baseSource?.values || normalizePreCheckoutValues(null);
  const resolved = normalizePreCheckoutValues({ ...baseValues, ...prefillFromSearch });

  return {
    values: {
      fullName: resolved.fullName,
      email: resolved.email,
      whatsapp: resolved.whatsapp,
      companyName: resolved.companyName,
      primaryObjective: resolved.primaryObjective,
      documentType: 'cpf' as const,
      documentNumber: '',
      cardHolderName: resolved.fullName,
      cardNumber: '',
      cardExpiry: '',
      cardCvv: ''
    },
    leadCaptureId
  };
}

async function tokenizeCard(publicKey: string, values: CheckoutFormValues) {
  const expiry = parseExpiryParts(values.cardExpiry);
  const response = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(publicKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      type: 'card',
      card: {
        holder_name: String(values.cardHolderName || '').trim(),
        number: digitsOnly(values.cardNumber),
        exp_month: expiry.month,
        exp_year: expiry.year,
        cvv: digitsOnly(values.cardCvv)
      }
    })
  });

  const payload = await readJsonSafely(response) as {
    id?: string;
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!response.ok || !payload.id) {
    const fieldError = payload.errors && typeof payload.errors === 'object'
      ? Object.values(payload.errors).flat().find(Boolean)
      : '';
    throw new Error(String(fieldError || payload.message || 'Não foi possível validar o cartão agora.'));
  }

  return String(payload.id).trim();
}

function buildCardPayload(values: CheckoutFormValues) {
  const expiry = parseExpiryParts(values.cardExpiry);
  return {
    cardHolderName: String(values.cardHolderName || '').trim(),
    cardNumber: digitsOnly(values.cardNumber),
    cardExpMonth: expiry.month,
    cardExpYear: expiry.year,
    cardCvv: digitsOnly(values.cardCvv)
  };
}

function Field({
  label,
  error,
  full = false,
  children
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`public-checkout-field ${full ? 'full' : ''} ${error ? 'has-error' : ''}`}>
      <label>{label}</label>
      {children}
      {error ? <small>{error}</small> : null}
    </div>
  );
}

export default function PublicCheckout() {
  const { planKey: planKeyParam } = useParams<{ planKey: string }>();
  const location = useLocation();
  const normalizedPlanKey = normalizePlanKey(planKeyParam);
  const plan = PLAN_CATALOG[normalizedPlanKey] || PLAN_CATALOG.premium;
  const initialState = useMemo(() => resolveInitialValues(plan.key, location.search), [location.search, plan.key]);

  const [values, setValues] = useState<CheckoutFormValues>(initialState.values);
  const [leadCaptureId, setLeadCaptureId] = useState<number | null>(initialState.leadCaptureId);
  const [config, setConfig] = useState<CheckoutConfigResponse | null>(null);
  const [configError, setConfigError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    setValues(initialState.values);
    setLeadCaptureId(initialState.leadCaptureId);
    setSubmitError('');
  }, [initialState]);

  useEffect(() => {
    document.title = `${brandName} | Checkout`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingConfig(true);
    setConfigError('');

    fetch(`/api/public/billing/checkout/${encodeURIComponent(plan.key)}/config`)
      .then(async (response) => {
        const payload = await readJsonSafely(response) as CheckoutConfigResponse;
        if (!response.ok || !payload.success) {
          throw new Error(String(payload.error || 'Não foi possível carregar o checkout agora.'));
        }
        if (!cancelled) setConfig(payload);
      })
      .catch((error) => {
        if (!cancelled) {
          setConfig(null);
          setConfigError(error instanceof Error ? error.message : 'Não foi possível carregar o checkout agora.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConfig(false);
      });

    return () => {
      cancelled = true;
    };
  }, [plan.key]);

  const effectiveAmountCents = Number(config?.plan?.amount_cents || plan.amountCents || 0);
  const effectiveTrialDays = Number(config?.plan?.trial_days ?? plan.trialDays ?? 0);
  const pagarmePublicKey = String(config?.pagarme?.public_key || '').trim();
  const isPublicKeyConfigured = Boolean(config?.pagarme?.public_key_configured && pagarmePublicKey);
  const validationErrors = useMemo(() => validateForm(values), [values]);

  const themeStyle = useMemo<CSSProperties>(() => ({
    '--checkout-accent': plan.accent,
    '--checkout-accent-soft': plan.accentSoft
  } as CSSProperties), [plan.accent, plan.accentSoft]);

  const handleChange = (field: keyof CheckoutFormValues, nextValue: string) => {
    setSubmitError('');
    setValues((current) => {
      if (field === 'email') return { ...current, email: String(nextValue || '').trim().toLowerCase() };
      if (field === 'whatsapp') return { ...current, whatsapp: formatPreCheckoutWhatsappInput(nextValue) };
      if (field === 'documentType') {
        const nextType = nextValue === 'cnpj' ? 'cnpj' : 'cpf';
        return { ...current, documentType: nextType, documentNumber: formatDocumentInput(current.documentNumber, nextType) };
      }
      if (field === 'documentNumber') return { ...current, documentNumber: formatDocumentInput(nextValue, current.documentType) };
      if (field === 'cardNumber') return { ...current, cardNumber: formatCardNumber(nextValue) };
      if (field === 'cardExpiry') return { ...current, cardExpiry: formatCardExpiry(nextValue) };
      if (field === 'cardCvv') return { ...current, cardCvv: digitsOnly(nextValue).slice(0, 4) };
      return { ...current, [field]: nextValue };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Revise os campos destacados antes de continuar.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const cardToken = isPublicKeyConfigured
        ? await tokenizeCard(pagarmePublicKey, values)
        : '';
      const response = await fetch(`/api/public/billing/checkout/${encodeURIComponent(plan.key)}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          whatsapp: extractWhatsappDigits(values.whatsapp),
          companyName: values.companyName,
          primaryObjective: values.primaryObjective,
          documentType: values.documentType,
          documentNumber: digitsOnly(values.documentNumber),
          cardToken,
          ...(!cardToken ? buildCardPayload(values) : {}),
          leadCaptureId
        })
      });

      const payload = await readJsonSafely(response) as { redirect_url?: string; error?: string; };
      if (!response.ok || !payload.redirect_url) {
        throw new Error(String(payload.error || 'Não foi possível iniciar a assinatura agora.'));
      }

      window.location.assign(String(payload.redirect_url));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayLabel = effectiveTrialDays > 0 ? 'Hoje · R$ 0,00' : `Hoje · ${formatCurrencyBRL(effectiveAmountCents)}`;
  const renewalLabel = effectiveTrialDays > 0
    ? `Em ${effectiveTrialDays} dias · ${formatCurrencyBRL(effectiveAmountCents)}`
    : `A cada 30 dias · ${formatCurrencyBRL(effectiveAmountCents)}`;

  return (
    <div className="public-checkout-page" style={themeStyle}>
      <div className="public-checkout-shell">
        <a href="#/planos" className="public-checkout-brand" aria-label="Voltar para os planos">
          <img src={brandFullLogoUrl} alt={brandName} />
        </a>

        <div className="public-checkout-grid">
          <section className="public-checkout-card">
            <div className="public-checkout-eyebrow">Checkout seguro · {plan.name}</div>
            <h1 className="public-checkout-title">
              {effectiveTrialDays > 0 ? `${effectiveTrialDays} dias grátis para ativar` : 'Concluir assinatura'}
            </h1>
            <p className="public-checkout-copy">{plan.summary}</p>

            <div className="public-checkout-trust">
              <div className="public-checkout-pill"><strong>Dados preservados</strong>Nome, e-mail e telefone chegam do pré-checkout.</div>
              <div className="public-checkout-pill"><strong>Confirmação por e-mail</strong>Após a assinatura, você recebe o link para concluir o cadastro.</div>
              <div className="public-checkout-pill"><strong>Página própria</strong>O pagamento acontece no ZapVender, sem repetir o fluxo anterior.</div>
            </div>

            <form className="public-checkout-form" onSubmit={handleSubmit} noValidate>
              <div className="public-checkout-section-title">Dados da conta</div>
              <div className="public-checkout-form-grid">
                <Field label="Nome completo" error={validationErrors.fullName} full>
                  <input className="public-checkout-input" autoComplete="name" value={values.fullName} onChange={(event) => handleChange('fullName', event.target.value)} />
                </Field>
                <Field label="E-mail" error={validationErrors.email}>
                  <input className="public-checkout-input" type="email" autoComplete="email" value={values.email} onChange={(event) => handleChange('email', event.target.value)} />
                </Field>
                <Field label="Celular com DDD" error={validationErrors.whatsapp}>
                  <input className="public-checkout-input" type="tel" autoComplete="tel" value={values.whatsapp} onChange={(event) => handleChange('whatsapp', event.target.value)} />
                </Field>
                <Field label="Empresa" full>
                  <input className="public-checkout-input" autoComplete="organization" value={values.companyName} onChange={(event) => handleChange('companyName', event.target.value)} />
                </Field>
                <Field label="Documento">
                  <select className="public-checkout-select" value={values.documentType} onChange={(event) => handleChange('documentType', event.target.value)}>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                  </select>
                </Field>
                <Field label="Número do documento" error={validationErrors.documentNumber}>
                  <input className="public-checkout-input" inputMode="numeric" value={values.documentNumber} onChange={(event) => handleChange('documentNumber', event.target.value)} />
                </Field>
              </div>

              <div className="public-checkout-section-title">Pagamento</div>
              <div className="public-checkout-form-grid">
                <Field label="Nome impresso no cartão" error={validationErrors.cardHolderName} full>
                  <input className="public-checkout-input" autoComplete="cc-name" value={values.cardHolderName} onChange={(event) => handleChange('cardHolderName', event.target.value)} />
                </Field>
                <Field label="Número do cartão" error={validationErrors.cardNumber} full>
                  <input className="public-checkout-input" inputMode="numeric" autoComplete="cc-number" value={values.cardNumber} onChange={(event) => handleChange('cardNumber', event.target.value)} />
                </Field>
                <Field label="Validade (MM/AA)" error={validationErrors.cardExpiry}>
                  <input className="public-checkout-input" inputMode="numeric" autoComplete="cc-exp" value={values.cardExpiry} onChange={(event) => handleChange('cardExpiry', event.target.value)} />
                </Field>
                <Field label="CVV" error={validationErrors.cardCvv}>
                  <input className="public-checkout-input" inputMode="numeric" autoComplete="cc-csc" value={values.cardCvv} onChange={(event) => handleChange('cardCvv', event.target.value)} />
                </Field>
              </div>

              {isLoadingConfig ? <div className="public-checkout-banner">Carregando configuração do checkout...</div> : null}
              {configError ? <div className="public-checkout-error">{configError}</div> : null}
              {!isLoadingConfig && !configError && effectiveTrialDays > 0 ? (
                <div className="public-checkout-banner">
                  Seu plano entra com <strong>{effectiveTrialDays} dias grátis</strong>. O Pagar.me pode realizar apenas uma verificação temporária do cartão durante a ativação.
                </div>
              ) : null}
              {submitError ? <div className="public-checkout-error">{submitError}</div> : null}

              <button className="public-checkout-submit" type="submit" disabled={isSubmitting || isLoadingConfig}>
                {isSubmitting ? 'Ativando assinatura...' : effectiveTrialDays > 0 ? `Iniciar ${effectiveTrialDays} dias grátis` : 'Concluir assinatura'}
              </button>
            </form>
          </section>

          <aside className="public-checkout-summary">
            <div className="public-checkout-eyebrow">Resumo da assinatura</div>
            <h2>{plan.name}</h2>
            <p>{plan.summary}</p>

            <div className="public-checkout-plan-card">
              <div className="public-checkout-price-line"><span>Plano</span><strong>{plan.name}</strong></div>
              <div className="public-checkout-price-line"><span>{effectiveTrialDays > 0 ? 'Cobrança inicial' : 'Cobrança de hoje'}</span><strong>{todayLabel}</strong></div>
              <div className="public-checkout-price-line"><span>{effectiveTrialDays > 0 ? 'Primeira renovação' : 'Renovação'}</span><strong>{renewalLabel}</strong></div>
            </div>

            <ul className="public-checkout-bullets">
              {plan.bullets.map((bullet) => (
                <li key={bullet}><span className="public-checkout-bullet-dot" aria-hidden="true"></span><span>{bullet}</span></li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
