/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * UNIVERSAL UNIT ENGINE (019U)
 * Metric (SI) ↔ US Customary / Imperial Conversion & Architectural Formatting
 * Compliant with ISO 80000-1, NIST SP 811 & IEEE/ASTM SI 10
 */

export type UnitSystem = "metric" | "imperial";

export type LengthUnit = "m" | "mm" | "ft" | "in" | "ft-in";
export type PressureUnit = "bar" | "psi" | "kpa" | "mpa";
export type MassUnit = "kg" | "lbs";
export type TemperatureUnit = "C" | "F";

export interface UnitConfig {
  system: UnitSystem;
  lengthDisplay: "m" | "mm" | "ft-in" | "in";
  pressureDisplay: "bar" | "psi";
  massDisplay: "kg" | "lbs";
  fractionPrecision: 16 | 32 | 64; // ex: 1/16", 1/32", 1/64"
}

export const DEFAULT_METRIC_CONFIG: UnitConfig = {
  system: "metric",
  lengthDisplay: "m",
  pressureDisplay: "bar",
  massDisplay: "kg",
  fractionPrecision: 16,
};

export const DEFAULT_IMPERIAL_CONFIG: UnitConfig = {
  system: "imperial",
  lengthDisplay: "ft-in",
  pressureDisplay: "psi",
  massDisplay: "lbs",
  fractionPrecision: 16,
};

// ==========================================
// Constantes de conversion exactes (NIST SP 811)
// ==========================================
const MM_PER_INCH = 25.4;
const METERS_PER_FOOT = 0.3048;
const INCHES_PER_FOOT = 12;
const PSI_PER_BAR = 14.503773773;
const LBS_PER_KG = 2.20462262185;

/**
 * Convertit une longueur (en mètres de base) vers l'unité demandée
 */
export function convertLengthFromMeters(meters: number, target: LengthUnit): number {
  switch (target) {
    case "m":
      return meters;
    case "mm":
      return meters * 1000;
    case "ft":
      return meters / METERS_PER_FOOT;
    case "in":
      return (meters * 1000) / MM_PER_INCH;
    case "ft-in":
      return meters / METERS_PER_FOOT;
  }
}

/**
 * Convertit une valeur de longueur vers les mètres (unité interne du moteur)
 */
export function convertLengthToMeters(value: number, source: LengthUnit): number {
  switch (source) {
    case "m":
      return value;
    case "mm":
      return value / 1000;
    case "ft":
      return value * METERS_PER_FOOT;
    case "in":
      return (value * MM_PER_INCH) / 1000;
    case "ft-in":
      return value * METERS_PER_FOOT;
  }
}

/**
 * Formate un nombre décimal de pouces en fraction architecturale ASME
 * Ex: 3.625 -> "3 5/8"
 */
export function formatInchesFractional(
  totalInches: number,
  precision: 16 | 32 | 64 = 16
): string {
  const wholeInches = Math.floor(totalInches);
  const remainder = totalInches - wholeInches;
  const numUnits = Math.round(remainder * precision);

  if (numUnits === 0) {
    return `${wholeInches}`;
  }
  if (numUnits === precision) {
    return `${wholeInches + 1}`;
  }

  // Réduire la fraction (PGCD)
  let num = numUnits;
  let den: number = precision;
  while (num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }

  if (wholeInches === 0) {
    return `${num}/${den}`;
  }
  return `${wholeInches} ${num}/${den}`;
}

/**
 * Formate une longueur (reçue en mètres) selon le système d'unités actif
 * Métrique: "12.45 m" ou "450 mm"
 * Impérial: "40'-10 1/4\"" ou "490.25\""
 */
export function formatLength(
  meters: number,
  system: UnitSystem = "metric",
  options?: {
    forceMm?: boolean;
    forceInchesOnly?: boolean;
    precision?: 16 | 32 | 64;
    decimals?: number;
  }
): string {
  if (meters === undefined || meters === null || isNaN(meters)) return "0";

  if (system === "metric") {
    if (options?.forceMm || Math.abs(meters) < 0.001) {
      const mm = Math.round(meters * 1000);
      return `${mm} mm`;
    }
    const dec = options?.decimals ?? 2;
    return `${meters.toFixed(dec)} m`;
  }

  // Système Impérial US Customary
  const totalInches = (meters * 1000) / MM_PER_INCH;

  if (options?.forceInchesOnly) {
    const frac = formatInchesFractional(totalInches, options.precision || 16);
    return `${frac}"`;
  }

  const sign = totalInches < 0 ? "-" : "";
  const absInches = Math.abs(totalInches);
  const feet = Math.floor(absInches / INCHES_PER_FOOT);
  const remainingInches = absInches % INCHES_PER_FOOT;

  const fracInches = formatInchesFractional(remainingInches, options?.precision || 16);

  if (feet === 0) {
    return `${sign}0'-${fracInches}"`;
  }
  return `${sign}${feet}'-${fracInches}"`;
}

