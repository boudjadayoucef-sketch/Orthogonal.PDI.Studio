import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { pdiAlert } from '../../../pdi/ui/PdiNotice';
import {
  Sliders, Plus, Search, Filter, Printer, FileText, Download,
  Maximize2, Minimize2, ChevronDown, Check, Eye, Edit3, ArrowRight,
  Shield, CheckCircle, Clock, AlertTriangle, Layers, Calendar,
  Globe, X, Presentation, ExternalLink, HardHat, FileCheck, Archive,
  RefreshCw, Save, MapPin, EyeOff, Trash2, TrendingUp
} from 'lucide-react';
import { Project } from '../types';
import { POLES_ALGERIE, REGIONS_ALGERIE, WILAYAS_ALGERIE, AVAILABLE_COLUMNS } from '../constants';
import { getProjectDisplayLength, getProjectObjective, isUserPolesMatched, isUserDirectionsMatched, getPhaseBadgeColor } from '../projectUtils';

export interface PlanDeChargeViewProps {
  projects: Project[];
  setSelectedProjectId: (id: string | null) => void;
  setActiveModule: (module: 'charge' | 'gestion' | 'dashboard' | 'report' | 'bordereau') => void;
  setActiveSubTab: (tab: 'planning' | 'identity' | 'etude' | 'expertise' | 'travaux' | 'gaz' | 'bordereau') => void;
  hasPrivilege: (key: string) => boolean;
  uniqueYears: string[];
  uniquePoles?: string[];
  uniqueDirections?: string[];
  uniqueWilayas?: string[];
  currentUser?: any;
  userProfile?: any;
  handlePrintPlanDeCharge: (projects: Project[]) => void;
  handleExportPlanDeChargeWord: (projects: Project[]) => void;
  handleExportPlanDeChargePDF: (projects: Project[]) => void;
}

