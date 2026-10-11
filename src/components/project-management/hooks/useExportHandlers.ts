import React from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { pdiAlert } from '../../../pdi/ui/PdiNotice';
import defaultLogo from '../../../assets/images/pdi-logo-horizontal.png';
import { pdiFeuilleImpression017L } from '../../../pdi/impression/pdiImpression017L';
import { Project, ContractDetails } from '../types';
import { getProjectDisplayLength, generateKMLString, computeProgressFromCanvas, getGenesisMilestones, formatDateFrench, getProjectObjective } from '../projectUtils';

export interface UseExportHandlersOptions {
  projects?: Project[];
  selectedProject?: Project | null;
  currentUser?: any;
  activeModule?: string;
  canEditProject?: (project: any) => boolean;
}

export function useExportHandlers(options: UseExportHandlersOptions = {}) {
  const { projects = [], selectedProject = null, currentUser = null, activeModule = 'charge', canEditProject = () => true } = options;

  const handleDownloadKMZ = (project: Project) => {
    try {
      let content: string | Uint8Array;
      let filename = `Trace_${project.name.replace(/\s+/g, "_")}.kml`;
      let mimeType = "application/vnd.google-earth.kml+xml";

      if (project.identity.kmzFileData) {
        const base64Data = project.identity.kmzFileData;
        const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          const rawBase64 = matches[2];
          const binString = atob(rawBase64);
          const len = binString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binString.charCodeAt(i);
          }
          content = bytes;
          if (project.identity.kmzFileName) {
            filename = project.identity.kmzFileName;
          } else {
            filename = mimeType.includes("zip") || mimeType.includes("kmz") 
              ? `Trace_${project.name.replace(/\s+/g, "_")}.kmz` 
              : `Trace_${project.name.replace(/\s+/g, "_")}.kml`;
          }
        } else {
          content = generateKMLString(project);
        }
      } else {
        content = generateKMLString(project);
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading KML:", err);
      void pdiAlert("Erreur lors de la génération ou du téléchargement du fichier.");
    }
  };

  // Helper to download content as Microsoft Word document
  const downloadAsWord = (htmlContent: string, filename: string) => {
    const documentTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${filename}</title>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.4;
            color: #1e293b;
            padding: 20px;
          }
          h1 {
            color: #1e3a8a;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 6px;
            margin-top: 25px;
            margin-bottom: 15px;
            font-size: 20pt;
            font-weight: bold;
          }
          h2 {
            color: #2563eb;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 4px;
            margin-top: 22px;
            margin-bottom: 12px;
            font-size: 15pt;
            font-weight: bold;
          }
          h3 {
            color: #0f172a;
            margin-top: 15px;
            margin-bottom: 8px;
            font-size: 12pt;
            font-weight: bold;
          }
          h4 {
            color: #1e3a8a;
            margin-top: 12px;
            margin-bottom: 6px;
            font-size: 10.5pt;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
          }
          th, td {
            border: 1px solid #94a3b8;
            padding: 6px 10px;
            font-size: 9pt;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #1e293b;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
          .page-break {
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
    const blob = new Blob([documentTemplate], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to determine the main objective (Mise en gaz or Ouverture de chantier) for a project
  const getProjectObjective = (p: Project) => {
    if (p.identity.phase === "Étude") {
      return {
        label: "Ouverture chantier",
        date: p.planning?.travauxStart || "",
        type: "ouverture"
      };
    } else if (p.identity.phase === "Travaux" || p.identity.phase === "Mise en Gaz") {
      return {
        label: "Mise en gaz",
        date: p.planning?.gazStart || "",
        type: "misengaz"
      };
    } else {
      return {
        label: "Clôturé",
        date: p.planning?.gazEnd || "",
        type: "cloture"
      };
    }
  };

  // Helper to generate Plan de charge HTML
  const generatePlanDeChargeHtml = (filteredProjects: Project[], filters: {
    annee: string;
    pole: string;
    direction: string;
    wilaya: string;
    phase: string;
    search: string;
    objectif: string;
  }) => {
    let html = `
      <div style="text-align: center; margin-bottom: 25px; border-bottom: 3px double #1e3a8a; padding-bottom: 15px;">
        <h1 style="color: #1e3a8a; font-size: 22pt; margin: 0; font-weight: bold; text-transform: uppercase; border: none; padding: 0;">PD&amp;I — PIPING &amp; INFRASTRUCTURE ENGINEERING</h1>
        <h2 style="color: #475569; font-size: 14pt; margin: 5px 0 0 0; font-weight: bold; text-transform: uppercase; border: none; padding: 0;">PLAN DE CHARGE D'INGÉNIERIE &amp; TRAVAUX</h2>
        <p style="font-size: 10pt; color: #64748b; margin: 5px 0 0 0;">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #0f172a; font-size: 11pt; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">Filtres actifs pour la réunion :</h3>
        <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;">
          <tr style="border: none;">
            <td style="border: none; padding: 4px; font-size: 9pt; width: 33%;"><strong style="color: #475569;">Année :</strong> ${filters.annee}</td>
            <td style="border: none; padding: 4px; font-size: 9pt; width: 33%;"><strong style="color: #475569;">Pôle TG :</strong> ${filters.pole}</td>
            <td style="border: none; padding: 4px; font-size: 9pt; width: 33%;"><strong style="color: #475569;">Direction/Région :</strong> ${filters.direction}</td>
          </tr>
          <tr style="border: none;">
            <td style="border: none; padding: 4px; font-size: 9pt;"><strong style="color: #475569;">Wilaya :</strong> ${filters.wilaya}</td>
            <td style="border: none; padding: 4px; font-size: 9pt;"><strong style="color: #475569;">Phase Actuelle :</strong> ${filters.phase}</td>
            <td style="border: none; padding: 4px; font-size: 9pt;"><strong style="color: #475569;">Objectif :</strong> ${filters.objectif === "Tous" ? "Tous les objectifs" : filters.objectif === "Ouverture" ? "Ouverture de chantier" : "Mise en gaz"}</td>
          </tr>
        </table>
      </div>

      <h3 style="color: #1e3a8a; font-size: 12pt; font-weight: bold; margin-bottom: 10px;">Liste des Ouvrages (${filteredProjects.length})</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff;">
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Ouvrage</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Wilaya</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Pôle</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Région / Direction</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Phase</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Objectif Prévu</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Diamètre</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Longueur</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Capacité Poste</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: center; color: white; background-color: #1e3a8a;">Av. GC</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: center; color: white; background-color: #1e3a8a;">Av. Méca</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: center; color: white; background-color: #1e3a8a;">Av. Global</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 8.5pt; text-align: left; color: white; background-color: #1e3a8a;">Contrainte Majeure</th>
          </tr>
        </thead>
        <tbody>
    `;

    filteredProjects.forEach(p => {
      const hasConstraint = p.identity.contraintes && p.identity.contraintes.trim().length > 0;
      const gc = p.travauxPlanification?.avancementGC !== undefined ? `${p.travauxPlanification.avancementGC}%` : "0%";
      const meca = p.travauxPlanification?.avancementMeca !== undefined ? `${p.travauxPlanification.avancementMeca}%` : "0%";
      const global = p.travauxPlanification?.avancementPhysique !== undefined ? `${p.travauxPlanification.avancementPhysique}%` : "0%";
      const cap = p.identity.caracteristiques?.capacitePoste || p.ficheSuivi?.capPoste || "N/A";
      
      const obj = getProjectObjective(p);
      const formattedObjDate = obj.date ? new Date(obj.date).toLocaleDateString("fr-FR") : "Non défini";
      const objCellText = `<strong style="color: ${obj.type === "ouverture" ? "#b45309" : obj.type === "misengaz" ? "#047857" : "#475569"}; font-size: 8.5pt;">${obj.label}</strong><br/><span style="font-size: 7.5pt; font-family: monospace; color: #64748b;">${formattedObjDate}</span>`;

      html += `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-weight: bold; color: #1e293b;">${p.name}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; color: #475569;">${p.identity.wilaya || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; color: #475569;">${p.identity.pole || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; color: #475569;">${p.identity.region || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-weight: bold; text-align: center;">${p.identity.phase}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; text-align: left;">${objCellText}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-family: monospace; color: #334155;">${p.identity.caracteristiques?.diametre || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-family: monospace; color: #334155;">${getProjectDisplayLength(p) !== "0" ? `${getProjectDisplayLength(p)} km` : "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-family: monospace; color: #334155;">${cap}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-family: monospace; text-align: center; color: #1e3a8a; font-weight: bold;">${gc}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-family: monospace; text-align: center; color: #047857; font-weight: bold;">${meca}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; font-family: monospace; text-align: center; color: #2563eb; font-weight: bold; background-color: #eff6ff;">${global}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8pt; color: ${hasConstraint ? "#be123c" : "#047857"};">
            ${hasConstraint ? p.identity.contraintes : "Aucune contrainte"}
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <div style="margin-top: 30px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        Document d'Ingénierie &amp; Suivi de Réalisation • PD&amp;I
      </div>
    `;

    return html;
  };

  const handlePrintPlanDeCharge = (filteredProjects: Project[]) => {
    const filters = {
      annee: "Tous",
      pole: "Tous",
      direction: "Tous",
      wilaya: "Tous",
      phase: "Tous",
      search: "",
      objectif: "Tous"
    };
    const htmlContent = generatePlanDeChargeHtml(filteredProjects, filters);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Plan de Charge PD&I</title>
            <style>
              body { padding: 30px; font-family: 'Segoe UI', system-ui, sans-serif; background-color: #fff; color: #1e293b; }
              table { border-collapse: collapse; width: 100%; margin-top: 15px; margin-bottom: 15px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 8.5pt; }
              th { background-color: #f1f5f9; font-weight: bold; color: #1e293b; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .text-right { text-align: right; }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>window.onload = function() { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      win.document.close();
    } else {
      void pdiAlert("Veuillez autoriser les popups pour pouvoir imprimer le plan de charge.");
    }
  };

  const handleExportPlanDeChargeWord = (filteredProjects: Project[]) => {
    const filters = {
      annee: "Tous",
      pole: "Tous",
      direction: "Tous",
      wilaya: "Tous",
      phase: "Tous",
      search: "",
      objectif: "Tous"
    };
    const htmlContent = generatePlanDeChargeHtml(filteredProjects, filters);
    downloadAsWord(htmlContent, `Plan_de_Charge_PD&I_${new Date().toISOString().split('T')[0]}.doc`);
  };

  const safeHtml2Canvas = async (element: HTMLElement, options: any = {}) => {
    const convertOklchToRgb = (oklchStr: string): string => {
      return oklchStr.replace(/oklch\(([^)]+)\)/g, (match, content) => {
        try {
          const parts = content.trim().split(/[\s+/]+/);
          if (parts.length > 0) {
            const lStr = parts[0];
            let lightness = 0.5;
            if (lStr.endsWith('%')) {
              lightness = parseFloat(lStr) / 100;
            } else {
              lightness = parseFloat(lStr);
              if (lightness > 1) {
                lightness = lightness / 100;
              }
            }
            lightness = Math.max(0, Math.min(1, lightness));
            const grayVal = Math.round(lightness * 255);
            
            let alpha = '1';
            if (parts.length >= 4) {
              const aStr = parts[3];
              if (aStr.endsWith('%')) {
                alpha = String(parseFloat(aStr) / 100);
              } else {
                alpha = aStr;
              }
            } else if (content.includes('/')) {
              const slashParts = content.split('/');
              if (slashParts.length > 1) {
                const aStr = slashParts[1].trim();
                if (aStr.endsWith('%')) {
                  alpha = String(parseFloat(aStr) / 100);
                } else {
                  alpha = aStr;
                }
              }
            }
            
            if (alpha !== '1' && alpha !== '') {
              return `rgba(${grayVal}, ${grayVal}, ${grayVal}, ${alpha})`;
            } else {
              return `rgb(${grayVal}, ${grayVal}, ${grayVal})`;
            }
          }
        } catch (e) {
          // fallback
        }
        return 'rgb(120, 120, 120)';
      });
    };

    const originalOnClone = options.onclone;
    
    options.onclone = (clonedDoc: Document, clonedEl: HTMLElement) => {
      // 1. Sanitize style attributes on all elements
      try {
        const allElements = clonedDoc.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          if (el.style) {
            const inlineStyle = el.getAttribute('style');
            if (inlineStyle && inlineStyle.includes('oklch')) {
              el.setAttribute('style', convertOklchToRgb(inlineStyle));
            }
          }
        }
      } catch (e) {
        console.warn("Failed to sanitize inline styles:", e);
      }

      // 2. Sanitize style tags
      try {
        const styleTags = clonedDoc.getElementsByTagName('style');
        for (let i = 0; i < styleTags.length; i++) {
          const style = styleTags[i];
          if (style.textContent && style.textContent.includes('oklch')) {
            style.textContent = convertOklchToRgb(style.textContent);
          }
        }
      } catch (e) {
        console.warn("Failed to sanitize style tags:", e);
      }

      // 3. Sanitize styleSheets cssRules
      try {
        for (let i = 0; i < clonedDoc.styleSheets.length; i++) {
          const sheet = clonedDoc.styleSheets[i];
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
              for (let j = 0; j < rules.length; j++) {
                const rule = rules[j] as CSSStyleRule;
                if (rule.style && rule.style.cssText) {
                  if (rule.style.cssText.includes('oklch')) {
                    try {
                      rule.style.cssText = convertOklchToRgb(rule.style.cssText);
                    } catch (err) {
                      // ignore write error
                    }
                  }
                }
              }
            }
          } catch (e) {
            // CORS error, ignore
          }
        }
      } catch (e) {
        console.warn("Failed to sanitize styleSheets:", e);
      }

      // 4. Override getComputedStyle on the cloned window
      try {
        if (clonedDoc.defaultView) {
          const originalGetComputedStyle = clonedDoc.defaultView.getComputedStyle;
          clonedDoc.defaultView.getComputedStyle = function(el: Element, pseudoElt?: string) {
            const style = originalGetComputedStyle.call(clonedDoc.defaultView, el, pseudoElt);
            return new Proxy(style, {
              get(target: any, prop: string | symbol, receiver: any) {
                if (prop === 'getPropertyValue') {
                  return function(propertyName: string) {
                    const val = target.getPropertyValue(propertyName);
                    if (typeof val === 'string' && val.includes('oklch')) {
                      return convertOklchToRgb(val);
                    }
                    return val;
                  };
                }
                const val = Reflect.get(target, prop, receiver);
                if (typeof val === 'string' && val.includes('oklch')) {
                  return convertOklchToRgb(val);
                }
                return val;
              }
            }) as CSSStyleDeclaration;
          };
        }
      } catch (e) {
        console.warn("Failed to override getComputedStyle:", e);
      }

      if (originalOnClone) {
        originalOnClone(clonedDoc, clonedEl);
      }
    };

    return html2canvas(element, options);
  };

  const handleExportPlanDeChargePDF = async (filteredProjects: Project[]) => {
    const filters = {
      annee: "Tous",
      pole: "Tous",
      direction: "Tous",
      wilaya: "Tous",
      phase: "Tous",
      search: "",
      objectif: "Tous"
    };
    const htmlContent = generatePlanDeChargeHtml(filteredProjects, filters);
    
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "-9999px";
    tempDiv.style.width = "800px";
    tempDiv.style.padding = "30px";
    tempDiv.style.backgroundColor = "#ffffff";
    tempDiv.style.color = "#1e293b";
    tempDiv.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    
    tempDiv.innerHTML = `
      <style>
        table { border-collapse: collapse; width: 100%; margin-top: 15px; margin-bottom: 15px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 8.5pt; }
        th { background-color: #f1f5f9; font-weight: bold; color: #1e293b; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-right { text-align: right; }
        h1, h2, h3, h4 { color: #1e3a8a; }
      </style>
      ${htmlContent}
    `;
    
    document.body.appendChild(tempDiv);
    
    try {
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
      
      pdf.save(`Plan_de_Charge_PD&I_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      void pdiAlert("Une erreur est survenue lors de la génération du PDF.");
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const handleExportActivePanePDF = async () => {
    const element = document.getElementById("current-content-pane");
    if (!element) {
      void pdiAlert("Impossible de trouver la section de contenu active à exporter.");
      return;
    }
    
    const activeModuleNames: Record<string, string> = {
      charge: "Plan_de_Charge",
      gestion: "Gestion_Projet",
      dashboard: "Tableau_de_Bord",
      report: "Rapport_Mensuel",
      bordereau: "Bordereau_Prix"
    };
    
    const moduleName = activeModuleNames[activeModule] || "Page";
    const fileName = `${moduleName}_PD&I_${new Date().toISOString().split('T')[0]}.pdf`;
    
    try {
      const canvas = await safeHtml2Canvas(element, {
        scale: 1.8,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 1200
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
      
      pdf.save(fileName);
    } catch (error) {
      console.error("Error generating page PDF:", error);
      void pdiAlert("Une erreur est survenue lors de la génération du PDF de la page.");
    }
  };

  // Helper to generate full single project sheet (Fiche Projet)
  const generateFicheProjetHtml = (p: Project) => {
    const formatFrDate = (dStr: string) => {
      if (!dStr) return "Non planifiée / Non renseignée";
      try {
        const parts = dStr.split("-");
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dStr;
      } catch {
        return dStr;
      }
    };

    const getContractHtml = (title: string, c?: ContractDetails) => {
      if (!c || !c.nom) return `<p style="font-size: 9.5pt; font-style: italic; color: #64748b; margin: 5px 0;">Aucun contrat affecté pour ${title}.</p>`;
      return `
        <table style="width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 10px;">
          <tr style="background-color: #f8fafc;">
            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px; font-size: 9pt; text-align: left; color: #1e3a8a;">Contrat : ${title}</th>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt; width: 35%;"><strong style="color: #475569;">Prestataire / Entreprise :</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt; font-weight: bold; color: #1e293b;">${c.nom}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Référence contrat :</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt; font-family: monospace;">${c.ref || "N/A"}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Montant :</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt; font-weight: bold;">${c.montant || "N/A"}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Date signature :</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt;">${formatFrDate(c.date)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Date ODS (Ordre de Service) :</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt;">${formatFrDate(c.ods)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Taux d'avancement :</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 5px; font-size: 8.5pt; font-weight: bold; color: #2563eb;">${c.avancement || 0}%</td>
          </tr>
        </table>
      `;
    };

    const hasPiquage = p.identity.caracteristiques?.hasPiquage ? "Oui" : "Non";
    const hasGareDep = p.identity.caracteristiques?.hasGareRacleurDepart ? "Oui" : "Non";
    const hasGareArr = p.identity.caracteristiques?.hasGareRacleurArrivee ? "Oui" : "Non";
    const hasCoupure = p.identity.caracteristiques?.hasPosteCoupure ? `Oui (${p.identity.caracteristiques?.nbPostesCoupure || 1} poste(s))` : "Non";
    const hasSect = p.identity.caracteristiques?.hasPosteSectionnement ? `Oui (${p.identity.caracteristiques?.nbPostesSectionnement || 1} poste(s))` : "Non";
    const hasDet = p.identity.caracteristiques?.hasPosteDetente ? "Oui" : "Non";

    // Docs archives list
    let docsHtml = "";
    if (p.miseEnGazArchive.documentsArchives && p.miseEnGazArchive.documentsArchives.length > 0) {
      docsHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left;">Nom du Document</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left;">Catégorie</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left;">Date d'ajout</th>
            </tr>
          </thead>
          <tbody>
      `;
      p.miseEnGazArchive.documentsArchives.forEach(doc => {
        docsHtml += `
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold; color: #1e293b;">📄 ${doc.name}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; color: #475569;">${doc.category}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace; color: #64748b;">${formatFrDate(doc.addedAt?.substring(0, 10) || "")}</td>
          </tr>
        `;
      });
      docsHtml += `</tbody></table>`;
    } else {
      docsHtml = `<p style="font-size: 9pt; font-style: italic; color: #64748b;">Aucun document archivé dans le dossier technique.</p>`;
    }

    // Follow-up administrative card (Fiche de suivi) details if present
    let ficheSuiviHtml = "";
    if (p.ficheSuivi) {
      const fs = p.ficheSuivi;
      ficheSuiviHtml = `
        <div style="background-color: #fafafa; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-top: 10px;">
          <h4 style="margin-top: 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #1e3a8a; font-size: 10pt; font-weight: bold;">📋 Données Complémentaires de Suivi Technique</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt; width: 30%;"><strong style="color: #475569;">Type de Programme :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.typeProgramme || "Non spécifié"}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt; width: 30%;"><strong style="color: #475569;">Type de Poste :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.typePoste || "Non spécifié"}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Ligne en ML :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.ligneMl || "Non spécifié"}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Nature du Terrain :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.natureTerrain || "Non spécifié"}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Demande GEF :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">Date: ${formatFrDate(fs.demandeGefDate)} / Cabinet: ${fs.gefCabinet || "N/A"}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Choix Terrain :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${formatFrDate(fs.choixTerrainDate)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Type de dépôt dossier :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.depotDossierType || "N/A"}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Date d'enquête publique :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${formatFrDate(fs.impactOuvertureEnqueteDate)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Impact Assujettis :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.impactAssujettis || "N/A"}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Dépôt d'étude impact :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.impactDepotEtude || "N/A"}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">ODS Bureau d'Étude :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">${fs.impactBetOds || "N/A"}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Indemnisation cultures :</strong></td>
              <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;">Quittances PV: ${fs.servitudeQuittancesPv || "N/A"} / Date: ${formatFrDate(fs.servitudeQuittancesDate)}</td>
            </tr>
          </table>
        </div>
      `;
    }

    // Quality checks status
    const qc = p.travauxPlanification?.controleQualiteChecklist;
    let qcHtml = "";
    if (qc) {
      qcHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr style="background-color: #f8fafc;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left; width: 70%;">Point de Contrôle Qualité</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center;">Statut de Conformité</th>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Abaque de soudage validé par l'organisme de contrôle</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${qc.abaqueSoudageValide ? "#047857" : "#be123c"}">${qc.abaqueSoudageValide ? "CONFORME" : "NON VALIDÉ"}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Contrôles Non Destructifs (CND / Radiographie 100% des joints)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${qc.radiographieCND ? "#047857" : "#be123c"}">${qc.radiographieCND ? "EFFECTUÉ & OK" : "EN ATTENTE / REJET"}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Vérification de l'enrobage de la conduite au balai électrique</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${qc.enrobageVerifie ? "#047857" : "#be123c"}">${qc.enrobageVerifie ? "VÉRIFIÉ (SANS DÉFAUT)" : "NON VÉRIFIÉ"}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Lit de pose sableux et remblayage conformément aux normes</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${qc.litPoseSableux ? "#047857" : "#be123c"}">${qc.litPoseSableux ? "RÉALISÉ" : "NON CONFORME"}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Installation du système de protection cathodique (provisoire/définitif)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${qc.protectionCathodique ? "#047857" : "#be123c"}">${qc.protectionCathodique ? "OPÉRATIONNEL" : "NON VALIDÉ / MANQUANT"}</td>
          </tr>
        </table>
      `;
    }

    return `
      <!-- PAGE 1: PAGE DE GARDE -->
      <div style="height: 800px; border: 4px double #1e3a8a; padding: 40px; margin-bottom: 40px;">
        <div style="text-align: center;">
          <h3 style="color: #1e3a8a; font-size: 14pt; font-weight: bold; margin: 0; text-transform: uppercase;">PD&amp;I — PIPING &amp; INFRASTRUCTURE ENGINEERING</h3>
          <p style="font-size: 10pt; color: #475569; margin: 5px 0 0 0; font-weight: bold;">DIVISION INGÉNIERIE &amp; PROJETS EPC</p>
          <p style="font-size: 9pt; color: #64748b; margin: 2px 0 0 0;">Département de Suivi d'Ingénierie &amp; de Réalisation</p>
        </div>
        
        <div style="text-align: center; margin-top: 150px; margin-bottom: 150px;">
          <p style="font-size: 11pt; color: #ef4444; font-weight: bold; text-transform: uppercase; margin: 0 0 10px 0;">FICHE PROJET DE L'OUVRAGE</p>
          <h1 style="color: #1e3a8a; font-size: 26pt; font-weight: bold; line-height: 1.2; border: none; padding: 0; margin: 0;">${p.name}</h1>
          <div style="width: 150px; height: 3px; background-color: #2563eb; margin: 20px auto;"></div>
          <p style="font-size: 12pt; font-weight: bold; color: #475569; margin: 0;">DOSSIER TECHNIQUE CENTRALISÉ MULTI-PHASES</p>
          <p style="font-size: 10pt; font-style: italic; color: #64748b; margin-top: 5px;">De la Planification jusqu'à la Mise en Gaz</p>
        </div>

        <div style="border-top: 2px solid #cbd5e1; padding-top: 20px;">
          <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;">
            <tr style="border: none;">
              <td style="border: none; padding: 4px; font-size: 10pt; width: 50%;"><strong style="color: #1e3a8a;">Pôle TG :</strong> ${p.identity.pole || "N/A"}</td>
              <td style="border: none; padding: 4px; font-size: 10pt; width: 50%;"><strong style="color: #1e3a8a;">Région / Direction :</strong> ${p.identity.region || "N/A"}</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; padding: 4px; font-size: 10pt;"><strong style="color: #1e3a8a;">Wilaya d'implantation :</strong> ${p.identity.wilaya || "N/A"}</td>
              <td style="border: none; padding: 4px; font-size: 10pt;"><strong style="color: #1e3a8a;">Phase Actuelle :</strong> ${p.identity.phase}</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; padding: 4px; font-size: 10pt;"><strong style="color: #1e3a8a;">Chef de Projet (Travaux) :</strong> ${p.chefDeProjetName || "Non spécifié"}</td>
              <td style="border: none; padding: 4px; font-size: 10pt;"><strong style="color: #1e3a8a;">Superviseur :</strong> ${p.superviseurName || "Non spécifié"}</td>
            </tr>
          </table>
          <p style="font-size: 8.5pt; color: #94a3b8; text-align: center; margin-top: 40px;">Document édité par la plateforme numérique • Généré le ${new Date().toLocaleDateString('fr-FR')} • Traçabilité par base de données Firestore</p>
        </div>
      </div>

      <!-- PAGE BREAK -->
      <div style="page-break-before: always;"></div>

      <!-- PAGE 2: PLANIFICATION & PLANNING -->
      <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-top: 0; font-size: 15pt;">00. Planification Temporelle & Calendrier</h2>
      
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;">
          <tr style="border: none;">
            <td style="border: none; padding: 2px; font-size: 9.5pt; width: 33%;"><strong style="color: #1e3a8a;">Avancement Physique Global :</strong> <span style="font-size: 12pt; font-weight: bold; color: #2563eb;">${p.travauxPlanification?.avancementPhysique || 0}%</span></td>
            <td style="border: none; padding: 2px; font-size: 9.5pt; width: 33%;"><strong style="color: #047857;">Avancement Génie Civil :</strong> <span style="font-size: 12pt; font-weight: bold; color: #047857;">${p.travauxPlanification?.avancementGC || 0}%</span></td>
            <td style="border: none; padding: 2px; font-size: 9.5pt; width: 33%;"><strong style="color: #7c3aed;">Avancement Mécanique :</strong> <span style="font-size: 12pt; font-weight: bold; color: #7c3aed;">${p.travauxPlanification?.avancementMeca || 0}%</span></td>
          </tr>
        </table>
      </div>

      <h3 style="color: #1e293b; font-size: 11pt; font-weight: bold; margin-bottom: 5px;">Dates Planifiées de Réalisation</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left; width: 40%;">Phase de l'Ouvrage</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left; width: 30%;">Date de Début Prévue</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left; width: 30%;">Date de Fin Prévue</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold;">01 • Phase Étude & Approuvage</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.etudeStart)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.etudeEnd)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold;">02 • Travaux de Construction & Pose</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.travauxStart)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.travauxEnd)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold;">03 • Essais Réglementaires (Résistance/Étanchéité)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.essaisStart)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.essaisEnd)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold;">04 • Mise en Gaz et Commissioning</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.gazStart)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${formatFrDate(p.planning?.gazEnd)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-top: 30px; font-size: 15pt;">01. Identité Technique & Consistance Physique</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; width: 30%; background-color: #f8fafc;"><strong style="color: #475569;">Wilaya :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.identity.wilaya || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; width: 30%; background-color: #f8fafc;"><strong style="color: #475569;">Pôle d'Appartenance :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.identity.pole || "N/A"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Direction de transport :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.identity.region || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">District d'Exploitation :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.identity.district || "N/A"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Cadre d'Inscription :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.identity.cadreInscription || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Structure Chargée :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.identity.structureChargee || "N/A"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Diamètre Conduite :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold;">${p.identity.caracteristiques?.diametre || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Longueur Linéaire :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold;">${getProjectDisplayLength(p) !== "0" ? `${getProjectDisplayLength(p)} km` : "N/A"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Pression de calcul (MOP) :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${p.identity.caracteristiques?.pression || "N/A"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Type de Conduite :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.identity.caracteristiques?.typeTuyau || "Acier revêtu"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Capacité de Poste (Débit) :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;" colspan="3">${p.identity.caracteristiques?.capacitePoste || "N/A"}</td>
        </tr>
      </table>

      <h3 style="color: #1e293b; font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 5px;">Composition & Organes Accessoires de l'Ouvrage</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: left; width: 70%;">Élément de Réseau / Organe de Sécurité</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; width: 30%;">Présence effective</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Piquage sur Conduite existante</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${p.identity.caracteristiques?.hasPiquage ? "#2563eb" : "#64748b"}">${hasPiquage}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Gare de Racleur de Départ</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${p.identity.caracteristiques?.hasGareRacleurDepart ? "#2563eb" : "#64748b"}">${hasGareDep}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Gare de Racleur d'Arrivée</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${p.identity.caracteristiques?.hasGareRacleurArrivee ? "#2563eb" : "#64748b"}">${hasGareArr}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Poste(s) de Coupure de Ligne</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${p.identity.caracteristiques?.hasPosteCoupure ? "#2563eb" : "#64748b"}">${hasCoupure}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Poste(s) de Sectionnement Intermédiaire</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${p.identity.caracteristiques?.hasPosteSectionnement ? "#2563eb" : "#64748b"}">${hasSect}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">Poste de Détente / Livraison de Gaz</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${p.identity.caracteristiques?.hasPosteDetente ? "#2563eb" : "#64748b"}">${hasDet}</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
        <h4 style="margin-top: 0; margin-bottom: 5px; color: #9f1239; font-size: 9.5pt; font-weight: bold;">🚨 Contrainte Majeure Répertoriée :</h4>
        <p style="margin: 0; font-size: 9pt; color: #be123c;">
          ${p.identity.contraintes && p.identity.contraintes.trim().length > 0 ? p.identity.contraintes : "Aucune contrainte majeure à ce jour. Le passage est libre et les accès sécurisés."}
        </p>
      </div>

      <!-- PAGE BREAK -->
      <div style="page-break-before: always;"></div>

      <!-- PAGE 3: ÉTUDE & AUTORISATIONS -->
      <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-top: 0; font-size: 15pt;">02. Section Études & Autorisations Administratives</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; width: 30%; background-color: #f8fafc;"><strong style="color: #475569;">Statut d'Approbation de l'Étude :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold; color: #1e3a8a;">${p.etudeAutorisation?.statutEtude || "En cours"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; width: 30%; background-color: #f8fafc;"><strong style="color: #475569;">Permis de Construire :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold;">
            ${p.etudeAutorisation?.statutPermisConstruire || "Non déposé"} ${p.etudeAutorisation?.datePermisConstruire ? `(reçu le ${formatFrDate(p.etudeAutorisation.datePermisConstruire)})` : ""}
          </td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Arrêté de Servitude :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">${p.etudeAutorisation?.statutArreteServitude || "Non lancé"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Référence Arrêté :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-family: monospace;">${p.etudeAutorisation?.arreteServitudeRef || "N/A"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Cabinet Expert Foncier (GEF) :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">
            ${p.etudeAutorisation?.expertiseFonciere?.gefDesignated ? `Désigné : ${p.etudeAutorisation.expertiseFonciere.gefIdentity || "N/A"}` : "Non désigné"}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Demande d'Acquisition :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt;">
            ${p.etudeAutorisation?.expertiseFonciere?.acquisitionDemandEstablished ? "Établie & En cours" : "Non établie"}
          </td>
        </tr>
      </table>

      ${ficheSuiviHtml}

      <h3 style="color: #1e293b; font-size: 11pt; font-weight: bold; margin-top: 20px; margin-bottom: 5px;">Bureau d'Études & Experts Foncier Contractés</h3>
      <div style="margin-bottom: 20px;">
        ${getContractHtml("Bureau d'Étude Technique", p.contrats?.bureauEtude)}
        ${getContractHtml("Expert Foncier Mandataire", p.contrats?.expert)}
      </div>

      <!-- PAGE BREAK -->
      <div style="page-break-before: always;"></div>

      <!-- PAGE 4: SECTION TRAVAUX -->
      <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-top: 0; font-size: 15pt;">03. Section Travaux & Entreprises de Réalisation</h2>
      
      <h3 style="color: #1e293b; font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 5px;">Entreprises de Construction (Génie Civil & Mécanique)</h3>
      <div style="margin-bottom: 15px;">
        ${getContractHtml("Entreprise Génie Civil (Pose Conduites)", p.contrats?.etbGC)}
        ${getContractHtml("Entreprise Pose Mécanique & Équipement Postes", p.contrats?.etbMeca)}
      </div>

      <h3 style="color: #1e293b; font-size: 11pt; font-weight: bold; margin-top: 20px; margin-bottom: 5px;">Contrôle Qualité & Conformité Technique</h3>
      ${qcHtml}

      <div style="background-color: #fafafa; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-top: 20px;">
        <h4 style="margin-top: 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #1e3a8a; font-size: 10pt; font-weight: bold;">🔬 Essais d'Épreuves Hydrauliques & Organisme de Contrôle</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt; width: 40%;"><strong style="color: #475569;">Organisme Contrôleur Agréé :</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt; font-weight: bold;">${p.travauxPlanification?.essaisReglementaires?.organismeControleur || "VERITAL / Autre"}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Épreuve de Résistance (Hydraulique) :</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt; font-weight: bold; color: ${p.travauxPlanification?.essaisReglementaires?.epreuveResistance === "Réussie" ? "#047857" : "#d97706"}">
              ${p.travauxPlanification?.essaisReglementaires?.epreuveResistance || "Non faite"}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt;"><strong style="color: #475569;">Épreuve d'Étanchéité (Gaz/Air sous pression) :</strong></td>
            <td style="border: 1px solid #e2e8f0; padding: 5px; font-size: 8.5pt; font-weight: bold; color: ${p.travauxPlanification?.essaisReglementaires?.epreuveEtancheite === "Réussie" ? "#047857" : "#d97706"}">
              ${p.travauxPlanification?.essaisReglementaires?.epreuveEtancheite || "Non faite"}
            </td>
          </tr>
        </table>
      </div>

      <!-- PAGE BREAK -->
      <div style="page-break-before: always;"></div>

      <!-- PAGE 5: MISE EN GAZ & ARCHIVE -->
      <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-top: 0; font-size: 15pt;">04. Mise en Gaz (Mise en Service) & Archivage</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; width: 45%; background-color: #f8fafc;"><strong style="color: #475569;">Statut Opérationnel de Mise en Gaz :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold; color: #1565c0;">${p.miseEnGazArchive?.statutMiseEnGaz || "Non planifiée"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; background-color: #f8fafc;"><strong style="color: #475569;">Date Effective de la Mise en Service :</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 8.5pt; font-weight: bold; color: #1e293b;">${formatFrDate(p.miseEnGazArchive?.dateEffectiveMiseEnGaz)}</td>
        </tr>
      </table>

      <h3 style="color: #1e293b; font-size: 11pt; font-weight: bold; margin-bottom: 5px;">Dossier As-Built / Archives Techniques Numériques</h3>
      ${docsHtml}

      <div style="margin-top: 100px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
        <table style="width: 100%; border: none; border-collapse: collapse;">
          <tr style="border: none;">
            <td style="border: none; text-align: left; font-size: 9pt; width: 50%;">
              <p style="margin: 0;"><strong style="color: #475569;">Signature du Chef de Projet :</strong></p>
              <br><br><br>
              <p style="margin: 0; font-size: 8.5pt; color: #64748b;">M. ${p.chefDeProjetName || "..................................."}</p>
            </td>
            <td style="border: none; text-align: right; font-size: 9pt; width: 50%;">
              <p style="margin: 0;"><strong style="color: #475569;">Signature de la Direction / Maître d'Ouvrage :</strong></p>
              <br><br><br>
              <p style="margin: 0; font-size: 8.5pt; color: #64748b;">Pour approbation officielle</p>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  const handlePrintFicheProjet = (project: Project) => {
    const htmlContent = generateFicheProjetHtml(project);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Fiche Projet - ${project.name}</title>
            <style>
              body { padding: 40px; font-family: 'Segoe UI', system-ui, sans-serif; background-color: #fff; color: #1e293b; line-height: 1.4; }
              table { border-collapse: collapse; width: 100%; margin-top: 12px; margin-bottom: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 8.5pt; }
              th { background-color: #f1f5f9; font-weight: bold; color: #1e293b; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .text-right { text-align: right; }
              .page-break { page-break-before: always; }
              @media print {
                .page-break { page-break-before: always; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>window.onload = function() { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      win.document.close();
    } else {
      void pdiAlert("Veuillez autoriser les popups pour pouvoir imprimer la fiche projet.");
    }
  };

  const handleExportFicheProjetWord = (project: Project) => {
    const htmlContent = generateFicheProjetHtml(project);
    downloadAsWord(htmlContent, `Fiche_Projet_${project.name.replace(/\s+/g, "_")}.doc`);
  };

  const handleExportFicheProjetPDF = async (project: Project) => {
    const htmlContent = generateFicheProjetHtml(project);
    
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "-9999px";
    tempDiv.style.width = "800px";
    tempDiv.style.padding = "30px";
    tempDiv.style.backgroundColor = "#ffffff";
    tempDiv.style.color = "#1e293b";
    tempDiv.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    
    tempDiv.innerHTML = `
      <style>
        table { border-collapse: collapse; width: 100%; margin-top: 15px; margin-bottom: 15px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 8.5pt; }
        th { background-color: #f1f5f9; font-weight: bold; color: #1e293b; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-right { text-align: right; }
        h1, h2, h3, h4 { color: #1e3a8a; }
      </style>
      ${htmlContent}
    `;
    
    document.body.appendChild(tempDiv);
    
    try {
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
      
      pdf.save(`Fiche_Projet_${project.name.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      void pdiAlert("Une erreur est survenue lors de la génération du PDF.");
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

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
          const newContractKeyObj = {
            ...((lContrats as any)[contractKey] || emptyContractObj),
            [field]: value
          };
          const updatedLContrats = {
            ...lContrats,
            [contractKey]: newContractKeyObj
          };

          const avGC = contractKey === 'etbGC' && field === 'avancement' ? Number(value) : ((updatedLContrats as any).etbGC?.avancement ?? l.avancementGC ?? 0);
          const avMeca = contractKey === 'etbMeca' && field === 'avancement' ? Number(value) : ((updatedLContrats as any).etbMeca?.avancement ?? l.avancementMeca ?? 0);
          const avPhys = Math.round((avGC + avMeca) / 2);

          return {
            ...l,
            avancementGC: avGC,
            avancementMeca: avMeca,
            avancementPhysique: avPhys,
            contrats: updatedLContrats
          };
        }
        return l;
      });

      const totalLength = updatedLots.reduce((sum, l) => sum + (parseFloat(l.longueur || "0") || 1), 0);
      let weightedGC = 0, weightedMeca = 0, weightedPhys = 0;
      updatedLots.forEach(l => {
        const w = (parseFloat(l.longueur || "0") || 1) / totalLength;
        weightedGC += (l.avancementGC || 0) * w;
        weightedMeca += (l.avancementMeca || 0) * w;
        weightedPhys += (l.avancementPhysique || 0) * w;
      });

      updatePayload.travauxPlanification = {
        ...(selectedProject.travauxPlanification || {}),
        avancementGC: Math.round(weightedGC),
        avancementMeca: Math.round(weightedMeca),
        avancementPhysique: Math.round(weightedPhys)
      };

      updatePayload.lots = updatedLots;
    } else {
      const avGC = contractKey === 'etbGC' && field === 'avancement' ? Number(value) : ((updatedContrats as any).etbGC?.avancement || 0);
      const avMeca = contractKey === 'etbMeca' && field === 'avancement' ? Number(value) : ((updatedContrats as any).etbMeca?.avancement || 0);
      updatePayload.travauxPlanification = {
        ...(selectedProject.travauxPlanification || {}),
        avancementGC: avGC,
        avancementMeca: avMeca,
        avancementPhysique: Math.round((avGC + avMeca) / 2)
      };
    }

    try {
      await setDoc(doc(db, "projects", selectedProject.id), updatePayload, { merge: true });
    } catch (err) {
      console.error("Error updating contract field:", err);
    }
  };

  const generateGenesisHtml = (p: Project): string => {
    const milestones = getGenesisMilestones(p);
    let html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 3px solid #e30613; padding-bottom: 15px; margin-bottom: 25px;">
          <h1 style="color: #004d9a; margin: 0; font-size: 22pt; font-weight: bold; text-transform: uppercase;">PD&I</h1>
          <h2 style="color: #475569; margin: 5px 0 0 0; font-size: 14pt; font-weight: bold;">Genèse & Chronologie de l'Ouvrage</h2>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 30px;">
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tr style="border: none;">
              <td style="border: none; font-weight: bold; color: #64748b; font-size: 10pt; width: 25%; padding: 4px 0;">Ouvrage :</td>
              <td style="border: none; font-weight: bold; color: #0f172a; font-size: 11pt; padding: 4px 0;">${p.name}</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; font-weight: bold; color: #64748b; font-size: 10pt; padding: 4px 0;">Wilaya / Pôle :</td>
              <td style="border: none; color: #334155; font-size: 10pt; padding: 4px 0;">${p.identity?.wilaya || 'N/A'} / ${p.identity?.pole || 'N/A'}</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; font-weight: bold; color: #64748b; font-size: 10pt; padding: 4px 0;">Direction de Région :</td>
              <td style="border: none; color: #334155; font-size: 10pt; padding: 4px 0;">${p.identity?.region || 'N/A'}</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; font-weight: bold; color: #64748b; font-size: 10pt; padding: 4px 0;">Phase Actuelle :</td>
              <td style="border: none; color: #334155; font-size: 10pt; padding: 4px 0;">
                <span style="background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 6px; padding: 2px 8px; font-size: 9pt; font-weight: bold;">
                  ${p.identity?.phase || 'N/A'}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <h3 style="color: #004d9a; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 20px; font-size: 14pt; font-weight: bold;">
          Étapes Chronologiques (Timeline)
        </h3>
    `;

    milestones.forEach((m: any, idx: number) => {
      const isCompleted = m.status === "completed";
      const isCurrent = m.status === "current";
      const statusLabel = isCompleted ? "Validé" : (isCurrent ? "En cours" : "En attente");
      const statusColor = isCompleted ? "#16a34a" : (isCurrent ? "#2563eb" : "#64748b");
      const statusBg = isCompleted ? "#f0fdf4" : (isCurrent ? "#eff6ff" : "#f8fafc");
      const statusBorder = isCompleted ? "#bbf7d0" : (isCurrent ? "#bfdbfe" : "#e2e8f0");

      html += `
        <div style="margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #f1f5f9; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">
            <table style="width: 100%; border: none; border-collapse: collapse;">
              <tr style="border: none;">
                <td style="border: none; font-size: 11pt; font-weight: bold; color: #1e3a8a; padding: 0;">
                  ${idx + 1}. ${m.title}
                </td>
                <td style="border: none; text-align: right; padding: 0;">
                  <span style="background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; border-radius: 6px; padding: 2px 8px; font-size: 8.5pt; font-weight: bold;">
                    ${statusLabel} ${m.date && m.date !== "Non renseignée" ? ` - Le ${formatDateFrench(m.date)}` : ''}
                  </span>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding: 15px;">
            <p style="margin: 0 0 12px 0; font-size: 9.5pt; color: #475569; line-height: 1.5; font-style: italic;">
              ${m.description}
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 8.5pt; text-align: left; font-weight: bold; color: #475569; width: 40%;">Indicateur / Attribut</th>
                  <th style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 8.5pt; text-align: left; font-weight: bold; color: #475569;">Valeur Enregistrée</th>
                </tr>
              </thead>
              <tbody>
      `;

      m.details.forEach((det: any) => {
        const hasVal = det.value && det.value !== "Non renseignée" && det.value !== "Non spécifiée" && det.value !== "Non défini" && det.value !== "Non définie" && det.value !== "Non lancée" && det.value !== "Non déposé" && det.value !== "Non déposée" && det.value !== "Non obtenue" && det.value !== "Non désigné";
        const displayVal = hasVal ? det.value : "Non renseigné (N/A)";
        html += `
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 9pt; color: #64748b; font-weight: bold;">${det.label}</td>
            <td style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 9pt; color: #0f172a; font-weight: ${hasVal ? 'bold' : 'normal'};">${displayVal}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    html += `
        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 10px;">
          <p style="font-size: 8pt; color: #94a3b8; margin: 0;">Rapport d'avancement généré automatiquement • Direction Technique &amp; Projets PD&amp;I</p>
        </div>
      </div>
    `;
    return html;
  };

  const handleExportGenesisWord = (project: Project) => {
    const htmlContent = generateGenesisHtml(project);
    downloadAsWord(htmlContent, `Genese_Projet_${project.name.replace(/\s+/g, "_")}.doc`);
  };

  const handleExportGenesisPDF = async (project: Project) => {
    const htmlContent = generateGenesisHtml(project);
    
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "-9999px";
    tempDiv.style.width = "800px";
    tempDiv.style.padding = "30px";
    tempDiv.style.backgroundColor = "#ffffff";
    tempDiv.style.color = "#1e293b";
    tempDiv.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    
    tempDiv.innerHTML = `
      <style>
        table { border-collapse: collapse; width: 100%; margin-top: 15px; margin-bottom: 15px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 8.5pt; }
        th { background-color: #f1f5f9; font-weight: bold; color: #1e293b; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-right { text-align: right; }
        h1, h2, h3, h4 { color: #1e3a8a; }
      </style>
      ${htmlContent}
    `;
    
    document.body.appendChild(tempDiv);
    
    try {
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
      
      pdf.save(`Genese_Projet_${project.name.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error exporting Genesis PDF:", error);
      void pdiAlert("Une erreur est survenue lors de la génération du PDF.");
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  // Upload custom KML/KMZ file for a project
  const handleUploadKMZ = async (e: React.ChangeEvent<HTMLInputElement>, project: Project) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canEditProject(project)) {
      void pdiAlert("Accès refusé: Vous n'avez pas le privilège de modification pour cet ouvrage (Projet non pris en charge ou compte en lecture seule).");
      return;
    }

    if (file.size > 800 * 1024) {
      void pdiAlert("Le fichier est trop volumineux. La taille maximale autorisée est de 800 Ko.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      try {
        const projectRef = doc(db, "projects", project.id);
        const updatedProject = {
          ...project,
          identity: {
            ...project.identity,
            kmzFileName: file.name,
            kmzFileData: result
          }
        };
        // Remove id from document body before setDoc
        delete (updatedProject as any).id;

        await setDoc(projectRef, updatedProject);
        void pdiAlert(`Le fichier ${file.name} a été chargé avec succès !`);
      } catch (err) {
        console.error("Error uploading KML/KMZ:", err);
        void pdiAlert("Une erreur s'est produite lors de l'enregistrement du fichier.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Delete custom KML/KMZ file and revert to auto-generated KML
  const handleDeleteKMZ = async (project: Project) => {
    if (!canEditProject(project)) {
      void pdiAlert("Accès refusé: Vous n'avez pas le privilège de modification pour cet ouvrage (Projet non pris en charge ou compte en lecture seule).");
      return;
    }
    const confirmDelete = window.confirm(
      "Êtes-vous sûr de vouloir supprimer le fichier KMZ/KML personnalisé ? Le système utilisera à nouveau le tracé automatique."
    );
    if (!confirmDelete) return;

    try {
      const projectRef = doc(db, "projects", project.id);
      const updatedProject = {
        ...project,
        identity: {
          ...project.identity,
          kmzFileName: "",
          kmzFileData: "",
          kmzUrl: ""
        }
      };
      // Remove id from document body before setDoc
      delete (updatedProject as any).id;

      await setDoc(projectRef, updatedProject);
      void pdiAlert("Le fichier KMZ/KML personnalisé a été supprimé. Retour au tracé automatique.");
    } catch (err) {
      console.error("Error deleting KML/KMZ:", err);
      void pdiAlert("Une erreur s'est produite lors de la suppression du fichier.");
    }
  };



  return {
    handleDownloadKMZ,
    handlePrintPlanDeCharge,
    handleExportPlanDeChargeWord,
    handleExportPlanDeChargePDF,
    handleExportActivePanePDF,
    handlePrintFicheProjet,
    handleExportFicheProjetWord,
    handleExportFicheProjetPDF,
    handleExportGenesisWord,
    handleExportGenesisPDF,
    handleUploadKMZ,
    handleDeleteKMZ,
  };
}
