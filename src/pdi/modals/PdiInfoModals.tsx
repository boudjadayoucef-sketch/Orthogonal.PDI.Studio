import React, { useState } from "react";
import {
  runNormativeEngineTests,
  runPipeDimensionalEngineTests,
} from "../normative";

export type ModalType = "legal" | "tech_ref" | "payment_terms" | null;

interface PdiInfoModalsProps {
  activeModal: ModalType;
  onClose: () => void;
  userCountryCode?: string; // e.g. "DZ", "FR", "US" to tailor local payment context if needed
}

export default function PdiInfoModals({
  activeModal,
  onClose,
  userCountryCode = "DZ"
}: PdiInfoModalsProps) {
  const isAlgeria = userCountryCode.toUpperCase() === "DZ";
  const [techTab, setTechTab] = useState<"piping" | "fittings" | "materials" | "valves" | "supports_civil" | "welding_ndt" | "normative_engine">("piping");
  const [paymentTab, setPaymentTab] = useState<"paddle" | "slickpay" | "security">("paddle");

  const normativeEngineTestRes = techTab === "normative_engine" ? runNormativeEngineTests() : null;
  const pipeDimensionalTestRes = techTab === "normative_engine" ? runPipeDimensionalEngineTests() : null;

  if (!activeModal) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto"
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: activeModal === "tech_ref" ? "920px" : "800px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0B1320",
          border: "1px solid rgba(44, 224, 255, 0.3)",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(44, 224, 255, 0.15)",
          color: "#E2E8F0",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
            background: "linear-gradient(90deg, rgba(14, 165, 233, 0.12), rgba(15, 23, 42, 0.8))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#2CE0FF",
                boxShadow: "0 0 10px #2CE0FF"
              }}
            />
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#F8FAFC",
                  letterSpacing: "0.02em"
                }}
              >
                {activeModal === "legal" && "📄 Mentions Légales & Politique de Confidentialité"}
                {activeModal === "tech_ref" && "📐 Références Techniques & Bibliothèque Normative Industrielle"}
                {activeModal === "payment_terms" && "💳 Modalités de Paiement & Architecture Sécurisée"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94A3B8", fontFamily: "monospace" }}>
                PD&amp;I · PIPING DESIGN &amp; ISOMETRICS · POWERED BY ORTHOGONAL - ENG
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "8px",
              color: "#94A3B8",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFFFF")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, fontSize: "13px", lineHeight: "1.6" }}>
          
          {/* ============================================================ */}
          {/* MODAL 1: MENTIONS LÉGALES & CONFIDENTIALITÉ */}
          {/* ============================================================ */}
          {activeModal === "legal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Éditeur */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(44, 224, 255, 0.2)",
                  borderRadius: "12px",
                  padding: "16px"
                }}
              >
                <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "14px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🏢 1. Éditeur de la Plateforme &amp; Ingénierie Logicielle</span>
                </div>
                <p style={{ margin: "0 0 8px", color: "#CBD5E1" }}>
                  La solution logicielle <strong>PD&amp;I (Piping Design &amp; Isometrics)</strong> est éditée, développée et maintenue par :
                </p>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "#94A3B8" }}>
                  <li><strong style={{ color: "#F8FAFC" }}>Entité d'Ingénierie :</strong> ORTHOGONAL - ENG</li>
                  <li><strong style={{ color: "#F8FAFC" }}>Domaine d'expertise :</strong> Ingénierie mécanique, tuyauterie industrielle, calculs ISO / ASME et solutions logicielles CAO métier.</li>
                  <li><strong style={{ color: "#F8FAFC" }}>Responsable Technique :</strong> Youcef Seif Eddine Boudjada (Ingénieur Spécialiste Piping &amp; Systèmes Numériques).</li>
                  <li><strong style={{ color: "#F8FAFC" }}>Contact Support &amp; Conformité :</strong> contact@orthogonal-eng.com / support@pdi-pipe.com</li>
                </ul>
              </div>

              {/* Propriété intellectuelle */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: "12px",
                  padding: "16px"
                }}
              >
                <div style={{ fontWeight: 800, color: "#FBBF24", fontSize: "14px", marginBottom: "8px" }}>
                  ⚖️ 2. Propriété Intellectuelle &amp; Droits d'Utilisation
                </div>
                <p style={{ margin: "0 0 8px", color: "#CBD5E1" }}>
                  L'ensemble des algorithmes de calculs isométriques, le moteur de génération SVG/DXF, le modèle de données JSON centralisé, les bibliothèques normatives intégrées, et l'interface utilisateur sont la propriété exclusive de <strong>ORTHOGONAL - ENG</strong>.
                </p>
                <p style={{ margin: 0, color: "#94A3B8" }}>
                  <strong>Propriété des données client :</strong> Les plans, isométriques, lignes de tuyauteries, nomenclatures (BOM) et relevés générés par les utilisateurs restent la <strong>propriété pleine et entière du client</strong> (bureau d'études ou donneur d'ordre). ORTHOGONAL - ENG ne revendique aucun droit sur les projets modélisés.
                </p>
              </div>

              {/* Protection des données & Confidentialité */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: "12px",
                  padding: "16px"
                }}
              >
                <div style={{ fontWeight: 800, color: "#34D399", fontSize: "14px", marginBottom: "8px" }}>
                  🔒 3. Confidentialité Industrielle &amp; Protection des Données (RGPD &amp; Loi 18-07)
                </div>
                <p style={{ margin: "0 0 8px", color: "#CBD5E1" }}>
                  Conformément aux normes internationales (RGPD pour l'Europe, Loi 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel pour l'Algérie) :
                </p>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "#94A3B8" }}>
                  <li><strong style={{ color: "#F8FAFC" }}>Chiffrement de bout en bout :</strong> Toutes les communications sont chiffrées via TLS 1.3 / SSL 256-bit.</li>
                  <li><strong style={{ color: "#F8FAFC" }}>Secret industriel :</strong> Vos données de tuyauterie industrielle (PID, Isos, coordonnées de spools, nuances d'aciers) sont stockées dans des compartiments Cloud isolés et ne sont jamais utilisées pour l'entraînement de modèles tiers sans consentement explicite.</li>
                  <li><strong style={{ color: "#F8FAFC" }}>Droit d'accès et d'effacement :</strong> Vous pouvez à tout moment exporter l'intégralité de vos projets (format JSON/DXF/PDF) ou demander la suppression définitive de votre compte et de vos données.</li>
                </ul>
              </div>

              {/* Hébergement et Sécurité */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: "12px",
                  padding: "16px"
                }}
              >
                <div style={{ fontWeight: 800, color: "#A78BFA", fontSize: "14px", marginBottom: "8px" }}>
                  🛡️ 4. Infrastructure &amp; Sécurité Haute Disponibilité
                </div>
                <p style={{ margin: 0, color: "#94A3B8" }}>
                  Les serveurs et bases de données sont hébergés sur l'infrastructure sécurisée Google Cloud Platform (ISO 27001, SOC 2, SOC 3, HIPAA) avec sauvegardes incrémentales automatiques et tolérance aux pannes à 99,95%.
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODAL 2: RÉFÉRENCES TECHNIQUES & BIBLIOTHÈQUE NORMATIVE */}
          {/* ============================================================ */}
          {activeModal === "tech_ref" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "rgba(44, 224, 255, 0.08)", border: "1px solid rgba(44, 224, 255, 0.2)", borderRadius: "10px", padding: "12px 16px" }}>
                <p style={{ margin: 0, color: "#E0F2FE", fontSize: "12.5px" }}>
                  <strong>Rigueur &amp; Standardisation Ingénierie :</strong> PD&amp;I intègre nativement l'ensemble des catalogues dimensionnels, tolérances d'usinage, codes de calcul sous pression et règles de traçabilité des plus grands comités internationaux de normalisation (ASME, ISO, ASTM, API, EN/DIN, MSS-SP, AISC, Eurocodes).
                </p>
              </div>

              {/* TABS DE NAVIGATION NORMATIVE */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", borderBottom: "1px solid rgba(148, 163, 184, 0.2)", paddingBottom: "10px" }}>
                {[
                  { id: "piping", label: "Codes Tuyauterie (ASME/EN)" },
                  { id: "fittings", label: "Brides & Raccords (B16)" },
                  { id: "materials", label: "Nuances & Tubes (ASTM/API)" },
                  { id: "valves", label: "Robinetterie (API/ISO)" },
                  { id: "supports_civil", label: "Génie Civil & Supports (MSS/AISC)" },
                  { id: "welding_ndt", label: "Soudures & Contrôles CND" },
                  { id: "normative_engine", label: "⚡ Validateur Normatif (NORM-02-R1)" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTechTab(t.id as any)}
                    style={{
                      background: techTab === t.id ? "#0284C7" : "rgba(15, 23, 42, 0.7)",
                      border: techTab === t.id ? "1px solid #38BDF8" : "1px solid rgba(148, 163, 184, 0.2)",
                      color: techTab === t.id ? "#FFFFFF" : "#94A3B8",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: CODES TUYAUTERIE */}
              {techTab === "piping" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>ASME B31.3 · Process Piping</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Tuyauteries d'usines chimiques, pétrochimiques, raffineries, séparation de gaz et installations industrielles complexes. Calcul des épaisseurs sous pression interne/externe (Para. 304) et contraintes thermiques.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(56, 189, 248, 0.4)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>ASME B31.8-2022 · Gas Transmission &amp; Distribution</div>
                      <span style={{ fontSize: "9px", background: "rgba(56, 189, 248, 0.2)", color: "#38BDF8", padding: "2px 6px", borderRadius: "4px", fontWeight: 800, textTransform: "uppercase" }}>À venir / Source de référence</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Canalisations et réseaux de transport et distribution de gaz. Calcul de pression admissible MAOP (formule Barlow P = (2 × S × t / D) × F × E × T), Facteurs de construction F par Classes d'emplacement 1 à 4 (0.80 à 0.40), Chapitre VIII Offshore, Chapitre IX Sour Gas (H2S), et règles de renfort de piquages (App. F).
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(168, 85, 247, 0.4)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 800, color: "#C084FC", fontSize: "12px" }}>ASME B31.12-2019 · Hydrogen Piping &amp; Pipelines</div>
                      <span style={{ fontSize: "9px", background: "rgba(168, 85, 247, 0.2)", color: "#C084FC", padding: "2px 6px", borderRadius: "4px", fontWeight: 800, textTransform: "uppercase" }}>À venir / Source de référence</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Installations d'hydrogène gazeux (GH2) et liquide (LH2). Couvre Part IP (tuyauterie industrielle) et Part PL (canalisations de transport). Facteurs de performance matériau Hf et Mf pour tenue à la fragilisation par l'hydrogène (HE), Option A (Prescriptive) / Option B (Mécanique de la rupture), contrôle de dureté des soudures et essais d'étanchéité.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>ASME B31.4 · Liquid &amp; Slurry Transportation</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Transport par canalisations d'hydrocarbures liquides, GPL, ammoniac anhydre et suspensions minérales.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>ASME B31.1 · Power Piping</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Tuyauteries de centrales thermiques, chaudières industrielles haute pression et circuits vapeur surchauffée.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>EN 13480 &amp; CODETI · Standards Européens</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Code européen des tuyauteries industrielles métalliques (Directive DESP 2014/68/UE) et Code Français de Construction des Tuyauteries Industrielles.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BRIDES & RACCORDS */}
              {techTab === "fittings" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#FBBF24", fontSize: "12px" }}>ASME B16.5 · Brides Pipe Flanges (1/2" à 24")</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Dimensions, portées de joints (RF, FF, RTJ) et ratings de pression Classes 150#, 300#, 600#, 900#, 1500#, 2500#. Types WN (Welding Neck), SO (Slip-On), BL (Blind), SW, THD.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#FBBF24", fontSize: "12px" }}>ASME B16.47 · Brides Grand Diamètre (26" à 60")</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Brides de grand diamètre Séries A (MSS SP-44) et Séries B (API 605) pour manifolds et gros collecteurs.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#FBBF24", fontSize: "12px" }}>ASME B16.9 · Raccords BW à Souder Bout-à-Bout</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Coudes 90° et 45° Long Radius (1.5D) &amp; Short Radius (1.0D), 3D, Tés égaux et réduits, Réductions concentriques &amp; excentriques, Fonds bombés (Caps), Stub Ends.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#FBBF24", fontSize: "12px" }}>ASME B16.11 · Raccords Forgés SW &amp; NPT</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Raccords forgés à emboîtement et soudure (Socket-Weld) et taraudés NPT classes 2000#, 3000#, 6000#, 9000# pour petits diamètres (≤ 2").
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MATÉRIAUX & NUANCES */}
              {techTab === "materials" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#34D399", fontSize: "12px" }}>Aciers Carbone : ASTM A106 Gr.B / API 5L</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Tubes sans soudure haute température ASTM A106 Gr.B, et tubes pour transport d'hydrocarbures API 5L (Gr.B, X42, X52, X60, X65, X70 PSL1/PSL2). Raccords ASTM A234 WPB et brides ASTM A105.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#34D399", fontSize: "12px" }}>Inoxydables &amp; Alliages : ASTM A312 TP304L/316L</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Aciers inoxydables austénitiques 304L / 316L / 321, Duplex (UNS S31803) et Super Duplex pour milieux corrosifs et cryogéniques.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#34D399", fontSize: "12px" }}>Basse &amp; Haute Température : ASTM A333 &amp; A335</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      ASTM A333 Gr.6 pour service cryogénique (-45°C), ASTM A335 (P11, P22, P91) en aciers alliés chrome-molybdène pour vapeur vive surchauffée.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#34D399", fontSize: "12px" }}>Boulonnerie : ASTM A193 B7 / A194 2H</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Goujons filetés en acier allié traité thermiquement ASTM A193 Gr. B7 avec écrous lourds ASTM A194 Gr. 2H. Version basse température ASTM A320 L7 / A194 Gr. 7.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ROBINETTERIE */}
              {techTab === "valves" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#C084FC", fontSize: "12px" }}>API 6D · Vannes de Pipeline</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Spécification des vannes à tournant sphérique (Ball Valves - Floating &amp; Trunnion Mounted), clapets anti-retour (Check Valves) et vannes à passage direct (Gate Valves).
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#C084FC", fontSize: "12px" }}>API 600 / API 602 &amp; ASME B16.34</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Vannes à passage direct en acier coulé (API 600) et vannes compactes forgées (API 602) avec trim 8 (Stellite/13Cr). Épaisseurs de corps et ratings selon ASME B16.34.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#C084FC", fontSize: "12px" }}>API 598 &amp; ISO 5208 · Essais &amp; Étanchéité</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Protocoles d'essais d'étanchéité sous pression hydraulique et pneumatique de siège, de corps et presse-étoupe (Taux de fuite admissible Rate A / Rate B).
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#C084FC", fontSize: "12px" }}>ASME B16.10 · Face-to-Face Dimensions</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Encombrements normalisés face-à-face et bout-à-bout pour l'interchangeabilité parfaite sur les isométriques et maquettes 3D.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SUPPORTS & GÉNIE CIVIL */}
              {techTab === "supports_civil" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>MSS SP-58 &amp; MSS SP-69 · Supports Tuyauterie</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Conception, sélection et dimensionnement des supports : Patins soudés/clampés (Shoe), Guides, Butées axiales (Line Stop), Pendards rigides, Boîtes à ressort variables et supports à charge constante.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>AISC 360 &amp; Eurocode 3 (EN 1993) · Charpente</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Calcul des structures secondaires métalliques, pipe-racks, traverses et profilés standards (HEA, HEB, IPE, UPN, cornières L) supportant les lignes de tuyauterie.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>Eurocode 2 (EN 1992) &amp; ACI 318 · Génie Civil</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Massifs d'ancrage en béton armé, plots et platines d'assise. Dimensionnement des chevilles chimiques et goujons d'ancrage scellés.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px" }}>ASME B31.3 Para. 321 · Piping Support Elements</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Règles de transfert des charges mécaniques (poids propre + fluide + calorifuge + vent + séisme) et limitation des contraintes locales de pincement sur le tube.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SOUDURES & CND */}
              {techTab === "welding_ndt" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#F43F5E", fontSize: "12px" }}>ASME Section IX · Qualification des Soudures</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Gestion et traçabilité des Descriptifs de Mode Opératoire de Soudage (DMOS / WPS), Qualifications de Mode Opératoire (QMOS / PQR) et Qualifications des Soudeurs (QS / WPQ).
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#F43F5E", fontSize: "12px" }}>Weld Map &amp; Repérage W001, W002...</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Numérotation automatique et cartographie des soudures d'atelier (Shop Welds - SW) et soudures de chantier (Field Welds - FW / Golden Welds) avec attribution du soudeur et date.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#F43F5E", fontSize: "12px" }}>Contrôles Non Destructifs (CND / NDT)</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Contrôle visuel (VT), Ressuage (PT / Dye Penetrant), Magnétoscopie (MT), Contrôle Radiographique (RT X/Gamma) et Ultrasons (UT / Phased Array) selon les classes de criticité.
                    </div>
                  </div>
                  <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#F43F5E", fontSize: "12px" }}>Épreuve Hydraulique (Hydrotest ASME B31.3)</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                      Calcul de la pression d'épreuve hydrostatique normalisée (P_test = 1.5 × P_design × [S_test / S_design]), établissement des circuits de test et procès-verbaux de mise sous pression.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: ENGINE NORMATIF & VALIDATEUR (NORM-02-R1) */}
              {techTab === "normative_engine" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontWeight: 800, color: "#34D399", fontSize: "13px" }}>
                      🛡️ Statut d'Exécution du Moteur Normatif Immuable (PATCH NORM-01, NORM-02, NORM-02-R1)
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#CBD5E1" }}>
                      Validations déterministes actives : Traçabilité des sources (VERIFIED / LICENSED), Rejet des données calculées/artificielles, Distinction stricte entre standards de dimensionnement et codes de calcul (ASME B31.3 vs B36.10M), et vérification de non-conversion NPS ↔ DN.
                    </p>
                  </div>

                  {/* RESULTS NORM-01 */}
                  {normativeEngineTestRes && (
                    <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                      <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px", marginBottom: "8px" }}>
                        Core Standards Registry Tests (NORM-01) — {normativeEngineTestRes.success ? "PASSED (100%)" : "FAILED"}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontFamily: "monospace", fontSize: "10.5px" }}>
                        {normativeEngineTestRes.results.map((r, idx) => (
                          <div key={idx} style={{ color: r.startsWith("✅") ? "#34D399" : "#F87171" }}>
                            {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RESULTS NORM-02-R1 */}
                  {pipeDimensionalTestRes && (
                    <div style={{ background: "#0F172A", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: "8px", padding: "12px" }}>
                      <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "12px", marginBottom: "8px" }}>
                        Pipe Dimensional Validator &amp; Conditional Rules (NORM-02 &amp; NORM-02-R1) — {pipeDimensionalTestRes.success ? "PASSED (100%)" : "FAILED"}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontFamily: "monospace", fontSize: "10.5px" }}>
                        {pipeDimensionalTestRes.results.slice(0, 16).map((r, idx) => (
                          <div key={idx} style={{ color: r.startsWith("✅") ? "#34D399" : "#F87171", background: "rgba(15, 23, 42, 0.5)", padding: "4px 6px", borderRadius: "4px" }}>
                            {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* MODAL 3: MODALITÉS DE PAIEMENT & RÔLE DE PADDLE / SLICK-PAY */}
          {/* ============================================================ */}
          {activeModal === "payment_terms" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ background: "rgba(14, 165, 233, 0.08)", border: "1px solid rgba(14, 165, 233, 0.25)", borderRadius: "10px", padding: "14px 16px" }}>
                <p style={{ margin: 0, color: "#E0F2FE", fontSize: "13px" }}>
                  <strong>Architecture de Facturation Mondiale Hybride :</strong> PD&amp;I garantit une conformité fiscale et bancaire totale en séparant rigoureusement les paiements internationaux (traités en devises EUR/USD via Paddle) et les paiements nationaux en Algérie (traités en DZD via Slick-Pay / BaridiMob).
                </p>
              </div>

              {/* TABS DE NAVIGATION PAIEMENT */}
              <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(148, 163, 184, 0.2)", paddingBottom: "8px" }}>
                <button
                  type="button"
                  onClick={() => setPaymentTab("paddle")}
                  style={{
                    background: paymentTab === "paddle" ? "#0284C7" : "rgba(15, 23, 42, 0.7)",
                    border: paymentTab === "paddle" ? "1px solid #38BDF8" : "1px solid rgba(148, 163, 184, 0.2)",
                    color: paymentTab === "paddle" ? "#FFFFFF" : "#94A3B8",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  🌐 International (Paddle)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTab("slickpay")}
                  style={{
                    background: paymentTab === "slickpay" ? "#10B981" : "rgba(15, 23, 42, 0.7)",
                    border: paymentTab === "slickpay" ? "1px solid #34D399" : "1px solid rgba(148, 163, 184, 0.2)",
                    color: paymentTab === "slickpay" ? "#FFFFFF" : "#94A3B8",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  🇩🇿 Algérie Uniquement (Slick-Pay)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTab("security")}
                  style={{
                    background: paymentTab === "security" ? "#6366F1" : "rgba(15, 23, 42, 0.7)",
                    border: paymentTab === "security" ? "1px solid #818CF8" : "1px solid rgba(148, 163, 184, 0.2)",
                    color: paymentTab === "security" ? "#FFFFFF" : "#94A3B8",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  🛡️ Sécurité Bancaire &amp; Empreinte CIB
                </button>
              </div>

              {/* SUB-TAB 1: PADDLE */}
              {paymentTab === "paddle" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "10px", padding: "16px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", fontSize: "14px", marginBottom: "6px" }}>
                      🏛️ Rôle de Paddle en tant que Merchant of Record (MoR)
                    </div>
                    <p style={{ margin: "0 0 10px", color: "#CBD5E1" }}>
                      Pour tous nos clients situés hors d'Algérie (France, Union Européenne, Amérique du Nord, Moyen-Orient, Afrique subsaharienne, etc.), les transactions sont opérées par <strong>Paddle.com Inc. / Paddle Payments Ltd.</strong>
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px", color: "#94A3B8" }}>
                      <li><strong style={{ color: "#F8FAFC" }}>Conformité Fiscale &amp; TVA :</strong> Paddle collecte et reverse automatiquement la TVA locale (VAT, Sales Tax, GST) conformément à la législation de votre pays.</li>
                      <li><strong style={{ color: "#F8FAFC" }}>Moyens de Paiement Acceptés :</strong> Cartes bancaires internationales (Visa, MasterCard, American Express), PayPal, Apple Pay, Google Pay et virements bancaires B2B (Wire / SEPA).</li>
                      <li><strong style={{ color: "#F8FAFC" }}>Facturation Automatique :</strong> Émission instantanée de factures officielles au format PDF comportant le numéro de TVA intracommunautaire de votre entreprise.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: SLICK-PAY (ALGERIA ONLY) */}
              {paymentTab === "slickpay" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "10px", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#34D399", fontSize: "14px", marginBottom: "6px" }}>
                      <span>🇩🇿</span>
                      <span>Passerelle Nationale Slick-Pay (BaridiMob &amp; Carte Edahabia / CIB)</span>
                    </div>
                    <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", padding: "6px 10px", marginBottom: "10px", fontSize: "11px", color: "#FCA5A5", fontWeight: 700 }}>
                      ⚠️ RÈGLE DE RESTRICTION STRICTE : L'option Slick-Pay et les paiements en Dinars Algériens (DZD) sont EXCLUSIVEMENT visibles et réservés aux utilisateurs connectés depuis l'Algérie ou ayant sélectionné l'Algérie comme pays d'inscription.
                    </div>
                    <p style={{ margin: "0 0 10px", color: "#CBD5E1" }}>
                      Slick-Pay est l'agrégateur certifié et accrédité par le <strong>GIE Monétique</strong> et <strong>Algérie Poste</strong> permettant le paiement sécurisé instantané en DZD.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px", color: "#94A3B8" }}>
                      <li><strong style={{ color: "#F8FAFC" }}>Carte Edahabia &amp; CIB :</strong> Débit immédiat sécurisé via le protocole 3D Secure / OTP SMS d'Algérie Poste et des banques algériennes (BNA, CPA, BEA, BDR, etc.).</li>
                      <li><strong style={{ color: "#F8FAFC" }}>BaridiMob &amp; Virement RIP :</strong> Possibilité d'effectuer un transfert direct via l'application BaridiMob vers le RIP officiel du logiciel avec validation par clé de transaction.</li>
                      <li><strong style={{ color: "#F8FAFC" }}>Reçu &amp; Facture Fiscale :</strong> Génération de bordereau d'encaissement et facture conforme aux règles de la comptabilité algérienne (avec mentions RC / NIF / NIS / Art).</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: SECURITY & CARDS */}
              {paymentTab === "security" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "10px", padding: "16px" }}>
                    <div style={{ fontWeight: 800, color: "#818CF8", fontSize: "14px", marginBottom: "6px" }}>
                      🔒 Obligation d'Empreinte Bancaire pour l'Essai Gratuit de 30 Jours
                    </div>
                    <p style={{ margin: "0 0 8px", color: "#CBD5E1" }}>
                      Afin de garantir l'accès réservé aux véritables bureaux d'études, ingénieurs et entreprises industrielles, l'activation de la période d'essai de 30 jours (Free Trial) nécessite la saisie et validation d'une empreinte bancaire (Carte CIB/Edahabia en Algérie, Carte Visa/MasterCard à l'international) :
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px", color: "#94A3B8" }}>
                      <li><strong style={{ color: "#F8FAFC" }}>Zéro Débit Immédiat (0,00 DZD / 0,00 €) :</strong> Aucun montant n'est prélevé lors de l'inscription pour l'essai gratuit de 1 mois.</li>
                      <li><strong style={{ color: "#F8FAFC" }}>Contrôle Anti-Fraude :</strong> Une pré-autorisation d'authentification (empreinte cryptographique conforme PCI-DSS Niveau 1) permet de valider la légitimité du compte et de bloquer la création abusive de faux comptes.</li>
                      <li><strong style={{ color: "#F8FAFC" }}>Résiliation en 1 Clic :</strong> Vous pouvez annuler votre formule à tout moment depuis votre tableau de bord avant la fin des 30 jours sans le moindre frais.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(148, 163, 184, 0.15)",
            background: "#080E18",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ fontSize: "11px", color: "#64748B" }}>
            © 2026 ORTHOGONAL - ENG · Tous droits réservés
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "linear-gradient(135deg, #0284C7, #0369A1)",
              border: 0,
              borderRadius: "8px",
              color: "#FFFFFF",
              padding: "8px 20px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
