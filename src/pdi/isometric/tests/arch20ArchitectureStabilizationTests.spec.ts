import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 1. Contrats publics des modules de la Phase 1
import * as IsoTopologyGraph from "../core/IsoTopologyGraph";
import * as isoProjectionEngine from "../core/isoProjectionEngine";
import * as isoAnnotationEngine from "../core/isoAnnotationEngine";
import * as isoWeldSpoolEngine from "../../welding/isoWeldSpoolEngine";
import * as PdiRotationButton15Module from "../ui/PdiRotationButton15";
import * as PdiCanvasToolbarControls16Module from "../ui/PdiCanvasToolbarControls16";
import * as CanvasVisibilityControls18Module from "../ui/CanvasVisibilityControls18";

// Modules fournisseurs vérifiés pour la non-régression des exports métiers
import * as trovayCauvinCatalog from "../../catalog/trouvayCauvinCatalog";
import * as pdiClassePression from "../engine/pdiClassePression017K3";
import * as pdiMssSupportEngine from "../supports/pdiMssSupportEngine";

/**
 * Nettoie les commentaires d'un code source pour éviter les faux positifs
 * lors de l'analyse structurelle des imports.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*/g, "$1");
}

/**
 * Détecte les imports statiques, réexports ou imports dynamiques
 * ciblant le composant monolithique IsometrieModuleV48d.
 */
export function detectMonolithImports(code: string): string[] {
  const cleaned = stripComments(code);
  const staticImportRegex = /(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]*IsometrieModuleV48d(?:\.tsx?)?)['"]/g;
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]*IsometrieModuleV48d(?:\.tsx?)?)['"]\s*\)/g;

  const matches: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = staticImportRegex.exec(cleaned)) !== null) {
    matches.push(m[0].trim());
  }
  while ((m = dynamicImportRegex.exec(cleaned)) !== null) {
    matches.push(m[0].trim());
  }

  return matches;
}

