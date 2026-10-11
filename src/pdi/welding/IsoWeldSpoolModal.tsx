import React, { useState, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Truck,
  Layers,
  Sparkles,
  Printer,
  Sliders,
  ShieldCheck,
  Wrench,
  Download,
  Box,
} from "lucide-react";
import {
  PdiWeldEntry,
  PdiSpoolEntry,
  PdiWeldLocation,
  PdiNdtStatus,
  WeldSpoolResult,
  exportWeldLogCsv,
  exportSpoolScheduleCsv,
} from "./isoWeldSpoolEngine";

interface IsoWeldSpoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  weldSpoolData: WeldSpoolResult;
  onUpdateWeld: (weldId: string, updates: Partial<PdiWeldEntry>) => void;
  onOpenPrintModal?: (mode: "weldMap") => void;
  activeSpoolFilter?: string | null;
  onSelectSpool?: (spoolId: string | null) => void;
  onOpen3DViewer?: (spoolId?: string) => void;
  onSwitchToIso?: () => void;
}

export const IsoWeldSpoolModal: React.FC<IsoWeldSpoolModalProps> = ({
  isOpen,
  onClose,
  weldSpoolData,
  onUpdateWeld,
  onOpenPrintModal,
  activeSpoolFilter,
  onSelectSpool,
  onOpen3DViewer,
  onSwitchToIso,
}) => {
  const [activeTab, setActiveTab] = useState<"welds" | "spools" | "ndt">("welds");
  const [locationFilter, setLocationFilter] = useState<"all" | "shop" | "field" | "golden">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { welds, spools, stats } = weldSpoolData;

  const filteredWelds = useMemo(() => {
    return welds.filter((w) => {
      if (activeSpoolFilter && w.spoolId !== activeSpoolFilter) return false;
      if (locationFilter !== "all" && w.location !== locationFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (w.weldNumber || "").toLowerCase().includes(q) ||
          (w.spoolId || "").toLowerCase().includes(q) ||
          (w.wpsNumber || "").toLowerCase().includes(q) ||
          (w.material || "").toLowerCase().includes(q) ||
          (w.welderId || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [welds, activeSpoolFilter, locationFilter, searchQuery]);

  if (!isOpen) return null;

  const handleExportWelds = () => {
    const csv = exportWeldLogCsv(welds);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `CAHIER_DE_SOUDAGE_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSpools = () => {
    const csv = exportSpoolScheduleCsv(spools);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `CARNET_DE_SPOOLS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[10015] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* En-tête de dialogue */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-wide text-white uppercase">
                  Plan de Soudage & Carnet de Spools
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  ASME B31.3 / EN 13480
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                  {stats.totalWelds} soudures · {stats.totalSpools} spools
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cartographie des joints soudés (Shop vs Field), cahier de préfabrication et suivi CND
              </p>
            </div>
          </div>

          {/* Sélecteur des 3 Rendus Synchronisés */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 gap-1">
            {onSwitchToIso && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToIso();
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1.5"
                title="Basculer vers le Schéma Isométrique 2D (ISO 30°)"
              >
                <span>📐 1. Vue ISO 2D</span>
              </button>
            )}
            <div className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-600 text-white shadow-sm flex items-center gap-1.5 border border-amber-400/40">
              <Flame className="w-3.5 h-3.5 text-amber-200" />
              <span>2. Soudures & Spools</span>
            </div>
            {onOpen3DViewer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpen3DViewer();
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-cyan-300 hover:text-white hover:bg-cyan-950/60 transition-all flex items-center gap-1.5"
                title="Basculer vers la Vue 3D Solide Extrudée & Orbite"
              >
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span>3. 3D Solide Extrudée</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenPrintModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPrintModal("weldMap");
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Imprimer la planche Plan de Soudage avec Cartouche ISO 7200"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer Plan Soudage</span>
              </button>
            )}
            {onOpen3DViewer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpen3DViewer();
                }}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border border-cyan-400/30"
                title="Visualiser le réseau en 3D Solide Extrudé"
              >
                <Box className="w-3.5 h-3.5 text-cyan-200" />
                <span>Vue 3D Solide</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="Masquer / Fermer le carnet de soudures (Hide)"
            >
              <X className="w-4 h-4" />
              <span>Masquer (Hide)</span>
            </button>
          </div>
        </div>

        {/* Barre de navigation d'onglets */}
        <div className="px-6 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("welds")}
              className={`py-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "welds"
                  ? "border-amber-400 text-amber-300 bg-amber-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Cahier de Soudage (Weld Map)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {welds.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("spools")}
              className={`py-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "spools"
                  ? "border-blue-400 text-blue-300 bg-blue-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Carnet de Spools</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {spools.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ndt")}
              className={`py-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "ndt"
                  ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Contrôle CND & Spécifications</span>
            </button>
          </div>

          <div className="flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={handleExportWelds}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Exporter le cahier de soudage au format CSV"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>CSV Soudures</span>
            </button>
            <button
              type="button"
              onClick={handleExportSpools}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Exporter le carnet de spools au format CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
              <span>CSV Spools</span>
            </button>
          </div>
        </div>

        {/* Corps du dialogue */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* BANDEAU DES INDICATEURS CLÉS (KPIS) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Soudures
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{stats.totalWelds}</span>
                <span className="text-[10px] text-slate-400">joints</span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-blue-900/40 rounded-xl p-3">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                Soudures Atelier (W-S)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-400">{stats.shopWeldsCount}</span>
                <span className="text-[10px] text-blue-300/70">
                  {stats.totalWelds ? Math.round((stats.shopWeldsCount / stats.totalWelds) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-red-900/40 rounded-xl p-3">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
                Soudures Chantier (W-F)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-red-400">{stats.fieldWeldsCount}</span>
                <span className="text-[10px] text-red-300/70">
                  {stats.goldenWeldsCount > 0 ? `+${stats.goldenWeldsCount} Or` : "sur site"}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-purple-900/40 rounded-xl p-3">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                Nombre de Spools
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-400">{stats.totalSpools}</span>
                <span className="text-[10px] text-purple-300/70">colis</span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-emerald-900/40 rounded-xl p-3">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Poids Préfabriqué
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">{stats.totalWeightKg}</span>
                <span className="text-[10px] text-emerald-300/70">kg</span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-amber-900/40 rounded-xl p-3">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Gabarit Routier (12m)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400">{stats.transportConformityPct}%</span>
                <span className="text-[10px] text-amber-300/70">conformité</span>
              </div>
            </div>
          </div>

          {/* VUE 1 : TABLEAU DES SOUDURES (WELD MAP) */}
          {activeTab === "welds" && (
            <div className="space-y-4">
              {/* Barre de filtre et de recherche */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Filtrer par type :</span>
                  {(["all", "shop", "field", "golden"] as const).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocationFilter(loc)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        locationFilter === loc
                          ? loc === "shop"
                            ? "bg-blue-600 text-white"
                            : loc === "field"
                            ? "bg-red-600 text-white"
                            : loc === "golden"
                            ? "bg-amber-600 text-white"
                            : "bg-slate-700 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {loc === "all"
                        ? "Toutes"
                        : loc === "shop"
                        ? "Atelier (Shop)"
                        : loc === "field"
                        ? "Chantier (Field)"
                        : "Soudure d'Or"}
                    </button>
                  ))}
                </div>

                {activeSpoolFilter && (
                  <div className="flex items-center gap-2 bg-blue-950/40 border border-blue-800/60 px-3 py-1 rounded-lg">
                    <span className="text-xs text-blue-300">
                      Spool sélectionné : <b>{activeSpoolFilter}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectSpool?.(null)}
                      className="text-xs text-blue-400 hover:text-white font-bold"
                    >
                      (Tout afficher)
                    </button>
                  </div>
                )}

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Recherche soudure, WPS, soudeur..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Tableau interactif du Weld Log */}
              <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <th className="py-3 px-3">Repère</th>
                      <th className="py-3 px-2">Spool</th>
                      <th className="py-3 px-3">Emplacement (Shop / Field)</th>
                      <th className="py-3 px-2">Type</th>
                      <th className="py-3 px-2">DN / NPS</th>
                      <th className="py-3 px-2">Épaisseur</th>
                      <th className="py-3 px-3">Matériau</th>
                      <th className="py-3 px-2">WPS & Procédé</th>
                      <th className="py-3 px-2">Soudeur</th>
                      <th className="py-3 px-3 text-center">Contrôles CND</th>
                      <th className="py-3 px-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredWelds.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500 italic">
                          Aucune soudure ne correspond aux critères sélectionnés.
                        </td>
                      </tr>
                    ) : (
                      filteredWelds.map((weld) => {
                        const isShop = weld.location === "shop";
                        const isGolden = weld.location === "golden";
                        return (
                          <tr
                            key={weld.id}
                            className="hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                              {weld.weldNumber}
                            </td>
                            <td className="py-2.5 px-2 font-mono text-purple-300 font-semibold">
                              <button
                                type="button"
                                onClick={() => onSelectSpool?.(weld.spoolId)}
                                className="hover:underline"
                                title="Filtrer sur ce Spool"
                              >
                                {weld.spoolId}
                              </button>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateWeld(weld.id, {
                                      location: isShop ? "field" : isGolden ? "shop" : "golden",
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                                    isShop
                                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30"
                                      : isGolden
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
                                      : "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                                  }`}
                                  title="Cliquer pour permuter Atelier (Shop) / Chantier (Field) / Soudure d'Or"
                                >
                                  {isShop ? (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                      Atelier (Shop)
                                    </>
                                  ) : isGolden ? (
                                    <>
                                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                      Soudure d'Or
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-1.5 h-1.5 rotate-45 bg-red-400" />
                                      Chantier (Field)
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 font-mono font-bold text-slate-200">
                              {weld.weldType}
                            </td>
                            <td className="py-2.5 px-2 font-mono text-slate-300">
                              DN{weld.dn} ({weld.nps})
                            </td>
                            <td className="py-2.5 px-2 font-mono text-slate-400">
                              {weld.thicknessMm} mm ({weld.schedule})
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 truncate max-w-[140px]" title={weld.material}>
                              {weld.material}
                            </td>
                            <td className="py-2.5 px-2 text-[11px] text-slate-300">
                              <div className="font-mono font-bold text-amber-300/90">{weld.wpsNumber}</div>
                              <div className="text-[10px] text-slate-500">{weld.process}</div>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-slate-300">
                              <input
                                type="text"
                                value={weld.welderId}
                                onChange={(e) => onUpdateWeld(weld.id, { welderId: e.target.value })}
                                className="w-16 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white focus:outline-none focus:border-amber-400"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1 text-[10px] font-mono">
                                <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800" title="Visuel 100%">
                                  VT
                                </span>
                                {weld.cndRequired.rt && (
                                  <span className="px-1 py-0.2 rounded bg-red-950 text-red-300 border border-red-800" title="Radiographie demandée">
                                    RT
                                  </span>
                                )}
                                {weld.cndRequired.ut && (
                                  <span className="px-1 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800" title="Ultrasons">
                                    UT
                                  </span>
                                )}
                                {weld.cndRequired.pt && (
                                  <span className="px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800" title="Ressuage">
                                    PT
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                value={weld.ndtStatus}
                                onChange={(e) => onUpdateWeld(weld.id, { ndtStatus: e.target.value as PdiNdtStatus })}
                                className={`bg-slate-900 border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${
                                  weld.ndtStatus === "accepted"
                                    ? "text-emerald-400 border-emerald-700"
                                    : weld.ndtStatus === "rejected"
                                    ? "text-red-400 border-red-700"
                                    : "text-amber-400 border-amber-700"
                                }`}
                              >
                                <option value="accepted">✓ Conforme</option>
                                <option value="pending">⏳ En cours</option>
                                <option value="rejected">✕ Rejetée</option>
                                <option value="repaired">↺ Réparée</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VUE 2 : CARNET DE SPOOLS (SPOOL SCHEDULE) */}
          {activeTab === "spools" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spools.map((spool) => {
                  const isConform = spool.transportable;
                  return (
                    <div
                      key={spool.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-sm hover:border-slate-700 transition-all"
                    >
                      {/* Bandeau supérieur de couleur Spool */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5"
                        style={{ backgroundColor: spool.color }}
                      />

                      <div className="flex items-start justify-between gap-2 pt-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: spool.color }}
                            />
                            <h3 className="text-sm font-black text-white">{spool.label}</h3>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                              Ligne {spool.lineId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {spool.segmentIds.length} tronçon(s) · {spool.shopWeldIds.length} soudure(s) atelier
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-emerald-400">{spool.estimatedWeightKg} kg</span>
                          <span className="block text-[9px] text-slate-400">{spool.totalLengthM} m linéaires</span>
                        </div>
                      </div>

                      {/* Dimensions d'expédition et jauge gabarit */}
                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Encombrement hors-tout (X × Y × Z) :</span>
                          <span className="font-mono font-bold text-slate-200">
                            {spool.boundingBoxM.dx}m × {spool.boundingBoxM.dy}m × {spool.boundingBoxM.dz}m
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Dimension maximale colis :</span>
                          <span className="font-mono font-black text-white">{spool.boundingBoxM.maxDimM} m</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-300">Gabarit routier (12m) :</span>
                          </div>
                          <span
                            className={`px-2 py-0.2 rounded text-[9px] font-black uppercase ${
                              isConform
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {isConform ? "✓ Conforme transport" : "⚠ Hors Gabarit (>12m)"}
                          </span>
                        </div>
                      </div>

                      {/* Soudures de fermeture chantier associées */}
                      <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                        <span>Liaisons chantier :</span>
                        <span className="font-mono text-red-400 font-bold">
                          {spool.fieldWeldIds.length} soudure(s) de raccordement
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSpool?.(spool.id);
                            setActiveTab("welds");
                          }}
                          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Voir les {spool.shopWeldIds.length} soudures →
                        </button>
                        <div className="flex items-center gap-2">
                          {onOpen3DViewer && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpen3DViewer(spool.id);
                              }}
                              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                              title="Visualiser et isoler ce spool en 3D Solide"
                            >
                              <Box className="w-3 h-3 text-amber-300" />
                              <span>3D Solide</span>
                            </button>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {spool.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VUE 3 : CONTRÔLES CND & SPÉCIFICATIONS NORMES */}
          {activeTab === "ndt" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                      Politique d'inspection CND (ASME B31.3)
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between">
                      <div>
                        <b className="text-white block">Examen Visuel (VT) : 100 %</b>
                        <span className="text-[11px] text-slate-400">
                          Toutes les soudures atelier et chantier sont contrôlées avant toute épreuve.
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        100% EXIGÉ
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between">
                      <div>
                        <b className="text-white block">Contrôle Radiographique (RT) : Échantillonnage & Golden Welds</b>
                        <span className="text-[11px] text-slate-400">
                          Taux standard 10% sur tuyauterie process catégorie normale, 100% sur soudures d'or (Tie-In).
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                        {stats.rtControlRatePct}% PLANIFIÉ
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between">
                      <div>
                        <b className="text-white block">Contrôle Ultrasons (UT / PAUT) : Fortes épaisseurs</b>
                        <span className="text-[11px] text-slate-400">
                          Examen volumique systématique pour diamètres ≥ DN150 ou épaisseurs &gt; 12.7 mm.
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                        DN ≥ 150
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                      Procédés de Soudage & Cahier WPS
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <b className="text-amber-400 font-mono">WPS-B31.3-BW-141/111</b>
                        <span className="text-[10px] text-slate-400">TIG + EE</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Passe de pénétration en TIG (141) avec métal d'apport ER70S-6 + remplissage à l'électrode enrobée basique E7018.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <b className="text-blue-400 font-mono">WPS-SW-02</b>
                        <span className="text-[10px] text-slate-400">Socket Weld ≤ 2"</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Soudure d'angle à l'emboîtement (SW) avec jeu d'expansion thermique obligatoire de 1.6 mm en fond de poche.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <b className="text-purple-400 font-mono">WPS-GOLDEN-WELD-01</b>
                        <span className="text-[10px] text-slate-400">Tie-in sans épreuve hydro</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Procédé 100% TIG haute intégrité, contrôle non destructif 100% RT + 100% UT + Ressuage multicouche.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pied de dialogue */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Moteur de segmentation Spool automatique opérationnel</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
