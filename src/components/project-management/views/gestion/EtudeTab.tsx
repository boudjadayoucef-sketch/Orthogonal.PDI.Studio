import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import {
  FileCheck, Edit3, X, Save, AlertTriangle, Layers, CheckCircle, Clock,
  Calendar, FileText, Check, Shield, Info, MapPin, RefreshCw, Briefcase, Activity, Building
} from 'lucide-react';
import { Project, FicheSuivi } from '../../types';
import { formatDateFrench, createDefaultFicheSuivi } from '../../projectUtils';

export interface EtudeTabProps {
  selectedProject: Project;
  isEditingFicheSuivi: boolean;
  setIsEditingFicheSuivi: (val: boolean) => void;
  ficheSuiviForm: FicheSuivi;
  setFicheSuiviForm: React.Dispatch<React.SetStateAction<FicheSuivi>>;
  isSavingFicheSuivi: boolean;
  hasPrivilege: (key: string) => boolean;
  handleSaveFicheSuivi: () => Promise<void>;
}

export function EtudeTab({
  selectedProject,
  isEditingFicheSuivi,
  setIsEditingFicheSuivi,
  ficheSuiviForm,
  setFicheSuiviForm,
  isSavingFicheSuivi,
  hasPrivilege,
  handleSaveFicheSuivi,
}: EtudeTabProps) {
  const updateProjectContractField = async (contractKey: string, field: string, value: any) => {
    if (!selectedProject?.id) return;
    try {
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
                <div className="space-y-6 text-left">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-yellow-600 tracking-wider font-mono">Phase 02 • Dossier Administratif</span>
                      <h4 className="font-extrabold text-base text-slate-800">Suivi des Études & Permis de Construire</h4>
                    </div>
                    {hasPrivilege("section_etude") && (
                      <button
                        onClick={() => {
                          if (selectedProject?.ficheSuivi) {
                            const parsed = JSON.parse(JSON.stringify(selectedProject.ficheSuivi));
                            setFicheSuiviForm({
                              ...createDefaultFicheSuivi(),
                              ...parsed,
                              rappels: parsed.rappels || createDefaultFicheSuivi().rappels,
                              reserves: parsed.reserves || createDefaultFicheSuivi().reserves,
                              autresInformations: parsed.autresInformations || createDefaultFicheSuivi().autresInformations,
                            });
                          } else {
                            setFicheSuiviForm(createDefaultFicheSuivi());
                          }
                          setIsEditingFicheSuivi(!isEditingFicheSuivi);
                        }}
                        className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                          isEditingFicheSuivi ? "bg-slate-200 text-slate-800 hover:bg-slate-300" : "bg-yellow-600 hover:bg-yellow-700 text-white"
                        }`}
                      >
                        {isEditingFicheSuivi ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        <span>{isEditingFicheSuivi ? "Annuler l'Édition" : "Éditer l'Étude & Permis"}</span>
                      </button>
                    )}
                  </div>

                  {isEditingFicheSuivi ? (
                    /* Fiche de Suivi - EDIT FORM */
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6 text-xs">
                      <div className="bg-yellow-500/10 border border-yellow-200 p-3 rounded-xl text-yellow-800 font-bold mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>Mode Édition Études & Autorisations - Les modifications sont sauvegardées dans la base de données.</span>
                      </div>

                      {/* SECTION 1: CONSISTANCE */}
                      <div className="space-y-4">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <Layers className="w-4 h-4 text-yellow-600" />
                          <span>1. Consistance de l'Ouvrage</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Capacité Poste (Nm3/h) :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.capPoste || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, capPoste: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: 15 000 Nm3/h"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Longeur de Ligne (Ml) :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.ligneMl || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, ligneMl: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: 45 000 Ml"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Type de Poste :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.typePoste || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, typePoste: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: DP / DC / Cabine"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Type de Programme :</label>
                            <select
                              value={ficheSuiviForm.typeProgramme || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, typeProgramme: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="OC et MEG">OC et MEG</option>
                              <option value="OC">OC</option>
                              <option value="MEG">MEG</option>
                              <option value="Hors programme">Hors programme</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: ETUDE D'IMPACT */}
                      <div className="space-y-4 text-left">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <Activity className="w-4 h-4 text-green-600" />
                          <span>2. Étude d'Impact sur l'Environnement</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Assujettis à l'étude :</label>
                            <select
                              value={ficheSuiviForm.impactAssujettis || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, impactAssujettis: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Oui">Oui</option>
                              <option value="Non">Non</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Cabinet d'Étude (BET) / ODS :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.impactBetOds || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, impactBetOds: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: BET EcoEnvironnement"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Date Dépôt de l'étude :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.impactDepotEtude || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, impactDepotEtude: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Date Demande d'Autorisation d'Exploit. :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.impactDemandeAutExploitDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, impactDemandeAutExploitDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Ouverture Enquête Publique :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.impactOuvertureEnqueteDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, impactOuvertureEnqueteDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Publication Journaux (Impact) :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.impactPubJournauxDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, impactPubJournauxDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Quittance (Impact) :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.impactQuittanceDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, impactQuittanceDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION 3: DOSSIER PC & BET */}
                      <div className="space-y-4">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <Building className="w-4 h-4 text-purple-600" />
                          <span>3. Permis de Construire (PC) & Étude d'Exécution</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-slate-500 font-bold mb-1">Choix de Terrain (Date d'enquête) :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.choixTerrainDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, choixTerrainDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">PV Choix Terrain :</label>
                            <select
                              value={ficheSuiviForm.choixTerrainPv || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, choixTerrainPv: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Oui">Oui (Favorable)</option>
                              <option value="Non">Non</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Étude par BET :</label>
                            <select
                              value={ficheSuiviForm.etudeBetStatut || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, etudeBetStatut: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Oui">Oui (Finalisée)</option>
                              <option value="Non">Non</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-slate-500 font-bold mb-1">Nom Cabinet BET d'exécution :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.etudeBetCabinet || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, etudeBetCabinet: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: Cabinet Kanoun"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-slate-500 font-bold mb-1">Date de Dépôt du Permis de Construire (PC) :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.depotPcDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, depotPcDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-slate-500 font-bold mb-1">Date de Dépôt de l'Arrêté de Servitude (AS) :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.depotAsDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, depotAsDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION 4: ARRETE DE SERVITUDE (AS) DETAIL */}
                      <div className="space-y-4">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <Layers className="w-4 h-4 text-yellow-600" />
                          <span>4. Suivi de l'Arrêté de Servitude (AS)</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Date Demande Arrêté :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.asDateDemande || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, asDateDemande: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Ouverture d'Enquête Arrêté :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.asOuvertureEnqueteDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, asOuvertureEnqueteDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Publication Journaux Arrêté :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.asPubJournauxDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, asPubJournauxDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Quittance Arrêté :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.asQuittanceDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, asQuittanceDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION 5: RAPPELS, RESERVES ET NOTES (Levée de réserves & actions) */}
                      <div className="space-y-4">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <Info className="w-4 h-4 text-slate-600" />
                          <span>5. Rappels, Levée de Réserves & Actions (max 8 Notes)</span>
                        </h5>

                        <div className="bg-yellow-500/5 p-4 rounded-xl border border-yellow-200/50 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Date levée de réserve (Études) :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.etudeLeveeReserveDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, etudeLeveeReserveDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Statut / Réf. levée de réserve (Études) :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.etudeLeveeReserveStatus || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, etudeLeveeReserveStatus: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium text-xs"
                              placeholder="ex: Levée totale par PV du..."
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Action à mener / État de l'action (Études) :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.etudeActionStatus || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, etudeActionStatus: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium text-xs"
                              placeholder="ex: Relance de la DRE en cours"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <span className="font-bold text-slate-700 block text-[10px] uppercase">Rappels de procédure :</span>
                            {ficheSuiviForm.rappels.map((rap, idx) => (
                              <input
                                key={`rap-${idx}`}
                                type="text"
                                value={rap || ""}
                                onChange={e => {
                                  const newRappels = [...ficheSuiviForm.rappels];
                                  newRappels[idx] = e.target.value;
                                  setFicheSuiviForm({ ...ficheSuiviForm, rappels: newRappels });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-blue-500"
                                placeholder={`Rappel #${idx + 1}`}
                              />
                            ))}
                          </div>
                          <div className="space-y-2">
                            <span className="font-bold text-slate-700 block text-[10px] uppercase">Réserves techniques relevées :</span>
                            {ficheSuiviForm.reserves.map((res, idx) => (
                              <input
                                key={`res-${idx}`}
                                type="text"
                                value={res || ""}
                                onChange={e => {
                                  const newReserves = [...ficheSuiviForm.reserves];
                                  newReserves[idx] = e.target.value;
                                  setFicheSuiviForm({ ...ficheSuiviForm, reserves: newReserves });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-blue-500"
                                placeholder={`Réserve #${idx + 1}`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">Observations / Actions correctives :</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ficheSuiviForm.autresInformations.map((note, idx) => (
                              <input
                                key={`note-${idx}`}
                                type="text"
                                value={note || ""}
                                onChange={e => {
                                  const newNotes = [...ficheSuiviForm.autresInformations];
                                  newNotes[idx] = e.target.value;
                                  setFicheSuiviForm({ ...ficheSuiviForm, autresInformations: newNotes });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-blue-500"
                                placeholder={`Action / Observation #${idx + 1}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsEditingFicheSuivi(false)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-all active:scale-95"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={isSavingFicheSuivi}
                          onClick={handleSaveFicheSuivi}
                          className="px-5 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-black shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-2"
                        >
                          {isSavingFicheSuivi ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>{isSavingFicheSuivi ? "Enregistrement..." : "Sauvegarder les Données"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Fiche de Suivi - READ ONLY BEAUTIFUL BENTO GRID VIEW */
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-left">
                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between">
                          <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide block mb-2">Consistance de l'ouvrage</span>
                          <div className="space-y-2">
                            <p className="flex justify-between">
                              <span className="text-slate-500 font-bold">Capacité du Poste :</span>
                              <span className="font-black text-slate-800">{selectedProject.ficheSuivi?.capPoste || "Non renseigné"}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-500 font-bold">Ligne de transport :</span>
                              <span className="font-black text-slate-800">{selectedProject.ficheSuivi?.ligneMl ? `${selectedProject.ficheSuivi?.ligneMl} Ml` : "Non renseigné"}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-500 font-bold">Type de Poste :</span>
                              <span className="font-black text-slate-800">{selectedProject.ficheSuivi?.typePoste || "Non renseigné"}</span>
                            </p>
                          </div>
                        </div>

                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-center items-center text-center">
                          <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide block mb-3 text-left w-full">Programme d'investissement</span>
                          <div className="py-2.5">
                            {selectedProject.ficheSuivi?.typeProgramme ? (
                              <span className="text-xs font-black px-4 py-2 bg-blue-100 text-blue-900 rounded-xl border border-blue-200">
                                {selectedProject.ficheSuivi.typeProgramme}
                              </span>
                            ) : (
                              <span className="text-xs font-black px-4 py-2 bg-slate-100 text-slate-500 rounded-xl border border-slate-200">
                                Non défini dans la fiche
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* BENTO ROW 2: IMPACT & PERMIS */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-left">
                        <div className="p-5 bg-green-50/45 rounded-2xl border border-green-100/70 space-y-3">
                          <h5 className="font-extrabold text-green-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-green-600" />
                            <span>Suivi de l'Étude d'Impact sur l'Environnement</span>
                          </h5>
                          <div className="grid grid-cols-2 gap-3.5 pt-1">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Assujettis</p>
                              <p className="font-black text-slate-800">{selectedProject.ficheSuivi?.impactAssujettis || "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Cabinet d'étude (BET)</p>
                              <p className="font-black text-slate-800 leading-tight">{selectedProject.ficheSuivi?.impactBetOds || "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Date Dépôt de l'étude</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.impactDepotEtude ? formatDateFrench(selectedProject.ficheSuivi.impactDepotEtude) : "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Demande Aut. d'Exploit.</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.impactDemandeAutExploitDate ? formatDateFrench(selectedProject.ficheSuivi.impactDemandeAutExploitDate) : "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Enquête Publique</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.impactOuvertureEnqueteDate ? formatDateFrench(selectedProject.ficheSuivi.impactOuvertureEnqueteDate) : "Non ouverte"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Publication Journaux</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.impactPubJournauxDate ? formatDateFrench(selectedProject.ficheSuivi.impactPubJournauxDate) : "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm col-span-2">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Quittance (Impact)</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.impactQuittanceDate ? formatDateFrench(selectedProject.ficheSuivi.impactQuittanceDate) : "Non renseigné"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-5 bg-purple-50/45 rounded-2xl border border-purple-100/70 space-y-3">
                          <h5 className="font-extrabold text-purple-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <Building className="w-4 h-4 text-purple-600" />
                            <span>Dossier Permis de Construire (PC) & BET</span>
                          </h5>
                          <div className="grid grid-cols-2 gap-3.5 pt-1">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Choix de Terrain (PV)</p>
                              <p className="font-black text-slate-800 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${selectedProject.ficheSuivi?.choixTerrainPv === "Oui" ? "bg-green-500" : "bg-slate-400"}`}></span>
                                <span>{selectedProject.ficheSuivi?.choixTerrainPv === "Oui" ? "Favorable" : "Non établi/Négatif"}</span>
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Étude BET d'exécution</p>
                              <p className="font-black text-slate-800 leading-tight">
                                {selectedProject.ficheSuivi?.etudeBetStatut === "Oui" ? `✓ ${selectedProject.ficheSuivi.etudeBetCabinet}` : "En cours de réalisation"}
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Dépôt Dossier PC aux APC</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.depotPcDate ? formatDateFrench(selectedProject.ficheSuivi.depotPcDate) : "Non déposé"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Dépôt AS (Arrêté de Servitude)</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.depotAsDate ? formatDateFrench(selectedProject.ficheSuivi.depotAsDate) : "Non déposé"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BENTO ROW 3: SUIVI AS, LEVEE DE RESERVES & ACTIONS */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-left">
                        <div className="p-5 bg-yellow-50/45 rounded-2xl border border-yellow-100/70 space-y-3">
                          <h5 className="font-extrabold text-yellow-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-yellow-600" />
                            <span>Suivi de l'Arrêté de Servitude (AS)</span>
                          </h5>
                          <div className="grid grid-cols-2 gap-3.5 pt-1">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Date Demande AS</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.asDateDemande ? formatDateFrench(selectedProject.ficheSuivi.asDateDemande) : "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Ouverture Enquête AS</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.asOuvertureEnqueteDate ? formatDateFrench(selectedProject.ficheSuivi.asOuvertureEnqueteDate) : "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Publication Journaux AS</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.asPubJournauxDate ? formatDateFrench(selectedProject.ficheSuivi.asPubJournauxDate) : "Non renseigné"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Quittance AS</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.asQuittanceDate ? formatDateFrench(selectedProject.ficheSuivi.asQuittanceDate) : "Non renseigné"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Rappels & Réserves */}
                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                          <span className="font-extrabold text-slate-700 block text-[9px] uppercase tracking-wider">Rappels de procédure & Réserves (Études) :</span>
                          <div className="space-y-2">
                            <div className="text-[11px]">
                              <span className="font-black text-slate-600 block mb-1">Rappels :</span>
                              <ul className="list-disc list-inside space-y-0.5 text-slate-700 font-medium pl-1">
                                {(() => {
                                  const list = (selectedProject.ficheSuivi?.rappels || []).filter((r: string) => r && r.trim() !== "");
                                  return list.length > 0 ? (
                                    list.map((rap: string, idx: number) => (
                                      <li key={`etude-view-rap-${idx}`}>{rap}</li>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic">Aucun rappel d'étude</span>
                                  );
                                })()}
                              </ul>
                            </div>
                            <div className="text-[11px] pt-1.5 border-t border-slate-200">
                              <span className="font-black text-red-600 block mb-1">Réserves Relevées :</span>
                              <ul className="list-disc list-inside space-y-0.5 text-red-700 font-medium pl-1">
                                {(() => {
                                  const list = (selectedProject.ficheSuivi?.reserves || []).filter((r: string) => r && r.trim() !== "");
                                  return list.length > 0 ? (
                                    list.map((res: string, idx: number) => (
                                      <li key={`etude-view-res-${idx}`}>{res}</li>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic">Aucune réserve d'étude active</span>
                                  );
                                })()}
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Levée de Réserves & Plan d'Action (Études) */}
                        <div className="p-5 bg-emerald-50/45 rounded-2xl border border-emerald-100/70 space-y-3">
                          <h5 className="font-extrabold text-emerald-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span>Levée de Réserves & Action (Études)</span>
                          </h5>
                          <div className="space-y-2 pt-1">
                            <div className="bg-white p-2.5 rounded-xl border border-emerald-100/70 shadow-xs flex justify-between items-center">
                              <div>
                                <p className="text-slate-400 text-[9px] font-bold uppercase">Date de Levée</p>
                                <p className="font-black text-slate-800 font-mono text-[11px]">
                                  {selectedProject.ficheSuivi?.etudeLeveeReserveDate ? formatDateFrench(selectedProject.ficheSuivi.etudeLeveeReserveDate) : "En cours / Non levée"}
                                </p>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${selectedProject.ficheSuivi?.etudeLeveeReserveDate ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                {selectedProject.ficheSuivi?.etudeLeveeReserveDate ? "Levée" : "Active"}
                              </span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-emerald-100/70 shadow-xs">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Statut / Référence Levée</p>
                              <p className="font-black text-slate-800 text-[10px] leading-tight">{selectedProject.ficheSuivi?.etudeLeveeReserveStatus || "Aucun statut enregistré"}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-emerald-100/70 shadow-xs">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Action à mener / État de l'action</p>
                              <p className="font-black text-slate-800 text-[10px] leading-tight">{selectedProject.ficheSuivi?.etudeActionStatus || "Aucune action spécifiée"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Observations & Actions Row */}
                      <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                        <span className="font-extrabold text-slate-700 block text-[9px] uppercase tracking-wider">Actions correctives & Observations d'Études :</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-1">
                          {(() => {
                            const list = (selectedProject.ficheSuivi?.autresInformations || []).filter((n: string) => n && n.trim() !== "");
                            return list.length > 0 ? (
                              list.map((note: string, idx: number) => (
                                <div key={`etude-view-note-${idx}`} className="p-2.5 bg-white rounded-xl border border-slate-100 font-medium text-slate-700 shadow-xs flex gap-2">
                                  <span className="text-blue-500 font-black">#{idx + 1}</span>
                                  <span>{note}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 text-[11px] italic">Aucune action corrective ou observation enregistrée.</p>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Contrats & Prestataires (Études & Environnement) */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-purple-600" />
                            <span>Contrats & Prestataires (Études & Environnement)</span>
                          </h5>
                          <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100 font-mono">
                            Section 02 • Étude & Permis
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* 1. Bureau d'Étude Technique */}
                          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="font-extrabold text-purple-900 text-[11px] flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-purple-600" />
                                Bureau d'Étude Technique (BET)
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Nom du Bureau d'Étude :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.bureauEtude?.nom || selectedProject.ficheSuivi?.etudeBetCabinet || ""}
                                  onChange={e => updateProjectContractField('bureauEtude', 'nom', e.target.value)}
                                  placeholder="ex: BET EnerGaze"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Référence Contrat / N° Convention :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.bureauEtude?.ref || ""}
                                  onChange={e => updateProjectContractField('bureauEtude', 'ref', e.target.value)}
                                  placeholder="N° Contrat"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Montant du Contrat :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.bureauEtude?.montant || ""}
                                  onChange={e => updateProjectContractField('bureauEtude', 'montant', e.target.value)}
                                  placeholder="Montant DA"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Délai d'Étude :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.bureauEtude?.delai || ""}
                                  onChange={e => updateProjectContractField('bureauEtude', 'delai', e.target.value)}
                                  placeholder="ex: 3 mois"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Date Signature / ODS :</label>
                                <input
                                  type="date"
                                  value={selectedProject.contrats?.bureauEtude?.ods || selectedProject.contrats?.bureauEtude?.date || ""}
                                  onChange={e => updateProjectContractField('bureauEtude', 'ods', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Avancement Étude (%) :</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selectedProject.contrats?.bureauEtude?.avancement || 0}
                                  onChange={e => updateProjectContractField('bureauEtude', 'avancement', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold font-mono text-xs"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 2. Prestataire Environnement */}
                          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="font-extrabold text-emerald-900 text-[11px] flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                Prestataire Étude d'Impact Environnemental
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Nom du Prestataire :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.betEnvironnement?.nom || ""}
                                  onChange={e => updateProjectContractField('betEnvironnement', 'nom', e.target.value)}
                                  placeholder="ex: Cabinet EcoConsult"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Référence Contrat / N° Convention :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.betEnvironnement?.ref || ""}
                                  onChange={e => updateProjectContractField('betEnvironnement', 'ref', e.target.value)}
                                  placeholder="N° Contrat Env."
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Montant du Contrat :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.betEnvironnement?.montant || ""}
                                  onChange={e => updateProjectContractField('betEnvironnement', 'montant', e.target.value)}
                                  placeholder="Montant DA"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Délai d'Exécution :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.betEnvironnement?.delai || ""}
                                  onChange={e => updateProjectContractField('betEnvironnement', 'delai', e.target.value)}
                                  placeholder="ex: 45 jours"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Date Signature / ODS :</label>
                                <input
                                  type="date"
                                  value={selectedProject.contrats?.betEnvironnement?.ods || selectedProject.contrats?.betEnvironnement?.date || ""}
                                  onChange={e => updateProjectContractField('betEnvironnement', 'ods', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Avancement Notice Env. (%) :</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selectedProject.contrats?.betEnvironnement?.avancement || 0}
                                  onChange={e => updateProjectContractField('betEnvironnement', 'avancement', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold font-mono text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

  );
}