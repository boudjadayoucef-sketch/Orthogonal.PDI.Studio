/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SKETCH-TO-ISO MASTER MODULE — STEP 5: CALQUE A4/A3 WORKSPACE & COMPILER INTEGRATION
 */
import React, { useState, useEffect, useRef } from "react";
import {
  SketchVectorNode,
  SketchVectorSegment,
  SketchVectorFitting,
  PaperFormat,
  PAPER_FORMATS
} from "./sketchRasterEngine";
import { SketchCanvasOverlay } from "./SketchCanvasOverlay";
import { SketchReviewTable } from "./SketchReviewTable";
import { compileSketchToIsoModel, CompiledIsoModel } from "./sketchToJsonCompiler";
import {
  getLocalLearningProfile,
  saveLocalLearningProfile,
  SketchLearningProfile
} from "./sketchStorage";
import {
  generateDemoSketchImageDataUrl,
  DEMO_INITIAL_NODES,
  DEMO_INITIAL_SEGMENTS,
  DEMO_INITIAL_FITTINGS
} from "./demoSketchTemplate";
import {
  detectSketchTopologyOpenCv,
  AxisMappingConfig,
  DEFAULT_AXIS_MAPPING
} from "./openCvSketchDetector";
import { SketchCropTool } from "./SketchCropTool";

export interface SketchToIsoModuleProps {
  onLoadProjectToEditor?: (isoJson: any, name: string) => void;
}

