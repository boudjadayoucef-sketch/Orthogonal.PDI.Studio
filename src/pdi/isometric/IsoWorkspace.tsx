/**
 * ISO Workspace Bridge & Foundation
 * Wraps and exposes the canonical V4.8d engine with professional ISO drafting contracts
 */

import React from "react";
import IsometrieModule from "./engine/IsometrieModuleV48d";

export interface IsoWorkspaceProps {
  initialProjectId?: string;
  readOnly?: boolean;
}

export const IsoWorkspace: React.FC<IsoWorkspaceProps> = () => {
  return (
    <div
      className="pdi-iso-workspace-root w-full h-full min-h-screen overflow-hidden relative"
      data-iso-workspace="v4.8d-pro"
    >
      <IsometrieModule />
    </div>
  );
};

export default IsoWorkspace;
