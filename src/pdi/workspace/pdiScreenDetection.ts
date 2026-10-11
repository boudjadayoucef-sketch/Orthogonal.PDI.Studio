/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * 
 * MODULE : DÉTECTION MULTI-ÉCRAN ET GESTION DES MONITEURS (API WINDOW MANAGEMENT)
 */

export interface PdiScreenInfo {
  id: string;
  label: string;
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelRatio: number;
  isPrimary: boolean;
  isInternal?: boolean;
  left: number;
  top: number;
  availLeft?: number;
  availTop?: number;
}

export interface PdiScreenDetectionResult {
  supported: boolean;
  isExtended: boolean;
  screenCount: number;
  primaryScreen: PdiScreenInfo;
  allScreens: PdiScreenInfo[];
  apiType: "window_management" | "screen_extended" | "standard_fallback";
  permissionState: "granted" | "prompt" | "denied" | "unsupported";
}

/**
 * Détecte les écrans physiques et logiques disponibles dans le navigateur.
 * Utilise l'API Window Management (`window.getScreenDetails()`) si supportée,
 * ou `window.screen.isExtended`, avec un fallback résilient sur `window.screen`.
 */
export async function detectPdiScreens(): Promise<PdiScreenDetectionResult> {
  const defaultPrimary: PdiScreenInfo = {
    id: "screen-0",
    label: "Écran Principal (Moniteur 1)",
    width: typeof window !== "undefined" ? window.screen.width : 1920,
    height: typeof window !== "undefined" ? window.screen.height : 1080,
    availWidth: typeof window !== "undefined" ? window.screen.availWidth : 1920,
    availHeight: typeof window !== "undefined" ? window.screen.availHeight : 1040,
    colorDepth: typeof window !== "undefined" ? window.screen.colorDepth : 24,
    pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    isPrimary: true,
    left: 0,
    top: 0,
    availLeft: 0,
    availTop: 0,
  };

  if (typeof window === "undefined") {
    return {
      supported: false,
      isExtended: false,
      screenCount: 1,
      primaryScreen: defaultPrimary,
      allScreens: [defaultPrimary],
      apiType: "standard_fallback",
      permissionState: "unsupported",
    };
  }

  // 1. Vérification de l'API Window Management moderne (Chrome 100+, Edge)
  const nav = navigator as any;
  const win = window as any;

  if (typeof win.getScreenDetails === "function") {
    try {
      // Vérifier permission
      let permStatus: PermissionStatus | null = null;
      if (nav.permissions && typeof nav.permissions.query === "function") {
        try {
          permStatus = await nav.permissions.query({ name: "window-management" as any });
        } catch {
          // Certaines versions utilisent "window-placement"
          try {
            permStatus = await nav.permissions.query({ name: "window-placement" as any });
          } catch {}
        }
      }

      const screenDetails = await win.getScreenDetails();
      if (screenDetails && screenDetails.screens && Array.isArray(screenDetails.screens)) {
        const screens: PdiScreenInfo[] = screenDetails.screens.map((s: any, idx: number) => ({
          id: `screen-${idx}`,
          label: s.label || `Moniteur ${idx + 1} (${s.width}×${s.height})`,
          width: s.width || window.screen.width,
          height: s.height || window.screen.height,
          availWidth: s.availWidth || window.screen.availWidth,
          availHeight: s.availHeight || window.screen.availHeight,
          colorDepth: s.colorDepth || 24,
          pixelRatio: s.devicePixelRatio || window.devicePixelRatio || 1,
          isPrimary: Boolean(s.isPrimary),
          isInternal: s.isInternal,
          left: s.left ?? 0,
          top: s.top ?? 0,
          availLeft: s.availLeft ?? 0,
          availTop: s.availTop ?? 0,
        }));

        const primary = screens.find((s) => s.isPrimary) || screens[0] || defaultPrimary;

        return {
          supported: true,
          isExtended: Boolean(screenDetails.isExtended ?? screens.length > 1),
          screenCount: screens.length,
          primaryScreen: primary,
          allScreens: screens,
          apiType: "window_management",
          permissionState: "granted",
        };
      }
    } catch {
      // Permission refusée ou erreur d'exécution
    }
  }

  // 2. Détection par propriété `isExtended` (disponible sur plusieurs navigateurs)
  const isExtended = Boolean((window.screen as any)?.isExtended);

  const estimatedScreens: PdiScreenInfo[] = [defaultPrimary];
  if (isExtended) {
    estimatedScreens.push({
      id: "screen-1",
      label: "Écran Secondaire Détecté (Moniteur 2)",
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
      isPrimary: false,
      left: window.screen.width, // placement par défaut à droite
      top: 0,
      availLeft: window.screen.width,
      availTop: 0,
    });
  }

  return {
    supported: isExtended,
    isExtended: isExtended,
    screenCount: isExtended ? 2 : 1,
    primaryScreen: defaultPrimary,
    allScreens: estimatedScreens,
    apiType: isExtended ? "screen_extended" : "standard_fallback",
    permissionState: isExtended ? "granted" : "prompt",
  };
}

/**
 * Calcul des coordonnées optimales pour positionner la fenêtre secondaire sur l'écran 2.
 */
export function calculateSecondaryWindowBounds(screenDetails?: PdiScreenDetectionResult): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  if (typeof window === "undefined") {
    return { left: 100, top: 100, width: 1200, height: 800 };
  }

  const primaryWidth = window.screen.availWidth || 1920;
  const primaryHeight = window.screen.availHeight || 1080;

  // Si un deuxième écran est répertorié via l'API Window Management
  if (screenDetails?.allScreens && screenDetails.allScreens.length > 1) {
    const screen2 = screenDetails.allScreens.find((s) => !s.isPrimary) || screenDetails.allScreens[1];
    
    // On utilise les coordonnées physiques et disponibles réelles de l'écran secondaire
    // fournies par l'API Window Management, gérant toutes les configurations physiques :
    // - Écran secondaire à gauche (coordonnées négatives)
    // - Écran secondaire au-dessus ou au-dessous (disposition verticale)
    const left = screen2.availLeft !== undefined ? screen2.availLeft : (screen2.left !== undefined ? screen2.left : primaryWidth + 20);
    const top = screen2.availTop !== undefined ? screen2.availTop : (screen2.top !== undefined ? screen2.top : 0);

    return {
      left: left,
      top: top,
      width: Math.max(900, screen2.availWidth || 1200),
      height: Math.max(650, screen2.availHeight || 800),
    };
  }

  // Sinon, positionnement intelligent en fenêtre séparée
  return {
    left: Math.min(window.screenX + 80, window.screen.width - 1000),
    top: Math.max(0, window.screenY + 40),
    width: Math.min(1360, Math.floor(primaryWidth * 0.85)),
    height: Math.min(900, Math.floor(primaryHeight * 0.9)),
  };
}
