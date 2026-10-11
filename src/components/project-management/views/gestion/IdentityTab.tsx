import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import {
  Briefcase, Edit3, Shield, CheckCircle, Download, FileText, Upload, Trash2,
  Calendar, Layers, MapPin, Building, Globe, Info, Clock, AlertTriangle,
  Activity, ExternalLink, CheckSquare
} from 'lucide-react';
import { Project } from '../../types';
import { formatDateFrench, getProjectDisplayLength, getPipelineSequence } from '../../projectUtils';
import ProjectMapViewer from '../../../ProjectMapViewer';
import ProjectAltitudeProfile from '../../../ProjectAltitudeProfile';

export interface IdentityTabProps {
  selectedProject: Project;
  hasPrivilege: (key: string) => boolean;
  setActiveSubTab: (tab: 'planning' | 'identity' | 'etude' | 'expertise' | 'travaux' | 'gaz' | 'bordereau') => void;
  setEditingLotContractsId: (id: string | null) => void;
  handleDownloadKMZ: (project: Project) => void;
  handleUploadKMZ: (event: React.ChangeEvent<HTMLInputElement>, project: Project) => void;
  handleDeleteKMZ: (project: Project) => void;
}

export function IdentityTab({
  selectedProject,
  hasPrivilege,
  setActiveSubTab,
  setEditingLotContractsId,
  handleDownloadKMZ,
  handleUploadKMZ,
  handleDeleteKMZ,
}: IdentityTabProps) {
  const renderContractsAndOdsSummary = () => {
    if (!selectedProject) return null;

    const lotsToRender = (selectedProject.lots && selectedProject.lots.length > 0)
      ? selectedProject.lots
      : [
          {
            id: "lot-1",
            name: "Lot Unique (Général)",
            contrats: selectedProject.contrats
          }
        ];

    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider font-mono">Suivi Contractuel</span>
            <h5 className="font-black text-sm text-slate-800">Synthèse des Contrats, Prestataires & Ordres de Service (ODS)</h5>
          </div>
          <button
            onClick={() => {
              setActiveSubTab("travaux");
              if (lotsToRender[0]?.id) {
                setEditingLotContractsId(lotsToRender[0].id);
              }
              setTimeout(() => {
                document.getElementById("multi-lot-management-section")?.scrollIntoView({ behavior: "smooth" });
              }, 150);
            }}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100/50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Gérer / Modifier les Contrats & ODS</span>
          </button>
        </div>

        <div className="space-y-6">
          {lotsToRender.map((lot, idx) => {
            const contrats = lot.contrats || {
              bureauEtude: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
              expert: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
              etbGC: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
              etbMeca: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 }
            };

            const betName = contrats.bureauEtude?.nom || selectedProject.ficheSuivi?.etudeBetCabinet || selectedProject.ficheSuivi?.impactBetOds || "";
            const expertName = contrats.expert?.nom || selectedProject.ficheSuivi?.gefCabinet || "";

            return (
              <div key={lot.id || idx} className="space-y-3">
                {lotsToRender.length > 1 && (
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                    <span className="font-bold text-xs text-slate-700">{lot.name}</span>
                    {lot.wilaya && (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black border border-indigo-100/50">
                        {lot.wilaya}
                      </span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Bureau d'Étude */}
                  <div className="bg-slate-50/45 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3 shadow-xs hover:border-slate-200 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-blue-600 font-mono tracking-wide">1. Bureau d'Études (BET)</span>
                        <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md font-mono font-bold">
                          Av. {contrats.bureauEtude?.avancement || 0}%
                        </span>
                      </div>
                      <h6 className="font-black text-slate-800 text-[11px] mt-2 leading-tight min-h-[2.2rem] line-clamp-2" title={betName || "Non désigné"}>
                        {betName || <span className="text-slate-400 italic font-medium">Non renseigné</span>}
                      </h6>
                      
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10px] text-slate-600">
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Réf :</span>
                          <span className="font-mono font-extrabold text-slate-700 truncate max-w-[120px]">{contrats.bureauEtude?.ref || "N/A"}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Signature :</span>
                          <span className="font-mono font-extrabold text-slate-700">{formatDateFrench(contrats.bureauEtude?.date)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Montant :</span>
                          <span className="font-extrabold text-slate-700">{contrats.bureauEtude?.montant ? `${contrats.bureauEtude.montant}` : "N/A"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50 flex flex-col gap-0.5 text-center">
                      <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wide">Date ODS du BET</span>
                      <span className="font-mono font-black text-[11px] text-blue-800">
                        {contrats.bureauEtude?.ods ? formatDateFrench(contrats.bureauEtude.ods) : "Non notifiée"}
                      </span>
                    </div>
                  </div>

                  {/* Géomètre Expert Foncier */}
                  <div className="bg-slate-50/45 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3 shadow-xs hover:border-slate-200 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-amber-600 font-mono tracking-wide">2. Cabinet d'Expertise (GEF)</span>
                        <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md font-mono font-bold">
                          Av. {contrats.expert?.avancement || 0}%
                        </span>
                      </div>
                      <h6 className="font-black text-slate-800 text-[11px] mt-2 leading-tight min-h-[2.2rem] line-clamp-2" title={expertName || "Non désigné"}>
                        {expertName || <span className="text-slate-400 italic font-medium">Non renseigné</span>}
                      </h6>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10px] text-slate-600">
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Réf :</span>
                          <span className="font-mono font-extrabold text-slate-700 truncate max-w-[120px]">{contrats.expert?.ref || "N/A"}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Signature :</span>
                          <span className="font-mono font-extrabold text-slate-700">{formatDateFrench(contrats.expert?.date)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Montant :</span>
                          <span className="font-extrabold text-slate-700">{contrats.expert?.montant ? `${contrats.expert.montant}` : "N/A"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50 flex flex-col gap-0.5 text-center">
                      <span className="text-[8px] font-bold text-amber-600 uppercase tracking-wide">Date ODS du GEF</span>
                      <span className="font-mono font-black text-[11px] text-amber-800">
                        {contrats.expert?.ods ? formatDateFrench(contrats.expert.ods) : "Non notifiée"}
                      </span>
                    </div>
                  </div>

                  {/* Entreprise Génie Civil */}
                  <div className="bg-slate-50/45 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3 shadow-xs hover:border-slate-200 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-emerald-600 font-mono tracking-wide">3. Entreprise Génie Civil (GC)</span>
                        <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md font-mono font-bold">
                          Av. {contrats.etbGC?.avancement || 0}%
                        </span>
                      </div>
                      <h6 className="font-black text-slate-800 text-[11px] mt-2 leading-tight min-h-[2.2rem] line-clamp-2" title={contrats.etbGC?.nom || "Non désignée"}>
                        {contrats.etbGC?.nom || <span className="text-slate-400 italic font-medium">Non renseignée</span>}
                      </h6>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10px] text-slate-600">
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Réf :</span>
                          <span className="font-mono font-extrabold text-slate-700 truncate max-w-[120px]">{contrats.etbGC?.ref || "N/A"}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Signature :</span>
                          <span className="font-mono font-extrabold text-slate-700">{formatDateFrench(contrats.etbGC?.date)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Montant :</span>
                          <span className="font-extrabold text-slate-700">{contrats.etbGC?.montant ? `${contrats.etbGC.montant}` : "N/A"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50 flex flex-col gap-0.5 text-center">
                      <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wide">Date ODS GC</span>
                      <span className="font-mono font-black text-[11px] text-emerald-800">
                        {contrats.etbGC?.ods ? formatDateFrench(contrats.etbGC.ods) : "Non notifiée"}
                      </span>
                    </div>
                  </div>

                  {/* Entreprise Mécanique */}
                  <div className="bg-slate-50/45 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3 shadow-xs hover:border-slate-200 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-purple-600 font-mono tracking-wide">4. Entreprise Mécanique</span>
                        <span className="text-[9px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md font-mono font-bold">
                          Av. {contrats.etbMeca?.avancement || 0}%
                        </span>
                      </div>
                      <h6 className="font-black text-slate-800 text-[11px] mt-2 leading-tight min-h-[2.2rem] line-clamp-2" title={contrats.etbMeca?.nom || "Non désignée"}>
                        {contrats.etbMeca?.nom || <span className="text-slate-400 italic font-medium">Non renseignée</span>}
                      </h6>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10px] text-slate-600">
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Réf :</span>
                          <span className="font-mono font-extrabold text-slate-700 truncate max-w-[120px]">{contrats.etbMeca?.ref || "N/A"}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Signature :</span>
                          <span className="font-mono font-extrabold text-slate-700">{formatDateFrench(contrats.etbMeca?.date)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-bold text-slate-400">Montant :</span>
                          <span className="font-extrabold text-slate-700">{contrats.etbMeca?.montant ? `${contrats.etbMeca.montant}` : "N/A"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-purple-50/50 p-2.5 rounded-xl border border-purple-100/50 flex flex-col gap-0.5 text-center">
                      <span className="text-[8px] font-bold text-purple-600 uppercase tracking-wide">Date ODS Mécanique</span>
                      <span className="font-mono font-black text-[11px] text-purple-800">
                        {contrats.etbMeca?.ods ? formatDateFrench(contrats.etbMeca.ods) : "Non notifiée"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  return (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Phase 01 • Renseignements Généraux</span>
                    <h4 className="font-extrabold text-base text-slate-800">Fiche d'Identité administrative et technique</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-3.5">
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">Direction Régionale / Entité :</span>
                        <span className="font-black text-slate-800">{selectedProject.identity.region || "Non renseigné"}</span>
                      </div>
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">Pôle de rattachement :</span>
                        <span className="font-black text-slate-800">{selectedProject.identity.pole || "Non renseigné"}</span>
                      </div>
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">Wilaya d'implantation :</span>
                        <span className="font-black text-slate-800">{selectedProject.identity.wilaya || "Non renseigné"}</span>
                      </div>
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">District / Secteur Opérationnel :</span>
                        <span className="font-black text-slate-800">{selectedProject.identity.district || "Non renseigné"}</span>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">Cadre d'Inscription :</span>
                        <span className="font-black text-slate-800">{selectedProject.identity.cadreInscription || "Non renseigné"}</span>
                      </div>
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">Structure Chargée :</span>
                        <span className="font-black text-slate-800">{selectedProject.identity.structureChargee || "Non renseigné"}</span>
                      </div>
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">Type / Qualité Acier :</span>
                        <span className="font-black text-slate-800">{selectedProject.identity.caracteristiques.typeTuyau || "N/A"}</span>
                      </div>
                      <div className="flex justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold">Longueur Conduite :</span>
                        <span className="font-black text-slate-800">{getProjectDisplayLength(selectedProject) !== "0" ? `${getProjectDisplayLength(selectedProject)} km` : "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Synthèse des contrats et ODS */}
                  {renderContractsAndOdsSummary()}

                  {/* Responsables du projet */}
                  <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-xs space-y-3">
                    <p className="font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                      <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Équipe de Gestion du Projet & Hiérarchie</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Partie Travaux */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                            <Briefcase className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">CP - Partie Travaux</span>
                        </div>
                        <div className="space-y-3 divide-y divide-slate-100/60">
                          {selectedProject.chefsDeProjetTravaux && selectedProject.chefsDeProjetTravaux.length > 0 ? (
                            selectedProject.chefsDeProjetTravaux.map((item, idx) => (
                              <div key={idx} className="text-left min-w-0 pt-2 first:pt-0">
                                <p className="font-extrabold text-slate-800 text-[11px] truncate">
                                  {item.name}
                                </p>
                                {item.structure && (
                                  <p className="text-[10px] text-blue-600 font-extrabold flex items-center gap-1 mt-0.5" title="Structure d'appartenance">
                                    <span>🏢</span> <span>{item.structure}</span>
                                  </p>
                                )}
                                {item.email && (
                                  <p className="text-[9px] text-slate-400 font-mono font-medium truncate mt-0.5">{item.email}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-left min-w-0">
                              <p className="font-extrabold text-slate-800 text-[11px] truncate">
                                {selectedProject.chefDeProjetName || "Non assigné"}
                              </p>
                              {selectedProject.chefDeProjetStructure && (
                                <p className="text-[10px] text-blue-600 font-extrabold flex items-center gap-1 mt-0.5" title="Structure d'appartenance">
                                  <span>🏢</span> <span>{selectedProject.chefDeProjetStructure}</span>
                                </p>
                              )}
                              {selectedProject.chefDeProjetEmail && (
                                <p className="text-[9px] text-slate-400 font-mono font-medium truncate mt-0.5">{selectedProject.chefDeProjetEmail}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Partie Étude */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Briefcase className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">CP - Partie Étude</span>
                        </div>
                        <div className="space-y-3 divide-y divide-slate-100/60">
                          {selectedProject.chefsDeProjetEtude && selectedProject.chefsDeProjetEtude.length > 0 ? (
                            selectedProject.chefsDeProjetEtude.map((item, idx) => (
                              <div key={idx} className="text-left min-w-0 pt-2 first:pt-0">
                                <p className="font-extrabold text-slate-800 text-[11px] truncate">
                                  {item.name}
                                </p>
                                {item.structure && (
                                  <p className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 mt-0.5" title="Structure d'appartenance">
                                    <span>🏢</span> <span>{item.structure}</span>
                                  </p>
                                )}
                                {item.email && (
                                  <p className="text-[9px] text-slate-400 font-mono font-medium truncate mt-0.5">{item.email}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-left min-w-0">
                              <p className="font-extrabold text-slate-800 text-[11px] truncate">
                                {selectedProject.chefDeProjetEtudeName || "Non assigné"}
                              </p>
                              {selectedProject.chefDeProjetEtudeStructure && (
                                <p className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 mt-0.5" title="Structure d'appartenance">
                                  <span>🏢</span> <span>{selectedProject.chefDeProjetEtudeStructure}</span>
                                </p>
                              )}
                              {selectedProject.chefDeProjetEtudeEmail && (
                                <p className="text-[9px] text-slate-400 font-mono font-medium truncate mt-0.5">{selectedProject.chefDeProjetEtudeEmail}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Superviseur */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Superviseur Projet</span>
                        </div>
                        <div className="space-y-3 divide-y divide-slate-100/60">
                          {selectedProject.superviseurs && selectedProject.superviseurs.length > 0 ? (
                            selectedProject.superviseurs.map((item, idx) => (
                              <div key={idx} className="text-left min-w-0 pt-2 first:pt-0">
                                <p className="font-extrabold text-slate-800 text-[11px] truncate">
                                  {item.name}
                                </p>
                                {item.structure && (
                                  <p className="text-[10px] text-amber-600 font-extrabold flex items-center gap-1 mt-0.5" title="Structure d'appartenance">
                                    <span>🏢</span> <span>{item.structure}</span>
                                  </p>
                                )}
                                {item.email && (
                                  <p className="text-[9px] text-slate-400 font-mono font-medium truncate mt-0.5">{item.email}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-left min-w-0">
                              <p className="font-extrabold text-slate-800 text-[11px] truncate">
                                {selectedProject.superviseurName || "Non assigné"}
                              </p>
                              {selectedProject.superviseurStructure && (
                                <p className="text-[10px] text-amber-600 font-extrabold flex items-center gap-1 mt-0.5" title="Structure d'appartenance">
                                  <span>🏢</span> <span>{selectedProject.superviseurStructure}</span>
                                </p>
                              )}
                              {selectedProject.superviseurEmail && (
                                <p className="text-[9px] text-slate-400 font-mono font-medium truncate mt-0.5">{selectedProject.superviseurEmail}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chargé Expertise & Indemnisation */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                          <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                            <Briefcase className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Expertise & Indemnisation</span>
                        </div>
                        <div className="space-y-3 divide-y divide-slate-100/60">
                          {selectedProject.chefsDeProjetExpertise && selectedProject.chefsDeProjetExpertise.length > 0 ? (
                            selectedProject.chefsDeProjetExpertise.map((item, idx) => (
                              <div key={idx} className="text-left min-w-0 pt-2 first:pt-0">
                                <p className="font-extrabold text-slate-800 text-[11px] truncate">
                                  {item.name}
                                </p>
                                {item.structure && (
                                  <p className="text-[10px] text-orange-600 font-extrabold flex items-center gap-1 mt-0.5" title="Structure d'appartenance">
                                    <span>🏢</span> <span>{item.structure}</span>
                                  </p>
                                )}
                                {item.email && (
                                  <p className="text-[9px] text-slate-400 font-mono font-medium truncate mt-0.5">{item.email}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Aucun chargé assigné</p>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {selectedProject.identity.planificationComment && (
                    <div className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl text-xs space-y-1.5">
                      <p className="font-extrabold text-blue-800 flex items-center gap-1.5">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>Notes de Planification & Suivi</span>
                      </p>
                      <p className="text-slate-600 leading-relaxed font-medium">
                        {selectedProject.identity.planificationComment}
                      </p>
                    </div>
                  )}

                  {/* Fiche Technique des Caractéristiques */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 text-left">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Activity className="w-5 h-5 text-blue-600" />
                      <h5 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Caractéristiques Techniques Principales</h5>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Diamètre DN</span>
                        <span className="font-mono font-black text-sm text-slate-800">
                          {selectedProject.identity.caracteristiques.diametre ? `${selectedProject.identity.caracteristiques.diametre}"` : "Non spécifié"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Longueur</span>
                        <span className="font-mono font-black text-sm text-slate-800">
                          {getProjectDisplayLength(selectedProject) !== "0" ? `${getProjectDisplayLength(selectedProject)} km` : "Non spécifié"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Pression de Service</span>
                        <span className="font-mono font-black text-sm text-slate-800">
                          {selectedProject.identity.caracteristiques.pression || "Non spécifié"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Capacité de Transit</span>
                        <span className="font-mono font-black text-sm text-slate-800">
                          {selectedProject.identity.caracteristiques.capacitePoste || "Non spécifié"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Raccordement</span>
                        <span className="font-black text-xs text-slate-800 truncate block" title={selectedProject.identity.caracteristiques.pointRaccordement || ""}>
                          {selectedProject.identity.caracteristiques.pointRaccordement || "Non spécifié"}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tracé Géographique (KMZ / Google Earth) */}
                  <div className="bg-gradient-to-r from-blue-50/40 via-indigo-50/30 to-slate-50/20 rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 rounded-xl">
                          <Globe className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h5 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Tracé Géographique Interactif (SIG)</h5>
                          <p className="text-[10px] text-slate-500 font-medium">Visualisation en temps réel de l'ouvrage sur fond de carte satellite ou standard</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-indigo-50/50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100/60 self-start sm:self-center animate-pulse">
                        Carte Intégrée
                      </span>
                    </div>

                    {/* Carte SIG Interactive NATIVE */}
                    <ProjectMapViewer project={selectedProject} />

                    {/* Profil en Travers de l'Altitude du Tracé */}
                    <ProjectAltitudeProfile project={selectedProject} />

                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${selectedProject.identity.kmzFileData ? "bg-emerald-500 animate-pulse" : "bg-blue-400 animate-pulse"}`}></span>
                          <p className="font-extrabold text-slate-800 text-xs">
                            {selectedProject.identity.kmzFileName || `Tracé_${selectedProject.name.replace(/\s+/g, "_")}.kml`}
                          </p>
                          {selectedProject.identity.kmzFileData ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded-md border border-emerald-100 uppercase tracking-wider">
                              Fichier personnalisé
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-black rounded-md border border-blue-100 uppercase tracking-wider">
                              Généré automatiquement
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 leading-relaxed">
                          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>
                            {selectedProject.identity.kmzFileData 
                              ? "Fichier personnalisé chargé pour ce projet." 
                              : `Fichier de tracé SIG généré d'après la longueur (${getProjectDisplayLength(selectedProject)} km) et la Wilaya (${selectedProject.identity.wilaya}) du projet.`}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleDownloadKMZ(selectedProject)}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center gap-2 cursor-pointer shrink-0"
                        >
                          <Download className="w-4 h-4" />
                          <span>Télécharger KMZ/KML</span>
                        </button>
                        <a
                          href="https://earth.google.com/web/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-2 cursor-pointer shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Ouvrir Google Earth</span>
                        </a>
                      </div>
                    </div>

                    {/* Zone de chargement pour modification du tracé */}
                    {hasPrivilege("modifier_projet") && (
                      <div className="text-[10px] text-slate-500 bg-slate-50/60 p-3 rounded-xl border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-700">
                            {selectedProject.identity.kmzFileData 
                              ? "Remplacer ou supprimer le tracé SIG du projet :" 
                              : "Charger un tracé KML/KMZ personnalisé pour ce projet :"}
                          </p>
                          <p className="text-[9px] text-slate-400">Glissez-déposez ou sélectionnez un fichier .kml ou .kmz officiel (max. 800 Ko)</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer transition-colors text-xs text-center shrink-0">
                            <input
                              type="file"
                              accept=".kml,.kmz"
                              className="hidden"
                              onChange={(e) => handleUploadKMZ(e, selectedProject)}
                            />
                            {selectedProject.identity.kmzFileData ? "Remplacer le fichier" : "Charger un fichier"}
                          </label>
                          {selectedProject.identity.kmzFileData && (
                            <button
                              onClick={() => handleDeleteKMZ(selectedProject)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg font-bold cursor-pointer transition-colors text-xs text-center flex items-center gap-1 shrink-0"
                              title="Supprimer le tracé personnalisé"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Schéma Synoptique Automatique */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono">Visualisation Technique</span>
                        <h5 className="font-black text-sm text-slate-800">Schéma Synoptique Automatique de l'Ouvrage</h5>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-mono">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></span> Actif / Présent</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-200 border border-slate-300 rounded-full"></span> Non configuré</span>
                      </div>
                    </div>

                    {/* SVG Pipeline Diagram */}
                    <div className="relative overflow-x-auto py-8 px-4 bg-gradient-to-r from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                      {(() => {
                        const { caracteristiques } = selectedProject.identity;
                        const isLongueurZero = parseFloat(getProjectDisplayLength(selectedProject)) === 0;

                        if (isLongueurZero) {
                          return (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-100">
                              {/* Illustration Technique à Gauche */}
                              <div className="relative w-full md:w-1/2 h-48 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_24px] opacity-20" />
                                
                                <svg className="w-full h-full p-4" viewBox="0 0 300 150">
                                  {/* Feed line vertical (yellow) */}
                                  <line x1="60" y1="10" x2="60" y2="140" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
                                  <text x="45" y="75" fill="#f59e0b" className="text-[9px] font-mono font-black" transform="rotate(-90 45 75)" textAnchor="middle">
                                    Gazoduc Existant (Alimentation)
                                  </text>

                                  {/* Direct Piquage line */}
                                  <line x1="60" y1="75" x2="140" y2="75" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                                  <circle cx="60" cy="75" r="5" fill="#f59e0b" />
                                  
                                  <text x="100" y="65" fill="#38bdf8" className="text-[10px] font-black" textAnchor="middle">
                                    Piquage
                                  </text>

                                  {/* Post Card */}
                                  <g transform="translate(140, 40)">
                                    <rect x="0" y="0" width="120" height="70" rx="8" fill="#1e1b4b" stroke="#f43f5e" strokeWidth="2.5" />
                                    
                                    {/* Detente delivery symbol inside circle */}
                                    <circle cx="35" cy="35" r="16" stroke="#f43f5e" strokeWidth="2" fill="#881337" />
                                    <path d="M29 27 L43 35 L29 43 Z" fill="#f43f5e" />
                                    
                                    <text x="85" y="32" fill="#f43f5e" className="text-[11px] font-black" textAnchor="middle">
                                      Poste DP
                                    </text>
                                    <text x="85" y="48" fill="#fda4af" className="text-[9px] font-mono font-bold" textAnchor="middle">
                                      Au Piquage
                                    </text>
                                  </g>
                                </svg>
                              </div>

                              {/* Détails techniques à droite */}
                              <div className="w-full md:w-1/2 space-y-4 text-xs text-left">
                                <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl">
                                  <p className="text-amber-400 font-extrabold flex items-center gap-1.5 mb-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                                    Poste Installé au Niveau du Piquage (L = 0 km)
                                  </p>
                                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                    Étant donné que la longueur de la conduite d'interconnexion est de 0 km, aucun tronçon de ligne n'est construit. Le poste de détente (DP) est physiquement implanté à l'emplacement immédiat du piquage d'alimentation.
                                  </p>
                                </div>

                                <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-400 font-bold font-mono text-[10px] uppercase">Point de raccordement</span>
                                    <span className="text-white font-black font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 truncate max-w-[180px]">
                                      {caracteristiques.pointRaccordement || "Non spécifié"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-400 font-bold font-mono text-[10px] uppercase">Capacité du Poste (Q)</span>
                                    <span className="text-rose-400 font-black font-mono text-sm">
                                      {caracteristiques.capacitePoste || "Non spécifiée"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400 font-bold font-mono text-[10px] uppercase">Pression de Service</span>
                                    <span className="text-blue-400 font-bold font-mono">
                                      {caracteristiques.pression || "Non spécifiée"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Get sequence from the helper function
                        const activeNodes = getPipelineSequence(caracteristiques);

                        if (activeNodes.length === 0) {
                          return (
                            <div className="py-12 text-center text-slate-500 font-bold text-xs bg-slate-900/60 rounded-xl border border-slate-800">
                              Aucun élément ou poste n'est activé dans les caractéristiques techniques du projet.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            {/* Top technical stats summary */}
                            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold uppercase text-[9px]">Longueur de ligne:</span>
                                <span className="text-emerald-400 font-black">L = {getProjectDisplayLength(selectedProject)} km</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold uppercase text-[9px]">Diamètre DN:</span>
                                <span className="text-blue-400 font-black">DN = {caracteristiques.diametre || "Non spécifié"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold uppercase text-[9px]">Capacité de Transit:</span>
                                <span className="text-rose-400 font-black">Q = {caracteristiques.capacitePoste || "Non spécifiée"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold uppercase text-[9px]">Pression:</span>
                                <span className="text-amber-400 font-black">P = {caracteristiques.pression || "Non spécifiée"}</span>
                              </div>
                            </div>

                            {/* Horizontally Scrollable Pipeline Synoptic */}
                            <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                              <div className="relative w-max min-w-full flex items-center gap-14 px-12 py-10 min-h-[220px] bg-slate-950/40 rounded-2xl border border-slate-800/40">
                                
                                {/* Background pipeline tube representing the gas pipeline */}
                                <div className="absolute top-[82px] left-[60px] w-[calc(100%-120px)] h-3 bg-slate-900 rounded-full border border-slate-800" />
                                <div className="absolute top-[84px] left-[60px] w-[calc(100%-120px)] h-2 bg-gradient-to-r from-amber-500 via-blue-500 via-teal-400 to-emerald-500 rounded-full opacity-95 shadow-[0_0_15px_rgba(45,212,191,0.5)] animate-pulse" />
                                
                                {activeNodes.map((node, index) => {
                                  const renderSymbol = () => {
                                    switch (node.type) {
                                      case "racc":
                                        return (
                                          <svg className="w-12 h-12 text-amber-500" viewBox="0 0 48 48" fill="none">
                                            <line x1="10" y1="4" x2="10" y2="44" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                                            <path d="M10 24 L22 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                                            <circle cx="10" cy="24" r="5" fill="#f59e0b" />
                                            <path d="M22 18 L22 30 L32 24 Z" fill="currentColor" />
                                            <path d="M32 18 L32 30 L22 24 Z" fill="currentColor" />
                                            <circle cx="27" cy="24" r="2" fill="#0f172a" />
                                          </svg>
                                        );
                                      case "gr_dep":
                                        return (
                                          <svg className="w-12 h-12 text-blue-500" viewBox="0 0 48 48" fill="none">
                                            <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.05" />
                                            <path d="M12 16 L24 16 L32 21 L32 27 L24 32 L12 32 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.5" />
                                            <line x1="12" y1="14" x2="12" y2="34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                            <line x1="28" y1="16" x2="28" y2="10" stroke="currentColor" strokeWidth="1.5" />
                                            <circle cx="28" cy="8" r="2" fill="currentColor" />
                                          </svg>
                                        );
                                      case "coup":
                                        return (
                                          <svg className="w-12 h-12 text-cyan-400" viewBox="0 0 48 48" fill="none">
                                            <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.05" />
                                            <path d="M10 18 L10 30 L20 24 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
                                            <path d="M20 18 L20 30 L10 24 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
                                            <line x1="15" y1="24" x2="15" y2="14" stroke="currentColor" strokeWidth="2" />
                                            <line x1="12" y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="2" />
                                            <line x1="20" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="2.5" />
                                            <path d="M28 18 L28 30 L38 24 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
                                            <path d="M38 18 L38 30 L28 24 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
                                            <line x1="33" y1="24" x2="33" y2="14" stroke="currentColor" strokeWidth="2" />
                                            <line x1="30" y1="14" x2="36" y2="14" stroke="currentColor" strokeWidth="2" />
                                          </svg>
                                        );
                                      case "sect":
                                        return (
                                          <svg className="w-12 h-12 text-orange-400" viewBox="0 0 48 48" fill="none">
                                            <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.05" />
                                            <path d="M14 16 L14 32 L34 24 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                                            <path d="M34 16 L34 32 L14 24 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                                            <line x1="24" y1="24" x2="24" y2="12" stroke="currentColor" strokeWidth="2" />
                                            <circle cx="24" cy="11" r="2.5" fill="currentColor" />
                                          </svg>
                                        );
                                      case "gr_arr":
                                        return (
                                          <svg className="w-12 h-12 text-emerald-500" viewBox="0 0 48 48" fill="none">
                                            <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.05" />
                                            <path d="M16 21 L24 16 L36 16 L36 32 L24 32 L16 27 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.5" />
                                            <line x1="36" y1="14" x2="36" y2="34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                            <line x1="20" y1="18" x2="20" y2="10" stroke="currentColor" strokeWidth="1.5" />
                                            <circle cx="20" cy="8" r="2" fill="currentColor" />
                                          </svg>
                                        );
                                      case "det":
                                        return (
                                          <svg className="w-12 h-12 text-rose-500" viewBox="0 0 48 48" fill="none">
                                            <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" fill="currentColor" fillOpacity="0.05" />
                                            <path d="M18 15 L34 24 L18 33 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                                            <line x1="24" y1="6" x2="24" y2="42" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                                          </svg>
                                        );
                                      default:
                                        return <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700" />;
                                    }
                                  };

                                  return (
                                    <div key={node.id || index} className="flex flex-col items-center relative z-10 w-32 shrink-0 text-center bg-slate-950/90 py-3.5 px-3 rounded-2xl border border-slate-800 shadow-xl transition-all hover:scale-105 hover:border-slate-700">
                                      {/* Node sequence indicator badge */}
                                      <div className="absolute -top-2.5 -left-1 text-[8px] font-bold font-mono px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400">
                                        {node.pk ? `PK ${node.pk}` : `Ouvrage ${index + 1}`}
                                      </div>
                                      
                                      <div className="flex items-center justify-center mb-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                        {renderSymbol()}
                                      </div>
                                      
                                      <span className="text-[10px] font-black text-slate-100 leading-tight block h-7 overflow-hidden text-ellipsis line-clamp-2">
                                        {node.label}
                                      </span>
                                      
                                      <span className="text-[8px] text-slate-500 font-mono block mt-1 uppercase tracking-wider font-bold">
                                        {node.type === "racc" ? "Piquage" : node.type === "gr_dep" ? "GRD (Départ)" : node.type === "gr_arr" ? "GRA (Arrivée)" : node.type === "coup" ? "Coupure" : node.type === "sect" ? "Sectionnement" : "Détente / DP"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Multi-lot Management Section */}
                  {(() => {
                    const updateProjectContractField = async (contractKey: 'bureauEtude' | 'betEnvironnement' | 'expert' | 'etbGC' | 'etbMeca', field: string, value: any, lotId?: string) => {
                      if (!selectedProject?.id) return;
                      const emptyContractObj = { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0, delai: "", postesAffectes: "" };
                      const currentContrats = selectedProject.contrats || {};
                      const currentContractKeyObj = (currentContrats as any)[contractKey] || emptyContractObj;
                      
                      const updatedContrats = {
                        ...currentContrats,
                        [contractKey]: {
                          ...currentContractKeyObj,
                          [field]: value
                        }
                      };

                      const updatePayload: any = {
                        contrats: updatedContrats,
                        updatedAt: new Date().toISOString()
                      };

                      if (contractKey === 'expert' && field === 'nom') {
                        updatePayload.ficheSuivi = {
                          ...(selectedProject.ficheSuivi || {}),
                          gefCabinet: value
                        };
                        updatePayload.etudeAutorisation = {
                          ...(selectedProject.etudeAutorisation || {}),
                          expertiseFonciere: {
                            ...(selectedProject.etudeAutorisation?.expertiseFonciere || {}),
                            gefIdentity: value,
                            gefDesignated: !!value
                          }
                        };
                      } else if (contractKey === 'bureauEtude' && field === 'nom') {
                        updatePayload.ficheSuivi = {
                          ...(selectedProject.ficheSuivi || {}),
                          etudeBetCabinet: value
                        };
                      }

                      if (selectedProject.lots && selectedProject.lots.length > 0) {
                        const updatedLots = selectedProject.lots.map(l => {
                          if (!lotId || l.id === lotId) {
                            const lContrats = l.contrats || {};
                            return {
                              ...l,
                              contrats: {
                                ...lContrats,
                                [contractKey]: {
                                  ...((lContrats as any)[contractKey] || emptyContractObj),
                                  [field]: value
                                }
                              }
                            };
                          }
                          return l;
                        });
                        updatePayload.lots = updatedLots;
                      }

                      try {
                        await setDoc(doc(db, "projects", selectedProject.id), updatePayload, { merge: true });
                      } catch (err) {
                        console.error("Error updating contract field:", err);
                      }
                    };

                    return (
                      <div id="multi-lot-management-section" className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono">Organisation Physique</span>
                            <h5 className="font-black text-sm text-slate-800">Gestion Individuelle Multi-Lots ({selectedProject.nombreLots || 1} Lot{(selectedProject.nombreLots || 1) > 1 ? "s" : ""})</h5>
                          </div>
                          {hasPrivilege("section_travaux") && (
                            <span className="text-[10px] text-slate-400 font-mono">Vue synthétique multi-lots</span>
                          )}
                        </div>

                        {/* Defile de haut en bas lot 1 ... lot 2 ... lot 3 */}
                        <div className="space-y-6">
                          {((selectedProject.lots && selectedProject.lots.length > 0) ? selectedProject.lots : [
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                              <div className="flex items-center gap-2.5">
                                <span className="bg-blue-600 text-white font-black px-2.5 py-1 rounded-lg text-[10px] uppercase font-mono tracking-wider">
                                  {lot.id?.toUpperCase() || `LOT ${idx + 1}`}
                                </span>
                                <h6 className="font-black text-xs text-slate-800">{lot.name || `Lot ${idx + 1}`}</h6>
                                {lot.wilaya && (
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[9px] font-black border border-slate-200">
                                    {lot.wilaya}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Phase Actuelle :</span>
                                  <span className="bg-white px-2.5 py-1 rounded-full border border-slate-200 font-black text-[10px] text-blue-700">
                                    {lot.phase || "Étude"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* PK limit and assigned postes display */}
                            <div className="flex flex-col sm:flex-row justify-between gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                                <span className="font-bold">Emprise du Lot :</span>
                                <span className="font-black text-slate-900 bg-slate-100/80 px-2 py-0.5 rounded-md font-mono">
                                  Lot {idx + 1} du Point Kilométrique PK.N° {lot.pkStart || "0+000"} à PK N° {lot.pkEnd || ".+...."}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="font-bold">Postes/Points affectés :</span>
                                <span className="font-black text-slate-900 truncate max-w-[280px]" title={lot.postesAffectes?.join(", ")}>
                                  {lot.postesAffectes && lot.postesAffectes.length > 0 ? lot.postesAffectes.join(", ") : "Aucun ouvrage affecté"}
                                </span>
                              </div>
                            </div>


                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                  {/* PK configuration */}
                                  <div className="space-y-1.5">
                                    <span className="text-slate-500 font-black text-[9px] uppercase tracking-wider block">Limites Géographiques du Lot :</span>
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400 text-[10px] font-bold">PK Début :</span>
                                        <input 
                                          type="text"
                                          placeholder="0+000"
                                          value={lot.pkStart || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const updatedLots = (selectedProject.lots || []).map(l => 
                                              l.id === lot.id ? { ...l, pkStart: val } : l
                                            );
                                            setDoc(doc(db, "projects", selectedProject.id), { 
                                              lots: updatedLots,
                                              updatedAt: new Date().toISOString()
                                            }, { merge: true });
                                          }}
                                          className="w-24 bg-white border border-slate-200 rounded px-2 py-1 font-bold text-slate-800 font-mono text-[11px] outline-none"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400 text-[10px] font-bold">PK Fin :</span>
                                        <input 
                                          type="text"
                                          placeholder=".+...."
                                          value={lot.pkEnd || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const updatedLots = (selectedProject.lots || []).map(l => 
                                              l.id === lot.id ? { ...l, pkEnd: val } : l
                                            );
                                            setDoc(doc(db, "projects", selectedProject.id), { 
                                              lots: updatedLots,
                                              updatedAt: new Date().toISOString()
                                            }, { merge: true });
                                          }}
                                          className="w-24 bg-white border border-slate-200 rounded px-2 py-1 font-bold text-slate-800 font-mono text-[11px] outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Postes/Ouvrages allocation */}
                                  <div className="space-y-1.5">
                                    <span className="text-slate-500 font-black text-[9px] uppercase tracking-wider block">Affectation des Ouvrages & Points Concentrés :</span>
                                    {(() => {
                                      const availableOuvragesList = [];
                                      if (selectedProject.identity?.caracteristiques?.hasPiquage) availableOuvragesList.push("Piquage");
                                      if (selectedProject.identity?.caracteristiques?.hasGareRacleurDepart) availableOuvragesList.push("Gare Racleur Départ");
                                      if (selectedProject.identity?.caracteristiques?.hasGareRacleurArrivee) availableOuvragesList.push("Gare Racleur Arrivée");

                                      if (selectedProject.identity?.caracteristiques?.hasPosteCoupure) {
                                        const count = selectedProject.identity.caracteristiques.nbPostesCoupure || 1;
                                        for (let i = 1; i <= count; i++) {
                                          availableOuvragesList.push(`Poste de Coupure ${i}`);
                                        }
                                      }
                                      if (selectedProject.identity?.caracteristiques?.hasPosteSectionnement) {
                                        const count = selectedProject.identity.caracteristiques.nbPostesSectionnement || 1;
                                        for (let i = 1; i <= count; i++) {
                                          availableOuvragesList.push(`Poste de Sectionnement ${i}`);
                                        }
                                      }
                                      if (selectedProject.identity?.caracteristiques?.hasPosteDetente) {
                                        availableOuvragesList.push("Poste de Détente");
                                      }

                                      // Add any other pipeline sequence labels
                                      if (selectedProject.identity?.caracteristiques?.pipelineSequence) {
                                        selectedProject.identity.caracteristiques.pipelineSequence.forEach(node => {
                                          if (node.label && !availableOuvragesList.includes(node.label)) {
                                            availableOuvragesList.push(node.label);
                                          }
                                        });
                                      }

                                      const hasOuvrageDuplicate = (ov: string) => {
                                        return (selectedProject.lots || []).some(l => l.postesAffectes?.includes(ov));
                                      };

                                      return (
                                        <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-slate-200">
                                          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                            <select
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                
                                                const isDuplicate = hasOuvrageDuplicate(val);
                                                if (isDuplicate) {
                                                  const confirmAdd = window.confirm(`⚠️ Attention: L'ouvrage "${val}" est déjà attribué à un autre lot. Êtes-vous sûr de vouloir l'affecter également à ce lot ?`);
                                                  if (!confirmAdd) {
                                                    e.target.value = "";
                                                    return;
                                                  }
                                                }

                                                let currentList = lot.postesAffectes || [];
                                                if (!currentList.includes(val)) {
                                                  currentList = [...currentList, val];
                                                }
                                                
                                                const updatedLots = (selectedProject.lots || []).map(l => 
                                                  l.id === lot.id ? { ...l, postesAffectes: currentList } : l
                                                );
                                                setDoc(doc(db, "projects", selectedProject.id), { 
                                                  lots: updatedLots,
                                                  updatedAt: new Date().toISOString()
                                                }, { merge: true });
                                                
                                                e.target.value = "";
                                              }}
                                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                                            >
                                              <option value="">➕ Affecter un Ouvrage / Point Concentré...</option>
                                              {availableOuvragesList.map((ov, oIdx) => {
                                                const isAlreadyInCurrentLot = lot.postesAffectes?.includes(ov);
                                                if (isAlreadyInCurrentLot) return null;
                                                
                                                const isDuplicate = hasOuvrageDuplicate(ov);
                                                return (
                                                  <option key={oIdx} value={ov}>
                                                    {ov} {isDuplicate ? " ⚠️ (Déjà affecté à un autre lot)" : ""}
                                                  </option>
                                                );
                                              })}
                                            </select>
                                            
                                            <div className="flex gap-1.5 items-center">
                                              <input 
                                                type="text"
                                                placeholder="Saisir manuellement..."
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = e.currentTarget.value.trim();
                                                    if (val) {
                                                      const isDuplicate = hasOuvrageDuplicate(val);
                                                      if (isDuplicate) {
                                                        const confirmAdd = window.confirm(`⚠️ Attention: L'ouvrage "${val}" est déjà attribué à un autre lot. Voulez-vous continuer ?`);
                                                        if (!confirmAdd) return;
                                                      }
                                                      let currentList = lot.postesAffectes || [];
                                                      if (!currentList.includes(val)) {
                                                        currentList = [...currentList, val];
                                                      }
                                                      const updatedLots = (selectedProject.lots || []).map(l => 
                                                        l.id === lot.id ? { ...l, postesAffectes: currentList } : l
                                                      );
                                                      setDoc(doc(db, "projects", selectedProject.id), { 
                                                        lots: updatedLots,
                                                        updatedAt: new Date().toISOString()
                                                      }, { merge: true });
                                                      e.currentTarget.value = "";
                                                    }
                                                  }
                                                }}
                                                className="w-40 bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800 text-xs outline-none"
                                              />
                                            </div>
                                          </div>

                                          {lot.postesAffectes && lot.postesAffectes.some(p => (selectedProject.lots || []).some(other => other.id !== lot.id && other.postesAffectes?.includes(p))) && (
                                            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2 text-[10px] font-bold mt-1.5">
                                              ⚠️ Un ou plusieurs ouvrages ci-dessous sont également affectés à d'autres lots (double détection).
                                            </div>
                                          )}

                                          {lot.postesAffectes && lot.postesAffectes.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-2">
                                              {lot.postesAffectes.map((p, pIdx) => {
                                                const isDup = (selectedProject.lots || []).some(other => other.id !== lot.id && other.postesAffectes?.includes(p));
                                                return (
                                                  <span key={pIdx} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${
                                                    isDup ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs' : 'bg-slate-100 border-slate-200 text-slate-700'
                                                  }`}>
                                                    <span>{p}</span>
                                                    {isDup && <span className="text-[9px] font-mono font-black uppercase text-amber-600 bg-amber-200 px-1 rounded-sm">LOT DOUBLE</span>}
                                                    <button 
                                                      type="button" 
                                                      onClick={() => {
                                                        const updatedList = lot.postesAffectes?.filter((_, i) => i !== pIdx) || [];
                                                        const updatedLots = (selectedProject.lots || []).map(l => 
                                                          l.id === lot.id ? { ...l, postesAffectes: updatedList } : l
                                                        );
                                                        setDoc(doc(db, "projects", selectedProject.id), { 
                                                          lots: updatedLots,
                                                          updatedAt: new Date().toISOString()
                                                        }, { merge: true });
                                                      }}
                                                      className="text-red-500 hover:text-red-700 font-extrabold text-[11px] ml-1.5 focus:outline-none"
                                                    >
                                                      ×
                                                    </button>
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

  );
}