export function PlanDeChargeView({
  projects,
  setSelectedProjectId,
  setActiveModule,
  setActiveSubTab,
  hasPrivilege,
  uniqueYears,
  uniquePoles = ['Tous', ...Array.from(new Set(projects.map(p => p.identity?.pole).filter(Boolean))) as string[]],
  uniqueDirections = ['Tous', ...Array.from(new Set(projects.map(p => p.identity?.region).filter(Boolean))) as string[]],
  uniqueWilayas = ['Tous', ...Array.from(new Set(projects.map(p => p.identity?.wilaya).filter(Boolean))) as string[]],
  currentUser,
  userProfile,
  handlePrintPlanDeCharge,
  handleExportPlanDeChargeWord,
  handleExportPlanDeChargePDF,
}: PlanDeChargeViewProps) {
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const openCreateDialog = () => {
    setActiveModule('gestion');
  };
  const [planDeChargeSearch, setPlanDeChargeSearch] = useState<string>('');
  const [planDeChargeFilter, setPlanDeChargeFilter] = useState<string>('Tous');
  const [planDeChargeAnnee, setPlanDeChargeAnnee] = useState<string>('Tous');
  const [planDeChargePole, setPlanDeChargePole] = useState<string>('Tous');
  const [planDeChargeWilaya, setPlanDeChargeWilaya] = useState<string>('Tous');
  const [planDeChargeDirection, setPlanDeChargeDirection] = useState<string>('Tous');
  const [planDeChargeContrainte, setPlanDeChargeContrainte] = useState<string>('Tous');
  const [planDeChargeObjectif, setPlanDeChargeObjectif] = useState<string>('Tous');
  const [isFullscreenPlanDeCharge, setIsFullscreenPlanDeCharge] = useState<boolean>(false);
  const [planDeChargeFullscreenMode, setPlanDeChargeFullscreenMode] = useState<'normal' | 'reunion'>('normal');
  const [meetingSelectedProject, setMeetingSelectedProject] = useState<Project | null>(null);
  const [showFullscreenMenu, setShowFullscreenMenu] = useState<boolean>(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState<boolean>(false);

  // Quick edit constraints state
  const [editingConstraintsProjectId, setEditingConstraintsProjectId] = useState<string | null>(null);
  const [tempConstraintsText, setTempConstraintsText] = useState<string>('');
  const [isSavingConstraints, setIsSavingConstraints] = useState<boolean>(false);

  const handleSaveConstraintsQuickly = async () => {
    if (!editingConstraintsProjectId) return;
    setIsSavingConstraints(true);
    try {
      const projectRef = doc(db, 'projects', editingConstraintsProjectId);
      const targetProj = projects.find(p => p.id === editingConstraintsProjectId);
      await setDoc(projectRef, {
        identity: {
          ...targetProj?.identity,
          contraintes: tempConstraintsText
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setEditingConstraintsProjectId(null);
    } catch (err) {
      console.error('Error saving constraints quickly:', err);
      void pdiAlert("Une erreur s'est produite lors de la mise à jour des contraintes.");
    } finally {
      setIsSavingConstraints(false);
    }
  };

  useEffect(() => {
    if (isFullscreenPlanDeCharge) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenPlanDeCharge) {
        setIsFullscreenPlanDeCharge(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreenPlanDeCharge]);

    const filteredProjects = projects.filter(p => {
      const searchLower = planDeChargeSearch.toLowerCase();
      const matchesSearch = 
        p.name.toLowerCase().includes(searchLower) ||
        p.identity.wilaya.toLowerCase().includes(searchLower) ||
        p.identity.pole.toLowerCase().includes(searchLower) ||
        p.identity.structureChargee.toLowerCase().includes(searchLower);
      
      const pYear = p.planning?.etudeStart ? p.planning.etudeStart.substring(0, 4) : (p.createdAt ? p.createdAt.substring(0, 4) : "2026");
      const matchesAnnee = planDeChargeAnnee === "Tous" || pYear === planDeChargeAnnee;
      const matchesPole = planDeChargePole === "Tous" || p.identity.pole === planDeChargePole;
      const matchesWilaya = planDeChargeWilaya === "Tous" || p.identity.wilaya === planDeChargeWilaya;
      const matchesDirection = planDeChargeDirection === "Tous" || p.identity.region === planDeChargeDirection;
      const matchesPhase = planDeChargeFilter === "Tous" || p.identity.phase === planDeChargeFilter;

      const hasConstraint = p.identity.contraintes && p.identity.contraintes.trim().length > 0;
      const matchesContrainte = 
        planDeChargeContrainte === "Tous" ||
        (planDeChargeContrainte === "Avec" && hasConstraint) ||
        (planDeChargeContrainte === "Sans" && !hasConstraint);

      const obj = getProjectObjective(p);
      const matchesObjectif = 
        planDeChargeObjectif === "Tous" ||
        (planDeChargeObjectif === "Ouverture" && obj.type === "ouverture") ||
        (planDeChargeObjectif === "MiseEnGaz" && obj.type === "misengaz");

      // Filter by user's assigned poles and directions for non-Super Admins
      const isSuperAdmin = userProfile?.role === "Super Administrateur" || currentUser?.email === "boudjada.youcef@gmail.com";
      const userPoles = userProfile?.assignedPoles || (userProfile?.pole ? [userProfile.pole] : []);
      const userDirections = userProfile?.assignedDirections || (userProfile?.direction ? [userProfile.direction] : []);
      
      const hasPoleAccess = isSuperAdmin || userPoles.length === 0 || userPoles.includes("Tous") || isUserPolesMatched(userPoles, p.identity.pole);
      const hasDirectionAccess = isSuperAdmin || userDirections.length === 0 || userDirections.includes("Tous") || isUserDirectionsMatched(userDirections, p.identity.region);

      return matchesSearch && matchesAnnee && matchesPole && matchesWilaya && matchesDirection && matchesPhase && matchesContrainte && matchesObjectif && hasPoleAccess && hasDirectionAccess;
    });

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className={isFullscreenPlanDeCharge ? "fixed inset-0 z-[50000] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 md:p-8" : "space-y-6"}
      >
        <div className={isFullscreenPlanDeCharge ? "bg-white w-full h-full rounded-2xl shadow-2xl border border-slate-200 p-6 md:p-8 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative" : "bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 relative"}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider text-left block font-mono">Plan de charge centralisé</span>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight mt-0.5 text-left">Suivi d'Ingénierie & Travaux</h2>
              <p className="text-xs text-slate-400 mt-1 text-left">
                Visualisation globale de l'état d'avancement physique, des caractéristiques techniques et des contraintes opérationnelles.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher un ouvrage, wilaya..."
                  value={planDeChargeSearch}
                  onChange={e => setPlanDeChargeSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs outline-none w-52 font-medium text-slate-700 transition-all"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <button
                onClick={() => handlePrintPlanDeCharge(filteredProjects)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                title="Imprimer le plan de charge filtré"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Imprimer</span>
              </button>

              <button
                onClick={() => handleExportPlanDeChargeWord(filteredProjects)}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                title="Exporter le plan de charge filtré sous format Word"
              >
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Exporter Word</span>
              </button>

              <button
                onClick={() => handleExportPlanDeChargePDF(filteredProjects)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                title="Exporter le plan de charge filtré sous format PDF"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>Exporter PDF</span>
              </button>

              {/* Columns Masking Dropdown Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
                    showColumnSelector
                      ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                  title="Afficher/Masquer des colonnes de la table"
                >
                  <EyeOff className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Masquer Colonnes ({AVAILABLE_COLUMNS.length - hiddenColumns.length} visibles)</span>
                </button>

                {showColumnSelector && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowColumnSelector(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 text-left space-y-3 max-h-[350px] overflow-y-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Colonnes de la table</span>
                        <button 
                          type="button"
                          onClick={() => setHiddenColumns([])}
                          className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer"
                        >
                          Tout réinitialiser
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {AVAILABLE_COLUMNS.map((col) => {
                          const isHidden = hiddenColumns.includes(col.key);
                          return (
                            <label 
                              key={col.key} 
                              className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-medium text-slate-700 transition-colors"
                            >
                              <input 
                                type="checkbox" 
                                checked={!isHidden}
                                onChange={() => {
                                  if (isHidden) {
                                    setHiddenColumns(hiddenColumns.filter(c => c !== col.key));
                                  } else {
                                    setHiddenColumns([...hiddenColumns, col.key]);
                                  }
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span>{col.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (isFullscreenPlanDeCharge) {
                      setIsFullscreenPlanDeCharge(false);
                      setMeetingSelectedProject(null);
                    } else {
                      setShowFullscreenMenu(!showFullscreenMenu);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
                    isFullscreenPlanDeCharge
                      ? "bg-slate-900 hover:bg-slate-800 text-white border border-slate-700"
                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100"
                  }`}
                  title={isFullscreenPlanDeCharge ? "Quitter le mode plein écran" : "Passer en mode plein écran"}
                >
                  {isFullscreenPlanDeCharge ? (
                    <>
                      <Minimize2 className="w-4 h-4" />
                      <span>Mode Réduit ({planDeChargeFullscreenMode === "reunion" ? "Réunion" : "Normal"})</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 text-indigo-600" />
                      <span>Plein Écran</span>
                    </>
                  )}
                </button>

                {/* Dropdown for choosing Fullscreen Mode */}
                {!isFullscreenPlanDeCharge && showFullscreenMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowFullscreenMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 block font-mono">Options d'affichage</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPlanDeChargeFullscreenMode("normal");
                          setIsFullscreenPlanDeCharge(true);
                          setShowFullscreenMenu(false);
                        }}
                        className="w-full flex items-start gap-2.5 p-2 hover:bg-slate-50 rounded-xl transition-all cursor-pointer text-left"
                      >
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                          <Maximize2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-700">Mode Normal</div>
                          <div className="text-[9px] text-slate-400 mt-0.5 font-medium leading-tight">Plein écran classique du tableau de suivi.</div>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setPlanDeChargeFullscreenMode("reunion");
                          setIsFullscreenPlanDeCharge(true);
                          setShowFullscreenMenu(false);
                        }}
                        className="w-full flex items-start gap-2.5 p-2 hover:bg-slate-50 rounded-xl transition-all cursor-pointer text-left mt-1"
                      >
                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0 mt-0.5">
                          <Presentation className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-700">Mode Réunion</div>
                          <div className="text-[9px] text-slate-400 mt-0.5 font-medium leading-tight">Tableau interactif + volet d'étapes en split 50/50.</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {hasPrivilege("ajout_projet") && (
                <button
                  onClick={() => {
                    openCreateDialog();
                    setActiveModule("gestion"); // Auto switch to edit view
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau Ouvrage</span>
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filtres d'utilisabilité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 pt-4 pb-2 border-b border-slate-100 text-xs text-left">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Année</label>
              <select
                value={planDeChargeAnnee}
                onChange={e => setPlanDeChargeAnnee(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Tous">Toutes les années</option>
                {uniqueYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Pôle TG</label>
              <select
                value={planDeChargePole}
                onChange={e => setPlanDeChargePole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Tous">Tous les pôles</option>
                {uniquePoles.map(pole => (
                  <option key={pole} value={pole}>{pole}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Direction / Région</label>
              <select
                value={planDeChargeDirection}
                onChange={e => setPlanDeChargeDirection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Tous">Toutes les directions</option>
                {uniqueDirections.map(dir => (
                  <option key={dir} value={dir}>{dir}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Wilaya</label>
              <select
                value={planDeChargeWilaya}
                onChange={e => setPlanDeChargeWilaya(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Tous">Toutes les wilayas</option>
                {uniqueWilayas.map(wilaya => (
                  <option key={wilaya} value={wilaya}>{wilaya}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Phase Actuelle</label>
              <select
                value={planDeChargeFilter}
                onChange={e => setPlanDeChargeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Tous">Toutes les phases</option>
                <option value="Étude">Étude</option>
                <option value="Travaux">Travaux</option>
                <option value="Mise en Gaz">Mise en Gaz</option>
                <option value="Clôturé">Clôturé</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Contraintes</label>
              <select
                value={planDeChargeContrainte}
                onChange={e => setPlanDeChargeContrainte(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Tous">Toutes les contraintes</option>
                <option value="Avec">Avec contraintes ⚠️</option>
                <option value="Sans">Sans contraintes ✅</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Objectif Ouvrage</label>
              <select
                value={planDeChargeObjectif}
                onChange={e => setPlanDeChargeObjectif(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Tous">Tous les objectifs</option>
                <option value="Ouverture">Ouverture chantier 🏗️</option>
                <option value="MiseEnGaz">Mise en gaz ⚡</option>
              </select>
            </div>
          </div>

          <div className={`mt-6 flex-1 min-h-0 ${isFullscreenPlanDeCharge && planDeChargeFullscreenMode === "reunion" && meetingSelectedProject ? "flex gap-6 overflow-hidden" : ""}`}>
            {/* Table Container Column */}
            <div className={`min-w-0 ${isFullscreenPlanDeCharge && planDeChargeFullscreenMode === "reunion" && meetingSelectedProject ? "w-[45%] flex flex-col overflow-hidden border-r border-slate-150 pr-4" : "w-full"}`}>
              <div className={`w-full ${isFullscreenPlanDeCharge ? "overflow-auto flex-1 min-h-0" : "overflow-x-auto"}`}>
                <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/50">
                      {isFullscreenPlanDeCharge && planDeChargeFullscreenMode === "reunion" && (
                        <th className="py-3 px-3 rounded-l-xl text-center w-12">Réunion</th>
                      )}
                      <th className={`py-3 px-4 ${isFullscreenPlanDeCharge && planDeChargeFullscreenMode === "reunion" ? "" : "rounded-l-xl"}`}>Ouvrage</th>
                      {!hiddenColumns.includes("wilaya") && <th className="py-3 px-3">Wilaya</th>}
                      {!hiddenColumns.includes("pole") && <th className="py-3 px-3">Pôle</th>}
                      {!hiddenColumns.includes("region") && <th className="py-3 px-3">Direction</th>}
                      {!hiddenColumns.includes("phase") && <th className="py-3 px-3">Phase</th>}
                      {!hiddenColumns.includes("objective") && <th className="py-3 px-3 text-left">Objectif</th>}
                      {!hiddenColumns.includes("diametre") && <th className="py-3 px-3">Diamètre</th>}
                      {!hiddenColumns.includes("longueur") && <th className="py-3 px-3">Longueur</th>}
                      {!hiddenColumns.includes("capacite") && <th className="py-3 px-3">Capacité Poste</th>}
                      {!hiddenColumns.includes("avGC") && <th className="py-3 px-3">Av. GC</th>}
                      {!hiddenColumns.includes("avMeca") && <th className="py-3 px-3">Av. Méca</th>}
                      {!hiddenColumns.includes("avGlobal") && <th className="py-3 px-3">Av. Global</th>}
                      {!hiddenColumns.includes("contraintes") && <th className="py-3 px-3">Contrainte Majeure</th>}
                      <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredProjects.map((p) => {
                      const hasConstraint = p.identity.contraintes && p.identity.contraintes.trim().length > 0;
                      return (
                        <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors group ${meetingSelectedProject?.id === p.id ? "bg-amber-50/40 hover:bg-amber-50/50" : ""}`}>
                          {isFullscreenPlanDeCharge && planDeChargeFullscreenMode === "reunion" && (
                            <td className="py-4 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setMeetingSelectedProject(p)}
                                className={`p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                                  meetingSelectedProject?.id === p.id
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                                }`}
                                title="Afficher le détail de la réunion"
                              >
                                <Presentation className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                          <td className="py-4 px-4 font-extrabold text-slate-800 leading-normal max-w-xs text-left">
                            <div className="flex items-center gap-2">
                              {/* Tooltip trigger container */}
                              <div className="relative group/info inline-block shrink-0">
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-blue-600 hover:bg-blue-50 border border-slate-200/60 flex items-center justify-center font-bold font-serif text-[11px] cursor-pointer shadow-xs transition-all">
                                  i
                                </span>
                                
                                {/* Floating Tooltip Card */}
                                <div className="absolute left-0 top-full mt-2 w-64 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 hidden group-hover/info:block z-[99] animate-in fade-in slide-in-from-top-1 duration-200 text-left font-normal normal-case">
                                  <div className="space-y-3 text-xs">
                                    <div className="border-b border-slate-800 pb-2 flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      <span className="font-extrabold text-[10px] uppercase text-blue-400 tracking-wider font-mono">Traçabilité du projet</span>
                                    </div>
                                    <div className="space-y-2">
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Dernière Modification</p>
                                        <p className="font-semibold text-slate-200 mt-0.5">
                                          Modifié par <strong className="text-white font-extrabold">{p.updatedByName || "Ingénieur PD&I"}</strong>
                                        </p>
                                        {p.updatedByEmail && (
                                          <p className="text-[9px] text-slate-500 font-mono">{p.updatedByEmail}</p>
                                        )}
                                        <p className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">
                                          le {p.updatedAt ? new Date(p.updatedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Non spécifié"}
                                        </p>
                                      </div>

                                      {p.createdAt && (
                                        <div className="border-t border-slate-800/60 pt-2">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Création Initiale</p>
                                          <p className="font-semibold text-slate-300 mt-0.5">
                                            Créé par <strong className="text-white font-semibold">{p.createdByName || "Ingénieur PD&I"}</strong>
                                          </p>
                                          {p.createdByEmail && (
                                            <p className="text-[9px] text-slate-500 font-mono">{p.createdByEmail}</p>
                                          )}
                                          <p className="text-[10px] text-slate-400 font-mono mt-1">
                                            le {p.createdAt ? new Date(p.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Non spécifié"}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <span className="truncate">{p.name}</span>
                            </div>
                          </td>
                          {!hiddenColumns.includes("wilaya") && <td className="py-4 px-3 font-semibold text-slate-500 text-left">{p.identity.wilaya || "N/A"}</td>}
                          {!hiddenColumns.includes("pole") && <td className="py-4 px-3 font-medium text-slate-500 text-left">{p.identity.pole || "N/A"}</td>}
                          {!hiddenColumns.includes("region") && <td className="py-4 px-3 font-mono text-[11px] text-slate-600 text-left">{p.identity.region || "N/A"}</td>}
                          {!hiddenColumns.includes("phase") && (
                            <td className="py-4 px-3 text-left">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block ${getPhaseBadgeColor(p.identity.phase)}`}>
                                {p.identity.phase}
                              </span>
                            </td>
                          )}
                          {!hiddenColumns.includes("objective") && (
                            <td className="py-4 px-3 text-left">
                              {(() => {
                                const obj = getProjectObjective(p);
                                return (
                                  <div className="space-y-0.5">
                                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold block w-max uppercase tracking-wider ${
                                      obj.type === "ouverture"
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : obj.type === "misengaz"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : "bg-slate-100 text-slate-500 border border-slate-200"
                                    }`}>
                                      {obj.label}
                                    </span>
                                    {obj.date ? (
                                      <span className="text-[10px] font-mono text-slate-500 font-bold block">
                                        {new Date(obj.date).toLocaleDateString("fr-FR")}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic block">Non défini</span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          )}
                          {/* New Columns */}
                          {!hiddenColumns.includes("diametre") && <td className="py-4 px-3 font-mono text-slate-700 font-bold">{p.identity.caracteristiques?.diametre || "N/A"}</td>}
                          {!hiddenColumns.includes("longueur") && (
                            <td className="py-4 px-3 font-mono text-slate-700 font-bold">
                              {getProjectDisplayLength(p) !== "0" ? `${getProjectDisplayLength(p)} km` : "N/A"}
                            </td>
                          )}
                          {!hiddenColumns.includes("capacite") && (
                            <td className="py-4 px-3 font-mono text-slate-600">
                              {p.identity.caracteristiques?.capacitePoste || p.ficheSuivi?.capPoste || "N/A"}
                            </td>
                          )}
                          {!hiddenColumns.includes("avGC") && (
                            <td className="py-4 px-3 font-mono font-bold text-blue-600 align-top">
                              <div>{p.travauxPlanification?.avancementGC !== undefined ? `${p.travauxPlanification.avancementGC}%` : "0%"}</div>
                              {p.lots && p.lots.length > 0 && (
                                <div className="mt-1 space-y-0.5 pt-1 border-t border-slate-100 text-[9px] font-normal text-slate-500">
                                  {p.lots.map((l, lIdx) => (
                                    <div key={l.id || lIdx} className="truncate" title={`${l.name || `Lot ${lIdx + 1}`}: ${l.avancementGC || 0}%`}>
                                      <span className="font-semibold text-slate-700">{l.name ? (l.name.length > 10 ? l.name.substring(0, 10) + '...' : l.name) : `L${lIdx + 1}`}:</span> {l.avancementGC || 0}%
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          )}
                          {!hiddenColumns.includes("avMeca") && (
                            <td className="py-4 px-3 font-mono font-bold text-emerald-600 align-top">
                              <div>{p.travauxPlanification?.avancementMeca !== undefined ? `${p.travauxPlanification.avancementMeca}%` : "0%"}</div>
                              {p.lots && p.lots.length > 0 && (
                                <div className="mt-1 space-y-0.5 pt-1 border-t border-slate-100 text-[9px] font-normal text-slate-500">
                                  {p.lots.map((l, lIdx) => (
                                    <div key={l.id || lIdx} className="truncate" title={`${l.name || `Lot ${lIdx + 1}`}: ${l.avancementMeca || 0}%`}>
                                      <span className="font-semibold text-slate-700">{l.name ? (l.name.length > 10 ? l.name.substring(0, 10) + '...' : l.name) : `L${lIdx + 1}`}:</span> {l.avancementMeca || 0}%
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          )}
                          {!hiddenColumns.includes("avGlobal") && (
                            <td className="py-4 px-3 align-top">
                              <div className="flex items-center gap-2 w-24">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${p.travauxPlanification?.avancementPhysique || 0}%` }}
                                  />
                                </div>
                                <span className="font-black text-slate-700 w-8 text-right font-mono text-[11px]">
                                  {p.travauxPlanification?.avancementPhysique || 0}%
                                </span>
                              </div>
                              {p.lots && p.lots.length > 0 && (
                                <div className="mt-1 space-y-0.5 pt-1 border-t border-slate-100 font-mono text-[9px] font-normal text-slate-500">
                                  {p.lots.map((l, lIdx) => (
                                    <div key={l.id || lIdx} className="flex items-center justify-between gap-1" title={`${l.name || `Lot ${lIdx + 1}`}: ${l.avancementPhysique || 0}%`}>
                                      <span className="font-semibold text-slate-700 truncate max-w-[60px]">{l.name ? (l.name.length > 8 ? l.name.substring(0, 8) + '...' : l.name) : `L${lIdx + 1}`}:</span>
                                      <span className="font-bold text-slate-800">{l.avancementPhysique || 0}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          )}
                          {!hiddenColumns.includes("contraintes") && (
                            <td className="py-4 px-3 max-w-xs text-left">
                              {hasConstraint ? (
                                <div className="flex items-start gap-1.5 p-2 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                  <span className="text-[10px] font-medium leading-relaxed line-clamp-2">
                                    {p.identity.contraintes}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-emerald-700">
                                  <Check className="w-4 h-4 text-emerald-500 animate-pulse" />
                                  <span className="text-[10px] font-semibold">Aucune contrainte</span>
                                </div>
                              )}
                            </td>
                          )}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProjectId(p.id);
                                  setActiveModule("gestion");
                                  setActiveSubTab("identity");
                                  setIsFullscreenPlanDeCharge(false);
                                }}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold transition-all flex items-center justify-center cursor-pointer active:scale-90"
                                title="Voir détail (Fiche d'identité)"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProjectId(p.id);
                                  setActiveModule("gestion");
                                  setActiveSubTab("planning");
                                  setIsFullscreenPlanDeCharge(false);
                                }}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold transition-all flex items-center justify-center cursor-pointer active:scale-90"
                                title="Consulter planning & avancement"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingConstraintsProjectId(p.id);
                                  setTempConstraintsText(p.identity.contraintes || "");
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-all flex items-center justify-center cursor-pointer active:scale-90"
                                title="Modifier contraintes"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {hasPrivilege("ajout_projet") && (
                                <button
                                  type="button"
                                  onClick={() => setProjectToDelete(p)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold transition-all flex items-center justify-center cursor-pointer active:scale-90"
                                  title="Supprimer définitivement ce projet"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProjects.length === 0 && (
                      <tr>
                        <td colSpan={15 - hiddenColumns.length + (isFullscreenPlanDeCharge && planDeChargeFullscreenMode === "reunion" ? 1 : 0)} className="text-center py-8 text-slate-400 italic">
                          Aucun projet correspondant aux critères.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column (Mode Réunion project details) */}
            {isFullscreenPlanDeCharge && planDeChargeFullscreenMode === "reunion" && (
              <div className={`transition-all duration-300 ${meetingSelectedProject ? "w-[55%] flex flex-col" : "w-0 hidden"} bg-slate-50/70 border-l border-slate-200 rounded-r-2xl overflow-hidden`}>
                {meetingSelectedProject ? (
                  <div className="h-full flex flex-col overflow-hidden">
                    {/* Header of details panel */}
                    <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between shadow-xs shrink-0">
                      <div className="min-w-0 flex-1 pr-3">
                        <span className="text-[9px] font-black uppercase text-amber-600 tracking-wider block font-mono">Fiche Réunion de Chantier</span>
                        <h3 className="text-sm font-black text-slate-800 truncate leading-tight mt-0.5">{meetingSelectedProject.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${getPhaseBadgeColor(meetingSelectedProject.identity.phase)}`}>
                            {meetingSelectedProject.identity.phase}
                          </span>
                          <span className="text-[10px] text-slate-450 font-bold">{meetingSelectedProject.identity.pole} • {meetingSelectedProject.identity.wilaya}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMeetingSelectedProject(null)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
                        title="Réduire pour repasser en plein écran"
                      >
                        <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Réduire</span>
                      </button>
                    </div>

                    {/* Content of details panel */}
                    <div className="p-5 overflow-y-auto space-y-6 flex-1 text-slate-750">
                      {/* Step 1: Études & Autorisations Administratives */}
                      <div className="bg-white border border-slate-200/65 p-4 rounded-2xl space-y-3 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold">
                              <Layers className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">1. Étude & Autorisations Administratives</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                            meetingSelectedProject.etudeAutorisation?.statutEtude === "Approuvée"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : meetingSelectedProject.etudeAutorisation?.statutEtude === "En cours"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            Étude : {meetingSelectedProject.etudeAutorisation?.statutEtude || "Non commencée"}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Permis de Construire</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${
                                meetingSelectedProject.etudeAutorisation?.statutPermisConstruire === "Reçu" 
                                  ? "bg-emerald-500 animate-pulse" 
                                  : meetingSelectedProject.etudeAutorisation?.statutPermisConstruire?.includes("En cours") 
                                  ? "bg-amber-500 animate-pulse" 
                                  : "bg-slate-350"
                              }`} />
                              <span className="font-extrabold text-slate-700">
                                {meetingSelectedProject.etudeAutorisation?.statutPermisConstruire || "Non déposé"}
                              </span>
                            </div>
                            {meetingSelectedProject.etudeAutorisation?.datePermisConstruire && (
                              <span className="text-[10px] text-slate-400 font-bold block">
                                Date d'obtention : {meetingSelectedProject.etudeAutorisation.datePermisConstruire}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Arrêté de Servitude (DUP)</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${
                                meetingSelectedProject.etudeAutorisation?.statutArreteServitude?.includes("Signé") 
                                  ? "bg-emerald-500 animate-pulse" 
                                  : meetingSelectedProject.etudeAutorisation?.statutArreteServitude?.includes("En cours") 
                                  ? "bg-amber-500 animate-pulse" 
                                  : "bg-slate-350"
                              }`} />
                              <span className="font-extrabold text-slate-700">
                                {meetingSelectedProject.etudeAutorisation?.statutArreteServitude || "Non lancé"}
                              </span>
                            </div>
                            {meetingSelectedProject.etudeAutorisation?.arreteServitudeRef && (
                              <span className="text-[10px] text-slate-450 font-bold block truncate" title={meetingSelectedProject.etudeAutorisation.arreteServitudeRef}>
                                Réf : {meetingSelectedProject.etudeAutorisation.arreteServitudeRef}
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-2 border-t border-slate-100 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Expertise Foncière (GEF)</span>
                              <span className="font-bold text-slate-700 block">
                                {meetingSelectedProject.etudeAutorisation?.expertiseFonciere?.gefDesignated 
                                  ? `✓ Désigné : ${meetingSelectedProject.etudeAutorisation.expertiseFonciere.gefIdentity || "Oui"}` 
                                  : "✗ Géomètre Expert non désigné"}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Dossier d'acquisition</span>
                              <span className="font-bold text-slate-700 block">
                                {meetingSelectedProject.etudeAutorisation?.expertiseFonciere?.acquisitionDemandEstablished 
                                  ? "✓ Dossier d'acquisition établi" 
                                  : "✗ Dossier d'acquisition non établi"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Planification Temporelle */}
                      <div className="bg-white border border-slate-200/65 p-4 rounded-2xl space-y-3 shadow-xs">
                        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                          <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg font-bold">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">2. Planification & Dates Clés</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-black uppercase text-slate-400 block font-mono">Phase Études</span>
                            <div className="font-bold text-slate-700 mt-1">
                              {meetingSelectedProject.planning?.etudeStart ? `Du ${new Date(meetingSelectedProject.planning.etudeStart).toLocaleDateString("fr-FR")}` : "Non spécifié"}
                            </div>
                            <div className="font-bold text-slate-700">
                              {meetingSelectedProject.planning?.etudeEnd ? `Au ${new Date(meetingSelectedProject.planning.etudeEnd).toLocaleDateString("fr-FR")}` : "Non spécifié"}
                            </div>
                          </div>

                          <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-black uppercase text-slate-400 block font-mono">Phase Travaux</span>
                            <div className="font-bold text-slate-700 mt-1">
                              {meetingSelectedProject.planning?.travauxStart ? `Du ${new Date(meetingSelectedProject.planning.travauxStart).toLocaleDateString("fr-FR")}` : "Non spécifié"}
                            </div>
                            <div className="font-bold text-slate-700">
                              {meetingSelectedProject.planning?.travauxEnd ? `Au ${new Date(meetingSelectedProject.planning.travauxEnd).toLocaleDateString("fr-FR")}` : "Non spécifié"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Avancement Physique & Génie Civil */}
                      <div className="bg-white border border-slate-200/65 p-4 rounded-2xl space-y-4 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg font-bold">
                              <TrendingUp className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">3. Avancement Physique & Travaux</span>
                          </div>
                          
                          <div className="flex items-center gap-1 bg-blue-50 text-blue-800 font-black text-xs font-mono px-2.5 py-1 rounded-lg">
                            Global : {meetingSelectedProject.travauxPlanification?.avancementPhysique || 0}%
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                              <span>Avancement Génie Civil (GC)</span>
                              <span className="font-mono">{meetingSelectedProject.travauxPlanification?.avancementGC || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${meetingSelectedProject.travauxPlanification?.avancementGC || 0}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                              <span>Avancement Montage Mécanique</span>
                              <span className="font-mono">{meetingSelectedProject.travauxPlanification?.avancementMeca || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${meetingSelectedProject.travauxPlanification?.avancementMeca || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quality Assurance Checklist */}
                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2">
                          <span className="text-[9px] font-black uppercase text-slate-400 block font-mono">Assurance Qualité & Conformité</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5 font-bold">
                              {meetingSelectedProject.travauxPlanification?.controleQualiteChecklist?.abaqueSoudageValide ? (
                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-slate-350 shrink-0" />
                              )}
                              <span>Abaque de soudage validé</span>
                            </div>

                            <div className="flex items-center gap-1.5 font-bold">
                              {meetingSelectedProject.travauxPlanification?.controleQualiteChecklist?.radiographieCND ? (
                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-slate-350 shrink-0" />
                              )}
                              <span>Contrôle non destructif (Radio/CND)</span>
                            </div>

                            <div className="flex items-center gap-1.5 font-bold">
                              {meetingSelectedProject.travauxPlanification?.controleQualiteChecklist?.enrobageVerifie ? (
                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-slate-350 shrink-0" />
                              )}
                              <span>Contrôle de l'enrobage</span>
                            </div>

                            <div className="flex items-center gap-1.5 font-bold">
                              {meetingSelectedProject.travauxPlanification?.controleQualiteChecklist?.litPoseSableux ? (
                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-slate-350 shrink-0" />
                              )}
                              <span>Lit de pose sableux vérifié</span>
                            </div>

                            <div className="flex items-center gap-1.5 sm:col-span-2 border-t border-slate-200/50 pt-1.5 mt-0.5 font-bold">
                              {meetingSelectedProject.travauxPlanification?.controleQualiteChecklist?.protectionCathodique ? (
                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-slate-350 shrink-0" />
                              )}
                              <span>Protection cathodique en place</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 4: Essais Réglementaires */}
                      <div className="bg-white border border-slate-200/65 p-4 rounded-2xl space-y-3 shadow-xs">
                        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold">
                            <FileCheck className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">4. Épreuves & Essais Réglementaires</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Épreuve de Résistance</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              meetingSelectedProject.travauxPlanification?.essaisReglementaires?.epreuveResistance === "Réussie"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : meetingSelectedProject.travauxPlanification?.essaisReglementaires?.epreuveResistance === "En cours"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}>
                              {meetingSelectedProject.travauxPlanification?.essaisReglementaires?.epreuveResistance || "Non faite"}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Épreuve d'Étanchéité</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              meetingSelectedProject.travauxPlanification?.essaisReglementaires?.epreuveEtancheite === "Réussie"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : meetingSelectedProject.travauxPlanification?.essaisReglementaires?.epreuveEtancheite === "En cours"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}>
                              {meetingSelectedProject.travauxPlanification?.essaisReglementaires?.epreuveEtancheite || "Non faite"}
                            </span>
                          </div>

                          {meetingSelectedProject.travauxPlanification?.essaisReglementaires?.organismeControleur && (
                            <div className="sm:col-span-2 border-t border-slate-100 pt-2 text-slate-500 font-bold text-[11px]">
                              Organisme de contrôle : <span className="text-slate-800 font-extrabold">{meetingSelectedProject.travauxPlanification.essaisReglementaires.organismeControleur}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 5: Mise en Gaz */}
                      <div className="bg-white border border-slate-200/65 p-4 rounded-2xl space-y-3 shadow-xs">
                        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg font-bold">
                            <Archive className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">5. Mise en Gaz & Clôture</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Statut de Mise en Gaz</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                              meetingSelectedProject.miseEnGazArchive?.statutMiseEnGaz === "Réalisée"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : meetingSelectedProject.miseEnGazArchive?.statutMiseEnGaz === "Prête"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : meetingSelectedProject.miseEnGazArchive?.statutMiseEnGaz === "Planifiée"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}>
                              {meetingSelectedProject.miseEnGazArchive?.statutMiseEnGaz || "Non planifiée"}
                            </span>
                          </div>

                          {meetingSelectedProject.miseEnGazArchive?.dateEffectiveMiseEnGaz && (
                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-mono">Date Effective</span>
                              <span className="font-extrabold text-slate-700 block text-[11px]">
                                {new Date(meetingSelectedProject.miseEnGazArchive.dateEffectiveMiseEnGaz).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400 text-center space-y-2">
                    <Presentation className="w-10 h-10 text-slate-300 animate-pulse" />
                    <p className="text-xs font-black uppercase tracking-wider">Aucun ouvrage sélectionné</p>
                    <p className="text-[11px] text-slate-400 max-w-xs leading-normal">
                      Veuillez cliquer sur le bouton de réunion d'un ouvrage dans le tableau pour afficher son résumé d'étapes.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Constraint Quick Edit Modal */}
        {editingConstraintsProjectId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in text-left">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <h3 className="font-black text-sm uppercase tracking-wide">Mise à Jour des Contraintes</h3>
                </div>
                <button 
                  onClick={() => setEditingConstraintsProjectId(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-xs font-black text-slate-700 mb-1">
                  Ouvrage : {projects.find(p => p.id === editingConstraintsProjectId)?.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  Saisissez les oppositions de tiers, contraintes d'emprises, retards de livraison ou obstacles administratifs. Laissez vide s'il n'y a plus de contrainte.
                </p>
              </div>

              <textarea
                value={tempConstraintsText}
                onChange={e => setTempConstraintsText(e.target.value)}
                placeholder="Opposition de propriétaire parcelle PK 12, retards de signature de l'arrêté par la wilaya..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none min-h-[100px] focus:border-rose-500 font-medium text-slate-700"
              />

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setEditingConstraintsProjectId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveConstraintsQuickly}
                  disabled={isSavingConstraints}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-55 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingConstraints ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Enregistrer</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );

}
