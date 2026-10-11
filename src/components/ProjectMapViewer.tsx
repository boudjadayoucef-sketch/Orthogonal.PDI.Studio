import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
// PATCH 017H2 : CSS leaflet injecte par src/pdiInlineStyles, AVANT Tailwind.
// (l injection locale arrivait apres Tailwind et cassait la cascade).
import { Info, Map as MapIcon, Globe, Layers, Compass, Maximize2, Minimize2, Check, RefreshCw } from "lucide-react";
import { Project } from "./ProjectManagement";

// Helper to find latitude/longitude coordinates of Algerian Wilayas for KMZ/KML generation
export function getWilayaCoordinates(wilayaName: string): { lat: number; lng: number } {
  if (!wilayaName) return { lat: 36.7538, lng: 3.0588 }; // Default Algiers
  const cleanName = wilayaName.replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
  
  const coords: Record<string, { lat: number; lng: number }> = {
    "alger": { lat: 36.7538, lng: 3.0588 },
    "oran": { lat: 35.6971, lng: -0.6308 },
    "constantine": { lat: 36.3650, lng: 6.6147 },
    "annaba": { lat: 36.9000, lng: 7.7667 },
    "blida": { lat: 36.4700, lng: 2.8300 },
    "jijel": { lat: 36.8205, lng: 5.7661 },
    "setif": { lat: 36.1900, lng: 5.4137 },
    "sétif": { lat: 36.1900, lng: 5.4137 },
    "ouargla": { lat: 31.9493, lng: 5.3250 },
    "hassi messaoud": { lat: 31.6804, lng: 6.0728 },
    "béchar": { lat: 31.6167, lng: -2.2167 },
    "bechar": { lat: 31.6167, lng: -2.2167 },
    "biskra": { lat: 34.8500, lng: 5.7333 },
    "tamanrasset": { lat: 22.7850, lng: 5.5228 },
    "adrar": { lat: 27.8742, lng: -0.2864 },
    "chlef": { lat: 36.1647, lng: 1.3317 },
    "laghouat": { lat: 33.8000, lng: 2.8651 },
    "batna": { lat: 35.5500, lng: 6.1667 },
    "bejaia": { lat: 36.7511, lng: 5.0643 },
    "béjaïa": { lat: 36.7511, lng: 5.0643 },
    "djelfa": { lat: 34.6667, lng: 3.2500 },
    "tiaret": { lat: 35.3711, lng: 1.3169 },
    "tizi ouzou": { lat: 36.7119, lng: 4.0458 },
    "medea": { lat: 36.2642, lng: 2.7539 },
    "médéa": { lat: 36.2642, lng: 2.7539 },
    "mascara": { lat: 35.3964, lng: 0.1403 },
    "mostaganem": { lat: 35.9311, lng: 0.1250 },
    "m'sila": { lat: 35.7058, lng: 4.5419 },
    "sidi bel abbes": { lat: 35.1914, lng: -0.6417 },
    "sidi bel abbès": { lat: 35.1914, lng: -0.6417 },
    "skikda": { lat: 36.8792, lng: 6.9044 },
    "guelma": { lat: 36.4622, lng: 7.4294 },
    "bordj bou arreridj": { lat: 36.0711, lng: 4.7594 },
    "boumerdes": { lat: 36.7594, lng: 3.4731 },
    "boumerdès": { lat: 36.7594, lng: 3.4731 },
    "el oued": { lat: 33.3678, lng: 6.8516 },
    "khenchela": { lat: 35.4358, lng: 7.1433 },
    "souk ahras": { lat: 36.2864, lng: 7.9511 },
    "tipaza": { lat: 36.5892, lng: 2.4475 },
    "mila": { lat: 36.4503, lng: 6.2644 },
    "ain defla": { lat: 36.2644, lng: 1.9678 },
    "aïn defla": { lat: 36.2644, lng: 1.9678 },
    "naama": { lat: 33.2667, lng: -0.3167 },
    "naâma": { lat: 33.2667, lng: -0.3167 },
    "ghardaia": { lat: 32.4900, lng: 3.6700 },
    "ghardaïa": { lat: 32.4900, lng: 3.6700 },
    "relizane": { lat: 35.7372, lng: 0.5558 },
    "el tarf": { lat: 36.7672, lng: 8.3136 },
    "tindouf": { lat: 27.6711, lng: -8.1478 },
    "tissemsilt": { lat: 35.6072, lng: 1.8106 },
    "illizi": { lat: 26.4833, lng: 8.4667 },
    "touggourt": { lat: 33.1000, lng: 6.0667 },
    "djanet": { lat: 24.5500, lng: 9.4833 },
    "in salah": { lat: 27.1935, lng: 2.4607 },
    "in guezzam": { lat: 19.5705, lng: 5.7694 }
  };

  for (const key of Object.keys(coords)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return coords[key];
    }
  }

  // Fallback: deterministic coordinates from hashing the Wilaya name
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latOffset = (Math.abs(hash % 100) / 100) * 4; // 0 to 4 degrees
  const lngOffset = ((hash % 100) / 100) * 6 - 3; // -3 to 3 degrees
  return {
    lat: 34.0 + latOffset,
    lng: 3.0 + lngOffset
  };
}

