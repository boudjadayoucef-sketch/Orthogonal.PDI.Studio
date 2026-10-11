/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COPYRIGHT (C) 2026 ORTHOGONAL - ENG. ALL RIGHTS RESERVED.
 * PROPRIETARY INDUSTRIAL PIPING CAD & ISOMETRIC ENGINE.
 * COMMAND DOCK UI COMPONENT.
 */

import React from "react";
import { CadCommandLineBar } from "../components/CadCommandLineBar";
import { CadDraftSession } from "../types/isoGraphTypes";

export interface IsoCommandDockProps {
  hidden: boolean;
  modalOpen: boolean;
  cmdInput: string;
  setCmdInput: (input: string) => void;
  prompt: string;
  onExecuteCommand: (cmd: string) => void;
  cadDraftSession: CadDraftSession | null;
  onCancelDraft: () => void;
  onApplyNumericInput: (value: number) => void;
  panelOffset?: string;
}

export const IsoCommandDock: React.FC<IsoCommandDockProps> = ({
  hidden,
  modalOpen,
  cmdInput,
  setCmdInput,
  prompt,
  onExecuteCommand,
  cadDraftSession,
  onCancelDraft,
  onApplyNumericInput,
  panelOffset = "60px",
}) => {
  if (hidden || modalOpen) return null;

  return (
    <div
      style={{ left: panelOffset }}
      className="pdi-cmd-dock-017d fixed right-4 bottom-2.5 z-[10080] rounded-xl border border-cyan-500/50 bg-[#09090B]/98 shadow-2xl backdrop-blur-md px-3 py-1.5 flex items-center gap-2 transition-all duration-200"
    >
      <div className="flex-1 min-w-0">
        <CadCommandLineBar
          input={cmdInput}
          setInput={setCmdInput}
          prompt={prompt}
          onExecuteCommand={onExecuteCommand}
          cadDraftSession={cadDraftSession}
          onCancelDraft={onCancelDraft}
          onApplyNumericInput={onApplyNumericInput}
        />
      </div>
    </div>
  );
};
