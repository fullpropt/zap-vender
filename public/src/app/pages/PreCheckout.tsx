import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import PreCheckoutLeadForm from '../components/preCheckout/PreCheckoutLeadForm';
import PreCheckoutOfferPanel from '../components/preCheckout/PreCheckoutOfferPanel';
import { brandFullLogoUrl, brandName } from '../lib/brand';
import {
  createEmptyPreCheckoutValues,
  extractWhatsappDigits,
  formatPreCheckoutWhatsappInput,
  loadPreCheckoutDraft,
  normalizePreCheckoutValues,
  savePreCheckoutDraft,
  savePreCheckoutSubmission,
  validatePreCheckout,
  type PreCheckoutField,
  type PreCheckoutFieldErrors,
  type PreCheckoutFormValues
} from '../lib/preCheckoutStorage';
import './pre-checkout.css';

type PlanPreview = {
  key: string;
  title: string;
  subtitle: string;
  planName: string;
  trialLabel: string;
  recurringLabel: string;
  benefits: string[];
  highlights: Array<{ label: string; value: string }>;
};

const PLAN_PREVIEW_CATALOG: Record<string, PlanPreview> = {
  premium: {
    key: 'premium',
    title: 'Ative seu teste grátis',
    subtitle: 'Preencha seus dados para liberar o checkout com prioridade comercial.',
    planName: 'Plano Premium',
    trialLabel: '7 dias grátis',
    recurringLabel: 'Depois, R$ 197/mês',
    benefits: [
      '3 conexões WhatsApp simultâneas',
      'Escudo antibloqueio completo',
      'Webhooks e eventos personalizados',
      'Fluxos ilimitados e suporte prioritário'
    ],
    highlights: [
      { label: 'Tempo de cadastro', value: '< 1 minuto' },
      { label: 'Ativação', value: 'Imediata após o pagamento' }
    ]
  },
  starter: {
    key: 'starter',
    title: 'Finalize sua ativação',
    subtitle: 'Preencha seu pré-cadastro para seguir para o checkout sem perder o progresso.',
    planName: 'Plano Starter',
    trialLabel: 'Acesso imediato',
    recurringLabel: 'R$ 97/mês',
    benefits: [
      '1 conexão WhatsApp nativa',
      'Construtor de fluxo visual',
      'Inbox unificado',
      'Respostas automáticas 24/7'
    ],
    highlights: [
      { label: 'Tempo de cadastro', value: '< 1 minuto' },
      { label: 'Setup inicial', value: 'Assistido' }
    ]
  },
  advanced: {
    key: 'advanced',
    title: 'Inicie sua operação avançada',
    subtitle: 'Antecipe seus dados para ir ao checkout com preenchimento automático.',
    planName: 'Plano Avançado',
    trialLabel: 'Escala para equipes',
    recurringLabel: 'R$ 397/mês',
    benefits: [
      '5 conexões WhatsApp dedicadas',
      'Múltiplos agentes ilimitados',
      'Relatórios avançados e funil',
      'API e webhooks ilimitados'
    ],
    highlights: [
      { label: 'Tempo de cadastro', value: '< 1 minuto' },
      { label: 'Escalabilidade', value: 'Alta performance' }
    ]
  }
};

const TRUST_COPY = [
  { icon: 'OK', text: 'Cancele quando quiser' },
  { icon: 'OK', text: 'Leva menos de 1 minuto' },
  { icon: 'OK', text: 'Dados salvos para continuar depois' }
];

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

function extractUtm(search: string) {
  const params = new URLSearchParams(search);
  return {
    utm_source: String(params.get('utm_source') || '').trim(),
    utm_medium: String(params.get('utm_medium') || '').trim(),
    utm_campaign: String(params.get('utm_campaign') || '').trim(),
    utm_term: String(params.get('utm_term') || '').trim(),
    utm_content: String(params.get('utm_content') || '').trim()
  };
}

function resolveInitialValues(planKey: string, search: string): PreCheckoutFormValues {
  const draft = loadPreCheckoutDraft();
  const prefillFromSearch = normalizePreCheckoutValues({
    fullName: getFieldFromSearch(search, ['prefill_name', 'name']),
    email: getFieldFromSearch(search, ['prefill_email', 'email']),
    whatsapp: getFieldFromSearch(search, ['prefill_whatsapp', 'whatsapp', 'phone']),
    companyName: getFieldFromSearch(search, ['prefill_company_name', 'company_name']),
    primaryObjective: getFieldFromSearch(search, ['prefill_objective', 'objective'])
  });

  const baseValues =
    draft && draft.planKey === planKey
      ? draft.values
      : createEmptyPreCheckoutValues();

  return normalizePreCheckoutValues({
    ...baseValues,
    ...prefillFromSearch
  });
}