export const SketchToIsoModule: React.FC<SketchToIsoModuleProps> = ({
  onLoadProjectToEditor
}) => {
  // Paper & Filters
  const [format, setFormat] = useState<PaperFormat>("A4_landscape");
  const [opacity, setOpacity] = useState<number>(75);
  const [contrastThreshold, setContrastThreshold] = useState<number>(145);
  const [brightness, setBrightness] = useState<number>(10);
  const [invert, setInvert] = useState<boolean>(false);
  const [rotationDeg] = useState<number>(0);
  const [snapAngleToleranceDeg, setSnapAngleToleranceDeg] = useState<number>(12);

  // Calibration
  const [calibrationScale, setCalibrationScale] = useState<number>(0.25); // px per mm

  // Tools
  const [activeTool, setActiveTool] = useState<"select" | "pipe" | "fitting" | "calibrate" | "erase" | "pan">("pipe");
  const [axisCursorEnabled, setAxisCursorEnabled] = useState<boolean>(false);
  const [selectedFittingType, setSelectedFittingType] = useState<SketchVectorFitting["type"]>("valve");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);

  // Geometry
  const [nodes, setNodes] = useState<SketchVectorNode[]>([]);
  const [segments, setSegments] = useState<SketchVectorSegment[]>([]);
  const [fittings, setFittings] = useState<SketchVectorFitting[]>([]);

  // Project Info
  const [projectName, setProjectName] = useState("LIGNE-CROQUIS-001");
  const [service, setService] = useState("PROC-CHIM");

  // Image Source
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 1188, height: 840 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calligraphy Learning Profile
  const [profile, setProfile] = useState<SketchLearningProfile>(() => getLocalLearningProfile());

  // AI Vision Detection State
  const [isDetectingAI, setIsDetectingAI] = useState<boolean>(false);
  const [autoDetectOnImport, setAutoDetectOnImport] = useState<boolean>(true);
  const [aiDetectionSummary, setAiDetectionSummary] = useState<string | null>(null);
  const [aiDetectedEquipment, setAiDetectedEquipment] = useState<any[]>([]);

  // Interactive Axis Mapping State (Partie 2 - Trièdre)
  const [axisMapping, setAxisMapping] = useState<AxisMappingConfig>(DEFAULT_AXIS_MAPPING);

  // Show live compiled JSON modal
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [compiledJsonPreview, setCompiledJsonPreview] = useState<CompiledIsoModel | null>(null);

  // Table de révision pré-import masquée par défaut pour affichage maximal du croquis
  const [showReviewTable, setShowReviewTable] = useState<boolean>(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Auto-clear notification after 4s
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // Load Initial Demo Plan on mount if canvas is empty
  useEffect(() => {
    if (!imageDataUrl && nodes.length === 0) {
      loadDemoCroquis();
    }
  }, []);

  const loadDemoCroquis = () => {
    const demoUrl = generateDemoSketchImageDataUrl();
    setImageDataUrl(demoUrl);
    setImageDimensions({ width: 1188, height: 840 });
    setNodes(DEMO_INITIAL_NODES);
    setSegments(DEMO_INITIAL_SEGMENTS);
    setFittings(DEMO_INITIAL_FITTINGS);
    setCalibrationScale(0.24);
    setStatusMessage("✅ Croquis de démonstration A4 chargé avec succès.");
  };

  // AI Vision & OCR Detection Function
  const [ocrDimensions, setOcrDimensions] = useState<Array<{ text: string; valueMm: number }>>([]);

  const handleRunAiDetection = async (overrideDataUrl?: string, overrideDims?: { width: number; height: number }) => {
    const targetImg = overrideDataUrl || imageDataUrl;
    if (!targetImg) {
      setStatusMessage("⚠️ Veuillez d'abord importer un scan ou charger un croquis.");
      return;
    }

    const dims = overrideDims || imageDimensions;
    setIsDetectingAI(true);
    setStatusMessage("🔍 Analyse OCR & Vision : Lecture du cartouche, reconnaissance des cotes mm, pompe et segmentation de la table BOM...");

    try {
      let data: any = null;

      // 1. Tenter l'analyse OCR avancée sur le serveur
      try {
        const res = await fetch("/api/sketch/detect-iso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: targetImg,
            imageWidth: dims.width,
            imageHeight: dims.height,
            format: format
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            data = json.data;
          }
        }
      } catch (netErr) {
        console.warn("[OCR Client] Serveur non joignable, bascule locale :", netErr);
      }

      // 2. Fallback local avec OpenCV.js si serveur absent
      if (!data) {
        data = await detectSketchTopologyOpenCv(targetImg, dims.width, dims.height);
      }

      if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0 || !Array.isArray(data.segments) || data.segments.length === 0) {
        // Détection non concluante / confiance insuffisante -> Pointage manuel assisté
        setNodes([]);
        setSegments([]);
        setFittings([]);
        setAiDetectedEquipment([]);
        setActiveTool("pipe");
        const msg = "⚠️ Détection automatique insuffisamment fiable pour ce croquis. Mode pointage manuel assisté activé : cliquez sur l'image pour placer les nœuds et tracer la tuyauterie.";
        setAiDetectionSummary(msg);
        setStatusMessage(msg);
        return;
      }

      if (data.detectedTitle) setProjectName(data.detectedTitle);
      if (data.service) setService(data.service);

      // Calibrage automatique de l'échelle à partir de l'OCR des cotes
      if (data.calibrationScale && typeof data.calibrationScale === "number" && data.calibrationScale > 0) {
        setCalibrationScale(data.calibrationScale);
      }

      if (Array.isArray(data.ocrDimensions)) {
        setOcrDimensions(data.ocrDimensions);
      }

      if (Array.isArray(data.nodes) && data.nodes.length > 0) {
        setNodes(data.nodes);
      }
      if (Array.isArray(data.segments)) {
        setSegments(data.segments);
      }
      if (Array.isArray(data.fittings)) {
        setFittings(data.fittings);
      }
      if (Array.isArray(data.equipment)) {
        setAiDetectedEquipment(data.equipment);
      }

      const summaryText = data.summary || `Détection OCR terminée : ${data.nodes?.length || 0} nœuds, ${data.segments?.length || 0} tronçons, échelle calibrée à ${data.calibrationScale || calibrationScale} px/mm.`;
      setAiDetectionSummary(summaryText);
      setStatusMessage(`🎯 ${summaryText} Ajustez la position des éléments si nécessaire puis validez.`);
    } catch (err: any) {
      console.error("OCR Vision Detection Error:", err);
      setStatusMessage(`⚠️ Échec de l'analyse OCR : ${err.message || "Erreur"}`);
    } finally {
      setIsDetectingAI(false);
    }
  };

  // Manual Image Cropping State (PARTIE A - SKETCH-CROP-TOOL)
  const [showCropModal, setShowCropModal] = useState<boolean>(false);
  const [cropPendingImage, setCropPendingImage] = useState<{ dataUrl: string; dims: { width: number; height: number } } | null>(null);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          const dims = { width: img.width, height: img.height };
          setImageDimensions(dims);
          setImageDataUrl(result);
          setCropPendingImage({ dataUrl: result, dims });
          setShowCropModal(true);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirmed = (croppedDataUrl: string, croppedWidth: number, croppedHeight: number) => {
    const newDims = { width: croppedWidth, height: croppedHeight };
    setImageDataUrl(croppedDataUrl);
    setImageDimensions(newDims);
    setShowCropModal(false);
    setCropPendingImage(null);
    if (autoDetectOnImport) {
      handleRunAiDetection(croppedDataUrl, newDims);
    } else {
      setNodes([]);
      setSegments([]);
      setFittings([]);
      setStatusMessage("📸 Image recadrée appliquée. Cliquez sur '✨ Détecter la topologie' pour lancer la détection.");
    }
  };

  const handleSkipCrop = () => {
    if (!cropPendingImage) return;
    const { dataUrl, dims } = cropPendingImage;
    setShowCropModal(false);
    setCropPendingImage(null);
    if (autoDetectOnImport) {
      handleRunAiDetection(dataUrl, dims);
    } else {
      setNodes([]);
      setSegments([]);
      setFittings([]);
      setStatusMessage("📸 Image entière conservée.");
    }
  };

  // Compile JSON
  const handleCompileJson = (): CompiledIsoModel => {
    const model = compileSketchToIsoModel({
      nodes,
      segments,
      fittings,
      equipment: aiDetectedEquipment,
      calibrationScale,
      title: projectName,
      paperFormat: format,
      lineReference: projectName,
      service,
      axisMapping
    });
    setCompiledJsonPreview(model);
    return model;
  };

  // Transfer to Isometric Editor (Passerelle d'injection Étape 5)
  const handleTransferToIsometricEditor = () => {
    if (nodes.length === 0 || segments.length === 0) {
      alert("Veuillez tracer ou charger au moins un tronçon de tuyauterie avant de valider l'isométrie.");
      return;
    }

    const model = handleCompileJson();

    // Auto-save model to local storage & pending injection for the ISO engine
    try {
      const sanitizedName = (projectName || "L-100-PROC-01").replace(/\s+/g, "_");
      const autosaveKey = `isometrie.autosave.${sanitizedName}`;
      const payload = {
        name: projectName,
        nodes: model.nodes,
        segments: model.segments,
        lines: model.lines,
        dimensions: model.dimensions,
        workspace: {
          showDimensions: true,
          showGrid: true,
          showPipeLabels: true,
          showWelds: true
        },
        open3d: true,
        updatedAt: new Date().toISOString()
      };
      // 1. Écrire le payload dans localStorage ET sessionStorage avant tout changement de vue
      window.localStorage.setItem(autosaveKey, JSON.stringify(payload));
      window.localStorage.setItem("pdi.pending_iso_injection", JSON.stringify(payload));
      window.sessionStorage.setItem("pdi.pending_iso_injection", JSON.stringify(payload));
      window.localStorage.setItem("pdi.activeModule.v1", "isometric");

      // 2. Émettre "pdi:active-module-changed" pour alerter tout composant ISO déjà monté
      window.dispatchEvent(
        new CustomEvent("pdi:active-module-changed", {
          detail: { activeModule: "isometric" }
        })
      );
    } catch (err) {
      console.warn("Storage warning:", err);
    }

    // 3. Basculement de vue
    if (onLoadProjectToEditor) {
      onLoadProjectToEditor(model, projectName);
    } else {
      setStatusMessage("🚀 Modèle injecté avec succès ! Basculement vers l'éditeur ISO...");
    }

    // 4. Filet de sécurité supplémentaire : retarder le dispatch de "pdi:inject-iso-graph" d'environ 120ms
    setTimeout(() => {
      try {
        window.dispatchEvent(
          new CustomEvent("pdi:inject-iso-graph", {
            detail: {
              data: model,
              name: projectName,
              open3d: true
            }
          })
        );
      } catch (err) {
        console.warn("Dispatch warning:", err);
      }
    }, 120);
  };

  // Download JSON file
  const handleDownloadJson = () => {
    const model = handleCompileJson();
    const jsonStr = JSON.stringify(model, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_iso_pdi.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("💾 Fichier JSON standard PD&I téléchargé.");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#030712",
        color: "#F1F5F9",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden"
      }}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png,image/jpeg,image/webp,image/bmp"
        style={{ display: "none" }}
      />

      {/* MAIN WORKSPACE: CANVAS ON LEFT, CONTROLS RIGHT SIDEBAR */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        
        {/* CENTER/LEFT: CALQUE CANVAS OVERLAY (MAXIMAL DISPLAY) */}
        <div style={{ flex: 1, width: "100%", height: "100%", position: "relative", minWidth: 0 }}>
          <SketchCanvasOverlay
            imageBlob={null}
            imageDataUrl={imageDataUrl}
            imageDimensions={imageDimensions}
            format={format}
            opacity={opacity}
            contrastThreshold={contrastThreshold}
            brightness={brightness}
            invert={invert}
            rotationDeg={rotationDeg}
            snapAngleToleranceDeg={snapAngleToleranceDeg}
            nodes={nodes}
            segments={segments}
            fittings={fittings}
            calibrationScale={calibrationScale}
            activeTool={activeTool}
            selectedFittingType={selectedFittingType}
            recenterTrigger={recenterTrigger}
            isDetectingAI={isDetectingAI}
            axisCursorEnabled={axisCursorEnabled}
            axisMapping={axisMapping}
            onAxisMappingChange={setAxisMapping}
            onNodesChange={setNodes}
            onSegmentsChange={setSegments}
            onFittingsChange={setFittings}
            onCalibrationChange={(newScale) => {
              setCalibrationScale(newScale);
              setStatusMessage(`📐 Échelle étalonnée : ${newScale.toFixed(3)} px/mm.`);
            }}
          />

          {/* FLOATING BUTTON (+) TO RESTORE RIGHT SIDEBAR WHEN COLLAPSED */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              title="Afficher la barre latérale (+)"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 30,
                background: "#0284C7",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>(+)</span>
              <span>Outils Croquis</span>
            </button>
          )}
        </div>

        {/* REVIEW & CORRECTION TABLE (EXPANDABLE PANEL) */}
        {showReviewTable && (
          <div
            style={{
              width: 400,
              minWidth: 340,
              maxWidth: 460,
              height: "100%",
              borderLeft: "1px solid #1E293B",
              position: "relative",
              background: "#090E17",
              display: "flex",
              flexDirection: "column",
              zIndex: 10
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "#0B1120",
                borderBottom: "1px solid #1E293B"
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: "#38BDF8" }}>
                TABLE DE RÉVISION PRÉ-IMPORT
              </span>
              <button
                type="button"
                onClick={() => setShowReviewTable(false)}
                title="Masquer la table de révision"
                style={{
                  background: "#1E293B",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 800
                }}
              >
                Masquer ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <SketchReviewTable
                nodes={nodes}
                segments={segments}
                fittings={fittings}
                profile={profile}
                calibrationScale={calibrationScale}
                onNodesChange={setNodes}
                onSegmentsChange={setSegments}
                onFittingsChange={setFittings}
                onProfileChange={(p) => {
                  setProfile(p);
                  saveLocalLearningProfile(p);
                }}
              />
            </div>
          </div>
        )}

        {/* RIGHT SIDEBAR: GROUPED CONTROLS WITH ADJUSTED BUTTON SIZES */}
        {sidebarOpen && (
          <aside
            style={{
              width: 250,
              minWidth: 250,
              maxWidth: 250,
              height: "100%",
              background: "#080C14",
              borderLeft: "1px solid #1E293B",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              overflowX: "hidden",
              zIndex: 20
            }}
          >
            {/* SIDEBAR HEADER WITH (-) BUTTON */}
            <div
              style={{
                padding: "8px 12px",
                background: "#0B1120",
                borderBottom: "1px solid #1E293B",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)",
                    color: "#FFFFFF",
                    fontWeight: 900,
                    fontSize: 10,
                    padding: "3px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.06em"
                  }}
                >
                  CRQ → ISO
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#F8FAFC" }}>
                  Atelier Croquis
                </span>
              </div>

              {/* Bouton (-) pour masquer la barre latérale droite */}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                title="Masquer la barre latérale (-)"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  color: "#94A3B8",
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "2px 7px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                (-)
              </button>
            </div>

            <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {/* PRIMARY ACTION BUTTON */}
              <div>
                <button
                  type="button"
                  onClick={handleTransferToIsometricEditor}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "linear-gradient(135deg, #0284C7 0%, #059669 100%)",
                    border: "none",
                    borderRadius: 8,
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: "transform 0.1s ease"
                  }}
                  title="Valider la tuyauterie du croquis et ouvrir immédiatement l'isométrie 2D cotée et la vue 3D solide"
                >
                  <span>🚀 Valider &amp; Ouvrir ISO</span>
                </button>
              </div>

              {/* SECTION 1: OUTILS DE TRACÉ & NAVIGATION */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#38BDF8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Outils de Tracé ISO
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {[
                    { id: "pipe", label: "Tuyau ISO", icon: "●" },
                    { id: "fitting", label: "Accessoire", icon: "❖" },
                    { id: "pan", label: "Main", icon: "✋" },
                    { id: "select", label: "Sélection", icon: "↗" },
                    { id: "calibrate", label: "Étalonner", icon: "⇿" }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTool(t.id as any)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        padding: "7px 6px",
                        borderRadius: 6,
                        border: activeTool === t.id ? "1px solid #38BDF8" : "1px solid #1E293B",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        background: activeTool === t.id ? "#0284C7" : "#0F172A",
                        color: activeTool === t.id ? "#FFFFFF" : "#CBD5E1",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}

                  {/* Bouton bascule Curseur Trièdre (SKETCH-DETECT-08 / PARTIE 2) */}
                  <button
                    type="button"
                    onClick={() => setAxisCursorEnabled((prev) => !prev)}
                    title={axisCursorEnabled ? "Désactiver le curseur trièdre pendant le déplacement" : "Activer le curseur trièdre pendant le déplacement"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      padding: "7px 6px",
                      borderRadius: 6,
                      border: axisCursorEnabled ? "1px solid #F59E0B" : "1px solid #1E293B",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: axisCursorEnabled ? "#B45309" : "#0F172A",
                      color: axisCursorEnabled ? "#FFFFFF" : "#CBD5E1",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span>✥</span>
                    <span>Trièdre {axisCursorEnabled ? "ON" : "OFF"}</span>
                  </button>

                  {/* Bouton Recentrer Scan / Image */}
                  <button
                    type="button"
                    onClick={() => setRecenterTrigger((c) => c + 1)}
                    title="Recentrer le scan et adapter la vue"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "7px 6px",
                      borderRadius: 6,
                      border: "1px solid #0284C7",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: "rgba(2, 132, 199, 0.15)",
                      color: "#38BDF8",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span>🎯</span>
                    <span>Recentrer</span>
                  </button>
                </div>

                {/* Sub-select for fitting */}
                {activeTool === "fitting" && (
                  <div style={{ marginTop: 6 }}>
                    <label style={{ display: "block", fontSize: 10, color: "#94A3B8", marginBottom: 3, fontWeight: 600 }}>
                      Type d'accessoire :
                    </label>
                    <select
                      value={selectedFittingType}
                      onChange={(e) => setSelectedFittingType(e.target.value as any)}
                      style={{
                        width: "100%",
                        background: "#0F172A",
                        color: "#38BDF8",
                        border: "1px solid #0284C7",
                        borderRadius: 6,
                        fontSize: 11,
                        padding: "5px 8px",
                        fontWeight: 700
                      }}
                    >
                      <option value="valve">Vanne Passage Total</option>
                      <option value="check_valve">Clapet anti-retour</option>
                      <option value="flange">Bride WN</option>
                      <option value="elbow_90">Coude 90°</option>
                      <option value="elbow_45">Coude 45°</option>
                      <option value="tee">Té égal</option>
                      <option value="reducer">Réduction</option>
                      <option value="instrument">Manomètre</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                )}
              </div>

            {/* SECTION 2: DÉTECTION OCR & CALIBRAGE AUTOMATIQUE DU PLAN */}
            <div style={{ background: "linear-gradient(135deg, rgba(14, 116, 144, 0.25), rgba(15, 23, 42, 0.6))", border: "1px solid #0284C7", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#38BDF8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  🔍 OCR &amp; Calibrage Plan
                </span>
                <span style={{ fontSize: 9, background: "#0369A1", color: "#E0F2FE", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>
                  Étalonnage OCR
                </span>
              </div>

              {/* Bouton de Détection Principale */}
              <button
                type="button"
                disabled={isDetectingAI || !imageDataUrl}
                onClick={() => handleRunAiDetection()}
                title="Détecter automatiquement le matériel (pompe, vannes, ligne), lire les cotes OCR et calibrer l'échelle en excluant la table BOM"
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  background: isDetectingAI
                    ? "linear-gradient(135deg, #075985, #0C4A6E)"
                    : "linear-gradient(135deg, #0284C7 0%, #059669 100%)",
                  border: "1px solid #38BDF8",
                  borderRadius: 6,
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: isDetectingAI || !imageDataUrl ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
                  transition: "transform 0.1s ease"
                }}
              >
                <span style={{ fontSize: 14 }}>{isDetectingAI ? "⏳" : "⚡"}</span>
                <span>{isDetectingAI ? "Analyse OCR en cours..." : "Détecter par OCR & Calibrer le Plan"}</span>
              </button>

              {/* Option Détection Auto à l'import */}
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#BAE6FD", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={autoDetectOnImport}
                  onChange={(e) => setAutoDetectOnImport(e.target.checked)}
                  style={{ accentColor: "#0284C7", cursor: "pointer" }}
                />
                <span>Auto-détecter à l'import d'image</span>
              </label>

              {/* Carte Résumé si éléments détectés */}
              {aiDetectionSummary && (
                <div style={{ background: "rgba(15, 23, 42, 0.85)", border: "1px solid #38BDF8", borderRadius: 6, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 9.5, color: "#38BDF8", fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>✓</span> <span>RÉSULTAT OCR &amp; CALIBRAGE :</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#E2E8F0", lineHeight: 1.3 }}>
                    {aiDetectionSummary}
                  </div>

                  {/* Affichage des cotes OCR détectées */}
                  {ocrDimensions.length > 0 && (
                    <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700 }}>Cotes millimétriques reconnues (OCR) :</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {ocrDimensions.map((dim, i) => (
                          <span key={i} style={{ background: "rgba(2, 132, 199, 0.3)", border: "1px solid #38BDF8", color: "#BAE6FD", fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>
                            {dim.text || `${dim.valueMm} mm`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags matériel détecté */}
                  {aiDetectedEquipment.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                      {aiDetectedEquipment.map((eq, i) => (
                        <span key={i} style={{ background: "#0369A1", color: "#FFFFFF", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3 }}>
                          {eq.tag || eq.type}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Indicateur d'échelle calibrée */}
                  <div style={{ fontSize: 9, color: "#34D399", fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>🎯</span> <span>Échelle : {calibrationScale > 0 ? `${calibrationScale.toFixed(3)} px/mm` : "Non étalonné"} (Zone BOM exclue)</span>
                  </div>
                  <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>
                    💡 Cliquez &amp; glissez les nœuds pour ajuster la position, puis validez.
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2B: ACTIONS & FICHIERS */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#38BDF8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Fichiers &amp; Données
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    background: "#1E293B",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    color: "#F8FAFC",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span>📂</span>
                  <span>Importer Scan / Photo</span>
                </button>

                <button
                  type="button"
                  onClick={loadDemoCroquis}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    background: "#0F172A",
                    border: "1px solid #0284C7",
                    borderRadius: 6,
                    color: "#38BDF8",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span>⚡</span>
                  <span>Charger Exemple Démo</span>
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleCompileJson();
                      setShowJsonModal(true);
                    }}
                    style={{
                      padding: "7px 6px",
                      background: "#1E293B",
                      border: "1px solid #475569",
                      borderRadius: 6,
                      color: "#A7F3D0",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    <span>📄</span>
                    <span>Voir JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowReviewTable((v) => !v)}
                    style={{
                      padding: "7px 6px",
                      background: showReviewTable ? "#0369a1" : "#1E293B",
                      border: `1px solid ${showReviewTable ? "#38BDF8" : "#334155"}`,
                      borderRadius: 6,
                      color: showReviewTable ? "#FFFFFF" : "#CBD5E1",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    <span>📋</span>
                    <span>{showReviewTable ? "Masquer Tab." : "Table Rév."}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 3: RÉGLAGES DU CALQUE */}
            <div style={{ background: "#050912", border: "1px solid #1E293B", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Réglages Calque &amp; Papier
              </div>

              {/* Format Papier */}
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#64748B", marginBottom: 2 }}>Format :</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as PaperFormat)}
                  style={{
                    width: "100%",
                    background: "#0F172A",
                    color: "#F8FAFC",
                    border: "1px solid #334155",
                    borderRadius: 4,
                    padding: "4px 6px",
                    fontSize: 11
                  }}
                >
                  {Object.entries(PAPER_FORMATS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opacité Slider */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>
                  <span>Opacité Calque :</span>
                  <span style={{ fontWeight: 700, color: "#38BDF8" }}>{opacity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#0284C7" }}
                />
              </div>

              {/* Filtre N&B */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>
                  <span>Filtre Encre N&amp;B :</span>
                  <span style={{ fontWeight: 700, color: "#38BDF8" }}>{contrastThreshold}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={contrastThreshold}
                  onChange={(e) => setContrastThreshold(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#0284C7" }}
                />
              </div>

              {/* Inverser fond/traits */}
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 10, color: "#CBD5E1" }}>
                <input
                  type="checkbox"
                  checked={invert}
                  onChange={(e) => setInvert(e.target.checked)}
                  style={{ accentColor: "#0284C7" }}
                />
                <span>Inverser fond / traits</span>
              </label>

              {/* Tolérance Aimantation */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>
                  <span>Aimantation ISO :</span>
                  <span style={{ fontWeight: 700, color: "#38BDF8" }}>±{snapAngleToleranceDeg}°</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={25}
                  value={snapAngleToleranceDeg}
                  onChange={(e) => setSnapAngleToleranceDeg(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#0284C7" }}
                />
              </div>
            </div>

            {/* Notification Toast in Sidebar */}
            {statusMessage && (
              <div
                style={{
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 10,
                  color: "#38BDF8",
                  fontWeight: 600,
                  lineHeight: 1.4
                }}
              >
                {statusMessage}
              </div>
            )}
          </div>
        </aside>
      )}
      </div>

      {/* JSON PREVIEW MODAL */}
      {showJsonModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24
          }}
        >
          <div
            style={{
              background: "#0B1120",
              border: "1px solid #0284C7",
              borderRadius: 12,
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0,0,0,0.8)"
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1E293B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "#38BDF8", fontWeight: 800 }}>
                Modèle JSON Isométrique Normalisé (PD&I V4.8d)
              </h3>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", fontSize: 16, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <pre
                style={{
                  margin: 0,
                  background: "#020617",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#38BDF8",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap"
                }}
              >
                {JSON.stringify(compiledJsonPreview, null, 2)}
              </pre>
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid #1E293B", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={handleDownloadJson}
                style={{
                  padding: "6px 14px",
                  background: "#0284C7",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                💾 Télécharger le fichier .json
              </button>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                style={{
                  padding: "6px 14px",
                  background: "#1E293B",
                  color: "#94A3B8",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Recadrage Manuel d'Image (PARTIE A - SKETCH-CROP-TOOL) */}
      {showCropModal && cropPendingImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-5xl">
            <SketchCropTool
              imageDataUrl={cropPendingImage.dataUrl}
              imageWidth={cropPendingImage.dims.width}
              imageHeight={cropPendingImage.dims.height}
              onCropConfirmed={handleCropConfirmed}
              onSkipCrop={handleSkipCrop}
              onCancel={() => {
                setShowCropModal(false);
                setCropPendingImage(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
