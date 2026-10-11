// PATCH 012 — license keys and deployment fallback
// PATCH 011 — Super admin shell and landing restore
// PATCH 010 — simulated auth activation
// PATCH 009 — User profile account space
// PATCH 008 — SaaS tabs flow
// PATCH 007e — compact floating props landing restore
import React, { useEffect, useMemo, useState } from "react";
import { PDI_PATCH_VERSION } from "../pdiVersion";

// PATCH 017B : filet de securite. Une erreur d execution dans l editeur ISO
// affichait une page totalement vide apres rechargement. On affiche desormais
// un message et un bouton de reinitialisation de l espace de travail.
class PdiModuleErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { failed: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, message: error instanceof Error ? error.message : String(error) };
  }

  resetWorkspace = () => {
    try {
      const keys = [
        "pdi.activeModule.v1",
        "pdi.tabs.v1",
        "pdi.activeTabId.v1",
        "pdi.commandPromptHidden.v1",
        "pdi.workspaceVisualStyle.v1",
      ];
      keys.forEach(k => window.localStorage.removeItem(k));
      window.localStorage.setItem("pdi.activeModule.v1", "isometric");
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: "#070B12", color: "#E5EDF8", display: "grid", placeItems: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 620, border: "1px solid rgba(103,232,249,.35)", borderRadius: 20, padding: 24, background: "linear-gradient(180deg,#111C2A,#08111C)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#67E8F9" }}>Espace de travail PD&amp;I</div>
          <h2 style={{ margin: "8px 0 10px", fontSize: 22 }}>Le module n a pas pu s afficher</h2>
          <p style={{ color: "#AFC4DD", fontWeight: 700, lineHeight: 1.6 }}>
            Une erreur est survenue au chargement. Vos plans enregistres ne sont pas perdus :
            seuls les reglages d affichage vont etre reinitialises.
          </p>
          <pre style={{ background: "#050B12", border: "1px solid rgba(103,232,249,.25)", borderRadius: 10, padding: 10, color: "#A7F3D0", fontSize: 11, whiteSpace: "pre-wrap" }}>{this.state.message}</pre>
          <button type="button" onClick={this.resetWorkspace} style={{ marginTop: 12, border: 0, borderRadius: 14, padding: "12px 16px", fontWeight: 900, color: "white", background: "linear-gradient(135deg,#0284C7,#22D3EE)", cursor: "pointer" }}>
            Reinitialiser l espace de travail
          </button>
        </div>
      </div>
    );
  }
}
import PdiBrandMark from "./PdiBrandMark";
import { Folder, FolderOpen, Plus, X, Layers, FileText, Pin, Trash2, LayoutGrid, Search, CheckSquare, Square, Home, Box, HardDrive, PenTool, FileCode, Code2, Printer, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import PdiIsometricEditor from "../isometric/PdiIsometricEditor";
import { SketchToIsoModule } from "../sketch/SketchToIsoModule";
// PATCH 004c : modules applicatifs PD&I
import HomePdi from "../home/HomePdi";
import PdiIllustratorHome from "../home/PdiIllustratorHome";
import PdiAuthPage from "../auth/PdiAuthPage";
import { GoogleDriveWorkspace } from "../../components/GoogleDriveWorkspace";
import isoPiping3D from "../../assets/images/pdi_iso_piping_3d_1787006532562.jpg";
import valve3D from "../../assets/images/pdi_valve_3d_1787006543831.jpg";
import plantScan3D from "../../assets/images/pdi_plant_scan_3d_1787006555680.jpg";
import cadSpool3D from "../../assets/images/pdi_cad_spool_3d_1787006567003.jpg";
// PATCH 017K
import { pdiConfirm } from "../ui/PdiConfirm";
// PATCH 017K2
import { pdiAlert } from "../ui/PdiNotice";
// PATCH 017K2
import { PdiCompanyPanel } from "../ui/PdiCompanyPanel";
import { PdiSuperAdminConsole } from "../superadmin/PdiSuperAdminConsole";
import { PdiFeedbackModal } from "../feedback/PdiFeedbackModal";
import { PdiNewProjectModal } from "../modals/PdiNewProjectModal";
import { recordSubscriberUsage, changeUserProfilePassword } from "../../lib/firebase";
import { projectsApi } from "../../lib/pdiApiClient";

type PdiModule = "home" | "isometric" | "drive" | "vision" | "sketch" | "cad" | "json" | "pdf" | "projects" | "assistant" | "profile" | "subscription" | "super_admin_console" | "license_keys";
type PdiWorkspaceTab = { id: string; title: string; module: PdiModule; projectId: string; dirty?: boolean; createdAt: string };

// PATCH 004c : cle de session de l'etape publique.
const PDI_STAGE_KEY = "pdi.stage.v4";
const PDI_TABS_KEY = "pdi.tabs.v1";
const PDI_ACTIVE_TAB_KEY = "pdi.activeTabId.v1";
const PDI_AUTH_KEY = "pdi.auth.mode.v1";

// PATCH 017B : modules reellement rendus par la coquille.
// Un module absent de cette liste (ex: "projects" ou une valeur heritee)
// provoquait un espace de travail vide apres rechargement.
const PDI_RENDERABLE_MODULES: PdiModule[] = [
  "home", "isometric", "drive", "vision", "sketch", "cad", "json", "pdf",
  "projects", "assistant", "profile", "subscription",
  "super_admin_console", "license_keys",
];

// PATCH 017F1 : index des projets PD&I de ce poste.
// Un projet survit a la fermeture de son onglet : il reste ouvrable depuis
// l ecran Mes projets, avec sa propre sauvegarde locale.
const PDI_PROJECT_INDEX_KEY = "pdi.projects.index.v1";

type PdiProjectIndexEntry = { projectId: string; title: string; module: PdiModule; updatedAt: string };

function pdiReadProjectIndex(): PdiProjectIndexEntry[] {
  try {
    const raw = window.localStorage.getItem(PDI_PROJECT_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.projectId === "string");
  } catch { return []; }
}

function pdiWriteProjectIndex(entries: PdiProjectIndexEntry[]) {
  try { window.localStorage.setItem(PDI_PROJECT_INDEX_KEY, JSON.stringify(entries)); } catch {}
}

function pdiUpsertProject(entry: { projectId: string; title: string; module: PdiModule }) {
  const list = pdiReadProjectIndex();
  const now = new Date().toISOString();
  const found = list.find((item) => item.projectId === entry.projectId);
  if (found) { found.title = entry.title; found.module = entry.module; found.updatedAt = now; }
  else list.push({ projectId: entry.projectId, title: entry.title, module: entry.module, updatedAt: now });
  pdiWriteProjectIndex(list);
}

function pdiRemoveProject(projectId: string) {
  pdiWriteProjectIndex(pdiReadProjectIndex().filter((item) => item.projectId !== projectId));
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.indexOf(".project." + projectId + ".") !== -1) doomed.push(key);
    }
    doomed.forEach((key) => window.localStorage.removeItem(key));
  } catch {}
}

// PATCH 017E : sessions locales autosauvegardees par l editeur ISO.
// Sert d ecran "Mes projets" reel au lieu d un espace vide.
type PdiLocalSession = {
  key: string;
  name: string;
  nodes: number;
  segments: number;
  updatedAt: string;
  // PATCH 017F2 : chaque sauvegarde sait a quel projet elle appartient.
  projectId: string;
  archive: boolean;
};

function pdiListLocalSessions(): PdiLocalSession[] {
  const out: PdiLocalSession[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || key.indexOf("isometrie.autosave.") !== 0) continue;
      // PATCH 017F2 : les archives ".previous" ne sont plus listees. Elles
      // dupliquaient chaque projet et rendaient l ouverture ambigue.
      const isCurrent = key.slice(-8) === ".current";
      if (!isCurrent) continue;
      const isPrevious = false;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const snap = JSON.parse(raw);
        const nodes = Array.isArray(snap?.model?.nodes) ? snap.model.nodes.length : 0;
        const segments = Array.isArray(snap?.model?.segments) ? snap.model.segments.length : 0;
        if (nodes === 0 && segments === 0) continue;
        // PATCH 017F2 : identification du projet porteur de la sauvegarde.
        const marker = ".project.";
        const at = key.indexOf(marker);
        const projectId = at >= 0 ? key.slice(at + marker.length, key.lastIndexOf(".")) : "default";
        out.push({
          key,
          projectId,
          name: String(snap?.project?.name || "Projet isometrique"),
          nodes,
          segments,
          updatedAt: String(snap?.project?.updatedAt || "").slice(0, 16).replace("T", " "),
          archive: isPrevious,
        });
      } catch {}
    }
  } catch {}
  // PATCH 017F2 : une seule ligne par projet, la plus recente.
  const sorted = out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const seen: Record<string, boolean> = {};
  return sorted.filter((session) => {
    if (seen[session.projectId]) return false;
    seen[session.projectId] = true;
    return true;
  });
}

// PATCH 017F2 : une sauvegarde locale sans entree d index (plan dessine avant
// 017F1, ou projet supprime de l index par erreur) devient un projet visible.
function pdiAdoptOrphanSessions(): number {
  let added = 0;
  try {
    const index = pdiReadProjectIndex();
    pdiListLocalSessions().forEach((session) => {
      if (index.some((entry) => entry.projectId === session.projectId)) return;
      pdiUpsertProject({
        projectId: session.projectId,
        title: session.name || "Projet isometrique",
        module: "isometric",
      });
      added += 1;
    });
  } catch {}
  return added;
}
const pdiSafeModule = (value: unknown, fallback: PdiModule): PdiModule => {
  return PDI_RENDERABLE_MODULES.includes(value as PdiModule) ? (value as PdiModule) : fallback;
};

type LaunchCard = {
  id: PdiModule;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  ready?: boolean;
};

