/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-TO-ISO ENGINE — STEP 1: LOCAL STORAGE & LEARNING PROFILE MANAGER
 * 
 * 0 API Payante / 100% Client-Side Local Storage (IndexedDB + Canvas Compression)
 */

export interface SketchLearningProfile {
  version: string;
  updatedAt: string;
  author?: string;
  /**
   * Dictionnaire d'abréviations calligraphiques et de chantier
   * Ex: "VPT" -> "vanne_passage_total", "CL300" -> "PN50", "COUD90" -> "elbow_90"
   */
  abbreviations: Record<string, string>;
  /**
   * Correspondances de symboles personnalisés
   */
  symbolAliases: Record<string, string>;
  /**
   * Préférences de dessin & tolérances
   */
  preferences: {
    defaultFormat: "A4_landscape" | "A4_portrait" | "A3_landscape" | "A3_portrait";
    defaultUnit: "mm" | "inch";
    snapAngleToleranceDeg: number; // ex: 7.5° d'aimantation sur 30°/90°/150°
    autoOrthogonalize: boolean;
    contrastThreshold: number; // 0 à 255 pour le filtre d'encre N&B
    defaultLineDN: number;
    defaultPN: string;
    defaultMaterial: string;
  };
}

export interface SketchSessionRecord {
  id: string;
  name: string;
  format: "A4_landscape" | "A4_portrait" | "A3_landscape" | "A3_portrait";
  createdAt: string;
  updatedAt: string;
  imageBlob?: Blob;
  imageDataUrl?: string;
  imageDimensions: { width: number; height: number };
  calibrationScale: number; // pixels par mm (1 si non calibré)
  isCalibrated: boolean;
  vectorDraftJson?: string; // Sauvegarde intermédiaire des nœuds/segments tracés
}

const DB_NAME = "pdi_sketch_db_v1";
const STORE_SESSIONS = "sketch_sessions";
const STORE_IMAGES = "sketch_images";
const LOCAL_STORAGE_PROFILE_KEY = "pdi_sketch_learning_profile_v1";

export const DEFAULT_SKETCH_PROFILE: SketchLearningProfile = {
  version: "1.0",
  updatedAt: new Date().toISOString(),
  author: "Défaut Bureau d'Études",
  abbreviations: {
    "VPT": "vanne_passage_total",
    "V.P.T": "vanne_passage_total",
    "VP": "vanne_papillon",
    "V.P": "vanne_papillon",
    "VG": "vanne_globe",
    "CLAP": "clapet_anti_retour",
    "BRIDE": "flange_wn",
    "WN": "flange_wn",
    "SO": "flange_so",
    "RED": "reduction_concentrique",
    "TE": "tee_egal",
    "TÉ": "tee_egal",
    "PURGE": "purge",
    "EVENT": "event",
    "ÉVENT": "event",
    "C90": "elbow_90",
    "C45": "elbow_45",
    "CL150": "PN20",
    "CL300": "PN50",
    "CL600": "PN100",
    "X52": "Acier API 5L X52",
    "GRB": "Acier API 5L Gr. B",
    "316L": "Inox 316L"
  },
  symbolAliases: {
    "valve": "vanne_passage_total",
    "check": "clapet_anti_retour",
    "flange": "flange_wn",
    "reducer": "reduction_concentrique",
    "tee": "tee_egal",
    "elbow": "elbow_90"
  },
  preferences: {
    defaultFormat: "A4_landscape",
    defaultUnit: "mm",
    snapAngleToleranceDeg: 7.5,
    autoOrthogonalize: true,
    contrastThreshold: 128,
    defaultLineDN: 150,
    defaultPN: "Class 300",
    defaultMaterial: "Acier API 5L Gr. B"
  }
};

/**
 * Initialise ou récupère la base IndexedDB locale
 */
function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB non supporté par ce navigateur."));
    }

    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Compresse et redimensionne une image côté client pour respecter le quota (Max 2500px / ~5Mo)
 */
export async function compressAndScaleSketchImage(
  file: File | Blob,
  maxDimension = 2500,
  quality = 0.88
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Impossible de créer le contexte 2D Canvas."));
        }

        // Fond blanc pour éviter la transparence PNG sur les scans
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error("Échec de la compression de l'image."));
            }
            resolve({
              blob,
              dataUrl,
              width,
              height,
              originalSize,
              compressedSize: blob.size
            });
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => reject(new Error("Format d'image non valide ou corrompu."));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Impossible de lire le fichier sélectionné."));
    reader.readAsDataURL(file);
  });
}

/**
 * Enregistre une session de croquis dans IndexedDB
 */
