import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Search, Trash2, Printer, FileText, Edit3, Activity, TrendingUp, Sliders,
  Briefcase, Calendar, Layers, FileCheck, Archive
} from 'lucide-react';
import { Project, FicheSuivi, PlanDeControleItemStatus } from '../types';
import { getProjectDisplayLength } from '../projectUtils';
import { EditProjectForm } from './gestion/EditProjectForm';
import { PlanningTab } from './gestion/PlanningTab';
import { IdentityTab } from './gestion/IdentityTab';
import { EtudeTab } from './gestion/EtudeTab';
import { ExpertiseTab } from './gestion/ExpertiseTab';
import { TravauxTab } from './gestion/TravauxTab';
import { GazTab } from './gestion/GazTab';

export interface GestionProjetViewProps {
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedProject: Project | null;
  activeSubTab: 'planning' | 'identity' | 'etude' | 'expertise' | 'travaux' | 'gaz' | 'bordereau';
  setActiveSubTab: (tab: 'planning' | 'identity' | 'etude' | 'expertise' | 'travaux' | 'gaz' | 'bordereau') => void;
  uniqueYears: string[];
  uniquePoles?: string[];
  uniqueDirections?: string[];
  uniqueWilayas?: string[];
  hasPrivilege: (key: string) => boolean;
  profilesList?: any[];
  currentUser?: any;
  handlePrintPlanDeCharge?: (projects: Project[]) => void;
  handleExportPlanDeChargeWord?: (projects: Project[]) => void;
  handleExportPlanDeChargePDF?: (projects: Project[]) => void;
  handleExportGenesisWord?: (project: Project) => void;
  handleExportGenesisPDF?: (project: Project) => void;
  handleDownloadKMZ?: (project: Project) => void;
  handleUploadKMZ?: (event: React.ChangeEvent<HTMLInputElement>, project: Project) => void;
  handleDeleteKMZ?: (project: Project) => void;
}

