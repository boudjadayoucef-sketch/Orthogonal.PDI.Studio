import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { PdiRotationButton15, PdiRotationButton15Props } from "../ui/PdiRotationButton15";

/**
 * Harness de test autonome et déterministe pour React dans l'environnement Node de Vitest.
 * Simule le cycle de vie React (useState, useRef), le re-rendu automatique lors des mises à jour d'état,
 * et permet l'exploration et le déclenchement réel d'événements de pointeur et de clic.
 * Supporte React 19 (__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) et versions antérieures.
 */
class ReactComponentHarness {
  public states: any[] = [];
  public stateSetters: Array<(val: any) => void> = [];
  public refs: any[] = [];
  public tree: any = null;

  constructor(
    public Component: React.FC<PdiRotationButton15Props>,
    public props: PdiRotationButton15Props
  ) {
    this.render();
  }

  render() {
    let stateIdx = 0;
    let refIdx = 0;

    const dispatcher = {
      useState: (initial: any) => {
        const idx = stateIdx++;
        if (this.states.length <= idx) {
          this.states[idx] = typeof initial === "function" ? initial() : initial;
        }
        if (!this.stateSetters[idx]) {
          this.stateSetters[idx] = (newVal: any) => {
            this.states[idx] = typeof newVal === "function" ? newVal(this.states[idx]) : newVal;
            this.render();
          };
        }
        return [this.states[idx], this.stateSetters[idx]];
      },
      useRef: (initial: any) => {
        const idx = refIdx++;
        if (this.refs.length <= idx) {
          this.refs[idx] = { current: initial };
        }
        return this.refs[idx];
      },
      useCallback: (fn: any) => fn,
      useEffect: () => {},
      useMemo: (fn: any) => fn(),
    };

    const internals =
      (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
      (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

    const prevDispatcher = internals ? (internals.H || internals.ReactCurrentDispatcher?.current) : null;
    if (internals) {
      if ("H" in internals) {
        internals.H = dispatcher;
      } else if (internals.ReactCurrentDispatcher) {
        internals.ReactCurrentDispatcher.current = dispatcher;
      }
    }

    try {
      this.tree = this.Component(this.props);
    } finally {
      if (internals) {
        if ("H" in internals) {
          internals.H = prevDispatcher;
        } else if (internals.ReactCurrentDispatcher) {
          internals.ReactCurrentDispatcher.current = prevDispatcher;
        }
      }
    }
  }

  getText(node: any): string {
    if (!node) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map((c) => this.getText(c)).join("");
    if (node.props && node.props.children) {
      let s = "";
      React.Children.forEach(node.props.children, (c) => {
        s += this.getText(c);
      });
      return s;
    }
    return "";
  }

  findAllButtons(): any[] {
    const list: any[] = [];
    const walk = (n: any) => {
      if (!n || typeof n !== "object") return;
      if (n.type === "button") list.push(n);
      if (n.props && n.props.children) {
        React.Children.forEach(n.props.children, walk);
      }
    };
    walk(this.tree);
    return list;
  }

  findButtonByTitle(titleSub: string) {
    const list = this.findAllButtons();
    return list.find((b) => typeof b.props?.title === "string" && b.props.title.includes(titleSub)) || null;
  }

  findButtonByText(textSub: string) {
    const list = this.findAllButtons();
    return list.find((b) => this.getText(b).includes(textSub)) || null;
  }

  isMenuOpen(): boolean {
    return Boolean(this.states[0]);
  }

  getDefaultAngle(): number {
    return Number(this.states[1]);
  }
}

describe("ARCH-15-FIX-02: Sécurisation des interactions Pointer et robustesse de PdiRotationButton15", () => {
  let timerCallback: (() => void) | null = null;
  let timerDelay = 0;
  let timerClearedCount = 0;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;

  beforeEach(() => {
    timerCallback = null;
    timerDelay = 0;
    timerClearedCount = 0;

    global.setTimeout = ((fn: any, delay: any) => {
      timerCallback = fn;
      timerDelay = delay;
      return 987654;
    }) as any;

    global.clearTimeout = ((_id: any) => {
      timerClearedCount++;
      timerCallback = null;
    }) as any;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  it("A. Clic court normal : déclenche onRotate(15) une seule fois et nettoie le minuteur sans ouvrir le menu", () => {
    const onRotate = vi.fn();
    const onFlip = vi.fn();
    const harness = new ReactComponentHarness(PdiRotationButton15, { onRotate, onFlip });

    const mainBtn = harness.findButtonByTitle("Clic court");
    expect(mainBtn).not.toBeNull();
    expect(harness.isMenuOpen()).toBe(false);

    // Déclenchement du clic court : pointerDown immédiatement suivi de pointerUp (avant 350ms)
    mainBtn.props.onPointerDown();
    expect(timerCallback).not.toBeNull();
    expect(timerDelay).toBe(350);

    mainBtn.props.onPointerUp();

    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(onRotate).toHaveBeenCalledWith(15);
    expect(timerClearedCount).toBeGreaterThan(0);
    expect(timerCallback).toBeNull();
    expect(harness.isMenuOpen()).toBe(false);
  });

  it("B. Appui prolongé : ouvre le menu au-delà du seuil de 350 ms sans déclencher de rotation au relâchement", () => {
    const onRotate = vi.fn();
    const harness = new ReactComponentHarness(PdiRotationButton15, { onRotate });

    const mainBtn = harness.findButtonByTitle("Clic court");
    mainBtn.props.onPointerDown();

    expect(harness.isMenuOpen()).toBe(false);
    expect(timerCallback).not.toBeNull();

    // Simulation de l'écoulement des 350 ms
    timerCallback!();

    expect(harness.isMenuOpen()).toBe(true);

    // Relâchement après ouverture du menu par appui long
    mainBtn.props.onPointerUp();

    // Ne doit pas déclencher de rotation supplémentaire lors du relâchement
    expect(onRotate).not.toHaveBeenCalled();
    expect(harness.isMenuOpen()).toBe(true);
  });

  it("C. Annulation par sortie du pointeur (pointerleave) : aucun déclenchement au pointerup ultérieur et réarmement indépendant", () => {
    const onRotate = vi.fn();
    const harness = new ReactComponentHarness(PdiRotationButton15, { onRotate });

    const mainBtn = harness.findButtonByTitle("Clic court");

    // 1. Déclencher pointerdown, puis pointerleave avant 350 ms
    mainBtn.props.onPointerDown();
    expect(timerCallback).not.toBeNull();

    mainBtn.props.onPointerLeave();
    expect(timerClearedCount).toBeGreaterThan(0);
    expect(timerCallback).toBeNull();
    expect(harness.isMenuOpen()).toBe(false);

    // 2. Déclencher ensuite pointerup : aucune rotation ne doit être exécutée
    mainBtn.props.onPointerUp();
    expect(onRotate).not.toHaveBeenCalled();
    expect(harness.isMenuOpen()).toBe(false);

    // 3. Vérifier qu'un nouvel appui indépendant fonctionne normalement
    mainBtn.props.onPointerDown();
    expect(timerCallback).not.toBeNull();
    mainBtn.props.onPointerUp();

    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(onRotate).toHaveBeenCalledWith(15);
    expect(harness.isMenuOpen()).toBe(false);
  });

  it("D. Annulation par le système (pointercancel) : aucune rotation au pointerup ultérieur et réarmement correct", () => {
    const onRotate = vi.fn();
    const harness = new ReactComponentHarness(PdiRotationButton15, { onRotate });

    const mainBtn = harness.findButtonByTitle("Clic court");

    // 1. Déclencher pointerdown, puis pointercancel
    mainBtn.props.onPointerDown();
    expect(timerCallback).not.toBeNull();

    mainBtn.props.onPointerCancel();
    expect(timerClearedCount).toBeGreaterThan(0);
    expect(timerCallback).toBeNull();
    expect(harness.isMenuOpen()).toBe(false);

    // 2. Simuler ensuite un éventuel pointerup : aucune rotation
    mainBtn.props.onPointerUp();
    expect(onRotate).not.toHaveBeenCalled();
    expect(harness.isMenuOpen()).toBe(false);

    // 3. Vérifier la réinitialisation complète lors d'un nouvel appui indépendant
    mainBtn.props.onPointerDown();
    expect(timerCallback).not.toBeNull();
    mainBtn.props.onPointerUp();

    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(onRotate).toHaveBeenCalledWith(15);
  });

  it("E. Choix des angles dans le menu, fermeture et miroir conditionnel", () => {
    const testCases: Array<{ label: string; expectedAngle: number }> = [
      { label: "+15° Horaire", expectedAngle: 15 },
      { label: "−15° Anti-horaire", expectedAngle: -15 },
      { label: "+45°", expectedAngle: 45 },
      { label: "−45°", expectedAngle: -45 },
      { label: "+90°", expectedAngle: 90 },
      { label: "−90°", expectedAngle: -90 },
    ];

    // Vérification de chaque angle individuellement
    for (const tc of testCases) {
      const onRotate = vi.fn();
      const harness = new ReactComponentHarness(PdiRotationButton15, { onRotate });

      // Ouverture du menu via le bouton Chevron
      const chevronBtn = harness.findButtonByTitle("Menu de choix");
      chevronBtn.props.onClick();
      expect(harness.isMenuOpen()).toBe(true);

      // Clic sur l'angle cible
      const angleBtn = harness.findButtonByText(tc.label);
      expect(angleBtn).not.toBeNull();
      angleBtn.props.onClick();

      expect(onRotate).toHaveBeenCalledTimes(1);
      expect(onRotate).toHaveBeenCalledWith(tc.expectedAngle);
      expect(harness.isMenuOpen()).toBe(false);
    }

    // Miroir avec onFlip fourni
    const onFlip = vi.fn();
    const harnessWithFlip = new ReactComponentHarness(PdiRotationButton15, { onRotate: vi.fn(), onFlip });
    const chevronWithFlip = harnessWithFlip.findButtonByTitle("Menu de choix");
    chevronWithFlip.props.onClick();
    expect(harnessWithFlip.isMenuOpen()).toBe(true);

    const flipBtn = harnessWithFlip.findButtonByText("Inverser / Miroir");
    expect(flipBtn).not.toBeNull();
    flipBtn.props.onClick();

    expect(onFlip).toHaveBeenCalledTimes(1);
    expect(harnessWithFlip.isMenuOpen()).toBe(false);

    // Miroir absent si onFlip non fourni
    const harnessWithoutFlip = new ReactComponentHarness(PdiRotationButton15, { onRotate: vi.fn() });
    const chevronWithoutFlip = harnessWithoutFlip.findButtonByTitle("Menu de choix");
    chevronWithoutFlip.props.onClick();
    expect(harnessWithoutFlip.isMenuOpen()).toBe(true);

    const flipBtnAbsent = harnessWithoutFlip.findButtonByText("Inverser / Miroir");
    expect(flipBtnAbsent).toBeNull();
  });

  it("F. Mémorisation de l'angle par défaut : sélectionner −15° ajuste le clic court, +15° le rétablit", () => {
    const onRotate = vi.fn();
    const harness = new ReactComponentHarness(PdiRotationButton15, { onRotate });

    // Initial : par défaut 15°
    expect(harness.getDefaultAngle()).toBe(15);

    // Sélection de −15° via le menu
    const chevron = harness.findButtonByTitle("Menu de choix");
    chevron.props.onClick();
    const minus15 = harness.findButtonByText("−15° Anti-horaire");
    minus15.props.onClick();

    expect(harness.getDefaultAngle()).toBe(-15);
    expect(onRotate).toHaveBeenLastCalledWith(-15);

    // Clic court ultérieur : utilise désormais −15°
    const mainBtn = harness.findButtonByTitle("Clic court");
    mainBtn.props.onPointerDown();
    mainBtn.props.onPointerUp();

    expect(onRotate).toHaveBeenLastCalledWith(-15);

    // Rétablissement à +15° via le menu
    const chevronReopen = harness.findButtonByTitle("Menu de choix");
    chevronReopen.props.onClick();
    const plus15 = harness.findButtonByText("+15° Horaire");
    plus15.props.onClick();

    expect(harness.getDefaultAngle()).toBe(15);
    expect(onRotate).toHaveBeenLastCalledWith(15);

    // Clic court ultérieur : utilise à nouveau +15°
    const mainBtnUpdated = harness.findButtonByTitle("Clic court");
    mainBtnUpdated.props.onPointerDown();
    mainBtnUpdated.props.onPointerUp();
    expect(onRotate).toHaveBeenLastCalledWith(15);
  });
});
