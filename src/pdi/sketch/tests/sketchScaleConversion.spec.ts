/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-ISO-02-B-FIX-02 — UNIT TESTS: CALIBRATION SCALE CONVERSION (px/mm -> px/m)
 */
import { describe, it, expect } from "vitest";
import {
  convertCalibrationScaleToPixelsPerMeter,
  compileSketchToIsoModel
} from "../sketchToJsonCompiler";
import { SketchVectorNode, SketchVectorSegment } from "../sketchRasterEngine";

describe("SKETCH-ISO-02-B-FIX-02 : Conversion d'échelle de calibration", () => {
  describe("convertCalibrationScaleToPixelsPerMeter (fonction pure)", () => {
    it("convertit fidèlement 0.5 px/mm en 500 px/m", () => {
      expect(convertCalibrationScaleToPixelsPerMeter(0.5)).toBe(500);
    });

    it("convertit fidèlement 1.0 px/mm en 1000 px/m (évite l'ancien bug de seuil >= 1)", () => {
      expect(convertCalibrationScaleToPixelsPerMeter(1.0)).toBe(1000);
    });

    it("convertit fidèlement 1.5 px/mm en 1500 px/m", () => {
      expect(convertCalibrationScaleToPixelsPerMeter(1.5)).toBe(1500);
    });

    it("convertit fidèlement 2.5 px/mm en 2500 px/m", () => {
      expect(convertCalibrationScaleToPixelsPerMeter(2.5)).toBe(2500);
    });

    it("convertit les échelles décimales avec précision (ex: 0.25 px/mm -> 250 px/m)", () => {
      expect(convertCalibrationScaleToPixelsPerMeter(0.25)).toBe(250);
    });

    it("utilise le repli standard 100 px/m pour 0 ou valeurs négatives", () => {
      expect(convertCalibrationScaleToPixelsPerMeter(0)).toBe(100);
      expect(convertCalibrationScaleToPixelsPerMeter(-1)).toBe(100);
      expect(convertCalibrationScaleToPixelsPerMeter(-0.5)).toBe(100);
    });

    it("utilise le repli standard 100 px/m pour NaN, infini et types invalides", () => {
      expect(convertCalibrationScaleToPixelsPerMeter(NaN)).toBe(100);
      expect(convertCalibrationScaleToPixelsPerMeter(Infinity)).toBe(100);
      expect(convertCalibrationScaleToPixelsPerMeter(-Infinity)).toBe(100);
      expect(convertCalibrationScaleToPixelsPerMeter(undefined as unknown as number)).toBe(100);
      expect(convertCalibrationScaleToPixelsPerMeter(null as unknown as number)).toBe(100);
    });
  });

  describe("compileSketchToIsoModel (intégration directe de la conversion d'échelle)", () => {
    it("calcule la longueur correcte (1.0m et non 1000m) pour 1500px à 1.5 px/mm", () => {
      const nodes: SketchVectorNode[] = [
        { id: "n1", x: 100, y: 100, elevation: 0 },
        { id: "n2", x: 1600, y: 100, elevation: 0 } // distance = 1500px
      ];
      const segments: SketchVectorSegment[] = [
        {
          id: "seg_1500px",
          fromNodeId: "n1",
          toNodeId: "n2",
          nominalDiameter: 150,
          pressureClass: "Class 300",
          material: "Acier API 5L Gr. B"
        }
      ];

      const compiled = compileSketchToIsoModel({
        nodes,
        segments,
        fittings: [],
        calibrationScale: 1.5
      });

      expect(compiled.segments).toHaveLength(1);
      // 1500 px / (1.5 px/mm * 1000 = 1500 px/m) = 1.0 m
      expect(compiled.segments[0].length).toBe(1.0);

      // Dimension associée en millimètres = 1000 mm
      const dim = compiled.dimensions.find((d) => d.id === "dim_seg_1500px");
      expect(dim).toBeDefined();
      expect(dim?.label).toBe("1000");
    });

    it("utilise le repli 100 px/m si calibrationScale <= 0", () => {
      const nodes: SketchVectorNode[] = [
        { id: "n1", x: 0, y: 0, elevation: 0 },
        { id: "n2", x: 500, y: 0, elevation: 0 } // distance = 500px
      ];
      const segments: SketchVectorSegment[] = [
        {
          id: "seg_fallback",
          fromNodeId: "n1",
          toNodeId: "n2",
          nominalDiameter: 100,
          pressureClass: "Class 150",
          material: "Acier"
        }
      ];

      const compiled = compileSketchToIsoModel({
        nodes,
        segments,
        fittings: [],
        calibrationScale: 0
      });

      // 500 px / 100 px/m = 5.0 m
      expect(compiled.segments[0].length).toBe(5.0);
      const dim = compiled.dimensions.find((d) => d.id === "dim_seg_fallback");
      expect(dim?.label).toBe("5000");
    });
  });
});
