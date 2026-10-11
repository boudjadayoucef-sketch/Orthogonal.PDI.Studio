import React, { useState } from 'react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FileText, Download, CheckCircle, Clock, AlertTriangle, Shield, Check, Layers,
  RefreshCw, Archive
} from 'lucide-react';
import { db, createNotification } from '../../../lib/firebase';
import { pdiAlert } from '../../../pdi/ui/PdiNotice';
import defaultLogo from '../../../assets/images/pdi-logo-horizontal.png';
import { Project } from '../types';
import { generatePlanDeChargeHtml } from '../projectUtils';

const safeHtml2Canvas = async (element: HTMLElement, options: any) => {
  return await html2canvas(element, options);
};

const downloadAsWord = (htmlContent: string, filename: string) => {
  const blob = new Blob(['<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + filename + '</title></head><body>' + htmlContent + '</body></html>'], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export interface RapportMensuelViewProps {
  projects: Project[];
  handleExportRapportMensuelWord?: (reportProjects: Project[], highlights: string, obstacles: string, nextSteps: string) => Promise<void>;
  handleExportRapportMensuelPDF?: (reportProjects: Project[], highlights: string, obstacles: string, nextSteps: string) => Promise<void>;
}

export function RapportMensuelView({
  projects,
}: RapportMensuelViewProps) {
  const [reportMonth, setReportMonth] = useState<string>('07');
  const [reportYear, setReportYear] = useState<string>('2026');
  const [selectedReportProjects, setSelectedReportProjects] = useState<string[]>([]);
  const [reportHighlights, setReportHighlights] = useState<string>(
    "• Avancement global satisfaisant sur l'ensemble du réseau de transport.\n• Le projet de gazoduc de Jijel a atteint 55% d'avancement avec finalisation de la première phase réglementaire.\n• Des réunions d'arbitrage positives se sont déroulées au niveau des wilayas pour débloquer les emprises foncières."
  );
  const [reportObstacles, setReportObstacles] = useState<string>(
    "• Des oppositions mineures persistent sur le tronçon de Jijel (PK 12+500), gérées conjointement avec les collectivités locales.\n• Retard mineur sur les approvisionnements des vannes de sécurité HP en raison des contraintes logistiques maritimes."
  );
  const [reportNextSteps, setReportNextSteps] = useState<string>(
    "1. Lancement des épreuves hydrostatiques sur le tronçon libéré de Jijel.\n2. Archivage final des documents d'as-built du gazoduc Alger-Blida.\n3. Programmation de la mise en gaz officielle pour Blida."
  );
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [showReportPreview, setShowReportPreview] = useState<boolean>(false);

  const renderRapportMensuel = () => {
    const handleToggleReportProject = (id: string) => {
      if (selectedReportProjects.includes(id)) {
        setSelectedReportProjects(selectedReportProjects.filter(pId => pId !== id));
      } else {
        setSelectedReportProjects([...selectedReportProjects, id]);
      }
    };

    const reportSelectedObjects = projects.filter(p => selectedReportProjects.includes(p.id));

    const handleDownloadReportWord = (customFileName?: string) => {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px;">
            <p style="font-weight: bold; font-size: 14pt; margin: 0; text-transform: uppercase; color: #1e3a8a;">PD&amp;I — PIPELINE DESIGN &amp; ISOMETRICS</p>
            <p style="font-weight: bold; font-size: 11pt; margin: 5px 0 0 0; color: #f97316;">DIRECTION TECHNIQUE &amp; PROJETS EPC</p>
            <p style="font-size: 9pt; color: #64748b; margin: 2px 0 0 0;">Division Ingénierie &amp; Réalisation Industrielle</p>
          </div>
          
          <h1 style="text-align: center; color: #1e3a8a; font-size: 20pt; margin-top: 30px; text-transform: uppercase;">Rapport d'Activité Mensuel des Projets Gazoducs</h1>
          <h3 style="text-align: center; color: #f97316; font-size: 14pt; margin-bottom: 30px;">Période : ${currentMonthName} ${reportYear}</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px;">
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Ouvrage (Nom de l'Installation)</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Wilaya</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Phase Actuelle</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">Avancement Physique</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">Statut Qualité CND</th>
            </tr>
            ${reportSelectedObjects.map(p => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold;">${p.name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px;">${p.identity.wilaya}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; color: #475569;">${p.identity.phase}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; color: #1d4ed8;">${p.travauxPlanification.avancementPhysique}%</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px;">${p.travauxPlanification.controleQualiteChecklist.radiographieCND ? "Réussi" : "En cours"}</td>
              </tr>
            `).join("")}
          </table>

          <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 25px;">1. Faits Marquants & Réalisations</h2>
          <p style="white-space: pre-line; line-height: 1.5; color: #334155;">${reportHighlights || "Aucun fait marquant enregistré pour cette période."}</p>

          <h2 style="color: #b91c1c; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 25px;">2. Contraintes & Blocages</h2>
          <p style="white-space: pre-line; line-height: 1.5; color: #991b1b;">${reportObstacles || "Aucune contrainte majeure enregistrée pour cette période."}</p>

          <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 25px;">3. Actions Prioritaires (Mois Suivant)</h2>
          <p style="white-space: pre-line; line-height: 1.5; color: #334155;">${reportNextSteps || "Aucune action définie pour le mois suivant."}</p>
        </div>
      `;
      const fn = customFileName || `Rapport_Activite_Mensuel_${currentMonthName}_${reportYear}.doc`;
      downloadAsWord(htmlBody, fn);
    };

    const handleDownloadReportPDF = async (customFileName?: string) => {
      setIsGeneratingReport(true);
      try {
        const htmlBody = `
          <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 30px; background-color: #ffffff; color: #1e293b; max-width: 800px; width: 800px;">
            <style>
              table { border-collapse: collapse; width: 100%; margin-top: 15px; margin-bottom: 15px; }
              th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 8.5pt; }
              th { background-color: #f1f5f9; font-weight: bold; color: #1e293b; }
              h1, h2, h3, h4 { color: #1e3a8a; }
            </style>
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000000; padding-bottom: 15px; margin-bottom: 20px;">
              <div>
                <p style="font-weight: 800; font-size: 10pt; margin: 0; text-transform: uppercase;">PD&amp;I — Piping Design &amp; Isometrics</p>
                <p style="font-weight: 900; font-size: 14pt; margin: 3px 0; color: #f97316; letter-spacing: 1px;">PD&amp;I</p>
                <p style="font-size: 8.5pt; font-weight: bold; color: #475569; margin: 0;">Engineering &amp; EPC Projects Division</p>
                <p style="font-size: 8pt; color: #64748b; margin: 0;">Industrial Piping &amp; Gas Transport</p>
              </div>
              <div style="text-align: right; font-family: monospace; font-size: 8pt; color: #64748b;">
                <p style="margin: 0;">Réf: PDI/ENG/RPT/${reportYear}-${reportMonth}</p>
                <p style="margin: 3px 0 0 0;">Date: ${new Date().toLocaleDateString("fr-FR")}</p>
              </div>
            </div>

            <div style="text-align: center; margin: 25px 0 20px 0;">
              <h1 style="font-size: 14pt; font-weight: 950; text-transform: uppercase; border-top: 1px solid #1e3a8a; border-bottom: 1px solid #1e3a8a; padding: 8px 0; margin: 0;">
                Rapport d'Activité Mensuel des Projets Gazoducs
              </h1>
              <p style="font-size: 9.5pt; font-weight: 900; color: #ea580c; margin: 5px 0 0 0; text-transform: uppercase;">
                Période d'évaluation : ${currentMonthName} ${reportYear}
              </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background-color: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center; margin-bottom: 20px;">
              <div>
                <p style="font-size: 8pt; color: #64748b; margin: 0; text-transform: uppercase; font-weight: bold;">Ouvrages Suivis</p>
                <p style="font-size: 14pt; font-weight: 900; color: #0f172a; margin: 3px 0 0 0;">${reportSelectedObjects.length}</p>
              </div>
              <div>
                <p style="font-size: 8pt; color: #64748b; margin: 0; text-transform: uppercase; font-weight: bold;">Avancement Moyen</p>
                <p style="font-size: 14pt; font-weight: 900; color: #0f172a; margin: 3px 0 0 0;">
                  ${reportSelectedObjects.length > 0 
                    ? `${Math.round(reportSelectedObjects.reduce((sum, p) => sum + p.travauxPlanification.avancementPhysique, 0) / reportSelectedObjects.length)}%`
                    : "0%"}
                </p>
              </div>
              <div>
                <p style="font-size: 8pt; color: #64748b; margin: 0; text-transform: uppercase; font-weight: bold;">Statut Foncier</p>
                <p style="font-size: 14pt; font-weight: 900; color: #0f172a; margin: 3px 0 0 0;">
                  ${reportSelectedObjects.filter(p => p.etudeAutorisation.statutArreteServitude === "Signé & Publié").length} AS
                </p>
              </div>
            </div>

            <h4 style="font-size: 9pt; font-weight: 900; text-transform: uppercase; border-left: 3px solid #f97316; padding-left: 6px; margin: 20px 0 10px 0;">
              1. État d'avancement des ouvrages
            </h4>
            <table>
              <thead>
                <tr>
                  <th>Ouvrage (Nom de l'Installation)</th>
                  <th>Wilaya</th>
                  <th>Phase Actuelle</th>
                  <th style="text-align: center;">Avancement Physique</th>
                  <th>Statut Qualité CND</th>
                </tr>
              </thead>
              <tbody>
                ${reportSelectedObjects.map(p => `
                  <tr>
                    <td style="font-weight: bold;">${p.name}</td>
                    <td style="color: #475569;">${p.identity.wilaya}</td>
                    <td>${p.identity.phase}</td>
                    <td style="text-align: center; font-weight: bold; color: #1e3a8a;">${p.travauxPlanification.avancementPhysique}%</td>
                    <td style="font-size: 7.5pt; color: #64748b;">${p.travauxPlanification.controleQualiteChecklist.radiographieCND ? "Réussi" : "En cours"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
              <div style="background-color: #f8fafc; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <p style="font-size: 8pt; font-weight: bold; color: #4f46e5; margin: 0 0 5px 0; text-transform: uppercase;">Faits Marquants & Réalisations</p>
                <p style="font-size: 8pt; color: #334155; margin: 0; white-space: pre-line;">${reportHighlights || "Aucun fait marquant."}</p>
              </div>
              <div style="background-color: #fef2f2; padding: 10px; border-radius: 10px; border: 1px solid #fee2e2;">
                <p style="font-size: 8pt; font-weight: bold; color: #b91c1c; margin: 0 0 5px 0; text-transform: uppercase;">Contraintes & Blocages</p>
                <p style="font-size: 8pt; color: #991b1b; margin: 0; white-space: pre-line;">${reportObstacles || "Aucun blocage."}</p>
              </div>
            </div>

            <h4 style="font-size: 9pt; font-weight: 900; text-transform: uppercase; border-left: 3px solid #f97316; padding-left: 6px; margin: 20px 0 10px 0;">
              2. Plan d'actions prioritaires (Mois M+1)
            </h4>
            <div style="background-color: #f8fafc; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
              <p style="font-size: 8pt; color: #334155; margin: 0; white-space: pre-line;">${reportNextSteps || "Aucune action définie."}</p>
            </div>
          </div>
        `;

        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.left = "-9999px";
        tempDiv.style.top = "-9999px";
        tempDiv.style.width = "800px";
        tempDiv.style.padding = "30px";
        tempDiv.style.backgroundColor = "#ffffff";
        tempDiv.innerHTML = htmlBody;
        document.body.appendChild(tempDiv);

        const canvas = await safeHtml2Canvas(tempDiv, {
          scale: 1.8,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const fn = customFileName || `Rapport_Activite_Mensuel_${currentMonthName}_${reportYear}.pdf`;
        pdf.save(fn);
        document.body.removeChild(tempDiv);
      } catch (err) {
        console.error("Error generating report PDF:", err);
        void pdiAlert("Erreur lors de la génération du PDF.");
      } finally {
        setIsGeneratingReport(false);
      }
    };

    const triggerMonthlyArchivingArchiveAndNotify = async () => {
      handleDownloadReportWord(`ARCHIVE_Etat_Avancement_${currentMonthName}_${reportYear}.doc`);
      await handleDownloadReportPDF(`ARCHIVE_Etat_Avancement_${currentMonthName}_${reportYear}.pdf`);
      
      try {
        const filters = {
          annee: "Tous",
          pole: "Tous",
          direction: "Tous",
          wilaya: "Tous",
          phase: "all",
          search: "",
          objectif: "all"
        };
        const chargeHtml = generatePlanDeChargeHtml(projects, filters);
        downloadAsWord(chargeHtml, `ARCHIVE_Plan_de_Charge_${currentMonthName}_${reportYear}.doc`);
        // exported
      } catch (pcErr) {
        console.warn("Could not archive plan de charge automatically:", pcErr);
      }

      try {
        
        await createNotification({
          projectId: `backup_${reportYear}_${reportMonth}`,
          projectName: "Sauvegarde Générale d'Archivage",
          category: "status_change",
          message: `📂 [ARCHIVAGE DE SÉCURITÉ COMPLET] L'utilisateur habilité (Superviseur) a généré, téléchargé et archivé localement la copie officielle de sauvegarde de l'État d'avancement des ouvrages et du Plan de Charge Mensuel pour ${currentMonthName} ${reportYear}.`,
          authorName: "Administrateur Système",
          authorEmail: "admin@pdi-pipeline.com",
          authorRole: "Superviseur",
          readBy: []
        });
        void pdiAlert(`Sauvegarde mensuelle effectuée avec succès ! Les états d'avancement et le plan de charge au format Word et PDF ont été téléchargés de manière sécurisée.`);
      } catch (notifErr) {
        console.warn("Could not log archiving notification:", notifErr);
        void pdiAlert(`Sauvegarde réussie ! Vos documents d'archivage mensuels ont été enregistrés localement.`);
      }
    };

    const monthsFR = [
      { code: "01", name: "Janvier" },
      { code: "02", name: "Février" },
      { code: "03", name: "Mars" },
      { code: "04", name: "Avril" },
      { code: "05", name: "Mai" },
      { code: "06", name: "Juin" },
      { code: "07", name: "Juillet" },
      { code: "08", name: "Août" },
      { code: "09", name: "Septembre" },
      { code: "10", name: "Octobre" },
      { code: "11", name: "Novembre" },
      { code: "12", name: "Décembre" },
    ];

    const currentMonthName = monthsFR.find(m => m.code === reportMonth)?.name || "Juillet";

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="space-y-6 text-left"
      >
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-6">
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Générateur automatisé de rapports</span>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight mt-0.5">Rapports d'Activité Mensuels</h2>
            <p className="text-xs text-slate-400 mt-1">
              Générez, assainissez et consolidez des synthèses formelles d'ingénierie et d'avancement pour la Direction de Région PD&I.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            <div className="lg:col-span-1 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs text-left">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Configurations du Rapport</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Mois d'activité</label>
                  <select
                    value={reportMonth}
                    onChange={e => setReportMonth(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 outline-none font-bold text-slate-800"
                  >
                    {monthsFR.map(m => (
                      <option key={m.code} value={m.code}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Année d'activité</label>
                  <select
                    value={reportYear}
                    onChange={e => setReportYear(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 outline-none font-bold text-slate-800"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-600 block">Projets à inclure ({selectedReportProjects.length})</label>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto bg-white border border-slate-200 rounded-xl p-3 text-left">
                  {projects.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedReportProjects.includes(p.id)}
                        onChange={() => handleToggleReportProject(p.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 block">Faits Marquants (Highlights)</label>
                  <textarea
                    value={reportHighlights}
                    onChange={e => setReportHighlights(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none min-h-[80px] font-medium text-slate-700 text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 block">Contraintes & Points de Blocage</label>
                  <textarea
                    value={reportObstacles}
                    onChange={e => setReportObstacles(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none min-h-[80px] font-medium text-slate-700 text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 block">Actions Prioritaires Mois Suivant</label>
                  <textarea
                    value={reportNextSteps}
                    onChange={e => setReportNextSteps(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none min-h-[80px] font-medium text-slate-700 text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aperçu du Rapport d'Activité Officiel</span>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">Sauvegardez en format certifié et notifiez la direction</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDownloadReportWord()}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Télécharger l'avancement au format Word (.doc)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Word (DOC)</span>
                  </button>
                  <button
                    onClick={() => handleDownloadReportPDF()}
                    disabled={isGeneratingReport}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                    title="Télécharger l'avancement au format PDF"
                  >
                    {isGeneratingReport ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={triggerMonthlyArchivingArchiveAndNotify}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                    title="Sauvegarde l'état d'avancement + le plan de charge en format Word + PDF et notifie Firestore"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Sauvegarde Mensuelle Globale</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm font-sans space-y-6 min-h-[600px] relative overflow-hidden text-left">
                <div className="flex justify-between items-start border-b-2 border-slate-950 pb-5 text-slate-800">
                  <div className="space-y-1 text-left">
                    <p className="font-extrabold text-[11px] uppercase tracking-wider text-slate-950">PD&I — Piping Design & Isometrics</p>
                    <p className="font-black text-xs text-orange-500 uppercase tracking-widest">PD&I</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Engineering & EPC Projects Division</p>
                    <p className="text-[9px] font-medium text-slate-400">Industrial Piping & Gas Transport</p>
                  </div>
                  <div className="text-right space-y-0.5 text-[9px] font-mono text-slate-400">
                    <p>Réf: PDI/ENG/RPT/{reportYear}-{reportMonth}</p>
                    <p>Date: {new Date().toLocaleDateString("fr-FR")}</p>
                    <p>Lieu: Site / Direction de Projet</p>
                  </div>
                </div>

                <div className="text-center py-2 space-y-1">
                  <h1 className="text-base md:text-lg font-black text-slate-950 uppercase tracking-wide border-y border-slate-900 py-1.5">
                    Rapport d'Activité Mensuel des Projets Gazoducs
                  </h1>
                  <p className="text-[11px] font-black uppercase text-orange-600 tracking-wider">
                    Période d'évaluation : {currentMonthName} {reportYear}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center text-xs">
                  <div>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Ouvrages Suivis</p>
                    <p className="font-black text-slate-900 text-lg">{reportSelectedObjects.length}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Avancement Moyen</p>
                    <p className="font-black text-slate-900 text-lg">
                      {reportSelectedObjects.length > 0 
                        ? `${Math.round(reportSelectedObjects.reduce((sum, p) => sum + p.travauxPlanification.avancementPhysique, 0) / reportSelectedObjects.length)}%`
                        : "0%"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Statut Foncier (Approved)</p>
                    <p className="font-black text-slate-900 text-lg">
                      {reportSelectedObjects.filter(p => p.etudeAutorisation.statutArreteServitude === "Signé & Publié").length} AS
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-xs text-slate-950 uppercase tracking-wide border-l-2 border-orange-500 pl-1.5">
                    1. État d'avancement des ouvrages
                  </h4>
                  <table className="w-full text-left border-collapse border border-slate-200 text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-black text-slate-700">
                        <th className="py-2 px-2.5">Ouvrage (Nom de l'Installation)</th>
                        <th className="py-2 px-2.5">Wilaya</th>
                        <th className="py-2 px-2.5">Phase Actuelle</th>
                        <th className="py-2 px-2.5 text-center">Avancement Physique</th>
                        <th className="py-2 px-2.5">Statut Qualité CND</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {reportSelectedObjects.map(p => (
                        <tr key={p.id}>
                          <td className="py-2 px-2.5 font-bold">{p.name}</td>
                          <td className="py-2 px-2.5 text-slate-600">{p.identity.wilaya}</td>
                          <td className="py-2 px-2.5">
                            <span className="font-semibold text-slate-600">{p.identity.phase}</span>
                          </td>
                          <td className="py-2 px-2.5 text-center font-bold text-blue-800 font-mono">
                            {p.travauxPlanification.avancementPhysique}%
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[9px] text-slate-500">
                            {p.travauxPlanification.controleQualiteChecklist.radiographieCND ? "Réussi" : "En cours"}
                          </td>
                        </tr>
                      ))}
                      {reportSelectedObjects.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-4 italic text-slate-400">Aucun ouvrage inclus.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-left">
                    <h5 className="font-black text-slate-950 uppercase tracking-wide text-[9px] text-indigo-700">Faits Marquants & Réalisations</h5>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line font-medium">{reportHighlights}</p>
                  </div>

                  <div className="space-y-1.5 bg-rose-50/40 p-3 rounded-2xl border border-rose-100 text-left">
                    <h5 className="font-black text-rose-950 uppercase tracking-wide text-[9px] text-rose-700">Contraintes & Blocages</h5>
                    <p className="text-rose-900 leading-relaxed whitespace-pre-line font-medium">{reportObstacles}</p>
                  </div>
                </div>

                <div className="space-y-2 text-[11px] text-left">
                  <h4 className="font-black text-xs text-slate-950 uppercase tracking-wide border-l-2 border-orange-500 pl-1.5">
                    2. Plan d'actions prioritaires (Mois M+1)
                  </h4>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line font-medium">{reportNextSteps}</p>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-2 text-center text-[10px] font-bold text-slate-800 border-t border-slate-100">
                  <div className="space-y-12">
                    <p className="uppercase text-slate-500">L'Ingénieur Chef de Projet (Engineering)</p>
                    <p className="font-extrabold text-slate-950">Visa & Signature</p>
                  </div>
                  <div className="space-y-12">
                    <p className="uppercase text-slate-500">Le Directeur de Région (Approbation)</p>
                    <p className="font-extrabold text-slate-950">Visa & Signature</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };


  return renderRapportMensuel();
}
