import React from 'react';
import {
  CheckCircle, Plus, FileText, Trash2, Archive, Check, Layers,
  Calendar, Shield, FolderOpen, FilePlus
} from 'lucide-react';
import { Project } from '../../types';

export interface GazTabProps {
  selectedProject: Project;
  newDocName: string;
  setNewDocName: (name: string) => void;
  newDocCat: string;
  setNewDocCat: (cat: string) => void;
  addArchiveDocument: () => Promise<void>;
  removeArchiveDocument: (docId: string) => Promise<void>;
}

export function GazTab({
  selectedProject,
  newDocName,
  setNewDocName,
  newDocCat,
  setNewDocCat,
  addArchiveDocument,
  removeArchiveDocument,
}: GazTabProps) {
  return (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-green-600 tracking-wider">Phase 04 • Réception & Archivage</span>
                    <h4 className="font-extrabold text-base text-slate-800">Mise en Gaz définitive et Livrables Documentaires</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-4 bg-green-50/40 rounded-2xl border border-green-100/60 flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-500">Statut de la Mise en Gaz :</p>
                        <p className="font-black text-green-950 text-sm mt-0.5">
                          {selectedProject.miseEnGazArchive.statutMiseEnGaz || "Non planifiée"}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-500">Date Programmée / Réelle :</p>
                        <p className="font-black text-slate-800 text-sm mt-0.5">
                          {selectedProject.miseEnGazArchive.dateEffectiveMiseEnGaz || "Non programmée"}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-500">Conformité Finale :</p>
                        <p className="font-black text-slate-800 text-sm mt-0.5">
                          {selectedProject.travauxPlanification.avancementPhysique === 100 ? "✓ 100% Conforme" : "En cours d'homologation"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Document archives lists */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h5 className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                        <FolderOpen className="w-4 h-4 text-blue-600" />
                        <span>Archives Documentaires Obligatoires (Plans de recollement, PV, etc.)</span>
                      </h5>
                    </div>

                    {/* Grid list of files */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(selectedProject.miseEnGazArchive.documentsArchives || []).map((doc, idx) => (
                        <div 
                          key={doc.id || idx}
                          className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate leading-snug">{doc.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{doc.category}</span>
                                <span className="text-[9px] text-slate-400">{doc.addedAt}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => removeArchiveDocument(doc.id)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                              title="Retirer l'archive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {(selectedProject.miseEnGazArchive.documentsArchives || []).length === 0 && (
                        <div className="col-span-2 text-center py-6 text-xs text-slate-400 italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          Aucun document archivé dans ce dossier de recollement.
                        </div>
                      )}
                    </div>

                    {/* Form to add a document reference */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-end gap-3 text-xs">
                      <div className="space-y-1 w-full">
                        <label className="font-bold text-slate-600">Nom du fichier archivé</label>
                        <input
                          type="text"
                          value={newDocName}
                          onChange={(e) => setNewDocName(e.target.value)}
                          placeholder="e.g., Plan de recollement - Traversée d'Oued.dwg"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none"
                        />
                      </div>
                      <div className="space-y-1 shrink-0 w-full sm:w-56">
                        <label className="font-bold text-slate-600">Catégorie</label>
                        <select
                          value={newDocCat}
                          onChange={(e) => setNewDocCat(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none"
                        >
                          <option value="Plan de recollement">Plan de recollement</option>
                          <option value="Dossier Technique Final">Dossier Technique Final</option>
                          <option value="PV d'essais">PV d'essais</option>
                          <option value="Rapport de conformité">Rapport de conformité</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                      <button
                        onClick={addArchiveDocument}
                        className="px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <FilePlus className="w-4 h-4" />
                        <span>Archiver</span>
                      </button>
                    </div>
                  </div>
                </div>

  );
}
