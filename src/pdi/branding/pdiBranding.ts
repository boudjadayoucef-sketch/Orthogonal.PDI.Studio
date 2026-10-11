// PATCH 017J - Identite du produit et des cartouches.
// PD&I est un produit generique a standards internationaux : aucune marque
// client ne doit etre ecrite en dur dans le code (regle R15).

export const PDI_BRANDING_KEY = "pdi.branding.v1";
export const PDI_BRANDING_FALLBACK_COMPANY = "Societe non renseignee";

export type PdiBranding = {
  companyName: string;
  companyLogo: string;
  projectOwner: string;
  approverLabel: string;
  documentPrefix: string;
  standardsNote: string;
};

export const PDI_DEFAULT_BRANDING: PdiBranding = {
  companyName: "",
  companyLogo: "",
  projectOwner: "",
  approverLabel: "Approuve par",
  documentPrefix: "PDI",
  standardsNote: "ASME B31.3 / B31.8 - EN 13480 - ISO 6708",
};

export function pdiLoadBranding(): PdiBranding {
  try {
    const raw = localStorage.getItem(PDI_BRANDING_KEY);
    if (!raw) return { ...PDI_DEFAULT_BRANDING };
    const parsed = JSON.parse(raw) as Partial<PdiBranding>;
    return { ...PDI_DEFAULT_BRANDING, ...parsed };
  } catch {
    return { ...PDI_DEFAULT_BRANDING };
  }
}

export function pdiSaveBranding(next: Partial<PdiBranding>): PdiBranding {
  const merged = { ...pdiLoadBranding(), ...next };
  try {
    localStorage.setItem(PDI_BRANDING_KEY, JSON.stringify(merged));
  } catch {
    // Stockage indisponible : l identite reste celle de la session.
  }
  return merged;
}

// Nom a imprimer dans un cartouche ISO 7200. Jamais de chaine vide :
// un cartouche sans proprietaire est non conforme.
export function pdiCompanyName(): string {
  const name = pdiLoadBranding().companyName.trim();
  return name || PDI_BRANDING_FALLBACK_COMPANY;
}

export function pdiStandardsNote(): string {
  const note = pdiLoadBranding().standardsNote.trim();
  return note || PDI_DEFAULT_BRANDING.standardsNote;
}

export function pdiDocumentPrefix(): string {
  const p = pdiLoadBranding().documentPrefix.trim();
  return p || PDI_DEFAULT_BRANDING.documentPrefix;
}