/**
 * Formate une pression (reçue en bar) selon le système d'unités
 * Métrique: "16.0 bar"
 * Impérial: "232 psi"
 */
export function formatPressure(
  bar: number,
  system: UnitSystem = "metric",
  decimals?: number
): string {
  if (bar === undefined || bar === null || isNaN(bar)) return "0 bar";

  if (system === "metric") {
    const d = decimals !== undefined ? decimals : 1;
    return `${bar.toFixed(d)} bar`;
  }

  const psi = bar * PSI_PER_BAR;
  const d = decimals !== undefined ? decimals : 0;
  return `${psi.toFixed(d)} psi`;
}

/**
 * Formate une masse / poids (reçue en kg) selon le système d'unités
 * Métrique: "145.2 kg"
 * Impérial: "320.1 lbs"
 */
export function formatMass(
  kg: number,
  system: UnitSystem = "metric",
  decimals: number = 1
): string {
  if (kg === undefined || kg === null || isNaN(kg)) return "0 kg";

  if (system === "metric") {
    return `${kg.toFixed(decimals)} kg`;
  }

  const lbs = kg * LBS_PER_KG;
  return `${lbs.toFixed(decimals)} lbs`;
}

/**
 * Formate une température (reçue en °C)
 */
export function formatTemperature(celsius: number, system: UnitSystem = "metric"): string {
  if (celsius === undefined || celsius === null || isNaN(celsius)) return "0 °C";
  if (system === "metric") {
    return `${Math.round(celsius)} °C`;
  }
  const fahrenheit = (celsius * 9) / 5 + 32;
  return `${Math.round(fahrenheit)} °F`;
}

/**
 * Helper de conversion inverse de pression : psi vers bar
 */
export function psiToBar(psi: number): number {
  return psi / PSI_PER_BAR;
}

/**
 * Helper de conversion inverse de masse : lbs vers kg
 */
export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

/**
 * Helper de conversion de pieds-pouces vers mètres
 * Parse des chaînes comme: "12'-6\"", "12' 6 1/2\"", "150\"", "3.5m", "3500mm"
 */
export function parseLengthInput(input: string): { meters: number; valid: boolean } {
  if (!input || !input.trim()) return { meters: 0, valid: false };
  const raw = input.trim().toLowerCase();

  // Test mètres
  if (raw.endsWith("m") && !raw.endsWith("mm")) {
    const val = parseFloat(raw.replace("m", ""));
    return isNaN(val) ? { meters: 0, valid: false } : { meters: val, valid: true };
  }

  // Test millimètres
  if (raw.endsWith("mm")) {
    const val = parseFloat(raw.replace("mm", ""));
    return isNaN(val) ? { meters: 0, valid: false } : { meters: val / 1000, valid: true };
  }

  // Test pieds-pouces type 10'-6" ou 10' 6 1/2" ou 10'
  const ftInRegex = /^(\d+)'(?:-?\s*(\d+(?:\s+\d+\/\d+|\.\d+)?)"?)?$/;
  const match = raw.match(ftInRegex);
  if (match) {
    const feet = parseInt(match[1], 10) || 0;
    let inches = 0;
    if (match[2]) {
      const inchPart = match[2].trim();
      if (inchPart.includes("/")) {
        const parts = inchPart.split(" ");
        if (parts.length === 2) {
          const whole = parseFloat(parts[0]);
          const fracParts = parts[1].split("/");
          const frac = parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
          inches = whole + frac;
        } else {
          const fracParts = parts[0].split("/");
          inches = parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
        }
      } else {
        inches = parseFloat(inchPart);
      }
    }
    const totalMeters = (feet * 12 + inches) * (MM_PER_INCH / 1000);
    return { meters: totalMeters, valid: true };
  }

  // Test pouces directs ex: 120" ou 120in (sans pieds)
  if ((raw.endsWith("\"") || raw.endsWith("in")) && !raw.includes("'")) {
    const numStr = raw.replace(/["in]/g, "").trim();
    const val = parseFloat(numStr);
    return isNaN(val) ? { meters: 0, valid: false } : { meters: (val * MM_PER_INCH) / 1000, valid: true };
  }

  // Nombre pur : par défaut considéré comme mètres
  const pureNum = parseFloat(raw);
  if (!isNaN(pureNum)) {
    return { meters: pureNum, valid: true };
  }

  return { meters: 0, valid: false };
}

/**
 * Helper universel pour analyser une entrée utilisateur avec unité automatique
 */
export function parsePdiValue(
  input: string,
  unitType: "length" | "pressure" | "mass" = "length",
  _activeSystem: UnitSystem = "metric"
): { valueInMeters: number; valid: boolean } {
  if (unitType === "length") {
    const res = parseLengthInput(input);
    return { valueInMeters: res.meters, valid: res.valid };
  }
  const val = parseFloat(input);
  return { valueInMeters: isNaN(val) ? 0 : val, valid: !isNaN(val) };
}