// Generates a complete KML document for a project dynamically
export function generateKMLString(project: Project): string {
  const lengthKm = parseFloat(project.identity.caracteristiques.longueur || "40") || 40;
  const baseCoords = getWilayaCoordinates(project.identity.wilaya);
  
  // Direct pipeline slightly northeast
  const angle = 0.5; // radians (approx 30 degrees)
  const degPerKm = 1 / 111.32;
  const totalDeg = lengthKm * degPerKm;
  const latDiff = totalDeg * Math.sin(angle);
  const lngDiff = (totalDeg * Math.cos(angle)) / Math.cos((baseCoords.lat * Math.PI) / 180);
  
  const startLat = baseCoords.lat;
  const startLng = baseCoords.lng;
  
  // Build path points
  const numSegments = 6;
  const pathPoints: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const currentLat = startLat + latDiff * t;
    const currentLng = startLng + lngDiff * t;
    
    // Add realistic bend to pipeline path (0 at ends)
    const deviation = 0.015 * Math.sin(t * Math.PI) * (lengthKm > 20 ? 1 : 0.4);
    const devAngle = angle + Math.PI / 2;
    
    pathPoints.push({
      lat: currentLat + deviation * Math.sin(devAngle),
      lng: currentLng + deviation * Math.cos(devAngle)
    });
  }
  
  const pathCoordsString = pathPoints.map(p => `${p.lng},${p.lat},0`).join(" ");
  
  let placemarks = `
    <Placemark>
      <name>Gazoduc: ${project.name}</name>
      <description>Tracé principal du gazoduc (${lengthKm} km, DN ${project.identity.caracteristiques.diametre || 'N/A'})</description>
      <Style>
        <LineStyle>
          <color>ff0000ff</color> <!-- Red line -->
          <width>5</width>
        </LineStyle>
      </Style>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${pathCoordsString}</coordinates>
      </LineString>
    </Placemark>
  `;
  
  // Start Placemark (Scraper)
  placemarks += `
    <Placemark>
      <name>Gare de Racleur - Départ</name>
      <description>Station de départ du gazoduc ${project.name}</description>
      <Point>
        <coordinates>${pathPoints[0].lng},${pathPoints[0].lat},0</coordinates>
      </Point>
    </Placemark>
  `;
  
  // Sectioning Valves
  const nbCoupure = project.identity.caracteristiques.nbPostesCoupure || 1;
  for (let j = 1; j <= nbCoupure; j++) {
    const fraction = j / (nbCoupure + 1);
    const idx = Math.floor(fraction * pathPoints.length);
    const p = pathPoints[idx] || pathPoints[Math.floor(pathPoints.length / 2)];
    placemarks += `
      <Placemark>
        <name>Poste de Coupure PC ${j}</name>
        <description>Vanne de sectionnement de sécurité PC ${j}</description>
        <Point>
          <coordinates>${p.lng},${p.lat},0</coordinates>
        </Point>
      </Placemark>
    `;
  }
  
  // End Placemark (Scraper)
  placemarks += `
    <Placemark>
      <name>Gare de Racleur - Arrivée</name>
      <description>Station de réception de racleur finale pour le projet ${project.name}</description>
      <Point>
        <coordinates>${pathPoints[pathPoints.length - 1].lng},${pathPoints[pathPoints.length - 1].lat},0</coordinates>
      </Point>
    </Placemark>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${project.name.replace(/[<>&"]/g, "")} - Tracé Conduite</name>
    <description>Tracé technique officiel généré pour l'ouvrage ${project.name.replace(/[<>&"]/g, "")} - Localisation: ${project.identity.wilaya.replace(/[<>&"]/g, "")}</description>
    ${placemarks}
  </Document>
</kml>`;
}

