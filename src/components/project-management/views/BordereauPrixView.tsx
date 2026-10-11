import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Printer, CheckCircle, ChevronDown, Download, AlertTriangle, X, RefreshCw
} from 'lucide-react';
import { Project } from '../types';

export interface BordereauPrixViewProps {
  projects: Project[];
}

export function BordereauPrixView({ projects }: BordereauPrixViewProps) {
  const [showPrintBordereauModal, setShowPrintBordereauModal] = useState<boolean>(false);
  const [bordereauActivePart, setBordereauActivePart] = useState<'01' | '02' | '03'>('01');
  const [bordereauSelectedProjectId, setBordereauSelectedProjectId] = useState<string>('all');

  const [bePrices, setBePrices] = useState<Record<string, number>>({
    impact: 1500000,
    topo: 45000,
    ing: 3000000,
    dup: 800000
  });
  const [gefPrices, setGefPrices] = useState<Record<string, number>>({
    enq: 150000,
    exp: 80000,
    assist: 250000
  });
  const [travauxPrices, setTravauxPrices] = useState<Record<string, number>>({
    piste: 12000,
    fouille: 3500,
    soudage: 8000,
    cnd: 1500,
    pose: 5000,
    remblai: 2500,
    epreuve: 4000
  });

  const renderBordereauPrixContent = (project: Project) => {
    if (!project) {
      return (
        <div className="text-center text-slate-500 font-bold p-8">
          Aucun ouvrage sélectionné.
        </div>
      );
    }

    const longNum = parseFloat(project.identity?.caracteristiques?.longueur || "0") || 1;
    const diamNum = parseFloat(project.identity?.caracteristiques?.diametre || "0") || 8;

    const etudeItems = [
      { id: 'impact', code: '01.01', designation: "Étude d'Impact sur l'Environnement (EIE)", unit: 'FF', qty: 1, price: bePrices.impact || 1500000, formula: 'Forfait fixe' },
      { id: 'topo', code: '01.02', designation: 'Levé topographique et piquetage de tracé', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: bePrices.topo || 45000, formula: 'Km x P.U' },
      { id: 'ing', code: '01.03', designation: "Ingénierie de détail & Plans d'exécution (FEED)", unit: 'FF', qty: 1, price: bePrices.ing || 3000000, formula: 'Forfait fixe' },
      { id: 'dup', code: '01.04', designation: "Dossier DUP & Autorisation Administrative (AP)", unit: 'FF', qty: 1, price: bePrices.dup || 800000, formula: 'Forfait fixe' }
    ];

    const expertItems = [
      { id: 'enq', code: '02.01', designation: 'Enquête parcellaire & Recensement des propriétaires', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: gefPrices.enq || 150000, formula: 'Km x P.U' },
      { id: 'exp', code: '02.02', designation: 'Expertise foncière & Évaluation des indemnités', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: gefPrices.exp || 80000, formula: 'Km x P.U' },
      { id: 'assist', code: '02.03', designation: 'Assistance juridique & Gestion des oppositions', unit: 'FF', qty: 1, price: gefPrices.assist || 250000, formula: 'Forfait fixe' }
    ];

    const travauxItems = [
      { id: 'piste', code: '03.01', designation: "Ouverture de piste & Décapage d'emprise", unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: travauxPrices.piste || 12000, formula: 'Km x P.U' },
      { id: 'fouille', code: '03.02', designation: 'Terrassement en tranchée et lit de pose', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: travauxPrices.fouille || 3500, formula: 'Km x P.U' },
      { id: 'soudage', code: '03.03', designation: 'Soudage des tubes en ligne & CND', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: travauxPrices.soudage || 8000, formula: 'Km x P.U' },
      { id: 'cnd', code: '03.04', designation: 'Contrôles Non Destructifs (Radio / US)', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: travauxPrices.cnd || 1500, formula: 'Km x P.U' },
      { id: 'pose', code: '03.05', designation: 'Bardage, cintrage, descente en fouille & remblai', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: travauxPrices.pose || 5000, formula: 'Km x P.U' },
      { id: 'epreuve', code: '03.06', designation: 'Épreuves hydrostatiques & Nettoyage / Séchage', unit: 'Km', qty: Math.max(1, Math.round(longNum)), price: travauxPrices.epreuve || 4000, formula: 'Km x P.U' }
    ];

    const currentItems = 
      bordereauActivePart === "01" ? etudeItems : 
      bordereauActivePart === "02" ? expertItems : 
      travauxItems;

    const totalHT = currentItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
    const tva = totalHT * 0.19;
    const totalTTC = totalHT + tva;

    const formatDALocal = (val: number) => {
      return new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val) + " DA";
    };

    const handlePriceChange = (itemId: string, newPrice: number) => {
      if (bordereauActivePart === "01") {
        setBePrices(prev => ({ ...prev, [itemId]: newPrice }));
      } else if (bordereauActivePart === "02") {
        setGefPrices(prev => ({ ...prev, [itemId]: newPrice }));
      } else {
        setTravauxPrices(prev => ({ ...prev, [itemId]: newPrice }));
      }
    };

    const resetPrices = () => {
      if (bordereauActivePart === "01") {
        setBePrices({
          impact: 1500000,
          topo: 45000,
          ing: 3000000,
          dup: 800000,
          geo: 120000
        });
      } else if (bordereauActivePart === "02") {
        setGefPrices({
          enq: 150000,
          exp: 80000,
          assist: 250000,
          cnd: 4500,
          audit: 65000
        });
      } else {
        setTravauxPrices({
          piste: 12000,
          lit: 4000,
          soudage: 18000,
          enrobage: 85000,
          gr_dep: 4500000,
          gr_arr: 4500000,
          poste_coup: 3500000,
          poste_det: 15000000,
          raccord: 2500000,
          protection: 3500000,
          epreuve: 150000
        });
      }
    };

    return (
      <div className="space-y-6">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider font-mono">Estimation Budgétaire Automatique</span>
            <h4 className="font-extrabold text-base text-slate-800">Détails d'estimation de l'ouvrage : {project.name}</h4>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetPrices}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-[11px] font-bold text-slate-600 cursor-pointer transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réinitialiser les prix
            </button>
            <button
              onClick={() => setShowPrintBordereauModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              Imprimer le Bordereau
            </button>
          </div>
        </div>

        {/* Parametres de calcul */}
        <div className="bg-slate-900 text-slate-200 p-4.5 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-left">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Dimensions principales</span>
            <div className="flex gap-4">
              <div>
                <span className="text-slate-400">Longueur :</span> <span className="font-mono font-black text-white">{longNum} km</span>
              </div>
              <div>
                <span className="text-slate-400">Diamètre :</span> <span className="font-mono font-black text-white">{diamNum}" (DN)</span>
              </div>
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Éléments de structure actifs détectés</span>
            <div className="flex flex-wrap gap-1.5">
              {project.identity.caracteristiques?.hasGareRacleurDepart && (
                <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-blue-400">🚀 Gare Racleur Départ</span>
              )}
              {project.identity.caracteristiques?.hasGareRacleurArrivee && (
                <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-blue-400">🏁 Gare Racleur Arrivée</span>
              )}
              {project.identity.caracteristiques?.hasPosteDetente && (
                <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-emerald-400">🔥 Poste Détente</span>
              )}
              {project.identity.caracteristiques?.hasPosteCoupure && (
                <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-yellow-400">🔌 Poste Coupure</span>
              )}
              {project.identity.caracteristiques?.hasPosteSectionnement && (
                <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-yellow-400">🛡️ Poste Sectionnement</span>
              )}
              {project.identity.caracteristiques?.pointRaccordement && (
                <span className="bg-slate-800 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold text-purple-400">🔌 Raccordement</span>
              )}
              {!project.identity.caracteristiques?.hasGareRacleurDepart && 
               !project.identity.caracteristiques?.hasGareRacleurArrivee && 
               !project.identity.caracteristiques?.hasPosteDetente && 
               !project.identity.caracteristiques?.hasPosteCoupure && 
               !project.identity.caracteristiques?.hasPosteSectionnement && 
               !project.identity.caracteristiques?.pointRaccordement && (
                <span className="text-slate-500 italic text-[11px]">Aucun poste ou équipement configuré dans l'identité technique.</span>
              )}
            </div>
          </div>
        </div>

        {/* Bordereau Type Selector */}
        <div className="flex bg-slate-50 p-1 rounded-2xl gap-1 border border-slate-200/50">
          <button
            onClick={() => setBordereauActivePart("01")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              bordereauActivePart === "01" 
                ? "bg-white text-rose-600 shadow-sm border border-slate-200" 
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Partie 01 • Études (BE)
          </button>
          <button
            onClick={() => setBordereauActivePart("02")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              bordereauActivePart === "02" 
                ? "bg-white text-rose-600 shadow-sm border border-slate-200" 
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Partie 02 • Expertise & CND
          </button>
          <button
            onClick={() => setBordereauActivePart("03")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              bordereauActivePart === "03" 
                ? "bg-white text-rose-600 shadow-sm border border-slate-200" 
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Partie 03 • Travaux (GC & Méca)
          </button>
        </div>

        {/* Table of items */}
        <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-inner">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[9px] tracking-wide">
                <th className="py-3 px-3 w-12 text-center">N°</th>
                <th className="py-3 px-3 min-w-[280px]">Désignation des Prestations</th>
                <th className="py-3 px-2 w-14 text-center">Unité</th>
                <th className="py-3 px-3 w-20 text-center">Quantité</th>
                <th className="py-3 px-3 w-32 text-right">Prix Unitaire (DA)</th>
                <th className="py-3 px-3 w-32 text-right">Total HT (DA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {currentItems.map((item) => {
                const totalItem = item.qty * item.price;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/55 transition-colors">
                    <td className="py-3 px-3 font-mono font-black text-slate-400 text-center">{item.code}</td>
                    <td className="py-3 px-3">
                      <p className="font-extrabold text-slate-800 leading-tight">{item.designation}</p>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5 block italic">Formule : {item.formula}</span>
                    </td>
                    <td className="py-3 px-2 font-bold text-center text-slate-500">{item.unit}</td>
                    <td className="py-3 px-3 font-mono font-bold text-center text-slate-800">{item.qty}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 select-all">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const p = Math.max(0, parseInt(e.target.value) || 0);
                            handlePriceChange(item.id, p);
                          }}
                          className="w-20 font-mono text-right font-black text-slate-800 outline-none border-none p-0 text-[11px]"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">DA</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-right text-slate-900">
                      {formatDALocal(totalItem)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 flex flex-col justify-center space-y-1 text-left">
            <p className="font-bold uppercase text-[9px] text-slate-400">Notice légale & d'estimation :</p>
            <p className="leading-relaxed">
              Ce bordereau est une estimation automatisée fournie par le module <strong>Engineering &amp; Estimation Project</strong>. Les quantités et prix sont sujets à réajustements contradictoires lors des réunions d'ouverture de plis ou d'avenants techniques.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 divide-y divide-slate-200/60 text-xs space-y-3.5">
            <div className="flex justify-between items-center pb-2.5">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Total Partiel HT :</span>
              <span className="font-mono font-black text-slate-800 text-sm">{formatDALocal(totalHT)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="font-bold text-slate-500 uppercase text-[10px]">TVA Réglementaire (19%) :</span>
              <span className="font-mono font-black text-slate-800 text-sm">{formatDALocal(tva)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 text-slate-950 font-black">
              <span className="uppercase tracking-wider">Montant Estimé TTC :</span>
              <span className="font-mono text-base text-rose-600 bg-rose-50 border border-rose-100 px-3.5 py-1.5 rounded-xl">{formatDALocal(totalTTC)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBordereauPrixModule = () => {
    if (projects.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-500 font-medium text-left">
          Aucun ouvrage/projet enregistré pour générer un bordereau.
        </div>
      );
    }

    const activeProject = projects.find(p => p.id === bordereauSelectedProjectId) || projects[0];

    return (
      <motion.div
        key="bordereau-module"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="space-y-6"
      >
        {/* Project Selector Header */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono">Module Gestion de Projets &amp; Chiffrage</span>
            <h3 className="font-extrabold text-lg text-slate-800">Édition & Chiffrage du Bordereau des Prix (BPU / BoQ)</h3>
            <p className="text-xs text-slate-500 font-medium">Sélectionnez un projet pour générer et éditer son estimation et son bordereau de prix.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600 shrink-0">Ouvrage :</span>
            <select
              value={bordereauSelectedProjectId === "all" ? activeProject?.id : bordereauSelectedProjectId}
              onChange={(e) => setBordereauSelectedProjectId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-black rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer min-w-[240px]"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} ({proj.identity?.wilaya || "N/A"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* The beautiful BPU container */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          {renderBordereauPrixContent(activeProject)}
        </div>
      </motion.div>
    );
  };


  return renderBordereauPrixModule();
}
