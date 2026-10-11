import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  CornerDownLeft,
  X,
  Copy,
  Clipboard,
  Square,
  Triangle,
  Hexagon,
  Disc3,
  Move,
  Trash2,
  Maximize2,
  SlidersHorizontal,
  ChevronUp,
  Check,
  Slash,
  Spline,
  Circle,
  Type,
  Ruler,
  Undo2,
  Redo2,
  LayoutGrid,
  SplitSquareVertical,
  Monitor,
} from "lucide-react";
import { AUTOCAD_COMMANDS, searchCadCommands, CadCommandItem } from "../engine/CadAutocadEngine";

export interface CadCommandLineBarProps {
  input: string;
  setInput: (v: string) => void;
  prompt: string;
  onExecuteCommand: (cmdString: string) => void;
  cadDraftSession: any | null;
  onCancelDraft: () => void;
  onApplyNumericInput?: (val1: number, val2?: number) => void;
  onSelectCommandByName?: (cmdId: string) => void;
  className?: string;
}

export const CadCommandLineBar: React.FC<CadCommandLineBarProps> = ({
  input,
  setInput,
  prompt,
  onExecuteCommand,
  cadDraftSession,
  onCancelDraft,
  onApplyNumericInput,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [numericVal1, setNumericVal1] = useState<string>("");
  const [numericVal2, setNumericVal2] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // PATCH 017C : la liste ne doit jamais etre vide quand l utilisateur tape.
  // Si aucune commande du catalogue ne correspond, on propose l execution
  // directe de la saisie, comme dans AutoCAD.
  const catalogMatches = input.trim().length > 0 ? searchCadCommands(input) : searchCadCommands("");
  const rawFallback: CadCommandItem[] =
    input.trim().length > 0 && catalogMatches.length === 0
      ? [{
          id: "__pdi_raw__",
          name: input.trim().toUpperCase(),
          aliases: [],
          description: "Exécuter cette saisie comme commande PD&I",
          category: "Direct",
          shortcut: "Entrée",
          icon: "Terminal",
        } as CadCommandItem]
      : [];
  const suggestions = catalogMatches.length > 0 ? catalogMatches : rawFallback;

  // PATCH 016B global escape : Echap ferme toujours la liste de commandes.
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowSuggestions(false);
      setSelectedIndex(0);
      setInput("");
      if (cadDraftSession) onCancelDraft();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [cadDraftSession]);

  useEffect(() => {
    setSelectedIndex(0);
    if (input.trim().length > 0) {
      setShowSuggestions(true);
    }
  }, [input]);

  // Reset numeric inputs when session changes
  useEffect(() => {
    setNumericVal1("");
    setNumericVal2("");
  }, [cadDraftSession?.tool, cadDraftSession?.step]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // If drafting session is waiting for numeric input
    if (cadDraftSession && (numericVal1.trim() || numericVal2.trim())) {
      const v1 = parseFloat(numericVal1);
      const v2 = numericVal2 ? parseFloat(numericVal2) : undefined;
      if (!isNaN(v1) && onApplyNumericInput) {
        onApplyNumericInput(v1, v2);
        setNumericVal1("");
        setNumericVal2("");
        return;
      }
    }

    const trimmed = input.trim();
    if (!trimmed) {
      if (suggestions.length > 0 && showSuggestions) {
        runCommandItem(suggestions[selectedIndex] || suggestions[0]);
      }
      return;
    }

    if (showSuggestions && suggestions.length > 0) {
      const target = suggestions[selectedIndex] || suggestions[0];
      runCommandItem(target);
    } else {
      setHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 10));
      onExecuteCommand(trimmed);
      setInput("");
      setShowSuggestions(false);
    }
  };

  const runCommandItem = (cmd: CadCommandItem) => {
    // PATCH 017C : la ligne de repli execute la saisie complete (arguments inclus).
    const payload = cmd.id === "__pdi_raw__" ? input.trim() : cmd.name;
    setHistory((prev) => [payload, ...prev.filter((h) => h !== payload)].slice(0, 10));
    onExecuteCommand(payload);
    setInput("");
    setShowSuggestions(false);
    if (inputRef.current) inputRef.current.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, suggestions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % Math.max(1, suggestions.length));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
      setInput("");
      if (cadDraftSession) {
        onCancelDraft();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length > 0) {
        const top = suggestions[selectedIndex] || suggestions[0];
        setInput(top.name);
      }
    }
  };

  const getCommandIcon = (iconName: string) => {
    switch (iconName) {
      case "Copy": return <Copy className="w-3.5 h-3.5 text-cyan-400" />;
      case "Clipboard": return <Clipboard className="w-3.5 h-3.5 text-emerald-400" />;
      case "Square": return <Square className="w-3.5 h-3.5 text-amber-400" />;
      case "Triangle": return <Triangle className="w-3.5 h-3.5 text-orange-400" />;
      case "Hexagon": return <Hexagon className="w-3.5 h-3.5 text-purple-400" />;
      case "Disc3": return <Disc3 className="w-3.5 h-3.5 text-sky-400" />;
      case "Move": return <Move className="w-3.5 h-3.5 text-blue-400" />;
      case "Trash2": return <Trash2 className="w-3.5 h-3.5 text-red-400" />;
      case "Maximize2": return <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />;
      case "Slash": return <Slash className="w-3.5 h-3.5 text-slate-400" />;
      case "Spline": return <Spline className="w-3.5 h-3.5 text-teal-400" />;
      case "Circle": return <Circle className="w-3.5 h-3.5 text-yellow-400" />;
      case "Type": return <Type className="w-3.5 h-3.5 text-pink-400" />;
      case "Ruler": return <Ruler className="w-3.5 h-3.5 text-lime-400" />;
      case "Undo2": return <Undo2 className="w-3.5 h-3.5 text-rose-400" />;
      case "Redo2": return <Redo2 className="w-3.5 h-3.5 text-cyan-400" />;
      case "LayoutGrid": return <LayoutGrid className="w-3.5 h-3.5 text-cyan-300" />;
      case "SplitSquareVertical": return <SplitSquareVertical className="w-3.5 h-3.5 text-cyan-400" />;
      case "Monitor": return <Monitor className="w-3.5 h-3.5 text-cyan-400" />;
      default: return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className={`pdi-cad-command-wrapper relative select-none ${className}`}>
      {/* Suggestions Dropdown - Positionné à droite au-dessus du champ de saisie pour ne pas chevaucher les onglets projet */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full right-0 mb-2 w-[480px] max-w-[calc(100vw-380px)] min-w-[320px] bg-slate-900/98 backdrop-blur-md border border-cyan-500/50 rounded-xl shadow-2xl overflow-hidden z-[10090] animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Terminal className="w-3 h-3" />
              COMMANDES AUTOCAD DISPONIBLES ({suggestions.length})
            </span>
            <span>Entrée pour valider &bull; &uarr;&darr; pour naviguer &bull; Échap pour fermer</span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 p-1">
            {suggestions.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => runCommandItem(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected ? "bg-cyan-950/90 text-white border border-cyan-500/50 shadow-inner" : "hover:bg-slate-800/70 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1 rounded bg-slate-800/80 border border-slate-700/60 shrink-0">
                      {getCommandIcon(cmd.icon)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-cyan-300 tracking-wider">
                          {cmd.name}
                        </span>
                        {cmd.aliases.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            [{cmd.aliases.join(", ")}]
                          </span>
                        )}
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {cmd.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {cmd.description}
                      </div>
                    </div>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-cyan-300 shrink-0 font-bold">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Command Bar Container - Compact Slim 34px */}
      <div className="bg-slate-950/95 backdrop-blur border border-cyan-500/40 rounded-xl px-2 py-1 shadow-lg flex items-center gap-2">
        {/* PATCH 017I3 : retour de commande permanent. Auparavant le prompt
            n etait affiche que pendant une session de dessin, donc toute
            commande qui repond par un texte restait muette. */}
        {!cadDraftSession && prompt && (
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg shrink-0 max-w-[42%]"
            title={prompt}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
            <span className="text-slate-200 truncate font-semibold text-[10px] font-mono">
              {prompt}
            </span>
          </div>
        )}

        {/* Dynamic prompt and active session indicator */}
        {cadDraftSession && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span className="text-cyan-300 font-bold shrink-0 text-[10px]">
              {`[${cadDraftSession.tool.toUpperCase()}]`}
            </span>
            <span className="text-slate-200 truncate font-semibold text-[10px] max-w-[140px]">
              {prompt || "En cours..."}
            </span>
            <button
              type="button"
              onClick={onCancelDraft}
              className="px-1 py-0.5 rounded bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-[9px] font-bold ml-1"
              title="Annuler (Échap)"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        {/* Input & Form Controls */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 min-w-0">
          {/* AutoCAD Prompt Label */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/90 border border-slate-800 rounded-lg text-cyan-400 font-mono text-[10px] font-black shrink-0">
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span>CMD &gt;</span>
          </div>

          {/* Text Input */}
          <div className="flex-1 min-w-[140px] relative">
            <input
              ref={inputRef}
              id="cad-command-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder={
                cadDraftSession
                  ? "Saisir une valeur ou cliquer sur le dessin..."
                  : "Tapez une commande (ex: WORKSPACE, CAST, TUBE, DEPLACER...)"
              }
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 font-mono outline-none transition-colors h-7"
            />
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput("");
                  setShowSuggestions(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Numeric Direct Input for CAD Drawing session */}
          {cadDraftSession && (
            <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-cyan-600/40 shrink-0">
              <span className="text-[9px] font-mono text-cyan-300 font-bold">
                {cadDraftSession.tool === "rectangle" ? "L/l:" : "Val:"}
              </span>
              <input
                type="number"
                step="0.1"
                placeholder={cadDraftSession.tool === "rectangle" ? "L" : "Dim"}
                value={numericVal1}
                onChange={(e) => setNumericVal1(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-cyan-200 font-mono outline-none text-right h-5"
              />
              {cadDraftSession.tool === "rectangle" && (
                <input
                  type="number"
                  step="0.1"
                  placeholder="l"
                  value={numericVal2}
                  onChange={(e) => setNumericVal2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-cyan-200 font-mono outline-none text-right h-5"
                />
              )}
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="px-1.5 py-0.5 bg-cyan-600 hover:bg-cyan-500 rounded text-white text-[9px] font-bold"
                title="Valider"
              >
                <Check className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 shadow transition-colors cursor-pointer shrink-0 h-7"
          >
            <span>ENTRÉE</span>
            <CornerDownLeft className="w-2.5 h-2.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
