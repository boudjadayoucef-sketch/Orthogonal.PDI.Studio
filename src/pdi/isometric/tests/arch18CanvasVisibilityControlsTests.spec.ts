import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  CanvasVisibilityControls18,
  CanvasVisibilityControlsProps,
  CanvasVisibilityLayerKey,
  CanvasVisibilityState,
} from "../ui/CanvasVisibilityControls18";

/**
 * ARCH-18: Tests de validation des contrôles de visibilité du canevas.
 * CanvasVisibilityControls18 est un composant de présentation pur (sans hooks internes).
 * Il s'exécute directement comme une fonction React retournant une arborescence de boutons.
 */
function renderControls(
  visibility: CanvasVisibilityState,
  onToggleLayer: (layer: CanvasVisibilityLayerKey) => void
) {
  const tree = CanvasVisibilityControls18({
    visibility,
    actions: { onToggleLayer },
  }) as React.ReactElement<any>;

  const findAllButtons = (): React.ReactElement<any>[] => {
    const buttons: React.ReactElement<any>[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "button") {
        buttons.push(node);
      }
      if (node.props?.children) {
        React.Children.forEach(node.props.children, walk);
      }
    };
    walk(tree);
    return buttons;
  };

  const findButtonByTitle = (titleSub: string) => {
    return (
      findAllButtons().find(
        (b) =>
          typeof b.props?.title === "string" && b.props.title.includes(titleSub)
      ) || null
    );
  };

  const getText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (node.props?.children) {
      let text = "";
      React.Children.forEach(node.props.children, (c) => {
        text += getText(c);
      });
      return text;
    }
    return "";
  };

  return {
    tree,
    findAllButtons,
    findButtonByTitle,
    getText,
  };
}

describe("ARCH-18: CanvasVisibilityControls18 Suite", () => {
  const allFalseState: CanvasVisibilityState = {
    grid: false,
    civilBackground: false,
    dimensions: false,
    pipeLabels: false,
    welds: false,
    spoolColoring: false,
    annotations: false,
  };

  const allTrueState: CanvasVisibilityState = {
    grid: true,
    civilBackground: true,
    dimensions: true,
    pipeLabels: true,
    welds: true,
    spoolColoring: true,
    annotations: true,
  };

  it("1. vérifie la présence exacte des 7 boutons de visibilité dans l'ordre requis", () => {
    const controls = renderControls(allFalseState, vi.fn());
    const buttons = controls.findAllButtons();

    expect(buttons).toHaveLength(7);
    expect(controls.getText(buttons[0])).toBe("#");
    expect(controls.getText(buttons[1])).toBe("GC");
    expect(controls.getText(buttons[2])).toBe("⇔");
    expect(controls.getText(buttons[3])).toBe("PL");
    expect(controls.getText(buttons[4])).toBe("W");
    expect(controls.getText(buttons[5])).toBe("SP");
    expect(controls.getText(buttons[6])).toBe("Aa");
  });

  it("2. vérifie les infobulles accessibles (title) des 7 boutons", () => {
    const controls = renderControls(allFalseState, vi.fn());
    const buttons = controls.findAllButtons();

    expect(buttons[0].props.title).toBe("Afficher la grille (#)");
    expect(buttons[1].props.title).toBe("Afficher le génie civil (GC)");
    expect(buttons[2].props.title).toBe("Afficher les cotes (⇔)");
    expect(buttons[3].props.title).toBe("Labels des tuyauteries (PL)");
    expect(buttons[4].props.title).toBe("Afficher les soudures Wxxx (W)");
    expect(buttons[5].props.title).toBe("Coloration par Spool (SP)");
    expect(buttons[6].props.title).toBe("Afficher les annotations (Aa)");
  });

  it("3. vérifie les classes CSS de l'état inactif (bg-slate-800 text-slate-400)", () => {
    const controls = renderControls(allFalseState, vi.fn());
    const buttons = controls.findAllButtons();

    for (const btn of buttons) {
      expect(btn.props.className).toContain("bg-slate-800");
      expect(btn.props.className).toContain("text-slate-400");
    }
  });

  it("4. vérifie les classes CSS distinctes de chaque état actif", () => {
    const controls = renderControls(allTrueState, vi.fn());
    const buttons = controls.findAllButtons();

    // 1. Grille : bg-blue-600
    expect(buttons[0].props.className).toContain("bg-blue-600");
    expect(buttons[0].props.className).toContain("text-white");

    // 2. Génie civil : bg-cyan-600
    expect(buttons[1].props.className).toContain("bg-cyan-600");
    expect(buttons[1].props.className).toContain("text-white");

    // 3. Cotes : bg-blue-600
    expect(buttons[2].props.className).toContain("bg-blue-600");
    expect(buttons[2].props.className).toContain("text-white");

    // 4. Labels tuyauteries : bg-cyan-600
    expect(buttons[3].props.className).toContain("bg-cyan-600");
    expect(buttons[3].props.className).toContain("text-white");

    // 5. Soudures : bg-amber-600
    expect(buttons[4].props.className).toContain("bg-amber-600");
    expect(buttons[4].props.className).toContain("text-white");

    // 6. Coloration spool : bg-purple-600
    expect(buttons[5].props.className).toContain("bg-purple-600");
    expect(buttons[5].props.className).toContain("text-white");

    // 7. Annotations : bg-indigo-600
    expect(buttons[6].props.className).toContain("bg-indigo-600");
    expect(buttons[6].props.className).toContain("text-white");
  });

  it("5. déclenche onToggleLayer avec la clé exacte lors du clic sur chaque bouton", () => {
    const testCases: Array<{ label: string; expectedKey: CanvasVisibilityLayerKey }> = [
      { label: "#", expectedKey: "grid" },
      { label: "GC", expectedKey: "civilBackground" },
      { label: "⇔", expectedKey: "dimensions" },
      { label: "PL", expectedKey: "pipeLabels" },
      { label: "W", expectedKey: "welds" },
      { label: "SP", expectedKey: "spoolColoring" },
      { label: "Aa", expectedKey: "annotations" },
    ];

    for (const tc of testCases) {
      const onToggle = vi.fn();
      const controls = renderControls(allFalseState, onToggle);
      const btn = controls.findAllButtons().find((b) => controls.getText(b) === tc.label);

      expect(btn).not.toBeNull();
      btn!.props.onClick();

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(tc.expectedKey);
    }
  });

  it("6. garantit l'exclusion stricte des boutons métier Weld Map, MSS et GUIDE", () => {
    const controls = renderControls(allTrueState, vi.fn());
    const allTitles = controls
      .findAllButtons()
      .map((b) => b.props.title || "");
    const allTexts = controls
      .findAllButtons()
      .map((b) => controls.getText(b));

    // Vérifie qu'aucun bouton n'est Weld Map, MSS ou GUIDE
    expect(allTitles.some((t) => t.includes("Weld Map"))).toBe(false);
    expect(allTitles.some((t) => t.includes("MSS"))).toBe(false);
    expect(allTitles.some((t) => t.includes("GUIDE"))).toBe(false);

    expect(allTexts.includes("MSS")).toBe(false);
    expect(allTexts.includes("GUIDE")).toBe(false);
  });
});
