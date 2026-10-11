import React from 'react';
import { Clock } from 'lucide-react';
import { Project } from '../../types';

export interface PlanningTabProps {
  selectedProject: Project;
}

export function PlanningTab({ selectedProject: proj }: PlanningTabProps) {
  // Helper to parse dates and render the beginning-to-end horizontal visual Gantt block
  const calculateDurationDays = (start: string, end: string) => {
    const s = new Date(start || Date.now());
    const e = new Date(end || Date.now());
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  };

  // Global project span date calculations for visual percentage width scaling
  const getGlobalProjectBoundary = (proj: Project) => {
    const dates = [
      new Date(proj.planning.etudeStart),
      new Date(proj.planning.etudeEnd),
      new Date(proj.planning.travauxStart),
      new Date(proj.planning.travauxEnd),
      new Date(proj.planning.essaisStart),
      new Date(proj.planning.essaisEnd),
      new Date(proj.planning.gazStart),
      new Date(proj.planning.gazEnd)
    ].filter(d => !isNaN(d.getTime()));

    if (dates.length === 0) return { min: Date.now(), max: Date.now() + 1000 * 60 * 60 * 24 * 30 };
    const min = Math.min(...dates.map(d => d.getTime()));
    const max = Math.max(...dates.map(d => d.getTime()));
    return { min, max };
  };

  const { min, max } = getGlobalProjectBoundary(proj);
  const totalSpan = max - min || 1;

  const phases = [
    { key: "Étude", start: proj.planning.etudeStart, end: proj.planning.etudeEnd, color: "bg-blue-500", text: "Étude & Autorisations", textCol: "text-blue-700" },
    { key: "Travaux", start: proj.planning.travauxStart, end: proj.planning.travauxEnd, color: "bg-orange-500", text: "Travaux de Pose & Génie Civil", textCol: "text-orange-700" },
    { key: "Essais", start: proj.planning.essaisStart, end: proj.planning.essaisEnd, color: "bg-yellow-500", text: "Essais & Épreuves Réglementaires", textCol: "text-yellow-700" },
    { key: "Mise en Gaz", start: proj.planning.gazStart, end: proj.planning.gazEnd, color: "bg-green-500", text: "Mise en Gaz & Réception", textCol: "text-green-700" },
  ];

  return (
    <div className="space-y-6 bg-slate-900 text-white rounded-2xl p-6 border border-slate-800">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Phase 00 • Calendrier d'Exécution</span>
          <h4 className="font-extrabold text-base">Planification Graphique (Début / Fin)</h4>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Clock className="w-4 h-4 text-orange-500" />
          <span>Période globale : {new Date(min).toLocaleDateString("fr-FR")} au {new Date(max).toLocaleDateString("fr-FR")}</span>
        </div>
      </div>

      {/* Visual Timetable Grid */}
      <div className="space-y-4 pt-2">
        {phases.map((ph, idx) => {
          const startMs = new Date(ph.start).getTime();
          const endMs = new Date(ph.end).getTime();
          const days = calculateDurationDays(ph.start, ph.end);

          // Compute percentage positions
          const leftPercent = Math.max(0, Math.min(95, ((startMs - min) / totalSpan) * 100));
          const widthPercent = Math.max(5, Math.min(100 - leftPercent, ((endMs - startMs) / totalSpan) * 100));

          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${ph.color}`} />
                  <span className="text-white">{ph.text}</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-md font-mono text-orange-400">{days} Jours</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {new Date(ph.start).toLocaleDateString("fr-FR")} — {new Date(ph.end).toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/* Progress bar line */}
              <div className="h-6 w-full bg-slate-950 rounded-lg relative overflow-hidden border border-slate-800">
                <div
                  className={`absolute top-0 bottom-0 ${ph.color} rounded-md shadow-lg transition-all duration-500 flex items-center justify-center`}
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                >
                  <span className="text-[9px] font-black tracking-wider uppercase drop-shadow px-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {ph.key}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Key explanations */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/60 text-[11px] text-slate-400">
        <div className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
          <span className="text-blue-500 mt-0.5">⬤</span>
          <div>
            <p className="font-bold text-white uppercase tracking-wider text-[9px]">Étape 1 : Études</p>
            <p>Tracé, permis de construire et arrêtés d'occupation.</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
          <span className="text-orange-500 mt-0.5">⬤</span>
          <div>
            <p className="font-bold text-white uppercase tracking-wider text-[9px]">Étape 2 : Travaux</p>
            <p>Fouille, cintrage, soudage, enrobage et pose.</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
          <span className="text-yellow-500 mt-0.5">⬤</span>
          <div>
            <p className="font-bold text-white uppercase tracking-wider text-[9px]">Étape 3 : Épreuves</p>
            <p>Essais sous pression (résistance & étanchéité).</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
          <span className="text-green-500 mt-0.5">⬤</span>
          <div>
            <p className="font-bold text-white uppercase tracking-wider text-[9px]">Étape 4 : Mise en Gaz</p>
            <p>Purges, injection de gaz et livraison définitive.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
