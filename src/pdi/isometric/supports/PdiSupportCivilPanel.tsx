/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * PALIER 2C : PANNEAU INDUSTRIEL DES SUPPORTS MSS SP-58 & GÉNIE CIVIL
 */

import React, { useState } from "react";
import {
  IsoPipingSupport,
  MSS_SUPPORT_CATALOG,
  MssSupportCode,
  computeCivilMto,
  verifyPipingSpans,
  calculateBasePlateWeight,
  calculateConcreteVolume,
} from "./pdiMssSupportEngine";
import { IsoNode, IsoSegment } from "../types/isoGraphTypes";
import { UnitSystem, formatLength, formatMass } from "../../units/pdiUnitSystem";

interface PdiSupportCivilPanelProps {
  supports: IsoPipingSupport[];
  segments: IsoSegment[];
  nodes?: IsoNode[];
  selectedSupportId: string | null;
  unitSystem: UnitSystem;
  onSelectSupport: (id: string | null) => void;
  onUpdateSupport: (id: string, patch: Partial<IsoPipingSupport>) => void;
  onDeleteSupport: (id: string) => void;
  onAddSupportClick: () => void;
  onExportCivilCsv: () => void;
}

export const PdiSupportCivilPanel: React.FC<PdiSupportCivilPanelProps> = ({
  supports,
  segments,
  nodes = [],
  selectedSupportId,
  unitSystem,
  onSelectSupport,
  onUpdateSupport,
  onDeleteSupport,
  onAddSupportClick,
  onExportCivilCsv,
}) => {
  const [fluidType, setFluidType] = useState<"water" | "gas">("water");
  const [subTab, setSubTab] = useState<"list" | "spans" | "civil_mto">("list");

  const selectedSupport = supports.find((s) => s.id === selectedSupportId) || null;
  const spanResults = verifyPipingSpans(segments, supports, fluidType);
  const civilMto = computeCivilMto(supports);

  const exceededCount = spanResults.filter((r) => r.status === "exceeded").length;

  return (
    <div className="space-y-3 text-xs">
      {/* HEADER AVEC STATS RAPIDES */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase block">Total Supports</span>
          <strong className="text-cyan-300 font-mono text-sm">{supports.length}</strong>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase block">Acier Platines</span>
          <strong className="text-amber-300 font-mono text-sm">{formatMass(civilMto.totalBasePlateWeightKg, unitSystem)}</strong>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase block">Béton Massifs</span>
          <strong className="text-emerald-300 font-mono text-sm">{civilMto.totalConcreteVolumeM3.toFixed(2)} m³</strong>
        </div>
      </div>

      {/* BOUTON D'ACTION AJOUT */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onAddSupportClick}
          className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 shadow-sm"
        >
          <span>＋</span> Placer Support MSS SP-58
        </button>
        <button
          type="button"
          onClick={onExportCivilCsv}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold transition-all"
          title="Exporter MTO Supportage & GC en CSV"
        >
          📥 CSV
        </button>
      </div>

      {/* SOUS-ONGLETS */}
      <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[9px] font-black">
        <button
          type="button"
          onClick={() => setSubTab("list")}
          className={`flex-1 py-1 rounded-md transition-all ${subTab === "list" ? "bg-slate-800 text-cyan-300 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
        >
          Supports ({supports.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("spans")}
          className={`flex-1 py-1 rounded-md transition-all flex items-center justify-center gap-1 ${subTab === "spans" ? "bg-slate-800 text-cyan-300 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
        >
          <span>Portées ASME</span>
          {exceededCount > 0 && (
            <span className="px-1 py-0.2 bg-red-500/80 text-white rounded-full text-[7.5px] font-mono">
              {exceededCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSubTab("civil_mto")}
          className={`flex-1 py-1 rounded-md transition-all ${subTab === "civil_mto" ? "bg-slate-800 text-cyan-300 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
        >
          Génie Civil
        </button>
      </div>

      {/* VUE 1 : LISTE DES SUPPORTS ET ÉDITION */}
      {subTab === "list" && (
        <div className="space-y-2">
          <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-2 space-y-1.5 max-h-48 overflow-y-auto">
            {supports.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-[10px]">
                Aucun support placé sur le réseau.<br />
                Cliquez sur <b>Placer Support</b> ou tapez <code>SUPPORT</code> en ligne de commande.
              </div>
            ) : (
              supports.map((sup) => {
                const def = MSS_SUPPORT_CATALOG[sup.type] || MSS_SUPPORT_CATALOG.mss_type_35;
                const isSelected = selectedSupportId === sup.id;
                return (
                  <div
                    key={sup.id}
                    onClick={() => onSelectSupport(sup.id)}
                    className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-slate-800/90 border-amber-500/80 text-amber-200"
                        : "bg-slate-900/80 border-slate-800/70 hover:border-slate-700 text-slate-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[10.5px] text-cyan-300 font-mono">{sup.tag}</span>
                        <span className="px-1 py-0.2 bg-slate-800 text-slate-400 text-[8px] rounded border border-slate-700 font-mono">
                          MSS-{def.mssStandardNumber}
                        </span>
                      </div>
                      <span className="text-[8.5px] text-slate-400 block truncate">{def.labelFr}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8.5px] text-emerald-400 font-mono block">{sup.distanceFromFromNodeM.toFixed(2)} m</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSupport(sup.id);
                        }}
                        className="text-slate-500 hover:text-red-400 text-[9px] px-1"
                        title="Supprimer support"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DÉTAILS DU SUPPORT SÉLECTIONNÉ */}
          {selectedSupport && (
            <div className="border border-amber-500/40 rounded-xl bg-slate-950 p-2.5 space-y-2 text-[10px]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <strong className="text-amber-300 font-mono">{selectedSupport.tag} — Propriétés</strong>
                <button
                  type="button"
                  onClick={() => onSelectSupport(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Tag</label>
                  <input
                    type="text"
                    value={selectedSupport.tag}
                    onChange={(e) => onUpdateSupport(selectedSupport.id, { tag: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-[9px]"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Type MSS SP-58</label>
                  <select
                    value={selectedSupport.type}
                    onChange={(e) => onUpdateSupport(selectedSupport.id, { type: e.target.value as MssSupportCode })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-slate-100 text-[8.5px]"
                  >
                    {Object.values(MSS_SUPPORT_CATALOG).map((def) => (
                      <option key={def.code} value={def.code}>
                        MSS-{def.mssStandardNumber} : {def.labelFr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* POSITION & COTE SUR LE TRONÇON */}
              <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div>
                  <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Distance sur tube (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={selectedSupport.distanceFromFromNodeM || 0}
                    onChange={(e) => {
                      const distM = Math.max(0, Number(e.target.value) || 0);
                      const seg = segments.find(s => s.id === selectedSupport.segmentId);
                      if (seg) {
                        const fn = nodes.find(n => n.id === seg.fromNodeId);
                        const tn = nodes.find(n => n.id === seg.toNodeId);
                        const segLen = seg.length || 1;
                        const t = Math.max(0.01, Math.min(0.99, distM / segLen));
                        if (fn && tn) {
                          const wx = Number((fn.x + t * (tn.x - fn.x)).toFixed(3));
                          const wy = Number((fn.y + t * (tn.y - fn.y)).toFixed(3));
                          const wz = Number(((fn.z || 0) + t * ((tn.z || 0) - (fn.z || 0))).toFixed(3));
                          onUpdateSupport(selectedSupport.id, {
                            distanceFromFromNodeM: distM,
                            tRatio: t,
                            worldPos: { x: wx, y: wy, z: wz },
                            elevationZ: wz,
                          });
                        }
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-cyan-300 font-mono text-[9px]"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-slate-400 uppercase font-bold block mb-0.5">Élévation Z (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedSupport.worldPos?.z ?? selectedSupport.elevationZ ?? 0}
                    onChange={(e) => {
                      const z = Number(e.target.value) || 0;
                      onUpdateSupport(selectedSupport.id, {
                        worldPos: { ...(selectedSupport.worldPos || { x: 0, y: 0, z: 0 }), z },
                        elevationZ: z,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-[9px]"
                  />
                </div>
              </div>

              {/* SECTION GÉNIE CIVIL DU SUPPORT */}
              <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-2 space-y-1.5">
                <span className="text-[8.5px] font-black text-cyan-300 uppercase block tracking-wider">
                  Génie Civil & Ancrage (EN 1992-4)
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-[8.5px]">
                  <div>
                    <label className="text-[7.5px] text-slate-400 block">Platine L × W (mm)</label>
                    <div className="flex gap-0.5">
                      <input
                        type="number"
                        min="50"
                        step="10"
                        value={selectedSupport.civilSpec.basePlateLengthMm}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 100;
                          const w = selectedSupport.civilSpec.basePlateWidthMm;
                          const t = selectedSupport.civilSpec.basePlateThicknessMm;
                          onUpdateSupport(selectedSupport.id, {
                            civilSpec: {
                              ...selectedSupport.civilSpec,
                              basePlateLengthMm: val,
                              calculatedPlateWeightKg: calculateBasePlateWeight(val, w, t),
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono"
                      />
                      <input
                        type="number"
                        min="50"
                        step="10"
                        value={selectedSupport.civilSpec.basePlateWidthMm}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 100;
                          const l = selectedSupport.civilSpec.basePlateLengthMm;
                          const t = selectedSupport.civilSpec.basePlateThicknessMm;
                          onUpdateSupport(selectedSupport.id, {
                            civilSpec: {
                              ...selectedSupport.civilSpec,
                              basePlateWidthMm: val,
                              calculatedPlateWeightKg: calculateBasePlateWeight(l, val, t),
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[7.5px] text-slate-400 block">Épaisseur (mm)</label>
                    <input
                      type="number"
                      min="5"
                      step="1"
                      value={selectedSupport.civilSpec.basePlateThicknessMm}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 10;
                        const l = selectedSupport.civilSpec.basePlateLengthMm;
                        const w = selectedSupport.civilSpec.basePlateWidthMm;
                        onUpdateSupport(selectedSupport.id, {
                          civilSpec: {
                            ...selectedSupport.civilSpec,
                            basePlateThicknessMm: val,
                            calculatedPlateWeightKg: calculateBasePlateWeight(l, w, val),
                          },
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[7.5px] text-slate-400 block">Poids Platine</label>
                    <span className="font-mono text-amber-300 font-bold block pt-1">
                      {selectedSupport.civilSpec.calculatedPlateWeightKg} kg
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[8.5px] pt-1">
                  <div>
                    <label className="text-[7.5px] text-slate-400 block">Tiges d'ancrage</label>
                    <div className="flex gap-1">
                      <select
                        value={selectedSupport.civilSpec.anchorDiameter}
                        onChange={(e) =>
                          onUpdateSupport(selectedSupport.id, {
                            civilSpec: { ...selectedSupport.civilSpec, anchorDiameter: e.target.value as any },
                          })
                        }
                        className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[8px]"
                      >
                        <option value="M10">M10</option>
                        <option value="M12">M12</option>
                        <option value="M16">M16</option>
                        <option value="M20">M20</option>
                        <option value="M24">M24</option>
                        <option value="M30">M30</option>
                      </select>
                      <input
                        type="number"
                        min="2"
                        max="8"
                        step="2"
                        value={selectedSupport.civilSpec.anchorCount}
                        onChange={(e) =>
                          onUpdateSupport(selectedSupport.id, {
                            civilSpec: { ...selectedSupport.civilSpec, anchorCount: Number(e.target.value) || 4 },
                          })
                        }
                        className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono text-[8px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[7.5px] text-slate-400 block">Massif Béton L×W×H (m)</label>
                    <div className="flex gap-0.5">
                      <input
                        type="number"
                        min="0.2"
                        step="0.1"
                        value={selectedSupport.civilSpec.foundationLengthM}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0.5;
                          const w = selectedSupport.civilSpec.foundationWidthM;
                          const h = selectedSupport.civilSpec.foundationHeightM;
                          onUpdateSupport(selectedSupport.id, {
                            civilSpec: {
                              ...selectedSupport.civilSpec,
                              foundationLengthM: val,
                              calculatedConcreteVolumeM3: calculateConcreteVolume(val, w, h),
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono text-[8px]"
                      />
                      <input
                        type="number"
                        min="0.2"
                        step="0.1"
                        value={selectedSupport.civilSpec.foundationWidthM}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0.5;
                          const l = selectedSupport.civilSpec.foundationLengthM;
                          const h = selectedSupport.civilSpec.foundationHeightM;
                          onUpdateSupport(selectedSupport.id, {
                            civilSpec: {
                              ...selectedSupport.civilSpec,
                              foundationWidthM: val,
                              calculatedConcreteVolumeM3: calculateConcreteVolume(l, val, h),
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono text-[8px]"
                      />
                      <input
                        type="number"
                        min="0.2"
                        step="0.1"
                        value={selectedSupport.civilSpec.foundationHeightM}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0.4;
                          const l = selectedSupport.civilSpec.foundationLengthM;
                          const w = selectedSupport.civilSpec.foundationWidthM;
                          onUpdateSupport(selectedSupport.id, {
                            civilSpec: {
                              ...selectedSupport.civilSpec,
                              foundationHeightM: val,
                              calculatedConcreteVolumeM3: calculateConcreteVolume(l, w, val),
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono text-[8px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VUE 2 : CONTRÔLE DES PORTÉES ASME B31.3 */}
      {subTab === "spans" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-[9px]">
            <span className="text-slate-400 font-bold">Fluide / Remplissage :</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setFluidType("water")}
                className={`px-2 py-0.5 rounded transition-all font-mono ${fluidType === "water" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"}`}
              >
                Eau / Liquide
              </button>
              <button
                type="button"
                onClick={() => setFluidType("gas")}
                className={`px-2 py-0.5 rounded transition-all font-mono ${fluidType === "gas" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"}`}
              >
                Vapeur / Gaz
              </button>
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-2 space-y-1.5 max-h-56 overflow-y-auto">
            {spanResults.map((res, i) => (
              <div
                key={res.segmentId}
                className={`p-2 rounded-lg border text-[9px] space-y-1 ${
                  res.status === "exceeded"
                    ? "bg-red-950/30 border-red-800/80 text-red-200"
                    : res.status === "warning"
                    ? "bg-amber-950/30 border-amber-800/80 text-amber-200"
                    : "bg-slate-900/60 border-slate-800 text-slate-300"
                }`}
              >
                <div className="flex justify-between items-center font-mono">
                  <span className="font-bold text-slate-100">Tronçon #{i + 1} (DN{res.dn})</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[8px] ${
                      res.status === "exceeded"
                        ? "bg-red-600 text-white"
                        : res.status === "warning"
                        ? "bg-amber-600 text-white"
                        : "bg-emerald-700 text-white"
                    }`}
                  >
                    {res.status === "exceeded" ? "DÉPASSÉ" : res.status === "warning" ? "ATTENTION" : "CONFORME"}
                  </span>
                </div>
                <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                  <span>Portée max : {res.longestSpanFoundM.toFixed(2)} m</span>
                  <span>Admissible : {res.maxSpanAdmissibleM.toFixed(2)} m</span>
                </div>
                <div className="text-[7.5px] opacity-85 leading-tight">{res.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VUE 3 : QUANTITATIFS GÉNIE CIVIL CUMULÉS */}
      {subTab === "civil_mto" && (
        <div className="space-y-2 text-[9.5px]">
          <div className="border border-slate-800 rounded-xl bg-slate-950/80 p-2.5 space-y-2">
            <span className="font-black text-cyan-300 uppercase tracking-wider block border-b border-slate-800 pb-1">
              BOM Génie Civil & Métallerie (MSS SP-58)
            </span>

            <div className="space-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Total supports :</span>
                <span className="font-mono font-bold text-slate-100">{civilMto.totalSupportsCount} u</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Poids acier platines :</span>
                <span className="font-mono font-bold text-amber-300">{civilMto.totalBasePlateWeightKg} kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Volume béton massifs :</span>
                <span className="font-mono font-bold text-emerald-300">{civilMto.totalConcreteVolumeM3} m³</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Tiges d'ancrage totales :</span>
                <span className="font-mono font-bold text-cyan-300">{civilMto.totalAnchorsCount} tiges</span>
              </div>

              {/* Détail par diamètre de cheville */}
              <div className="pt-1">
                <span className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Détail par goujon</span>
                <div className="grid grid-cols-3 gap-1 text-[8px] font-mono">
                  {Object.entries(civilMto.anchorsByDiameter).map(([dia, count]) => (
                    <div key={dia} className="bg-slate-900 p-1 rounded border border-slate-800 text-center">
                      <span className="text-slate-400 block">{dia}</span>
                      <strong className="text-slate-200">{count} u</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
