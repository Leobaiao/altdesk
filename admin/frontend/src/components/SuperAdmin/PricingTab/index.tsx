import { useMemo, useRef, useState, useEffect } from 'react';
import { Field } from './components/Field';
import { PricingPreview } from './components/PricingPreview';
import { loadPricing, resetPricing, savePricing } from './services/pricingStorage';
import type { AddOn, PricingConfig, PricingPlan } from './types';
import './styles.css';

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function PricingTab() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [tab, setTab] = useState<'editor' | 'preview'>('editor');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPricing().then(setConfig);
  }, []);

  const updatedLabel = useMemo(() => {
    if (!config) return '';
    return new Date(config.updatedAt).toLocaleString('pt-BR');
  }, [config]);

  if (!config) {
    return <div style={{ padding: 20 }}>Carregando configurações...</div>;
  }

  const patch = (partial: Partial<PricingConfig>) => setConfig((current) => current ? ({ ...current, ...partial }) : current);

  const updatePlan = (index: number, partial: Partial<PricingPlan>) => {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        plans: current.plans.map((plan, planIndex) => (planIndex === index ? { ...plan, ...partial } : plan)),
      };
    });
  };

  const updateAddon = (index: number, partial: Partial<AddOn>) => {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        addOns: current.addOns.map((item, itemIndex) => (itemIndex === index ? { ...item, ...partial } : item)),
      };
    });
  };

  const persist = async (status: PricingConfig['status']) => {
    const next = { ...config, status, updatedAt: new Date().toISOString(), version: config.version + 1 };
    setConfig(next);
    try {
      await savePricing(next);
      setMessage(status === 'published' ? 'Configuração publicada com sucesso.' : 'Rascunho salvo com sucesso.');
    } catch (err) {
      setMessage('Erro ao salvar configuração.');
    }
    window.setTimeout(() => setMessage(''), 3500);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'altdesk-pricing-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as PricingConfig;
      if (!imported.plans || !imported.founders || !imported.addOns) throw new Error('Arquivo inválido');
      setConfig(imported);
      await savePricing(imported);
      setMessage('Configuração importada e salva.');
    } catch {
      setMessage('Não foi possível importar: JSON inválido.');
    }
  };

  return (
    <div className="pricing-app-shell">
      <header className="pricing-topbar">
        <div className="pricing-brand">
          <div className="pricing-brand__mark">P</div>
          <div>
            <strong>Pricing</strong>
            <span>Definition</span>
          </div>
        </div>
        <div className="pricing-topbar__actions">
          <span className={`pricing-status pricing-status--${config.status}`}>{config.status === 'published' ? 'Publicado' : 'Rascunho'}</span>
          <button className="pricing-button pricing-button--ghost" onClick={() => fileRef.current?.click()}>Importar JSON</button>
          <input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => void importJson(event.target.files?.[0])} />
          <button className="pricing-button pricing-button--ghost" onClick={exportJson}>Exportar JSON</button>
          <button className="pricing-button pricing-button--secondary" onClick={() => persist('draft')}>Salvar rascunho</button>
          <button className="pricing-button pricing-button--primary" onClick={() => persist('published')}>Publicar</button>
        </div>
      </header>

      <main className="pricing-workspace">
        <aside className="pricing-sidebar">
          <h1>Definição de preços</h1>
          <p>Configure os planos, a oferta Founders Edition e os itens adicionais.</p>
          <div className="pricing-tabs">
            <button className={tab === 'editor' ? 'active' : ''} onClick={() => setTab('editor')}>Editor</button>
            <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Pré-visualização</button>
          </div>
          <div className="pricing-sidebar__meta">
            <span>Versão {config.version}</span>
            <span>Atualizado em {updatedLabel}</span>
          </div>
          <button className="pricing-button pricing-button--danger-ghost" onClick={async () => {
              const fresh = await resetPricing();
              setConfig(fresh);
          }}>Restaurar padrão</button>
        </aside>

        <section className="pricing-content">
          {message && <div className="pricing-toast">{message}</div>}
          {tab === 'preview' ? (
            <PricingPreview config={config} />
          ) : (
            <div className="pricing-editor-stack">
              <section className="pricing-panel">
                <div className="pricing-panel__header"><div><h2>Cabeçalho da página</h2><p>Textos introdutórios da página pública de preços.</p></div></div>
                <div className="pricing-form-grid pricing-form-grid--2">
                  <Field label="Título da página"><input value={config.pageTitle} onChange={(e) => patch({ pageTitle: e.target.value })} /></Field>
                  <Field label="Observação de cobrança"><input value={config.billingNote} onChange={(e) => patch({ billingNote: e.target.value })} /></Field>
                </div>
                <Field label="Subtítulo"><textarea rows={2} value={config.pageSubtitle} onChange={(e) => patch({ pageSubtitle: e.target.value })} /></Field>
              </section>

              <section className="pricing-panel pricing-panel--founders">
                <div className="pricing-panel__header">
                  <div><h2>Founders Edition</h2><p>Banner especial de lançamento em toda a largura da página.</p></div>
                  <label className="pricing-switch"><input type="checkbox" checked={config.founders.enabled} onChange={(e) => patch({ founders: { ...config.founders, enabled: e.target.checked } })} /><span /></label>
                </div>
                <div className="pricing-form-grid pricing-form-grid--2">
                  <Field label="Chamada superior"><input value={config.founders.eyebrow} onChange={(e) => patch({ founders: { ...config.founders, eyebrow: e.target.value } })} /></Field>
                  <Field label="Título"><input value={config.founders.title} onChange={(e) => patch({ founders: { ...config.founders, title: e.target.value } })} /></Field>
                  <Field label="Subtítulo"><input value={config.founders.subtitle} onChange={(e) => patch({ founders: { ...config.founders, subtitle: e.target.value } })} /></Field>
                  <Field label="Preço"><input value={config.founders.price} onChange={(e) => patch({ founders: { ...config.founders, price: e.target.value } })} /></Field>
                  <Field label="Validade em meses"><input type="number" min="1" value={config.founders.durationMonths} onChange={(e) => patch({ founders: { ...config.founders, durationMonths: Number(e.target.value) } })} /></Field>
                  <Field label="Texto de economia"><input value={config.founders.savingsText} onChange={(e) => patch({ founders: { ...config.founders, savingsText: e.target.value } })} /></Field>
                  <Field label="Texto de oferta limitada"><input value={config.founders.limitedOfferText} onChange={(e) => patch({ founders: { ...config.founders, limitedOfferText: e.target.value } })} /></Field>
                  <Field label="Texto do botão"><input value={config.founders.ctaText} onChange={(e) => patch({ founders: { ...config.founders, ctaText: e.target.value } })} /></Field>
                  <Field label="URL do botão"><input value={config.founders.ctaUrl} onChange={(e) => patch({ founders: { ...config.founders, ctaUrl: e.target.value } })} /></Field>
                </div>
                <Field label="Texto comercial"><textarea rows={4} value={config.founders.description} onChange={(e) => patch({ founders: { ...config.founders, description: e.target.value } })} /></Field>
              </section>

              <section className="pricing-panel">
                <div className="pricing-panel__header"><div><h2>Planos</h2><p>STARTER, PROFESSIONAL e ENTERPRISE.</p></div></div>
                <div className="pricing-plan-editor-grid">
                  {config.plans.map((plan, index) => (
                    <article className="pricing-plan-editor" key={plan.id}>
                      <div className="pricing-plan-editor__title">
                        <input value={plan.name} onChange={(e) => updatePlan(index, { name: e.target.value })} />
                        <label><input type="checkbox" checked={plan.featured} onChange={(e) => updatePlan(index, { featured: e.target.checked })} /> Destaque</label>
                      </div>
                      <Field label="Descrição"><textarea rows={2} value={plan.description} onChange={(e) => updatePlan(index, { description: e.target.value })} /></Field>
                      <div className="pricing-form-grid pricing-form-grid--2">
                        <Field label="Tipo de preço"><select value={plan.priceMode} onChange={(e) => updatePlan(index, { priceMode: e.target.value as PricingPlan['priceMode'] })}><option value="fixed">Valor fixo</option><option value="consult">Sob consulta</option></select></Field>
                        <Field label="Valor mensal"><input type="number" min="0" disabled={plan.priceMode === 'consult'} value={plan.monthlyPrice ?? ''} onChange={(e) => updatePlan(index, { monthlyPrice: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                        <Field label="Agentes"><input type="number" min="0" value={plan.agents ?? ''} placeholder="Sob consulta" onChange={(e) => updatePlan(index, { agents: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                        <Field label="Usuários"><input type="number" min="0" value={plan.users ?? ''} placeholder="Sob consulta" onChange={(e) => updatePlan(index, { users: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                        <Field label="Contatos"><input type="number" min="0" value={plan.contacts ?? ''} placeholder="Sob consulta" onChange={(e) => updatePlan(index, { contacts: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                        <Field label="Agente adicional (R$)"><input type="number" min="0" value={plan.additionalAgentPrice ?? ''} placeholder="Sob consulta" onChange={(e) => updatePlan(index, { additionalAgentPrice: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                        <Field label="Usuários extras por agente"><input type="number" min="0" value={plan.additionalUsersPerAgent ?? ''} onChange={(e) => updatePlan(index, { additionalUsersPerAgent: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                        <Field label="Badge"><input value={plan.badge} onChange={(e) => updatePlan(index, { badge: e.target.value })} /></Field>
                        <Field label="Texto do botão"><input value={plan.ctaText} onChange={(e) => updatePlan(index, { ctaText: e.target.value })} /></Field>
                        <Field label="URL do botão"><input value={plan.ctaUrl} onChange={(e) => updatePlan(index, { ctaUrl: e.target.value })} /></Field>
                      </div>
                      <Field label="Itens do plano" hint="Um item por linha.">
                        <textarea rows={7} value={plan.features.join('\n')} onChange={(e) => updatePlan(index, { features: e.target.value.split('\n') })} />
                      </Field>
                    </article>
                  ))}
                </div>
              </section>

              <section className="pricing-panel">
                <div className="pricing-panel__header">
                  <div><h2>Itens sob consulta</h2><p>Integrações, implantação e futuros serviços adicionais.</p></div>
                  <button className="pricing-button pricing-button--secondary" onClick={() => patch({ addOns: [...config.addOns, { id: uid(), name: 'Novo item', description: '', priceText: 'Sob consulta', enabled: true }] })}>+ Adicionar item</button>
                </div>
                <div className="pricing-form-grid pricing-form-grid--2">
                  <Field label="Título da seção"><input value={config.addOnsTitle} onChange={(e) => patch({ addOnsTitle: e.target.value })} /></Field>
                  <Field label="Subtítulo"><input value={config.addOnsSubtitle} onChange={(e) => patch({ addOnsSubtitle: e.target.value })} /></Field>
                </div>
                <div className="pricing-addon-editor-list">
                  {config.addOns.map((item, index) => (
                    <article className="pricing-addon-editor" key={item.id}>
                      <label className="pricing-switch"><input type="checkbox" checked={item.enabled} onChange={(e) => updateAddon(index, { enabled: e.target.checked })} /><span /></label>
                      <input value={item.name} onChange={(e) => updateAddon(index, { name: e.target.value })} aria-label="Nome do item" />
                      <input value={item.description} onChange={(e) => updateAddon(index, { description: e.target.value })} aria-label="Descrição do item" />
                      <input value={item.priceText} onChange={(e) => updateAddon(index, { priceText: e.target.value })} aria-label="Preço do item" />
                      <button className="pricing-icon-button" onClick={() => patch({ addOns: config.addOns.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Excluir item">×</button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