describe("ARCH-20 — Stabilisation architecturale et clôture de Phase 1", () => {
  describe("Test A — Contrats publics des modules de la Phase 1", () => {
    it("valide le contrat public de IsoTopologyGraph.ts (ARCH-12)", () => {
      expect(IsoTopologyGraph).toBeDefined();
      expect(typeof IsoTopologyGraph.makeNode).toBe("function");
      expect(typeof IsoTopologyGraph.makeFitting).toBe("function");
      expect(typeof IsoTopologyGraph.portWorldPosition).toBe("function");
      expect(typeof IsoTopologyGraph.segmentEndpoints).toBe("function");
      expect(typeof IsoTopologyGraph.deriveProjectJoints).toBe("function");
      expect(typeof IsoTopologyGraph.validateProjectGraph).toBe("function");
      expect(typeof IsoTopologyGraph.materialRows).toBe("function");
      expect(typeof IsoTopologyGraph.getFittingSvgGraphic).toBe("function");
      expect(IsoTopologyGraph.DEFAULT_LINE_ID).toBeDefined();
      expect(IsoTopologyGraph.EQUIPMENT_NODE_TYPES instanceof Set).toBe(true);
      expect(IsoTopologyGraph.EQUIPMENT_NODE_TYPES.size).toBeGreaterThan(0);
    });

    it("valide le contrat public de isoProjectionEngine.ts (ARCH-13)", () => {
      expect(isoProjectionEngine).toBeDefined();
      expect(typeof isoProjectionEngine.getProjectionAxes).toBe("function");
      expect(typeof isoProjectionEngine.isoProjectV4).toBe("function");
      expect(typeof isoProjectionEngine.isoUnprojectV4).toBe("function");
      expect(typeof isoProjectionEngine.PDI_ISO_ANGLE_017I2).toBe("number");
      expect(typeof isoProjectionEngine.PDI_ISO_COS_017I2).toBe("number");
      expect(typeof isoProjectionEngine.PDI_ISO_SIN_017I2).toBe("number");
    });

    it("valide le contrat public de isoAnnotationEngine.ts (ARCH-19)", () => {
      expect(isoAnnotationEngine).toBeDefined();
      expect(typeof isoAnnotationEngine.compactIsoLabel).toBe("function");
      expect(typeof isoAnnotationEngine.buildIsoAnnotationLayout).toBe("function");
    });

    it("valide le contrat public de isoWeldSpoolEngine.ts (Spools & Soudures)", () => {
      expect(isoWeldSpoolEngine).toBeDefined();
      expect(typeof isoWeldSpoolEngine.deriveSpoolsAndWelds).toBe("function");
      expect(typeof isoWeldSpoolEngine.exportWeldLogCsv).toBe("function");
      expect(typeof isoWeldSpoolEngine.exportSpoolScheduleCsv).toBe("function");
      expect(typeof isoWeldSpoolEngine.getWeldMarkerSvg).toBe("function");
      expect(Array.isArray(isoWeldSpoolEngine.PDI_SPOOL_PALETTE)).toBe(true);
    });

    it("valide le contrat public de PdiRotationButton15.tsx (ARCH-15)", () => {
      expect(PdiRotationButton15Module).toBeDefined();
      expect(typeof PdiRotationButton15Module.PdiRotationButton15).toBe("function");
    });

    it("valide le contrat public de PdiCanvasToolbarControls16.tsx (ARCH-16)", () => {
      expect(PdiCanvasToolbarControls16Module).toBeDefined();
      expect(typeof PdiCanvasToolbarControls16Module.PdiCanvasToolbarControls16).toBe("function");
    });

    it("valide le contrat public de CanvasVisibilityControls18.tsx (ARCH-18)", () => {
      expect(CanvasVisibilityControls18Module).toBeDefined();
      expect(typeof CanvasVisibilityControls18Module.CanvasVisibilityControls18).toBe("function");
    });
  });

  describe("Test B — Barrière anti-cycle dans core/ et ui/", () => {
    const inspectedDirs = [
      path.resolve(__dirname, "../core"),
      path.resolve(__dirname, "../ui"),
    ];

    it("vérifie qu'aucun fichier source dans core/ et ui/ n'importe IsometrieModuleV48d", () => {
      const violations: Array<{ file: string; imports: string[] }> = [];

      for (const dir of inspectedDirs) {
        expect(fs.existsSync(dir)).toBe(true);
        const files = fs.readdirSync(dir).filter((file) => {
          const isSource = /\.(ts|tsx)$/.test(file);
          const isTest = /\.(spec|test)\.(ts|tsx)$/.test(file);
          return isSource && !isTest;
        });

        for (const file of files) {
          const filePath = path.join(dir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          const prohibitedImports = detectMonolithImports(content);

          if (prohibitedImports.length > 0) {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              imports: prohibitedImports,
            });
          }
        }
      }

      if (violations.length > 0) {
        const errorMessages = violations.map(
          (v) => `Fichier fautif: ${v.file} -> Imports interdits: ${v.imports.join("; ")}`
        );
        throw new Error(
          `Barrière anti-cycle franchie ! Des imports monolithiques ont été détectés :\n${errorMessages.join("\n")}`
        );
      }

      expect(violations).toHaveLength(0);
    });

    it("démontre que la détection anti-cycle échoue correctement en présence d'un import interdit (test négatif)", () => {
      const maliciousCode1 = `
        import { something } from "../engine/IsometrieModuleV48d";
        export const value = 42;
      `;
      const detected1 = detectMonolithImports(maliciousCode1);
      expect(detected1).toHaveLength(1);
      expect(detected1[0]).toContain("IsometrieModuleV48d");

      const maliciousCode2 = `
        export * from "../engine/IsometrieModuleV48d.tsx";
      `;
      const detected2 = detectMonolithImports(maliciousCode2);
      expect(detected2).toHaveLength(1);

      const maliciousCode3 = `
        const mod = await import("../engine/IsometrieModuleV48d");
      `;
      const detected3 = detectMonolithImports(maliciousCode3);
      expect(detected3).toHaveLength(1);

      // Vérifie que les commentaires ne déclenchent pas de faux positif
      const safeCommentedCode = `
        // ARCH-15 : Modularisation et décharge de IsometrieModuleV48d.tsx
        /* import { x } from "../engine/IsometrieModuleV48d" */
        export const clean = true;
      `;
      const detectedComments = detectMonolithImports(safeCommentedCode);
      expect(detectedComments).toHaveLength(0);
    });
  });

  describe("Test C — Préservation stricte des exports fournisseurs", () => {
    it("confirme la disponibilité des symboles métiers des catalogues et moteurs fournisseurs", () => {
      // Trouvay Cauvin Catalog (non utilisé dans IsometrieModuleV48d mais conservé dans le fournisseur)
      expect(trovayCauvinCatalog.TROUVAY_CAUVIN_CATALOG).toBeDefined();
      expect(typeof trovayCauvinCatalog.getComponentVignetteSvg).toBe("function");

      // Classes de pression B16.5 et désignations PN
      expect(pdiClassePression.PDI_CLASSES_B165_017K3).toBeDefined();
      expect(pdiClassePression.PDI_DESIGNATIONS_PN_017K3).toBeDefined();
      expect(pdiClassePression.PDI_CLASSE_PAR_DEFAUT_017K3).toBeDefined();

      // Moteur supports MSS
      expect(pdiMssSupportEngine.MSS_SUPPORT_CATALOG).toBeDefined();
      expect(typeof pdiMssSupportEngine.computeCivilMto).toBe("function");
      expect(typeof pdiMssSupportEngine.verifyPipingSpans).toBe("function");

      // Fonctions topologiques et de soudabilité
      expect(typeof IsoTopologyGraph.isWeldableConnection).toBe("function");
      expect(typeof IsoTopologyGraph.inferJointType).toBe("function");
      expect(typeof IsoTopologyGraph.isEquipmentNode).toBe("function");
    });
  });
});
