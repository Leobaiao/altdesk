import { defaultPricing } from '../data/defaultPricing';
import type { PricingConfig } from '../types';
import { api } from '../../../../lib/api';

export async function loadPricing(): Promise<PricingConfig> {
  try {
    const res = await api.get('/api/admin/pricing-config');
    if (res.data && Object.keys(res.data).length > 0) {
      return res.data as PricingConfig;
    }
  } catch (err) {
    console.error('Failed to load pricing config from API', err);
  }
  return structuredClone(defaultPricing);
}

export async function savePricing(config: PricingConfig): Promise<void> {
  try {
    await api.post('/api/admin/pricing-config', config);
  } catch (err) {
    console.error('Failed to save pricing config to API', err);
    throw err;
  }
}

export async function resetPricing(): Promise<PricingConfig> {
  const fresh = structuredClone(defaultPricing);
  await savePricing(fresh);
  return fresh;
}
