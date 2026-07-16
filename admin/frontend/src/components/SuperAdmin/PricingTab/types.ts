export type PriceMode = 'fixed' | 'consult';

export interface FoundersEdition {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  durationMonths: number;
  savingsText: string;
  limitedOfferText: string;
  ctaText: string;
  ctaUrl: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  featured: boolean;
  badge: string;
  priceMode: PriceMode;
  monthlyPrice: number | null;
  priceText: string;
  agents: number | null;
  users: number | null;
  contacts: number | null;
  contactsText: string;
  additionalAgentPrice: number | null;
  additionalUsersPerAgent: number | null;
  ctaText: string;
  ctaUrl: string;
  summaryItems: string[];
  features: string[];
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  priceText: string;
  enabled: boolean;
}

export interface PricingConfig {
  version: number;
  status: 'draft' | 'published';
  updatedAt: string;
  pageTitle: string;
  pageSubtitle: string;
  billingNote: string;
  founders: FoundersEdition;
  plans: PricingPlan[];
  addOnsTitle: string;
  addOnsSubtitle: string;
  addOns: AddOn[];
}
