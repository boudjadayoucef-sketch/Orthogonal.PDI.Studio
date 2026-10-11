/**
 * 008e — PD&I ISO Precision UX Runtime Patch
 * Ajoute un bouton retour si absent et bloque le scroll navigateur sur la zone ISO.
 */
(function pdiIsoUxRuntimePatch() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__PDI_ISO_UX_RUNTIME_008E__) return;
  window.__PDI_ISO_UX_RUNTIME_008E__ = true;

  const STATE = { zoom: 1, panX: 0, panY: 0, isPanning: false, lastX: 0, lastY: 0, timer: null };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const textOf = (el) => (el && el.textContent ? el.textContent : "").trim();

  function isIsoScreen() {
    const txt = document.body ? document.body.innerText || "" : "";
    return /Vue isométrique|Schéma isométrique|Branche ISO|Graphe valide/i.test(txt);
  }

  function findHomeButton() {
    return Array.from(document.querySelectorAll("button, a, [role='button']")).find((el) => /Accueil/i.test(textOf(el)));
  }

  function goHome() {
    const existing = findHomeButton();
    if (existing && !existing.classList.contains("pdi-runtime-back-home")) {
      existing.click();
      return;
    }
    window.dispatchEvent(new CustomEvent("pdi:navigate-home", { detail: { source: "008e-runtime" } }));
    if (window.location.hash && window.location.hash !== "#/") window.location.hash = "#/";
  }

  function findIsoHeader() {
    return Array.from(document.querySelectorAll("header, nav, div")).find((el) => {
      const t = textOf(el);
      return /Vue isométrique|Schéma isométrique|Projet actif/i.test(t) && /Fichier/i.test(t) && /Affichage/i.test(t);
    });
  }

  function ensureBackButton() {
    if (!isIsoScreen()) {
      document.querySelectorAll(".pdi-runtime-back-home").forEach((el) => el.remove());
      return;
    }
    // In ISO mode, if the native topbar already has the Accueil button, remove runtime duplicates
    const nativeAccueil = Array.from(document.querySelectorAll("button, a")).find((el) =>
      !el.classList.contains("pdi-runtime-back-home") && /Accueil/i.test(textOf(el))
    );
    if (nativeAccueil) {
      document.querySelectorAll(".pdi-runtime-back-home").forEach((el) => el.remove());
      return;
    }
    if (document.querySelector(".pdi-runtime-back-home, .pdi-iso-back-btn")) return;
    const header = findIsoHeader();
    if (!header) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pdi-runtime-back-home";
    btn.title = "Retour à l’accueil PD&I";
    btn.textContent = "← Accueil";
    btn.addEventListener("click", goHome);
    header.insertBefore(btn, header.firstChild);
  }

  function findCanvasOrWorkspace() {
    return document.querySelector("canvas") || Array.from(document.querySelectorAll("div, section, main")).find((el) => {
      const cls = String(el.className || "");
      return /canvas|grid|workspace|drawing|iso/i.test(cls) && el.clientWidth > 600;
    });
  }

  function badge() {
    let b = document.querySelector(".pdi-runtime-zoom-badge");
    if (!b) {
      b = document.createElement("div");
      b.className = "pdi-runtime-zoom-badge";
      document.body.appendChild(b);
    }
    return b;
  }

  function showZoom() {
    const b = badge();
    b.textContent = `Zoom ${Math.round(STATE.zoom * 100)}%`;
    b.classList.add("is-visible");
    clearTimeout(STATE.timer);
    STATE.timer = setTimeout(() => b.classList.remove("is-visible"), 650);
  }

  function attachWheelPrecision() {
    // Phase 3: The SVG viewBox / CTM and React viewport state are the sole authoritative coordinate system.
    // DOM CSS transforms on the workspace container are disabled to prevent coordinate drift.
  }

  function markCanvas() {
    document.querySelectorAll("canvas").forEach((c) => {
      c.style.touchAction = "none";
      c.style.userSelect = "none";
      c.dataset.pdiPrecisionPatch = "008e";
    });
  }

  function run() {
    ensureBackButton();
    attachWheelPrecision();
    markCanvas();
  }

  const observer = new MutationObserver(run);
  function start() {
    run();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", run);
    window.addEventListener("hashchange", run);
    window.addEventListener("popstate", run);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
