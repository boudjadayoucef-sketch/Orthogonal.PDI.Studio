/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * UNIVERSAL PROPERTY INSPECTOR (CAO & TUYAUTERIE)
 * 
 * Inspecteur de propriétés unifié pour TOUTES les entités du système CAO :
 * Vannes, Tés, Coudes, Brides, Tubes, Nœuds, Supports MSS SP-58, Dessin 2D.
 * 
 * Structure universelle conforme :
 * ├─ identité
 * ├─ géométrie
 * ├─ connexion
 * ├─ DN
 * ├─ PN
 * ├─ matériau
 * ├─ service
 * ├─ spec
 * ├─ tag
 * ├─ fabrication
 * └─ documentation
 * + Propriétés spécifiques par type
 */

import React, { useState } from "react";
import {
  Tag,
  Hash,
  Compass,
  Link,
  Layers,
  FileText,
  RotateCw,
  FlipHorizontal,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Wrench,
  BookOpen,
  Activity,
  Maximize2,
  CheckCircle2,
} from "lucide-react";
import {
  PdiUniversalEntity,
  INDUSTRIAL_STANDARD_DNS,
  STANDARD_PRESSURE_CLASSES,
  STANDARD_MATERIALS,
  STANDARD_SCHEDULES,
} from "../../model/pdiUniversalEntity";

