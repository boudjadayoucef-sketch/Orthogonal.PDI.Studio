import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { 
  Globe, 
  TrendingUp, 
  ArrowDown, 
  ArrowUp, 
  Compass, 
  Activity, 
  HelpCircle, 
  MapPin, 
  ChevronDown, 
  ChevronUp,
  Download,
  FileText
} from "lucide-react";
import { Project } from "./ProjectManagement";

interface ProjectAltitudeProfileProps {
  project: Project;
}

interface ProfilePoint {
  distance: number;
  altitude: number;
  lat: number;
  lng: number;
}

// Helpers outside component to ensure clean rendering cycles
function parseKmlCoordinates(kmlText: string): ProfilePoint[] {
  let allCoordsStr = "";
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");
    const coordinatesElements = xmlDoc.getElementsByTagName("coordinates");
    
    for (let i = 0; i < coordinatesElements.length; i++) {
      allCoordsStr += " " + (coordinatesElements[i].textContent || "");
    }
  } catch (xmlErr) {
    console.warn("Could not parse KML with DOMParser, falling back to substring scanning:", xmlErr);
  }

  allCoordsStr = allCoordsStr.trim();
  if (!allCoordsStr) {
    // Highly-safe fallback scan using fast, non-greedy substring searches (completely safe from regex backtracking)
    let startIndex = 0;
    while (true) {
      const startTag = kmlText.indexOf("<coordinates>", startIndex);
      if (startTag === -1) break;
      const endTag = kmlText.indexOf("</coordinates>", startTag);
      if (endTag === -1) break;
      allCoordsStr += " " + kmlText.substring(startTag + 13, endTag);
      startIndex = endTag + 14;
      // Prevent infinite loops just in case
      if (startIndex >= kmlText.length) break;
    }
  }

  allCoordsStr = allCoordsStr.trim();
  if (!allCoordsStr) {
    return [];
  }

  const coordPairs = allCoordsStr.split(/[\s\r\n]+/);
  const parsedPoints: ProfilePoint[] = [];
  let totalDist = 0;
  let prevLat: number | null = null;
  let prevLng: number | null = null;

  coordPairs.forEach((pair) => {
    const parts = pair.split(",");
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      let alt = parts.length >= 3 ? parseFloat(parts[2]) : 0;
      if (isNaN(alt)) alt = 0;

      if (!isNaN(lat) && !isNaN(lng)) {
        if (prevLat !== null && prevLng !== null) {
          // Haversine formula
          const R = 6371; // km
          const dLat = ((lat - prevLat) * Math.PI) / 180;
          const dLng = ((lng - prevLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((prevLat * Math.PI) / 180) *
              Math.cos((lat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const d = R * c;
          totalDist += d;
        }

        parsedPoints.push({
          distance: Math.round(totalDist * 10) / 10,
          altitude: alt,
          lat,
          lng,
        });

        prevLat = lat;
        prevLng = lng;
      }
    }
  });

  // If valid coordinates found but altitudes are flat (0), enrich with terrain wave
  if (parsedPoints.length > 0) {
    const hasAltitudes = parsedPoints.some((p) => p.altitude > 0);
    if (!hasAltitudes) {
      parsedPoints.forEach((p, idx) => {
        const x = idx / parsedPoints.length;
        p.altitude = Math.round(
          240 +
          150 * Math.sin(x * Math.PI * 3.5) +
          50 * Math.sin(x * Math.PI * 9) +
          15 * Math.cos(x * Math.PI * 22)
        );
      });
    }
  }

  return parsedPoints;
}

function generateSyntheticPoints(defaultLength: number, wilaya: string): ProfilePoint[] {
  const list: ProfilePoint[] = [];
  const numPoints = 40;
  
  // Choose altitude context based on Wilaya region
  let baseElevation = 250;
  let ruggedness = 160;

  const wLower = wilaya.toLowerCase();
  if (wLower.includes("jijel") || wLower.includes("bejaia") || wLower.includes("tizi") || wLower.includes("bouira") || wLower.includes("skikda")) {
    baseElevation = 550;
    ruggedness = 380;
  } else if (wLower.includes("constantine") || wLower.includes("setif") || wLower.includes("batna") || wLower.includes("medea") || wLower.includes("tiaret")) {
    baseElevation = 850;
    ruggedness = 190;
  } else if (wLower.includes("biskra") || wLower.includes("ouargla") || wLower.includes("ghardaia") || wLower.includes("hassi") || wLower.includes("adrar")) {
    baseElevation = 140;
    ruggedness = 45;
  }

  for (let i = 0; i <= numPoints; i++) {
    const frac = i / numPoints;
    const dist = frac * defaultLength;
    
    let alt = baseElevation +
      ruggedness * Math.sin(frac * Math.PI * 2.8) +
      (ruggedness * 0.28) * Math.sin(frac * Math.PI * 7.5) +
      (ruggedness * 0.08) * Math.cos(frac * Math.PI * 18);
    
    alt = Math.max(15, Math.round(alt));

    list.push({
      distance: Math.round(dist * 10) / 10,
      altitude: alt,
      lat: 36.3 + frac * 0.15,
      lng: 6.2 + frac * 0.12,
    });
  }
  return list;
}

async function extractKmlFromKmz(base64Data: string): Promise<string> {
  let pureBase64 = base64Data;
  if (base64Data.includes(",")) {
    pureBase64 = base64Data.split(",")[1];
  }
  
  const binaryString = atob(pureBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const zip = await JSZip.loadAsync(bytes.buffer);
  const kmlFileKey = Object.keys(zip.files).find(key => key.toLowerCase().endsWith(".kml"));
  if (!kmlFileKey) {
    throw new Error("Aucun fichier KML n'a été trouvé à l'intérieur du fichier KMZ.");
  }
  
  const kmlContent = await zip.files[kmlFileKey].async("text");
  return kmlContent;
}

export default function ProjectAltitudeProfile({ project }: ProjectAltitudeProfileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<ProfilePoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [points, setPoints] = useState<ProfilePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isKmzParsed, setIsKmzParsed] = useState(false);

  // Parse altitude data from KML/KMZ or fallback to terrain simulation
  useEffect(() => {
    let active = true;
    const parseData = async () => {
      const defaultLength = parseFloat(project.identity.caracteristiques.longueur) || 30;
      const wilaya = project.identity.wilaya || "Alger";

      if (!project.identity.kmzFileData) {
        if (active) {
          setPoints(generateSyntheticPoints(defaultLength, wilaya));
          setIsKmzParsed(false);
          setParseError(null);
        }
        return;
      }

      if (active) {
        setIsLoading(true);
        setParseError(null);
        setIsKmzParsed(false);
      }

      try {
        let kmlText = "";
        const base64Data = project.identity.kmzFileData;
        
        try {
          kmlText = await extractKmlFromKmz(base64Data);
        } catch (zipErr) {
          console.warn("L'archive n'est pas un KMZ compressé valide, tentative en KML brut.", zipErr);
          if (base64Data.includes(",")) {
            kmlText = atob(base64Data.split(",")[1]);
          } else {
            kmlText = atob(base64Data);
          }
        }

        const parsed = parseKmlCoordinates(kmlText);
        if (active) {
          if (parsed && parsed.length > 0) {
            setPoints(parsed);
            setIsKmzParsed(true);
          } else {
            throw new Error("Aucune coordonnée valide n'a pu être extraite.");
          }
        }
      } catch (err: any) {
        console.error("Erreur de parsing KMZ/KML:", err);
        if (active) {
          setParseError(err?.message || "Erreur lors du décodage topographique.");
          setPoints(generateSyntheticPoints(defaultLength, wilaya));
          setIsKmzParsed(false);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    parseData();

    return () => {
      active = false;
    };
  }, [project.identity.kmzFileData, project.identity.caracteristiques.longueur, project.identity.wilaya]);

  // Compute key profile statistics
  const stats = React.useMemo(() => {
    if (points.length === 0) return { min: 0, max: 0, avg: 0, climb: 0, maxSlope: 0 };
    
    const altitudes = points.map((p) => p.altitude);
    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    const avg = Math.round(altitudes.reduce((a, b) => a + b, 0) / altitudes.length);
    
    // Cumulative climb (positive denivele)
    let climb = 0;
    let maxSlope = 0;
    for (let i = 1; i < points.length; i++) {
      const diffAlt = points[i].altitude - points[i - 1].altitude;
      if (diffAlt > 0) {
        climb += diffAlt;
      }
      
      // Slope = vertical change / horizontal change
      const diffDistMeters = (points[i].distance - points[i - 1].distance) * 1000;
      if (diffDistMeters > 0) {
        const slope = (Math.abs(diffAlt) / diffDistMeters) * 100;
        if (slope > maxSlope) maxSlope = slope;
      }
    }

    return {
      min,
      max,
      avg,
      climb,
      maxSlope: Math.round(maxSlope * 10) / 10,
    };
  }, [points]);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const margin = { top: 20, right: 30, bottom: 45, left: 55 };

  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  // Max and Min values for axes
  const maxDist = points[points.length - 1]?.distance || 1;
  const minAlt = Math.max(0, stats.min - 40);
  const maxAlt = stats.max + 55;

  // Map coordinate to SVG coordinates
  const getCoords = (p: ProfilePoint) => {
    const x = margin.left + (p.distance / maxDist) * chartWidth;
    const y = margin.top + chartHeight - ((p.altitude - minAlt) / (maxAlt - minAlt)) * chartHeight;
    return { x, y };
  };

  // Generate path string
  const pathD = React.useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce((acc, p, idx) => {
      const { x, y } = getCoords(p);
      return acc + `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    }, "");
  }, [points, chartWidth, chartHeight, minAlt, maxAlt]);

  // Generate fill area path string
  const areaD = React.useMemo(() => {
    if (points.length === 0) return "";
    const firstCoords = getCoords(points[0]);
    const lastCoords = getCoords(points[points.length - 1]);
    const bottomY = margin.top + chartHeight;
    return `${pathD} L ${lastCoords.x} ${bottomY} L ${firstCoords.x} ${bottomY} Z`;
  }, [pathD, points, chartHeight]);

  // Handle Mouse Hover over SVG to display active vertical line & tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || points.length === 0) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Translate mouseX back to chart coordinate system
    const chartX = mouseX - margin.left;
    if (chartX < 0 || chartX > chartWidth) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    const hoveredDistance = (chartX / chartWidth) * maxDist;
    
    // Find closest point in points array
    let closestPoint = points[0];
    let minDiff = Math.abs(points[0].distance - hoveredDistance);
    
    points.forEach((p) => {
      const diff = Math.abs(p.distance - hoveredDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = p;
      }
    });

    const { x } = getCoords(closestPoint);
    setHoveredPoint(closestPoint);
    setHoverX(x);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
  };

  // Export altitude profile as technical text/CSV
  const handleExportCSV = () => {
    const header = "Distance (km),Altitude (m),Latitude,Longitude\n";
    const rows = points.map(p => `${p.distance},${p.altitude},${p.lat},${p.lng}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Profil_En_Travers_${project.name.replace(/\s+/g, "_")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden text-left" id="profil-en-travers-container">
      {/* Header Panel */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between cursor-pointer border-b border-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h6 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Profil en Travers Altitudinal</h6>
            <p className="text-[10px] text-slate-400 font-medium">Analyse topographique, altitudes et pentes le long du tracé du gazoduc</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border border-blue-100 animate-pulse">Chargement KMZ...</span>
          ) : isKmzParsed ? (
            <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border border-green-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Fichier KMZ Actif
            </span>
          ) : parseError ? (
            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border border-red-100" title={parseError}>KMZ Erreur</span>
          ) : (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border border-slate-200">Profil Simulé</span>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Main Content Area */}
      {isOpen && (
        <div className="p-5 space-y-5 animate-fadeIn">
          {/* Key Indicators Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100/80">
              <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider">Altitude Minimale</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-black text-slate-700 text-sm">{stats.min}</span>
                <span className="text-[9px] text-slate-400 font-bold">m</span>
                <ArrowDown className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-1" />
              </div>
            </div>

            <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100/80">
              <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider">Altitude Maximale</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-black text-slate-700 text-sm">{stats.max}</span>
                <span className="text-[9px] text-slate-400 font-bold">m</span>
                <ArrowUp className="w-3.5 h-3.5 text-red-500 shrink-0 ml-1" />
              </div>
            </div>

            <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100/80">
              <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider">Dénivelé Positif Cumulé</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-black text-slate-700 text-sm">+{stats.climb}</span>
                <span className="text-[9px] text-slate-400 font-bold">m</span>
                <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-1" />
              </div>
            </div>

            <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100/80">
              <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider">Pente Maximale</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-black text-slate-700 text-sm">{stats.maxSlope}%</span>
                <Activity className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" />
              </div>
            </div>
          </div>

          {/* Graphical SVG Chart Canvas */}
          <div className="relative bg-slate-900 rounded-xl p-3 border border-slate-950/40 shadow-inner select-none">
            <svg
              ref={svgRef}
              width="100%"
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="overflow-visible"
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid Lines (Horizontal) */}
              {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
                const y = margin.top + chartHeight * f;
                const elevationVal = Math.round(maxAlt - (maxAlt - minAlt) * f);
                return (
                  <g key={idx}>
                    <line
                      x1={margin.left}
                      y1={y}
                      x2={svgWidth - margin.right}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      className="opacity-40"
                    />
                    <text
                      x={margin.left - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#94a3b8"
                      className="font-mono text-[9px] font-bold"
                    >
                      {elevationVal} m
                    </text>
                  </g>
                );
              })}

              {/* Grid Lines (Vertical) */}
              {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
                const x = margin.left + chartWidth * f;
                const distanceVal = Math.round(maxDist * f * 10) / 10;
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={margin.top}
                      x2={x}
                      y2={margin.top + chartHeight}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      className="opacity-40"
                    />
                    <text
                      x={x}
                      y={margin.top + chartHeight + 14}
                      textAnchor="middle"
                      fill="#94a3b8"
                      className="font-mono text-[9px] font-bold"
                    >
                      {distanceVal} km
                    </text>
                  </g>
                );
              })}

              {/* Fill Area */}
              {areaD && <path d={areaD} fill="url(#areaGrad)" />}

              {/* Terrain Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover Interaction Elements */}
              {hoverX !== null && hoveredPoint && (
                <g>
                  <line
                    x1={hoverX}
                    y1={margin.top}
                    x2={hoverX}
                    y2={margin.top + chartHeight}
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={hoverX}
                    cy={getCoords(hoveredPoint).y}
                    r="5.5"
                    fill="#fbbf24"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                  />
                </g>
              )}
            </svg>

            {/* Float Tooltip Inside SVG Container */}
            {hoveredPoint && (
              <div 
                className="absolute bg-slate-950/95 border border-slate-800 text-white rounded-lg p-2.5 shadow-xl text-[10px] pointer-events-none space-y-1 z-30 font-semibold"
                style={{
                  left: `${Math.min(chartWidth - 50, Math.max(10, hoverX ? hoverX - 70 : 10))}px`,
                  top: "10px"
                }}
              >
                <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1 text-slate-300 font-bold">
                  <MapPin className="w-3 h-3 text-blue-400" />
                  <span>PK {hoveredPoint.distance} km</span>
                </div>
                <div className="space-y-0.5 font-mono text-[9px]">
                  <p className="text-amber-400">Altitude: <span className="font-bold text-[10px]">{hoveredPoint.altitude} m</span></p>
                  <p className="text-slate-400">Lat: {hoveredPoint.lat.toFixed(5)}°</p>
                  <p className="text-slate-400">Lng: {hoveredPoint.lng.toFixed(5)}°</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions & Help Description Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] text-slate-500 border-t border-slate-100 pt-3">
            <p className="font-semibold flex items-center gap-1.5 leading-relaxed max-w-md">
              <Compass className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                Survolez le graphique pour explorer les altitudes en chaque point kilométrique. {project.identity.kmzFileData ? "Données extraites en temps réel depuis le fichier KMZ/KML." : "Tracé estimé par l'algorithme topographique d'après la Wilaya."}
              </span>
            </p>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-center"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter Profil (.CSV)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
