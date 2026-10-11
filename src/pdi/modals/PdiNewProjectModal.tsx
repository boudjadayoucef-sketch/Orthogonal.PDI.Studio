import React, { useState } from "react";
import {
  Scan,
  Grid,
  FolderOpen,
  X,
  ArrowRight,
  CheckCircle2,
  Compass
} from "lucide-react";

export type PdiProjectMode = "sketch" | "blank" | "cad";

export interface PdiNewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (params: {
    name: string;
    service: string;
    dn: number;
    pressureClass: string;
    material: string;
    mode: "sketch" | "blank" | "cad";
  }) => void;
}

export const PdiNewProjectModal: React.FC<PdiNewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState(`L-${Math.floor(100 + Math.random() * 900)}-PROC-01`);
  const [service, setService] = useState("Procédé Chimique (PROC)");
  const [dn, setDn] = useState<number>(100);
  const [pressureClass, setPressureClass] = useState("300#");
  const [material, setMaterial] = useState("A106-B (Acier Carbone)");
  const [selectedMethod, setSelectedMethod] = useState<"sketch" | "blank" | "cad">("sketch");

  if (!isOpen) return null;

  const handleSubmit = (method: "sketch" | "blank" | "cad") => {
    onCreateProject({
      name: name.trim() || "Nouveau plan ISO",
      service,
      dn,
      pressureClass,
      material,
      mode: method,
    });
    onClose();
  };

  return (
    <div
      className="pdi-modal-backdrop fixed inset-0 z-[100100] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#09090b] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 my-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 30px rgba(0, 0, 0, 0.9)",
        }}
      >
        {/* MODAL HEADER */}
        <div className="relative px-6 py-4 bg-[#0e0e12] border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                PD&amp;I ISOMETRIC STUDIO · NOUVEAU PLAN
              </div>
              <h2 className="text-base sm:text-lg font-black text-white m-0 tracking-tight">
                Nouveau Projet &amp; Ligne de Tuyauterie
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors border border-neutral-800"
            title="Fermer (Échap)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-[#09090b]">
          {/* MÉTHODES DE CRÉATION */}
          <div>
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                Choisissez le Mode de Création
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">PASSERELLE ISO</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* OPTION 1 : CRÉER VIA CROQUIS / SCAN A4-A3 (EN VEDETTE) */}
              <div
                onClick={() => setSelectedMethod("sketch")}
                className={`relative sm:col-span-2 p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  selectedMethod === "sketch"
                    ? "bg-[#0e0e12] border-cyan-400 shadow-lg shadow-cyan-950/40"
                    : "bg-[#0e0e12] border-neutral-800 hover:border-cyan-600/70 hover:bg-[#141418]"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/30">
                    <Scan className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">
                        Créer via Croquis / Scan A4-A3
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-[10px] font-bold text-cyan-300">
                        ⭐ Recommandé Chantier &amp; Relevé
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed max-w-xl">
                      Numérisez ou téléchargez un croquis papier A4/A3, étalonnez l'échelle métrique, vectorisez la tuyauterie et injectez instantanément l'isométrie cotée 2D et le solide 3D.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 w-full md:w-auto flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubmit("sketch");
                    }}
                    className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white text-xs font-black shadow-md shadow-cyan-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                  >
                    <span>Démarrer via Croquis / Scan</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* OPTION 2 : PLAN ISOMÉTRIQUE VIERGE */}
              <div
                onClick={() => setSelectedMethod("blank")}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedMethod === "blank"
                    ? "bg-[#141418] border-cyan-400 shadow-md"
                    : "bg-[#0e0e12] border-neutral-800 hover:border-neutral-700 hover:bg-[#141418]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                    <Grid className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">Plan Isométrique Vierge</h4>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Dessinez directement dans l'éditeur CAO ISO 2D/3D avec grille orthogonale 30° et palette d'accessoires.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubmit("blank");
                    }}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    Ouvrir éditeur vierge <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* OPTION 3 : IMPORTER FICHIER CAD / DXF / PDF */}
              <div
                onClick={() => setSelectedMethod("cad")}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedMethod === "cad"
                    ? "bg-[#141418] border-cyan-400 shadow-md"
                    : "bg-[#0e0e12] border-neutral-800 hover:border-neutral-700 hover:bg-[#141418]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">Importer CAD / DXF / PDF</h4>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Charger un plan DXF, DWG ou PDF d'ingénierie et convertir en modèle ISO déterministe.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubmit("cad");
                    }}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    Importer fichier <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-[#070709] border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Passerelle d'injection automatique vers le moteur ISO V4.8d</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold transition-colors border border-neutral-800"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(selectedMethod)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white text-xs font-black shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 transition-all"
            >
              <span>{selectedMethod === "sketch" ? "Créer via Croquis / Scan A4-A3" : "Valider & Ouvrir le Projet"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
