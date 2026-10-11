// PD&I - Moteur de tagging industriel (PATCH 017A)
// Format standard : Diametre - Fluide - Numero - Classe   ex: 100-HC-001-CS300

export interface PdiTagPart {
  field: "NominalDiameter" | "Service" | "Number" | "Spec" | "Free";
  literal?: string;
  pad?: number;
}

export interface PdiTagFormat {
  name: string;
  separator: string;
  parts: PdiTagPart[];
  appliesTo: "line" | "equipment" | "instrument";
}

export interface PdiService {
  code: string;
  label: string;
  color: string;
}

export interface PdiSpec {
  code: string;
  material: string;
  pressureClass: string;
  minDn: number;
  maxDn: number;
}

export interface PdiProjectSetup {
  projectName: string;
  projectCode: string;
  client: string;
  unit: "mm" | "inch";
  standard: "ANSI" | "DIN";
  tagFormatName: string;
  formats: PdiTagFormat[];
  services: PdiService[];
  specs: PdiSpec[];
}

export const PDI_DEFAULT_SERVICES: PdiService[] = [
  { code: "HC", label: "Hydrocarbure Liquide (ASME B31.4 / API 5L)", color: "#F59E0B" },
  { code: "NG", label: "Gaz Naturel HP (ASME B31.8 / API 6D)", color: "#EAB308" },
  { code: "FG", label: "Gaz Combustible / Fuel Gas", color: "#FBBF24" },
  { code: "LPG", label: "GPL / Hydrocarbures Liquéfiés", color: "#D97706" },
  { code: "CR", label: "Pétrole Brut / Crude Oil", color: "#B45309" },
  { code: "FL", label: "Torche / Flare & Vent", color: "#EF4444" },
  { code: "WA", label: "Eau de Procédé / Rejet", color: "#0EA5E9" },
  { code: "ST", label: "Vapeur HP / MP (ASME B31.3)", color: "#F87171" },
  { code: "AI", label: "Air Instrument Séché", color: "#A5B4FC" },
  { code: "N2", label: "Azote d'Inertage", color: "#34D399" },
  { code: "CW", label: "Eau de Refroidissement", color: "#22D3EE" },
  { code: "FW", label: "Eau Incendie NFPA 13/24", color: "#DC2626" },
];

export const PDI_DEFAULT_SPECS: PdiSpec[] = [
  { code: "CS150", material: "Acier carbone ASTM A106 Gr.B", pressureClass: "Class 150", minDn: 15, maxDn: 1200 },
  { code: "CS300", material: "Acier carbone ASTM A106 Gr.B", pressureClass: "Class 300", minDn: 15, maxDn: 1200 },
  { code: "CS600", material: "Acier carbone API 5L Gr.B / X52", pressureClass: "Class 600", minDn: 15, maxDn: 1000 },
  { code: "CS900", material: "Acier haute limite API 5L X65 / X70", pressureClass: "Class 900", minDn: 50, maxDn: 900 },
  { code: "CS1500", material: "Acier haute pression ASTM A333 Gr.6 / API X70", pressureClass: "Class 1500", minDn: 50, maxDn: 600 },
  { code: "CS2500", material: "Acier forgé HP ASTM A105 / A350 LF2", pressureClass: "Class 2500", minDn: 50, maxDn: 400 },
  { code: "SS150", material: "Acier inoxydable 316L (ASTM A312 TP316L)", pressureClass: "Class 150", minDn: 15, maxDn: 600 },
  { code: "SS300", material: "Acier inoxydable 316L (ASTM A312 TP316L)", pressureClass: "Class 300", minDn: 15, maxDn: 600 },
  { code: "SS600", material: "Acier inoxydable Duplex UNS S31803", pressureClass: "Class 600", minDn: 15, maxDn: 400 },
  { code: "DIN-PN16", material: "Acier au carbone P235GH (EN 13480 / EN 1092-1)", pressureClass: "PN16", minDn: 15, maxDn: 600 },
  { code: "DIN-PN40", material: "Acier au carbone P265GH (EN 13480 / EN 1092-1)", pressureClass: "PN40", minDn: 15, maxDn: 600 },
  { code: "DIN-PN100", material: "Acier allié 16Mo3 (EN 13480 / EN 1092-1)", pressureClass: "PN100", minDn: 15, maxDn: 400 },
  { code: "GRE", material: "Composite GRE ISO 14692", pressureClass: "PN16", minDn: 50, maxDn: 600 },
  { code: "PE100", material: "Polyéthylène Haute Densité PE100 (ISO 4437 Gas)", pressureClass: "PN16", minDn: 20, maxDn: 400 },
];

