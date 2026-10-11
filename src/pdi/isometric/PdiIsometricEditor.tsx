// PD&I PATCH 007d — wrapper locks ISO as primary fullscreen workspace
// PD&I PATCH 007c — wrapper used as primary ISO workspace by unified shell
// PD&I PATCH 007b — wrapper keeps ISO embedded inside SaaS shell
// PD&I PATCH 007a — ISO workspace embedded in global SaaS shell
/**
 * PD&I — Éditeur isométrique principal
 *
 * PATCH 006
 *
 * Le moteur V4.8d est volontairement conservé intact.
 * Ce composant ne fait qu'exposer directement son workspace.
 */

import React from "react";
import IsometrieModule from "./engine/IsometrieModuleV48d";

// PATCH 017F1 : le wrapper transmet le projet de l onglet actif au moteur.
export default function PdiIsometricEditor(props: { projectId?: string }) {
  return (
    <div
      className="pdi-v48d-primary-workspace pdi-isometric-primary-lock pdi-isometric-embedded pdi-isometric-primary-lock pdi-isometric-embedded pdi-isometric-primary-lock"
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <IsometrieModule projectId={props.projectId} />
    </div>
  );
}
