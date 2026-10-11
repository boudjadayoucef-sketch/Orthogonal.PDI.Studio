/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-TO-ISO ENGINE — STEP 3: INTERACTIVE REVIEW & CORRECTION TABLE (VALIDATION PRÉ-IMPORT)
 */
import React, { useState } from "react";
import {
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting
} from "./sketchRasterEngine";
import {
  SketchLearningProfile,
  learnSketchAbbreviation
} from "./sketchStorage";

export interface SketchReviewTableProps {
  nodes: SketchVectorNode[];
  segments: SketchVectorSegment[];
  fittings: SketchVectorFitting[];
  profile: SketchLearningProfile;
  calibrationScale: number; // px par mm
  onNodesChange: (nodes: SketchVectorNode[]) => void;
  onSegmentsChange: (segments: SketchVectorSegment[]) => void;
  onFittingsChange: (fittings: SketchVectorFitting[]) => void;
  onProfileChange: (profile: SketchLearningProfile) => void;
}

export const SketchReviewTable: React.FC<SketchReviewTableProps> = ({
  nodes,
  segments,
  fittings,
  profile,
  calibrationScale,
  onNodesChange,
  onSegmentsChange,
  onFittingsChange,
  onProfileChange
}) => {
  const [activeTab, setActiveTab] = useState<"segments" | "fittings" | "nodes" | "dictionary">("segments");
  const [newAbbrCode, setNewAbbrCode] = useState("");
  const [newAbbrTarget, setNewAbbrTarget] = useState("");

  // Update a single segment's property
  const updateSegment = (id: string, patch: Partial<SketchVectorSegment>) => {
    onSegmentsChange(
      segments.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  // Delete segment
  const deleteSegment = (id: string) => {
    onSegmentsChange(segments.filter((s) => s.id !== id));
  };

  // Update fitting
  const updateFitting = (id: string, patch: Partial<SketchVectorFitting>) => {
    onFittingsChange(
      fittings.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  // Delete fitting
  const deleteFitting = (id: string) => {
    onFittingsChange(fittings.filter((f) => f.id !== id));
  };

  // Update node
  const updateNode = (id: string, patch: Partial<SketchVectorNode>) => {
    onNodesChange(
      nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
    );
  };

  // Delete node
  const deleteNode = (id: string) => {
    onNodesChange(nodes.filter((n) => n.id !== id));
    // Also remove connected segments
    onSegmentsChange(segments.filter((s) => s.fromNodeId !== id && s.toNodeId !== id));
  };

  // Handle new abbreviation learning
  const handleAddAbbreviation = () => {
    if (!newAbbrCode.trim() || !newAbbrTarget.trim()) return;
    const updated = learnSketchAbbreviation(newAbbrCode, newAbbrTarget);
    onProfileChange(updated);
    setNewAbbrCode("");
    setNewAbbrTarget("");
  };

  // Check topological errors (disconnected nodes / zero-length)
  const validationErrors: string[] = [];
  if (nodes.length > 0 && segments.length === 0) {
    validationErrors.push("Des nœuds ont été placés mais aucun tronçon de tuyauterie n'est relié.");
  }
  nodes.forEach((n) => {
    const isConnected = segments.some((s) => s.fromNodeId === n.id || s.toNodeId === n.id);
    if (!isConnected) {
      validationErrors.push(`Nœud #${n.id.slice(-4)} orphelin (non connecté à une ligne de tuyauterie).`);
    }
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#080F18",
        borderLeft: "1px solid #1E293B",
        color: "#F8FAFC",
        fontFamily: "Inter, sans-serif"
      }}
    >
      {/* Header & Tabs */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1E293B", background: "#0F172A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#38BDF8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            📋 Table de Révision Pré-Import
          </h4>
          <span style={{ fontSize: 11, color: "#94A3B8" }}>
            {segments.length} tronçons • {fittings.length} accessoires
          </span>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "segments", label: `Tronçons (${segments.length})` },
            { id: "fittings", label: `Accessoires (${fittings.length})` },
            { id: "nodes", label: `Nœuds (${nodes.length})` },
            { id: "dictionary", label: `Dictionnaire (${Object.keys(profile.abbreviations || {}).length})` }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 6,
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                background: activeTab === t.id ? "#0284C7" : "#1E293B",
                color: activeTab === t.id ? "#FFFFFF" : "#94A3B8"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Validation Warnings if any */}
      {validationErrors.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.25)", padding: "8px 12px" }}>
          {validationErrors.slice(0, 2).map((err, idx) => (
            <div key={idx} style={{ fontSize: 11, color: "#F87171", display: "flex", alignItems: "center", gap: 6 }}>
              <span>⚠️</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content Container */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {/* TAB 1: SEGMENTS / PIPES */}
        {activeTab === "segments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {segments.map((seg, idx) => {
              const n1 = nodes.find((n) => n.id === seg.fromNodeId);
              const n2 = nodes.find((n) => n.id === seg.toNodeId);
              const autoLengthMm = n1 && n2 && calibrationScale > 0
                ? Math.round(Math.hypot(n2.x - n1.x, n2.y - n1.y) / calibrationScale)
                : 1000;

              return (
                <div
                  key={seg.id}
                  style={{
                    background: "#0F172A",
                    border: "1px solid #1E293B",
                    borderRadius: 8,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#38BDF8" }}>
                      Tronçon #{idx + 1} • {seg.angleIsoDeg || 0}° ISO
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSegment(seg.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#EF4444",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 700
                      }}
                      title="Supprimer ce tronçon"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#94A3B8", display: "block", marginBottom: 2 }}>
                        Diamètre (DN mm)
                      </label>
                      <select
                        value={seg.nominalDiameter || 150}
                        onChange={(e) => updateSegment(seg.id, { nominalDiameter: Number(e.target.value) })}
                        style={{
                          width: "100%",
                          background: "#020617",
                          border: "1px solid #334155",
                          color: "#F8FAFC",
                          padding: "4px 6px",
                          borderRadius: 6,
                          fontSize: 11
                        }}
                      >
                        {[15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600].map((dn) => (
                          <option key={dn} value={dn}>DN {dn} ({dn} mm)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 10, color: "#94A3B8", display: "block", marginBottom: 2 }}>
                        Pression (PN / Class)
                      </label>
                      <select
                        value={seg.pressureClass || "Class 300"}
                        onChange={(e) => updateSegment(seg.id, { pressureClass: e.target.value })}
                        style={{
                          width: "100%",
                          background: "#020617",
                          border: "1px solid #334155",
                          color: "#F8FAFC",
                          padding: "4px 6px",
                          borderRadius: 6,
                          fontSize: 11
                        }}
                      >
                        {["PN 10", "PN 16", "PN 20", "PN 25", "PN 40", "PN 50", "PN 100", "Class 150", "Class 300", "Class 600", "Class 900"].map((pn) => (
                          <option key={pn} value={pn}>{pn}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 10, color: "#94A3B8", display: "block", marginBottom: 2 }}>
                        Longueur réelle (mm)
                      </label>
                      <input
                        type="number"
                        value={seg.lengthMm || autoLengthMm}
                        onChange={(e) => updateSegment(seg.id, { lengthMm: Number(e.target.value) })}
                        style={{
                          width: "100%",
                          background: "#020617",
                          border: "1px solid #334155",
                          color: "#F8FAFC",
                          padding: "4px 6px",
                          borderRadius: 6,
                          fontSize: 11
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 10, color: "#94A3B8", display: "block", marginBottom: 2 }}>
                        Nuance d'Acier / Matière
                      </label>
                      <input
                        type="text"
                        value={seg.material || "Acier API 5L Gr. B"}
                        onChange={(e) => updateSegment(seg.id, { material: e.target.value })}
                        style={{
                          width: "100%",
                          background: "#020617",
                          border: "1px solid #334155",
                          color: "#F8FAFC",
                          padding: "4px 6px",
                          borderRadius: 6,
                          fontSize: 11
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {segments.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: "#64748B", fontSize: 12 }}>
                Aucun tronçon tracé. Cliquez sur le canevas avec l'outil <b>Tuyau</b> pour tracer votre réseau.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FITTINGS / ACCESSOIRES */}
        {activeTab === "fittings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fittings.map((fit, idx) => (
              <div
                key={fit.id}
                style={{
                  background: "#0F172A",
                  border: "1px solid #1E293B",
                  borderRadius: 8,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#F43F5E" }}>
                    Accessoire #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteFitting(fit.id)}
                    style={{ background: "transparent", border: "none", color: "#EF4444", fontSize: 12, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#94A3B8", display: "block", marginBottom: 2 }}>
                      Type d'accessoire
                    </label>
                    <select
                      value={fit.type}
                      onChange={(e) => updateFitting(fit.id, { type: e.target.value as any })}
                      style={{
                        width: "100%",
                        background: "#020617",
                        border: "1px solid #334155",
                        color: "#F8FAFC",
                        padding: "4px 6px",
                        borderRadius: 6,
                        fontSize: 11
                      }}
                    >
                      <option value="valve">Vanne Passage Total</option>
                      <option value="check_valve">Clapet Anti-retour</option>
                      <option value="flange">Bride WN (Welding Neck)</option>
                      <option value="elbow_90">Coude 90°</option>
                      <option value="elbow_45">Coude 45°</option>
                      <option value="tee">Té égal</option>
                      <option value="reducer">Réduction Concentrique</option>
                      <option value="instrument">Prise Pression / Temp.</option>
                      <option value="support">Support de Tuyauterie</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 10, color: "#94A3B8", display: "block", marginBottom: 2 }}>
                      Repère / Tag
                    </label>
                    <input
                      type="text"
                      value={fit.label || ""}
                      placeholder="ex: V-101"
                      onChange={(e) => updateFitting(fit.id, { label: e.target.value })}
                      style={{
                        width: "100%",
                        background: "#020617",
                        border: "1px solid #334155",
                        color: "#F8FAFC",
                        padding: "4px 6px",
                        borderRadius: 6,
                        fontSize: 11
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {fittings.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: "#64748B", fontSize: 12 }}>
                Aucun accessoire posé sur le réseau.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NODES / POINTS */}
        {activeTab === "nodes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {nodes.map((node, idx) => (
              <div
                key={node.id}
                style={{
                  background: "#0F172A",
                  border: "1px solid #1E293B",
                  borderRadius: 8,
                  padding: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#38BDF8" }}>
                    Nœud #{idx + 1}
                  </span>
                  <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace" }}>
                    X: {node.x}px • Y: {node.y}px
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    value={node.elevation || 0}
                    placeholder="Z (mm)"
                    onChange={(e) => updateNode(node.id, { elevation: Number(e.target.value) })}
                    style={{
                      width: 70,
                      background: "#020617",
                      border: "1px solid #334155",
                      color: "#F8FAFC",
                      padding: "3px 6px",
                      borderRadius: 6,
                      fontSize: 11
                    }}
                    title="Élévation Z en mm"
                  />
                  <button
                    type="button"
                    onClick={() => deleteNode(node.id)}
                    style={{ background: "transparent", border: "none", color: "#EF4444", fontSize: 12, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: APPRENTISSAGE CALLIGRAPHIQUE & DICTIONNAIRE */}
        {activeTab === "dictionary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, padding: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#10B981", display: "block", marginBottom: 6 }}>
                ➕ Apprendre une nouvelle abréviation
              </span>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Ex: VPT, V.P, CL300"
                  value={newAbbrCode}
                  onChange={(e) => setNewAbbrCode(e.target.value)}
                  style={{
                    flex: 1,
                    background: "#020617",
                    border: "1px solid #334155",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 11
                  }}
                />
                <input
                  type="text"
                  placeholder="Signification (ex: vanne_passage_total)"
                  value={newAbbrTarget}
                  onChange={(e) => setNewAbbrTarget(e.target.value)}
                  style={{
                    flex: 1.5,
                    background: "#020617",
                    border: "1px solid #334155",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 11
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddAbbreviation}
                  style={{
                    background: "#059669",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  Ajouter
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700 }}>
                Abréviations et calligraphies enregistrées :
              </span>
              {Object.entries(profile.abbreviations || {}).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "#020617",
                    border: "1px solid #1E293B",
                    padding: "5px 8px",
                    borderRadius: 6,
                    fontSize: 11
                  }}
                >
                  <span style={{ fontWeight: 800, color: "#38BDF8" }}>{k}</span>
                  <span style={{ color: "#94A3B8" }}>→ {v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
