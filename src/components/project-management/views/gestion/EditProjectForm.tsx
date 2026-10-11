import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Briefcase, Layers, FileCheck, Activity, Archive,
  Save, X, Plus, Trash2, Search, UserCheck
} from 'lucide-react';
import { Project } from '../../types';
import { WILAYAS_ALGERIE, POLES_ALGERIE, REGIONS_ALGERIE } from '../../constants';
import { formatDateFrench, getPipelineSequence } from '../../projectUtils';

export interface EditProjectFormProps {
  editProjectData: Project;
  setEditProjectData: React.Dispatch<React.SetStateAction<Project | null>>;
  isCreating: boolean;
  setIsEditing: (val: boolean) => void;
  setIsCreating: (val: boolean) => void;
  handleCreateProject: () => Promise<void>;
  saveProjectChanges: () => Promise<void>;
  setIsCPSearchOpen: (val: boolean) => void;
  setCpSearchType: (type: 'travaux' | 'etude' | 'expertise' | 'superviseurs') => void;
  setCpSearchQuery: (query: string) => void;
  profilesList: any[];
}

export function EditProjectForm({
  editProjectData,
  setEditProjectData,
  isCreating,
  setIsEditing,
  setIsCreating,
  handleCreateProject,
  saveProjectChanges,
  setIsCPSearchOpen,
  setCpSearchType,
  setCpSearchQuery,
  profilesList,
}: EditProjectFormProps) {
  return (
          /* ================= EDITING / CREATING MODE ================= */
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider">
                  {isCreating ? "Création de projet" : "Édition de projet"}
                </span>
                <input
                  type="text"
                  value={editProjectData.name}
                  onChange={(e) => setEditProjectData({ ...editProjectData, name: e.target.value })}
                  className="block w-full text-base sm:text-lg font-extrabold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:border-blue-600 focus:outline-none focus:ring-0 mt-1 max-w-2xl"
                  placeholder="Nom du projet Gazoduc"
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setIsCreating(false);
                    setEditProjectData(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Annuler</span>
                </button>
                <button
                  onClick={isCreating ? handleCreateProject : saveProjectChanges}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-orange-500/20 cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{isCreating ? "Créer" : "Enregistrer"}</span>
                </button>
              </div>
            </div>

            {/* Editing Form Grid divided into the standard project sections */}
            <div className="space-y-6 divide-y divide-slate-100">
              {/* Phase 00: Planning Calendrier */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-blue-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Phase 00 : Planification des dates (Graphique Gantt)</span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Début Phase Étude</label>
                    <input
                      type="date"
                      value={editProjectData.planning.etudeStart}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, etudeStart: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Fin Phase Étude</label>
                    <input
                      type="date"
                      value={editProjectData.planning.etudeEnd}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, etudeEnd: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Début Phase Travaux</label>
                    <input
                      type="date"
                      value={editProjectData.planning.travauxStart}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, travauxStart: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Fin Phase Travaux</label>
                    <input
                      type="date"
                      value={editProjectData.planning.travauxEnd}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, travauxEnd: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Début Essais Réglementaires</label>
                    <input
                      type="date"
                      value={editProjectData.planning.essaisStart}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, essaisStart: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Fin Essais Réglementaires</label>
                    <input
                      type="date"
                      value={editProjectData.planning.essaisEnd}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, essaisEnd: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Début Mise en Gaz</label>
                    <input
                      type="date"
                      value={editProjectData.planning.gazStart}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, gazStart: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Fin Mise en Gaz</label>
                    <input
                      type="date"
                      value={editProjectData.planning.gazEnd}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        planning: { ...editProjectData.planning, gazEnd: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Phase 01: Identité du projet */}
              <div className="space-y-4 pt-4">
                <h4 className="font-extrabold text-sm text-blue-700 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  <span>Phase 01 : Identité & Caractéristiques du Projet</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Direction / Région de Projet</label>
                    <select
                      value={editProjectData.identity.region}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, region: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800 cursor-pointer focus:bg-white focus:border-blue-500 transition-all"
                    >
                      <option value="">Sélectionner une direction ou région</option>
                      {editProjectData.identity.region && !REGIONS_ALGERIE.includes(editProjectData.identity.region) && (
                        <option value={editProjectData.identity.region}>{editProjectData.identity.region}</option>
                      )}
                      {REGIONS_ALGERIE.map(reg => (
                        <option key={reg} value={reg}>{reg}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Pôle TG</label>
                    <select
                      value={editProjectData.identity.pole}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, pole: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800 cursor-pointer focus:bg-white focus:border-blue-500 transition-all"
                    >
                      <option value="">Sélectionner un pôle</option>
                      {editProjectData.identity.pole && !POLES_ALGERIE.includes(editProjectData.identity.pole) && (
                        <option value={editProjectData.identity.pole}>{editProjectData.identity.pole}</option>
                      )}
                      {POLES_ALGERIE.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Phase Actuelle</label>
                    <select
                      value={editProjectData.identity.phase}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, phase: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800 cursor-pointer focus:bg-white focus:border-blue-500 transition-all"
                    >
                      <option value="Étude">Étude</option>
                      <option value="Travaux">Travaux</option>
                      <option value="Mise en Gaz">Mise en Gaz</option>
                      <option value="Clôturé">Clôturé</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Wilaya</label>
                    <select
                      value={editProjectData.identity.wilaya}
                      onChange={(e) => {
                        const selectedWilaya = e.target.value;
                        setEditProjectData({
                          ...editProjectData,
                          identity: { 
                            ...editProjectData.identity, 
                            wilaya: selectedWilaya,
                            district: selectedWilaya ? `${selectedWilaya} District` : ""
                          }
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800 cursor-pointer focus:bg-white focus:border-blue-500 transition-all"
                    >
                      <option value="">Sélectionner une wilaya</option>
                      {editProjectData.identity.wilaya && !WILAYAS_ALGERIE.includes(editProjectData.identity.wilaya) && (
                        <option value={editProjectData.identity.wilaya}>{editProjectData.identity.wilaya}</option>
                      )}
                      {WILAYAS_ALGERIE.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">District</label>
                    <select
                      value={editProjectData.identity.district}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, district: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800 cursor-pointer focus:bg-white focus:border-blue-500 transition-all"
                    >
                      <option value="">Sélectionner un district</option>
                      {editProjectData.identity.district && !WILAYAS_ALGERIE.map(w => `${w} District`).includes(editProjectData.identity.district) && (
                        <option value={editProjectData.identity.district}>{editProjectData.identity.district}</option>
                      )}
                      {WILAYAS_ALGERIE.map(w => {
                        const distVal = `${w} District`;
                        return (
                          <option key={distVal} value={distVal}>District {w}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Cadre d'Inscription</label>
                    <input
                      type="text"
                      value={editProjectData.identity.cadreInscription}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, cadreInscription: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                      placeholder="e.g., Programme d'Urgence"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Structure Chargée</label>
                    <input
                      type="text"
                      value={editProjectData.identity.structureChargee}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, structureChargee: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                      placeholder="e.g., Division Transport"
                    />
                  </div>
                </div>

                {/* Superviseurs du Projet */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                  <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider font-mono">Superviseurs & Hiérarchie (Lien aux comptes)</span>
                  <div className="space-y-2 border border-slate-150 p-3 rounded-xl bg-white shadow-sm max-w-md">
                    <label className="font-bold text-slate-600 block">Superviseurs du Projet (Groupe/Membres)</label>
                    
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {((editProjectData.superviseurs || [])).map((item, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 bg-amber-50/50 px-3 py-1.5 rounded-lg border border-amber-100 text-[11px]">
                          <div className="truncate min-w-0">
                            <p className="font-extrabold text-amber-700 truncate">{item.name}</p>
                            {item.structure && (
                              <p className="text-[10px] text-slate-500 font-bold truncate">🏢 {item.structure}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newList = (editProjectData.superviseurs || []).filter((_, i) => i !== index);
                              setEditProjectData({
                                ...editProjectData,
                                superviseurs: newList,
                                superviseurUid: newList[0]?.uid || "",
                                superviseurName: newList[0]?.name || "",
                                superviseurEmail: newList[0]?.email || "",
                                superviseurStructure: newList[0]?.structure || ""
                              });
                            }}
                            className="text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                            title="Retirer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {(!editProjectData.superviseurs || editProjectData.superviseurs.length === 0) && (
                        <p className="text-[10px] text-slate-400 italic font-medium">Aucun Superviseur sélectionné</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      <select
                        value=""
                        onChange={(e) => {
                          const uid = e.target.value;
                          if (!uid) return;
                          const found = profilesList.find(u => u.id === uid);
                          if (found) {
                            const currentList = editProjectData.superviseurs || [];
                            if (currentList.some(item => item.uid === uid)) return;
                            
                            const newItem = {
                              uid: found.id,
                              name: found.name,
                              email: found.email || "",
                              structure: found.structure || ""
                            };
                            const newList = [...currentList, newItem];
                            setEditProjectData({
                              ...editProjectData,
                              superviseurs: newList,
                              superviseurUid: newList[0]?.uid || "",
                              superviseurName: newList[0]?.name || "",
                              superviseurEmail: newList[0]?.email || "",
                              superviseurStructure: newList[0]?.structure || ""
                            });
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none text-[11px] font-bold text-slate-700 cursor-pointer focus:border-blue-500"
                      >
                        <option value="">+ Superviseur (Compte)</option>
                        {profilesList.map(prof => (
                          <option key={prof.id} value={prof.id}>
                            {prof.name} {prof.structure ? `[${prof.structure}]` : ""} ({prof.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setCpSearchType("superviseurs");
                          setCpSearchQuery("");
                          setIsCPSearchOpen(true);
                        }}
                        className="w-full py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold text-[11px] rounded-xl border border-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                        title="Recherche avancée de superviseur"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Rechercher</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Characteristics nested */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Caractéristiques techniques du Gazoduc</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1 col-span-2 md:col-span-4">
                      <label className="font-bold text-slate-600">Type de Projet</label>
                      <select
                        value={editProjectData.identity.caracteristiques.typeOuvrage || "Standard"}
                        onChange={(e) => {
                          const val = e.target.value;
                          const isSeul = val === "Poste de détente seul";
                          setEditProjectData({
                            ...editProjectData,
                            identity: {
                              ...editProjectData.identity,
                              caracteristiques: {
                                ...editProjectData.identity.caracteristiques,
                                typeOuvrage: val,
                                longueur: isSeul ? "0" : (editProjectData.identity.caracteristiques.longueur === "0" ? "10" : editProjectData.identity.caracteristiques.longueur),
                                hasPosteDetente: isSeul ? true : editProjectData.identity.caracteristiques.hasPosteDetente
                              }
                            }
                          });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="Standard">Standard (Gazoduc Ligne + Postes)</option>
                        <option value="Poste de détente seul">Poste de détente seul</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Diamètre de la conduite</label>
                      <input
                        type="text"
                        value={editProjectData.identity.caracteristiques.diametre}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          identity: { 
                            ...editProjectData.identity, 
                            caracteristiques: { ...editProjectData.identity.caracteristiques, diametre: e.target.value } 
                          }
                        })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2"
                        placeholder="e.g., 20 pouces (DN 500)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Longueur (km)</label>
                      <input
                        type="text"
                        value={editProjectData.identity.caracteristiques.longueur}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          identity: { 
                            ...editProjectData.identity, 
                            caracteristiques: { ...editProjectData.identity.caracteristiques, longueur: e.target.value } 
                          }
                        })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2"
                        placeholder="e.g., 42"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Pression réglementaire</label>
                      <input
                        type="text"
                        value={editProjectData.identity.caracteristiques.pression}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          identity: { 
                            ...editProjectData.identity, 
                            caracteristiques: { ...editProjectData.identity.caracteristiques, pression: e.target.value } 
                          }
                        })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2"
                        placeholder="e.g., 70 bar"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Qualité / Type d'acier</label>
                      <input
                        type="text"
                        value={editProjectData.identity.caracteristiques.typeTuyau}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          identity: { 
                            ...editProjectData.identity, 
                            caracteristiques: { ...editProjectData.identity.caracteristiques, typeTuyau: e.target.value } 
                          }
                        })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2"
                        placeholder="e.g., Acier API 5L X60"
                      />
                    </div>
                  </div>

                  {/* Consistances & Composition de l'Ouvrage (Schéma Synoptique) */}
                  <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 space-y-3 mt-4">
                    <h5 className="font-extrabold text-xs uppercase text-slate-700 tracking-wider">Consistance & Composition (Schéma Synoptique)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!editProjectData.identity.caracteristiques.hasPiquage}
                          onChange={(e) => setEditProjectData({
                            ...editProjectData,
                            identity: {
                              ...editProjectData.identity,
                              caracteristiques: { ...editProjectData.identity.caracteristiques, hasPiquage: e.target.checked }
                            }
                          })}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Piquage</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!editProjectData.identity.caracteristiques.hasGareRacleurDepart}
                          onChange={(e) => setEditProjectData({
                            ...editProjectData,
                            identity: {
                              ...editProjectData.identity,
                              caracteristiques: { ...editProjectData.identity.caracteristiques, hasGareRacleurDepart: e.target.checked }
                            }
                          })}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Gare Racleur Départ</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!editProjectData.identity.caracteristiques.hasGareRacleurArrivee}
                          onChange={(e) => setEditProjectData({
                            ...editProjectData,
                            identity: {
                              ...editProjectData.identity,
                              caracteristiques: { ...editProjectData.identity.caracteristiques, hasGareRacleurArrivee: e.target.checked }
                            }
                          })}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Gare Racleur Arrivée</span>
                      </label>

                      <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!editProjectData.identity.caracteristiques.hasPosteCoupure}
                            onChange={(e) => setEditProjectData({
                              ...editProjectData,
                              identity: {
                                ...editProjectData.identity,
                                caracteristiques: { 
                                  ...editProjectData.identity.caracteristiques, 
                                  hasPosteCoupure: e.target.checked,
                                  nbPostesCoupure: e.target.checked ? (editProjectData.identity.caracteristiques.nbPostesCoupure || 1) : 0
                                }
                              }
                            })}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Poste de Coupure</span>
                        </label>
                        {!!editProjectData.identity.caracteristiques.hasPosteCoupure && (
                          <div className="flex items-center gap-1.5 pl-6 mt-0.5 text-[11px]">
                            <span className="text-slate-500">Nombre de postes:</span>
                            <input
                              type="number"
                              min={1}
                              value={editProjectData.identity.caracteristiques.nbPostesCoupure || 1}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setEditProjectData({
                                  ...editProjectData,
                                  identity: {
                                    ...editProjectData.identity,
                                    caracteristiques: {
                                      ...editProjectData.identity.caracteristiques,
                                      nbPostesCoupure: val
                                    }
                                  }
                                });
                              }}
                              className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800 outline-none font-mono"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!editProjectData.identity.caracteristiques.hasPosteSectionnement}
                            onChange={(e) => setEditProjectData({
                              ...editProjectData,
                              identity: {
                                ...editProjectData.identity,
                                caracteristiques: { 
                                  ...editProjectData.identity.caracteristiques, 
                                  hasPosteSectionnement: e.target.checked,
                                  nbPostesSectionnement: e.target.checked ? (editProjectData.identity.caracteristiques.nbPostesSectionnement || 1) : 0
                                }
                              }
                            })}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Poste de Sectionnement</span>
                        </label>
                        {!!editProjectData.identity.caracteristiques.hasPosteSectionnement && (
                          <div className="flex items-center gap-1.5 pl-6 mt-0.5 text-[11px]">
                            <span className="text-slate-500">Nombre de postes:</span>
                            <input
                              type="number"
                              min={1}
                              value={editProjectData.identity.caracteristiques.nbPostesSectionnement || 1}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setEditProjectData({
                                  ...editProjectData,
                                  identity: {
                                    ...editProjectData.identity,
                                    caracteristiques: {
                                      ...editProjectData.identity.caracteristiques,
                                      nbPostesSectionnement: val
                                    }
                                  }
                                });
                              }}
                              className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800 outline-none font-mono"
                            />
                          </div>
                        )}
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!editProjectData.identity.caracteristiques.hasPosteDetente}
                          onChange={(e) => setEditProjectData({
                            ...editProjectData,
                            identity: {
                              ...editProjectData.identity,
                              caracteristiques: { ...editProjectData.identity.caracteristiques, hasPosteDetente: e.target.checked }
                            }
                          })}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Poste de Détente</span>
                      </label>
                    </div>
                    
                    {/* Incremental Pipeline Sequence Builder */}
                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 space-y-3 mt-4 text-left">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <div>
                          <h5 className="font-extrabold text-xs uppercase text-slate-300 tracking-wider">Séquence de Construction du Gazoduc (Incrémentale)</h5>
                          <p className="text-[10px] text-slate-400">Configurez l'ordre des ouvrages de manière incrémentale (ex: Piquage → GRD → Postes → GRA → DP)</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            // Initialize with current active sequence if empty
                            const currentSeq = getPipelineSequence(editProjectData.identity.caracteristiques);
                            const updatedSeq = [
                              ...currentSeq,
                              { id: `elem-${Date.now()}`, type: "coup", label: "Nouveau Poste de Coupure", pk: "" }
                            ];
                            setEditProjectData({
                              ...editProjectData,
                              identity: {
                                ...editProjectData.identity,
                                caracteristiques: {
                                  ...editProjectData.identity.caracteristiques,
                                  pipelineSequence: updatedSeq
                                }
                              }
                            });
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] uppercase rounded-lg transition-colors flex items-center gap-1 shadow-md shadow-blue-900/40"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Ajouter Ouvrage
                        </button>
                      </div>

                      {/* Display current sequence list */}
                      {(() => {
                        const seq = editProjectData.identity.caracteristiques.pipelineSequence || getPipelineSequence(editProjectData.identity.caracteristiques);
                        
                        if (seq.length === 0) {
                          return (
                            <div className="py-6 text-center text-slate-500 text-xs font-bold border border-dashed border-slate-300 rounded-xl">
                              Aucun ouvrage dans la séquence de construction. Cliquez sur "Ajouter Ouvrage".
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                            {seq.map((node: any, idx: number) => (
                              <div key={node.id || idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/60 shadow-inner">
                                {/* Type selector */}
                                <select
                                  value={node.type}
                                  onChange={(e) => {
                                    const updated = [...seq];
                                    updated[idx] = { ...updated[idx], type: e.target.value as any };
                                    setEditProjectData({
                                      ...editProjectData,
                                      identity: {
                                        ...editProjectData.identity,
                                        caracteristiques: {
                                          ...editProjectData.identity.caracteristiques,
                                          pipelineSequence: updated
                                        }
                                      }
                                    });
                                  }}
                                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs outline-none focus:border-blue-500 font-bold"
                                >
                                  <option value="racc">Piquage / Raccordement</option>
                                  <option value="gr_dep">Gare Racleur Départ (GRD)</option>
                                  <option value="coup">Poste de Coupure</option>
                                  <option value="sect">Poste de Sectionnement</option>
                                  <option value="gr_arr">Gare Racleur Arrivée (GRA)</option>
                                  <option value="det">Poste Détente (DP)</option>
                                </select>

                                {/* Label input */}
                                <input
                                  type="text"
                                  value={node.label || ""}
                                  onChange={(e) => {
                                    const updated = [...seq];
                                    updated[idx] = { ...updated[idx], label: e.target.value };
                                    setEditProjectData({
                                      ...editProjectData,
                                      identity: {
                                        ...editProjectData.identity,
                                        caracteristiques: {
                                          ...editProjectData.identity.caracteristiques,
                                          pipelineSequence: updated
                                        }
                                      }
                                    });
                                  }}
                                  placeholder="Nom / Libellé de l'ouvrage"
                                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 text-xs outline-none focus:border-blue-500 font-medium"
                                />

                                {/* PK location input */}
                                <input
                                  type="text"
                                  value={node.pk || ""}
                                  onChange={(e) => {
                                    const updated = [...seq];
                                    updated[idx] = { ...updated[idx], pk: e.target.value };
                                    setEditProjectData({
                                      ...editProjectData,
                                      identity: {
                                        ...editProjectData.identity,
                                        caracteristiques: {
                                          ...editProjectData.identity.caracteristiques,
                                          pipelineSequence: updated
                                        }
                                      }
                                    });
                                  }}
                                  placeholder="PK / Capacité"
                                  className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 text-xs text-center outline-none focus:border-blue-500 font-mono"
                                />

                                {/* Action Buttons (Up, Down, Delete) */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      if (idx === 0) return;
                                      const updated = [...seq];
                                      const temp = updated[idx];
                                      updated[idx] = updated[idx - 1];
                                      updated[idx - 1] = temp;
                                      setEditProjectData({
                                        ...editProjectData,
                                        identity: {
                                          ...editProjectData.identity,
                                          caracteristiques: {
                                            ...editProjectData.identity.caracteristiques,
                                            pipelineSequence: updated
                                          }
                                        }
                                      });
                                    }}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded transition-colors"
                                    title="Monter"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === seq.length - 1}
                                    onClick={() => {
                                      if (idx === seq.length - 1) return;
                                      const updated = [...seq];
                                      const temp = updated[idx];
                                      updated[idx] = updated[idx + 1];
                                      updated[idx + 1] = temp;
                                      setEditProjectData({
                                        ...editProjectData,
                                        identity: {
                                          ...editProjectData.identity,
                                          caracteristiques: {
                                            ...editProjectData.identity.caracteristiques,
                                            pipelineSequence: updated
                                          }
                                        }
                                      });
                                    }}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded transition-colors"
                                    title="Descendre"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = seq.filter((_: any, i: number) => i !== idx);
                                      setEditProjectData({
                                        ...editProjectData,
                                        identity: {
                                          ...editProjectData.identity,
                                          caracteristiques: {
                                            ...editProjectData.identity.caracteristiques,
                                            pipelineSequence: updated
                                          }
                                        }
                                      });
                                    }}
                                    className="p-1.5 bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-red-300 rounded transition-colors ml-1"
                                    title="Supprimer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">Point de raccordement (Saisie libre)</label>
                        <input
                          type="text"
                          value={editProjectData.identity.caracteristiques.pointRaccordement || ""}
                          onChange={(e) => setEditProjectData({
                            ...editProjectData,
                            identity: {
                              ...editProjectData.identity,
                              caracteristiques: { ...editProjectData.identity.caracteristiques, pointRaccordement: e.target.value }
                            }
                          })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs"
                          placeholder="e.g., Vanne d'interconnexion PK 22"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">Capacité du Poste (M3/h)</label>
                        <input
                          type="text"
                          value={editProjectData.identity.caracteristiques.capacitePoste || ""}
                          onChange={(e) => setEditProjectData({
                            ...editProjectData,
                            identity: {
                              ...editProjectData.identity,
                              caracteristiques: { ...editProjectData.identity.caracteristiques, capacitePoste: e.target.value }
                        }
                          })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs"
                          placeholder="e.g., 20 000 m³/h"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-slate-600">Nombre de Lots (Travaux)</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={1}
                            value={editProjectData.nombreLots || 1}
                            onChange={(e) => {
                              const numLots = parseInt(e.target.value) || 1;
                              let newLots = [...(editProjectData.lots || [])];
                              if (newLots.length < numLots) {
                                for (let i = newLots.length; i < numLots; i++) {
                                  newLots.push({
                                    id: `lot-${i + 1}`,
                                    name: `Lot ${i + 1}`,
                                    phase: "Étude",
                                    avancementPhysique: 0,
                                    avancementGC: 0,
                                    avancementMeca: 0,
                                    contrats: {
                                      bureauEtude: { nom: editProjectData.ficheSuivi?.etudeBetCabinet || "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                      expert: { nom: editProjectData.etudeAutorisation?.expertiseFonciere?.gefIdentity || "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                      etbGC: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                      etbMeca: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                      betEnvironnement: { nom: editProjectData.ficheSuivi?.impactBetOds || "", ref: "", montant: "", date: "", ods: "", avancement: 0 }
                                    }
                                  });
                                }
                              } else if (newLots.length > numLots) {
                                newLots = newLots.slice(0, numLots);
                              }

                              setEditProjectData({
                                ...editProjectData,
                                nombreLots: numLots,
                                lots: newLots
                              });
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const numLots = (editProjectData.nombreLots || 1) + 1;
                              const newLots = [...(editProjectData.lots || [])];
                              newLots.push({
                                id: `lot-${numLots}`,
                                name: `Lot ${numLots}`,
                                phase: "Étude",
                                avancementPhysique: 0,
                                avancementGC: 0,
                                avancementMeca: 0,
                                contrats: {
                                  bureauEtude: { nom: editProjectData.ficheSuivi?.etudeBetCabinet || "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                  expert: { nom: editProjectData.etudeAutorisation?.expertiseFonciere?.gefIdentity || "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                  etbGC: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                  etbMeca: { nom: "", ref: "", montant: "", date: "", ods: "", avancement: 0 },
                                  betEnvironnement: { nom: editProjectData.ficheSuivi?.impactBetOds || "", ref: "", montant: "", date: "", ods: "", avancement: 0 }
                                }
                              });

                              setEditProjectData({
                                ...editProjectData,
                                nombreLots: numLots,
                                lots: newLots
                              });
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap shadow-xs"
                          >
                            <span>+ Ajouter un Lot</span>
                          </button>
                        </div>
                      </div>

                      {/* Configuration individuelle de chaque lot : longueurs et PK */}
                      <div className="col-span-2 md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3">
                        {(editProjectData.lots || []).map((lot, idx) => (
                          <div key={lot.id || idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Configuration {lot.name}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-[11px]">
                              <div className="space-y-0.5">
                                <label className="font-bold text-slate-500">Nom du Lot</label>
                                <input
                                  type="text"
                                  value={lot.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedLots = (editProjectData.lots || []).map(l =>
                                      l.id === lot.id ? { ...l, name: val } : l
                                    );
                                    setEditProjectData({
                                      ...editProjectData,
                                      lots: updatedLots
                                    });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 outline-none"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <label className="font-bold text-slate-500">Longueur du lot (km)</label>
                                <input
                                  type="text"
                                  value={lot.longueur || ""}
                                  placeholder="e.g. 15"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedLots = (editProjectData.lots || []).map(l =>
                                      l.id === lot.id ? { ...l, longueur: val } : l
                                    );
                                    setEditProjectData({
                                      ...editProjectData,
                                      lots: updatedLots
                                    });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 outline-none"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <label className="font-bold text-slate-500">Wilaya du Lot</label>
                                <select
                                  value={lot.wilaya || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedLots = (editProjectData.lots || []).map(l =>
                                      l.id === lot.id ? { ...l, wilaya: val } : l
                                    );
                                    setEditProjectData({
                                      ...editProjectData,
                                      lots: updatedLots
                                    });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 outline-none text-xs"
                                >
                                  <option value="">Sélectionner une wilaya...</option>
                                  {WILAYAS_ALGERIE.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <label className="font-bold text-slate-500">PK Début</label>
                                  <input
                                    type="text"
                                    value={lot.pkStart || ""}
                                    placeholder="0+000"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedLots = (editProjectData.lots || []).map(l =>
                                        l.id === lot.id ? { ...l, pkStart: val } : l
                                      );
                                      setEditProjectData({
                                        ...editProjectData,
                                        lots: updatedLots
                                      });
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700 outline-none"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="font-bold text-slate-500">PK Fin</label>
                                  <input
                                    type="text"
                                    value={lot.pkEnd || ""}
                                    placeholder="15+000"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedLots = (editProjectData.lots || []).map(l =>
                                        l.id === lot.id ? { ...l, pkEnd: val } : l
                                      );
                                      setEditProjectData({
                                        ...editProjectData,
                                        lots: updatedLots
                                      });
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Commentaire / Notes de Planification Globale</label>
                    <textarea
                      value={editProjectData.identity.planificationComment}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, planificationComment: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none min-h-[80px]"
                      placeholder="Saisir un commentaire sur l'état d'avancement global..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Contraintes / Obstacles de Réalisation</label>
                    <textarea
                      value={editProjectData.identity.contraintes || ""}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, contraintes: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none min-h-[80px]"
                      placeholder="Opposition de riverains, retard matériel, traversée d'Oued, etc..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Actions Correctives Entreprises</label>
                    <textarea
                      value={editProjectData.identity.contraintesAction || ""}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        identity: { ...editProjectData.identity, contraintesAction: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none min-h-[80px]"
                      placeholder="Actions d'évitement ou déblocage, réunion Wilaya, etc..."
                    />
                  </div>
                </div>
              </div>

              {/* Phase 02: Etudes & Autorisations */}
              <div className="space-y-4 pt-4">
                <h4 className="font-extrabold text-sm text-blue-700 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>Phase 02 : Étude & Autorisations</span>
                </h4>

                {/* Chef de Projet Étude */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider font-mono">Chargé de Projet Étude (Lien aux comptes)</span>
                  <div className="space-y-2 border border-slate-150 p-3 rounded-xl bg-white shadow-sm max-w-md">
                    <label className="font-bold text-slate-600 block">Chargés de Projet (Partie Étude)</label>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {((editProjectData.chefsDeProjetEtude || [])).map((item, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100 text-[11px]">
                          <div className="truncate min-w-0">
                            <p className="font-extrabold text-emerald-700 truncate">{item.name}</p>
                            {item.structure && (
                              <p className="text-[10px] text-slate-500 font-bold truncate">🏢 {item.structure}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newList = (editProjectData.chefsDeProjetEtude || []).filter((_, i) => i !== index);
                              setEditProjectData({
                                ...editProjectData,
                                chefsDeProjetEtude: newList,
                                chefDeProjetEtudeUid: newList[0]?.uid || "",
                                chefDeProjetEtudeName: newList[0]?.name || "",
                                chefDeProjetEtudeEmail: newList[0]?.email || "",
                                chefDeProjetEtudeStructure: newList[0]?.structure || ""
                              });
                            }}
                            className="text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                            title="Retirer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {(!editProjectData.chefsDeProjetEtude || editProjectData.chefsDeProjetEtude.length === 0) && (
                        <p className="text-[10px] text-slate-400 italic font-medium">Aucun CP Étude sélectionné</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      <select
                        value=""
                        onChange={(e) => {
                          const uid = e.target.value;
                          if (!uid) return;
                          const found = profilesList.find(u => u.id === uid);
                          if (found) {
                            const currentList = editProjectData.chefsDeProjetEtude || [];
                            if (currentList.some(item => item.uid === uid)) return;
                            
                            const newItem = {
                              uid: found.id,
                              name: found.name,
                              email: found.email || "",
                              structure: found.structure || ""
                            };
                            const newList = [...currentList, newItem];
                            setEditProjectData({
                              ...editProjectData,
                              chefsDeProjetEtude: newList,
                              chefDeProjetEtudeUid: newList[0]?.uid || "",
                              chefDeProjetEtudeName: newList[0]?.name || "",
                              chefDeProjetEtudeEmail: newList[0]?.email || "",
                              chefDeProjetEtudeStructure: newList[0]?.structure || ""
                            });
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none text-[11px] font-bold text-slate-700 cursor-pointer focus:border-blue-500"
                      >
                        <option value="">+ CP Étude (Compte)</option>
                        {profilesList.map(prof => (
                          <option key={prof.id} value={prof.id}>
                            {prof.name} {prof.structure ? `[${prof.structure}]` : ""} ({prof.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setCpSearchType("etude");
                          setCpSearchQuery("");
                          setIsCPSearchOpen(true);
                        }}
                        className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[11px] rounded-xl border border-emerald-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                        title="Recherche avancée de chargé de projet"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Rechercher</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Statut de l'Étude d'Exécution</label>
                    <select
                      value={editProjectData.etudeAutorisation.statutEtude}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        etudeAutorisation: { ...editProjectData.etudeAutorisation, statutEtude: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                    >
                      <option value="Non lancée">Non lancée</option>
                      <option value="En cours">En cours</option>
                      <option value="Approuvée">Approuvée</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Statut Permis de Construire</label>
                    <select
                      value={editProjectData.etudeAutorisation.statutPermisConstruire}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        etudeAutorisation: { ...editProjectData.etudeAutorisation, statutPermisConstruire: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                    >
                      <option value="Non déposé">Non déposé</option>
                      <option value="Déposé - En cours">Déposé - En cours</option>
                      <option value="Reçu">Reçu</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Date du Permis de Construire (ou dépôt)</label>
                    <input
                      type="text"
                      value={editProjectData.etudeAutorisation.datePermisConstruire}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        etudeAutorisation: { ...editProjectData.etudeAutorisation, datePermisConstruire: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                      placeholder="e.g., 2026-03-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Statut de l'Arrêté de Servitude</label>
                    <select
                      value={editProjectData.etudeAutorisation.statutArreteServitude}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        etudeAutorisation: { ...editProjectData.etudeAutorisation, statutArreteServitude: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                    >
                      <option value="Non lancé">Non lancé</option>
                      <option value="En cours de signature">En cours de signature</option>
                      <option value="Signé & Publié">Signé & Publié</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Référence de l'Arrêté de Servitude</label>
                    <input
                      type="text"
                      value={editProjectData.etudeAutorisation.arreteServitudeRef}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        etudeAutorisation: { ...editProjectData.etudeAutorisation, arreteServitudeRef: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                      placeholder="e.g., Arrêté n° 245/2026"
                    />
                  </div>
                </div>

                {/* Expertise fonciere */}
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-3">
                  <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider">Expertise Foncière & GEF</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editProjectData.etudeAutorisation.expertiseFonciere.gefDesignated}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          etudeAutorisation: {
                            ...editProjectData.etudeAutorisation,
                            expertiseFonciere: { 
                              ...editProjectData.etudeAutorisation.expertiseFonciere, 
                              gefDesignated: e.target.checked 
                            }
                          }
                        })}
                        id="check-gef"
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <label htmlFor="check-gef" className="font-bold text-slate-700 cursor-pointer">Géomètre-Expert Foncier (GEF) Désigné</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editProjectData.etudeAutorisation.expertiseFonciere.acquisitionDemandEstablished}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          etudeAutorisation: {
                            ...editProjectData.etudeAutorisation,
                            expertiseFonciere: { 
                              ...editProjectData.etudeAutorisation.expertiseFonciere, 
                              acquisitionDemandEstablished: e.target.checked 
                            }
                          }
                        })}
                        id="check-acquisition"
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <label htmlFor="check-acquisition" className="font-bold text-slate-700 cursor-pointer">Demande d'acquisition d'assiette établie</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Identité / Cabinet du GEF</label>
                      <input
                        type="text"
                        value={editProjectData.etudeAutorisation.expertiseFonciere.gefIdentity}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          etudeAutorisation: {
                            ...editProjectData.etudeAutorisation,
                            expertiseFonciere: { 
                              ...editProjectData.etudeAutorisation.expertiseFonciere, 
                              gefIdentity: e.target.value 
                            }
                          }
                        })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none"
                        placeholder="Cabinet du Géomètre, etc."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Commentaire acquisition d'assiette</label>
                      <input
                        type="text"
                        value={editProjectData.etudeAutorisation.expertiseFonciere.acquisitionComment}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          etudeAutorisation: {
                            ...editProjectData.etudeAutorisation,
                            expertiseFonciere: { 
                              ...editProjectData.etudeAutorisation.expertiseFonciere, 
                              acquisitionComment: e.target.value 
                            }
                          }
                        })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none"
                        placeholder="Suivi parcellaire..."
                      />
                    </div>
                  </div>

                  {/* Charger Expertise & Indemnisation */}
                  <div className="space-y-2 border border-orange-100 p-3.5 rounded-xl bg-white shadow-xs max-w-md mt-4 text-xs">
                    <label className="font-bold text-orange-800 text-[11px] block">Chargé Expertise & Indemnisation</label>
                    
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {((editProjectData.chefsDeProjetExpertise || [])).map((item, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 bg-orange-50/50 px-3 py-1.5 rounded-lg border border-orange-100 text-[11px]">
                          <div className="truncate min-w-0">
                            <p className="font-extrabold text-orange-700 truncate">{item.name}</p>
                            {item.structure && (
                              <p className="text-[10px] text-slate-500 font-bold truncate">🏢 {item.structure}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newList = (editProjectData.chefsDeProjetExpertise || []).filter((_, i) => i !== index);
                              setEditProjectData({
                                ...editProjectData,
                                chefsDeProjetExpertise: newList
                              });
                            }}
                            className="text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                            title="Retirer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {(!editProjectData.chefsDeProjetExpertise || editProjectData.chefsDeProjetExpertise.length === 0) && (
                        <p className="text-[10px] text-slate-400 italic font-medium">Aucun Chargé Expertise sélectionné</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      <select
                        value=""
                        onChange={(e) => {
                          const uid = e.target.value;
                          if (!uid) return;
                          const found = profilesList.find(u => u.id === uid);
                          if (found) {
                            const currentList = editProjectData.chefsDeProjetExpertise || [];
                            if (currentList.some(item => item.uid === uid)) return;
                            
                            const newItem = {
                              uid: found.id,
                              name: found.name,
                              email: found.email || "",
                              structure: found.structure || ""
                            };
                            const newList = [...currentList, newItem];
                            setEditProjectData({
                              ...editProjectData,
                              chefsDeProjetExpertise: newList
                            });
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none text-[11px] font-bold text-slate-700 cursor-pointer focus:border-blue-500"
                      >
                        <option value="">+ Chargé Expertise (Compte)</option>
                        {profilesList.map(prof => (
                          <option key={prof.id} value={prof.id}>
                            {prof.name} {prof.structure ? `[${prof.structure}]` : ""} ({prof.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setCpSearchType("expertise");
                          setCpSearchQuery("");
                          setIsCPSearchOpen(true);
                        }}
                        className="w-full py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold text-[11px] rounded-xl border border-orange-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                        title="Recherche avancée de chargé expertise"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Rechercher</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase 03: Travaux & Contrôles */}
              <div className="space-y-4 pt-4">
                <h4 className="font-extrabold text-sm text-blue-700 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>Phase 03 : Phase Travaux & Contrôle Qualité</span>
                </h4>

                {/* Chef de Projet Travaux */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono">Chargé de Projet Travaux (Lien aux comptes)</span>
                  <div className="space-y-2 border border-slate-150 p-3 rounded-xl bg-white shadow-sm max-w-md">
                    <label className="font-bold text-slate-600 block">Chargés de Projet (Partie Travaux)</label>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {((editProjectData.chefsDeProjetTravaux || [])).map((item, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100 text-[11px]">
                          <div className="truncate min-w-0">
                            <p className="font-extrabold text-blue-700 truncate">{item.name}</p>
                            {item.structure && (
                              <p className="text-[10px] text-slate-500 font-bold truncate">🏢 {item.structure}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newList = (editProjectData.chefsDeProjetTravaux || []).filter((_, i) => i !== index);
                              setEditProjectData({
                                ...editProjectData,
                                chefsDeProjetTravaux: newList,
                                chefDeProjetUid: newList[0]?.uid || "",
                                chefDeProjetName: newList[0]?.name || "",
                                chefDeProjetEmail: newList[0]?.email || "",
                                chefDeProjetStructure: newList[0]?.structure || ""
                              });
                            }}
                            className="text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                            title="Retirer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {(!editProjectData.chefsDeProjetTravaux || editProjectData.chefsDeProjetTravaux.length === 0) && (
                        <p className="text-[10px] text-slate-400 italic font-medium">Aucun CP Travaux sélectionné</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      <select
                        value=""
                        onChange={(e) => {
                          const uid = e.target.value;
                          if (!uid) return;
                          const found = profilesList.find(u => u.id === uid);
                          if (found) {
                            const currentList = editProjectData.chefsDeProjetTravaux || [];
                            if (currentList.some(item => item.uid === uid)) return;
                            
                            const newItem = {
                              uid: found.id,
                              name: found.name,
                              email: found.email || "",
                              structure: found.structure || ""
                            };
                            const newList = [...currentList, newItem];
                            setEditProjectData({
                              ...editProjectData,
                              chefsDeProjetTravaux: newList,
                              chefDeProjetUid: newList[0]?.uid || "",
                              chefDeProjetName: newList[0]?.name || "",
                              chefDeProjetEmail: newList[0]?.email || "",
                              chefDeProjetStructure: newList[0]?.structure || ""
                            });
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none text-[11px] font-bold text-slate-700 cursor-pointer focus:border-blue-500"
                      >
                        <option value="">+ CP Travaux (Compte)</option>
                        {profilesList.map(prof => (
                          <option key={prof.id} value={prof.id}>
                            {prof.name} {prof.structure ? `[${prof.structure}]` : ""} ({prof.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setCpSearchType("travaux");
                          setCpSearchQuery("");
                          setIsCPSearchOpen(true);
                        }}
                        className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[11px] rounded-xl border border-blue-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                        title="Recherche avancée de chargé de projet"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Rechercher</span>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>Avancement Physique Global des Travaux</span>
                    <span className="text-orange-600">{editProjectData.travauxPlanification.avancementPhysique}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editProjectData.travauxPlanification.avancementPhysique}
                    onChange={(e) => setEditProjectData({
                      ...editProjectData,
                      travauxPlanification: {
                        ...editProjectData.travauxPlanification,
                        avancementPhysique: parseInt(e.target.value)
                      }
                    })}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Épreuve de Résistance Hydraulique</label>
                    <select
                      value={editProjectData.travauxPlanification.essaisReglementaires.epreuveResistance}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        travauxPlanification: {
                          ...editProjectData.travauxPlanification,
                          essaisReglementaires: {
                            ...editProjectData.travauxPlanification.essaisReglementaires,
                            epreuveResistance: e.target.value as any
                          }
                        }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                    >
                      <option value="Non faite">Non faite</option>
                      <option value="En cours">En cours</option>
                      <option value="Réussie">Réussie</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Épreuve d'Étanchéité</label>
                    <select
                      value={editProjectData.travauxPlanification.essaisReglementaires.epreuveEtancheite}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        travauxPlanification: {
                          ...editProjectData.travauxPlanification,
                          essaisReglementaires: {
                            ...editProjectData.travauxPlanification.essaisReglementaires,
                            epreuveEtancheite: e.target.value as any
                          }
                        }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                    >
                      <option value="Non faite">Non faite</option>
                      <option value="En cours">En cours</option>
                      <option value="Réussie">Réussie</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Organisme Contrôleur Agréé</label>
                    <input
                      type="text"
                      value={editProjectData.travauxPlanification.essaisReglementaires.organismeControleur}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        travauxPlanification: {
                          ...editProjectData.travauxPlanification,
                          essaisReglementaires: {
                            ...editProjectData.travauxPlanification.essaisReglementaires,
                            organismeControleur: e.target.value
                          }
                        }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                      placeholder="e.g., VERITAL SpA"
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3">
                  <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Plan de Contrôle & Conformité Technique</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <input
                        type="checkbox"
                        checked={editProjectData.travauxPlanification.controleQualiteChecklist.abaqueSoudageValide}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          travauxPlanification: {
                            ...editProjectData.travauxPlanification,
                            controleQualiteChecklist: {
                              ...editProjectData.travauxPlanification.controleQualiteChecklist,
                              abaqueSoudageValide: e.target.checked
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Abaque de soudage qualifié</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <input
                        type="checkbox"
                        checked={editProjectData.travauxPlanification.controleQualiteChecklist.radiographieCND}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          travauxPlanification: {
                            ...editProjectData.travauxPlanification,
                            controleQualiteChecklist: {
                              ...editProjectData.travauxPlanification.controleQualiteChecklist,
                              radiographieCND: e.target.checked
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Contrôle non destructif (radiographie)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <input
                        type="checkbox"
                        checked={editProjectData.travauxPlanification.controleQualiteChecklist.enrobageVerifie}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          travauxPlanification: {
                            ...editProjectData.travauxPlanification,
                            controleQualiteChecklist: {
                              ...editProjectData.travauxPlanification.controleQualiteChecklist,
                              enrobageVerifie: e.target.checked
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Enrobage vérifié (balai électrique)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <input
                        type="checkbox"
                        checked={editProjectData.travauxPlanification.controleQualiteChecklist.litPoseSableux}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          travauxPlanification: {
                            ...editProjectData.travauxPlanification,
                            controleQualiteChecklist: {
                              ...editProjectData.travauxPlanification.controleQualiteChecklist,
                              litPoseSableux: e.target.checked
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Lit de pose sablonneux & fouille</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <input
                        type="checkbox"
                        checked={editProjectData.travauxPlanification.controleQualiteChecklist.protectionCathodique}
                        onChange={(e) => setEditProjectData({
                          ...editProjectData,
                          travauxPlanification: {
                            ...editProjectData.travauxPlanification,
                            controleQualiteChecklist: {
                              ...editProjectData.travauxPlanification.controleQualiteChecklist,
                              protectionCathodique: e.target.checked
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Protection cathodique en place</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Phase 04: Mise en gaz */}
              <div className="space-y-4 pt-4">
                <h4 className="font-extrabold text-sm text-blue-700 flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  <span>Phase 04 : Mise en Gaz & Archives Documentaires</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Statut de la Mise en Gaz</label>
                    <select
                      value={editProjectData.miseEnGazArchive.statutMiseEnGaz}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        miseEnGazArchive: { ...editProjectData.miseEnGazArchive, statutMiseEnGaz: e.target.value as any }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                    >
                      <option value="Non planifiée">Non planifiée</option>
                      <option value="Planifiée">Planifiée</option>
                      <option value="Prête">Prête</option>
                      <option value="Réalisée">Réalisée</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600">Date Effective ou Programmée de Mise en Gaz</label>
                    <input
                      type="text"
                      value={editProjectData.miseEnGazArchive.dateEffectiveMiseEnGaz}
                      onChange={(e) => setEditProjectData({
                        ...editProjectData,
                        miseEnGazArchive: { ...editProjectData.miseEnGazArchive, dateEffectiveMiseEnGaz: e.target.value }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                      placeholder="e.g., 2026-10-25"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setIsCreating(false);
                  setEditProjectData(null);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Annuler
              </button>
              <button
                onClick={isCreating ? handleCreateProject : saveProjectChanges}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/10"
              >
                Sauvegarder le Projet
              </button>
            </div>
          </div>

  );
}
