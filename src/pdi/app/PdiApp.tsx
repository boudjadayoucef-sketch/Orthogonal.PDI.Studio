// PD&I PATCH 005 — Interface logiciel professionnelle française
import React, { useState } from "react";
import PdiIsometricEditor from "../isometric/PdiIsometricEditor";
import PdiBrandMark from "./PdiBrandMark";

type Mode = "conception" | "donnees" | "controle";
type Workspace = "accueil" | "projets" | "isometries" | "cad" | "ia";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "conception", label: "CONCEPTION" },
  { id: "donnees", label: "DONNÉES" },
  { id: "controle", label: "CONTRÔLE" },
];

const WORKSPACES: Array<{ id: Workspace; label: string; hint: string }> = [
  { id: "accueil", label: "Accueil", hint: "Vue générale du projet" },
  { id: "projets", label: "Projets", hint: "Gestion des projets" },
  { id: "isometries", label: "Isométries", hint: "Éditeur isométrique V4.8d" },
  { id: "cad", label: "CAO / JSON", hint: "Échanges de données" },
  { id: "ia", label: "IA", hint: "Assistance ingénierie" },
];

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full min-h-[620px] flex-col bg-[#11151a] text-slate-100">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400">PD&I</div>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{text}</p>
      </div>
      <div className="grid flex-1 place-items-center p-8">
        <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-[#171c22] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-cyan-400">PD</div>
          <div className="text-sm font-medium text-slate-200">Espace prêt pour la prochaine étape</div>
          <div className="mt-2 text-xs leading-5 text-slate-500">
            Cette étape concerne uniquement l’interface. Les fonctions d’ingénierie seront ajoutées par patches dédiés.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PdiApp() {
  const [mode, setMode] = useState<Mode>("conception");
  const [workspace, setWorkspace] = useState<Workspace>("accueil");
  const [accountOpen, setAccountOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openWorkspace = (id: Workspace) => {
    setWorkspace(id);
    setCommandOpen(false);
  };

  return (
    <div className="flex h-screen min-h-[680px] flex-col overflow-hidden bg-[#0c0f12] font-sans text-slate-100">
      {/* Barre de titre logiciel */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-[#0d1014] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => openWorkspace("accueil")}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-800"
            title="Accueil PD&I"
          >
            <PdiBrandMark className="pdi-shell-brand-single" variant="horizontal" size="sm" />
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-4">PD&I</span>
              <span className="block text-[9px] uppercase tracking-wider text-slate-600">Piping Design & Isometrics</span>
            </span>
          </button>
          <span className="hidden text-slate-700 sm:inline">|</span>
          <span className="hidden text-xs text-slate-500 md:inline">Projet : Nouveau projet</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommandOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 md:flex"
          >
            <span>Rechercher une commande…</span><kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px]">Ctrl+K</kbd>
          </button>
          <span className="rounded-full border border-slate-800 px-2.5 py-1 text-[10px] text-slate-500">Essai</span>
          <div className="relative">
            <button onClick={() => setAccountOpen((v) => !v)} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs hover:bg-slate-800">
              Compte
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-slate-700 bg-[#171c22] p-1.5 shadow-2xl">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-600">Espace utilisateur</div>
                {['Profil', 'Organisation', 'Licence'].map((item) => (
                  <button key={item} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800">{item}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Ruban principal */}
      <div className="flex h-11 shrink-0 items-center border-b border-slate-800 bg-[#12161b] px-3">
        <div className="flex h-full items-center gap-1">
          {MODES.map((item) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`h-8 rounded-md px-4 text-[10px] font-semibold tracking-wide transition ${mode === item.id ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="ml-auto hidden items-center gap-1 md:flex">
          <button className="rounded-md px-2.5 py-1.5 text-[10px] text-slate-500 hover:bg-slate-800">Annuler</button>
          <button className="rounded-md px-2.5 py-1.5 text-[10px] text-slate-500 hover:bg-slate-800">Rétablir</button>
          <span className="mx-2 h-5 w-px bg-slate-800" />
          <span className="text-[10px] text-slate-600">V4.8d</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Rail gauche */}
        <aside className="flex w-14 shrink-0 flex-col items-center border-r border-slate-800 bg-[#0e1216] py-2">
          {WORKSPACES.map((item) => {
            const active = workspace === item.id;
            return (
              <button
                key={item.id}
                onClick={() => openWorkspace(item.id)}
                title={item.hint}
                className={`group mb-1 flex w-12 flex-col items-center rounded-md py-2 transition ${active ? "bg-cyan-500/10 text-cyan-300" : "text-slate-600 hover:bg-slate-800 hover:text-slate-300"}`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-md border text-[9px] font-semibold ${active ? "border-cyan-500/30 bg-cyan-500/10" : "border-slate-800 bg-slate-900"}`}>
                  {item.id === "accueil" ? "⌂" : item.id === "projets" ? "PR" : item.id === "isometries" ? "ISO" : item.id === "cad" ? "DX" : "IA"}
                </span>
                <span className="mt-1 hidden text-[8px] leading-3 group-hover:block">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Zone de travail */}
        <main className="min-w-0 flex-1 overflow-hidden">
          {workspace === "isometries" ? (
            <div className="h-full overflow-hidden">
              <PdiIsometricEditor />
            </div>
          ) : workspace === "accueil" ? (
            <Placeholder title="Espace de travail" text="Un environnement professionnel pour concevoir, vérifier et gérer vos projets de tuyauterie et vos isométries." />
          ) : workspace === "projets" ? (
            <Placeholder title="Projets" text="Centralisez vos projets de tuyauterie et préparez leur gestion collaborative." />
          ) : workspace === "cad" ? (
            <Placeholder title="CAO / JSON" text="L’espace d’échange entre le modèle de tuyauterie et les formats CAO/JSON sera connecté dans un patch dédié." />
          ) : (
            <Placeholder title="Intelligence artificielle" text="L’espace IA accueillera les assistants de reconnaissance, de contrôle et de génération du modèle de tuyauterie." />
          )}
        </main>
      </div>

      {/* Barre d'état */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-slate-800 bg-[#0b0e11] px-3 text-[9px] text-slate-600">
        <div className="flex items-center gap-4">
          <span className="text-emerald-500">● Système prêt</span>
          <span>Mode : {MODES.find((m) => m.id === mode)?.label}</span>
          <span>Projet : Nouveau projet</span>
        </div>
        <div className="flex items-center gap-4">
          <span>PD&I V4.8d</span>
          <span>Français</span>
        </div>
      </footer>

      {/* Palette de commandes */}
      {commandOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-24" onMouseDown={() => setCommandOpen(false)}>
          <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-[#151a20] p-2 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-800 px-3 py-3 text-xs text-slate-500">Palette de commandes</div>
            <div className="p-1">
              {WORKSPACES.map((item) => (
                <button key={item.id} onClick={() => openWorkspace(item.id)} className="w-full rounded-lg px-3 py-3 text-left hover:bg-slate-800">
                  <div className="text-sm text-slate-200">Ouvrir {item.label}</div>
                  <div className="mt-0.5 text-[10px] text-slate-600">{item.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
