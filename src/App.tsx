import React from "react";
import PdiUnifiedApp from "./pdi/app/PdiUnifiedApp";
import { PdiSecondaryWorkspaceApp } from "./pdi/workspace/PdiSecondaryWorkspaceApp";

export default function App() {
  const isSecondary = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pdi_workspace") === "secondary";

  if (isSecondary) {
    return <PdiSecondaryWorkspaceApp />;
  }

  return <PdiUnifiedApp />;
}