// Parse KML XML text and extract lines & markers
export interface KmlData {
  lines: [number, number][][];
  points: {
    name: string;
    description: string;
    lat: number;
    lng: number;
    type: "start" | "end" | "valve" | "other";
  }[];
}

export function parseKML(kmlText: string): KmlData {
  const lines: [number, number][][] = [];
  const points: KmlData["points"] = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");
    
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
      console.warn("KML XML parsing error detected.");
      return { lines, points };
    }

    // 1. LineStrings
    const lineStrings = xmlDoc.getElementsByTagName("LineString");
    for (let i = 0; i < lineStrings.length; i++) {
      const coordNode = lineStrings[i].getElementsByTagName("coordinates")[0];
      if (coordNode && coordNode.textContent) {
        const coordText = coordNode.textContent.trim();
        const coords: [number, number][] = coordText
          .split(/[\s\r\n]+/)
          .filter(Boolean)
          .map(pair => {
            const parts = pair.split(",");
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            return [lat, lng] as [number, number];
          })
          .filter(pt => !isNaN(pt[0]) && !isNaN(pt[1]));
        
        if (coords.length > 0) {
          lines.push(coords);
        }
      }
    }

    // 2. Placemarks
    const placemarks = xmlDoc.getElementsByTagName("Placemark");
    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];
      const pointNode = pm.getElementsByTagName("Point")[0];
      if (pointNode) {
        const coordNode = pointNode.getElementsByTagName("coordinates")[0];
        if (coordNode && coordNode.textContent) {
          const coordText = coordNode.textContent.trim();
          const parts = coordText.split(",");
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            const nameNode = pm.getElementsByTagName("name")[0];
            const descNode = pm.getElementsByTagName("description")[0];
            const name = nameNode ? nameNode.textContent?.trim() || "" : "";
            const description = descNode ? descNode.textContent?.trim() || "" : "";
            
            let type: "start" | "end" | "valve" | "other" = "other";
            const lowerName = name.toLowerCase();
            if (lowerName.includes("départ") || lowerName.includes("start") || lowerName.includes("dep")) {
              type = "start";
            } else if (lowerName.includes("arrivée") || lowerName.includes("fin") || lowerName.includes("arr") || lowerName.includes("end")) {
              type = "end";
            } else if (lowerName.includes("coupure") || lowerName.includes("pc") || lowerName.includes("valve") || lowerName.includes("sect")) {
              type = "valve";
            }
            
            points.push({ name, description, lat, lng, type });
          }
        }
      }
    }
  } catch (err) {
    console.error("Error parsing KML text content:", err);
  }

  // Fallback if no lines parsed, but points exist (create a connect-the-dots line)
  if (lines.length === 0 && points.length > 1) {
    const sortedPoints = [...points].sort((a, b) => {
      if (a.type === "start") return -1;
      if (b.type === "start") return 1;
      if (a.type === "end") return 1;
      if (b.type === "end") return -1;
      return 0;
    });
    lines.push(sortedPoints.map(p => [p.lat, p.lng] as [number, number]));
  }

  return { lines, points };
}

interface ProjectMapViewerProps {
  project: Project;
}

