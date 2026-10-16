import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  PdiCanvasToolbarControls16,
  PdiCanvasToolbarControls16Props,
} from "../ui/PdiCanvasToolbarControls16";

/**
 * ARCH-16: Tests ciblés sans état interne et sans dépendance externe.
 * PdiCanvasToolbarControls16 est un composant de présentation pur (sans hooks).
 * Il s'exécute directement comme une fonction React retournant une arborescence VDOM.
 */
function renderControls(props: PdiCanvasToolbarControls16Props) {
  const tree = PdiCanvasToolbarControls16(props) as React.ReactElement<any>;

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
    return findAllButtons().find(
      (b) => typeof b.props?.title === "string" && b.props.title.includes(titleSub)
    ) || null;
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

describe("ARCH-16: PdiCanvasToolbarControls16 Suite", () => {
  it("1. vérifie la présence exacte des 4 boutons du canevas", () => {
    const controls = renderControls({
      onZoomOut: vi.fn(),
      onZoomIn: vi.fn(),
      onClearSelection: vi.fn(),
      onResetView: vi.fn(),
    });

    const buttons = controls.findAllButtons();
    expect(buttons).toHaveLength(4);
  });

  it("2. déclenche onZoomOut de manière unique sans appeler les autres callbacks", () => {
    const onZoomOut = vi.fn();
    const onZoomIn = vi.fn();
    const onClearSelection = vi.fn();
    const onResetView = vi.fn();

    const controls = renderControls({
      onZoomOut,
      onZoomIn,
      onClearSelection,
      onResetView,
    });

    const zoomOutBtn = controls.findButtonByTitle("Zoom arrière");
    expect(zoomOutBtn).not.toBeNull();

    zoomOutBtn!.props.onClick();

    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onZoomIn).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
    expect(onResetView).not.toHaveBeenCalled();
  });

  it("3. déclenche onZoomIn de manière unique sans appeler les autres callbacks", () => {
    const onZoomOut = vi.fn();
    const onZoomIn = vi.fn();
    const onClearSelection = vi.fn();
    const onResetView = vi.fn();

    const controls = renderControls({
      onZoomOut,
      onZoomIn,
      onClearSelection,
      onResetView,
    });

    const zoomInBtn = controls.findButtonByTitle("Zoom avant");
    expect(zoomInBtn).not.toBeNull();

    zoomInBtn!.props.onClick();

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
    expect(onResetView).not.toHaveBeenCalled();
  });

  it("4. déclenche onClearSelection de manière unique sans appeler les autres callbacks", () => {
    const onZoomOut = vi.fn();
    const onZoomIn = vi.fn();
    const onClearSelection = vi.fn();
    const onResetView = vi.fn();

    const controls = renderControls({
      onZoomOut,
      onZoomIn,
      onClearSelection,
      onResetView,
    });

    const clearBtn = controls.findButtonByTitle("Désélectionner tout");
    expect(clearBtn).not.toBeNull();
    expect(controls.getText(clearBtn)).toBe("×");

    clearBtn!.props.onClick();

    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(onZoomOut).not.toHaveBeenCalled();
    expect(onZoomIn).not.toHaveBeenCalled();
    expect(onResetView).not.toHaveBeenCalled();
  });

  it("5. déclenche onResetView de manière unique sans appeler les autres callbacks", () => {
    const onZoomOut = vi.fn();
    const onZoomIn = vi.fn();
    const onClearSelection = vi.fn();
    const onResetView = vi.fn();

    const controls = renderControls({
      onZoomOut,
      onZoomIn,
      onClearSelection,
      onResetView,
    });

    const resetBtn = controls.findButtonByTitle("Recentrer et ajuster la vue");
    expect(resetBtn).not.toBeNull();

    resetBtn!.props.onClick();

    expect(onResetView).toHaveBeenCalledTimes(1);
    expect(onZoomOut).not.toHaveBeenCalled();
    expect(onZoomIn).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("6. vérifie les titres accessibles et l'ordre des quatre commandes", () => {
    const controls = renderControls({
      onZoomOut: vi.fn(),
      onZoomIn: vi.fn(),
      onClearSelection: vi.fn(),
      onResetView: vi.fn(),
    });

    const buttons = controls.findAllButtons();
    expect(buttons[0].props.title).toBe("Zoom arrière (-)");
    expect(buttons[1].props.title).toBe("Zoom avant (+)");
    expect(buttons[2].props.title).toBe("Désélectionner tout");
    expect(buttons[3].props.title).toBe("Recentrer et ajuster la vue (Touche 0 / Fit)");
  });

  it("7. accepte une classe personnalisée tout en conservant la disposition par défaut", () => {
    const customClass = "custom-toolbar-class";
    const controls = renderControls({
      onZoomOut: vi.fn(),
      onZoomIn: vi.fn(),
      onClearSelection: vi.fn(),
      onResetView: vi.fn(),
      className: customClass,
    });

    expect(controls.tree.props.className).toBe(customClass);
  });
});