function isEmptyObject(value: Record<string, string>) {
  return Object.keys(value).length === 0;
}

export default function PreCheckout() {
  const location = useLocation();
  const planKeyFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizePlanKey(params.get('plan'));
  }, [location.search]);
  const selectedPlan = PLAN_PREVIEW_CATALOG[planKeyFromQuery] || PLAN_PREVIEW_CATALOG.premium;

  const [values, setValues] = useState<PreCheckoutFormValues>(() => resolveInitialValues(selectedPlan.key, location.search));
  const [touchedFields, setTouchedFields] = useState<Partial<Record<PreCheckoutField, boolean>>>({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(resolveInitialValues(selectedPlan.key, location.search));
    setTouchedFields({});
    setShowAllErrors(false);
    setSubmitError('');
  }, [location.search, selectedPlan.key]);

  useEffect(() => {
    document.title = `${brandName} | Pré-checkout`;
  }, []);

  useEffect(() => {
    savePreCheckoutDraft(selectedPlan.key, values);
  }, [selectedPlan.key, values]);

  const validationErrors = useMemo(() => validatePreCheckout(values), [values]);

  const visibleErrors = useMemo<PreCheckoutFieldErrors>(() => {
    const nextErrors: PreCheckoutFieldErrors = {};
    const entries = Object.entries(validationErrors) as Array<[PreCheckoutField, string]>;
    for (const [field, message] of entries) {
      if (!message) continue;
      if (showAllErrors || touchedFields[field]) {
        nextErrors[field] = message;
      }
    }
    return nextErrors;
  }, [showAllErrors, touchedFields, validationErrors]);

  const handleFieldChange = (field: PreCheckoutField, value: string) => {
    setSubmitError('');
    setValues((current) => {
      if (field === 'whatsapp') {
        return { ...current, whatsapp: formatPreCheckoutWhatsappInput(value) };
      }
      if (field === 'email') {
        return { ...current, email: String(value || '').trim().toLowerCase() };
      }
      return { ...current, [field]: value };
    });
  };

  const handleFieldBlur = (field: PreCheckoutField) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setShowAllErrors(true);
    setSubmitError('');

    const normalizedValues = normalizePreCheckoutValues(values);
    const errors = validatePreCheckout(normalizedValues);
    if (!isEmptyObject(errors as Record<string, string>)) {
      setValues(normalizedValues);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/pre-checkout/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planKey: selectedPlan.key,
          fullName: normalizedValues.fullName,
          email: normalizedValues.email,
          whatsapp: extractWhatsappDigits(normalizedValues.whatsapp),
          companyName: normalizedValues.companyName,
          primaryObjective: normalizedValues.primaryObjective,
          sourceUrl: window.location.href,
          path: `${location.pathname}${location.search}`,
          utm: extractUtm(location.search)
        })
      });

      const payload = await readJsonSafely(response) as {
        success?: boolean;
        error?: string;
        lead_capture_id?: number;
        redirect_url?: string;
      };

      if (!response.ok || !payload.redirect_url) {
        throw new Error(String(payload.error || 'Não foi possível continuar para o pagamento agora.'));
      }

      savePreCheckoutSubmission(selectedPlan.key, normalizedValues, payload.lead_capture_id || null);
      window.location.assign(String(payload.redirect_url));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível continuar para o pagamento agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="precheckout-page">
      <div className="precheckout-bg-layer" aria-hidden="true"></div>
      <div className="precheckout-shell">
        <header className="precheckout-header">
          <a href="#/planos" className="precheckout-brand-link" aria-label="Voltar para planos">
            <img src={brandFullLogoUrl} alt={brandName} />
          </a>
        </header>

        <section className="precheckout-content">
          <PreCheckoutOfferPanel
            title={selectedPlan.title}
            subtitle={selectedPlan.subtitle}
            planName={selectedPlan.planName}
            trialLabel={selectedPlan.trialLabel}
            recurringLabel={selectedPlan.recurringLabel}
            benefits={selectedPlan.benefits}
            highlights={selectedPlan.highlights}
            trustItems={TRUST_COPY}
          />

          <PreCheckoutLeadForm
            values={values}
            errors={visibleErrors}
            submitError={submitError}
            isSubmitting={isSubmitting}
            onFieldChange={handleFieldChange}
            onFieldBlur={handleFieldBlur}
            onSubmit={handleSubmit}
          />
        </section>
      </div>
    </main>
  );
}
