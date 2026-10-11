// PATCH 017K2 : ecran Profil & societe. Source unique de l identite affichee
// dans les cartouches, entetes et pieds de planche (pdi.branding.v1).
import React, { useState } from "react";
import { pdiLoadBranding, pdiSaveBranding, PdiBranding } from "../branding/pdiBranding";
import { pdiAlert } from "./PdiNotice";

const FIELDS: Array<{ key: keyof PdiBranding; label: string; hint: string }> = [
  { key: "companyName", label: "Societe", hint: "Apparait dans le cartouche de chaque planche" },
  { key: "projectOwner", label: "Maitre d ouvrage", hint: "Client ou donneur d ordre du projet" },
  { key: "approverLabel", label: "Libelle d approbation", hint: "Exemple : Approuve par, Verifie par" },
  { key: "documentPrefix", label: "Prefixe document", hint: "Exemple : PDI, ACME-PIP" },
  { key: "standardsNote", label: "Normes en pied de planche", hint: "Referentiel imprime sous la planche" },
];

const LABEL: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", color: "#67E8F9" };
const INPUT: React.CSSProperties = { width: "100%", height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,.3)", background: "#070B12", color: "#E5EDF8", fontSize: 12, fontWeight: 700, padding: "0 10px", outline: "none" };

export function PdiCompanyPanel() {
  const [draft, setDraft] = useState<PdiBranding>(() => pdiLoadBranding());
  const [saved, setSaved] = useState(false);
  const set = (key: keyof PdiBranding, value: string) => { setDraft({ ...draft, [key]: value }); setSaved(false); };
  const save = () => {
    pdiSaveBranding(draft);
    setSaved(true);
    void pdiAlert("Identite enregistree. Les cartouches, entetes et pieds de planche utilisent desormais ces valeurs.", "Profil & societe", "success");
  };
  return (
    <section style={{ marginTop: 18, border: "1px solid rgba(103,232,249,.28)", borderRadius: 16, padding: 16, background: "#0B111A" }}>
      <div style={LABEL}>Profil &amp; societe</div>
      <h3 style={{ margin: "6px 0 4px", fontSize: 16, fontWeight: 900, color: "#E5EDF8" }}>Identite imprimee sur vos plans</h3>
      <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>
        Ces champs alimentent le cartouche, l entete et le pied de chaque planche. Aucune marque n est codee en dur dans le logiciel.
      </p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {FIELDS.map((field) => (
          <label key={String(field.key)} style={{ display: "grid", gap: 5 }}>
            <span style={LABEL}>{field.label}</span>
            <input
              style={INPUT}
              value={String(draft[field.key] || "")}
              placeholder={field.hint}
              onChange={(e) => set(field.key, e.target.value)}
            />
            <small style={{ fontSize: 10, fontWeight: 600, color: "#64748B" }}>{field.hint}</small>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={save}
          style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(103,232,249,.5)", background: "#0E7490", color: "#FFFFFF", fontSize: 12, fontWeight: 900, cursor: "pointer" }}
        >
          Enregistrer l identite
        </button>
        <button
          type="button"
          onClick={() => { setDraft(pdiLoadBranding()); setSaved(false); }}
          style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(148,163,184,.35)", background: "transparent", color: "#CBD5E1", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
        >
          Annuler les modifications
        </button>
        {saved && <span style={{ fontSize: 11, fontWeight: 900, color: "#4ADE80" }}>Enregistre</span>}
      </div>
    </section>
  );
}

export default PdiCompanyPanel;
