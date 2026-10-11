import React, { useState } from "react";
import { 
  BookOpen, 
  Shield, 
  Compass, 
  FileText, 
  Calculator, 
  Sparkles, 
  UserCheck, 
  Settings, 
  Database, 
  CheckCircle, 
  ChevronRight, 
  Info,
  Layers,
  ArrowRight
} from "lucide-react";
import { motion } from "motion/react";

interface GuidesTabContentProps {
  isAdmin: boolean;
  userProfile: any;
}

export function GuidesTabContent({ isAdmin, userProfile }: GuidesTabContentProps) {
  const [guideType, setGuideType] = useState<"user" | "admin">(isAdmin ? "admin" : "user");
  const [selectedUserSection, setSelectedUserSection] = useState<number>(0);
  const [selectedAdminSection, setSelectedAdminSection] = useState<number>(0);

  const userSections = [
    {
      title: "1. Espace Documentaire & Plan Interactif",
      icon: Compass,
      color: "text-blue-600 bg-blue-50 border-blue-100",
      intro: "Consultez les clauses techniques applicables et localisez précisément les ouvrages gaziers sur la carte interactive.",
      steps: [
        "Recherche de documents : Saisissez des mots-clés dans la barre de recherche pour filtrer instantanément les clauses réglementaires.",
        "Modes de lecture : Cliquez sur 'Lecture interactive' pour afficher un panneau latéral d'étude approfondie sans perdre votre contexte de navigation.",
        "Carte des canalisations & réseaux : Activez les couches de base (Satellite, Plan, Relief) et cliquez sur les tracés haute pression pour obtenir les caractéristiques détaillées.",
        "Filtres cartographiques : Utilisez les cases à cocher pour afficher uniquement les postes de détente, vannes de sectionnement ou canalisations spécifiques."
      ]
    },
    {
      title: "2. Suivi de Projet & Plan de Charge",
      icon: Layers,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
      intro: "Mettez à jour l'avancement physique et gérez les contraintes opérationnelles sur vos chantiers affectés.",
      steps: [
        "Attribution automatique : Les projets où vous êtes désigné comme Chef de projet d'étude ou de travaux apparaissent automatiquement sur votre profil.",
        "Mise à jour d'avancement : Modifiez le pourcentage d'avancement physique. La barre de progression visuelle se mettra à jour en temps réel pour l'ensemble de la hiérarchie.",
        "Filtre 'Objectif Mise en Gaz / Ouverture de Chantier' : Utilisez le nouveau filtre du Plan de Charge pour trier instantanément les affaires selon les jalons critiques.",
        "Journal des contraintes : Enregistrez les retards administratifs, techniques ou météorologiques pour conserver un historique infalsifiable sur Firestore."
      ]
    },
    {
      title: "3. Calculateurs d'Ingénierie Gaz",
      icon: Calculator,
      color: "text-orange-600 bg-orange-50 border-orange-100",
      intro: "Réalisez des calculs dimensionnels précis conformes aux normes de sécurité de transport de gaz.",
      steps: [
        "Volume géométrique : Calculez la contenance exacte d'une canalisation en spécifiant son diamètre nominal (DN) et sa longueur de tronçon.",
        "Durée de purge d'azote : Estimez le temps requis pour l'inertage d'un ouvrage de raccordement selon le débit d'injection de sécurité sélectionné.",
        "Perte de charge : Estimez la chute de pression dynamique selon le débit de transit du gaz et les pressions d'entrée théoriques.",
        "Export : Copiez directement les résultats formatés dans le presse-papiers pour les insérer dans vos notes de calcul techniques."
      ]
    },
    {
      title: "4. Procès-Verbaux de Réception (PV)",
      icon: FileText,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      intro: "Générez des rapports de conformité de chantier réglementaires avec signature numérique intégrée.",
      steps: [
        "Saisie des fiches d'autocontrôle : Remplissez les questionnaires de vérification QA/QC (Soudure, Enrobage, Essai de pression).",
        "Génération automatique : Le système compile instantanément les fiches de contrôle pour créer un document officiel structuré.",
        "Signatures électroniques : Les intervenants autorisés (Chef de projet, Entreprise, Exploitant) peuvent apposer leur signature manuscrite directement via l'écran tactile.",
        "Export PDF : Générez un document de procès-verbal finalisé intégrant l'en-tête officiel de la plateforme."
      ]
    },
    {
      title: "5. Référentiel Technique & Normes PD&I",
      icon: Sparkles,
      color: "text-purple-600 bg-purple-50 border-purple-100",
      intro: "Consultez le référentiel normatif et les abaques techniques du calcul de tuyauterie et transport de gaz.",
      steps: [
        "Normes & Codes : Accédez directement aux exigences ASME B31.3, ASME B31.8 (Transport Gaz), ASME B31.12 (Hydrogène), EN 13480 et CODETI.",
        "Abaques & Dimensions : Vérifiez les diamètres nominaux, épaisseurs de paroi (Schedules) et classes de pression standardisées.",
        "Procédures d'épreuve : Consultez les méthodologies réglementaires d'épreuve hydrostatique (notamment la méthode GAUVIN)."
      ]
    }
  ];

  const adminSections = [
    {
      title: "1. Gestion des Comptes & Rôles",
      icon: UserCheck,
      color: "text-amber-600 bg-amber-50 border-amber-100",
      intro: "Contrôlez les habilitations d'accès à la plateforme et créez directement des comptes d'utilisateurs.",
      steps: [
        "Création de compte directe (Box 3) : Renseignez le nom, l'email, le mot de passe initial, le rôle (Ingénieur, Administrateur ou Directeur / Gérant) et la direction régionale.",
        "Habilitations hiérarchiques : Le profil 'Ingénieur' ne peut que consulter et éditer ses projets affectés. L'Administrateur dispose de droits complets sur l'espace documentaire et la configuration globale de la plateforme.",
        "Profil Directeur / Gérant : Ce nouveau type de compte dispose d'accès de niveau administrateur (calculateurs, bordereau de prix, ajout de projets, et sections études/travaux) avec une restriction ou élargissement géographique de visibilité selon le poste : 'Directeur Central' (visibilité nationale totale et arbitrage), 'Directeur Principal' (visibilité complète du pôle d'affectation) ou 'Directeur de Région' (supervision exclusive des canalisations haute pression de la direction régionale).",
        "Annuaire d'équipe : Visualisez la liste complète des comptes activés et supprimez instantanément les accès obsolètes en toute sécurité."
      ]
    },
    {
      title: "2. Personnalisation & Branding",
      icon: Settings,
      color: "text-blue-600 bg-blue-50 border-blue-100",
      intro: "Adaptez la charte graphique de la plateforme aux couleurs de votre direction régionale.",
      steps: [
        "Titre & Description (Box 5) : Modifiez dynamiquement l'en-tête principal affiché sur tous les postes connectés.",
        "URL du logo & de l'image d'accueil : Saisissez l'adresse de votre logo d'entreprise. Pour utiliser une image issue de Google Drive, suivez la méthode de conversion d'URL.",
        "Synchronisation temps réel : Toutes les modifications esthétiques sont sauvegardées sur Firestore et appliquées instantanément aux utilisateurs connectés."
      ]
    },
    {
      title: "3. Intégration Firestore & Liens Directs",
      icon: Database,
      color: "text-rose-600 bg-rose-50 border-rose-100",
      intro: "Assurez la liaison robuste des fichiers médias hébergés à distance dans l'application.",
      steps: [
        "Abonnement temps réel (Box 2) : L'indicateur de raccordement confirme la synchronisation bidirectionnelle instantanée avec le serveur Cloud Firestore.",
        "Conversion Google Drive : Pour utiliser une image hébergée sur Google Drive, remplacez la structure 'drive.google.com/file/d/ID/view' par l'URL d'affichage direct 'drive.google.com/uc?export=view&id=ID' pour contourner le blocage d'iframe.",
        "Importation de données : Utilisez la console d'administration pour charger des bases de données de canalisations ou de documents techniques au format JSON."
      ]
    },
    {
      title: "4. Contrôle des Widgets de l'Accueil",
      icon: Shield,
      color: "text-purple-600 bg-purple-50 border-purple-100",
      intro: "Activez ou désactivez les widgets d'analyse globale de la page d'accueil (Super Admin).",
      steps: [
        "Filtre de confidentialité : Activez ou désactivez les widgets d'avancement physique moyen et de répartition des phases sur l'écran d'accueil.",
        "Superviseurs affectés : Déterminez si les widgets ne doivent s'afficher que pour les utilisateurs connectés afin de préserver la confidentialité stratégique des infrastructures régionales."
      ]
    }
  ];

  const currentSections = guideType === "user" ? userSections : adminSections;
  const selectedIndex = guideType === "user" ? selectedUserSection : selectedAdminSection;
  const setSelectedIndex = guideType === "user" ? setSelectedUserSection : setSelectedAdminSection;

  return (
    <div className="space-y-8 max-w-4xl mx-auto" id="guides-tab-container">
      {/* Dynamic Welcome Header Banner */}
      <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/[0.08] rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-amber-500/[0.05] rounded-full filter blur-2xl pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-blue-200 border border-white/5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Centre d'Apprentissage &amp; Documentation</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase">
              Guides d'Utilisation de la Plateforme
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed font-medium">
              Découvrez pas à pas comment exploiter le potentiel de l'application : cartographie, calculs gaz, PV de réception et configurations d'administration.
            </p>
          </div>
          
          {/* Role-based selection toggle */}
          {isAdmin && (
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 w-full md:w-auto shrink-0 self-stretch md:self-auto">
              <button
                onClick={() => setGuideType("user")}
                className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  guideType === "user" 
                    ? "bg-orange-500 text-white shadow-md" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Guide Utilisateur</span>
              </button>
              <button
                onClick={() => setGuideType("admin")}
                className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  guideType === "admin" 
                    ? "bg-amber-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Guide Administrateur</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Guide Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Section List */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider px-1">
            {guideType === "user" ? "Sections de l'Ingénieur" : "Panneaux de l'Administrateur"}
          </h3>
          <div className="space-y-2">
            {currentSections.map((sect, idx) => {
              const IconComp = sect.icon;
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    isSelected 
                      ? "bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/20" 
                      : "bg-white hover:bg-slate-50 border-slate-200/60"
                  }`}
                >
                  <div className={`p-2 rounded-xl border ${sect.color} shrink-0`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-slate-800 truncate leading-snug">
                      {sect.title.split(". ")[1]}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate font-semibold mt-0.5">
                      {sect.intro}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                    isSelected ? "text-blue-500 translate-x-1" : "text-slate-300"
                  }`} />
                </button>
              );
            })}
          </div>

          {/* Quick Stats Notice */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
              <Info className="w-4 h-4 shrink-0 text-blue-600" />
              <span>Référentiel Intégré</span>
            </div>
            <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
              Consultez à tout moment la documentation technique et les guides de calcul pour obtenir des instructions pas à pas sur les épreuves et raccordements.
            </p>
          </div>
        </div>

        {/* Right column: Interactive Detail View */}
        <div className="md:col-span-2">
          {(() => {
            const activeSection = currentSections[selectedIndex];
            const IconComp = activeSection.icon;
            return (
              <motion.div
                key={`${guideType}-${selectedIndex}`}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full"
              >
                {/* Section Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl border ${activeSection.color}`}>
                      <IconComp className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                        {activeSection.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        {activeSection.intro}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section Body - Step-by-Step Instructions */}
                <div className="p-6 flex-1 space-y-5">
                  <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    Instructions d'exécution détaillées :
                  </h4>
                  <div className="space-y-4">
                    {activeSection.steps.map((step, sIdx) => {
                      const [title, desc] = step.split(" : ");
                      return (
                        <div key={sIdx} className="flex gap-4 items-start group">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-black text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-200 mt-0.5">
                            {sIdx + 1}
                          </div>
                          <div className="space-y-1">
                            <h5 className="text-xs font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">
                              {title}
                            </h5>
                            {desc && (
                              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                {desc}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section Footer */}
                <div className="p-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 px-6">
                  <span className="font-semibold">
                    Document d'instruction officiel • V1.2
                  </span>
                  <div className="flex items-center gap-1 text-blue-600 font-bold">
                    <span>Certifié conforme</span>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