const launchCards: LaunchCard[] = [
  { id: "isometric", title: "Dessin isométrique", subtitle: "Créer un projet manuel avec nœuds, tubes, équipements, cotations et alignements.", badge: "V4.8d1", icon: "ISO", ready: true },
  { id: "drive", title: "Google Drive & Cloud SQL", subtitle: "Synchroniser, archiver et exporter vos plans et projets ISO sur Google Drive et PostgreSQL.", badge: "Drive & SQL", icon: "DRV", ready: true },
  { id: "vision", title: "Vision PD&I", subtitle: "Transformer une photo de plant réel en JSON piping puis en ISO après validation.", badge: "Photo → ISO", icon: "VIS" },
  { id: "sketch", title: "Croquis → ISO", subtitle: "Importer un dessin à la main, extraire le réseau, valider le JSON puis générer l’ISO.", badge: "Croquis", icon: "CRQ" },
  { id: "cad", title: "Importer CAO / DXF", subtitle: "Lire un DXF/PDF, extraire calques/lignes/blocs et convertir vers JSON PD&I.", badge: "DXF/PDF", icon: "DX" },
  { id: "json", title: "Ouvrir JSON PD&I", subtitle: "Charger ou vérifier le modèle central : lignes, nœuds, équipements, soudures, cotations.", badge: "JSON", icon: "{}" },
  { id: "pdf", title: "Impression / exports", subtitle: "Préparer PDF, DXF, planches A4/A3/A2/A1, cartouche et nomenclature.", badge: "PDF/DXF", icon: "OUT" },
];

const showcase = [
  {
    title: "Dessin isométrique 3D",
    text: "Moteur vectoriel temps-réel, tubes DN, robinetterie, cotations automatiques et alignements spatiaux.",
    tag: "ISO 3D",
    color: "#0ea5e9",
    image: isoPiping3D,
    caption: "Réseau tuyauterie inox & collecteurs haute fidélité",
  },
  {
    title: "Vision PD&I Réelle",
    text: "Photo d'installation réelle → segmentation 3D → JSON piping → validation industrielle.",
    tag: "VISION 3D",
    color: "#f97316",
    image: plantScan3D,
    caption: "Scan & détection des composants de tuyauterie",
  },
  {
    title: "Croquis & Modèle CAO",
    text: "Reconnaissance de tracés main, génération instantanée du spool 3D et cotations.",
    tag: "CROQUIS 3D",
    color: "#8b5cf6",
    image: cadSpool3D,
    caption: "Spool préfabriqué avec cotes isométriques",
  },
  {
    title: "Organes & Robinets 3D",
    text: "Vannes à passage direct, papillons, brides et by-pass intégrés en bibliothèque standard.",
    tag: "EQUIP 3D",
    color: "#22c55e",
    image: valve3D,
    caption: "Robinetterie industrielle & instrumentation",
  },
  {
    title: "Plans & Cartouches ISO",
    text: "Exportation PDF/DXF normalisée A4/A3/A2/A1 avec nomenclature automatique (BOM).",
    tag: "EXPORT",
    color: "#eab308",
    image: isoPiping3D,
    caption: "Planche d'exécution et dossier de fabrication",
  },
  {
    title: "Jumeau Numérique & IA",
    text: "Agents spécialisés pipeline-design-skill pour l'assistance et la vérification des règles de l'art.",
    tag: "DIGITAL TWIN",
    color: "#06b6d4",
    image: plantScan3D,
    caption: "Modélisation intelligente assistée par IA",
  },
];

// PATCH 017K : pile de navigation et contextes projet.
const PDI_NAV_STACK_017K: string[] = [];
let pdiPrevModule017K: string | null = null;
const PDI_PROJECT_CONTEXT_017K: string[] = ["isometric", "cad", "json", "pdf", "sketch", "drive"];

const PDI_NAV_THEMES: Record<string, { color: string; lightColor: string; bgGlow: string; code: string; label: string }> = {
  home: { color: "#38BDF8", lightColor: "#60A5FA", bgGlow: "rgba(56,189,248,0.18)", code: "⌂", label: "ACCUEIL" },
  isometric: { color: "#06B6D4", lightColor: "#22D3EE", bgGlow: "rgba(6,182,212,0.18)", code: "ISO", label: "ISO" },
  drive: { color: "#F59E0B", lightColor: "#FBBF24", bgGlow: "rgba(245,158,11,0.18)", code: "DRV", label: "DRIVE" },
  sketch: { color: "#A855F7", lightColor: "#C084FC", bgGlow: "rgba(168,85,247,0.18)", code: "CRQ", label: "CROQUIS" },
  cad: { color: "#3B82F6", lightColor: "#60A5FA", bgGlow: "rgba(59,130,246,0.18)", code: "DX", label: "CAO" },
  json: { color: "#F97316", lightColor: "#FB923C", bgGlow: "rgba(249,115,22,0.18)", code: "{}", label: "JSON" },
  pdf: { color: "#F43F5E", lightColor: "#FB7185", bgGlow: "rgba(244,63,94,0.18)", code: "PDF", label: "EXPORT" },
};

const navItems: Array<{ id: PdiModule; label: string; icon: React.ReactNode; code: string; title: string }> = [
  { id: "home", label: "Accueil", code: "⌂", icon: <Home className="h-4 w-4 text-sky-400" />, title: "Accueil PD&I" },
  { id: "isometric", label: "ISO", code: "ISO", icon: <Box className="h-4 w-4 text-cyan-400" />, title: "Dessin isométrique" },
  { id: "drive", label: "Drive", code: "DRV", icon: <HardDrive className="h-4 w-4 text-amber-400" />, title: "Google Drive & Cloud SQL" },
  { id: "sketch", label: "Croquis", code: "CRQ", icon: <PenTool className="h-4 w-4 text-purple-400" />, title: "Croquis vers JSON/ISO" },
  { id: "cad", label: "CAO", code: "DX", icon: <FileCode className="h-4 w-4 text-blue-400" />, title: "Import CAD/DXF/PDF" },
  { id: "json", label: "JSON", code: "{}", icon: <Code2 className="h-4 w-4 text-orange-400" />, title: "Modèle JSON PD&I" },
  { id: "pdf", label: "Export", code: "PDF", icon: <Printer className="h-4 w-4 text-rose-400" />, title: "PDF / DXF / Impression" },
];

function ComingSoonPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="pdi-module-panel"><div className="pdi-panel-kicker">Module préparé</div><h1>{title}</h1><div className="pdi-panel-body">{children}</div></section>;
}