export async function saveSketchSession(session: SketchSessionRecord, imageBlob?: Blob): Promise<void> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction([STORE_SESSIONS, STORE_IMAGES], "readwrite");

    const sessionStore = tx.objectStore(STORE_SESSIONS);
    const imageStore = tx.objectStore(STORE_IMAGES);

    // On stocke les métadonnées de la session sans l'énorme blob pour garder la session légère
    const metaRecord: SketchSessionRecord = {
      ...session,
      imageDataUrl: undefined,
      imageBlob: undefined,
      updatedAt: new Date().toISOString()
    };

    sessionStore.put(metaRecord);

    if (imageBlob) {
      imageStore.put({ id: session.id, blob: imageBlob, updatedAt: new Date().toISOString() });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB non disponible, sauvegarde de secours en localStorage:", err);
    try {
      const lightweight = { ...session, imageBlob: undefined, imageDataUrl: undefined };
      localStorage.setItem(`pdi_sketch_session_${session.id}`, JSON.stringify(lightweight));
    } catch {}
  }
}

/**
 * Récupère l'image associée à une session depuis IndexedDB
 */
export async function getSketchImage(sessionId: string): Promise<{ blob: Blob | null; dataUrl: string | null }> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(STORE_IMAGES, "readonly");
    const store = tx.objectStore(STORE_IMAGES);
    const req = store.get(sessionId);

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const res = req.result;
        if (res && res.blob) {
          const url = URL.createObjectURL(res.blob);
          resolve({ blob: res.blob, dataUrl: url });
        } else {
          resolve({ blob: null, dataUrl: null });
        }
      };
      req.onerror = () => resolve({ blob: null, dataUrl: null });
    });
  } catch {
    return { blob: null, dataUrl: null };
  }
}

/**
 * Charge ou initialise le profil d'apprentissage local
 */
export function getLocalLearningProfile(): SketchLearningProfile {
  if (typeof window === "undefined") return DEFAULT_SKETCH_PROFILE;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SKETCH_PROFILE,
        ...parsed,
        abbreviations: { ...DEFAULT_SKETCH_PROFILE.abbreviations, ...(parsed.abbreviations || {}) },
        symbolAliases: { ...DEFAULT_SKETCH_PROFILE.symbolAliases, ...(parsed.symbolAliases || {}) },
        preferences: { ...DEFAULT_SKETCH_PROFILE.preferences, ...(parsed.preferences || {}) }
      };
    }
  } catch (e) {
    console.warn("Impossible de lire le profil d'apprentissage:", e);
  }
  return DEFAULT_SKETCH_PROFILE;
}

/**
 * Sauvegarde le profil d'apprentissage local
 */
export function saveLocalLearningProfile(profile: SketchLearningProfile): void {
  if (typeof window === "undefined") return;
  try {
    const toSave: SketchLearningProfile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("Erreur d'écriture du profil d'apprentissage:", e);
  }
}

/**
 * Apprend une nouvelle abréviation ou correction calligraphique
 */
export function learnSketchAbbreviation(shortCode: string, canonicalSymbolOrParam: string): SketchLearningProfile {
  const current = getLocalLearningProfile();
  const cleanCode = shortCode.trim().toUpperCase();
  const cleanTarget = canonicalSymbolOrParam.trim();

  current.abbreviations[cleanCode] = cleanTarget;
  saveLocalLearningProfile(current);
  return current;
}

/**
 * Exporte le profil d'apprentissage au format JSON (.pdi-sketch-profile.json)
 */
export function exportLearningProfileToFile(profile?: SketchLearningProfile): void {
  const prof = profile || getLocalLearningProfile();
  const jsonStr = JSON.stringify(prof, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `pdi-sketch-learning-profile-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Importe un profil d'apprentissage depuis un fichier JSON
 */
export async function importLearningProfileFromFile(file: File): Promise<SketchLearningProfile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Contenu JSON invalide.");
        }

        const merged: SketchLearningProfile = {
          version: parsed.version || "1.0",
          updatedAt: new Date().toISOString(),
          author: parsed.author || "Profil Importé",
          abbreviations: { ...DEFAULT_SKETCH_PROFILE.abbreviations, ...(parsed.abbreviations || {}) },
          symbolAliases: { ...DEFAULT_SKETCH_PROFILE.symbolAliases, ...(parsed.symbolAliases || {}) },
          preferences: { ...DEFAULT_SKETCH_PROFILE.preferences, ...(parsed.preferences || {}) }
        };

        saveLocalLearningProfile(merged);
        resolve(merged);
      } catch (err: any) {
        reject(new Error("Fichier de profil corrompu ou format incompatible: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.readAsText(file);
  });
}
