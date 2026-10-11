// PATCH 017K2 & 017Q2 : fenetre d information et dialogue propre a PD&I.
// Remplace alert() et confirm(), avec options Fermer et Ignorer / Continuer.
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";

export type PdiNoticeTone = "info" | "success" | "warning" | "error";

const TONES: Record<PdiNoticeTone, { color: string; label: string }> = {
  info: { color: "#67E8F9", label: "Information" },
  success: { color: "#4ADE80", label: "Opération réussie" },
  warning: { color: "#FBBF24", label: "Attention" },
  error: { color: "#FCA5A5", label: "Erreur" },
};

function guessTone(message: string): PdiNoticeTone {
  const m = message.toLowerCase();
  if (m.includes("erreur") || m.includes("impossible") || m.includes("echec") || m.includes("échec")) return "error";
  if (m.includes("attention") || m.includes("⚠")) return "warning";
  if (m.includes("succ") || m.includes("réussi") || m.includes("enregistr")) return "success";
  return "info";
}

interface PdiNoticeDialogProps {
  message: string;
  title?: string;
  tone: PdiNoticeTone;
  closeLabel?: string;
  ignoreLabel?: string;
  showIgnore?: boolean;
  onClose: () => void;
  onIgnore?: () => void;
}

function PdiNoticeDialog(props: PdiNoticeDialogProps) {
  const { message, title, tone, closeLabel = "Fermer", ignoreLabel = "Ignorer et continuer", showIgnore, onClose, onIgnore } = props;
  
  // By default, for error tones or blocking messages, also enable the Ignore button if user wants to bypass
  const isErrorOrWarning = tone === "error" || tone === "warning" || message.toLowerCase().includes("erreur");
  const enableIgnore = showIgnore ?? isErrorOrWarning;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Enter") { 
        e.preventDefault(); 
        if (onIgnore && enableIgnore) {
          onIgnore();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onIgnore, enableIgnore]);

  const t = TONES[tone];
  return (
    <div
      role="presentation"
      onMouseDown={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100200, background: "rgba(2,6,15,.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: "min(480px, 94vw)", background: "#0B111A", border: "1px solid rgba(103,232,249,.35)", borderRadius: 18, padding: 22, color: "#E5EDF8", boxShadow: "0 24px 60px rgba(0,0,0,.65)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: t.color }}>
            {title || t.label}
          </div>
          {isErrorOrWarning && (
            <span style={{ fontSize: 10, background: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>
              Contournement autorisé
            </span>
          )}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.6, fontWeight: 600, whiteSpace: "pre-wrap", color: "#F1F5F9" }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(148,163,184,.3)", background: "#1E293B", color: "#CBD5E1", fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all 0.15s" }}
          >
            {closeLabel}
          </button>
          {enableIgnore && (
            <button
              type="button"
              autoFocus
              onClick={() => {
                if (onIgnore) onIgnore();
                else onClose();
              }}
              style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(103,232,249,.5)", background: "#0E7490", color: "#FFFFFF", fontSize: 12, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>{ignoreLabel}</span>
              <span style={{ opacity: 0.8, fontSize: 11 }}>↵</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function pdiAlert(message: unknown, title?: string, tone?: PdiNoticeTone): Promise<void> {
  const text = typeof message === "string" ? message : String(message);
  if (typeof document === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-pdi-notice", "017k2");
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = () => {
      try { root.unmount(); } catch (e) { void e; }
      try { host.remove(); } catch (e) { void e; }
      resolve();
    };
    root.render(
      <PdiNoticeDialog
        message={text}
        title={title}
        tone={tone || guessTone(text)}
        onClose={close}
        onIgnore={close}
      />
    );
  });
}

export function pdiConfirm(
  message: string,
  title = "Confirmation",
  tone: PdiNoticeTone = "warning",
  confirmLabel = "Continuer",
  cancelLabel = "Annuler"
): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-pdi-confirm", "017q2");
    document.body.appendChild(host);
    const root = createRoot(host);
    const cleanup = (result: boolean) => {
      try { root.unmount(); } catch (e) { void e; }
      try { host.remove(); } catch (e) { void e; }
      resolve(result);
    };
    root.render(
      <PdiNoticeDialog
        message={message}
        title={title}
        tone={tone}
        closeLabel={cancelLabel}
        ignoreLabel={confirmLabel}
        showIgnore={true}
        onClose={() => cleanup(false)}
        onIgnore={() => cleanup(true)}
      />
    );
  });
}

export default pdiAlert;
