import type { ReactNode } from 'react';

type OfferHighlight = {
  label: string;
  value: string;
};

type OfferTrustCopy = {
  icon: ReactNode;
  text: string;
};

type Props = {
  title: string;
  subtitle: string;
  planName: string;
  trialLabel: string;
  recurringLabel: string;
  benefits: string[];
  highlights: OfferHighlight[];
  trustItems: OfferTrustCopy[];
};

export default function PreCheckoutOfferPanel({
  title,
  subtitle,
  planName,
  trialLabel,
  recurringLabel,
  benefits,
  highlights,
  trustItems
}: Props) {
  return (
    <section className="precheckout-offer-panel" aria-labelledby="precheckout-offer-title">
      <div className="precheckout-pill">Plano recomendado</div>
      <h1 id="precheckout-offer-title">{title}</h1>
      <p className="precheckout-offer-subtitle">{subtitle}</p>

      <div className="precheckout-plan-card">
        <div className="precheckout-plan-head">
          <strong>{planName}</strong>
          <span>{trialLabel}</span>
        </div>
        <div className="precheckout-plan-price">{recurringLabel}</div>
      </div>

      <ul className="precheckout-benefits" aria-label="Beneficios do plano">
        {benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <div className="precheckout-highlight-grid">
        {highlights.map((item) => (
          <article key={item.label} className="precheckout-highlight-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="precheckout-trust-list">
        {trustItems.map((item) => (
          <p key={item.text}>
            <span aria-hidden="true">{item.icon}</span>
            {item.text}
          </p>
        ))}
      </div>
    </section>
  );
}

