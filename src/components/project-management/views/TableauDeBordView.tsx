import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, CheckCircle, TrendingUp, AlertTriangle, FileText,
  Clock, Shield, BarChart2, Layers, FileCheck, Printer, RefreshCw
} from 'lucide-react';
import { Project } from '../types';
import { formatDateFrench } from '../projectUtils';

export interface TableauDeBordViewProps {
  projects: Project[];
}

export function TableauDeBordView({ projects }: TableauDeBordViewProps) {
  const [dashboardPeriod, setDashboardPeriod] = useState<'mensuel' | 'trimestriel' | 'semestriel' | 'annuel'>('mensuel');
  const [checkedImprovementActions, setCheckedImprovementActions] = useState<Record<string, boolean>>({});
  const [selectedIndicatorTab, setSelectedIndicatorTab] = useState<'general' | 'etude' | 'travaux' | 'gaz' | 'contraintes' | 'permis' | 'servitude'>('general');

    const totalCount = projects.length;
    const studiesApproved = projects.filter(p => p.etudeAutorisation.statutEtude === "Approuvée").length;
    const totalProgressSum = projects.reduce((sum, p) => sum + (p.travauxPlanification.avancementPhysique || 0), 0);
    const avgProgress = totalCount > 0 ? Math.round(totalProgressSum / totalCount) : 0;
    
    const activeConstraintsCount = projects.filter(p => p.identity.contraintes && p.identity.contraintes.trim().length > 0).length;
    
    let totalChecksCount = 0;
    let passedChecksCount = 0;
    projects.forEach(p => {
      const chk = p.travauxPlanification.controleQualiteChecklist;
      if (chk) {
        totalChecksCount += 5;
        if (chk.abaqueSoudageValide) passedChecksCount++;
        if (chk.radiographieCND) passedChecksCount++;
        if (chk.enrobageVerifie) passedChecksCount++;
        if (chk.litPoseSableux) passedChecksCount++;
        if (chk.protectionCathodique) passedChecksCount++;
      }
    });
    const qualityComplianceRate = totalChecksCount > 0 ? Math.round((passedChecksCount / totalChecksCount) * 100) : 0;

    const phaseCounts = {
      "Étude": projects.filter(p => p.identity.phase === "Étude").length,
      "Travaux": projects.filter(p => p.identity.phase === "Travaux").length,
      "Mise en Gaz": projects.filter(p => p.identity.phase === "Mise en Gaz").length,
      "Clôturé": projects.filter(p => p.identity.phase === "Clôturé").length,
    };

    const etudePct = totalCount > 0 ? Math.round((phaseCounts["Étude"] / totalCount) * 100) : 0;
    const travauxPct = totalCount > 0 ? Math.round((phaseCounts["Travaux"] / totalCount) * 100) : 0;
    const gazPct = totalCount > 0 ? Math.round((phaseCounts["Mise en Gaz"] / totalCount) * 100) : 0;
    const cloturePct = totalCount > 0 ? Math.round((phaseCounts["Clôturé"] / totalCount) * 100) : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="space-y-6 text-left"
      >
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Tableau de bord de performance</span>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight mt-0.5">Analyses & Amélioration Continue</h2>
            <p className="text-xs text-slate-400 mt-1">
              Gouvernance opérationnelle PD&I basée sur les KPIs de conformité, d'avancement physique et d'ingénierie.
            </p>
          </div>
          <div className="flex bg-slate-50 border border-slate-100 rounded-2xl p-1 shrink-0 self-start md:self-center">
            {(["mensuel", "trimestriel", "semestriel", "annuel"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setDashboardPeriod(period)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  dashboardPeriod === period
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2.5 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Avancement Physique Moyen</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-blue-700 tracking-tight font-mono">{avgProgress}%</span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full" style={{ width: `${avgProgress}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2.5 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Conformité Qualité (Chantier)</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-emerald-700 tracking-tight font-mono">{qualityComplianceRate}%</span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <FileCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full" style={{ width: `${qualityComplianceRate}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2.5 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Contraintes Actives</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-rose-700 tracking-tight font-mono">{activeConstraintsCount}</span>
              <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[10px] font-bold text-rose-600 bg-rose-50/50 px-2.5 py-1 rounded-lg border border-rose-100 inline-block">
              {activeConstraintsCount > 0 ? "⚠️ Libération des emprises requise" : "✓ Flux opérationnel optimal"}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2.5 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Études Approuvées</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-amber-700 tracking-tight font-mono">
                {studiesApproved}/{totalCount}
              </span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[10px] font-bold text-amber-600 bg-amber-50/50 px-2.5 py-1 rounded-lg border border-amber-100 inline-block">
              {totalCount > 0 ? `${Math.round((studiesApproved / totalCount) * 100)}% de validation` : "0%"}
            </div>
          </div>
        </div>

        {/* ================= TABLEAU DE BORD OFFICIEL & INDICATEURS STRATÉGIQUES (02 TR 2026) ================= */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 text-left">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">PD&I • Direction de l'Énergie</span>
              <h3 className="text-lg font-black text-slate-800 tracking-tight mt-0.5">Tableau de Bord Officiel & Indicateurs Clés (02 TR 2026)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Calculé automatiquement en temps réel sur la base des livrables et des arrêtés obtenus.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // Print-friendly rendering or export
                  window.print();
                }}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer les Indicateurs</span>
              </button>
            </div>
          </div>

          {/* KPI Circular Dials Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPI 1: Taux d'obtention Permis */}
            {(() => {
              const pcObtained = projects.filter(p => p.etudeAutorisation?.statutPermisConstruire === "Reçu" || p.etudeAutorisation?.datePermisConstruire).length;
              const pct = totalCount > 0 ? Math.round((pcObtained / totalCount) * 100) : 0;
              const strokeDash = 2 * Math.PI * 30;
              const strokeOffset = strokeDash - (pct / 100) * strokeDash;
              const isSelected = selectedIndicatorTab === "permis";
              
              return (
                <button
                  type="button"
                  onClick={() => setSelectedIndicatorTab(isSelected ? null : "permis")}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col items-center justify-center space-y-3 cursor-pointer outline-none ${
                    isSelected ? "bg-blue-50/50 border-blue-200 shadow-sm ring-1 ring-blue-100" : "bg-slate-50/40 border-slate-100 hover:border-slate-200 hover:bg-slate-50/70"
                  }`}
                >
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider text-center block">Taux Obtention Permis (PC)</span>
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="30" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="30" 
                        stroke="#2563eb" 
                        strokeWidth="6" 
                        fill="transparent" 
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-slate-800 font-mono">{pct}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-black text-slate-700 block">{pcObtained} / {totalCount} Obtenus</span>
                    <span className="text-[9px] text-slate-400 font-bold">Cible officielle : 85%</span>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${pct >= 85 ? "bg-green-100 text-green-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                    {pct >= 85 ? "Objectif Atteint" : pct >= 50 ? "En Attention" : "Retard Critique"}
                  </span>
                </button>
              );
            })()}

            {/* KPI 2: Taux Arrêté de Servitude */}
            {(() => {
              const asObtained = projects.filter(p => p.etudeAutorisation?.statutArreteServitude === "Signé & Publié" || !!p.etudeAutorisation?.arreteServitudeRef).length;
              const pct = totalCount > 0 ? Math.round((asObtained / totalCount) * 100) : 0;
              const strokeDash = 2 * Math.PI * 30;
              const strokeOffset = strokeDash - (pct / 100) * strokeDash;
              const isSelected = selectedIndicatorTab === "servitude";
              
              return (
                <button
                  type="button"
                  onClick={() => setSelectedIndicatorTab(isSelected ? null : "servitude")}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col items-center justify-center space-y-3 cursor-pointer outline-none ${
                    isSelected ? "bg-orange-50/50 border-orange-200 shadow-sm ring-1 ring-orange-100" : "bg-slate-50/40 border-slate-100 hover:border-slate-200 hover:bg-slate-50/70"
                  }`}
                >
                  <div className="text-center space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider text-center block">Taux Arrêté de Servitude (AS)</span>
                    <span className="text-[8px] text-slate-400/80 leading-tight block text-center max-w-[150px] font-medium">(Droit de passage / Section Permis & AS)</span>
                  </div>
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="30" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="30" 
                        stroke="#ea580c" 
                        strokeWidth="6" 
                        fill="transparent" 
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-slate-800 font-mono">{pct}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-black text-slate-700 block">{asObtained} / {totalCount} Obtenus</span>
                    <span className="text-[9px] text-slate-400 font-bold">Cible officielle : 75%</span>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${pct >= 75 ? "bg-green-100 text-green-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                    {pct >= 75 ? "Objectif Atteint" : pct >= 50 ? "En Attention" : "Retard Critique"}
                  </span>
                </button>
              );
            })()}

            {/* KPI 3: Taux Réalisation Étude */}
            {(() => {
              const etudeApproved = projects.filter(p => p.etudeAutorisation?.statutEtude === "Approuvée" || p.ficheSuivi?.etudeBetStatut === "Oui").length;
              const pct = totalCount > 0 ? Math.round((etudeApproved / totalCount) * 100) : 0;
              const strokeDash = 2 * Math.PI * 30;
              const strokeOffset = strokeDash - (pct / 100) * strokeDash;
              const isSelected = selectedIndicatorTab === "etude";
              
              return (
                <button
                  type="button"
                  onClick={() => setSelectedIndicatorTab(isSelected ? null : "etude")}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col items-center justify-center space-y-3 cursor-pointer outline-none ${
                    isSelected ? "bg-emerald-50/50 border-emerald-200 shadow-sm ring-1 ring-emerald-100" : "bg-slate-50/40 border-slate-100 hover:border-slate-200 hover:bg-slate-50/70"
                  }`}
                >
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider text-center block">Réalisation Étude (Approuvée)</span>
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="30" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="30" 
                        stroke="#059669" 
                        strokeWidth="6" 
                        fill="transparent" 
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-slate-800 font-mono">{pct}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-black text-slate-700 block">{etudeApproved} / {totalCount} Approuvées</span>
                    <span className="text-[9px] text-slate-400 font-bold">Cible officielle : 90%</span>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${pct >= 90 ? "bg-green-100 text-green-800" : pct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                    {pct >= 90 ? "Objectif Atteint" : pct >= 60 ? "En Attention" : "Retard Critique"}
                  </span>
                </button>
              );
            })()}

            {/* KPI 4: Réalisation Travaux */}
            {(() => {
              const pct = avgProgress;
              const strokeDash = 2 * Math.PI * 30;
              const strokeOffset = strokeDash - (pct / 100) * strokeDash;
              const isSelected = selectedIndicatorTab === "travaux";
              
              return (
                <button
                  type="button"
                  onClick={() => setSelectedIndicatorTab(isSelected ? null : "travaux")}
                  className={`p-5 rounded-2xl border transition-all text-left flex flex-col items-center justify-center space-y-3 cursor-pointer outline-none ${
                    isSelected ? "bg-purple-50/50 border-purple-200 shadow-sm ring-1 ring-purple-100" : "bg-slate-50/40 border-slate-100 hover:border-slate-200 hover:bg-slate-50/70"
                  }`}
                >
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider text-center block">Réalisation Travaux (Physique)</span>
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="30" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="30" 
                        stroke="#7c3aed" 
                        strokeWidth="6" 
                        fill="transparent" 
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-slate-800 font-mono">{pct}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-black text-slate-700 block">Avancement Moyen</span>
                    <span className="text-[9px] text-slate-400 font-bold">Cible officielle : 80%</span>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${pct >= 80 ? "bg-green-100 text-green-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                    {pct >= 80 ? "Objectif Atteint" : pct >= 50 ? "En Progression" : "Retard Modéré"}
                  </span>
                </button>
              );
            })()}
          </div>

          {/* Drill-down Detail Panel */}
          <AnimatePresence mode="wait">
            {selectedIndicatorTab && (
              <motion.div
                key={selectedIndicatorTab}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-50/60 rounded-2xl border border-slate-150 p-5 mt-2 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-800"></span>
                      <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                        Détail Analytique : {
                          selectedIndicatorTab === "permis" ? "Permis de Construire (PC)" :
                          selectedIndicatorTab === "servitude" ? "Arrêté de Servitude (AS)" :
                          selectedIndicatorTab === "etude" ? "Approbation de l'Étude Technique" :
                          "Avancement Physique des Travaux"
                        }
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedIndicatorTab(null)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      Masquer ✕
                    </button>
                  </div>

                  {/* Tabular details list of projects */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-black tracking-wider">
                          <th className="py-2.5 px-3">Gazoduc / Projet</th>
                          <th className="py-2.5 px-3">Pôle / Wilaya</th>
                          <th className="py-2.5 px-3">Cabinet / BE</th>
                          <th className="py-2.5 px-3">Statut Actuel</th>
                          <th className="py-2.5 px-3">Levée de Réserve</th>
                          <th className="py-2.5 px-3">Actions Correctives</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => {
                          let isGreen = false;
                          let statusText = "";
                          let subText = "";
                          let bName = "";
                          let leveeText = "Aucune";
                          let actionText = "Aucune action requise";

                          if (selectedIndicatorTab === "permis") {
                            isGreen = !!(p.etudeAutorisation?.statutPermisConstruire === "Reçu" || p.etudeAutorisation?.datePermisConstruire);
                            statusText = p.etudeAutorisation?.statutPermisConstruire || (p.etudeAutorisation?.datePermisConstruire ? "Obtenu" : "Non déposé");
                            subText = p.etudeAutorisation?.datePermisConstruire ? "Obtenu le " + formatDateFrench(p.etudeAutorisation.datePermisConstruire) : p.ficheSuivi?.depotPcDate ? "Déposé le " + formatDateFrench(p.ficheSuivi.depotPcDate) : "Non démarré";
                            bName = p.ficheSuivi?.etudeBetCabinet || "Cabinet non renseigné";
                            leveeText = p.ficheSuivi?.etudeLeveeReserveStatus || (p.ficheSuivi?.etudeLeveeReserveDate ? "Levée" : "Aucune");
                            actionText = p.ficheSuivi?.etudeActionStatus || "N/A";
                          } else if (selectedIndicatorTab === "servitude") {
                            isGreen = p.etudeAutorisation?.statutArreteServitude === "Signé & Publié" || !!p.etudeAutorisation?.arreteServitudeRef;
                            statusText = p.etudeAutorisation?.statutArreteServitude || "Non lancé";
                            subText = p.etudeAutorisation?.arreteServitudeRef ? "Arrêté n° " + p.etudeAutorisation.arreteServitudeRef : (p.ficheSuivi?.depotAsDate ? "Déposé le " + formatDateFrench(p.ficheSuivi.depotAsDate) : "Non déposé");
                            bName = p.ficheSuivi?.etudeBetCabinet || "Cabinet non renseigné";
                            leveeText = p.ficheSuivi?.etudeLeveeReserveStatus || (p.ficheSuivi?.etudeLeveeReserveDate ? "Levée" : "Aucune");
                            actionText = p.ficheSuivi?.etudeActionStatus || "N/A";
                          } else if (selectedIndicatorTab === "etude") {
                            isGreen = !!(p.etudeAutorisation?.statutEtude === "Approuvée" || p.ficheSuivi?.etudeBetStatut === "Oui");
                            statusText = p.etudeAutorisation?.statutEtude || (p.ficheSuivi?.etudeBetStatut === "Oui" ? "Approuvée" : "En cours");
                            subText = p.ficheSuivi?.etudeBetCabinet ? `Cabinet: ${p.ficheSuivi.etudeBetCabinet}` : "Non démarrée";
                            bName = p.ficheSuivi?.etudeBetCabinet || "Non désigné";
                            leveeText = p.ficheSuivi?.etudeLeveeReserveStatus || (p.ficheSuivi?.etudeLeveeReserveDate ? "Levée" : "Aucune");
                            actionText = p.ficheSuivi?.etudeActionStatus || "N/A";
                          } else {
                            isGreen = (p.travauxPlanification?.avancementPhysique || 0) === 100;
                            statusText = `Avancement: ${p.travauxPlanification?.avancementPhysique || 0}%`;
                            subText = p.travauxPlanification?.essaisReglementaires?.organismeControleur ? `Contrôle: ${p.travauxPlanification.essaisReglementaires.organismeControleur}` : "Pas d'organisme";
                            bName = "Travaux";
                            leveeText = p.ficheSuivi?.expertiseLeveeReserveStatus || "Aucune";
                            actionText = p.ficheSuivi?.expertiseActionStatus || "N/A";
                          }

                          return (
                            <tr key={p.id} className="border-b border-slate-150 hover:bg-slate-100/50 transition-colors">
                              <td className="py-2.5 px-3 font-extrabold text-slate-800">{p.name}</td>
                              <td className="py-2.5 px-3 text-slate-500 font-medium">{p.identity?.pole || "N/A"} / {p.identity?.region || "N/A"}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-bold">{bName}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-block ${isGreen ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                  {statusText}
                                </span>
                                <span className="block text-[9px] text-slate-400 mt-0.5">{subText}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px] max-w-[120px] truncate" title={leveeText}>{leveeText}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium max-w-[150px] truncate" title={actionText}>{actionText}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* KPI Simulator Section */}
          <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100/60 text-left">
            <h4 className="font-extrabold text-xs text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              <span>Générateur Automatique de Plan d'Action d'Urgence</span>
            </h4>
            <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
              Le système a analysé les points de blocage fonciers et administratifs et recommande les actions prioritaires immédiates suivantes pour maximiser les indicateurs de performance PD&I :
            </p>
            <div className="mt-3.5 space-y-2 text-[11px] font-medium text-slate-700">
              {(() => {
                const pendingPc = projects.filter(p => p.etudeAutorisation?.statutPermisConstruire !== "Reçu" && !p.etudeAutorisation?.datePermisConstruire);
                const pendingAs = projects.filter(p => p.etudeAutorisation?.statutArreteServitude !== "Signé & Publié" && !p.etudeAutorisation?.arreteServitudeRef);
                
                return (
                  <>
                    {pendingPc.map((p, idx) => (
                      <div key={`rec-pc-${idx}`} className="p-2.5 bg-white rounded-xl border border-indigo-100 flex items-start gap-2 shadow-xs">
                        <span className="text-indigo-600 font-black">🎯 Action PC #{idx + 1} :</span>
                        <p className="flex-1 leading-tight text-slate-800">
                          Relancer d'urgence le dépôt du dossier de Permis de Construire pour <strong>{p.name}</strong> avec le cabinet <strong>{p.ficheSuivi?.etudeBetCabinet || "non désigné"}</strong>. Date de dépôt initiale : {p.ficheSuivi?.depotPcDate ? formatDateFrench(p.ficheSuivi.depotPcDate) : "non déposé"}.
                        </p>
                      </div>
                    ))}
                    {pendingAs.map((p, idx) => (
                      <div key={`rec-as-${idx}`} className="p-2.5 bg-white rounded-xl border border-indigo-100 flex items-start gap-2 shadow-xs">
                        <span className="text-orange-600 font-black">⚡ Action AS #{idx + 1} :</span>
                        <p className="flex-1 leading-tight text-slate-800">
                          Relancer d'urgence l'obtention de l'Arrêté de Servitude d'octroi du droit de servitude pour <strong>{p.name}</strong> auprès de la Wilaya. Suivi par le bureau d'études (BET) : <strong>{p.ficheSuivi?.etudeBetCabinet || "non désigné"}</strong>. Demande d'AS déposée le {p.ficheSuivi?.depotAsDate ? formatDateFrench(p.ficheSuivi.depotAsDate) : "en attente"}.
                        </p>
                      </div>
                    ))}
                    {pendingPc.length === 0 && pendingAs.length === 0 && (
                      <p className="text-green-700 font-bold italic">✓ Félicitations ! Tous les dossiers réglementaires (PC et AS) sont validés pour l'intégralité du programme.</p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Distribution des Projets par Phase</h3>
            <p className="text-[11px] text-slate-400">Positionnement des ouvrages dans le cycle de vie de développement de la PD&I.</p>
            
            <div className="space-y-4">
              <div className="w-full h-8 bg-slate-100 rounded-2xl overflow-hidden flex text-white text-[10px] font-black shadow-inner">
                {etudePct > 0 && (
                  <div className="bg-blue-600 h-full flex items-center justify-center transition-all" style={{ width: `${etudePct}%` }} title={`Étude: ${phaseCounts["Étude"]} projets`}>
                    {etudePct}%
                  </div>
                )}
                {travauxPct > 0 && (
                  <div className="bg-orange-500 h-full flex items-center justify-center transition-all" style={{ width: `${travauxPct}%` }} title={`Travaux: ${phaseCounts["Travaux"]} projets`}>
                    {travauxPct}%
                  </div>
                )}
                {gazPct > 0 && (
                  <div className="bg-emerald-500 h-full flex items-center justify-center transition-all" style={{ width: `${gazPct}%` }} title={`Mise en Gaz: ${phaseCounts["Mise en Gaz"]} projets`}>
                    {gazPct}%
                  </div>
                )}
                {cloturePct > 0 && (
                  <div className="bg-slate-400 h-full flex items-center justify-center transition-all" style={{ width: `${cloturePct}%` }} title={`Clôturé: ${phaseCounts["Clôturé"]} projets`}>
                    {cloturePct}%
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-700">Étude</p>
                    <p className="text-[10px] text-slate-400 font-mono">{phaseCounts["Étude"]} projets</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-700">Travaux</p>
                    <p className="text-[10px] text-slate-400 font-mono">{phaseCounts["Travaux"]} projets</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-700">Mise en Gaz</p>
                    <p className="text-[10px] text-slate-400 font-mono">{phaseCounts["Mise en Gaz"]} projets</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-700">Clôturé</p>
                    <p className="text-[10px] text-slate-400 font-mono">{phaseCounts["Clôturé"]} projets</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Avancement Physique Comparatif</h3>
            <p className="text-[11px] text-slate-400">Progression individuelle des gazoducs par rapport à la cible de livraison (100%).</p>

            <div className="space-y-3.5 max-h-[140px] overflow-y-auto pr-1">
              {projects.map(p => (
                <div key={p.id} className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center font-bold text-slate-700">
                    <span className="truncate max-w-[200px]">{p.name}</span>
                    <span className="font-mono text-slate-500 text-[11px]">{p.travauxPlanification.avancementPhysique}%</span>
                  </div>
                  <div className="w-full bg-slate-50 border border-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.travauxPlanification.avancementPhysique === 100 
                          ? "bg-emerald-500" 
                          : p.travauxPlanification.avancementPhysique > 50 
                            ? "bg-blue-600" 
                            : "bg-orange-500"
                      }`}
                      style={{ width: `${p.travauxPlanification.avancementPhysique}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-md border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest font-mono">
              Amélioration Continue — Plan d'action {dashboardPeriod}
            </span>
            <h3 className="text-lg md:text-xl font-black tracking-tight mt-0.5">
              {dashboardPeriod === "mensuel" && "Analyse Mensuelle : Opérations & Tranchées"}
              {dashboardPeriod === "trimestriel" && "Analyse Trimestrielle : Ingénierie & Foncier"}
              {dashboardPeriod === "semestriel" && "Analyse Semestrielle : Campagnes de Tests & Soudage"}
              {dashboardPeriod === "annuel" && "Analyse Annuelle : Alignement Stratégique & Réseau"}
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {dashboardPeriod === "mensuel" && "Vérification des jalons opérationnels à court terme, libération ponctuelle des oppositions de tiers et coordination étroite avec l'organisme d'inspection agréé (VERITAL)."}
              {dashboardPeriod === "trimestriel" && "Optimisation des processus administratifs de PC et d'AS avec les GEF, réconciliation logistique du matériel tubulaire sous-douane et évaluation des livrables techniques."}
              {dashboardPeriod === "semestriel" && "Suivi de la certification de soudage des entrepreneurs agréés, audits périodiques d'enrobage et de protection cathodique, et préparation du plan hivernal d'approvisionnement gazier."}
              {dashboardPeriod === "annuel" && "Bilan consolidé des extensions de réseaux haute pression PD&I, développement des compétences des équipes d'ingénieurs régionaux, et planification budgétaire décennale."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <h4 className="font-extrabold text-orange-400 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Recommandations d'Ingénierie</span>
              </h4>
              <ul className="space-y-3 text-slate-300 pl-1 text-left">
                {dashboardPeriod === "mensuel" && (
                  <>
                    <li className="leading-relaxed">• <strong>Contrôle Verital :</strong> Programmer les audits de résistance au moins 5 jours à l'avance pour éviter la saturation opérationnelle de l'organisme.</li>
                    <li className="leading-relaxed">• <strong>Levée d'oppositions :</strong> Engager le médiateur régional pour les deux points de blocages signalés au niveau des propriétaires agricoles.</li>
                  </>
                )}
                {dashboardPeriod === "trimestriel" && (
                  <>
                    <li className="leading-relaxed">• <strong>Performance GEF :</strong> Mettre en demeure les cabinets de géomètres affichant un taux de retard supérieur à 20% sur la constitution des dossiers fonciers.</li>
                    <li className="leading-relaxed">• <strong>Abaques de soudage :</strong> Imposer la requalification systématique des abaques pour tout changement de lot de métal d'apport.</li>
                  </>
                )}
                {dashboardPeriod === "semestriel" && (
                  <>
                    <li className="leading-relaxed">• <strong>Campagne Cathodique :</strong> Procéder à la mesure de potentiel d'arrêt sur l'intégralité du tronçon enterré de Jijel avant remblaiement complet.</li>
                    <li className="leading-relaxed">• <strong>Contrôles non destructifs :</strong> Augmenter le taux de contrôle radiographique à 100% sur les zones à forte densité urbaine.</li>
                  </>
                )}
                {dashboardPeriod === "annuel" && (
                  <>
                    <li className="leading-relaxed">• <strong>Standardisation d'Acier :</strong> Migrer l'ensemble des futurs cahiers des charges vers la nuance d'acier API 5L X70 pour optimiser l'épaisseur de paroi.</li>
                    <li className="leading-relaxed">• <strong>Numérisation :</strong> Obliger les bureaux d'études à soumettre les plans de recollement au format d'archive structuré interopérable SIG.</li>
                  </>
                )}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-extrabold text-orange-400 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>Actions Correctives Planifiées ({Object.values(checkedImprovementActions).filter(Boolean).length}/5)</span>
              </h4>
              <div className="space-y-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left">
                {[
                  { id: "action_1", text: "Vérifier la conformité de l'étalonnage des appareils de radiographie" },
                  { id: "action_2", text: "Relancer le Wali pour la signature urgente de l'arrêté de servitude de Jijel" },
                  { id: "action_3", text: "Organiser un atelier technique de recyclage des soudeurs agréés" },
                  { id: "action_4", text: "Mettre à jour l'annuaire des cabinets GEF autorisés par pôle" },
                  { id: "action_5", text: "Établir la notice d'impact environnemental pour les traversées d'oued" }
                ].map((act) => (
                  <label key={act.id} className="flex items-start gap-2.5 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={checkedImprovementActions[act.id] || false}
                      onChange={() => setCheckedImprovementActions({
                        ...checkedImprovementActions,
                        [act.id]: !checkedImprovementActions[act.id]
                      })}
                      className="mt-0.5 rounded border-slate-800 bg-slate-900 text-orange-500 focus:ring-0"
                    />
                    <span className="leading-tight">{act.text}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );

}
