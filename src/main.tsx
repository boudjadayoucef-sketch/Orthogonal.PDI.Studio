// PATCH 017H : les CSS ne sont plus des assets separes (403 sur /assets/*.css).
// pdiInlineStyles importe chaque feuille en "?inline" et l injecte au demarrage.
import "./pdiInlineStyles";
import "./pdiIsoUxRuntimePatch.js";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { testConnection } from './lib/firebase.ts';
import { initClarity } from './lib/clarity.ts';

// Test connection to Firestore on boot
void testConnection();

// Initialiser Microsoft Clarity si configuré
initClarity();
// PATCH 017H : index.css est injecte par ./pdiInlineStyles (bundle JS).

// Global error listener for non-React uncaught runtime and resource-loading crashes
window.addEventListener("error", (event) => {
  console.error("Global system error caught:", event.error || event.message);
  const rootEl = document.getElementById("root");
  if (rootEl && !rootEl.hasChildNodes()) {
    rootEl.innerHTML = `
      <div style="background-color: #020617; color: #ffffff; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; padding: 24px; box-sizing: border-box;">
        <div style="max-width: 600px; width: 100%; background-color: #0f172a; border: 1px solid rgba(239, 68, 68, 0.4); padding: 32px; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 16px; color: #ef4444; margin-bottom: 24px;">
            <span style="font-size: 36px; line-height: 1;">⚠️</span>
            <div>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Erreur Système Globale</h2>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">L'application n'a pas pu s'initialiser correctement.</p>
            </div>
          </div>
          <div style="background-color: #020617; border: 1px solid #1e293b; padding: 18px; border-radius: 16px; font-family: monospace; font-size: 11px; color: #f87171; overflow: auto; max-height: 250px; line-height: 1.6; box-sizing: border-box;">
            <strong>${event.message || 'Erreur inconnue'}</strong><br/>
            <pre style="margin: 8px 0 0; white-space: pre-wrap; word-break: break-all; opacity: 0.85;">${event.error?.stack || 'Pas de trace de pile disponible.'}</pre>
          </div>
          <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10px; font-family: monospace; color: #64748b;">PD&amp;I • Diagnostic</span>
            <button onclick="window.location.reload()" style="background-color: #f97316; hover:background-color: #ea580c; color: #ffffff; border: none; padding: 10px 20px; border-radius: 12px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s;">Recharger la page</button>
          </div>
        </div>
      </div>
    `;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// PATCH 017D : garde de feuille de styles.
// Si le bundle CSS principal n est pas charge (echec de build ou asset 404),
// l application basculait en affichage brut sans mise en page. On detecte le
// cas avec une sonde et on active un affichage de secours + un bandeau.
function pdiCheckStylesheet(): boolean {
  try {
    const probe = document.createElement("div");
    probe.className = "hidden";
    probe.setAttribute("data-pdi-style-probe", "1");
    document.body.appendChild(probe);
    const loaded = window.getComputedStyle(probe).display === "none";
    probe.remove();
    if (loaded) {
      document.documentElement.classList.remove("pdi-no-tailwind");
      const old = document.getElementById("pdi-style-alert");
      if (old) old.remove();
      return true;
    }
    document.documentElement.classList.add("pdi-no-tailwind");
    console.error(
      "[PD&I 017D] Feuille de styles principale absente : affichage de secours actif. " +
        "Verifier la generation du bundle CSS (vite build / @tailwindcss/vite)."
    );
    if (!document.getElementById("pdi-style-alert")) {
      const bar = document.createElement("div");
      bar.id = "pdi-style-alert";
      const msg = document.createElement("span");
      msg.textContent =
        "Feuille de styles non chargee - affichage de secours actif (reconstruire le bundle CSS).";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Recharger";
      btn.addEventListener("click", () => window.location.reload());
      bar.appendChild(msg);
      bar.appendChild(btn);
      document.body.appendChild(bar);
    }
    return false;
  } catch {
    return true;
  }
}

// PATCH 017G : recuperation automatique de la feuille de styles.
// Cas traite : dist/index.html en cache pointe sur un asset disparu, ou la
// balise <link> a ete perdue. On relit index.html cote serveur et la sonde
// /api/health/assets, on injecte les CSS trouves, puis on re-teste.
let pdiStyleRecoveryAttempts = 0;

function pdiInjectStylesheet(href: string): boolean {
  try {
    const already = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(
      (node) => (node as HTMLLinkElement).getAttribute("href") === href
    );
    if (already) return false;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-pdi-recovered", "017G");
    document.head.appendChild(link);
    console.warn("[PD&I 017G] Feuille de styles injectee : " + href);
    return true;
  } catch {
    return false;
  }
}

async function pdiTryRecoverStylesheet(): Promise<void> {
  if (pdiStyleRecoveryAttempts >= 2) return;
  pdiStyleRecoveryAttempts += 1;
  let injected = 0;
  try {
    const res = await fetch("/index.html", { cache: "no-store" });
    if (res.ok) {
      const html = await res.text();
      const matches: string[] = html.match(/href="([^"]+\.css)"/g) || [];
      matches.forEach((raw: string) => {
        const href = raw.slice(6, -1);
        if (pdiInjectStylesheet(href)) injected += 1;
      });
    }
  } catch {}
  try {
    const res = await fetch("/api/health/assets", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const list: string[] = Array.isArray(data?.css) ? data.css : [];
      console.warn("[PD&I 017G] CSS presents dans dist/assets : " + (list.join(", ") || "aucun"));
      list.forEach((name) => {
        if (pdiInjectStylesheet("/assets/" + name)) injected += 1;
      });
    }
  } catch {}
  // PATCH 017H : dernier recours, la route serveur /api/style/main.css
  // (utile quand /assets/*.css est refuse en 403 par la plateforme).
  if (injected === 0) {
    if (pdiInjectStylesheet("/api/style/main.css")) injected += 1;
  }
  if (injected === 0) {
    console.error(
      "[PD&I 017G] Aucune feuille de styles recuperable. Le bundle CSS n a pas ete " +
        "genere : relancer npm ci && npm run build, puis verifier dist/assets/*.css."
    );
    return;
  }
  window.setTimeout(() => {
    if (!pdiCheckStylesheet()) void pdiTryRecoverStylesheet();
  }, 400);
}

window.setTimeout(() => {
  if (!pdiCheckStylesheet()) void pdiTryRecoverStylesheet();
}, 700);
window.addEventListener("load", () =>
  window.setTimeout(() => {
    if (!pdiCheckStylesheet()) void pdiTryRecoverStylesheet();
  }, 250)
);