export function GestionProjetView({
  projects,
  selectedProjectId,
  setSelectedProjectId,
  selectedProject,
  activeSubTab,
  setActiveSubTab,
  uniqueYears,
  uniquePoles = ['Tous'],
  uniqueDirections = ['Tous'],
  uniqueWilayas = ['Tous'],
  hasPrivilege,
  profilesList = [],
  currentUser,
  handleDownloadKMZ = () => {},
  handleUploadKMZ = () => {},
  handleDeleteKMZ = () => {},
}: GestionProjetViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editProjectData, setEditProjectData] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isCPSearchOpen, setIsCPSearchOpen] = useState(false);
  const [cpSearchType, setCpSearchType] = useState<'travaux' | 'etude' | 'expertise' | 'superviseurs'>('travaux');
  const [cpSearchQuery, setCpSearchQuery] = useState('');
  const [editingLotContractsId, setEditingLotContractsId] = useState<string | null>(null);
  const [isEditingFicheSuivi, setIsEditingFicheSuivi] = useState(false);
  const [ficheSuiviForm, setFicheSuiviForm] = useState<FicheSuivi>({} as FicheSuivi);
  const [isSavingFicheSuivi, setIsSavingFicheSuivi] = useState(false);
  const [isEditingMateriel, setIsEditingMateriel] = useState(false);
  const [tempMateriel, setTempMateriel] = useState<any>({});
  const [travauxProgressTab, setTravauxProgressTab] = useState<'ligne' | 'postes'>('ligne');
  const [activeTravauxLotId, setActiveTravauxLotId] = useState<string>('');
  const [isEditingTravauxProgress, setIsEditingTravauxProgress] = useState(false);
  const [tempTravauxLigne, setTempTravauxLigne] = useState<any[]>([]);
  const [tempTravauxPostes, setTempTravauxPostes] = useState<any[]>([]);
  const [tempLongueur, setTempLongueur] = useState('');
  const [expandedPlanDeControleItem, setExpandedPlanDeControleItem] = useState<string | null>(null);
  const [editPlanItemFields, setEditPlanItemFields] = useState<PlanDeControleItemStatus>({ dateControle: '', resultat: 'NC', etalonnage: '', action: '', dateNouveauControle: '', resultatNouveau: 'NC', observation: '' });
  const [isSavingPlanItem, setIsSavingPlanItem] = useState(false);
  const [planDeControleSearch, setPlanDeControleSearch] = useState('');
  const [planDeControleFilter, setPlanDeControleFilter] = useState('Tous');
  const [newDocName, setNewDocName] = useState('');
  const [newDocCat, setNewDocCat] = useState('Autre');

  const startEditing = () => {
    if (selectedProject) {
      setEditProjectData(JSON.parse(JSON.stringify(selectedProject)));
      setIsEditing(true);
    }
  };

  const handleCreateProject = async () => {};
  const saveProjectChanges = async () => { setIsEditing(false); };
  const handleSaveFicheSuivi = async () => { setIsEditingFicheSuivi(false); };
  const handleToggleExpandPlanItem = (ord: string) => { setExpandedPlanDeControleItem(prev => prev === ord ? null : ord); };
  const handleSavePlanDeControleItem = async (ord: string) => {};
  const addArchiveDocument = async () => {};
  const removeArchiveDocument = async (docId: string) => {};
  const renderBordereauPrixContent = (p: Project) => <div className="p-4 text-xs font-bold text-slate-500">Bordereau {p.name}</div>;
  const handlePrintFicheProjet = (p: Project) => {};
  const handleExportFicheProjetWord = (p: Project) => {};
  const handleExportFicheProjetPDF = (p: Project) => {};
  const canEditProject = (p: any) => true;
  const [gestionSearchProjet, setGestionSearchProjet] = useState<string>('');
  const [gestionFilterAnnee, setGestionFilterAnnee] = useState<string>('Tous');
  const [gestionFilterPole, setGestionFilterPole] = useState<string>('Tous');
  const [gestionFilterWilaya, setGestionFilterWilaya] = useState<string>('Tous');
  const [gestionFilterDirection, setGestionFilterDirection] = useState<string>('Tous');

  const getPhaseBadgeColor = (phase: string) => {
    switch (phase) {
      case 'Étude': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Travaux': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Mise en Gaz': return 'bg-green-100 text-green-800 border-green-200 animate-pulse';
      case 'Clôturé': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const filteredGestionProjects = projects.filter(p => {
    const searchLower = gestionSearchProjet.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchLower);
    const pYear = p.planning?.etudeStart ? p.planning.etudeStart.substring(0, 4) : (p.createdAt ? p.createdAt.substring(0, 4) : '2026');
    const matchesAnnee = gestionFilterAnnee === 'Tous' || pYear === gestionFilterAnnee;
    const matchesPole = gestionFilterPole === 'Tous' || p.identity.pole === gestionFilterPole;
    const matchesDirection = gestionFilterDirection === 'Tous' || p.identity.region === gestionFilterDirection;
    const matchesWilaya = gestionFilterWilaya === 'Tous' || p.identity.wilaya === gestionFilterWilaya;
    return matchesSearch && matchesAnnee && matchesPole && matchesDirection && matchesWilaya;
  });

  return (
    <motion.div
      key="gestion-content"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      {/* Gestion de projet Search & Advanced Filter Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono">Module d'Ingénierie</span>
            <h3 className="text-lg font-black text-slate-800">Gestion de projet détaillée</h3>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher par nom d'ouvrage..."
              value={gestionSearchProjet}
              onChange={e => setGestionSearchProjet(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs outline-none w-64 font-medium text-slate-700 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">Année</label>
            <select
              value={gestionFilterAnnee}
              onChange={e => setGestionFilterAnnee(e.target.value)}
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
              value={gestionFilterPole}
              onChange={e => setGestionFilterPole(e.target.value)}
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
              value={gestionFilterDirection}
              onChange={e => setGestionFilterDirection(e.target.value)}
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
              value={gestionFilterWilaya}
              onChange={e => setGestionFilterWilaya(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="Tous">Toutes les wilayas</option>
              {uniqueWilayas.map(wilaya => (
                <option key={wilaya} value={wilaya}>{wilaya}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Projets Filtrés Horizontal Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
            Ouvrages Sélectionnés ({filteredGestionProjects.length})
          </span>
          <span className="text-[10px] text-slate-400 font-semibold italic">Faites défiler horizontalement ➔</span>
        </div>

        <div className="flex overflow-x-auto whitespace-nowrap gap-3 pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-200 scroll-smooth">
          {filteredGestionProjects.map((p) => {
            const isActive = selectedProjectId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  if (!isEditing) {
                    setSelectedProjectId(p.id);
                    setActiveSubTab('planning');
                  }
                }}
                className={`inline-flex flex-col justify-between gap-2 p-3.5 rounded-2xl cursor-pointer transition-all border text-left min-w-[240px] max-w-[280px] group relative ${
                  isActive
                    ? 'bg-gradient-to-br from-blue-700 to-blue-800 text-white border-blue-950 shadow-md scale-[1.01]'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/60'
                } ${isEditing ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="truncate">
                  <h5 className={`font-black text-xs leading-tight truncate ${isActive ? 'text-white' : 'text-slate-800'}`} title={p.name}>
                    {p.name}
                  </h5>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                      isActive ? 'bg-white/10 text-white border-white/20' : getPhaseBadgeColor(p.identity.phase)
                    }`}>
                      {p.identity.phase}
                    </span>
                    <span className={`text-[9px] font-mono font-bold uppercase truncate ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                      {p.identity.region}
                    </span>
                  </div>
                </div>

                {hasPrivilege('ajout_projet') && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDelete(p.id);
                    }}
                    className={`absolute top-2 right-2 p-1 rounded-md transition-colors ${
                      isActive ? 'text-white/60 hover:text-red-300 hover:bg-white/10' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'
                    } opacity-0 group-hover:opacity-100 z-10`}
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {filteredGestionProjects.length === 0 && (
            <p className="text-xs text-slate-400 italic py-3 w-full text-center">Aucun ouvrage ne correspond à vos filtres.</p>
          )}
        </div>
      </div>

      {/* Main Area - Project Details with Phase Tabs */}
      <div className="w-full space-y-6">
        {isEditing && editProjectData ? (
          <EditProjectForm
            editProjectData={editProjectData}
            setEditProjectData={setEditProjectData}
            isCreating={isCreating}
            setIsEditing={setIsEditing}
            setIsCreating={setIsCreating}
            handleCreateProject={handleCreateProject}
            saveProjectChanges={saveProjectChanges}
            setIsCPSearchOpen={setIsCPSearchOpen}
            setCpSearchType={setCpSearchType}
            setCpSearchQuery={setCpSearchQuery}
            profilesList={profilesList}
          />
        ) : selectedProject ? (
          <div className="space-y-6">
            {/* Project Banner Header */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-2.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${getPhaseBadgeColor(selectedProject.identity.phase)}`}>
                      Phase Actuelle : {selectedProject.identity.phase}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 uppercase tracking-wide">
                      {selectedProject.identity.region}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 leading-tight break-words">
                    {selectedProject.name}
                  </h3>
                </div>

                <div className="flex flex-col gap-2 shrink-0 w-full md:w-52">
                  <button
                    onClick={() => handlePrintFicheProjet(selectedProject)}
                    className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-xs cursor-pointer active:scale-95"
                    title="Imprimer le dossier complet du projet"
                  >
                    <Printer className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Imprimer Fiche</span>
                  </button>
                  <button
                    onClick={() => handleExportFicheProjetWord(selectedProject)}
                    className="w-full px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-xs cursor-pointer active:scale-95"
                    title="Exporter le dossier complet du projet sous format Word"
                  >
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Exporter Word</span>
                  </button>
                  <button
                    onClick={() => handleExportFicheProjetPDF(selectedProject)}
                    className="w-full px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-xs cursor-pointer active:scale-95"
                    title="Exporter le dossier complet du projet sous format PDF"
                  >
                    <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Exporter PDF</span>
                  </button>
                  {hasPrivilege('ajout_projet') && (
                    <button
                      onClick={startEditing}
                      className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-md shadow-blue-600/10 cursor-pointer active:scale-95"
                    >
                      <Edit3 className="w-4 h-4 text-white shrink-0" />
                      <span>Modifier les fiches</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Technical summary pill cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                  <Activity className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Diamètre</p>
                    <p className="font-extrabold text-slate-800">{selectedProject.identity.caracteristiques.diametre || 'N/A'}</p>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Longueur</p>
                    <p className="font-extrabold text-slate-800">{getProjectDisplayLength(selectedProject) !== '0' ? `${getProjectDisplayLength(selectedProject)} km` : 'N/A'}</p>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                  <Sliders className="w-5 h-5 text-yellow-600 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Pression</p>
                    <p className="font-extrabold text-slate-800">{selectedProject.identity.caracteristiques.pression || 'N/A'}</p>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Cadre</p>
                    <p className="font-extrabold text-slate-800 line-clamp-1">{selectedProject.identity.cadreInscription || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tabs Navigators inside the Project details */}
            <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto gap-1">
              <button
                onClick={() => setActiveSubTab('planning')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                  activeSubTab === 'planning' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4 text-orange-500" />
                <span>00- Planification</span>
              </button>
              <button
                onClick={() => setActiveSubTab('identity')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                  activeSubTab === 'identity' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Briefcase className="w-4 h-4 text-blue-500" />
                <span>01- Identité</span>
              </button>
              {hasPrivilege('section_etude') && (
                <>
                  <button
                    onClick={() => setActiveSubTab('etude')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                      activeSubTab === 'etude' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-yellow-500" />
                    <span>02- Études & Permis</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('expertise')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                      activeSubTab === 'expertise' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <FileCheck className="w-4 h-4 text-emerald-500" />
                    <span>03- Expertise & Indemnisation</span>
                  </button>
                </>
              )}
              {hasPrivilege('section_travaux') && (
                <button
                  onClick={() => setActiveSubTab('travaux')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                    activeSubTab === 'travaux' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span>04- Travaux & Épreuves</span>
                </button>
              )}
              <button
                onClick={() => setActiveSubTab('gaz')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                  activeSubTab === 'gaz' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Archive className="w-4 h-4 text-green-500" />
                <span>05- Mise en Gaz</span>
              </button>
            </div>

            {/* Sub-Tab Contents */}
            <motion.div
              layoutId="projectSubTabContent"
              className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm min-h-[300px] flex flex-col justify-between"
            >
              {activeSubTab === 'planning' && <PlanningTab selectedProject={selectedProject} />}

              {activeSubTab === 'identity' && (
                <IdentityTab
                  selectedProject={selectedProject}
                  hasPrivilege={hasPrivilege}
                  setActiveSubTab={setActiveSubTab}
                  setEditingLotContractsId={setEditingLotContractsId}
                  handleDownloadKMZ={handleDownloadKMZ}
                  handleUploadKMZ={handleUploadKMZ}
                  handleDeleteKMZ={handleDeleteKMZ}
                />
              )}

              {activeSubTab === 'etude' && (
                <EtudeTab
                  selectedProject={selectedProject}
                  isEditingFicheSuivi={isEditingFicheSuivi}
                  setIsEditingFicheSuivi={setIsEditingFicheSuivi}
                  ficheSuiviForm={ficheSuiviForm}
                  setFicheSuiviForm={setFicheSuiviForm}
                  isSavingFicheSuivi={isSavingFicheSuivi}
                  hasPrivilege={hasPrivilege}
                  handleSaveFicheSuivi={handleSaveFicheSuivi}
                />
              )}

              {activeSubTab === 'expertise' && (
                <ExpertiseTab
                  selectedProject={selectedProject}
                  isEditingFicheSuivi={isEditingFicheSuivi}
                  setIsEditingFicheSuivi={setIsEditingFicheSuivi}
                  ficheSuiviForm={ficheSuiviForm}
                  setFicheSuiviForm={setFicheSuiviForm}
                  isSavingFicheSuivi={isSavingFicheSuivi}
                  hasPrivilege={hasPrivilege}
                  handleSaveFicheSuivi={handleSaveFicheSuivi}
                />
              )}

              {activeSubTab === 'travaux' && (
                <TravauxTab
                  selectedProject={selectedProject}
                  hasPrivilege={hasPrivilege}
                  isEditingMateriel={isEditingMateriel}
                  setIsEditingMateriel={setIsEditingMateriel}
                  tempMateriel={tempMateriel}
                  setTempMateriel={setTempMateriel}
                  travauxProgressTab={travauxProgressTab}
                  setTravauxProgressTab={setTravauxProgressTab}
                  activeTravauxLotId={activeTravauxLotId}
                  setActiveTravauxLotId={setActiveTravauxLotId}
                  isEditingTravauxProgress={isEditingTravauxProgress}
                  setIsEditingTravauxProgress={setIsEditingTravauxProgress}
                  tempTravauxLigne={tempTravauxLigne}
                  setTempTravauxLigne={setTempTravauxLigne}
                  tempTravauxPostes={tempTravauxPostes}
                  setTempTravauxPostes={setTempTravauxPostes}
                  tempLongueur={tempLongueur}
                  setTempLongueur={setTempLongueur}
                  expandedPlanDeControleItem={expandedPlanDeControleItem}
                  editPlanItemFields={editPlanItemFields}
                  setEditPlanItemFields={setEditPlanItemFields}
                  isSavingPlanItem={isSavingPlanItem}
                  planDeControleSearch={planDeControleSearch}
                  setPlanDeControleSearch={setPlanDeControleSearch}
                  planDeControleFilter={planDeControleFilter}
                  setPlanDeControleFilter={setPlanDeControleFilter}
                  handleToggleExpandPlanItem={handleToggleExpandPlanItem}
                  handleSavePlanDeControleItem={handleSavePlanDeControleItem}
                />
              )}

              {activeSubTab === 'gaz' && (
                <GazTab
                  selectedProject={selectedProject}
                  newDocName={newDocName}
                  setNewDocName={setNewDocName}
                  newDocCat={newDocCat}
                  setNewDocCat={setNewDocCat}
                  addArchiveDocument={addArchiveDocument}
                  removeArchiveDocument={removeArchiveDocument}
                />
              )}

              {activeSubTab === 'bordereau' && selectedProject && renderBordereauPrixContent(selectedProject)}

              {/* Created/Updated indicators */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono mt-4">
                <span>Créé le : {new Date(selectedProject.createdAt || Date.now()).toLocaleDateString('fr-FR')}</span>
                <span>Mis à jour : {new Date(selectedProject.updatedAt || Date.now()).toLocaleString('fr-FR')}</span>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center text-slate-400 space-y-4">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-bold">Aucun ouvrage sélectionné. Veuillez en sélectionner un dans la barre d'ouvrages ci-dessus.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
