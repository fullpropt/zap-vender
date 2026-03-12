import type { FormEvent } from 'react';
import {
  PRE_CHECKOUT_OBJECTIVE_OPTIONS,
  type PreCheckoutField,
  type PreCheckoutFieldErrors,
  type PreCheckoutFormValues
} from '../../lib/preCheckoutStorage';

type Props = {
  values: PreCheckoutFormValues;
  errors: PreCheckoutFieldErrors;
  submitError: string;
  isSubmitting: boolean;
  onFieldChange: (field: PreCheckoutField, value: string) => void;
  onFieldBlur: (field: PreCheckoutField) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type FieldProps = {
  id: string;
  name: PreCheckoutField;
  label: string;
  placeholder?: string;
  value: string;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  onFieldChange: (field: PreCheckoutField, value: string) => void;
  onFieldBlur: (field: PreCheckoutField) => void;
};

function TextField({
  id,
  name,
  label,
  placeholder,
  value,
  error,
  required = true,
  type = 'text',
  autoComplete,
  onFieldChange,
  onFieldBlur
}: FieldProps) {
  return (
    <div className={`precheckout-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onFieldChange(name, event.target.value)}
        onBlur={() => onFieldBlur(name)}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
        required={required}
      />
      {error ? <small id={`${id}-error`}>{error}</small> : null}
    </div>
  );
}

export default function PreCheckoutLeadForm({
  values,
  errors,
  submitError,
  isSubmitting,
  onFieldChange,
  onFieldBlur,
  onSubmit
}: Props) {
  return (
    <section className="precheckout-form-panel" aria-labelledby="precheckout-form-title">
      <div className="precheckout-steps" aria-label="Progresso do funil">
        <div className="precheckout-step active">
          <span>Etapa 1</span>
          <strong>Seus dados</strong>
        </div>
        <div className="precheckout-step">
          <span>Etapa 2</span>
          <strong>Pagamento</strong>
        </div>
      </div>

      <h2 id="precheckout-form-title">Complete seu pré-cadastro</h2>
      <p className="precheckout-form-copy">
        Preencha os campos abaixo para seguir para o pagamento com tudo pronto.
      </p>

      <form className="precheckout-form" onSubmit={onSubmit} noValidate>
        <TextField
          id="precheckout-full-name"
          name="fullName"
          label="Nome completo"
          placeholder="Ex.: Ana Souza"
          value={values.fullName}
          error={errors.fullName}
          autoComplete="name"
          onFieldChange={onFieldChange}
          onFieldBlur={onFieldBlur}
        />

        <TextField
          id="precheckout-email"
          name="email"
          label="E-mail"
          type="email"
          placeholder="voce@empresa.com"
          value={values.email}
          error={errors.email}
          autoComplete="email"
          onFieldChange={onFieldChange}
          onFieldBlur={onFieldBlur}
        />

        <TextField
          id="precheckout-whatsapp"
          name="whatsapp"
          label="Telefone"
          type="tel"
          placeholder="(11) 99999-9999"
          value={values.whatsapp}
          error={errors.whatsapp}
          autoComplete="tel"
          onFieldChange={onFieldChange}
          onFieldBlur={onFieldBlur}
        />

        <TextField
          id="precheckout-company-name"
          name="companyName"
          label="Nome da empresa"
          placeholder="Ex.: Agência Growth"
          value={values.companyName}
          error={errors.companyName}
          autoComplete="organization"
          onFieldChange={onFieldChange}
          onFieldBlur={onFieldBlur}
        />

        <div className={`precheckout-field ${errors.primaryObjective ? 'has-error' : ''}`}>
          <label htmlFor="precheckout-objective">Principal objetivo com a plataforma</label>
          <select
            id="precheckout-objective"
            name="primaryObjective"
            value={values.primaryObjective}
            onChange={(event) => onFieldChange('primaryObjective', event.target.value)}
            onBlur={() => onFieldBlur('primaryObjective')}
            aria-invalid={errors.primaryObjective ? 'true' : 'false'}
            aria-describedby={errors.primaryObjective ? 'precheckout-objective-error' : undefined}
            required
          >
            <option value="">Selecione uma opção</option>
            {PRE_CHECKOUT_OBJECTIVE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.primaryObjective ? (
            <small id="precheckout-objective-error">{errors.primaryObjective}</small>
          ) : null}
        </div>

        {submitError ? <p className="precheckout-submit-error">{submitError}</p> : null}

        <button className="precheckout-submit-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <span className="precheckout-submit-spinner" aria-hidden="true"></span> : null}
          <span>{isSubmitting ? 'Processando...' : 'Continuar para pagamento'}</span>
        </button>
      </form>
    </section>
  );
}
