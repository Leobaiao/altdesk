import type { PricingConfig } from '../types';

const money = (value: number | null) =>
  value === null ? 'Sob consulta' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PricingPreview({ config }: { config: PricingConfig }) {
  return (
    <div className="pricing-preview-shell">
      <section className="pricing-hero">
        <p className="pricing-eyebrow">ALTDESK</p>
        <h1>{config.pageTitle}</h1>
        <p>{config.pageSubtitle}</p>
      </section>

      {config.founders.enabled && (
        <section className="pricing-founders-card">
          <div>
            <span className="pricing-founders-card__eyebrow">{config.founders.eyebrow}</span>
            <h2>{config.founders.title}</h2>
            <h3>{config.founders.subtitle}</h3>
            <p>{config.founders.description}</p>
            <div className="pricing-founders-card__meta">
              <strong>{config.founders.durationMonths} meses</strong>
              <strong>{config.founders.savingsText}</strong>
              <strong>{config.founders.limitedOfferText}</strong>
            </div>
          </div>
          <div className="pricing-founders-card__price">
            <span>Valor especial</span>
            <strong>{config.founders.price}</strong>
            <a href={config.founders.ctaUrl}>{config.founders.ctaText}</a>
          </div>
        </section>
      )}

      <section className="pricing-plans-grid">
        {config.plans.map((plan) => (
          <article key={plan.id} className={`pricing-plan-card ${plan.featured ? 'pricing-plan-card--featured' : ''}`}>
            {plan.badge && <span className="pricing-plan-card__badge">{plan.badge}</span>}
            <h2>{plan.name}</h2>
            <p className="pricing-plan-card__description">{plan.description}</p>
            <div className="pricing-plan-card__price">
              <strong>{plan.priceMode === 'consult' ? plan.priceText : money(plan.monthlyPrice)}</strong>
              {plan.priceMode === 'fixed' && <span>/mês</span>}
            </div>
            <ul>
              {plan.features.filter(Boolean).map((feature, index) => (
                <li key={`${plan.id}-${index}`}>✓ {feature}</li>
              ))}
            </ul>
            <a className="pricing-plan-card__cta" href={plan.ctaUrl}>{plan.ctaText}</a>
          </article>
        ))}
      </section>

      <section className="pricing-addons-section">
        <h2>{config.addOnsTitle}</h2>
        <p>{config.addOnsSubtitle}</p>
        <div className="pricing-addons-grid">
          {config.addOns.filter((item) => item.enabled).map((item) => (
            <article className="pricing-addon-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <strong>{item.priceText}</strong>
            </article>
          ))}
        </div>
      </section>

      <p className="pricing-billing-note">{config.billingNote}</p>
    </div>
  );
}