export const PDI_TAG_FORMAT_STANDARD: PdiTagFormat = {
  name: "Tag_Ligne_Standard",
  separator: "-",
  appliesTo: "line",
  parts: [
    { field: "NominalDiameter" },
    { field: "Service" },
    { field: "Number", pad: 3 },
    { field: "Spec" },
  ],
};

export const PDI_DEFAULT_PROJECT_SETUP: PdiProjectSetup = {
  projectName: "Projet PD&I",
  projectCode: "PDI",
  client: "",
  unit: "mm",
  standard: "ANSI",
  tagFormatName: "Tag_Ligne_Standard",
  formats: [PDI_TAG_FORMAT_STANDARD],
  services: PDI_DEFAULT_SERVICES,
  specs: PDI_DEFAULT_SPECS,
};

export interface PdiTagFields {
  nominalDiameter?: number;
  service?: string;
  number?: number;
  spec?: string;
}

export function pdiBuildTag(fields: PdiTagFields, format: PdiTagFormat): string {
  const chunks: string[] = [];
  for (const part of format.parts) {
    if (part.field === "NominalDiameter") chunks.push(String(fields.nominalDiameter || ""));
    else if (part.field === "Service") chunks.push(fields.service || "");
    else if (part.field === "Number") chunks.push(String(fields.number || 0).padStart(part.pad || 3, "0"));
    else if (part.field === "Spec") chunks.push(fields.spec || "");
    else chunks.push(part.literal || "");
  }
  return chunks.filter(c => c.length > 0).join(format.separator);
}

export function pdiParseTag(tag: string, format: PdiTagFormat): PdiTagFields {
  const chunks = (tag || "").split(format.separator);
  const out: PdiTagFields = {};
  format.parts.forEach((part, i) => {
    const value = chunks[i];
    if (value === undefined) return;
    if (part.field === "NominalDiameter") out.nominalDiameter = Number(value) || undefined;
    else if (part.field === "Service") out.service = value;
    else if (part.field === "Number") out.number = Number(value) || undefined;
    else if (part.field === "Spec") out.spec = value;
  });
  return out;
}

export function pdiNextTagNumber(existing: string[], service: string, dn: number, format: PdiTagFormat): number {
  const used = new Set<number>();
  for (const tag of existing) {
    const f = pdiParseTag(tag, format);
    if (f.service === service && f.nominalDiameter === dn && f.number) used.add(f.number);
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

export function pdiValidateTag(tag: string, allTags: string[], format: PdiTagFormat): { ok: boolean; reason?: string } {
  if (!tag || tag.trim().length === 0) return { ok: false, reason: "Tag vide" };
  const fields = pdiParseTag(tag, format);
  if (!fields.nominalDiameter) return { ok: false, reason: "Diametre manquant" };
  if (!fields.service) return { ok: false, reason: "Fluide / service manquant" };
  if (!fields.number) return { ok: false, reason: "Numero manquant" };
  if (!fields.spec) return { ok: false, reason: "Spec manquante" };
  if (allTags.filter(t => t === tag).length > 1) return { ok: false, reason: "Tag en doublon" };
  return { ok: true };
}

export function pdiSpecAllowsDn(spec: PdiSpec | undefined, dn: number): boolean {
  if (!spec) return true;
  return dn >= spec.minDn && dn <= spec.maxDn;
}

export function pdiFindSpec(setup: PdiProjectSetup, code: string): PdiSpec | undefined {
  return setup.specs.find(s => s.code.toUpperCase() === (code || "").toUpperCase());
}

export function pdiFindService(setup: PdiProjectSetup, code: string): PdiService | undefined {
  return setup.services.find(s => s.code.toUpperCase() === (code || "").toUpperCase());
}

export function pdiActiveFormat(setup: PdiProjectSetup): PdiTagFormat {
  return setup.formats.find(f => f.name === setup.tagFormatName) || PDI_TAG_FORMAT_STANDARD;
}
