// PATCH 017K : fenetre de confirmation propre a PD&I.
// Remplace window.confirm, qui affiche l URL du serveur et casse l identite du produit.
// Usage : const ok = await pdiConfirm({ title, message, confirmLabel, destructive });
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

export type PdiConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

const OVERLAY: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 100200,
  background: "rgba(2,6,15,.72)", backdropFilter: "blur(3px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};

const CARD: React.CSSProperties = {
  width: "min(460px, 94vw)", background: "#0B111A",
  border: "1px solid rgba(103,232,249,.35)", borderRadius: 18,
  padding: 20, color: "#E5EDF8",
  boxShadow: "0 24px 60px rgba(0,0,0,.55)",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

function PdiConfirmDialog(props: { options: PdiConfirmOptions; onClose: (ok: boolean) => void }) {
  const { options, onClose } = props;
  const [busy, setBusy] = useState(false);
  const danger = options.destructive === true;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(false); }
      if (e.key === "Enter") { e.preventDefault(); onClose(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={OVERLAY} onMouseDown={() => onClose(false)} role="presentation">
      <div style={CARD} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: danger ? "#FCA5A5" : "#67E8F9" }}>
          {danger ? "Action irreversible" : "Confirmation"}
        </div>
        <h3 style={{ margin: "8px 0 6px", fontSize: 18, fontWeight: 900 }}>{options.title}</h3>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#94A3B8", fontWeight: 600 }}>{options.message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button
            type="button"
            onClick={() => onClose(false)}
            style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(148,163,184,.35)", background: "transparent", color: "#CBD5E1", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
          >
            {options.cancelLabel || "Annuler"}
          </button>
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => { setBusy(true); onClose(true); }}
            style={{ padding: "9px 16px", borderRadius: 10, border: danger ? "1px solid #7F1D1D" : "1px solid rgba(103,232,249,.5)", background: danger ? "#7F1D1D" : "#0E7490", color: "#FFFFFF", fontSize: 12, fontWeight: 900, cursor: "pointer" }}
          >
            {options.confirmLabel || "Confirmer"}
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 10, fontWeight: 700, color: "#64748B" }}>Entree pour confirmer, Echap pour annuler.</div>
      </div>
    </div>
  );
}

export function pdiConfirm(options: PdiConfirmOptions): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-pdi-confirm", "017k");
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = (ok: boolean) => {
      try { root.unmount(); } catch (e) { void e; }
      try { host.remove(); } catch (e) { void e; }
      resolve(ok);
    };
    root.render(<PdiConfirmDialog options={options} onClose={close} />);
  });
}

export default pdiConfirm;
