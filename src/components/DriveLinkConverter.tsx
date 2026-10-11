import React, { useState } from "react";
import { Link2, Copy, Check, Info, FileImage, ClipboardCopy } from "lucide-react";

export function convertDriveLink(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  
  // 1. Handle GitHub URLs
  if (trimmed.toLowerCase().includes("github.com")) {
    // Match standard pattern: https://github.com/owner/repo/blob/branch/path/to/image.png
    // or with raw/branch/...
    const githubBlobRegex = /https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(blob|raw)\/([^/]+)\/(.+)/i;
    const match = trimmed.match(githubBlobRegex);
    if (match) {
      const owner = match[1];
      const repo = match[2];
      const branch = match[4];
      const filePath = match[5];
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    }
  }

  // 2. Handle Google Drive URLs
  let fileId = "";
  
  // Format 1: /file/d/FILE_ID/...
  const dRegex = /\/file\/d\/([a-zA-Z0-9-_]+)/;
  const dMatch = trimmed.match(dRegex);
  if (dMatch) {
    fileId = dMatch[1];
  } else {
    // Format 2: ?id=FILE_ID or &id=FILE_ID
    const idRegex = /[?&]id=([a-zA-Z0-9-_]+)/;
    const idMatch = trimmed.match(idRegex);
    if (idMatch) {
      fileId = idMatch[1];
    }
  }
  
  if (fileId) {
    // lh3.googleusercontent.com is highly recommended for direct image embedding as it bypasses authorization redirects
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return trimmed;
}

interface DriveLinkConverterProps {
  onUseLink?: (directLink: string) => void;
  compact?: boolean;
}

export default function DriveLinkConverter({ onUseLink, compact = false }: DriveLinkConverterProps) {
  const [inputUrl, setInputUrl] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleConvert = (url: string) => {
    setInputUrl(url);
    const converted = convertDriveLink(url);
    setDirectUrl(converted);
  };

  const handleCopy = () => {
    if (!directUrl) return;
    navigator.clipboard.writeText(directUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isGoogleDriveLink = inputUrl.toLowerCase().includes("drive.google.com") || inputUrl.toLowerCase().includes("docs.google.com");
  const isGitHubLink = inputUrl.toLowerCase().includes("github.com");

  return (
    <div className={`p-5 rounded-3xl border border-slate-200/60 bg-slate-50/50 shadow-[inset_1px_1px_3px_rgba(255,255,255,0.8),_3px_3px_12px_rgba(0,0,0,0.04)] space-y-4 ${compact ? "p-4 rounded-2xl" : ""}`} id="drive-converter-container">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shadow-sm border border-blue-100">
          <Link2 className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Convertisseur Google Drive & GitHub</h4>
          {!compact && (
            <p className="text-[10px] text-slate-400">Rendez vos plans hébergés sur Google Drive ou GitHub compatibles avec l'affichage de l'application.</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Input */}
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-500 block">Lien de partage Google Drive ou URL de fichier GitHub</label>
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Coller le lien (ex: https://github.com/.../blob/main/plan.png)"
              value={inputUrl}
              onChange={(e) => handleConvert(e.target.value)}
              className="w-full bg-slate-100/70 border border-slate-200/50 rounded-xl pl-3.5 pr-10 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium text-slate-700 shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.04)]"
            />
            <div className="absolute right-3 text-slate-400">
              <Link2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Output */}
        {directUrl && (
          <div className="space-y-2 animate-fade-in">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-blue-600 block flex items-center justify-between">
                <span>Lien direct généré</span>
                {isGoogleDriveLink && (
                  <span className="text-[8px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded font-black uppercase">
                    Google Drive Détecté & Converti
                  </span>
                )}
                {isGitHubLink && (
                  <span className="text-[8px] bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">
                    GitHub Détecté & Converti
                  </span>
                )}
              </label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={directUrl}
                  className="flex-1 bg-white/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-blue-600 select-all shadow-sm"
                />
                
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 rounded-xl border border-slate-200 transition-all flex items-center justify-center shadow-sm cursor-pointer active:scale-95 shrink-0"
                  title="Copier le lien direct"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>

                {onUseLink && (
                  <button
                    type="button"
                    onClick={() => onUseLink(directUrl)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    Utiliser
                  </button>
                )}
              </div>
            </div>

            {/* Live Preview if converted */}
            {(isGoogleDriveLink || isGitHubLink) && (
              <div className="border border-slate-200 bg-white rounded-xl p-2.5 flex items-center gap-3 shadow-sm">
                <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                  <img 
                    src={directUrl} 
                    alt="Aperçu du fichier" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // If it fails to load, show file icon placeholder
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <FileImage className="w-5 h-5 text-slate-400 absolute inset-auto z-0" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 truncate">Aperçu en direct du dessin d'ingénierie</p>
                  <p className="text-[8px] text-slate-400 flex items-center gap-0.5">
                    <Info className="w-2.5 h-2.5" />
                    <span>Lien direct optimal prêt pour la galerie</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