interface PdiUniversalPropertyInspectorProps {
  entity: PdiUniversalEntity;
  onChange: (updated: PdiUniversalEntity) => void;
  onRotate?: (deltaDeg: number) => void;
  onFlip?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export const PdiUniversalPropertyInspector: React.FC<PdiUniversalPropertyInspectorProps> = ({
  entity,
  onChange,
  onRotate,
  onFlip,
  onDuplicate,
  onDelete,
  onClose,
}) => {
  // Accordion sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    geometry: true,
    dn: true,
    pn: true,
    material: true,
    connection: false,
    service: false,
    spec: false,
    tag: false,
    fabrication: false,
    documentation: false,
    specific: true,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const updateEntity = (updater: (prev: PdiUniversalEntity) => PdiUniversalEntity) => {
    onChange(updater(entity));
  };

  const categoryColor: Record<string, string> = {
    pipe: "text-sky-400 bg-sky-950/60 border-sky-800",
    valve: "text-emerald-400 bg-emerald-950/60 border-emerald-800",
    fitting: "text-amber-400 bg-amber-950/60 border-amber-800",
    flange: "text-indigo-400 bg-indigo-950/60 border-indigo-800",
    node: "text-purple-400 bg-purple-950/60 border-purple-800",
    support: "text-rose-400 bg-rose-950/60 border-rose-800",
    cad2d: "text-teal-400 bg-teal-950/60 border-teal-800",
    equipment: "text-cyan-400 bg-cyan-950/60 border-cyan-800",
  };

  const badgeStyle = categoryColor[entity.identity.category] || "text-slate-300 bg-slate-800 border-slate-700";

  return (
    <div className="flex flex-col h-full bg-slate-900/95 text-slate-200 text-xs select-none">
      {/* HEADER : ENTITÉ & ACTIONS RAPIDES */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${badgeStyle}`}>
              {entity.identity.category}
            </span>
            <span className="font-bold text-slate-100 truncate text-xs" title={entity.identity.name}>
              {entity.identity.name || entity.identity.id}
            </span>
          </div>
          <span className="font-mono text-[9px] text-slate-500 shrink-0">
            {entity.identity.id.slice(0, 10)}
          </span>
        </div>

        {/* Action quick buttons */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {onRotate && (
            <button
              type="button"
              onClick={() => onRotate(15)}
              className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
              title="Pivoter de +15° (Raccourci: R)"
            >
              <RotateCw className="w-3 h-3 text-cyan-400" />
              +15°
            </button>
          )}
          {onFlip && (
            <button
              type="button"
              onClick={onFlip}
              className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
              title="Inverser / Sens miroir (Raccourci: F)"
            >
              <FlipHorizontal className="w-3 h-3 text-amber-400" />
              Miroir
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
              title="Dupliquer l'élément"
            >
              <Copy className="w-3 h-3 text-emerald-400" />
              Dupliquer
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-2 py-1.5 rounded bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
              title="Supprimer (Suppr / Backspace)"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
              Suppr.
            </button>
          )}
        </div>
      </div>

      {/* ARBORESCENCE UNIVERSELLE DES PROPRIÉTÉS */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {/* 1. IDENTITÉ */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("identity")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-400" />
              <span>Identité</span>
            </div>
            {openSections.identity ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.identity && (
            <div className="p-2.5 space-y-2 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Nom / Libellé</label>
                <input
                  type="text"
                  value={entity.identity.name}
                  onChange={(e) =>
                    updateEntity((prev) => ({
                      ...prev,
                      identity: { ...prev.identity, name: e.target.value },
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-semibold focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">ID Système</label>
                  <input
                    type="text"
                    disabled
                    value={entity.identity.id}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-500 rounded px-2 py-1 font-mono text-[10px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Type Normalisé</label>
                  <input
                    type="text"
                    disabled
                    value={entity.identity.type}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-400 rounded px-2 py-1 font-mono text-[10px]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. GÉOMÉTRIE (Position X, Y, Z, Rotation, Longueur) */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("geometry")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Géométrie & Position</span>
            </div>
            {openSections.geometry ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.geometry && (
            <div className="p-2.5 space-y-2 text-[11px]">
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">X (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={entity.geometry.x}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        geometry: { ...prev.geometry, x: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-center focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Y (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={entity.geometry.y}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        geometry: { ...prev.geometry, y: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-center focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Z / Alti (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={entity.geometry.z}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        geometry: {
                          ...prev.geometry,
                          z: Number(e.target.value),
                          elevation: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-center focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Rotation (°)</label>
                  <input
                    type="number"
                    step="15"
                    value={entity.geometry.rotation || 0}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        geometry: { ...prev.geometry, rotation: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                {entity.geometry.length !== undefined && (
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Longueur (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={entity.geometry.length || 0}
                      onChange={(e) =>
                        updateEntity((prev) => ({
                          ...prev,
                          geometry: { ...prev.geometry, length: Number(e.target.value) },
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. DIAMÈTRE NOMINAL (DN) & RATING (PN) */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("dn")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              <span>Diamètre Nominal (DN) & PN</span>
            </div>
            {openSections.dn ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.dn && (
            <div className="p-2.5 space-y-2.5 text-[11px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">DN Principal</label>
                  <select
                    value={entity.dn.dn}
                    onChange={(e) => {
                      const newDn = Number(e.target.value);
                      const match = INDUSTRIAL_STANDARD_DNS.find((d) => d.dn === newDn);
                      updateEntity((prev) => ({
                        ...prev,
                        dn: {
                          ...prev.dn,
                          dn: newDn,
                          inch: match ? match.inch : `${(newDn / 25.4).toFixed(1)}"`,
                          outerDiameterMm: match ? match.od : Number((newDn * 1.05).toFixed(1)),
                        },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold focus:border-cyan-500 focus:outline-none"
                  >
                    {INDUSTRIAL_STANDARD_DNS.map((d) => (
                      <option key={d.dn} value={d.dn}>
                        DN {d.dn} ({d.inch}) — OD {d.od}mm
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Classe de Pression (PN)</label>
                  <select
                    value={entity.pn.rating}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        pn: { ...prev.pn, rating: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold focus:border-cyan-500 focus:outline-none"
                  >
                    {STANDARD_PRESSURE_CLASSES.map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DN Dérivé si Té réduit ou Piquage */}
              {(entity.identity.type.includes("reduit") || entity.identity.type.includes("piquage") || entity.identity.type.includes("weldolet")) && (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">DN Dérivation / Réduit</label>
                  <select
                    value={entity.dn.reducedDn || entity.dn.dn}
                    onChange={(e) => {
                      const rDn = Number(e.target.value);
                      const match = INDUSTRIAL_STANDARD_DNS.find((d) => d.dn === rDn);
                      updateEntity((prev) => ({
                        ...prev,
                        dn: {
                          ...prev.dn,
                          reducedDn: rDn,
                          reducedInch: match ? match.inch : `${(rDn / 25.4).toFixed(1)}"`,
                        },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold focus:border-amber-500 focus:outline-none"
                  >
                    {INDUSTRIAL_STANDARD_DNS.filter((d) => d.dn <= entity.dn.dn).map((d) => (
                      <option key={d.dn} value={d.dn}>
                        Branche DN {d.dn} ({d.inch})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Diamètre Extérieur :</span>
                  <span className="font-mono font-bold text-slate-200">{entity.dn.outerDiameterMm || "--"} mm</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Pouces (NPS) :</span>
                  <span className="font-mono font-bold text-slate-200">{entity.dn.inch || "--"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. MATÉRIAU & ÉPAISSEUR / SCHEDULE */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("material")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Matériau & Épaisseur (Schedule)</span>
            </div>
            {openSections.material ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.material && (
            <div className="p-2.5 space-y-2 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Nuance Métallurgique</label>
                <select
                  value={entity.material.grade}
                  onChange={(e) =>
                    updateEntity((prev) => ({
                      ...prev,
                      material: { ...prev.material, grade: e.target.value },
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-purple-300 font-semibold focus:border-purple-500 focus:outline-none"
                >
                  {STANDARD_MATERIALS.map((mat) => (
                    <option key={mat} value={mat}>
                      {mat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Schedule / Épaisseur</label>
                  <select
                    value={entity.material.schedule || "SCH 40 / STD"}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        material: { ...prev.material, schedule: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-semibold focus:border-purple-500 focus:outline-none"
                  >
                    {STANDARD_SCHEDULES.map((sch) => (
                      <option key={sch} value={sch}>
                        {sch}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Épaisseur Réelle (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={entity.material.wallThicknessMm || 6.35}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        material: { ...prev.material, wallThicknessMm: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. SERVICE / FLUIDE & SPEC (PMS) */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("service")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Service (Fluide) & PMS (Spec)</span>
            </div>
            {openSections.service ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.service && (
            <div className="p-2.5 space-y-2 text-[11px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Code Service / Fluide</label>
                  <input
                    type="text"
                    value={entity.service.code}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        service: { ...prev.service, code: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="GN, STEAM, H2..."
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-bold uppercase focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Spécification PMS</label>
                  <input
                    type="text"
                    value={entity.spec.pmsCode}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        spec: { ...prev.spec, pmsCode: e.target.value },
                      }))
                    }
                    placeholder="CS-600-01..."
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. TAG & REPÉRAGE */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("tag")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Repérage Tag & Ligne</span>
            </div>
            {openSections.tag ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.tag && (
            <div className="p-2.5 space-y-2 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Tag Industriel (KKS / ISA)</label>
                <input
                  type="text"
                  value={entity.tag.fullTag}
                  onChange={(e) =>
                    updateEntity((prev) => ({
                      ...prev,
                      tag: { ...prev.tag, fullTag: e.target.value },
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-blue-300 font-bold font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 7. FABRICATION & CONTRÔLE CND */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("fabrication")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-rose-400" />
              <span>Fabrication & Soudure</span>
            </div>
            {openSections.fabrication ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.fabrication && (
            <div className="p-2.5 space-y-2 text-[11px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">N° de Spool</label>
                  <input
                    type="text"
                    value={entity.fabrication.spoolNumber || "SP-01"}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        fabrication: { ...prev.fabrication, spoolNumber: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Localisation</label>
                  <select
                    value={entity.fabrication.location}
                    onChange={(e) =>
                      updateEntity((prev) => ({
                        ...prev,
                        fabrication: { ...prev.fabrication, location: e.target.value as any },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold"
                  >
                    <option value="shop">Atelier (Shop)</option>
                    <option value="field">Chantier (Field)</option>
                    <option value="golden">Soudure d'or</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 8. DOCUMENTATION & FOURNISSEUR */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <button
            type="button"
            onClick={() => toggleSection("documentation")}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
              <span>Documentation & Fabricant</span>
            </div>
            {openSections.documentation ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {openSections.documentation && (
            <div className="p-2.5 space-y-2 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Fabricant / Fournisseur</label>
                <input
                  type="text"
                  value={entity.documentation.manufacturer || ""}
                  onChange={(e) =>
                    updateEntity((prev) => ({
                      ...prev,
                      documentation: { ...prev.documentation, manufacturer: e.target.value },
                    }))
                  }
                  placeholder="Cameron, Velan, Vallourec..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Remarques / P&ID</label>
                <textarea
                  rows={2}
                  value={entity.documentation.notes || ""}
                  onChange={(e) =>
                    updateEntity((prev) => ({
                      ...prev,
                      documentation: { ...prev.documentation, notes: e.target.value },
                    }))
                  }
                  placeholder="Notes de fabrication..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-[10px] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 9. PROPRIÉTÉS SPÉCIFIQUES SELON LE TYPE */}
        {entity.specific && (
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
            <button
              type="button"
              onClick={() => toggleSection("specific")}
              className="w-full px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-left font-bold text-slate-200 text-[11px]"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Spécificités du Type ({entity.identity.category})</span>
              </div>
              {openSections.specific ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            {openSections.specific && (
              <div className="p-2.5 space-y-2 text-[11px]">
                {/* Pour Vanne */}
                {entity.identity.category === "valve" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Passage</label>
                        <select
                          value={entity.specific.valve?.flowType || "passage_total"}
                          onChange={(e) =>
                            updateEntity((prev) => ({
                              ...prev,
                              specific: {
                                ...prev.specific,
                                valve: { ...prev.specific.valve, flowType: e.target.value as any },
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        >
                          <option value="passage_total">Passage Total</option>
                          <option value="passage_reduit">Passage Réduit</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Actionneur</label>
                        <select
                          value={entity.specific.valve?.actuatorType || "manuel_volant"}
                          onChange={(e) =>
                            updateEntity((prev) => ({
                              ...prev,
                              specific: {
                                ...prev.specific,
                                valve: { ...prev.specific.valve, actuatorType: e.target.value as any },
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        >
                          <option value="manuel_volant">Volant Manuel</option>
                          <option value="manuel_levier">Levier Manuel</option>
                          <option value="pneumatique">Pneumatique</option>
                          <option value="motorise_electrique">Motorisé Électrique</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* Pour Coude */}
                {entity.identity.type.includes("coude") && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Rayon</label>
                      <select
                        value={entity.specific.elbow?.radiusType || "1.5D_LR"}
                        onChange={(e) =>
                          updateEntity((prev) => ({
                            ...prev,
                            specific: {
                              ...prev.specific,
                              elbow: { ...prev.specific.elbow, radiusType: e.target.value as any },
                            },
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
                      >
                        <option value="1.5D_LR">1.5D (Long Radius LR)</option>
                        <option value="1.0D_SR">1.0D (Short Radius SR)</option>
                        <option value="3D">3D (Grande courbure)</option>
                        <option value="5D">5D (Grand rayon)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Pour Tube */}
                {entity.identity.category === "pipe" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="insulation"
                      checked={!!entity.specific.pipe?.insulation}
                      onChange={(e) =>
                        updateEntity((prev) => ({
                          ...prev,
                          specific: {
                            ...prev.specific,
                            pipe: { ...prev.specific.pipe, insulation: e.target.checked },
                          },
                        }))
                      }
                      className="rounded bg-slate-900 border-slate-700 text-sky-500"
                    />
                    <label htmlFor="insulation" className="text-slate-300 text-xs">
                      Calorifugeage / Isolation thermique (30mm)
                    </label>
                  </div>
                )}

                {/* Pour Dessin CAD 2D */}
                {entity.identity.category === "cad2d" && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Calque (Layer)</label>
                        <select
                          value={entity.specific.cad2d?.layerId || "0"}
                          onChange={(e) =>
                            updateEntity((prev) => ({
                              ...prev,
                              specific: {
                                ...prev.specific,
                                cad2d: { ...prev.specific.cad2d, layerId: e.target.value },
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-[11px]"
                        >
                          <option value="0">Calque 0 (Défaut)</option>
                          <option value="axes">Axes & Lignes de centre</option>
                          <option value="structures">Structures & Génie Civil</option>
                          <option value="cotations">Cotations & Repères</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Style de Ligne</label>
                        <select
                          value={entity.specific.cad2d?.strokeDash || "continuous"}
                          onChange={(e) =>
                            updateEntity((prev) => ({
                              ...prev,
                              specific: {
                                ...prev.specific,
                                cad2d: { ...prev.specific.cad2d, strokeDash: e.target.value as any },
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-[11px]"
                        >
                          <option value="continuous">Continue (Plein)</option>
                          <option value="dashed">Tirets</option>
                          <option value="center">Ligne d'Axe (_._._)</option>
                          <option value="hidden">Ligne Cachée (...)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Couleur Trait</label>
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="color"
                            value={entity.specific.cad2d?.strokeColor || "#38bdf8"}
                            onChange={(e) =>
                              updateEntity((prev) => ({
                                ...prev,
                                specific: {
                                  ...prev.specific,
                                  cad2d: { ...prev.specific.cad2d, strokeColor: e.target.value },
                                },
                              }))
                            }
                            className="w-8 h-6 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-300 font-mono">{entity.specific.cad2d?.strokeColor || "#38bdf8"}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 font-mono">Épaisseur (px)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="10"
                          value={entity.specific.cad2d?.strokeWidth || 1.5}
                          onChange={(e) =>
                            updateEntity((prev) => ({
                              ...prev,
                              specific: {
                                ...prev.specific,
                                cad2d: { ...prev.specific.cad2d, strokeWidth: Number(e.target.value) },
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Remplissage</label>
                        <select
                          value={entity.specific.cad2d?.hatchPattern || "none"}
                          onChange={(e) =>
                            updateEntity((prev) => ({
                              ...prev,
                              specific: {
                                ...prev.specific,
                                cad2d: { ...prev.specific.cad2d, hatchPattern: e.target.value as any },
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-[11px]"
                        >
                          <option value="none">Aucun (Transparent)</option>
                          <option value="solid">Couleur Solide</option>
                          <option value="ansi31">Hachures ANSI 31 (45°)</option>
                          <option value="ansi32">Hachures ANSI 32 (Croisées)</option>
                          <option value="dots">Points serrés</option>
                        </select>
                      </div>
                      {entity.specific.cad2d?.hatchPattern !== "none" && (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Couleur Remplissage</label>
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="color"
                              value={entity.specific.cad2d?.fillColor || "#38bdf833"}
                              onChange={(e) =>
                                updateEntity((prev) => ({
                                  ...prev,
                                  specific: {
                                    ...prev.specific,
                                    cad2d: { ...prev.specific.cad2d, fillColor: e.target.value },
                                  },
                                }))
                              }
                              className="w-8 h-6 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                            />
                            <span className="text-[10px] text-slate-300 font-mono">{entity.specific.cad2d?.fillColor || "none"}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Geometrical properties input / calculated indicators */}
                    <div className="border-t border-slate-800/80 pt-2.5 mt-2.5 space-y-2">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Géométrie de l'Élément</div>
                      {(entity.identity.type === "circle" || entity.identity.type === "arc") && (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Rayon (m)</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.05"
                            value={entity.geometry.radius || 1}
                            onChange={(e) =>
                              updateEntity((prev) => ({
                                ...prev,
                                geometry: { ...prev.geometry, radius: Number(e.target.value) },
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-[11px]"
                          />
                        </div>
                      )}

                      {entity.identity.type === "line" && entity.geometry.points && entity.geometry.points.length >= 2 && (() => {
                        const p1 = entity.geometry.points[0];
                        const p2 = entity.geometry.points[1];
                        const calculatedLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                        const calculatedAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
                        return (
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 bg-slate-900/40 p-2 rounded border border-slate-800 font-mono">
                            <div>
                              <span className="text-slate-400 block">Longueur :</span>
                              <span className="text-amber-300 text-xs font-bold">{calculatedLength.toFixed(3)} m</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Angle :</span>
                              <span className="text-amber-300 text-xs font-bold">{calculatedAngle.toFixed(1)}°</span>
                            </div>
                          </div>
                        );
                      })()}

                      {entity.identity.type === "text" && (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Contenu du Texte</label>
                          <input
                            type="text"
                            value={entity.identity.name || ""}
                            onChange={(e) =>
                              updateEntity((prev) => ({
                                ...prev,
                                identity: { ...prev.identity, name: e.target.value },
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-[11px]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