export default function PdiUnifiedApp() {
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  const [authMode, setAuthMode] = useState<"guest" | "demo" | "pending_email" | "client" | "admin" | "super_admin">(() => {
    try {
      return (window.localStorage.getItem(PDI_AUTH_KEY) as any) || "super_admin";
    } catch {
      return "super_admin";
    }
  });

  const [activeModule, setActiveModule] = useState<PdiModule>(() => {
    try {
      const saved = window.localStorage.getItem("pdi.activeModule.v1") as PdiModule;
      const auth = window.localStorage.getItem(PDI_AUTH_KEY) || "demo";
      const isConnected = auth !== "guest" && auth !== "pending_email";
      if (isConnected) {
        // PATCH 017B : on ne restaure qu'un module reellement affichable.
        return (saved && saved !== "home") ? pdiSafeModule(saved, "isometric") : "isometric";
      }
      return pdiSafeModule(saved, "home");
    } catch {
      return "isometric";
    }
  });
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [authPanelMode, setAuthPanelMode] = useState<"login" | "register" | "activation">("login");
  const [authDraft, setAuthDraft] = useState({ name: "", email: "", company: "", password: "", plan: "demo" });
  const [activationToken, setActivationToken] = useState<string | null>(() => { try { return window.localStorage.getItem("pdi.activation.pendingToken.v1"); } catch { return null; } });
  const startDemoSession = () => { setAuthMode("demo"); try { window.localStorage.setItem(PDI_AUTH_KEY,"demo"); window.sessionStorage.setItem(PDI_STAGE_KEY,"app"); window.localStorage.setItem("pdi.force.app.v1","1"); window.localStorage.setItem("pdi.activeModule.v1","isometric"); } catch {} setStage("app"); setActiveModule("isometric"); };
  const submitRegisterSimulated = () => {
    if (!authDraft.email || !authDraft.name || authDraft.password.length < 6) { setAuthPanelMode("register"); return; }
    const token = `pdi-act-${Date.now().toString(36)}`;
    setActivationToken(token);
    setAuthMode("pending_email");
    try { window.localStorage.setItem("pdi.activation.pendingToken.v1", token); window.localStorage.setItem("pdi.auth.pendingUser.v1", JSON.stringify({ ...authDraft, password: undefined, status:"pending_email" })); } catch {}
    setAuthPanelMode("activation");
  };
  const activateSimulatedAccount = () => { setAuthMode("client"); try { window.localStorage.removeItem("pdi.activation.pendingToken.v1"); window.localStorage.setItem(PDI_AUTH_KEY,"client"); window.sessionStorage.setItem(PDI_STAGE_KEY,"app"); window.localStorage.setItem("pdi.force.app.v1","1"); window.localStorage.setItem("pdi.activeModule.v1","isometric"); } catch {} setStage("app"); setActiveModule("isometric"); };

  const [savedUserProfile, setSavedUserProfile] = useState(() => {
    try {
      const raw = window.localStorage.getItem("pdi.user.profile.v1");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      name: "Youcef Seif Eddine Boudjada",
      email: "boudjada.youcef@gmail.com",
      role: "super_admin",
      company: "PD&I Vision DZ",
      country: "Algérie",
      plan: "Pro",
      emailStatus: "confirmé",
      createdAt: "2026-08-20"
    };
  });

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState("");
  const [isSubmittingPasswordChange, setIsSubmittingPasswordChange] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError("");
    setPasswordChangeSuccess("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordChangeError("Veuillez remplir tous les champs de mot de passe.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordChangeError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    try {
      setIsSubmittingPasswordChange(true);
      await changeUserProfilePassword(pdiUserProfile.email, oldPassword, newPassword);
      setPasswordChangeSuccess("Votre mot de passe a été modifié avec succès !");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      setPasswordChangeError(err.message || "Impossible de changer le mot de passe.");
    } finally {
      setIsSubmittingPasswordChange(false);
    }
  };

  const pdiUserProfile = {
    name: savedUserProfile?.name || "Youcef Seif Eddine Boudjada",
    email: savedUserProfile?.email || "boudjada.youcef@gmail.com",
    role: authMode,
    company: savedUserProfile?.company || "PD&I Vision DZ",
    country: savedUserProfile?.country || "Algérie",
    plan: authMode === "guest" ? "Guest" : authMode === "demo" ? "Demo" : (savedUserProfile?.plan || "Pro"),
    emailStatus: "confirmé",
    createdAt: savedUserProfile?.createdAt || "2026-08-20",
  };

  const [licenseKeys, setLicenseKeys] = useState<Array<{ id:string; code:string; type:string; plan:string; status:string; email:string; createdAt:string; expiresAt:string }>>(() => {
    try { return JSON.parse(window.localStorage.getItem("pdi.license.keys.v1") || "[]"); } catch { return []; }
  });
  const [licenseDraft, setLicenseDraft] = useState({ type:"TRIAL_30", plan:"PRO", email:"" });
  const persistLicenseKeys = (keys: typeof licenseKeys) => { setLicenseKeys(keys); try { window.localStorage.setItem("pdi.license.keys.v1", JSON.stringify(keys)); } catch {} };
  const generateLicenseKey = () => {
    const id = `lic-${Date.now().toString(36)}`;
    const code = `PDI-${licenseDraft.type}-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const days = licenseDraft.type.includes("7") ? 7 : licenseDraft.type.includes("30") ? 30 : licenseDraft.type.includes("YEAR") ? 365 : 90;
    const expiresAt = new Date(Date.now()+days*86400000).toISOString().slice(0,10);
    persistLicenseKeys([{ id, code, type:licenseDraft.type, plan:licenseDraft.plan, status:"generated", email:licenseDraft.email, createdAt:new Date().toISOString().slice(0,10), expiresAt }, ...licenseKeys]);
  };
  const revokeLicenseKey = (id:string) => persistLicenseKeys(licenseKeys.map(k=>k.id===id?{...k,status:"revoked"}:k));

  const [workspaceTabs, setWorkspaceTabs] = useState<PdiWorkspaceTab[]>(() => { try { return JSON.parse(window.localStorage.getItem(PDI_TABS_KEY) || "[]"); } catch { return []; } });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => { try { return window.localStorage.getItem(PDI_ACTIVE_TAB_KEY); } catch { return null; } });
  // PATCH 017E : dock d onglets de l editeur ISO.
  const [isoTabDockOpen, setIsoTabDockOpen] = useState(true);
  // Synchronisation de l'état du rail latéral gauche avec l'éditeur ISO
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem("pdi.rail.collapsed.v1") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    const handleRailToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.collapsed === "boolean") {
        setRailCollapsed(detail.collapsed);
      } else {
        try { setRailCollapsed(window.localStorage.getItem("pdi.rail.collapsed.v1") === "1"); } catch {}
      }
    };
    window.addEventListener("pdi:rail-toggle", handleRailToggle);
    window.addEventListener("storage", handleRailToggle);
    return () => {
      window.removeEventListener("pdi:rail-toggle", handleRailToggle);
      window.removeEventListener("storage", handleRailToggle);
    };
  }, []);
  // PATCH 017F1 : projet actif de l onglet, renommage en ligne, rafraichissement
  // de l ecran Mes projets.
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [projectsRefresh, setProjectsRefresh] = useState(0);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const activeWorkspaceTab = workspaceTabs.find((t) => t.id === activeTabId) || null;
  const activeProjectId = activeWorkspaceTab?.projectId || "default";
  const beginRenameTab = (tab: PdiWorkspaceTab) => { setRenamingTabId(tab.id); setRenameDraft(tab.title); };
  const commitRenameTab = (id: string) => {
    const cleaned = renameDraft.trim();
    setRenamingTabId(null);
    if (!cleaned) return;
    const tabs = workspaceTabs.map((t) => (t.id === id ? { ...t, title: cleaned } : t));
    setWorkspaceTabs(tabs);
    persistTabs(tabs, activeTabId);
    const target = tabs.find((t) => t.id === id);
    if (target) pdiUpsertProject({ projectId: target.projectId, title: cleaned, module: target.module });
    setProjectsRefresh((v) => v + 1);
  };
  // PATCH 017F1B : supprimer un projet doit aussi fermer ses onglets, sinon le
  // nom reste affiche dans la barre alors que le projet n existe plus.
  const closeTabsForProject = (projectId: string) => {
    const tabs = workspaceTabs.filter((t) => t.projectId !== projectId);
    if (tabs.length === workspaceTabs.length) return;
    const next = tabs[tabs.length - 1] || null;
    setWorkspaceTabs(tabs);
    setActiveTabId(next?.id || null);
    persistTabs(tabs, next?.id || null);
    if (!next) setActiveModule("projects");
    else if (renamingTabId && !tabs.some((t) => t.id === renamingTabId)) setRenamingTabId(null);
  };
  const openProjectInTab = (entry: { projectId: string; title: string; module: PdiModule }) => {
    const existing = workspaceTabs.find((t) => t.projectId === entry.projectId);
    if (existing) { switchTab(existing.id); return; }
    openModuleInTab(entry.module || "isometric", entry.title, entry.projectId);
  };
  const persistTabs = (tabs: PdiWorkspaceTab[], id: string | null) => { try { window.localStorage.setItem(PDI_TABS_KEY, JSON.stringify(tabs)); if(id) window.localStorage.setItem(PDI_ACTIVE_TAB_KEY,id); } catch {} };
  const canOpenWorkspaceModule = authMode === "demo" || authMode === "client" || authMode === "admin" || authMode === "super_admin";
  const openModuleInTab = (module: PdiModule, title?: string, projectId?: string) => {
    if (!canOpenWorkspaceModule && module !== "home") {
      setAuthMode("demo");
      try { window.localStorage.setItem(PDI_AUTH_KEY, "demo"); } catch {}
    }
    if (module === "home") { setActiveModule("home"); return; }
    const id = `tab-${Date.now().toString(36)}`;
    // PATCH 017F1 : un onglet = un projet identifie, reutilisable et renommable.
    const resolvedTitle = title || navItems.find(x=>x.id===module)?.title || "Projet PD&I";
    const resolvedProjectId = projectId || `project-${Date.now().toString(36)}`;
    const next: PdiWorkspaceTab = { id, title: resolvedTitle, module, projectId: resolvedProjectId, dirty: false, createdAt: new Date().toISOString() };
    const tabs = [...workspaceTabs, next]; setWorkspaceTabs(tabs); setActiveTabId(id); setActiveModule(module); persistTabs(tabs,id);
    pdiUpsertProject({ projectId: resolvedProjectId, title: resolvedTitle, module });
    setProjectsRefresh((v) => v + 1);
  };
  const switchTab = (id: string) => { const tab = workspaceTabs.find(t=>t.id===id); if(!tab) return; setActiveTabId(id); setActiveModule(tab.module); persistTabs(workspaceTabs,id); };
  const closeTab = (id: string) => { const tabs = workspaceTabs.filter(t=>t.id!==id); const next = tabs[tabs.length-1] || null; setWorkspaceTabs(tabs); setActiveTabId(next?.id || null); setActiveModule(next?.module || "home"); persistTabs(tabs,next?.id || null); };

  // ÉTAPE 5 : Modal Nouveau Projet & Raccordement ISO
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const handleOpenNewProject = (params: {
    name: string;
    service: string;
    dn: number;
    pressureClass: string;
    material: string;
    mode: "sketch" | "blank" | "cad";
  }) => {
    const projId = `project-${Date.now().toString(36)}`;
    if (params.mode === "sketch") {
      try {
        window.localStorage.setItem("pdi.sketch.projectName", params.name);
        window.localStorage.setItem("pdi.sketch.service", params.service);
        window.localStorage.setItem("pdi.sketch.dn", String(params.dn));
        window.localStorage.setItem("pdi.sketch.pressureClass", params.pressureClass);
        window.localStorage.setItem("pdi.sketch.material", params.material);
      } catch {}
      openModuleInTab("sketch", `Croquis · ${params.name}`, projId);
    } else if (params.mode === "blank") {
      openModuleInTab("isometric", params.name, projId);
    } else if (params.mode === "cad") {
      openModuleInTab("cad", `CAD · ${params.name}`, projId);
    }
  };

  // Rechargement : conserve dans le module ISO ou Accueil dans l'application
  const [stage, setStage] = useState<"landing" | "auth" | "app">((): "landing" | "auth" | "app" => {
    try {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash.includes("landing") || search.includes("landing") || search.includes("commercial")) {
        return "landing";
      }
      if (hash.includes("auth") || hash.includes("login") || search.includes("auth") || search.includes("login")) {
        return "auth";
      }
      if (hash.includes("app") || search.includes("app")) {
        return "app";
      }
    } catch {}
    return "landing";
  });
  const [authPageTab, setAuthPageTab] = useState<"login" | "register" | "activation">("login");

  // Synchronisation dynamique du stage avec les changements d'ancres URL (#landing, #auth, #app)
  useEffect(() => {
    const handleHashChange = () => {
      try {
        const hash = window.location.hash.toLowerCase();
        if (hash === "#landing" || hash === "#commercial") {
          setStage("landing");
        } else if (hash === "#auth" || hash === "#login" || hash === "#connexion") {
          setStage("auth");
        } else if (hash === "#app") {
          setStage("app");
        }
      } catch {}
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const enterApp = React.useCallback((target?: string) => {
    try {
      const auth = window.localStorage.getItem(PDI_AUTH_KEY);
      if (!auth || auth === "guest" || auth === "pending_email") {
        setAuthPageTab("login");
        setStage("auth");
        try { window.location.hash = "auth"; } catch {}
        return;
      }
      window.sessionStorage.setItem(PDI_STAGE_KEY, "app");
      window.localStorage.setItem("pdi.force.app.v1", "1");
    } catch {
      /* stockage indisponible */
    }
    setStage("app");
    try { window.location.hash = "app"; } catch {}

    const allowed: PdiModule[] = [
      "home",
      "isometric",
      "drive",
      "vision",
      "sketch",
      "cad",
      "json",
      "pdf",
      "projects",
      "assistant",
      "profile",
      "subscription",
      "super_admin_console",
      "license_keys"
    ];

    const dest = (target && allowed.includes(target as PdiModule) ? (target as PdiModule) : "home");
    setActiveModule(dest);
    try { window.localStorage.setItem("pdi.activeModule.v1", dest); } catch {}
    window.scrollTo(0, 0);
  }, []);

  const handleLogoutToHome = React.useCallback(() => {
    try {
      window.sessionStorage.removeItem(PDI_STAGE_KEY);
      window.localStorage.removeItem("pdi.force.app.v1");
      window.localStorage.setItem(PDI_AUTH_KEY, "guest");
      window.localStorage.setItem("pdi.activeModule.v1", "home");
    } catch {}
    setAuthMode("guest");
    setAuthPageTab("login");
    setStage("auth");
    try { window.location.hash = "auth"; } catch {}
    setActiveModule("home");
    setAccountMenuOpen(false);
  }, []);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<PdiModule | "landing" | "launcher" | "logout" | "landing_home" | string>).detail;
      // PATCH 005 : navigation ciblee stabilisee.
      const allowed: PdiModule[] = [
        "home",
        "isometric",
        "drive",
        "vision",
        "sketch",
        "cad",
        "json",
        "pdf",
        "projects",
        "assistant",
        "profile",
        "subscription",
      ];
      if (detail === "landing" || detail === "portal" || detail === "commercial" || detail === "landing_home") {
        setStage("landing");
        try { window.location.hash = "landing"; } catch {}
        return;
      }
      if (detail === "auth" || detail === "login") {
        setStage("auth");
        try { window.location.hash = "auth"; } catch {}
        return;
      }
      if (detail === "logout") {
        handleLogoutToHome();
        return;
      }
      setStage("app");
      try {
        window.sessionStorage.setItem(PDI_STAGE_KEY, "app");
        window.location.hash = "app";
      } catch {}
      setActiveModule(allowed.includes(detail as PdiModule) ? (detail as PdiModule) : "home");
    };
    window.addEventListener("pdi:navigate", onNavigate as EventListener);
    return () => window.removeEventListener("pdi:navigate", onNavigate as EventListener);
  }, [handleLogoutToHome]);

  useEffect(() => { try { window.localStorage.setItem(PDI_AUTH_KEY, authMode); } catch {} }, [authMode]);

  // -------------------------------------------------------------
  // PD&I 018S : Inactivity Session Timeout and Verification Logic
  // -------------------------------------------------------------
  useEffect(() => {
    if (stage !== "app") return;

    // We define an inactivity limit of 30 minutes (1800000 ms)
    const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
    let lastActivityTime = Date.now();

    const updateActivity = () => {
      lastActivityTime = Date.now();
    };

    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("click", updateActivity);
    window.addEventListener("scroll", updateActivity);

    const intervalId = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      if (timeSinceLastActivity >= INACTIVITY_LIMIT_MS) {
        console.warn("Session inactivity timeout reached.");
        handleLogoutToHome();
        void pdiAlert("Votre session a expiré en raison de votre inactivité (30 minutes). Veuillez vous reconnecter pour sécuriser vos données.");
      }
    }, 15000); // Check every 15 seconds

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      clearInterval(intervalId);
    };
  }, [stage, handleLogoutToHome]);
  useEffect(() => { 
    try { 
      window.localStorage.setItem("pdi.activeModule.v1", activeModule);
      window.dispatchEvent(
        new CustomEvent("pdi:active-module-changed", {
          detail: { activeModule },
        })
      );
      if (activeModule && authMode !== "guest") {
        void recordSubscriberUsage({
          userId: pdiUserProfile.email,
          userEmail: pdiUserProfile.email,
          module: activeModule,
          action: "open_module",
        });
      }
    } catch {} 
  }, [activeModule, authMode, pdiUserProfile.email]);
  useEffect(() => { const tab = workspaceTabs.find(t=>t.id===activeTabId); if(tab && activeModule === "home") setActiveModule(tab.module); }, []);

  // PATCH 017K : retour reel, alimente par la pile de navigation.
  useEffect(() => {
    if (pdiPrevModule017K && pdiPrevModule017K !== activeModule) PDI_NAV_STACK_017K.push(pdiPrevModule017K);
    pdiPrevModule017K = activeModule;
  }, [activeModule]);
  const pdiGoBack017K = () => {
    const prev = PDI_NAV_STACK_017K.pop();
    setActiveModule((prev && prev !== activeModule ? prev : "home") as PdiModule);
  };
  const moduleTitle = useMemo(() => navItems.find((x) => x.id === activeModule)?.title || "PD&I", [activeModule]);

  // STAGE 1 : PAGE COMMERCIALE (HOME PDI / LANDING)
  if (stage === "landing") {
    return (
      <HomePdi
        onEnterModule={(mod) => {
          setStage("app");
          setAuthMode("demo");
          try { window.location.hash = "app"; } catch {}
          if (mod && mod !== "home") {
            openModuleInTab(mod as PdiModule);
          } else {
            setActiveModule("home");
          }
        }}
        onNewProject={() => {
          setStage("app");
          setAuthMode("demo");
          setActiveModule("home");
          setNewProjectModalOpen(true);
          try { window.location.hash = "app"; } catch {}
        }}
        onOpenProject={() => {
          setStage("app");
          setAuthMode("demo");
          openModuleInTab("projects", "Mes Projets");
          try { window.location.hash = "app"; } catch {}
        }}
        onLoginRequest={(req) => {
          if (req === "register") {
            setAuthPageTab("register");
          } else {
            setAuthPageTab("login");
          }
          setStage("auth");
          try { window.location.hash = "auth"; } catch {}
        }}
        userEmail={pdiUserProfile.email}
        isLoggedIn={authMode !== "guest"}
      />
    );
  }

  // STAGE 2 : PAGE CONNEXION / AUTHENTIFICATION
  if (stage === "auth") {
    return (
      <PdiAuthPage
        initialTab={authPageTab}
        onBackToLanding={() => {
          setStage("landing");
          try { window.location.hash = "landing"; } catch {}
        }}
        onSuccess={(profile, isSuper) => {
          const role = isSuper ? "super_admin" : (profile.role || "client");
          setAuthMode(role as any);
          setSavedUserProfile(profile);
          try {
            window.localStorage.setItem(PDI_AUTH_KEY, role);
            window.localStorage.setItem("pdi.user.profile.v1", JSON.stringify(profile));
            window.sessionStorage.setItem(PDI_STAGE_KEY, "app");
            window.localStorage.setItem("pdi.force.app.v1", "1");
            window.location.hash = "app";
          } catch {}

          // Asynchronously sync user to PostgreSQL Cloud SQL in the background
          void projectsApi.syncUser(profile.name, (profile as any).photoUrl || (profile as any).photoURL).catch((err) => {
            console.warn("Background user sync to Cloud SQL non-blocking error:", err);
          });

          setStage("app");
          setActiveModule(isSuper ? "super_admin_console" : "home");
        }}
      />
    );
  }

  // PATCH 017B : editeur ISO protege par un filet de securite.
  if (activeModule === "isometric") return (
    <PdiModuleErrorBoundary>
      {/* Vertical Dropup List exactly like the first photo but in dark PDI theme */}
      {isoTabDockOpen && (
        <div
          className="pdi-tab-dropup transition-all duration-200"
          style={{
            position: "fixed",
            left: railCollapsed ? 60 : 168,
            bottom: 86,
            zIndex: 10041,
            width: 320,
            maxHeight: 400,
            background: "#09090b", // PDI dark theme
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: 14,
            boxShadow: "0 15px 40px rgba(0, 0, 0, 0.9)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "sans-serif",
            overflow: "hidden",
          }}
        >
          {/* Header section (Épinglé style) */}
          <div style={{ padding: "12px 16px 6px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Plans Ouverts ({workspaceTabs.length})
            </span>
          </div>

          {/* List Area (Scrollable) */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }} className="pdi-custom-scroll">
            {workspaceTabs.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "#52525b", fontSize: 11, fontWeight: 600 }}>
                Aucun plan ouvert
              </div>
            ) : (
              workspaceTabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                return (
                  <div
                    key={tab.id}
                    title={`${tab.title} (Double-clic pour renommer)`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: isActive ? "rgba(255, 255, 255, 0.05)" : "transparent",
                      border: isActive ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid transparent",
                      cursor: "pointer",
                      marginBottom: 2,
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => switchTab(tab.id)}
                    onDoubleClick={() => beginRenameTab(tab)}
                    className="group"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      {/* Interactive beautiful folder icons from the photo */}
                      {isActive ? (
                        <FolderOpen className="shrink-0" style={{ width: 16, height: 16, color: "#38bdf8", fill: "rgba(56, 189, 248, 0.15)" }} />
                      ) : (
                        <Folder className="shrink-0" style={{ width: 16, height: 16, color: "#eab308", fill: "rgba(234, 179, 8, 0.1)" }} />
                      )}

                      {renamingTabId === tab.id ? (
                        <input
                          autoFocus
                          defaultValue={tab.title}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRenameTab(tab.id)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRenameTab(tab.id);
                            if (e.key === "Escape") setRenamingTabId(null);
                          }}
                          style={{
                            flex: 1,
                            height: 20,
                            background: "#18181b",
                            border: "1px solid #71717a",
                            borderRadius: 4,
                            color: "white",
                            fontSize: 12,
                            padding: "0 6px",
                            outline: "none",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? "#ffffff" : "#a1a1aa",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tab.title}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginLeft: 8,
                      }}
                    >
                      {/* Close button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 4,
                          borderRadius: 4,
                          cursor: "pointer",
                          color: "#71717a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
                        title="Fermer ce plan"
                      >
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Separator line */}
          <div style={{ height: 1, background: "rgba(255, 255, 255, 0.05)", margin: "4px 0" }} />

          {/* Bottom Actions section (Fréquents & Explorateur style) */}
          <div style={{ padding: "4px 8px 8px" }}>
            {/* Nouveau Plan */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                color: "#e4e4e7",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                setNewProjectModalOpen(true);
                setIsoTabDockOpen(false);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Plus style={{ width: 16, height: 16, color: "#10b981" }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Nouveau plan ISO</span>
            </div>

            {/* Explorateur de projets */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                color: "#e4e4e7",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                setActiveModule("projects");
                setIsoTabDockOpen(false);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <LayoutGrid style={{ width: 16, height: 16, color: "#67e8f9" }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Explorateur de projets</span>
            </div>

            {/* Fermer tous les plans */}
            {workspaceTabs.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  color: "#f87171",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => {
                  if (window.confirm("Fermer tous les plans ouverts ?")) {
                    setWorkspaceTabs([]);
                    setActiveTabId(null);
                    setActiveModule("home");
                    persistTabs([], null);
                  }
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Trash2 style={{ width: 16, height: 16, color: "#ef4444" }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Fermer tous les plans</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact bottom Trigger Bar */}
      <div
        className="pdi-tab-dock-iso transition-all duration-200"
        style={{
          position: "fixed",
          left: railCollapsed ? 60 : 168,
          bottom: 54,
          zIndex: 10040,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.14)",
          background: "rgba(9,9,11,.96)",
          boxShadow: "0 10px 35px rgba(0,0,0,.7)",
        }}
      >
        <button
          type="button"
          onClick={() => setIsoTabDockOpen((v) => !v)}
          title="Afficher la liste des plans ouverts"
          style={{
            border: "1px solid rgba(255,255,255,.18)",
            background: "#18181B",
            color: "white",
            borderRadius: 8,
            height: 24,
            padding: "0 10px",
            fontSize: 10,
            fontWeight: 900,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{isoTabDockOpen ? "▾" : "▲"} PLANS</span>
          <span
            style={{
              background: "rgba(255,255,255,.15)",
              padding: "1px 5px",
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 1000,
            }}
          >
            {workspaceTabs.length}
          </span>
        </button>

        {activeWorkspaceTab && (
          <div
            style={{
              border: "1px solid rgba(255,255,255,.08)",
              background: "rgba(255,255,255,.02)",
              color: "#a1a1aa",
              borderRadius: 8,
              height: 24,
              padding: "0 10px",
              fontSize: 10.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
            onClick={() => setIsoTabDockOpen((v) => !v)}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
            <span>Plan : <strong style={{ color: "white" }}>{activeWorkspaceTab.title}</strong></span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setNewProjectModalOpen(true)}
          title="Nouveau plan / Projet"
          style={{
            border: "1px solid rgba(255,255,255,.1)",
            background: "#18181B",
            color: "#FFFFFF",
            borderRadius: 8,
            height: 24,
            width: 24,
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      </div>
      {/* PATCH 017F1 : remontage propre du moteur a chaque changement de projet. */}
      <div key={activeProjectId} style={{ width: "100%", height: "100%" }}>
        <PdiIsometricEditor projectId={activeProjectId} />
      </div>
    </PdiModuleErrorBoundary>
  );

  return (
    <div className={`pdi-unified-root ${activeModule === "home" ? "is-home-module" : ""} ${sidebarHidden ? "is-sidebar-hidden" : ""}`}>
      <style>{`
        body:has(.pdi-modal-backdrop) .pdi-tab-dock-iso { display: none !important; }
        .pdi-unified-root{height:100vh;width:100vw;overflow:hidden;background:#000000;color:#F4F4F5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;display:grid;grid-template-columns:96px 1fr;grid-template-rows:72px 40px 1fr}
        .pdi-unified-root.is-home-module{grid-template-columns:1fr;grid-template-rows:72px 1fr}
        .pdi-unified-root.is-home-module .pdi-content{grid-column:1/-1;grid-row:2/3;padding:0;background:#000000}
        .pdi-unified-root.is-sidebar-hidden{grid-template-columns:1fr !important;grid-template-rows:72px 40px 1fr !important}
        .pdi-unified-root.is-sidebar-hidden .pdi-main-nav{display:none !important}
        .pdi-unified-root.is-sidebar-hidden .pdi-breadcrumb-bar{grid-column:1/-1 !important;grid-row:2/3 !important}
        .pdi-unified-root.is-sidebar-hidden .pdi-content{grid-column:1/-1 !important;grid-row:3/4 !important}
        .pdi-unified-topbar{grid-column:1/-1;grid-row:1/2;display:flex;align-items:center;gap:18px;padding:8px 16px;background:#08080A;border-bottom:1px solid rgba(255,255,255,.08);box-shadow:0 8px 24px rgba(0,0,0,.45);min-width:0}
        .pdi-breadcrumb-bar{grid-column:2/3;grid-row:2/3;display:flex;flex-direction:row;align-items:center;flex-wrap:nowrap;white-space:nowrap;gap:12px;padding:0 14px;height:40px;min-height:40px;max-height:40px;background:#050507;border-bottom:1px solid rgba(255,255,255,.08);box-sizing:border-box;overflow:hidden;z-index:10}
        .pdi-project-title{min-width:0;border-left:1px solid rgba(255,255,255,.12);padding-left:14px;line-height:1.1}
        .pdi-project-title small{display:block;color:#71717A;font-size:10px;text-transform:uppercase;font-weight:900}
        .pdi-project-title strong{display:block;color:#FFFFFF;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pdi-top-actions{margin-left:auto;display:flex;align-items:center;gap:8px;color:#A1A1AA;font-size:12px}
        .pdi-search{height:36px;width:min(340px,24vw);border:1px solid rgba(255,255,255,.12);background:#0D0D10;color:#FFFFFF;border-radius:10px;padding:0 12px;font-weight:700}
        .pdi-search::placeholder{color:#71717A}
        .pdi-search:focus{outline:none;border-color:rgba(255,255,255,.3)}
        .pdi-account{height:36px;border:1px solid rgba(255,255,255,.15);background:#121215;color:#FFFFFF;border-radius:10px;padding:0 12px;font-weight:800;cursor:pointer}
        .pdi-account:hover{background:#1C1C20;border-color:rgba(255,255,255,.3)}
        .pdi-main-nav{grid-column:1/2;grid-row:2/4;display:flex;flex-direction:column;gap:10px;padding:14px 10px;background:#050507;border-right:1px solid rgba(255,255,255,.08);overflow:auto;z-index:10}
        .pdi-main-nav button{height:58px;border:1px solid rgba(255,255,255,.08);background:#0E0E11;color:#A1A1AA;border-radius:14px;font-weight:900;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:all .15s ease}
        .pdi-main-nav button:hover{background:#18181C;color:#FFFFFF;border-color:rgba(255,255,255,.2)}
        .pdi-main-nav button.active{background:#27272A;color:#FFFFFF;border-color:#52525B;box-shadow:0 0 0 1px rgba(255,255,255,.15),0 8px 24px rgba(0,0,0,.5)}
        .pdi-main-nav small{font-size:8px;letter-spacing:.06em;text-transform:uppercase;opacity:.85}
        .pdi-content{grid-column:2/3;grid-row:3/4;min-width:0;min-height:0;overflow:auto;padding:0;background:#000000;position:relative}
        .pdi-home-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(330px,.8fr);gap:20px;align-items:stretch}
        .pdi-hero-card,.pdi-module-panel,.pdi-launch-card,.pdi-showcase-card{border:1px solid rgba(255,255,255,.08);background:#09090B;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.5)}
        .pdi-hero-card{padding:28px}
        .pdi-hero-card h1,.pdi-module-panel h1{font-size:clamp(28px,4vw,54px);line-height:.98;margin:0;color:#FFFFFF;letter-spacing:-.04em;font-weight:900}
        .pdi-hero-card p{color:#A1A1AA;font-weight:600;font-size:15px;line-height:1.6;max-width:760px;margin-top:14px;margin-bottom:20px}
        .pdi-badge-row{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
        .pdi-badge{border:1px solid rgba(255,255,255,.12);background:#141418;color:#E4E4E7;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
        .pdi-start-primary{border:1px solid rgba(255,255,255,.25);background:#FFFFFF;color:#000000;border-radius:14px;padding:13px 22px;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 8px 30px rgba(255,255,255,.1);transition:all .18s ease}
        .pdi-start-primary:hover{background:#E4E4E7;transform:translateY(-2px);box-shadow:0 12px 36px rgba(255,255,255,.16)}
        .pdi-launch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:24px}
        .pdi-launch-card{padding:18px;text-align:left;color:#F4F4F5;cursor:pointer;transition:.18s transform,.18s border-color,.18s background;background:#0E0E12;border:1px solid rgba(255,255,255,.08)}
        .pdi-launch-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.25);background:#141418}
        .pdi-launch-card .icon{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;background:#18181B;border:1px solid rgba(255,255,255,.12);color:#FFFFFF;font-weight:900;margin-bottom:12px}
        .pdi-launch-card h3{margin:0 0 6px;font-size:16px;font-weight:800;color:#FFFFFF}
        .pdi-launch-card p{margin:0;color:#A1A1AA;font-size:12px;font-weight:600;line-height:1.45}
        .pdi-launch-card .badge{display:inline-block;margin-top:12px;color:#D4D4D8;font-size:10px;font-weight:800;text-transform:uppercase;background:#18181B;border:1px solid rgba(255,255,255,.08);padding:2px 8px;border-radius:6px}
        .pdi-showcase{height:calc(100vh - 132px);overflow:hidden;position:relative;border-radius:24px;border:1px solid rgba(255,255,255,.08);background:#08080A;padding:10px}
        .pdi-showcase:hover .pdi-showcase-track{animation-play-state:paused}
        .pdi-showcase-track{display:flex;flex-direction:column;gap:16px;animation:pdiShowcaseScroll 32s linear infinite}
        .pdi-showcase-card{padding:14px;position:relative;overflow:hidden;background:#0E0E12;border:1px solid rgba(255,255,255,.08);transition:transform .2s ease,border-color .2s ease}
        .pdi-showcase-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.3)}
        .pdi-showcase-img-box{position:relative;width:100%;height:140px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#050507;margin-bottom:12px}
        .pdi-showcase-img{width:100%;height:100%;object-fit:cover;transition:transform .4s cubic-bezier(0.16,1,0.3,1)}
        .pdi-showcase-card:hover .pdi-showcase-img{transform:scale(1.06)}
        .pdi-showcase-img-overlay{position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.85) 100%)}
        .pdi-showcase-img-caption{position:absolute;bottom:6px;left:8px;right:8px;font-size:10px;font-weight:800;color:#F4F4F5;text-shadow:0 1px 3px rgba(0,0,0,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pdi-showcase-card .tag{display:inline-grid;place-items:center;min-width:64px;padding:0 8px;height:22px;border-radius:6px;background:#18181B;border:1px solid rgba(255,255,255,.15);color:#FFFFFF;font-size:9px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
        .pdi-showcase-card h3{margin:0 0 6px;font-size:15px;color:#FFFFFF;font-weight:800}
        .pdi-showcase-card p{margin:0;color:#A1A1AA;font-weight:500;font-size:12px;line-height:1.45}
        @keyframes pdiShowcaseScroll{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}
        .pdi-module-panel{padding:28px;min-height:calc(100vh - 128px)}
        .pdi-panel-kicker{color:#A1A1AA;font-size:11px;text-transform:uppercase;font-weight:900;margin-bottom:10px}
        .pdi-panel-body{margin-top:20px;color:#D4D4D8;font-weight:600;line-height:1.75;max-width:980px}
        .pdi-panel-body code{background:#18181B;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:3px 6px;color:#FAFAFA}
        .pdi-auth-badge{border:1px solid rgba(255,255,255,.15);background:#18181B;color:#FFFFFF;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:900}
        .pdi-account-menu{position:absolute;right:12px;top:58px;z-index:80;width:200px;background:#0D0D10;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:7px;box-shadow:0 24px 60px rgba(0,0,0,.7)}
        .pdi-account-menu button{display:block;width:100%;height:34px;text-align:left;border:0;background:transparent;color:#D4D4D8;border-radius:8px;padding:0 10px;font-weight:700;font-size:12px;cursor:pointer}
        .pdi-account-menu button:hover{background:#18181C;color:#FFFFFF}
        .pdi-tabsbar{grid-column:2;grid-row:2;align-self:stretch;z-index:8;display:flex;align-items:center;gap:6px;padding:4px 12px;background:#050507;border-bottom:1px solid rgba(255,255,255,.08);overflow:auto}
        .pdi-tabsbar button{height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:#111114;color:#A1A1AA;font-size:11px;font-weight:800;padding:0 9px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:all .15s ease}
        .pdi-tabsbar button:hover{background:#18181C;color:#FFFFFF}
        .pdi-tabsbar button.active{background:#27272A;color:#FFFFFF;border-color:#52525B}
        .pdi-tabsbar button span{opacity:.65}
        .pdi-tabsbar .plus{min-width:34px;justify-content:center}
        @keyframes pdiTabIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        .pdi-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .pdi-profile-card{border:1px solid rgba(255,255,255,.08);background:#0E0E12;border-radius:18px;padding:18px}
        .pdi-profile-card.wide{grid-column:1/-1}
        .pdi-profile-card h3{margin:0 0 12px;color:#FFFFFF;font-weight:800;font-size:15px}
        .pdi-profile-card p{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.06);padding:8px 0;margin:0;font-size:13px}
        .pdi-profile-card b{color:#71717A}
        .pdi-profile-card span{color:#FFFFFF;font-weight:700}
        .pdi-profile-actions{display:flex;flex-wrap:wrap;gap:8px}
        .pdi-profile-actions button{border:1px solid rgba(255,255,255,.12);background:#18181B;color:#FFFFFF;border-radius:10px;padding:9px 14px;font-weight:800;font-size:12px;cursor:pointer}
        .pdi-profile-actions button:hover{background:#27272A;border-color:rgba(255,255,255,.25)}
        .pdi-auth-gateway{grid-column:1/-1;display:grid;place-items:center;min-height:calc(100vh - 170px);animation:pdiAuthIn .35s ease}
        .pdi-auth-card{width:min(760px,92vw);border:1px solid rgba(255,255,255,.12);background:#09090B;border-radius:26px;padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.6)}
        .pdi-auth-card h1{font-size:clamp(30px,4vw,52px);margin:0 0 10px;color:#FFFFFF}
        .pdi-auth-card p{color:#A1A1AA;font-weight:600}
        .pdi-auth-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}
        .pdi-auth-tabs button,.pdi-auth-form button{border:1px solid rgba(255,255,255,.15);background:#18181B;color:#FFFFFF;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer}
        .pdi-auth-tabs button.active,.pdi-auth-form button:hover{background:#27272A;border-color:rgba(255,255,255,.3)}
        .pdi-auth-form{display:grid;gap:10px}
        .pdi-auth-form input,.pdi-auth-form select{height:40px;border-radius:12px;background:#0E0E12!important;color:#FFFFFF!important;border:1px solid rgba(255,255,255,.12)!important;padding:0 12px;font-weight:700}
        .pdi-auth-form code{display:block;background:#050507;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;color:#E4E4E7}
        .pdi-auth-form button:disabled{opacity:.4;cursor:not-allowed}
        @keyframes pdiAuthIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .pdi-license-panel{display:grid;grid-template-columns:minmax(260px,.34fr) 1fr;gap:14px}
        .pdi-license-form,.pdi-license-list{border:1px solid rgba(255,255,255,.08);background:#0E0E12;border-radius:18px;padding:18px}
        .pdi-license-form h3,.pdi-license-list h3{margin:0 0 12px;color:#FFFFFF;font-weight:800}
        .pdi-license-form{display:grid;gap:10px}
        .pdi-license-form label{display:grid;gap:4px;color:#71717A;font-size:11px;font-weight:900;text-transform:uppercase}
        .pdi-license-form input,.pdi-license-form select{height:36px;border-radius:10px;background:#050507!important;color:#FFFFFF!important;border:1px solid rgba(255,255,255,.12)!important;padding:0 10px}
        .pdi-license-form button,.pdi-license-row button{border:1px solid rgba(255,255,255,.2);background:#18181B;color:#FFFFFF;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}
        .pdi-license-form button:hover,.pdi-license-row button:hover{background:#27272A}
        .pdi-license-list{display:grid;gap:8px;align-content:start}
        .pdi-license-row{display:grid;grid-template-columns:1.8fr .8fr .7fr 1.2fr .7fr .8fr auto auto;gap:7px;align-items:center;border:1px solid rgba(255,255,255,.08);background:#050507;border-radius:12px;padding:8px 10px;font-size:11px}
        .pdi-license-row code{color:#F4F4F5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        @media(max-width:900px){.pdi-unified-root{grid-template-columns:1fr;grid-template-rows:72px auto 40px 1fr}.pdi-tabsbar{grid-column:1;grid-row:3}.pdi-unified-topbar{grid-column:1}.pdi-project-title,.pdi-search{display:none}.pdi-main-nav{grid-row:2;flex-direction:row;overflow-x:auto;padding:8px}.pdi-main-nav button{min-width:72px;height:54px}.pdi-content{grid-column:1;grid-row:4;padding:12px}.pdi-home-hero{grid-template-columns:1fr}.pdi-launch-grid{grid-template-columns:1fr}.pdi-showcase{height:420px}}
      `}</style>
      <header className="pdi-unified-topbar">
        <div className="pdi-unified-brand"><PdiBrandMark variant="horizontal" size="sm" /></div>
        <div className="pdi-project-title"><small>Projet actif</small><strong>{moduleTitle}</strong></div>
        <div className="pdi-top-actions">
          <input className="pdi-search" placeholder="Rechercher une commande…" />
          <button 
            type="button"
            onClick={() => setFeedbackModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#18181B", color: "#FFFFFF", fontSize: 11, fontWeight: 900, cursor: "pointer" }}
            title="Donner votre retour d'expérience utilisateur"
          >
            ★ Retour Expérience
          </button>
          <span className="pdi-auth-badge">{authMode.toUpperCase()}</span>
          <button className="pdi-account" onClick={() => setAccountMenuOpen(v=>!v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 900, color: '#6EE7B7', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.02em' }}>
              Patch {PDI_PATCH_VERSION}
            </span>
            <span>{pdiUserProfile.name.split(" ")[0]}</span> 
            <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
          </button>
          {accountMenuOpen && (
            <div className="pdi-account-menu">
              <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 900, color: '#FFFFFF' }}>
                  <span>{pdiUserProfile.name}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 900, color: '#6EE7B7', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 4, padding: '2px 6px' }}>Patch {PDI_PATCH_VERSION}</span>
                </div>
                <div style={{ color: '#A1A1AA', fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>{pdiUserProfile.email} • Version active • Tout implémenté</div>
              </div>
              <button onClick={()=>{setActiveModule("home"); setAccountMenuOpen(false);}}>Accueil Application</button>
              <button onClick={()=>{setStage("landing"); try { window.location.hash = "landing"; } catch {} setAccountMenuOpen(false);}} style={{ color: "#FB923C", fontWeight: 800 }}>🌐 Page Commerciale (Vitrine)</button>
              {(authMode === "super_admin" || pdiUserProfile.email.includes("boudjada")) && (
                <button onClick={()=>{setActiveModule("super_admin_console"); setAccountMenuOpen(false);}} style={{ color: "#FFFFFF", fontWeight: 900 }}>⚡ Super Admin Console</button>
              )}
              <button onClick={()=>{setActiveModule("profile"); setAccountMenuOpen(false);}}>Voir profil</button>
              <button onClick={()=>{setActiveModule("projects"); setAccountMenuOpen(false);}}>Mes projets</button>
              <button onClick={()=>{setActiveModule("subscription"); setAccountMenuOpen(false);}}>Abonnement</button>
              <button onClick={()=>{setFeedbackModalOpen(true); setAccountMenuOpen(false);}}>★ Retour Expérience</button>
              {(authMode === "super_admin" || pdiUserProfile.email.includes("boudjada")) && (
                <button onClick={()=>{setActiveModule("license_keys"); setAccountMenuOpen(false);}}>Clés SaaS</button>
              )}
              <button className="pdi-menu-logout" onClick={handleLogoutToHome} style={{ color: "#f87171", borderTop: "1px solid rgba(248,113,113,0.2)", marginTop: "4px", paddingTop: "6px" }}>⎋ Déconnexion</button>
            </div>
          )}
        </div>
      </header>
      {/* PATCH 017K : fil d Ariane et retour, a partir du 2e niveau seulement. */}
      {activeModule !== "home" && (
        <div
          className="pdi-breadcrumb-bar"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            gap: 12,
            padding: "0 14px",
            height: "40px",
            minHeight: "40px",
            maxHeight: "40px",
            background: "#050507",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            boxSizing: "border-box",
            overflow: "hidden"
          }}
        >
          {sidebarHidden && (
            <button
              type="button"
              onClick={() => setSidebarHidden(false)}
              title="Afficher la barre latérale (+)"
              style={{
                display: "inline-flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "nowrap",
                flexShrink: 0,
                padding: "4px 8px",
                height: "26px",
                borderRadius: 6,
                border: "1px solid rgba(56,189,248,0.4)",
                background: "rgba(56,189,248,0.12)",
                color: "#38BDF8",
                fontSize: 11,
                fontWeight: 900,
                cursor: "pointer",
                lineHeight: 1
              }}
            >
              (+)
            </button>
          )}

          <button
            type="button"
            onClick={pdiGoBack017K}
            title="Retour au niveau précédent"
            style={{
              display: "inline-flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
              flexShrink: 0,
              gap: 6,
              padding: "4px 12px",
              height: "26px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,.15)",
              background: "#121215",
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              lineHeight: 1
            }}
          >
            <span>←</span>
            <span>Retour</span>
          </button>

          <div
            style={{
              display: "inline-flex",
              flexDirection: "row",
              alignItems: "center",
              whiteSpace: "nowrap",
              gap: 8,
              flexShrink: 0
            }}
          >
            <button
              type="button"
              onClick={() => setActiveModule("home")}
              style={{
                background: "none",
                border: "none",
                color: "#71717A",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
                whiteSpace: "nowrap"
              }}
            >
              Accueil
            </button>
            <span style={{ color: "#3F3F46", fontSize: 12, fontWeight: 900 }}>/</span>
            <strong style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
              {moduleTitle}
            </strong>
          </div>
        </div>
      )}
      {activeModule !== "home" && (
        <nav className="pdi-main-nav" aria-label="Navigation PD&I">
          {/* Bouton (-) pour masquer la barre latérale au-dessus d'Accueil */}
          <button
            type="button"
            onClick={() => setSidebarHidden(true)}
            title="Masquer la barre latérale (-)"
            style={{
              height: 26,
              minHeight: 26,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#A1A1AA",
              fontWeight: 900,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              marginBottom: 2,
              transition: "all 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#38BDF8";
              e.currentTarget.style.borderColor = "rgba(56,189,248,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#A1A1AA";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            <span>(-)</span>
          </button>

          {navItems.map((item) => {
            const theme = PDI_NAV_THEMES[item.id] || PDI_NAV_THEMES.home;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                className={isActive ? "active" : ""}
                onClick={() =>
                  item.id === "home"
                    ? setActiveModule("home")
                    : openModuleInTab(item.id, item.title)
                }
                title={item.title}
                style={{
                  borderColor: isActive ? theme.color : "rgba(255,255,255,0.08)",
                  background: isActive ? theme.bgGlow : "#09090B",
                  boxShadow: isActive ? `0 0 16px ${theme.bgGlow}, 0 4px 20px rgba(0,0,0,0.6)` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.icon}
                </div>
                <small
                  style={{
                    color: isActive ? "#FFFFFF" : "#A1A1AA",
                    fontWeight: isActive ? 900 : 700,
                    fontSize: "9px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  {item.label}
                </small>
              </button>
            );
          })}
        </nav>
      )}
      {/* PATCH 017E : barre d onglets top désactivée au profit du dock vertical de la liste de plans en bas */}
      {/* Le dock vertical de plans en bas offre une ergonomie parfaite et évite l encombrement */}
      <main className="pdi-content">
        {activeModule === "home" && (
          <PdiIllustratorHome
            onNewProject={() => setNewProjectModalOpen(true)}
            onOpenProject={() => openModuleInTab("projects", "Mes Projets")}
            onOpenModule={(m) => openModuleInTab(m as PdiModule)}
          />
        )}
        {activeModule === "drive" && <GoogleDriveWorkspace onLoadProjectToEditor={(data, name) => { openModuleInTab("isometric", name); }} />}
        {activeModule === "vision" && <ComingSoonPanel title="Vision PD&I"><p><b>Vision PD&I</b> préparera le flux <code>photo réelle → analyse agent → scripts Python → JSON PD&I → validation → ISO</code>. Les images restent en cache local temporaire navigateur.</p></ComingSoonPanel>}
        {activeModule === "sketch" && (
          <SketchToIsoModule
            onLoadProjectToEditor={(data, name) => {
              const targetProjId = `project-${Date.now().toString(36)}`;
              const resolvedName = name || "Plan Isométrique";
              openModuleInTab("isometric", resolvedName, targetProjId);
              // Passerelle d'injection instantanée vers l'éditeur ISO (Étape 5)
              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent("pdi:inject-iso-graph", {
                    detail: {
                      data,
                      name: resolvedName,
                      projectId: targetProjId,
                      open3d: true,
                    },
                  })
                );
              }, 60);
            }}
          />
        )}
        {activeModule === "cad" && <ComingSoonPanel title="Import CAO / DXF / PDF"><p>Import DXF/PDF, lecture des calques et entités, conversion déterministe Python vers JSON PD&I.</p></ComingSoonPanel>}
        {activeModule === "json" && <ComingSoonPanel title="Modèle JSON PD&I"><p>Le JSON devient la source de vérité : lignes, nœuds, équipements, ports, soudures, cotations, niveaux Z, massifs, dalle, exports.</p></ComingSoonPanel>}
        {activeModule === "pdf" && <ComingSoonPanel title="Impression / Exports"><p>Préparation V4.8e : A4/A3/A2/A1, portrait/paysage, PDF, DXF/CAD, cartouche, nomenclature.</p></ComingSoonPanel>}

        {activeModule === "profile" && <ComingSoonPanel title="Profil utilisateur">
          <div className="pdi-profile-grid text-slate-200">
            <section className="pdi-profile-card"><h3>Identité</h3><p><b>Nom</b><span>{pdiUserProfile.name}</span></p><p><b>Email</b><span>{pdiUserProfile.email}</span></p><p><b>Entreprise</b><span>{pdiUserProfile.company}</span></p><p><b>Pays</b><span>{pdiUserProfile.country}</span></p></section>
            <section className="pdi-profile-card">
              <h3>Compte &amp; Version</h3>
              <p><b>Rôle</b><span>{String(pdiUserProfile.role).toUpperCase()}</span></p>
              <p>
                <b>Version Patch</b>
                <span className="inline-flex items-center gap-1.5 font-mono text-cyan-300 font-black">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-xs">{PDI_PATCH_VERSION}</span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Étape A Active</span>
                </span>
              </p>
              <p><b>Palier Industriel</b><span className="text-zinc-300 text-xs">Standard International (ASME / API / ISO)</span></p>
              <p><b>Plan</b><span>{pdiUserProfile.plan}</span></p>
              <p><b>Email</b><span>{pdiUserProfile.emailStatus}</span></p>
              <p><b>Créé le</b><span>{pdiUserProfile.createdAt}</span></p>
            </section>

            {/* MODIFICATION DE MOT DE PASSE SECURISEE */}
            <section className="pdi-profile-card wide">
              <h3>Sécurité &amp; Changement de mot de passe</h3>
              <p className="text-xs text-slate-400 mb-4 border-b-0 pb-0">
                Pour modifier votre mot de passe d'accès au portail industriel, veuillez confirmer l'ancien mot de passe de votre profil.
              </p>
              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                {passwordChangeError && (
                  <div className="p-3 text-xs font-semibold bg-red-950/80 border border-red-700 text-red-300 rounded-lg">
                    ⚠️ {passwordChangeError}
                  </div>
                )}
                {passwordChangeSuccess && (
                  <div className="p-3 text-xs font-semibold bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-lg">
                    ✓ {passwordChangeSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Ancien mot de passe</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-white"
                    placeholder="Saisissez votre mot de passe actuel"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-white"
                      placeholder="Min. 6 caractères"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Confirmer le mot de passe</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-white"
                      placeholder="Ressaisissez le mot de passe"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPasswordChange}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-slate-950 font-extrabold text-xs rounded-lg transition-all cursor-pointer"
                >
                  {isSubmittingPasswordChange ? "Mise à jour en cours..." : "Enregistrer le nouveau mot de passe"}
                </button>
              </form>
            </section>

            <section className="pdi-profile-card wide"><h3>Actions</h3><div className="pdi-profile-actions"><button onClick={()=>setActiveModule("projects")}>Mes projets</button><button onClick={()=>setActiveModule("subscription")}>Mon abonnement</button><button onClick={handleLogoutToHome} style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.4)" }}>⎋ Déconnexion</button></div></section>
          </div>
          {/* PATCH 017K2 : identite societe editable, remplace toute marque codee en dur. */}
          <PdiCompanyPanel />
        </ComingSoonPanel>}
        {activeModule === "subscription" && <ComingSoonPanel title="Abonnement"><p>Plan actuel : <b>{pdiUserProfile.plan}</b>. Les clés SaaS, paiements et renouvellements seront reliés au Super Admin dans les patchs 011 à 016.</p></ComingSoonPanel>}

        {activeModule === "super_admin_console" && (
          <div style={{ minHeight: "calc(100vh - 128px)" }}>
            <PdiSuperAdminConsole />
          </div>
        )}

        {activeModule === "license_keys" && <ComingSoonPanel title="Générateur de clés SaaS">
          <div className="pdi-license-panel">
            <section className="pdi-license-form"><h3>Créer une clé</h3><label>Type<select value={licenseDraft.type} onChange={e=>setLicenseDraft({...licenseDraft,type:e.target.value})}><option>TRIAL_7</option><option>TRIAL_30</option><option>GUEST</option><option>SOLO_MONTHLY</option><option>SOLO_YEARLY</option><option>PRO_MONTHLY</option><option>PRO_YEARLY</option><option>TEAM_MONTHLY</option><option>TEAM_YEARLY</option><option>ENTERPRISE</option><option>ADMIN_INVITE</option><option>SUPER_ADMIN</option></select></label><label>Plan<select value={licenseDraft.plan} onChange={e=>setLicenseDraft({...licenseDraft,plan:e.target.value})}><option>DEMO</option><option>GUEST</option><option>SOLO</option><option>PRO</option><option>TEAM</option><option>ENTERPRISE</option></select></label><label>Email assigné<input value={licenseDraft.email} onChange={e=>setLicenseDraft({...licenseDraft,email:e.target.value})} placeholder="client@email.com" /></label><button onClick={generateLicenseKey}>Générer clé</button><small>Flux futur : demande → paiement → génération compte → email activation unique.</small></section>
            <section className="pdi-license-list"><h3>Clés générées</h3>{licenseKeys.length===0?<p>Aucune clé générée.</p>:licenseKeys.map(k=><div key={k.id} className="pdi-license-row"><code>{k.code}</code><span>{k.type}</span><span>{k.plan}</span><span>{k.email || "non assignée"}</span><span>{k.status}</span><span>exp. {k.expiresAt}</span><button onClick={()=>navigator.clipboard?.writeText(k.code)}>Copier</button><button onClick={()=>revokeLicenseKey(k.id)}>Révoquer</button></div>)}</section>
          </div>
        </ComingSoonPanel>}

        {/* Écran "Mes projets" avec barre de recherche, sélection multiple & suppression groupée */}
        {activeModule === "projects" && (() => {
          const allProjects = pdiReadProjectIndex();
          const filteredProjects = allProjects.filter((entry) => {
            if (!projectSearchQuery.trim()) return true;
            const q = projectSearchQuery.toLowerCase().trim();
            return (
              entry.title.toLowerCase().includes(q) ||
              entry.projectId.toLowerCase().includes(q)
            );
          });
          const isAllFilteredSelected =
            filteredProjects.length > 0 &&
            filteredProjects.every((p) => selectedProjectIds.includes(p.projectId));

          return (
            <ComingSoonPanel title="Mes projets PD&I">
              <p style={{ marginBottom: 16 }}>
                Projets PD&I de ce poste. Chaque projet possède son propre plan et sa propre sauvegarde locale.
              </p>

              {/* Barre d'outils (Recherche, Sélection Tout, Suppression groupée) */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  background: "#0A0A0E",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 14,
                  marginBottom: 16,
                }}
              >
                {/* Input Barre de recherche */}
                <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200, display: "flex", alignItems: "center" }}>
                  <Search style={{ width: 14, height: 14, color: "#71717A", position: "absolute", left: 12, pointerEvents: "none" }} />
                  <input
                    type="text"
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom ou identifiant de projet..."
                    style={{
                      width: "100%",
                      background: "#050507",
                      border: "1px solid rgba(255, 255, 255, 0.14)",
                      borderRadius: 10,
                      padding: "8px 32px 8px 34px",
                      fontSize: 12,
                      color: "#FFFFFF",
                      outline: "none",
                    }}
                  />
                  {projectSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setProjectSearchQuery("")}
                      style={{ position: "absolute", right: 10, background: "transparent", border: 0, color: "#71717A", cursor: "pointer", padding: 2 }}
                      title="Effacer la recherche"
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>

                {/* Bouton Tout Sélectionner / Désélectionner */}
                <button
                  type="button"
                  onClick={() => {
                    const filteredIds = filteredProjects.map((p) => p.projectId);
                    if (isAllFilteredSelected) {
                      setSelectedProjectIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
                    } else {
                      setSelectedProjectIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: isAllFilteredSelected
                      ? "1px solid #06B6D4"
                      : "1px solid rgba(255, 255, 255, 0.14)",
                    background: isAllFilteredSelected ? "rgba(6, 182, 212, 0.12)" : "#0E0E12",
                    color: isAllFilteredSelected ? "#67E8F9" : "#E4E4E7",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isAllFilteredSelected ? (
                    <CheckSquare style={{ width: 15, height: 15, color: "#22D3EE" }} />
                  ) : (
                    <Square style={{ width: 15, height: 15, color: "#A1A1AA" }} />
                  )}
                  <span>
                    {isAllFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
                    {filteredProjects.length > 0 &&
                      ` (${selectedProjectIds.filter((id) => filteredProjects.some((f) => f.projectId === id)).length}/${filteredProjects.length})`}
                  </span>
                </button>

                {/* Bouton Suppression Groupée */}
                {selectedProjectIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const count = selectedProjectIds.length;
                      pdiConfirm({
                        title: `Supprimer ${count} projet(s)`,
                        message: `Les ${count} projet(s) sélectionné(s) ainsi que leurs sauvegardes locales seront définitivement supprimés. Cette action ne peut pas être annulée.`,
                        confirmLabel: `Supprimer (${count})`,
                        destructive: true,
                      }).then((ok) => {
                        if (!ok) return;
                        selectedProjectIds.forEach((id) => {
                          pdiRemoveProject(id);
                          closeTabsForProject(id);
                        });
                        setSelectedProjectIds([]);
                        setProjectsRefresh((v) => v + 1);
                      });
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px solid #991B1B",
                      background: "linear-gradient(180deg, #7F1D1D, #450A0A)",
                      color: "#FECACA",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(153, 27, 27, 0.3)",
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14, color: "#FCA5A5" }} />
                    <span>Supprimer la sélection ({selectedProjectIds.length})</span>
                  </button>
                )}
              </div>

              {/* Index des projets filtrés */}
              <div key={projectsRefresh} style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {allProjects.length === 0 && (
                  <span style={{ color: "#71717A", fontWeight: 800 }}>
                    Aucun projet enregistré. Cliquez sur Nouveau plan ISO.
                  </span>
                )}
                {allProjects.length > 0 && filteredProjects.length === 0 && (
                  <span style={{ color: "#71717A", fontWeight: 700, padding: "12px 0" }}>
                    Aucun projet ne correspond à la recherche "{projectSearchQuery}".
                  </span>
                )}

                {filteredProjects.map((entry) => {
                  const isSelected = selectedProjectIds.includes(entry.projectId);
                  return (
                    <div
                      key={entry.projectId}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 12,
                        border: isSelected
                          ? "1px solid rgba(34, 211, 238, 0.5)"
                          : "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: 14,
                        padding: "10px 14px",
                        background: isSelected ? "rgba(8, 47, 73, 0.4)" : "#0E0E12",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Checkbox de sélection individuelle */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            setSelectedProjectIds((prev) => prev.filter((id) => id !== entry.projectId));
                          } else {
                            setSelectedProjectIds((prev) => [...prev, entry.projectId]);
                          }
                        }}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "#06B6D4",
                          cursor: "pointer",
                        }}
                      />

                      <b style={{ color: "#FFFFFF", fontSize: 13 }}>{entry.title}</b>
                      <span style={{ color: "#71717A", fontSize: 10, fontWeight: 800 }}>{entry.projectId}</span>
                      <span style={{ color: "#A1A1AA", fontSize: 11, fontWeight: 800 }}>
                        {String(entry.updatedAt).slice(0, 16).replace("T", " ")}
                      </span>

                      {/* Boutons d'action individuel */}
                      <button
                        type="button"
                        className="pdi-start-primary"
                        style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 12 }}
                        onClick={() => openProjectInTab(entry)}
                      >
                        Ouvrir
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #7F1D1D",
                          background: "#1F0B0B",
                          color: "#FCA5A5",
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          pdiConfirm({
                            title: "Supprimer le projet",
                            message: `Le projet "${entry.title}" et sa sauvegarde locale seront définitivement supprimés. Cette action ne peut pas être annulée.`,
                            confirmLabel: "Supprimer le projet",
                            destructive: true,
                          }).then((ok) => {
                            if (!ok) return;
                            pdiRemoveProject(entry.projectId);
                            closeTabsForProject(entry.projectId);
                            setSelectedProjectIds((prev) => prev.filter((id) => id !== entry.projectId));
                            setProjectsRefresh((v) => v + 1);
                          });
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  );
                })}
              </div>

              <p style={{ marginTop: 20 }}>Sauvegardes locales détectées sur ce poste :</p>
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {pdiListLocalSessions().length === 0 && (
                  <span style={{ color: "#71717A", fontWeight: 800 }}>
                    Aucune session enregistrée pour le moment. Dessinez un tronçon dans l'éditeur ISO : la sauvegarde locale est automatique.
                  </span>
                )}
                {pdiListLocalSessions().map((session) => (
                  <div
                    key={session.key}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 10,
                      border: "1px solid rgba(255,255,255,.08)",
                      borderRadius: 14,
                      padding: "10px 12px",
                      background: "#0E0E12",
                    }}
                  >
                    <b style={{ color: "#FFFFFF" }}>{session.name}</b>
                    <span style={{ color: "#E4E4E7", fontWeight: 900, fontSize: 11 }}>
                      {session.nodes} noeuds · {session.segments} tronçons
                    </span>
                    <span style={{ color: "#A1A1AA", fontSize: 11, fontWeight: 800 }}>{session.updatedAt}</span>
                    <span style={{ color: "#71717A", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                      {"projet " + session.projectId}
                    </span>
                    <button
                      type="button"
                      className="pdi-start-primary"
                      style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 12 }}
                      onClick={() =>
                        openProjectInTab({
                          projectId: session.projectId,
                          title: session.name || "Projet isometrique",
                          module: "isometric",
                        })
                      }
                    >
                      Ouvrir dans son onglet
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="pdi-start-primary" onClick={() => setNewProjectModalOpen(true)}>
                  Nouveau plan ISO
                </button>
                <button
                  type="button"
                  className="pdi-start-primary"
                  onClick={() => {
                    const added = pdiAdoptOrphanSessions();
                    setProjectsRefresh((v) => v + 1);
                    void pdiAlert(
                      added > 0
                        ? added + " projet(s) récupéré(s) depuis les sauvegardes locales."
                        : "Aucune sauvegarde orpheline à récupérer."
                    );
                  }}
                >
                  Récupérer les sauvegardes orphelines
                </button>
              </div>
            </ComingSoonPanel>
          );
        })()}

        {/* PATCH 017B : plus jamais d ecran vide pour un module sans rendu. */}
        {!PDI_RENDERABLE_MODULES.includes(activeModule) && <ComingSoonPanel title="Espace projets PD&I">
          <p>Ce module n a pas encore d ecran dedie. Reprenez le travail dans l editeur isometrique.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" className="pdi-start-primary" onClick={() => setActiveModule("isometric")}>Ouvrir l editeur ISO</button>
            <button type="button" className="pdi-start-primary" onClick={() => setActiveModule("home")}>Retour accueil</button>
          </div>
        </ComingSoonPanel>}
        {activeModule === "assistant" && <ComingSoonPanel title="Assistant et agents spécialisés"><p>PD&I orchestrera le repo <code>pipeline-design-skill</code> : agents Vision, Croquis, CAO, JSON, ISO, QA. Les agents proposent ; Python calcule.</p></ComingSoonPanel>}
      </main>

      {/* Modal Retour Expérience Utilisateur connecté à Firebase */}
      <PdiFeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        userEmail={pdiUserProfile.email}
        userName={pdiUserProfile.name}
      />

      {/* Modal Nouveau Projet & Raccordement ISO Étape 5 */}
      <PdiNewProjectModal
        isOpen={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onCreateProject={handleOpenNewProject}
      />
    </div>
  );
}
