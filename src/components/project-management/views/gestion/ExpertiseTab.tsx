import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import {
  FileCheck, Edit3, X, Save, AlertTriangle, Layers, CheckCircle, Clock,
  Calendar, FileText, Check, Shield, Info, MapPin, RefreshCw, Briefcase
} from 'lucide-react';
import { Project, FicheSuivi } from '../../types';
import { formatDateFrench, createDefaultFicheSuivi } from '../../projectUtils';

export interface ExpertiseTabProps {
  selectedProject: Project;
  isEditingFicheSuivi: boolean;
  setIsEditingFicheSuivi: (val: boolean) => void;
  ficheSuiviForm: FicheSuivi;
  setFicheSuiviForm: React.Dispatch<React.SetStateAction<FicheSuivi>>;
  isSavingFicheSuivi: boolean;
  hasPrivilege: (key: string) => boolean;
  handleSaveFicheSuivi: () => Promise<void>;
}

export function ExpertiseTab({
  selectedProject,
  isEditingFicheSuivi,
  setIsEditingFicheSuivi,
  ficheSuiviForm,
  setFicheSuiviForm,
  isSavingFicheSuivi,
  hasPrivilege,
  handleSaveFicheSuivi,
}: ExpertiseTabProps) {
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
                      <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider font-mono">Phase 02.5 • Dossier Foncier & Indemnisations</span>
                      <h4 className="font-extrabold text-base text-slate-800">Expertise Foncière & Indemnisations</h4>
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
                          isEditingFicheSuivi ? "bg-slate-200 text-slate-800 hover:bg-slate-300" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        {isEditingFicheSuivi ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        <span>{isEditingFicheSuivi ? "Annuler l'Édition" : "Éditer l'Expertise & Indemnisation"}</span>
                      </button>
                    )}
                  </div>

                  {isEditingFicheSuivi ? (
                    /* Fiche de Suivi - EDIT FORM FOR EXPERTISE & INDEMNISATION */
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6 text-xs">
                      <div className="bg-emerald-500/10 border border-emerald-200 p-3 rounded-xl text-emerald-800 font-bold mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>Mode Édition Foncier - Les modifications d'expertise et de quittances d'indemnisation sont enregistrées.</span>
                      </div>

                      {/* SECTION 1: EXPERTISE FONCIERE */}
                      <div className="space-y-4">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <span>1. Expertise Foncière (Parcellaire)</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Cabinet GEF désigné :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.gefCabinet || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, gefCabinet: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: Cabinet Touazi"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Date Demande :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.demandeGefDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, demandeGefDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Nature de Terrain :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.natureTerrain || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, natureTerrain: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: Domaine Privé / Agricole"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Dépôt Dossier (Type) :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.depotDossierType || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, depotDossierType: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: Dépôt cadastre"
                            />
                          </div>
                        </div>

                        {/* Decrees for Expertise */}
                        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 grid grid-cols-1 sm:grid-cols-4 gap-4 mt-3">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Réf. Arrêté ouverture d'enquête publique :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.expertiseArreteEnqueteRef || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, expertiseArreteEnqueteRef: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                              placeholder="ex: AOEP-2026/04"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Date Arrêté ouverture d'enquête publique :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.expertiseArreteEnqueteDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, expertiseArreteEnqueteDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Réf. Arrêté de consignation :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.expertiseArreteConsignationRef || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, expertiseArreteConsignationRef: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                              placeholder="ex: AC-2026/12"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Date Arrêté de consignation :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.expertiseArreteConsignationDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, expertiseArreteConsignationDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: ARRETE DE SERVITUDE & INDEMNISATION */}
                      <div className="space-y-4">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <FileText className="w-4 h-4 text-orange-600" />
                          <span>2. Demande d'Arrêté de Servitude & Publication</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">PV d'Enquête Servitude :</label>
                            <select
                              value={ficheSuiviForm.servitudeEnquetePv || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeEnquetePv: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Oui">Oui (Clôturée favorable)</option>
                              <option value="Non">Non / En cours</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Date PV d'Enquête :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.servitudeEnqueteDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeEnqueteDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Publication Journaux :</label>
                            <select
                              value={ficheSuiviForm.servitudeJournaux || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeJournaux: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Oui">Oui (Publié 2 journaux)</option>
                              <option value="Non">Non</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Quittances délivrées :</label>
                            <select
                              value={ficheSuiviForm.servitudeQuittancesPv || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeQuittancesPv: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Oui">Oui</option>
                              <option value="Non">Non</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Date Quittances :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.servitudeQuittancesDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeQuittancesDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Statut Arrêté de Servitude :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.servitudeArreteStatus || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeArreteStatus: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium"
                              placeholder="ex: Signé par Wilaya, En attente publication"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Date de Signature :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.servitudeArreteDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeArreteDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Référence Arrêté :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.servitudeArreteRef || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeArreteRef: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono"
                              placeholder="ex: Ref. AS-2026/089"
                            />
                          </div>
                        </div>

                        {/* Public utility inquiry for servitude section */}
                        <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Ouverture d'Enquête Utilité Publique :</label>
                            <select
                              value={ficheSuiviForm.servitudeEnqueteUtilitePubliquePv || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeEnqueteUtilitePubliquePv: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-black text-xs"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Oui">Oui (Clôturée)</option>
                              <option value="Non">Non / En cours</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Date d'Ouverture d'Enquête :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.servitudeEnqueteUtilitePubliqueDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeEnqueteUtilitePubliqueDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Référence Arrêté d'Ouverture :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.servitudeEnqueteUtilitePubliqueRef || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, servitudeEnqueteUtilitePubliqueRef: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                              placeholder="ex: Ref. AOUP-2026/15"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION 3: RAPPELS, RESERVES ET NOTES */}
                      <div className="space-y-4">
                        <h5 className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 text-[11px] flex items-center gap-2">
                          <Info className="w-4 h-4 text-slate-600" />
                          <span>3. Rappels, Réserves & Observations (max 8 Notes)</span>
                        </h5>

                        <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-200/50 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Date levée de réserve (Expertise) :</label>
                            <input
                              type="date"
                              value={ficheSuiviForm.expertiseLeveeReserveDate || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, expertiseLeveeReserveDate: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Statut / Réf. levée de réserve (Expertise) :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.expertiseLeveeReserveStatus || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, expertiseLeveeReserveStatus: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium text-xs"
                              placeholder="ex: Réserves levées le..."
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-bold mb-1 text-[11px]">Action à mener / État de l'action (Expertise) :</label>
                            <input
                              type="text"
                              value={ficheSuiviForm.expertiseActionStatus || ""}
                              onChange={e => setFicheSuiviForm({ ...ficheSuiviForm, expertiseActionStatus: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-blue-500 font-medium text-xs"
                              placeholder="ex: PV de levée en signature"
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
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">Observations / Notes d'indemnisation (max 8) :</span>
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
                                placeholder={`Observation #${idx + 1}`}
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
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-2"
                        >
                          {isSavingFicheSuivi ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>{isSavingFicheSuivi ? "Enregistrement..." : "Sauvegarder l'Expertise"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Fiche de Suivi - READ ONLY BEAUTIFUL BENTO GRID VIEW FOR EXPERTISE & INDEMNISATION */
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-left">
                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between">
                          <div>
                            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide block mb-2">Expertise Foncière & Cadastre</span>
                            <div className="space-y-2 mt-2">
                              <p className="flex justify-between">
                                <span className="text-slate-500 font-bold">Cabinet GEF :</span>
                                <span className="font-black text-slate-800">{selectedProject.ficheSuivi?.gefCabinet || "Non désigné"}</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-500 font-bold">Date de Demande :</span>
                                <span className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.demandeGefDate ? formatDateFrench(selectedProject.ficheSuivi.demandeGefDate) : "Non renseignée"}</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-500 font-bold">Nature de Terrain :</span>
                                <span className="font-black text-slate-800">{selectedProject.ficheSuivi?.natureTerrain || "Non renseignée"}</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-500 font-bold">Dépôt Cadastral :</span>
                                <span className="font-black text-slate-800">{selectedProject.ficheSuivi?.depotDossierType || "N/A"}</span>
                              </p>
                            </div>
                          </div>

                          {(selectedProject.ficheSuivi?.expertiseArreteEnqueteRef || selectedProject.ficheSuivi?.expertiseArreteConsignationRef) && (
                            <div className="border-t border-slate-200/60 pt-2.5 mt-2.5 space-y-2 text-[11px]">
                              <span className="text-[9px] font-black uppercase text-blue-600 block tracking-wide">Arrêtés de Procédure d'Expertise</span>
                              {selectedProject.ficheSuivi?.expertiseArreteEnqueteRef && (
                                <p className="flex justify-between">
                                  <span className="text-slate-500 font-bold">Arrêté d'Enquête Publique :</span>
                                  <span className="font-black text-slate-800 font-mono">
                                    {selectedProject.ficheSuivi.expertiseArreteEnqueteRef}
                                    {selectedProject.ficheSuivi.expertiseArreteEnqueteDate && ` (${formatDateFrench(selectedProject.ficheSuivi.expertiseArreteEnqueteDate)})`}
                                  </span>
                                </p>
                              )}
                              {selectedProject.ficheSuivi?.expertiseArreteConsignationRef && (
                                <p className="flex justify-between">
                                  <span className="text-slate-500 font-bold">Arrêté de Consignation :</span>
                                  <span className="font-black text-slate-800 font-mono">
                                    {selectedProject.ficheSuivi.expertiseArreteConsignationRef}
                                    {selectedProject.ficheSuivi.expertiseArreteConsignationDate && ` (${formatDateFrench(selectedProject.ficheSuivi.expertiseArreteConsignationDate)})`}
                                  </span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="p-5 bg-orange-50/45 rounded-2xl border border-orange-100/70 space-y-3">
                          <h5 className="font-extrabold text-orange-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-orange-600" />
                            <span>Arrêté de Servitude (AS) & Indemnisation</span>
                          </h5>
                          <div className="grid grid-cols-2 gap-3.5 pt-1">
                            <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-xs space-y-0.5">
                              <p className="text-slate-400 text-[9px] font-bold uppercase">PV d'Enquête</p>
                              <p className="font-black text-slate-800">{selectedProject.ficheSuivi?.servitudeEnquetePv === "Oui" ? `Clôturée (${selectedProject.ficheSuivi.servitudeEnqueteDate ? formatDateFrench(selectedProject.ficheSuivi.servitudeEnqueteDate) : "N/A"})` : "En attente"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-xs space-y-0.5">
                              <p className="text-slate-400 text-[9px] font-bold uppercase">Publication Presse</p>
                              <p className="font-black text-slate-800">{selectedProject.ficheSuivi?.servitudeJournaux === "Oui" ? "✓ Publié (2 Journaux)" : "✗ Non publié"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-xs space-y-0.5">
                              <p className="text-slate-400 text-[9px] font-bold uppercase">Quittances / Indemnité</p>
                              <p className="font-black text-slate-800">{selectedProject.ficheSuivi?.servitudeQuittancesPv === "Oui" ? "✓ Libérées & Payées" : "Non payées"}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-xs space-y-0.5">
                              <p className="text-slate-400 text-[9px] font-bold uppercase">Date de Paiement</p>
                              <p className="font-black text-slate-800 font-mono">{selectedProject.ficheSuivi?.servitudeQuittancesDate ? formatDateFrench(selectedProject.ficheSuivi.servitudeQuittancesDate) : "En cours"}</p>
                            </div>
                          </div>
                          {selectedProject.ficheSuivi?.servitudeArreteRef && (
                            <div className="p-2 bg-white rounded-xl border border-orange-100 flex justify-between items-center text-[11px] mt-1 text-left">
                              <span className="font-bold text-slate-500">Réf. Arrêté de Servitude :</span>
                              <span className="font-mono font-black text-orange-950 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                {selectedProject.ficheSuivi.servitudeArreteRef}
                              </span>
                            </div>
                          )}
                          {selectedProject.ficheSuivi?.servitudeEnqueteUtilitePubliquePv && (
                            <div className="p-2 bg-white rounded-xl border border-orange-100 flex justify-between items-center text-[11px] mt-1 text-left">
                              <span className="font-bold text-slate-500">Enquête Utilité Publique :</span>
                              <span className="font-mono font-black text-orange-950 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                {selectedProject.ficheSuivi.servitudeEnqueteUtilitePubliquePv === "Oui" 
                                  ? `Oui (${selectedProject.ficheSuivi.servitudeEnqueteUtilitePubliqueDate ? formatDateFrench(selectedProject.ficheSuivi.servitudeEnqueteUtilitePubliqueDate) : "S.D"}${selectedProject.ficheSuivi.servitudeEnqueteUtilitePubliqueRef ? " - Réf: " + selectedProject.ficheSuivi.servitudeEnqueteUtilitePubliqueRef : ""})`
                                  : "Non démarrée / En cours"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* BENTO ROW 3: REMINDERS, RESERVES & SUIVI NOTES */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-left">
                        {/* Reminders / Reserves */}
                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                          <div className="space-y-2">
                            <span className="font-extrabold text-slate-700 block text-[9px] uppercase tracking-wider">Rappels de procédure réglementaire :</span>
                            <ul className="space-y-1 text-slate-600 font-medium list-disc list-inside">
                              {(() => {
                                const list = (selectedProject.ficheSuivi?.rappels || []).filter((r: string) => r && r.trim() !== "");
                                return list.length > 0 ? (
                                  list.map((rap: string, idx: number) => (
                                    <li key={`view-rap-${idx}`}>{rap}</li>
                                  ))
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">Aucun rappel spécifique</span>
                                );
                              })()}
                            </ul>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-200">
                            <span className="font-extrabold text-red-700 block text-[9px] uppercase tracking-wider">Réserves parcellaires ou techniques :</span>
                            <ul className="space-y-1 text-red-600 font-medium list-disc list-inside">
                              {(() => {
                                const list = (selectedProject.ficheSuivi?.reserves || []).filter((r: string) => r && r.trim() !== "");
                                return list.length > 0 ? (
                                  list.map((res: string, idx: number) => (
                                    <li key={`view-res-${idx}`}>{res}</li>
                                  ))
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">Aucune réserve active</span>
                                );
                              })()}
                            </ul>
                          </div>
                        </div>

                        {/* Suivi notes */}
                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                          <span className="font-extrabold text-slate-700 block text-[9px] uppercase tracking-wider">Notes d'Observations & Indemnisations :</span>
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {(() => {
                              const list = (selectedProject.ficheSuivi?.autresInformations || []).filter((n: string) => n && n.trim() !== "");
                              return list.length > 0 ? (
                                list.map((note: string, idx: number) => (
                                  <div key={`view-note-${idx}`} className="p-2.5 bg-white rounded-xl border border-slate-100 font-medium text-slate-700 shadow-xs flex gap-2">
                                    <span className="text-blue-500 font-black">#{idx + 1}</span>
                                    <span>{note}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-400 text-[11px] italic">Aucune note d'information enregistrée.</p>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Levée de Réserves & Plan d'Action (Expertise) */}
                        <div className="p-5 bg-emerald-50/45 rounded-2xl border border-emerald-100/70 space-y-3">
                          <h5 className="font-extrabold text-emerald-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span>Levée de Réserves & Action (Expertise)</span>
                          </h5>
                          <div className="space-y-2 pt-1">
                            <div className="bg-white p-2.5 rounded-xl border border-emerald-100/70 shadow-xs flex justify-between items-center">
                              <div>
                                <p className="text-slate-400 text-[9px] font-bold uppercase">Date de Levée</p>
                                <p className="font-black text-slate-800 font-mono text-[11px]">
                                  {selectedProject.ficheSuivi?.expertiseLeveeReserveDate ? formatDateFrench(selectedProject.ficheSuivi.expertiseLeveeReserveDate) : "En cours / Non levée"}
                                </p>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${selectedProject.ficheSuivi?.expertiseLeveeReserveDate ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                {selectedProject.ficheSuivi?.expertiseLeveeReserveDate ? "Levée" : "Active"}
                              </span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-emerald-100/70 shadow-xs">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Statut / Référence Levée</p>
                              <p className="font-black text-slate-800 text-[10px] leading-tight">{selectedProject.ficheSuivi?.expertiseLeveeReserveStatus || "Aucun statut enregistré"}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-emerald-100/70 shadow-xs">
                              <p className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Action à mener / État de l'action</p>
                              <p className="font-black text-slate-800 text-[10px] leading-tight">{selectedProject.ficheSuivi?.expertiseActionStatus || "Aucune action spécifiée"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Contrat & Prestataire (Expertise Foncière) */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-emerald-600" />
                              <span>Contrat & Prestataire Expertise (Géomètre Expert Foncier - GEF)</span>
                            </h5>
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 font-mono">
                              Section 03 • Expertise & Indemnisation
                            </span>
                          </div>

                          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="font-extrabold text-emerald-900 text-[11px] flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                Cabinet du Géomètre Expert Foncier (GEF)
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Cabinet / Expert Désigné :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.expert?.nom || selectedProject.ficheSuivi?.gefCabinet || ""}
                                  onChange={e => updateProjectContractField('expert', 'nom', e.target.value)}
                                  placeholder="ex: Cabinet Touazi GEF"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Référence Contrat / Convention :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.expert?.ref || ""}
                                  onChange={e => updateProjectContractField('expert', 'ref', e.target.value)}
                                  placeholder="N° Convention GEF"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Montant Honoraires / Contrat :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.expert?.montant || ""}
                                  onChange={e => updateProjectContractField('expert', 'montant', e.target.value)}
                                  placeholder="Montant DA"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Délai Réalisation Parcellaire :</label>
                                <input
                                  type="text"
                                  value={selectedProject.contrats?.expert?.delai || ""}
                                  onChange={e => updateProjectContractField('expert', 'delai', e.target.value)}
                                  placeholder="ex: 60 jours"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Date Notification ODS :</label>
                                <input
                                  type="date"
                                  value={selectedProject.contrats?.expert?.ods || selectedProject.contrats?.expert?.date || ""}
                                  onChange={e => updateProjectContractField('expert', 'ods', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold text-[10px] mb-0.5">Avancement Dossier Parcellaire (%) :</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selectedProject.contrats?.expert?.avancement || 0}
                                  onChange={e => updateProjectContractField('expert', 'avancement', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
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