export default function ProjectMapViewer({ project }: ProjectMapViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    tileLayer: L.TileLayer | null;
    polyline: L.Polyline | null;
    markers: L.Marker[];
    wilayaGeoLayer: L.GeoJSON | null;
    communesGeoLayer: L.GeoJSON | null;
  }>({ tileLayer: null, polyline: null, markers: [], wilayaGeoLayer: null, communesGeoLayer: null });

  const [mapType, setMapType] = useState<"standard" | "satellite">("satellite");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedElement, setSelectedElement] = useState<{ name: string; description: string } | null>(null);

  // States for collapsing/expanding panel overlays for maximum map visibility
  const [isLayersCollapsed, setIsLayersCollapsed] = useState<boolean>(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState<boolean>(false);

  // GeoJSON datasets for administrative boundaries
  const [wilayaGeoJson, setWilayaGeoJson] = useState<any>(null);
  const [communeGeoJson, setCommuneGeoJson] = useState<any>(null);
  const [loadingGeoJson, setLoadingGeoJson] = useState<boolean>(false);

  // Toggle flags for different layers
  const [showPipeline, setShowPipeline] = useState<boolean>(true);
  const [showWilayaBounds, setShowWilayaBounds] = useState<boolean>(true);
  const [showCommuneBounds, setShowCommuneBounds] = useState<boolean>(true);

  // KML contents state loaded asynchronously (supporting KML and KMZ/zip unzipping)
  const [kmlString, setKmlString] = useState<string>("");
  const [parsedData, setParsedData] = useState<KmlData>({ lines: [], points: [] });
  const [loadingKml, setLoadingKml] = useState<boolean>(false);

  // Clean the Wilaya info for query matches
  const wilayaInput = project.identity.wilaya || "";
  const wilayaCodeMatch = wilayaInput.match(/^(\d+)/);
  const projectWilayaCode = wilayaCodeMatch ? parseInt(wilayaCodeMatch[1], 10) : null;
  const projectWilayaNameClean = wilayaInput.replace(/^\d+\s*-\s*/, "").trim().toLowerCase();

  // Load Algerian Wilaya and Commune boundaries on mount
  useEffect(() => {
    const fetchGeoJsons = async () => {
      setLoadingGeoJson(true);
      try {
        // Fetch Wilayas GeoJSON from raw.githubusercontent
        const wilayasRes = await fetch("https://raw.githubusercontent.com/yassine-b/algeria-geojson/master/algeria_wilayas.geojson");
        if (wilayasRes.ok) {
          const wData = await wilayasRes.json();
          setWilayaGeoJson(wData);
        }

        // Fetch Communes GeoJSON from raw.githubusercontent
        const communesRes = await fetch("https://raw.githubusercontent.com/yassine-b/algeria-geojson/master/algeria_communes.geojson");
        if (communesRes.ok) {
          const cData = await communesRes.json();
          setCommuneGeoJson(cData);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des délimitations d'Algérie:", err);
      } finally {
        setLoadingGeoJson(false);
      }
    };

    fetchGeoJsons();
  }, []);

  // Handle asynchronous decoding / unzipping of custom KML/KMZ or fallback to auto-generated KML
  useEffect(() => {
    let isCancelled = false;
    setLoadingKml(true);

    const loadAndDecode = async () => {
      let rawText = "";
      if (project.identity.kmzFileData) {
        try {
          const matches = project.identity.kmzFileData.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];

            // Detect if file is zipped KMZ by mime, filename or content
            const isKmz = mimeType.includes("zip") || 
                          mimeType.includes("octet-stream") || 
                          mimeType.includes("kmz") ||
                          (project.identity.kmzFileName && project.identity.kmzFileName.toLowerCase().endsWith(".kmz"));

            if (isKmz) {
              const JSZip = (await import("jszip")).default;
              const zip = new JSZip();

              // Convert base64 data to binary bytes for JSZip loader
              const binString = atob(base64Data);
              const bytes = new Uint8Array(binString.length);
              for (let i = 0; i < binString.length; i++) {
                bytes[i] = binString.charCodeAt(i);
              }

              const loadedZip = await zip.loadAsync(bytes);
              // Find the first KML file in the zip
              const kmlFileKey = Object.keys(loadedZip.files).find(name => name.toLowerCase().endsWith(".kml"));
              if (kmlFileKey) {
                rawText = await loadedZip.files[kmlFileKey].async("string");
              } else {
                console.warn("Aucun fichier .kml trouvé dans l'archive KMZ.");
              }
            } else {
              // Standard uncompressed KML text
              rawText = atob(base64Data);
            }
          } else {
            // Raw string if not formatted as base64 data URL
            rawText = atob(project.identity.kmzFileData);
          }
        } catch (e) {
          console.error("Erreur lors de l'extraction ou décodage du fichier KMZ/KML :", e);
        }
      }

      // Revert to dynamically generated KML if no file was successfully parsed
      if (!rawText) {
        rawText = generateKMLString(project);
      }

      if (!isCancelled) {
        setKmlString(rawText);
        setParsedData(parseKML(rawText));
        setLoadingKml(false);
      }
    };

    loadAndDecode();

    return () => {
      isCancelled = true;
    };
  }, [project.id, project.identity.kmzFileData]);

  // Handle Map and Layers Rendering
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing Leaflet map safely
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Default center coordinates
    const fallbackCenter = getWilayaCoordinates(project.identity.wilaya);
    const centerLatLng: [number, number] = parsedData.points.length > 0 
      ? [parsedData.points[0].lat, parsedData.points[0].lng] 
      : [fallbackCenter.lat, fallbackCenter.lng];

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: centerLatLng,
      zoom: 10,
      zoomControl: true,
      attributionControl: true
    });

    mapRef.current = map;

    // Set appropriate layer URL based on Satellite / Standard
    const tileUrl = mapType === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const tileAttribution = mapType === "satellite"
      ? "Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, and the GIS Community"
      : "&copy; OpenStreetMap contributors";

    const tileLayer = L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      maxZoom: 19
    }).addTo(map);

    layersRef.current.tileLayer = tileLayer;

    const bounds: L.LatLngBounds = L.latLngBounds([]);

    // 1. Draw Wilaya Administrative Boundary
    if (showWilayaBounds && wilayaGeoJson && projectWilayaCode) {
      const wilayaFeatures = wilayaGeoJson.features?.filter((f: any) => {
        const codeVal = parseInt(f.properties?.code || f.properties?.id || f.properties?.wilaya_code, 10);
        if (codeVal === projectWilayaCode) return true;
        const nameVal = (f.properties?.name || f.properties?.name_en || "").toLowerCase();
        if (projectWilayaNameClean && (nameVal.includes(projectWilayaNameClean) || projectWilayaNameClean.includes(nameVal))) return true;
        return false;
      }) || [];

      if (wilayaFeatures.length > 0) {
        const wLayer = L.geoJSON(wilayaFeatures, {
          style: {
            color: "#f59e0b", // Gorgeous Amber 500 border for high satellite contrast
            weight: 3.5,
            opacity: 0.9,
            fillColor: "#f59e0b",
            fillOpacity: 0.04,
            dashArray: "8, 8"
          }
        }).addTo(map);

        const wName = wilayaFeatures[0].properties?.name || wilayaFeatures[0].properties?.name_en || project.identity.wilaya;
        wLayer.bindTooltip(`Limite Wilaya : ${wName}`, { sticky: true, className: "font-bold text-[10px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shadow" });
        layersRef.current.wilayaGeoLayer = wLayer;
        wLayer.getBounds && bounds.extend(wLayer.getBounds());
      }
    }

    // 2. Draw Commune Administrative Boundaries
    if (showCommuneBounds && communeGeoJson && projectWilayaCode) {
      const matchingCommunes = communeGeoJson.features?.filter((f: any) => {
        const codeVal = parseInt(f.properties?.wilaya_code || f.properties?.wilaya_id || f.properties?.code_wilaya || f.properties?.wilaya, 10);
        if (codeVal === projectWilayaCode) return true;
        const wilayaNameVal = (f.properties?.wilaya_name || f.properties?.wilaya_name_ascii || "").toLowerCase();
        if (projectWilayaNameClean && (wilayaNameVal.includes(projectWilayaNameClean) || projectWilayaNameClean.includes(wilayaNameVal))) return true;
        return false;
      }) || [];

      if (matchingCommunes.length > 0) {
        const cLayer = L.geoJSON(matchingCommunes, {
          style: {
            color: "#38bdf8", // Sky blue 400 for satellite visibility
            weight: 1.5,
            opacity: 0.7,
            fillColor: "#38bdf8",
            fillOpacity: 0.02,
            dashArray: "3, 5"
          },
          onEachFeature: (feature, layer) => {
            const cName = feature.properties?.name || feature.properties?.name_en || feature.properties?.commune_name || "Commune";
            layer.bindTooltip(`Commune : ${cName}`, {
              sticky: true,
              className: "bg-slate-950/90 border border-slate-800 text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg"
            });

            // Interactive hover
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({
                  fillColor: "#0ea5e9",
                  fillOpacity: 0.12,
                  weight: 2.2,
                  color: "#0ea5e9"
                });
              },
              mouseout: (e) => {
                cLayer.resetStyle(e.target);
              },
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                setSelectedElement({
                  name: `Commune de ${cName}`,
                  description: `Wilaya administrative de ${project.identity.wilaya}. Tracé de délimitation officiel.`
                });
              }
            });
          }
        }).addTo(map);

        layersRef.current.communesGeoLayer = cLayer;
      }
    }

    // 3. Draw the Gas Pipeline and markers (KML/KMZ parsed data)
    if (showPipeline) {
      if (parsedData.lines.length > 0) {
        parsedData.lines.forEach(line => {
          const polyline = L.polyline(line, {
            color: "#4f46e5", // Indigo main line
            weight: 6,
            opacity: 0.95,
            lineJoin: "round"
          }).addTo(map);

          // Ambient glowing outer outline
          L.polyline(line, {
            color: "#a5b4fc", // Indigo 300 glow
            weight: 12,
            opacity: 0.4,
            lineJoin: "round"
          }).addTo(map);

          layersRef.current.polyline = polyline;
          polyline.getLatLngs().forEach(latlng => bounds.extend(latlng as L.LatLng));
        });
      }

      // Markers
      layersRef.current.markers = [];
      parsedData.points.forEach(pt => {
        let markerHtml = "";
        if (pt.type === "start") {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-5 w-5 bg-emerald-600 border-2 border-white shadow-md"></span>
            </div>
          `;
        } else if (pt.type === "end") {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-rose-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-5 w-5 bg-rose-600 border-2 border-white shadow-md"></span>
            </div>
          `;
        } else if (pt.type === "valve") {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <span class="relative inline-flex rounded-full h-4.5 w-4.5 bg-amber-500 border-2 border-white shadow-md"></span>
            </div>
          `;
        } else {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <span class="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-white shadow-md"></span>
            </div>
          `;
        }

        const customIcon = L.divIcon({
          html: markerHtml,
          className: "custom-leaflet-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([pt.lat, pt.lng], { icon: customIcon }).addTo(map);

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedElement({ name: pt.name, description: pt.description });
        });

        marker.bindPopup(`
          <div class="p-2 font-sans">
            <h4 class="font-black text-slate-800 text-xs">${pt.name}</h4>
            <p class="text-[10px] text-slate-500 mt-1 leading-normal">${pt.description}</p>
          </div>
        `, { closeButton: false });

        layersRef.current.markers.push(marker);
        bounds.extend([pt.lat, pt.lng]);
      });
    }

    // Auto-adjust view boundary
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
    } else {
      map.setView(centerLatLng, 10);
    }

    // Handle map container resizing elegantly
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [
    project.id, 
    parsedData, 
    wilayaGeoJson, 
    communeGeoJson, 
    showPipeline, 
    showWilayaBounds, 
    showCommuneBounds, 
    mapType
  ]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleRecenter = () => {
    if (!mapRef.current) return;
    const bounds = L.latLngBounds([]);
    
    if (showPipeline && (parsedData.lines.length > 0 || parsedData.points.length > 0)) {
      parsedData.lines.forEach(line => line.forEach(pt => bounds.extend(pt)));
      parsedData.points.forEach(pt => bounds.extend([pt.lat, pt.lng]));
    }
    
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else {
      const fallbackCenter = getWilayaCoordinates(project.identity.wilaya);
      mapRef.current.setView([fallbackCenter.lat, fallbackCenter.lng], 10);
    }
  };

  const mapContent = (
    <>
      {/* Top Left: GIS Panel Identity & Layer Control */}
      {isLayersCollapsed ? (
        <div className="absolute top-4 left-4 z-[1000]">
          <button
            onClick={() => setIsLayersCollapsed(false)}
            title="Afficher les calques de carte"
            className="px-3 py-2 bg-slate-950/95 backdrop-blur-md text-indigo-400 hover:text-white rounded-xl border border-slate-800 shadow-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
          >
            <span className="w-5 h-5 flex items-center justify-center bg-indigo-500/10 rounded-lg text-lg font-black">+</span>
            <span>Calques</span>
          </button>
        </div>
      ) : (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 max-w-sm animate-in fade-in slide-in-from-left-4 duration-300">
          {/* Identity Panel */}
          <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-500/20 shrink-0">
                <Globe className={`w-4 h-4 text-indigo-400 ${(loadingGeoJson || loadingKml) ? "animate-spin" : ""}`} />
              </div>
              <div>
                <h6 className="text-[11px] font-black text-white tracking-wider uppercase flex items-center gap-1.5">
                  <span>Portail SIG</span>
                  {(loadingGeoJson || loadingKml) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                  )}
                </h6>
                <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5 max-w-[150px] truncate">{project.name}</p>
              </div>
            </div>
            {/* Collapse button */}
            <button
              onClick={() => setIsLayersCollapsed(true)}
              title="Masquer les calques"
              className="w-6 h-6 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 text-sm font-black transition-colors cursor-pointer"
            >
              −
            </button>
          </div>

          {/* Dynamic Interactive Layer Toggles */}
          <div className="bg-slate-950/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl space-y-2.5">
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800/60 pb-1.5">Calques de carte</p>
            
            {/* Toggle Pipeline */}
            <label className="flex items-center gap-2.5 cursor-pointer text-[10px] font-extrabold text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={showPipeline}
                onChange={(e) => setShowPipeline(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 accent-indigo-500"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shadow"></span>
                <span>Tracé Gazoduc ({project.identity.caracteristiques.longueur || "40"} km)</span>
              </span>
            </label>

            {/* Toggle Wilaya */}
            <label className="flex items-center gap-2.5 cursor-pointer text-[10px] font-extrabold text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={showWilayaBounds}
                onChange={(e) => setShowWilayaBounds(e.target.checked)}
                disabled={!wilayaGeoJson}
                className="w-4 h-4 text-amber-500 bg-slate-900 border-slate-700 rounded focus:ring-amber-500 accent-amber-500 disabled:opacity-50"
              />
              <span className={`flex items-center gap-1.5 ${!wilayaGeoJson ? "opacity-50" : ""}`}>
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow"></span>
                <span>Limites Wilaya ({project.identity.wilaya})</span>
              </span>
            </label>

            {/* Toggle Communes */}
            <label className="flex items-center gap-2.5 cursor-pointer text-[10px] font-extrabold text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={showCommuneBounds}
                onChange={(e) => setShowCommuneBounds(e.target.checked)}
                disabled={!communeGeoJson}
                className="w-4 h-4 text-sky-400 bg-slate-900 border-slate-700 rounded focus:ring-sky-500 accent-sky-400 disabled:opacity-50"
              />
              <span className={`flex items-center gap-1.5 ${!communeGeoJson ? "opacity-50" : ""}`}>
                <span className="w-2 h-2 rounded-full bg-sky-400 shadow"></span>
                <span>Délimitations Communes</span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Top Right: Map Styles & Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
        
        {/* Map Type Switcher */}
        <div className="bg-slate-950/90 backdrop-blur-md p-1 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-1">
          <button
            onClick={() => setMapType("satellite")}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${mapType === "satellite" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Satellite</span>
          </button>
          <button
            onClick={() => setMapType("standard")}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${mapType === "standard" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Standard</span>
          </button>
        </div>

        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          title="Recadrer la carte sur l'ouvrage"
          className="p-2.5 bg-slate-950/90 backdrop-blur-md text-slate-300 hover:text-white rounded-xl border border-slate-800 shadow-xl cursor-pointer hover:bg-slate-900 transition-colors"
        >
          <Compass className="w-4.5 h-4.5 text-indigo-400" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Réduire" : "Plein écran"}
          className="p-2.5 bg-slate-950/90 backdrop-blur-md text-slate-300 hover:text-white rounded-xl border border-slate-800 shadow-xl cursor-pointer hover:bg-slate-900 transition-colors animate-pulse"
        >
          {isFullscreen ? <Minimize2 className="w-4.5 h-4.5 text-indigo-400" /> : <Maximize2 className="w-4.5 h-4.5 text-indigo-400" />}
        </button>
      </div>

      {/* Main Map Container */}
      <div id="leaflet-project-map" ref={mapContainerRef} className="w-full h-full flex-grow bg-slate-950" />

      {/* Bottom overlay: Interactive Details Display Panel */}
      {isLegendCollapsed ? (
        <div className="absolute bottom-4 left-4 z-[1000]">
          <button
            onClick={() => setIsLegendCollapsed(false)}
            title="Afficher la légende"
            className="px-3 py-2 bg-slate-950/95 backdrop-blur-md text-indigo-400 hover:text-white rounded-xl border border-slate-800 shadow-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
          >
            <span className="w-5 h-5 flex items-center justify-center bg-indigo-500/10 rounded-lg text-lg font-black">+</span>
            <span>Légende</span>
          </button>
        </div>
      ) : (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-slate-950/95 backdrop-blur-md px-4 py-3 rounded-2.5xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Collapse button */}
          <button
            onClick={() => setIsLegendCollapsed(true)}
            title="Masquer la légende"
            className="absolute -top-2.5 -right-2.5 z-[1010] w-6 h-6 flex items-center justify-center bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-full border border-slate-800 text-sm font-black shadow-lg transition-transform hover:scale-110 cursor-pointer"
          >
            −
          </button>
          
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl shrink-0 mt-0.5 border border-indigo-500/20">
              <Info className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div className="space-y-0.5">
              <h5 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>{selectedElement?.name || "Légende Technique SIG"}</span>
              </h5>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                {selectedElement?.description || "Cliquez sur un élément de l'ouvrage (PC, Gare de Racleur, Tracé) ou survolez les communes d'Algérie pour charger des informations techniques."}
              </p>
            </div>
          </div>

          {/* Dynamic indicators legend */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/60 py-2 px-3.5 rounded-xl border border-slate-800/50 shrink-0 self-start md:self-center">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white"></span>
              <span>Départ</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white"></span>
              <span>Vanne / PC</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></span>
              <span>Arrivée</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-300">
              <span className="w-3 h-0.5 bg-sky-400 border-b border-dashed"></span>
              <span>Communes</span>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isFullscreen) {
    return (
      <>
        {/* Placeholder Element: Keeps layout stable while the map is projected as a portal */}
        <div className="h-[500px] w-full rounded-3xl bg-slate-950/20 border border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-3 font-bold text-xs">
          <Globe className="w-8 h-8 text-indigo-500/30 animate-pulse" />
          <span>CARTE AFFICHÉE EN PLEIN ÉCRAN</span>
          <button
            onClick={() => setIsFullscreen(false)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-white rounded-xl text-[10px] uppercase font-black tracking-wider transition-colors cursor-pointer"
          >
            Fermer le plein écran
          </button>
        </div>

        {createPortal(
          <div className="fixed inset-0 z-[9999] h-screen w-screen bg-slate-950 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {mapContent}
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="relative bg-slate-950 h-[500px] w-full border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
      {mapContent}
    </div>
  );
}
