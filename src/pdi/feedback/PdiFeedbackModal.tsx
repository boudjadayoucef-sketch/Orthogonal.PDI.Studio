import React, { useState } from "react";
import { submitUserFeedback, PdiUserFeedback } from "../../lib/firebase";
import { pdiAlert } from "../ui/PdiNotice";

export function PdiFeedbackModal({
  isOpen,
  onClose,
  userEmail,
  userName
}: {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string;
}) {
  const [category, setCategory] = useState<PdiUserFeedback["category"]>("general_feedback");
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      await pdiAlert("Veuillez renseigner un titre et votre message de retour.");
      return;
    }

    setSubmitting(true);
    try {
      await submitUserFeedback({
        userEmail: userEmail || "visiteur@pdi-vision.dz",
        userName: userName || "Utilisateur PD&I",
        category,
        rating,
        title,
        message
      });
      await pdiAlert("Merci pour votre retour d'expérience ! Il a bien été transmis et enregistré dans Firebase.");
      setTitle("");
      setMessage("");
      setRating(5);
      onClose();
    } catch (err: any) {
      await pdiAlert("Erreur lors de l'envoi du retour : " + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.75)",
      display: "grid",
      placeItems: "center",
      zIndex: 10060,
      padding: 16
    }}>
      <div style={{
        width: "min(520px, 95vw)",
        background: "linear-gradient(180deg, #111C2A, #08111C)",
        border: "1px solid rgba(103,232,249,0.38)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
        color: "#F8FAFC"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <h3 style={{ margin: 0, fontSize: 17, color: "#67E8F9" }}>Retour d'expérience &amp; Suggestions</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: 0, color: "#94A3B8", fontSize: 22, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: "0 0 16px", color: "#94A3B8", fontSize: 12, lineHeight: 1.5 }}>
          Votre avis et vos suggestions techniques permettent d'améliorer en continu le moteur de dessin ISO, les calculs et l'expérience utilisateur.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>
              Note globale
            </label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: "transparent",
                    border: 0,
                    fontSize: 24,
                    color: star <= rating ? "#F59E0B" : "#334155",
                    cursor: "pointer",
                    padding: 0
                  }}
                >
                  ★
                </button>
              ))}
              <span style={{ fontSize: 12, color: "#CBD5E1", marginLeft: 8, fontWeight: 700 }}>
                {rating === 5 ? "Excellent" : rating === 4 ? "Très bon" : rating === 3 ? "Moyen" : rating === 2 ? "À améliorer" : "Insuffisant"}
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>
              Catégorie de retour
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 8,
                background: "#070E17",
                border: "1px solid rgba(148,163,184,0.3)",
                color: "white",
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 700
              }}
            >
              <option value="satisfaction">Avis de satisfaction général</option>
              <option value="feature_request">Demande de nouvelle fonctionnalité</option>
              <option value="bug_report">Rapport d'anomalie / Bug</option>
              <option value="general_feedback">Remarque ou question technique</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>
              Sujet / Titre
            </label>
            <input
              type="text"
              required
              placeholder="ex: Cotations automatiques & détection des vannes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 8,
                background: "#070E17",
                border: "1px solid rgba(148,163,184,0.3)",
                color: "white",
                padding: "0 10px",
                fontSize: 12
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#94A3B8", marginBottom: 4 }}>
              Détails de votre retour
            </label>
            <textarea
              required
              rows={4}
              placeholder="Expliquez ce qui vous a plu ou ce qui pourrait être perfectionné..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 8,
                background: "#070E17",
                border: "1px solid rgba(148,163,184,0.3)",
                color: "white",
                padding: "10px",
                fontSize: 12,
                fontFamily: "inherit",
                lineHeight: 1.4
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#1E293B",
                color: "#CBD5E1",
                border: 0,
                borderRadius: 8,
                padding: "9px 14px",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "linear-gradient(135deg, #0284C7, #22D3EE)",
                color: "white",
                border: 0,
                borderRadius: 8,
                padding: "9px 18px",
                fontWeight: 900,
                cursor: submitting ? "not-allowed" : "pointer"
              }}
            >
              {submitting ? "Envoi..." : "Transmettre mon avis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
