import { PdiAccountType, PdiSubscriptionPlan } from "../../lib/firebase";

export type PdiPaymentProvider = "slickpay_baridimob" | "paddle";

export interface PdiPlanPricing {
  plan: PdiAccountType;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: "DZD" | "EUR" | "USD";
  currencySymbol: string;
  features: string[];
  popular?: boolean;
}

export interface PdiPaymentTransaction {
  id: string;
  userId?: string;
  userEmail: string;
  userName: string;
  company?: string;
  country: string;
  countryCode: string;
  city?: string;
  plan: PdiAccountType;
  billingCycle: PdiSubscriptionPlan;
  amount: number;
  currency: "DZD" | "EUR" | "USD";
  provider: PdiPaymentProvider;
  status: "pending" | "completed" | "failed" | "refunded";
  createdAt: string;
  updatedAt?: string;
  // Provider specific details
  slickPayDetails?: {
    invoiceId: string;
    baridiMobRip: string;
    slickPayUrl: string;
    transferReference?: string;
    verifiedByAdmin?: boolean;
  };
  paddleDetails?: {
    checkoutId: string;
    paddleOrderId?: string;
    customerEmail?: string;
    subscriptionId?: string;
  };
}

export const PDI_PRICING_DZD: Record<PdiAccountType, PdiPlanPricing> = {
  basic: {
    plan: "basic",
    name: "PD&I Basic",
    tagline: "Pour ingénieurs indépendants et techniciens débutants",
    monthlyPrice: 2500,
    yearlyPrice: 24000,
    currency: "DZD",
    currencySymbol: "DZD",
    features: [
      "1 projet actif simultané",
      "Éditeur isométrique 2D / 3D standard",
      "Export PDF haute précision A4/A3",
      "Support standard par email",
      "Sauvegarde locale automatique"
    ]
  },
  pro: {
    plan: "pro",
    name: "PD&I Pro",
    tagline: "La solution complète pour concepteurs tuyauterie & piping",
    monthlyPrice: 4900,
    yearlyPrice: 49000,
    currency: "DZD",
    currencySymbol: "DZD",
    popular: true,
    features: [
      "Projets & plans illimités",
      "Génération automatique d'isométries",
      "Module Vision & Reconnaissance photo/croquis",
      "Imports DXF / CAO / PDF avancés",
      "Nomenclature complète & MTO exportable Excel",
      "Support prioritaire sous 12h"
    ]
  },
  team: {
    plan: "team",
    name: "PD&I Team",
    tagline: "Pour bureaux d'études et équipes industrielles (5 licences)",
    monthlyPrice: 12500,
    yearlyPrice: 120000,
    currency: "DZD",
    currencySymbol: "DZD",
    features: [
      "Jusqu'à 5 concepteurs inclus",
      "Partage d'onglets et de projets en équipe",
      "Validation centralisée & révision des plans",
      "Export DXF multi-calques et cartouche personnalisé",
      "Formation en ligne & support dédié WhatsApp"
    ]
  },
  enterprise: {
    plan: "enterprise",
    name: "PD&I Enterprise",
    tagline: "Grands comptes industriels, pétrochimie & gaz",
    monthlyPrice: 35000,
    yearlyPrice: 350000,
    currency: "DZD",
    currencySymbol: "DZD",
    features: [
      "Licences illimitées sur site ou cloud privé",
      "Intégration Sonatrach / normes ASME B31.3",
      "API & Passerelle d'interconnexion interne",
      "Support technique VIP 24/7 & ingénieur référent",
      "Contrat de maintenance et formation sur site"
    ]
  }
};

export const PDI_PRICING_INTERNATIONAL: Record<PdiAccountType, PdiPlanPricing> = {
  basic: {
    plan: "basic",
    name: "PD&I Basic",
    tagline: "Single seat for piping drafters & freelance engineers",
    monthlyPrice: 25,
    yearlyPrice: 240,
    currency: "EUR",
    currencySymbol: "€",
    features: [
      "1 active isometric project",
      "Full 2D/3D piping editor",
      "High-res PDF vector export (A4-A1)",
      "Standard email technical support",
      "Automatic offline persistence"
    ]
  },
  pro: {
    plan: "pro",
    name: "PD&I Pro",
    tagline: "Complete pipeline design suite with Vision & CAD engine",
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: "EUR",
    currencySymbol: "€",
    popular: true,
    features: [
      "Unlimited projects & runs",
      "PD&I Vision photo & sketch to ISO",
      "DXF / CAD / PDF multi-layer importer",
      "Automated MTO & material takeoff export",
      "Priority 24/7 technical support"
    ]
  },
  team: {
    plan: "team",
    name: "PD&I Team",
    tagline: "Engineering consulting offices & EPC contractor teams (5 seats)",
    monthlyPrice: 125,
    yearlyPrice: 1200,
    currency: "EUR",
    currencySymbol: "€",
    features: [
      "5 user seats included",
      "Multi-user isometric collaboration",
      "Custom company borders & title blocks",
      "Shared piping catalogs & specifications",
      "Dedicated onboarding session"
    ]
  },
  enterprise: {
    plan: "enterprise",
    name: "PD&I Enterprise",
    tagline: "Global EPC contractors, Oil & Gas operators",
    monthlyPrice: 350,
    yearlyPrice: 3500,
    currency: "EUR",
    currencySymbol: "€",
    features: [
      "Custom seats deployment",
      "ASME / DIN / ISO standards compliance engine",
      "API access & enterprise ERP integration",
      "SLA 99.9% guarantee & dedicated account manager",
      "Custom piping components library development"
    ]
  }
};

/**
 * Determine payment gateway and pricing configuration based on country code
 */
export function getPaymentConfigForCountry(countryCode: string): {
  provider: PdiPaymentProvider;
  currency: "DZD" | "EUR" | "USD";
  currencySymbol: string;
  pricingTable: Record<PdiAccountType, PdiPlanPricing>;
} {
  const code = (countryCode || "DZ").toUpperCase().trim();
  if (code === "DZ" || code === "ALGERIA" || code === "ALGÉRIE") {
    return {
      provider: "slickpay_baridimob",
      currency: "DZD",
      currencySymbol: "DZD",
      pricingTable: PDI_PRICING_DZD
    };
  }

  return {
    provider: "paddle",
    currency: "EUR",
    currencySymbol: "€",
    pricingTable: PDI_PRICING_INTERNATIONAL
  };
}

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(provider: PdiPaymentProvider): string {
  const prefix = provider === "slickpay_baridimob" ? "TX_SLICKPAY" : "TX_PADDLE";
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${stamp}_${rand}`;
}
