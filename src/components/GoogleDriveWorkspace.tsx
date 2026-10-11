import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FileText, 
  Upload, 
  RefreshCw, 
  Search, 
  Trash2, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  FolderPlus, 
  Lock,
  ArrowRight
} from 'lucide-react';
import { googleSignIn, logoutGoogle, initAuth, getAccessToken } from '../lib/googleAuth.ts';
import { 
  listDriveFiles, 
  createDriveFolder, 
  getOrCreateDefaultPdiFolder,
  uploadJsonToDrive, 
  deleteDriveFile, 
  downloadDriveFileContent, 
  GoogleDriveFile 
} from '../lib/googleDriveApi.ts';
import { User } from 'firebase/auth';
import { projectsApi } from '../lib/pdiApiClient.ts';

interface GoogleDriveWorkspaceProps {
  onLoadProjectToEditor?: (data: any, name: string) => void;
  currentIsoState?: any;
}

export const GoogleDriveWorkspace: React.FC<GoogleDriveWorkspaceProps> = ({
  onLoadProjectToEditor,
  currentIsoState
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pdi' | 'json' | 'folders'>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Folder creation
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  
  // Export/Upload Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('Projet_ISO_' + new Date().toISOString().slice(0, 10));

  // Delete Confirmation Modal (Mandatory)
  const [fileToDelete, setFileToDelete] = useState<GoogleDriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        if (token) {
          setAccessToken(token);
          loadFiles(token);
        }
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setUser(res.user);
        if (res.accessToken) {
          setAccessToken(res.accessToken);
          loadFiles(res.accessToken);
        }
        setFeedback({ type: 'success', message: `Connecté en tant que ${res.user.email}` });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la connexion Google' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logoutGoogle();
    setUser(null);
    setAccessToken(null);
    setFiles([]);
    setFeedback({ type: 'success', message: 'Déconnecté de Google Drive' });
  };

  const loadFiles = async (token?: string) => {
    const currentToken = token || accessToken || await getAccessToken();
    if (!currentToken) return;
    setLoading(true);
    try {
      const driveFiles = await listDriveFiles(currentToken, searchQuery);
      setFiles(driveFiles);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors du chargement des fichiers Drive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !accessToken) return;
    setLoading(true);
    try {
      const folder = await createDriveFolder(accessToken, newFolderName.trim());
      setFeedback({ type: 'success', message: `Dossier "${folder.name}" créé avec succès !` });
      setNewFolderName('');
      setShowFolderModal(false);
      loadFiles();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la création du dossier' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportIsoToDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !exportFileName.trim()) return;
    setLoading(true);
    try {
      const payload = {
        name: exportFileName,
        app: "PD&I Industrial Piping CAD",
        version: "4.8d",
        exportedAt: new Date().toISOString(),
        author: user?.email || "anonymous",
        content: currentIsoState || { schema: "PD&I Industrial Project", date: new Date().toISOString() }
      };

      const defaultFolderId = await getOrCreateDefaultPdiFolder(accessToken);
      const file = await uploadJsonToDrive(accessToken, exportFileName.trim(), payload, defaultFolderId || undefined);
      
      // Also register/sync the project in PostgreSQL Cloud SQL database
      try {
        await projectsApi.saveProject({
          name: exportFileName.trim(),
          description: "Projet sauvegardé via Google Drive Workspace",
          module: "isometric",
          status: "active",
          driveFileId: file.id,
          driveWebViewLink: file.webViewLink || null,
          data: payload.content,
        });
      } catch (sqlErr) {
        console.warn("Could not sync project record to Cloud SQL:", sqlErr);
      }

      setFeedback({ type: 'success', message: `Fichier ISO "${file.name}" sauvegardé avec succès sur Google Drive & Cloud SQL !` });
      setShowExportModal(false);
      loadFiles();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de l\'export vers Google Drive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (file: GoogleDriveFile) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const rawText = await downloadDriveFileContent(accessToken, file.id);
      const parsed = JSON.parse(rawText);
      if (onLoadProjectToEditor) {
        onLoadProjectToEditor(parsed, file.name);
        setFeedback({ type: 'success', message: `Projet "${file.name}" importé dans l'éditeur ISO !` });
      } else {
        setFeedback({ type: 'success', message: `Fichier "${file.name}" chargé (${rawText.length} octets).` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Impossible de parser le fichier sélectionné en projet PD&I.' });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete || !accessToken) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(accessToken, fileToDelete.id);
      setFeedback({ type: 'success', message: `Fichier "${fileToDelete.name}" supprimé de Google Drive.` });
      setFileToDelete(null);
      loadFiles();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la suppression' });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredFiles = files.filter(file => {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const isJson = file.mimeType === 'application/json' || file.name.endsWith('.json') || file.name.endsWith('.pdi');
    if (activeFilter === 'folders') return isFolder;
    if (activeFilter === 'json') return isJson;
    if (activeFilter === 'pdi') return isJson || file.name.toLowerCase().includes('iso') || file.name.toLowerCase().includes('pdi');
    return true;
  });

  return (
    <div id="google-drive-workspace" className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header Banner */}
      <div id="drive-header-card" className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white shadow-lg">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Google Drive & Cloud SQL Hub
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">europe-west1</span>
              </h1>
              <p className="text-xs text-slate-400">Synchronisation des plans isométriques, schémas tuyauterie & base PostgreSQL Cloud SQL</p>
            </div>
          </div>
        </div>

        {/* Auth status & Action button */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5">
              <div className="text-right">
                <p className="text-xs font-semibold text-white">{user.displayName || user.email}</p>
                <p className="text-[10px] text-emerald-400 font-mono flex items-center justify-end gap-1">
                  <CheckCircle className="w-3 h-3 inline" /> Drive connecté
                </p>
              </div>
              <button 
                id="drive-signout-btn"
                onClick={handleSignOut}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors px-2 py-1 bg-slate-900 rounded-lg border border-slate-700"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <button
              id="drive-signin-btn"
              onClick={handleSignIn}
              disabled={loading}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-xs shadow-lg transition-all hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Connexion Google Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div id="drive-feedback-banner" className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
          feedback.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white font-bold">×</button>
        </div>
      )}

      {/* Main Workspace Controls */}
      {user ? (
        <div className="space-y-6">
          {/* Action Bar */}
          <div id="drive-action-bar" className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="drive-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadFiles()}
                placeholder="Rechercher dans Google Drive (ISO, PDI, JSON...)"
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
              />
            </div>

            <div className="md:col-span-6 flex flex-wrap items-center justify-start md:justify-end gap-2">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeFilter === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Tous
              </button>
              <button 
                onClick={() => setActiveFilter('pdi')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeFilter === 'pdi' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Plans PD&I
              </button>
              <button 
                onClick={() => setActiveFilter('folders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeFilter === 'folders' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Dossiers
              </button>

              <button
                id="drive-refresh-btn"
                onClick={() => loadFiles()}
                disabled={loading}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 transition-colors"
                title="Actualiser"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                id="drive-new-folder-btn"
                onClick={() => setShowFolderModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200"
              >
                <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nouveau dossier</span>
              </button>

              <button
                id="drive-export-iso-btn"
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-lg text-xs shadow-md transition-transform hover:scale-[1.02]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Enregistrer ISO actuel</span>
              </button>
            </div>
          </div>

          {/* Files Grid */}
          <div id="drive-files-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Fichiers Google Drive ({filteredFiles.length})
              </h2>
              <span className="text-[11px] text-slate-500">Google Drive API v3</span>
            </div>

            {loading && files.length === 0 ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <p className="text-xs">Chargement des fichiers Google Drive…</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Folder className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">Aucun fichier trouvé</p>
                <p className="text-xs text-slate-500">Utilisez "Enregistrer ISO actuel" pour exporter votre premier plan vers Google Drive.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredFiles.map((file) => {
                  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                  const isJson = file.mimeType === 'application/json' || file.name.endsWith('.json');
                  return (
                    <div
                      key={file.id}
                      id={`drive-file-${file.id}`}
                      className="group bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3.5 transition-all flex flex-col justify-between gap-3 shadow-sm hover:shadow-cyan-500/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isFolder 
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                            : isJson 
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {isFolder ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {isFolder ? 'Dossier Drive' : file.size ? `${(Number(file.size) / 1024).toFixed(1)} KB` : 'Fichier'} • {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          {isJson && (
                            <button
                              onClick={() => handleImportFile(file)}
                              className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                              title="Ouvrir dans l'éditeur ISO"
                            >
                              <ArrowRight className="w-3 h-3" />
                              <span>Charger ISO</span>
                            </button>
                          )}
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-white transition-colors"
                              title="Ouvrir sur Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        <button
                          onClick={() => setFileToDelete(file)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Supprimer du Drive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State / Not Signed In */
        <div id="drive-login-prompt" className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Connexion Google Drive Requise</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Autorisez l'application à accéder à votre Google Drive pour synchroniser, exporter et archiver vos projets industriels de tuyauterie.
            </p>
          </div>
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-transform hover:scale-[1.02]"
          >
            <Folder className="w-4 h-4" />
            <span>Se connecter avec Google</span>
          </button>
        </div>
      )}

      {/* Modal: Export / Save to Drive */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              Sauvegarder le projet actuel sur Google Drive
            </h3>
            <form onSubmit={handleExportIsoToDrive} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-semibold">Nom du fichier ISO (.json)</label>
                <input
                  type="text"
                  required
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Enregistrer sur Drive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Folder */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              Créer un dossier sur Google Drive
            </h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-semibold">Nom du dossier</label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex: Projets PD&I 2026"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Mandatory Confirmation for Delete */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">Confirmer la suppression sur Google Drive</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le fichier <strong className="text-white font-mono">{fileToDelete.name}</strong> de votre Google Drive ? Cette action ne peut pas être annulée.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
