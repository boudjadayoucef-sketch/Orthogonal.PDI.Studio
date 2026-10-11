import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db, createNotification } from '../../../../lib/firebase';
import { pdiAlert } from '../../../../pdi/ui/PdiNotice';
import {
  Activity, TrendingUp, Layers, CheckCircle, Clock, AlertTriangle,
  HardHat, Edit3, Save, X, Check, Search, Filter, ChevronDown, ChevronUp,
  FileCheck, Shield, Plus, Trash2, Calendar, Briefcase, Wrench, Building,
  Package, Thermometer, Sliders, Radio, ArrowRightLeft, CheckSquare, RefreshCw, Info
} from 'lucide-react';
import { Project, PlanDeControleItemStatus } from '../../types';
import { STATIC_PLAN_DE_CONTROLE_TASKS, DEFAULT_TRAVAUX_LIGNE, DEFAULT_TRAVAUX_POSTES } from '../../constants';
import { computeProgressFromCanvas, getProjectDisplayLength, isPosteDetenteSeul } from '../../projectUtils';

export interface TravauxTabProps {
  selectedProject: Project;
  hasPrivilege: (key: string) => boolean;
  isEditingMateriel: boolean;
  setIsEditingMateriel: (val: boolean) => void;
  tempMateriel: any;
  setTempMateriel: (val: any) => void;
  travauxProgressTab: 'ligne' | 'postes';
  setTravauxProgressTab: (tab: 'ligne' | 'postes') => void;
  activeTravauxLotId: string;
  setActiveTravauxLotId: (id: string) => void;
  isEditingTravauxProgress: boolean;
  setIsEditingTravauxProgress: (val: boolean) => void;
  tempTravauxLigne: any[];
  setTempTravauxLigne: (val: any[]) => void;
  tempTravauxPostes: any[];
  setTempTravauxPostes: (val: any[]) => void;
  tempLongueur: string;
  setTempLongueur: (val: string) => void;
  expandedPlanDeControleItem: string | null;
  editPlanItemFields: PlanDeControleItemStatus;
  setEditPlanItemFields: React.Dispatch<React.SetStateAction<PlanDeControleItemStatus>>;
  isSavingPlanItem: boolean;
  planDeControleSearch: string;
  setPlanDeControleSearch: (s: string) => void;
  planDeControleFilter: string;
  setPlanDeControleFilter: (f: string) => void;
  handleToggleExpandPlanItem: (ord: string) => void;
  handleSavePlanDeControleItem: (ord: string) => Promise<void>;
  currentUser?: any;
  userProfile?: any;
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
}
export function TravauxTab({
  selectedProject,
  hasPrivilege,
  isEditingMateriel,
  setIsEditingMateriel,
  tempMateriel,
  setTempMateriel,
  travauxProgressTab,
  setTravauxProgressTab,
  activeTravauxLotId,
  setActiveTravauxLotId,
  isEditingTravauxProgress,
  setIsEditingTravauxProgress,
  tempTravauxLigne,
  setTempTravauxLigne,
  tempTravauxPostes,
  setTempTravauxPostes,
  tempLongueur,
  setTempLongueur,
  expandedPlanDeControleItem,
  editPlanItemFields,
  setEditPlanItemFields,
  isSavingPlanItem,
  planDeControleSearch,
  setPlanDeControleSearch,
  planDeControleFilter,
  setPlanDeControleFilter,
  handleToggleExpandPlanItem,
  handleSavePlanDeControleItem,
  currentUser,
  userProfile,
  setProjects,
}: TravauxTabProps) {
  const updateProjectContractField = async (contractKey: string, field: string, value: any, lotId?: string) => {
    if (!selectedProject?.id) return;
    try {
      if (lotId && selectedProject.lots && selectedProject.lots.length > 0) {
        const updatedLots = selectedProject.lots.map(l => {
          if (l.id === lotId) {
            const lotContracts = l.contrats || {};
            const contractObj = (lotContracts as Record<string, any>)[contractKey] || {};
            return {
              ...l,
              contrats: {
                ...lotContracts,
                [contractKey]: {
                  ...contractObj,
                  [field]: value
                }
              }
            };
          }
          return l;
        });
        await setDoc(doc(db, 'projects', selectedProject.id), { lots: updatedLots }, { merge: true });
        return;
      }
      const currentContracts = selectedProject.contrats || {};
      const contractObj = (currentContracts as Record<string, any>)[contractKey] || {};
      const updated = {
        ...currentContracts,
        [contractKey]: {
          ...contractObj,
          [field]: value
        }
      };
      await setDoc(doc(db, 'projects', selectedProject.id), { contrats: updated }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };
  return (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider font-mono">Phase 04 • Travaux & Épreuves</span>
                    <h4 className="font-extrabold text-base text-slate-800">Gestion des Entreprises de Réalisation, Marchés & Plan de Contrôle</h4>
                  </div>

                  {/* Lot Navigation Selector Bar if project has lots */}
                  {selectedProject.lots && selectedProject.lots.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100 shadow-xs">
                      <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider font-mono mr-2 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Sélection du Lot :</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTravauxLotId(null)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeTravauxLotId === null
                            ? "bg-purple-600 text-white shadow-xs"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        <span>Vue Globale (Tous les Lots)</span>
                        <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-900 font-black">
                          Av. {selectedProject.travauxPlanification?.avancementPhysique || 0}%
                        </span>
                      </button>
                      {selectedProject.lots.map((lot, lIdx) => (
                        <button
                          type="button"
                          key={lot.id || lIdx}
                          onClick={() => setActiveTravauxLotId(lot.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTravauxLotId === lot.id
                              ? "bg-purple-600 text-white shadow-xs"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                          <span>{lot.name || `Lot ${lIdx + 1}`}</span>
                          <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                            Av. {lot.avancementPhysique || 0}%
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Prestataires & Entreprises Réalisatrices du Projet / Multi-Lots */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-150">
                      <div>
                        <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-purple-600" />
                          <span>Entreprises de Réalisation & Prestataires du Projet</span>
                        </h5>
                        <p className="text-[10px] text-slate-400">Section 04 • Marchés de Génie Civil (ETB GC), Montage Mécanique (ETB Meca).</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {((selectedProject.lots && selectedProject.lots.length > 0) 
                        ? (activeTravauxLotId 
                            ? selectedProject.lots.filter(l => l.id === activeTravauxLotId) 
                            : selectedProject.lots) 
                        : [
                        {
                          id: "lot-1",
                          name: "Lot Unique (Général)",
                          phase: selectedProject.identity.phase || "Étude",
                          avancementPhysique: selectedProject.travauxPlanification.avancementPhysique || 0,
                          avancementGC: selectedProject.travauxPlanification.avancementGC || 0,
                          avancementMeca: selectedProject.travauxPlanification.avancementMeca || 0,
                          contrats: selectedProject.contrats
                        }
                      ]).map((lot, idx) => {
                        const updateContractField = (contractKey: 'bureauEtude' | 'betEnvironnement' | 'expert' | 'etbGC' | 'etbMeca', field: string, value: any) => {
                          updateProjectContractField(contractKey, field, value, lot.id);
                        };

                        return (
                          <div key={lot.id || idx} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="bg-purple-600 text-white font-black px-2.5 py-1 rounded-lg text-[10px] uppercase font-mono tracking-wider">
                                  {lot.id?.toUpperCase() || `LOT ${idx + 1}`}
                                </span>
                                <h6 className="font-black text-xs text-slate-800">{lot.name || `Lot ${idx + 1}`}</h6>
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 font-bold bg-white px-2.5 py-1 rounded-full border border-slate-200">
                                Phase : {lot.phase || selectedProject.identity.phase || "Non spécifiée"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* 1. Entreprise Génie Civil */}
                              <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100/90 space-y-3">
                                <div className="flex items-center justify-between border-b border-emerald-100/60 pb-2">
                                  <span className="text-[11px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                                    <HardHat className="w-4 h-4 text-emerald-600" />
                                    Entreprise Génie Civil (ETB GC)
                                  </span>
                                  <span className="text-[10px] font-black bg-emerald-100/80 text-emerald-800 px-2.5 py-0.5 rounded-full font-mono">
                                    Av. GC {lot.avancementGC ?? lot.contrats?.etbGC?.avancement ?? 0}%
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5 text-xs">
                                  <div className="col-span-2">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Nom / Raison Sociale / Groupement</label>
                                    <input
                                      type="text"
                                      placeholder="ex: COSIDER GC, BATIMETAL..."
                                      value={lot.contrats?.etbGC?.nom || ""}
                                      onChange={(e) => updateContractField('etbGC', 'nom', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">N° Contrat / Marché</label>
                                    <input
                                      type="text"
                                      placeholder="ex: N° 012/GC/2025"
                                      value={lot.contrats?.etbGC?.ref || ""}
                                      onChange={(e) => updateContractField('etbGC', 'ref', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-mono outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Montant (DA)</label>
                                    <input
                                      type="text"
                                      placeholder="ex: 150 000 000 DA"
                                      value={lot.contrats?.etbGC?.montant || ""}
                                      onChange={(e) => updateContractField('etbGC', 'montant', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-mono outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">ODS / Date Sign.</label>
                                    <input
                                      type="date"
                                      value={lot.contrats?.etbGC?.ods || lot.contrats?.etbGC?.date || ""}
                                      onChange={(e) => updateContractField('etbGC', 'ods', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800 text-xs font-mono outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Délai Exécution</label>
                                    <input
                                      type="text"
                                      placeholder="ex: 6 mois"
                                      value={lot.contrats?.etbGC?.delai || ""}
                                      onChange={(e) => updateContractField('etbGC', 'delai', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                  <div className="col-span-2 pt-2 border-t border-emerald-100 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-emerald-900 uppercase">Avancement Génie Civil (Généré depuis le canevas) :</span>
                                    <div className="flex items-center gap-1.5 bg-emerald-100/90 text-emerald-900 px-3 py-1 rounded-xl font-mono font-black text-xs">
                                      <span>{lot.avancementGC ?? lot.contrats?.etbGC?.avancement ?? 0}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 2. Entreprise Montage Mécanique & Pose */}
                              <div className="p-3.5 bg-purple-50/50 rounded-2xl border border-purple-100/90 space-y-3">
                                <div className="flex items-center justify-between border-b border-purple-100/60 pb-2">
                                  <span className="text-[11px] font-black uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                                    <Wrench className="w-4 h-4 text-purple-600" />
                                    Entreprise Pose & Montage Mécanique
                                  </span>
                                  <span className="text-[10px] font-black bg-purple-100/80 text-purple-800 px-2.5 py-0.5 rounded-full font-mono">
                                    Av. GM {lot.avancementMeca ?? lot.contrats?.etbMeca?.avancement ?? 0}%
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5 text-xs">
                                  <div className="col-span-2">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Nom / Raison Sociale / Groupement</label>
                                    <input
                                      type="text"
                                      placeholder="ex: KANAGHAZ, GTP, SARL MECA..."
                                      value={lot.contrats?.etbMeca?.nom || ""}
                                      onChange={(e) => updateContractField('etbMeca', 'nom', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">N° Contrat / Marché</label>
                                    <input
                                      type="text"
                                      placeholder="ex: N° 088/MECA/2025"
                                      value={lot.contrats?.etbMeca?.ref || ""}
                                      onChange={(e) => updateContractField('etbMeca', 'ref', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-mono outline-none focus:border-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Montant (DA)</label>
                                    <input
                                      type="text"
                                      placeholder="ex: 320 000 000 DA"
                                      value={lot.contrats?.etbMeca?.montant || ""}
                                      onChange={(e) => updateContractField('etbMeca', 'montant', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-mono outline-none focus:border-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">ODS / Date Sign.</label>
                                    <input
                                      type="date"
                                      value={lot.contrats?.etbMeca?.ods || lot.contrats?.etbMeca?.date || ""}
                                      onChange={(e) => updateContractField('etbMeca', 'ods', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800 text-xs font-mono outline-none focus:border-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Délai Exécution</label>
                                    <input
                                      type="text"
                                      placeholder="ex: 8 mois"
                                      value={lot.contrats?.etbMeca?.delai || ""}
                                      onChange={(e) => updateContractField('etbMeca', 'delai', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs outline-none focus:border-purple-500"
                                    />
                                  </div>
                                  <div className="col-span-2 pt-2 border-t border-purple-100 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-purple-900 uppercase">Avancement Mécanique (Généré depuis le canevas) :</span>
                                    <div className="flex items-center gap-1.5 bg-purple-100/90 text-purple-900 px-3 py-1 rounded-xl font-mono font-black text-xs">
                                      <span>{lot.avancementMeca ?? lot.contrats?.etbMeca?.avancement ?? 0}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Physical progress block & validation stats */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide block">Avancement Physique Global</span>
                        <span className="text-2xl font-black text-slate-800">{selectedProject.travauxPlanification.avancementPhysique}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300 shadow-inner mt-2">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-700"
                          style={{ width: `${selectedProject.travauxPlanification.avancementPhysique}%` }}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide block">Conformité Plan de Contrôle</span>
                        {(() => {
                          const completedCount = Object.values(selectedProject.planDeControle || {}).filter(
                            item => item.resultat === 'C' || item.resultatNouveau === 'C'
                          ).length;
                          const percent = Math.round((completedCount / 36) * 100);
                          return (
                            <>
                              <span className="text-2xl font-black text-slate-800">{completedCount} / 36</span>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden border">
                                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black text-green-700 shrink-0">{percent}%</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide block">Organisme de Contrôle Agréé</span>
                        <span className="text-base font-black text-slate-800 bg-white px-3 py-1 border border-slate-200 rounded-xl inline-block mt-1 shadow-xs">
                          {selectedProject.travauxPlanification.essaisReglementaires.organismeControleur || "Non désigné"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Standard Test Section Summary (Épreuves hydrauliques réglementaires) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-purple-50/20 p-4 rounded-2xl border border-purple-100/40">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-700">1 • Épreuve de Résistance (Hydraulique 24h) :</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                          selectedProject.travauxPlanification.essaisReglementaires.epreuveResistance === "Réussie"
                            ? "bg-green-100 text-green-800"
                            : selectedProject.travauxPlanification.essaisReglementaires.epreuveResistance === "En cours"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-slate-100 text-slate-800"
                        }`}>{selectedProject.travauxPlanification.essaisReglementaires.epreuveResistance}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Pression réglementaire maximale maintenue sous contrôle d'enregistreur approuvé.</p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-100 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-700">2 • Épreuve d'Étanchéité (Hydraulique 24h) :</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                          selectedProject.travauxPlanification.essaisReglementaires.epreuveEtancheite === "Réussie"
                            ? "bg-green-100 text-green-800"
                            : selectedProject.travauxPlanification.essaisReglementaires.epreuveEtancheite === "En cours"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-slate-100 text-slate-800"
                        }`}>{selectedProject.travauxPlanification.essaisReglementaires.epreuveEtancheite}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Suivi rigoureux des variations thermométriques et de pression du fluide.</p>
                    </div>
                  </div>

                  {/* ====== CANEVAS D'AVANCEMENT PHYSIQUE DES TRAVAUX ====== */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-150">
                      <div>
                        <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-purple-600" />
                          <span>
                            Canevas d'Avancement Physique des Travaux
                            {activeTravauxLotId && selectedProject.lots?.find(l => l.id === activeTravauxLotId) ? (
                              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 font-mono text-[10px] rounded-md font-extrabold">
                                {selectedProject.lots.find(l => l.id === activeTravauxLotId)?.name}
                              </span>
                            ) : (
                              <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded-md font-bold">
                                Synthèse Projet
                              </span>
                            )}
                          </span>
                        </h5>
                        <p className="text-[10px] text-slate-400">Génération automatique des avancements GC, GM (Mécanique) et Global depuis les tableaux.</p>
                      </div>

                      {hasPrivilege("section_travaux") && (
                        <div className="shrink-0">
                          {!isEditingTravauxProgress ? (
                            <button
                              onClick={() => {
                                const targetLot = selectedProject.lots?.find(l => l.id === activeTravauxLotId);
                                const fallbackLot = selectedProject.lots?.[0];
                                
                                const lData = (activeTravauxLotId && targetLot?.travauxLigne && targetLot.travauxLigne.length > 0)
                                  ? targetLot.travauxLigne 
                                  : (selectedProject.travauxLigne && selectedProject.travauxLigne.length > 0 
                                      ? selectedProject.travauxLigne 
                                      : (fallbackLot?.travauxLigne && fallbackLot.travauxLigne.length > 0 
                                          ? fallbackLot.travauxLigne 
                                          : DEFAULT_TRAVAUX_LIGNE));

                                const pData = (activeTravauxLotId && targetLot?.travauxPostes && targetLot.travauxPostes.length > 0)
                                  ? targetLot.travauxPostes 
                                  : (selectedProject.travauxPostes && selectedProject.travauxPostes.length > 0 
                                      ? selectedProject.travauxPostes 
                                      : (fallbackLot?.travauxPostes && fallbackLot.travauxPostes.length > 0 
                                          ? fallbackLot.travauxPostes 
                                          : DEFAULT_TRAVAUX_POSTES));

                                const lenVal = (activeTravauxLotId && targetLot?.longueur) ? targetLot.longueur : getProjectDisplayLength(selectedProject);

                                setTempTravauxLigne(JSON.parse(JSON.stringify(lData)));
                                setTempTravauxPostes(JSON.parse(JSON.stringify(pData)));
                                setTempLongueur(lenVal);
                                setIsEditingTravauxProgress(true);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Saisir l'avancement</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    const lenKm = tempLongueur !== "" && !isNaN(parseFloat(tempLongueur)) ? parseFloat(tempLongueur) : (parseFloat(getProjectDisplayLength(selectedProject)) || 10);

                                    const cleanedLigne = (tempTravauxLigne || []).map((item: any) => ({
                                      ...item,
                                      anterieur: parseFloat(String(item.anterieur)) || 0,
                                      quotidien: parseFloat(String(item.quotidien)) || 0,
                                      ponderation: parseFloat(String(item.ponderation)) || 0
                                    }));

                                    const cleanedPostes = (tempTravauxPostes || []).map((item: any) => ({
                                      ...item,
                                      anterieur: parseFloat(String(item.anterieur)) || 0,
                                      quotidien: parseFloat(String(item.quotidien)) || 0,
                                      global: (parseFloat(String(item.anterieur)) || 0) + (parseFloat(String(item.quotidien)) || 0),
                                      ponderation: parseFloat(String(item.ponderation)) || 0
                                    }));

                                    const computed = computeProgressFromCanvas(cleanedLigne, cleanedPostes, lenKm, isPosteDetenteSeul(selectedProject));

                                    let updatedProj: any = {
                                      ...selectedProject,
                                      travauxLigne: cleanedLigne,
                                      travauxPostes: cleanedPostes,
                                      updatedAt: new Date().toISOString()
                                    };

                                    if (selectedProject.lots && selectedProject.lots.length > 0) {
                                      const targetLotId = activeTravauxLotId || selectedProject.lots[0].id;
                                      const updatedLots = selectedProject.lots.map(l => {
                                        if (l.id === targetLotId || (!activeTravauxLotId && l.id === selectedProject.lots[0].id)) {
                                          const lContrats = (l.contrats || {}) as any;
                                          return {
                                            ...l,
                                            longueur: tempLongueur || l.longueur || "0",
                                            travauxLigne: cleanedLigne,
                                            travauxPostes: cleanedPostes,
                                            avancementGC: computed.avancementGC,
                                            avancementMeca: computed.avancementMeca,
                                            avancementPhysique: computed.avancementPhysique,
                                            contrats: {
                                              ...lContrats,
                                              etbGC: { ...(lContrats.etbGC || {}), avancement: computed.avancementGC },
                                              etbMeca: { ...(lContrats.etbMeca || {}), avancement: computed.avancementMeca }
                                            }
                                          };
                                        }
                                        return l;
                                      });

                                      const totalLength = updatedLots.reduce((sum, l) => sum + (parseFloat(l.longueur || "0") || 1), 0);
                                      let weightedGC = 0, weightedMeca = 0, weightedPhys = 0;
                                      updatedLots.forEach(l => {
                                        const w = (parseFloat(l.longueur || "0") || 1) / totalLength;
                                        weightedGC += (l.avancementGC || 0) * w;
                                        weightedMeca += (l.avancementMeca || 0) * w;
                                        weightedPhys += (l.avancementPhysique || 0) * w;
                                      });

                                      const finalGC = Math.round(weightedGC);
                                      const finalMeca = Math.round(weightedMeca);
                                      const finalPhys = Math.round(weightedPhys);

                                      updatedProj.lots = updatedLots;
                                      updatedProj.travauxPlanification = {
                                        ...selectedProject.travauxPlanification,
                                        avancementGC: finalGC,
                                        avancementMeca: finalMeca,
                                        avancementPhysique: finalPhys
                                      };
                                      updatedProj.contrats = {
                                        ...(selectedProject.contrats || {}),
                                        etbGC: { ...(selectedProject.contrats?.etbGC || {}), avancement: finalGC },
                                        etbMeca: { ...(selectedProject.contrats?.etbMeca || {}), avancement: finalMeca }
                                      };
                                    } else {
                                      updatedProj.identity = {
                                        ...(selectedProject.identity || {}),
                                        caracteristiques: {
                                          ...(selectedProject.identity?.caracteristiques || {}),
                                          longueur: tempLongueur || "0"
                                        }
                                      };
                                      updatedProj.travauxPlanification = {
                                        ...selectedProject.travauxPlanification,
                                        avancementGC: computed.avancementGC,
                                        avancementMeca: computed.avancementMeca,
                                        avancementPhysique: computed.avancementPhysique
                                      };
                                      updatedProj.contrats = {
                                        ...(selectedProject.contrats || {}),
                                        etbGC: { ...(selectedProject.contrats?.etbGC || {}), avancement: computed.avancementGC },
                                        etbMeca: { ...(selectedProject.contrats?.etbMeca || {}), avancement: computed.avancementMeca }
                                      };
                                    }

                                    setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProj : p));

                                    await setDoc(doc(db, "projects", selectedProject.id), updatedProj);

                                    await createNotification({
                                      projectId: selectedProject.id,
                                      projectName: selectedProject.name || "Ouvrage",
                                      message: `Avancement physique mis à jour : GC ${computed.avancementGC}%, Méca ${computed.avancementMeca}% ➔ Global ${computed.avancementPhysique}%`,
                                      category: "update",
                                      authorName: userProfile?.name || currentUser?.displayName || "Superviseur",
                                      authorEmail: currentUser?.email || "",
                                      authorRole: userProfile?.role || "Superviseur",
                                      pole: selectedProject.identity?.pole || "",
                                      region: selectedProject.identity?.region || ""
                                    });

                                    setIsEditingTravauxProgress(false);
                                  } catch (error) {
                                    console.error("Error saving progress sheet:", error);
                                    void pdiAlert("Erreur lors de l'enregistrement de l'avancement.");
                                  }
                                }}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Enregistrer</span>
                              </button>
                              <button
                                onClick={() => setIsEditingTravauxProgress(false)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px] font-black rounded-lg transition-all cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress sheet metrics summary */}
                    {(() => {
                      const activeLotObj = selectedProject.lots?.find(l => l.id === activeTravauxLotId);
                      const lenKmVal = isEditingTravauxProgress ? tempLongueur : (activeLotObj?.longueur || getProjectDisplayLength(selectedProject));
                      const lenKm = lenKmVal !== "" && !isNaN(parseFloat(lenKmVal)) ? parseFloat(lenKmVal) : 10;

                      const tLigne = isEditingTravauxProgress && tempTravauxLigne 
                        ? tempTravauxLigne 
                        : (activeLotObj?.travauxLigne && activeLotObj.travauxLigne.length > 0
                            ? activeLotObj.travauxLigne 
                            : (selectedProject.travauxLigne && selectedProject.travauxLigne.length > 0 
                                ? selectedProject.travauxLigne 
                                : (selectedProject.lots && selectedProject.lots[0]?.travauxLigne && selectedProject.lots[0].travauxLigne.length > 0 
                                    ? selectedProject.lots[0].travauxLigne 
                                    : DEFAULT_TRAVAUX_LIGNE)));
                      
                      const tPostes = isEditingTravauxProgress && tempTravauxPostes
                        ? tempTravauxPostes
                        : (activeLotObj?.travauxPostes && activeLotObj.travauxPostes.length > 0
                            ? activeLotObj.travauxPostes
                            : (selectedProject.travauxPostes && selectedProject.travauxPostes.length > 0
                                ? selectedProject.travauxPostes
                                : (selectedProject.lots && selectedProject.lots[0]?.travauxPostes && selectedProject.lots[0].travauxPostes.length > 0
                                    ? selectedProject.lots[0].travauxPostes
                                    : DEFAULT_TRAVAUX_POSTES)));

                      const computed = computeProgressFromCanvas(tLigne, tPostes, lenKm, isPosteDetenteSeul(selectedProject));

                      return (
                        <div className="space-y-4">
                          {/* Top mini dashboard with GC, GM, and Global progress indicators */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100 flex flex-col justify-between">
                              <span className="text-blue-800 font-extrabold uppercase text-[9px] tracking-wider block">Avancement GC (Génie Civil)</span>
                              <div className="flex items-baseline justify-between mt-1">
                                <span className="text-xl font-black text-blue-900">{computed.avancementGC}%</span>
                                <span className="text-[9px] font-mono text-blue-700 font-bold">Ligne + Postes</span>
                              </div>
                              <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden mt-1.5">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${computed.avancementGC}%` }}></div>
                              </div>
                            </div>

                            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                              <span className="text-emerald-800 font-extrabold uppercase text-[9px] tracking-wider block">Avancement GM (Mécanique)</span>
                              <div className="flex items-baseline justify-between mt-1">
                                <span className="text-xl font-black text-emerald-900">{computed.avancementMeca}%</span>
                                <span className="text-[9px] font-mono text-emerald-700 font-bold">Montage & Pose</span>
                              </div>
                              <div className="w-full h-1.5 bg-emerald-200 rounded-full overflow-hidden mt-1.5">
                                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${computed.avancementMeca}%` }}></div>
                              </div>
                            </div>

                            <div className="bg-purple-900 text-white p-3.5 rounded-2xl border border-purple-950 flex flex-col justify-between shadow-sm col-span-1 sm:col-span-2">
                              <span className="text-purple-200 font-extrabold uppercase text-[9px] tracking-wider block">
                                {activeLotObj ? `Avancement Physique — ${activeLotObj.name}` : "Avancement Physique Global (Calculé)"}
                              </span>
                              <div className="flex items-baseline justify-between mt-1">
                                <span className="text-2xl font-black">{computed.avancementPhysique}%</span>
                                <span className="text-[9px] font-mono bg-purple-800 text-purple-100 px-2 py-0.5 rounded font-bold uppercase">
                                  {isPosteDetenteSeul ? "100% Poste" : "Pondéré 80/20"}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-purple-800 rounded-full overflow-hidden mt-1.5">
                                <div className="h-full bg-white rounded-full" style={{ width: `${computed.avancementPhysique}%` }}></div>
                              </div>
                            </div>
                          </div>

                          {/* Tab Navigation & project length info */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                            <div className="flex gap-1.5 p-0.5 bg-slate-100 rounded-xl max-w-fit border">
                              {!isPosteDetenteSeul && (
                                <button
                                  type="button"
                                  onClick={() => setTravauxProgressTab("ligne")}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                                    travauxProgressTab === "ligne" 
                                      ? "bg-white text-slate-800 shadow-xs" 
                                      : "text-slate-500 hover:text-slate-800"
                                  }`}
                                >
                                  <Layers className="w-3 h-3" />
                                  <span>🛤️ Travaux de Ligne</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setTravauxProgressTab("postes")}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                                  travauxProgressTab === "postes" 
                                    ? "bg-white text-slate-800 shadow-xs" 
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                <Building className="w-3 h-3" />
                                <span>🏢 Ouvrages Concentrés (Postes)</span>
                              </button>
                            </div>

                            <div className="text-[10px] text-slate-500 flex items-center gap-2 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border">
                              <span className="font-extrabold text-slate-700">Longueur du Projet :</span>
                              <span className="font-mono font-black text-slate-800">{lenKm} km</span>
                              <span className="text-slate-300">|</span>
                              <span className="font-mono font-black text-slate-800">{(lenKm * 1000).toLocaleString()} ml</span>
                              {isEditingTravauxProgress && (
                                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                                  <span className="text-slate-400 font-bold">Modifier (km):</span>
                                  <input 
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={tempLongueur}
                                    onChange={(e) => {
                                      setTempLongueur(e.target.value);
                                    }}
                                    className="w-14 bg-white border rounded px-1 text-[10px] font-black font-mono text-center"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Active Tab View */}
                          {travauxProgressTab === "ligne" ? (
                            <div className="overflow-x-auto rounded-2xl border border-slate-150 shadow-xs">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                                    <th className="py-2.5 px-3">Phase de Travaux</th>
                                    <th className="py-2.5 px-3 text-center bg-purple-50/30">Pondér. (%)</th>
                                    <th className="py-2.5 px-3 text-center">Réal. Antér. (ml)</th>
                                    <th className="py-2.5 px-3 text-center">Réal. Quot. (ml)</th>
                                    <th className="py-2.5 px-3 text-center font-bold text-slate-700 bg-slate-100/50">Réal. Cumulée (ml)</th>
                                    <th className="py-2.5 px-3 text-center">Avanc. Abs. Quot. (%)</th>
                                    <th className="py-2.5 px-3 text-center">Avanc. Abs. Global (%)</th>
                                    <th className="py-2.5 px-3 text-center bg-purple-50/50 font-bold text-purple-700">Avanc. Quot. Rel. (%)</th>
                                    <th className="py-2.5 px-3 text-center bg-purple-100/40 font-black text-purple-900 font-black">Avanc. Cumulé Rel. (%)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                  {(() => {
                                    const totLenM = lenKm * 1000;
                                    let sumPonderation = 0;
                                    let sumAnterieur = 0;
                                    let sumQuotidien = 0;
                                    let sumCumule = 0;
                                    let sumQuotidienAbs = 0;
                                    let sumGlobalAbs = 0;
                                    let sumQuotidienRel = 0;
                                    let sumCumuleRel = 0;

                                    return (
                                      <>
                                        {tLigne.map((row, idx) => {
                                          const ant = parseFloat(row.anterieur) || 0;
                                          const quot = parseFloat(row.quotidien) || 0;
                                          const cum = ant + quot;
                                          const pond = parseFloat(row.ponderation) || 0;

                                          const quotAbs = totLenM > 0 ? (quot / totLenM) * 100 : 0;
                                          const globAbs = totLenM > 0 ? (cum / totLenM) * 100 : 0;

                                          const quotRel = quotAbs * (pond / 100);
                                          const cumRel = globAbs * (pond / 100);

                                          sumPonderation += pond;
                                          sumAnterieur += ant;
                                          sumQuotidien += quot;
                                          sumCumule += cum;
                                          sumQuotidienAbs += quotAbs;
                                          sumGlobalAbs += globAbs;
                                          sumQuotidienRel += quotRel;
                                          sumCumuleRel += cumRel;

                                          return (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                              <td className="py-2 px-3 font-black text-slate-800">{idx + 1}/ {row.phase}</td>
                                              <td className="py-2 px-3 text-center font-mono font-bold bg-purple-50/10">{pond}%</td>
                                              <td className="py-2 px-3 text-center font-mono">
                                                {isEditingTravauxProgress ? (
                                                  <input 
                                                    type="number"
                                                    value={row.anterieur}
                                                    onChange={(e) => {
                                                      const raw = e.target.value;
                                                      const val = raw === "" ? "" : Math.max(0, parseFloat(raw) || 0);
                                                      const updated = [...tLigne];
                                                      updated[idx] = { ...updated[idx], anterieur: val };
                                                      setTempTravauxLigne(updated);
                                                    }}
                                                    className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-black"
                                                  />
                                                ) : ant.toLocaleString()}
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono">
                                                {isEditingTravauxProgress ? (
                                                  <input 
                                                    type="number"
                                                    value={row.quotidien}
                                                    onChange={(e) => {
                                                      const raw = e.target.value;
                                                      const val = raw === "" ? "" : Math.max(0, parseFloat(raw) || 0);
                                                      const updated = [...tLigne];
                                                      updated[idx] = { ...updated[idx], quotidien: val };
                                                      setTempTravauxLigne(updated);
                                                    }}
                                                    className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-black"
                                                  />
                                                ) : quot.toLocaleString()}
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono font-black text-slate-800 bg-slate-100/30">
                                                {cum.toLocaleString()}
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">
                                                {quotAbs.toFixed(2)}%
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono text-slate-600 text-[11px]">
                                                {globAbs.toFixed(2)}%
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono bg-purple-50/30 text-purple-600 font-bold">
                                                {quotRel.toFixed(2)}%
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono bg-purple-100/20 text-purple-800 font-black">
                                                {cumRel.toFixed(2)}%
                                              </td>
                                            </tr>
                                          );
                                        })}

                                        {/* Total Summary Row */}
                                        <tr className="bg-slate-100/60 font-black text-slate-800 text-[11px] border-t-2 border-slate-200">
                                          <td className="py-2.5 px-3 uppercase tracking-wider font-extrabold font-black">TOTAL RELATIF LIGNE</td>
                                          <td className="py-2.5 px-3 text-center font-mono bg-purple-50/20">{sumPonderation}%</td>
                                          <td className="py-2.5 px-3 text-center font-mono">{sumAnterieur.toLocaleString()}</td>
                                          <td className="py-2.5 px-3 text-center font-mono">{sumQuotidien.toLocaleString()}</td>
                                          <td className="py-2.5 px-3 text-center font-mono bg-slate-200/40">{sumCumule.toLocaleString()}</td>
                                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">-</td>
                                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">-</td>
                                          <td className="py-2.5 px-3 text-center font-mono bg-purple-100/30 text-purple-700 font-bold">{sumQuotidienRel.toFixed(2)}%</td>
                                          <td className="py-2.5 px-3 text-center font-mono bg-purple-200/30 text-purple-900 text-xs font-extrabold">{sumCumuleRel.toFixed(2)}%</td>
                                        </tr>
                                      </>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-2xl border border-slate-150 shadow-xs">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                                    <th className="py-2.5 px-3">Ouvrage • Phase Postes</th>
                                    <th className="py-2.5 px-3 text-center bg-indigo-50/30">Pondér. (%)</th>
                                    <th className="py-2.5 px-3 text-center">Avancement Absolu Antérieur (%)</th>
                                    <th className="py-2.5 px-3 text-center">Avancement Absolu Quotidien (%)</th>
                                    <th className="py-2.5 px-3 text-center font-bold text-slate-700 bg-slate-100/50">Avancement Absolu Global (%)</th>
                                    <th className="py-2.5 px-3 text-center bg-indigo-50/50 font-bold text-indigo-700">Avancement Quotidien Relatif (%)</th>
                                    <th className="py-2.5 px-3 text-center bg-indigo-100/40 font-black text-indigo-900 font-black">Avancement Cumulé Relatif (%)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                  {(() => {
                                    let sumPonderation = 0;
                                    let sumAnterieurAbs = 0;
                                    let sumQuotidienAbs = 0;
                                    let sumGlobalAbs = 0;
                                    let sumQuotidienRel = 0;
                                    let sumCumuleRel = 0;

                                    return (
                                      <>
                                        {tPostes.map((row, idx) => {
                                          const ant = row.anterieur !== undefined 
                                            ? (parseFloat(row.anterieur) || 0) 
                                            : Math.max(0, (parseFloat(row.global) || 0) - (parseFloat(row.quotidien) || 0));
                                          const quot = parseFloat(row.quotidien) || 0;
                                          const glob = ant + quot;
                                          const pond = parseFloat(row.ponderation) || 0;

                                          const quotRel = quot * (pond / 100);
                                          const cumRel = glob * (pond / 100);

                                          sumPonderation += pond;
                                          sumAnterieurAbs += ant;
                                          sumQuotidienAbs += quot;
                                          sumGlobalAbs += glob;
                                          sumQuotidienRel += quotRel;
                                          sumCumuleRel += cumRel;

                                          return (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                              <td className="py-2.5 px-3 font-black text-slate-800">{idx + 1}/ {row.phase}</td>
                                              <td className="py-2.5 px-3 text-center font-mono font-bold bg-indigo-50/10">{pond}%</td>
                                              
                                              {/* Avancement Absolu Antérieur (%) */}
                                              <td className="py-2.5 px-3 text-center font-mono">
                                                {isEditingTravauxProgress ? (
                                                  <div className="flex items-center justify-center gap-1">
                                                    <input 
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      value={row.anterieur !== undefined ? row.anterieur : ant}
                                                      onChange={(e) => {
                                                        const raw = e.target.value;
                                                        const val = raw === "" ? "" : Math.min(100, Math.max(0, parseFloat(raw) || 0));
                                                        const updated = [...tPostes];
                                                        const numVal = parseFloat(String(val)) || 0;
                                                        const numQuot = parseFloat(String(updated[idx].quotidien)) || 0;
                                                        updated[idx] = { ...updated[idx], anterieur: val, global: numVal + numQuot };
                                                        setTempTravauxPostes(updated);
                                                      }}
                                                      className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-black"
                                                    />
                                                    <span className="text-slate-400 font-bold">%</span>
                                                  </div>
                                                ) : `${ant}%`}
                                              </td>

                                              {/* Avancement Absolu Quotidien (%) */}
                                              <td className="py-2.5 px-3 text-center font-mono">
                                                {isEditingTravauxProgress ? (
                                                  <div className="flex items-center justify-center gap-1">
                                                    <input 
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      value={row.quotidien}
                                                      onChange={(e) => {
                                                        const raw = e.target.value;
                                                        const val = raw === "" ? "" : Math.min(100, Math.max(0, parseFloat(raw) || 0));
                                                        const updated = [...tPostes];
                                                        const rowAnt = updated[idx].anterieur !== undefined 
                                                          ? (parseFloat(String(updated[idx].anterieur)) || 0) 
                                                          : Math.max(0, (parseFloat(String(updated[idx].global)) || 0) - (parseFloat(String(updated[idx].quotidien)) || 0));
                                                        const numVal = parseFloat(String(val)) || 0;
                                                        updated[idx] = { ...updated[idx], quotidien: val, global: rowAnt + numVal };
                                                        setTempTravauxPostes(updated);
                                                      }}
                                                      className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-black"
                                                    />
                                                    <span className="text-slate-400 font-bold">%</span>
                                                  </div>
                                                ) : `${quot}%`}
                                              </td>

                                              {/* Avancement Absolu Global (%) - Calculated */}
                                              <td className="py-2.5 px-3 text-center font-mono font-black text-slate-800 bg-slate-100/30">
                                                {glob}%
                                              </td>

                                              <td className="py-2.5 px-3 text-center font-mono bg-indigo-50/30 text-indigo-600 font-bold">
                                                {quotRel.toFixed(2)}%
                                              </td>
                                              <td className="py-2.5 px-3 text-center font-mono bg-indigo-100/20 text-indigo-800 font-black">
                                                {cumRel.toFixed(2)}%
                                              </td>
                                            </tr>
                                          );
                                        })}

                                        {/* Total Summary Row */}
                                        <tr className="bg-slate-100/60 font-black text-slate-800 text-[11px] border-t-2 border-slate-200">
                                          <td className="py-2.5 px-3 uppercase tracking-wider font-extrabold font-black font-black">TOTAL RELATIF POSTES</td>
                                          <td className="py-2.5 px-3 text-center font-mono bg-indigo-50/20">{sumPonderation}%</td>
                                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">-</td>
                                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">-</td>
                                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 bg-slate-200/45">-</td>
                                          <td className="py-2.5 px-3 text-center font-mono bg-indigo-100/30 text-indigo-700 font-bold">{sumQuotidienRel.toFixed(2)}%</td>
                                          <td className="py-2.5 px-3 text-center font-mono bg-indigo-200/30 text-indigo-900 text-xs font-extrabold">{sumCumuleRel.toFixed(2)}%</td>
                                        </tr>
                                      </>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* DISPONIBILITÉ MATÉRIEL ET ÉQUIPEMENTS */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-purple-600" />
                          <span>Disponibilité du Matériel et Équipements de Chantier</span>
                        </h5>
                        <p className="text-[10px] text-slate-400">État d'approvisionnement des composants critiques pour le raccordement et la pose du gazoduc.</p>
                      </div>

                      {hasPrivilege("section_travaux") && (
                        <div className="shrink-0">
                          {!isEditingMateriel ? (
                            <button
                              onClick={() => {
                                const initialMat = selectedProject.disponibiliteMateriel || {
                                  tube: { statut: "Disponible", quantite: "100%", commentaire: "Tubes en acier de diamètre spécifié réceptionnés." },
                                  posteRechauffeur: { statut: "Disponible", quantite: "1 unité", commentaire: "Poste réchauffeur d'eau chaude installé et opérationnel." },
                                  raccorderie: { statut: "Disponible", quantite: "100%", commentaire: "Brides, coudes et tés inspectés et conformes." },
                                  posteSectionnement: { statut: "Disponible", quantite: "2 unités", commentaire: "Postes de sectionnement préfabriqués sur chantier." },
                                  gareRacleur: { statut: "En cours", quantite: "1 départ / 1 arrivée", commentaire: "Gare de racleur de départ installée, gare d'arrivée en cours de montage." },
                                  autre: { statut: "Disponible", quantite: "N/A", commentaire: "Générateurs et postes de soudage automatiques de secours disponibles." }
                                };
                                setTempMateriel(JSON.parse(JSON.stringify(initialMat)));
                                setIsEditingMateriel(true);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Mettre à jour l'état</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    const updatedProj = {
                                      ...selectedProject,
                                      disponibiliteMateriel: tempMateriel,
                                      updatedAt: new Date().toISOString()
                                    };
                                    // Save to firestore
                                    await setDoc(doc(db, "projects", selectedProject.id), updatedProj);
                                    setIsEditingMateriel(false);
                                  } catch (error) {
                                    console.error("Error saving material availability:", error);
                                    void pdiAlert("Erreur lors de la sauvegarde.");
                                  }
                                }}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Enregistrer</span>
                              </button>
                              <button
                                onClick={() => setIsEditingMateriel(false)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px] font-black rounded-lg transition-all cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditingMateriel && tempMateriel ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {[
                          { key: "tube", label: "Tube (Canalisations)", desc: "État de livraison des tubes acier de la ligne principale." },
                          { key: "posteRechauffeur", label: "Poste Réchauffeur", desc: "Disponibilité et état du poste réchauffeur d'eau chaude." },
                          { key: "raccorderie", label: "Raccorderie", desc: "Brides, coudes, tés, joints isolants de raccordement." },
                          { key: "posteSectionnement", label: "Poste de Sectionnement", desc: "Robinetterie et vannes de sectionnement de ligne." },
                          { key: "gareRacleur", label: "Gare Racleur (Départ / Arrivée)", desc: "Gare de racleur départ et d'arrivée." },
                          { key: "autre", label: "Autre matériel", desc: "Tout autre équipement ou matériel de chantier nécessaire." }
                        ].map(({ key, label, desc }) => (
                          <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-800 text-xs">{label}</span>
                              <select
                                value={tempMateriel[key]?.statut || "Disponible"}
                                onChange={(e) => {
                                  setTempMateriel({
                                    ...tempMateriel,
                                    [key]: { ...tempMateriel[key], statut: e.target.value }
                                  });
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                              >
                                <option value="Disponible">Disponible ✅</option>
                                <option value="En cours">En cours de livraison 🚚</option>
                                <option value="Manquant">Manquant ❌</option>
                                <option value="Non requis">Non requis ⚪</option>
                              </select>
                            </div>
                            <p className="text-[10px] text-slate-400 -mt-1">{desc}</p>
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div className="col-span-1">
                                <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wide block">Quantité / Réf</label>
                                <input
                                  type="text"
                                  value={tempMateriel[key]?.quantite || ""}
                                  onChange={(e) => {
                                    setTempMateriel({
                                      ...tempMateriel,
                                      [key]: { ...tempMateriel[key], quantite: e.target.value }
                                    });
                                  }}
                                  className="w-full mt-0.5 px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md outline-none font-bold text-slate-700"
                                  placeholder="Ex: 100% ou 2 u"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wide block">Commentaires / Remarques</label>
                                <input
                                  type="text"
                                  value={tempMateriel[key]?.commentaire || ""}
                                  onChange={(e) => {
                                    setTempMateriel({
                                      ...tempMateriel,
                                      [key]: { ...tempMateriel[key], commentaire: e.target.value }
                                    });
                                  }}
                                  className="w-full mt-0.5 px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md outline-none text-slate-700"
                                  placeholder="Observations sur le chantier..."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        {(() => {
                          const matData = selectedProject.disponibiliteMateriel || {
                            tube: { statut: "Disponible", quantite: "100%", commentaire: "Tubes en acier de diamètre spécifié réceptionnés." },
                            posteRechauffeur: { statut: "Disponible", quantite: "1 unité", commentaire: "Poste réchauffeur d'eau chaude installé et opérationnel." },
                            raccorderie: { statut: "Disponible", quantite: "100%", commentaire: "Brides, coudes et tés inspectés et conformes." },
                            posteSectionnement: { statut: "Disponible", quantite: "2 unités", commentaire: "Postes de sectionnement préfabriqués sur chantier." },
                            gareRacleur: { statut: "En cours", quantite: "1 départ / 1 arrivée", commentaire: "Gare de racleur de départ installée, gare d'arrivée en cours de montage." },
                            autre: { statut: "Disponible", quantite: "N/A", commentaire: "Générateurs et postes de soudage automatiques de secours disponibles." }
                          };
                          return [
                            { key: "tube", label: "Tube (Canalisations)", icon: Layers },
                            { key: "posteRechauffeur", label: "Poste Réchauffeur", icon: Thermometer },
                            { key: "raccorderie", label: "Raccorderie", icon: Sliders },
                            { key: "posteSectionnement", label: "Poste de Sectionnement", icon: Radio },
                            { key: "gareRacleur", label: "Gare Racleur (Départ / Arrivée)", icon: ArrowRightLeft },
                            { key: "autre", label: "Autre matériel", icon: Wrench }
                          ].map(({ key, label, icon: IconComponent }) => {
                            const val = matData[key as keyof typeof matData] || { statut: "Disponible", quantite: "100%", commentaire: "" };
                            const getStatutBadge = (status: string) => {
                              switch (status) {
                                case "Disponible":
                                  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-bold text-[9px] border border-green-200/50">Disponible ✅</span>;
                                case "En cours":
                                  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full font-bold text-[9px] border border-yellow-200/50">En cours 🚚</span>;
                                case "Manquant":
                                  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-bold text-[9px] border border-red-200/50">Manquant ❌</span>;
                                default:
                                  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full font-bold text-[9px] border border-slate-200/50">Non requis ⚪</span>;
                              }
                            };
                            return (
                              <div key={key} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 hover:border-slate-200/80 hover:bg-slate-50 transition-all flex flex-col justify-between space-y-2">
                                <div className="flex justify-between items-start gap-1">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white rounded-lg border border-slate-200/50 text-slate-600">
                                      <IconComponent className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="font-extrabold text-slate-800 text-[11px]">{label}</span>
                                  </div>
                                  {getStatutBadge(val.statut)}
                                </div>
                                <div className="space-y-1 pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-mono text-slate-400 uppercase">Quantité/Réf:</span>
                                    <span className="text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded-md border border-slate-100">{val.quantite || "N/A"}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 italic leading-relaxed line-clamp-2">
                                    {val.commentaire || "Aucune observation enregistrée."}
                                  </p>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* 36 POINTS OF CONTROL AUDIT REGISTER */}
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4 text-purple-600" />
                          <span>Registre des 36 Tâches du Plan de Contrôle (PR.INFR.03.V02)</span>
                        </h5>
                        <p className="text-[10px] text-slate-400">Cliquez sur un point de contrôle pour l'ouvrir, modifier son résultat d'audit, vérifier l'étalonnage des appareils ou renseigner les actions correctives.</p>
                      </div>

                      {/* Filter & Search controls */}
                      <div className="flex w-full sm:w-auto items-center gap-2 text-xs shrink-0">
                        <div className="relative flex-1 sm:flex-initial">
                          <input
                            type="text"
                            value={planDeControleSearch}
                            onChange={e => setPlanDeControleSearch(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-1.5 text-slate-700 focus:outline-blue-500 font-medium text-xs w-full sm:w-48"
                            placeholder="Rechercher une tâche..."
                          />
                        </div>
                        <select
                          value={planDeControleFilter}
                          onChange={e => setPlanDeControleFilter(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 focus:outline-blue-500 font-black text-xs"
                        >
                          <option value="Tous">Filtrer: Tous</option>
                          <option value="C">Conforme (C)</option>
                          <option value="NC">Non Conforme (NC)</option>
                          <option value="/">Non contrôlé (/)</option>
                        </select>
                      </div>
                    </div>

                    {/* Interactive List/Table of 36 items */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[9px] tracking-wider">
                              <th className="py-3 px-4 w-12 text-center">N°</th>
                              <th className="py-3 px-4">Tâche / Activité de contrôle</th>
                              <th className="py-3 px-4 hidden md:table-cell">Mode de Contrôle</th>
                              <th className="py-3 px-4 hidden md:table-cell">Document de Référence</th>
                              <th className="py-3 px-4 text-center w-36">Statut Audit</th>
                            </tr>
                          </thead>
                        </table>
                        </div>

                        <div className="divide-y divide-slate-100 bg-white max-h-[500px] overflow-y-auto">
                          {STATIC_PLAN_DE_CONTROLE_TASKS.filter(task => {
                            // Filter by Search string
                            const matchesSearch = task.tache.toLowerCase().includes(planDeControleSearch.toLowerCase()) || task.ord.includes(planDeControleSearch);
                            
                            // Filter by compliance status
                            const statusObj = selectedProject.planDeControle?.[task.ord];
                            const currentResult = statusObj ? (statusObj.resultatNouveau !== "/" ? statusObj.resultatNouveau : statusObj.resultat) : "/";
                            
                            if (planDeControleFilter === "Tous") return matchesSearch;
                            return matchesSearch && currentResult === planDeControleFilter;
                          }).map(task => {
                            const status = selectedProject.planDeControle?.[task.ord];
                            const hasBeenControlled = !!status;
                            const res1 = status?.resultat || "/";
                            const resNew = status?.resultatNouveau || "/";
                            
                            // Determine final active status
                            const finalResult = resNew !== "/" ? resNew : res1;
                            
                            const isExpanded = expandedPlanDeControleItem === task.ord;

                            return (
                              <div key={task.ord} className="transition-all">
                                <div 
                                  onClick={() => handleToggleExpandPlanItem(task.ord)}
                                  className={`flex items-center justify-between md:grid md:grid-cols-12 py-3.5 px-4 cursor-pointer text-xs transition-all ${
                                    isExpanded ? "bg-slate-50 font-extrabold" : "hover:bg-slate-50/50"
                                  }`}
                                >
                                  {/* Ordinal */}
                                  <div className="md:col-span-1 text-center font-mono font-black text-slate-400 pr-2">
                                    {task.ord}
                                  </div>
                                  
                                  {/* Task title */}
                                  <div className="md:col-span-5 pr-4">
                                    <p className="font-extrabold text-slate-800 leading-tight">{task.tache}</p>
                                    <p className="md:hidden text-[10px] text-slate-400 mt-0.5">{task.mode} • Ref: {task.ref}</p>
                                  </div>

                                  {/* Mode (hidden on mobile) */}
                                  <div className="md:col-span-2 hidden md:block text-slate-500 font-medium pr-3">
                                    {task.mode}
                                  </div>

                                  {/* Document ref (hidden on mobile) */}
                                  <div className="md:col-span-2 hidden md:block text-slate-400 font-mono truncate pr-3" title={task.ref}>
                                    {task.ref}
                                  </div>

                                  {/* Status badge */}
                                  <div className="md:col-span-2 flex justify-center shrink-0">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase text-center w-28 flex items-center justify-center gap-1.5 ${
                                      finalResult === "C"
                                        ? "bg-green-100 text-green-800 border border-green-200"
                                        : finalResult === "NC"
                                        ? "bg-red-100 text-red-800 border border-red-200"
                                        : "bg-slate-100 text-slate-500 border border-slate-200"
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        finalResult === "C" ? "bg-green-600" : finalResult === "NC" ? "bg-red-600" : "bg-slate-400"
                                      }`}></span>
                                      <span>
                                        {finalResult === "C" && "Conforme"}
                                        {finalResult === "NC" && "Non Conforme"}
                                        {finalResult === "/" && "Non contrôlé"}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                {/* Expanded detail view */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden bg-slate-50 border-t border-b border-slate-100 px-6 py-5 text-xs text-slate-700"
                                    >
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Static Reference & Specs column */}
                                        <div className="space-y-3.5 border-r border-slate-200/60 pr-0 md:pr-6">
                                          <div>
                                            <span className="text-[9px] font-black uppercase text-purple-600 tracking-wider">Critère d'acceptation</span>
                                            <p className="font-extrabold text-slate-800 leading-relaxed mt-0.5">{task.critere}</p>
                                          </div>
                                          <div>
                                            <span className="text-[9px] font-black uppercase text-purple-600 tracking-wider">Étalonnage de mesure requis</span>
                                            <p className="font-medium text-slate-600 leading-relaxed mt-0.5">{task.etalonnage}</p>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                                              <span className="text-[9px] text-slate-400 font-bold block">MODE DE CONTROLE</span>
                                              <span className="font-bold text-slate-800">{task.mode}</span>
                                            </div>
                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                                              <span className="text-[9px] text-slate-400 font-bold block">DOCUMENT REF</span>
                                              <span className="font-mono text-slate-800 truncate block" title={task.ref}>{task.ref}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Audit status / Editor column */}
                                        <div className="space-y-4">
                                          {hasPrivilege("section_travaux") ? (
                                            /* Admin editable form */
                                            <div className="space-y-3">
                                              <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">Enregistrer l'évaluation d'audit (Admin)</span>
                                              
                                              <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                  <label className="block text-slate-500 font-bold mb-1">Date Contrôle :</label>
                                                  <input 
                                                    type="date" 
                                                    value={editPlanItemFields.dateControle || ""}
                                                    onChange={e => setEditPlanItemFields({ ...editPlanItemFields, dateControle: e.target.value })}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-slate-500 font-bold mb-1">Résultat :</label>
                                                  <select
                                                    value={editPlanItemFields.resultat}
                                                    onChange={e => setEditPlanItemFields({ ...editPlanItemFields, resultat: e.target.value as any })}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-black text-slate-800"
                                                  >
                                                    <option value="/">Non contrôlé (/)</option>
                                                    <option value="C">Conforme (C)</option>
                                                    <option value="NC">Non Conforme (NC)</option>
                                                  </select>
                                                </div>
                                              </div>

                                              <div className="grid grid-cols-1 gap-2">
                                                <div>
                                                  <label className="block text-slate-500 font-bold mb-0.5">Certificat Étalonnage vérifié (si requis) :</label>
                                                  <input 
                                                    type="text" 
                                                    value={editPlanItemFields.etalonnage || ""}
                                                    onChange={e => setEditPlanItemFields({ ...editPlanItemFields, etalonnage: e.target.value })}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5"
                                                    placeholder="ex: Certificat ONML n°2026/84 validé"
                                                  />
                                                </div>
                                              </div>

                                              {editPlanItemFields.resultat === "NC" && (
                                                <div className="bg-red-50 p-3 rounded-xl border border-red-100 space-y-3.5">
                                                  <p className="text-[10px] text-red-800 font-black uppercase tracking-wide">Fiche de Non-Conformité & Correction</p>
                                                  <div>
                                                    <label className="block text-red-700 font-bold mb-0.5">Action corrective demandée :</label>
                                                    <input 
                                                      type="text" 
                                                      value={editPlanItemFields.action || ""}
                                                      onChange={e => setEditPlanItemFields({ ...editPlanItemFields, action: e.target.value })}
                                                      className="w-full bg-white border border-red-200 rounded-xl px-2.5 py-1.5 text-red-900"
                                                      placeholder="ex: Sablage à refaire, ré-évaluation de soudure"
                                                    />
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                      <label className="block text-red-700 font-bold mb-0.5">Date ré-évaluation :</label>
                                                      <input 
                                                        type="date" 
                                                        value={editPlanItemFields.dateNouveauControle || ""}
                                                        onChange={e => setEditPlanItemFields({ ...editPlanItemFields, dateNouveauControle: e.target.value })}
                                                        className="w-full bg-white border border-red-200 rounded-xl px-2.5 py-1.5 font-mono"
                                                      />
                                                    </div>
                                                    <div>
                                                      <label className="block text-red-700 font-bold mb-0.5">Nouveau Résultat :</label>
                                                      <select
                                                        value={editPlanItemFields.resultatNouveau}
                                                        onChange={e => setEditPlanItemFields({ ...editPlanItemFields, resultatNouveau: e.target.value as any })}
                                                        className="w-full bg-white border border-red-200 rounded-xl px-2.5 py-1.5 font-black text-red-900"
                                                      >
                                                        <option value="/">Attente Ré-évaluation</option>
                                                        <option value="C">Conforme (C)</option>
                                                        <option value="NC">Toujours Non Conforme</option>
                                                      </select>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              <div>
                                                <label className="block text-slate-500 font-bold mb-0.5">Observations / Notes d'audit :</label>
                                                <textarea 
                                                  value={editPlanItemFields.observation || ""}
                                                  onChange={e => setEditPlanItemFields({ ...editPlanItemFields, observation: e.target.value })}
                                                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 min-h-[45px]"
                                                  placeholder="Renseigner d'autres détails ou réserves relatives au point de contrôle..."
                                                />
                                              </div>

                                              <div className="flex justify-end pt-1">
                                                <button
                                                  type="button"
                                                  disabled={isSavingPlanItem}
                                                  onClick={() => handleSavePlanDeControleItem(task.ord)}
                                                  className="px-4.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                                >
                                                  {isSavingPlanItem ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                  ) : (
                                                    <Save className="w-3.5 h-3.5" />
                                                  )}
                                                  <span>{isSavingPlanItem ? "Enregistrement..." : "Enregistrer ce point"}</span>
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            /* Regular/Guest user read-only summary card */
                                            <div className="bg-white p-4.5 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
                                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block border-b pb-1">Évaluation d'Audit de Chantier</span>
                                              
                                              {hasBeenControlled ? (
                                                <div className="space-y-2.5">
                                                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                    <div className="bg-slate-50 p-2 rounded-lg">
                                                      <span className="text-[10px] text-slate-400 block font-bold">DATE CONTROLE</span>
                                                      <span className="font-mono font-black text-slate-800">{status.dateControle || "Non spécifiée"}</span>
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded-lg">
                                                      <span className="text-[10px] text-slate-400 block font-bold">RESULTAT D'AUDIT</span>
                                                      <span className={`font-black text-xs ${status.resultat === "C" ? "text-green-700" : "text-red-700"}`}>
                                                        {status.resultat === "C" ? "CONFORME" : "NON CONFORME"}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  {status.etalonnage && (
                                                    <div className="text-[11px]">
                                                      <span className="text-slate-400 block font-bold">ÉTALONNAGE APPAREIL</span>
                                                      <p className="font-extrabold text-slate-800 bg-slate-50/50 p-2 rounded-lg border">{status.etalonnage}</p>
                                                    </div>
                                                  )}

                                                  {status.resultat === "NC" && (
                                                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-2 text-[11px]">
                                                      <span className="text-red-800 font-black uppercase block text-[9px] tracking-wider">Fiche de Non-Conformité active</span>
                                                      <div>
                                                        <span className="text-red-600 font-bold block">ACTION DEMANDEE :</span>
                                                        <p className="font-black text-red-900 leading-tight">{status.action || "Attente d'action corrective"}</p>
                                                      </div>
                                                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-red-200/50">
                                                        <div>
                                                          <span className="text-red-600 block">Date Ré-évaluation</span>
                                                          <span className="font-mono font-black text-red-900">{status.dateNouveauControle || "N/A"}</span>
                                                        </div>
                                                        <div>
                                                          <span className="text-red-600 block">Nouveau Résultat</span>
                                                          <span className="font-black text-red-900">{status.resultatNouveau === "C" ? "✓ CONFORME (Corrigé)" : "Attente correction"}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {status.observation && (
                                                    <div className="text-[11px]">
                                                      <span className="text-slate-400 block font-bold">OBSERVATIONS CHANTIER</span>
                                                      <p className="font-medium text-slate-700 italic bg-slate-50/50 p-2.5 rounded-lg border leading-relaxed">
                                                        "{status.observation}"
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="text-center py-6">
                                                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                                                  <p className="text-slate-500 font-extrabold">Point de contrôle non encore évalué.</p>
                                                  <p className="text-[10px] text-slate-400 mt-0.5">En attente de la visite du superviseur de chantier.</p>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

  );
}