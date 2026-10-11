import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, Briefcase, Activity, FileCheck, Shield, RefreshCw } from 'lucide-react';
import { Project } from './project-management/types';
import { useProjectsData } from './project-management/hooks/useProjectsData';
import { useExportHandlers } from './project-management/hooks/useExportHandlers';
import { PlanDeChargeView } from './project-management/views/PlanDeChargeView';
import { TableauDeBordView } from './project-management/views/TableauDeBordView';
import { BordereauPrixView } from './project-management/views/BordereauPrixView';
import { RapportMensuelView } from './project-management/views/RapportMensuelView';
import { GestionProjetView } from './project-management/views/GestionProjetView';

// Re-export type Project for backwards compatibility
export type { Project } from './project-management/types';
export * from './project-management/types';

export default function ProjectManagement() {
  const {
    projects,
    loading,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    uniqueYears,
    uniquePoles,
    currentUser,
    userRole,
    profilesList,
    hasPrivilege,
    setProjects
  } = useProjectsData();

  const [activeModule, setActiveModule] = useState<'charge' | 'gestion' | 'dashboard' | 'report' | 'bordereau'>('charge');
  const [activeSubTab, setActiveSubTab] = useState<'planning' | 'identity' | 'etude' | 'expertise' | 'travaux' | 'gaz' | 'bordereau'>('planning');

  // Export handlers
  const exportHandlers = useExportHandlers({
    projects,
    selectedProject,
    currentUser
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-bold">Synchronisation des projets PD&I avec Firebase Firestore...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sidebar Navigation Module selector */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Module Sidebar */}
        <div className="xl:w-64 shrink-0 flex flex-col gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
            <div className="border-b border-slate-100 pb-3 text-left">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Module Projets &amp; Infrastructures</h4>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setActiveModule('charge')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all text-left ${activeModule === 'charge' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Plan de charge</span>
              </button>

              <button
                onClick={() => setActiveModule('gestion')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all text-left ${activeModule === 'gestion' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span>Gestion de projet</span>
              </button>

              <button
                onClick={() => setActiveModule('dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all text-left ${activeModule === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span>Tableau de bord</span>
              </button>

              <button
                onClick={() => setActiveModule('report')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all text-left ${activeModule === 'report' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <FileCheck className="w-4 h-4 shrink-0" />
                <span>Rapport mensuel</span>
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4.5 space-y-3 shadow-md border border-slate-800 hidden xl:block text-left">
            <div className="flex gap-2 items-center text-orange-400">
              <Shield className="w-4 h-4 text-orange-400" />
              <span className="font-black text-[9px] uppercase tracking-wider">Gouvernance</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
              Ce système centralise la planification, l'avancement physique et les contraintes des ouvrages industriels et pipelines PD&I.
            </p>
          </div>
        </div>

        {/* Content pane */}
        <div id="current-content-pane" className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeModule === 'charge' && (
              <PlanDeChargeView
                key="charge-view"
                projects={projects}
                setSelectedProjectId={setSelectedProjectId}
                setActiveModule={setActiveModule}
                setActiveSubTab={setActiveSubTab}
                hasPrivilege={hasPrivilege}
                uniqueYears={uniqueYears}
                handlePrintPlanDeCharge={exportHandlers.handlePrintPlanDeCharge}
                handleExportPlanDeChargeWord={exportHandlers.handleExportPlanDeChargeWord}
                handleExportPlanDeChargePDF={exportHandlers.handleExportPlanDeChargePDF}
              />
            )}

            {activeModule === 'gestion' && (
              <GestionProjetView
                key="gestion-view"
                projects={projects}
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
                selectedProject={selectedProject}
                activeSubTab={activeSubTab}
                setActiveSubTab={setActiveSubTab}
                uniqueYears={uniqueYears}
                uniquePoles={uniquePoles}
                hasPrivilege={hasPrivilege}
                profilesList={profilesList}
                currentUser={currentUser}
                handlePrintPlanDeCharge={exportHandlers.handlePrintPlanDeCharge}
                handleExportPlanDeChargeWord={exportHandlers.handleExportPlanDeChargeWord}
                handleExportPlanDeChargePDF={exportHandlers.handleExportPlanDeChargePDF}
                handleExportGenesisWord={exportHandlers.handleExportGenesisWord}
                handleExportGenesisPDF={exportHandlers.handleExportGenesisPDF}
                handleDownloadKMZ={exportHandlers.handleDownloadKMZ}
                handleUploadKMZ={exportHandlers.handleUploadKMZ}
                handleDeleteKMZ={exportHandlers.handleDeleteKMZ}
              />
            )}

            {activeModule === 'dashboard' && (
              <TableauDeBordView
                key="dashboard-view"
                projects={projects}
              />
            )}

            {activeModule === 'report' && (
              <RapportMensuelView
                key="report-view"
                projects={projects}
              />
            )}

            {activeModule === 'bordereau' && (
              <BordereauPrixView
                key="bordereau-view"
                projects={projects}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
