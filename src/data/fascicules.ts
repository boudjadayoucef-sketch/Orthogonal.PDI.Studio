/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fascicule, SparePartItem, BendingRecord } from "../types";

import trenchImg from "../assets/images/trench_technical_sheet_1783361610351.jpg";
import sandbagImg from "../assets/images/sandbag_protection_1783362513651.jpg";
import cableImg from "../assets/images/cable_crossing_protection_1783362523438.jpg";
import crossingImg from "../assets/images/crossing_technical_sheet_1783361623788.jpg";
import ouedImg from "../assets/images/oued_technical_sheet_1783361638299.jpg";
import bendingImg from "../assets/images/cintrage_abaque_1783362534158.jpg";
import posteImg from "../assets/images/poste_technical_sheet_1783361652494.jpg";

export const FASCICULES_DATA: Fascicule[] = [
  {
    id: "fascicule_01",
    number: "01",
    title: "Dispositions Générales",
    summary: "Règles générales pour la préparation, l'établissement, la transmission des documents par l'entrepreneur, et la nomenclature des fournitures et pièces de rechange à sa charge.",
    sections: [
      {
        id: "f1_s1",
        title: "Article 1 - Objet & Domaine d'Application",
        page: 5,
        content: "Les présentes prescriptions techniques générales s'appliquent à l'exécution de l'ensemble des travaux de transport de gaz par canalisations en acier (gazoducs) ainsi qu'aux postes de sectionnement, de dérivation, de coupure, de détente et de livraison. L'Entrepreneur s'engage à respecter scrupuleusement la réglementation technique nationale en vigueur, complétée par les spécifications du présent Cahier des Charges."
      },
      {
        id: "f1_s2",
        title: "Article 2 - Calendrier-Programme et Approbations",
        page: 6,
        content: "Dans les 15 jours calendaires suivant la notification de l'Ordre de Service (ODS) prescrivant le démarrage des travaux, l'Entrepreneur soumettra à l'approbation du Maître de l'Ouvrage (M.O.) le calendrier-programme complet et détaillé de la réalisation des études et des travaux.",
        points: [
          "Ce programme inclura la liste systématique de tous les schémas, dessins d'exécution, plans d'ensemble, notes de calcul, nomenclatures et spécifications de commande de matériel.",
          "Les délais d'établissement et de transmission de ces documents par l'Entrepreneur doivent permettre au M.O. d'exercer son droit de contrôle dans un délai réglementaire de 10 jours ouvrés à compter de la date de réception.",
          "Toutes les modifications ou révisions de plans approuvés feront l'objet d'une nouvelle transmission avec un indice de révision clairement identifié et repéré par un triangle contenant l'indice sur le cartouche officiel."
        ]
      },
      {
        id: "f1_s3",
        title: "Article 3 - Format des Documents et Normes de Rédaction",
        page: 7,
        content: "Tous les documents écrits et graphiques doivent être rédigés en langue française et utiliser exclusivement les unités du Système International (S.I.). Les plans doivent comporter la cartouche agréée du Maître de l'Ouvrage avec l'échelle, le repérage précis des pièces, l'orientation géographique, et les cotes d'encombrement détaillées.",
        points: [
          "Documents écrits (notes de calcul, notices techniques, procès-verbaux, rapports d'avancement) : Format standardisé A4 (297 x 210 mm) sous reliure.",
          "Plans de masse et plans d'ensemble : Formats normalisés de la série A (A0, A1, A2 ou A3) pliés obligatoirement au format A4.",
          "Chaque document ou plan doit porter un numéro de codification uniforme conformément aux exigences de la PD&I, permettant une identification rapide et un classement rigoureux dans les archives techniques."
        ]
      },
      {
        id: "f1_s4",
        title: "Article 4 - Nomenclature des Fournitures & Pièces de Rechange",
        page: 13,
        content: "L'Entrepreneur a la charge exclusive de fournir, de transporter et de remettre en parfait état au Maître de l'Ouvrage la totalité des matériels de rechange (M.R.) strictement interchangeables avec les matériels installés (M.I.).",
        points: [
          "Le calcul des quantités réglementaires à fournir au titre des rechanges obligatoires se base sur le barème et la valeur M.I. (quantités réelles installées).",
          "Si l'application du barème officiel donne un résultat fractionnaire, la quantité de rechange à retenir est systématiquement arrondie à l'unité entière supérieure.",
          "Les pièces de rechange doivent être commandées en même temps que le matériel principal et livrées sur le chantier dans leur emballage d'origine étanche et protégé contre la corrosion."
        ]
      }
    ]
  },
  {
    id: "fascicule_02",
    number: "02",
    title: "Travaux en Tracé Courant",
    summary: "Spécifications pour l'occupation du terrain, la piste de travail, le piquetage, l'ouverture des tranchées, le bardage, le cintrage des tubes et la mise en fouille.",
    annexes: "Annexes 2 à 11",
    illustrations: [
      {
        id: "trench_spec",
        title: "Profil Type de Tranchée Standard (Fascicule 2)",
        src: trenchImg,
        caption: "Extrait officiel du plan de terrassement type de tranchée. Montre la profondeur minimale d'un mètre (1,00m), la largeur réglementaire de d+40cm, le lit de pose de sable fin (10cm) et la disposition du grillage avertisseur orange à 30cm au-dessus de la génératrice supérieure du tube.",
        page: 26
      },
      {
        id: "sandbag_spec",
        title: "Protection par sacs de sable dans les fortes pentes (Fascicule 2)",
        src: sandbagImg,
        caption: "Dessin d'exécution technique pour la protection contre l'érosion et le ravinement dans les pentes supérieures à 15%. Indique la disposition des barrages en sacs de sable ('sacs de sable en barrage de retenue'), le lit de pose de sable et l'ancrage de la canalisation.",
        page: 32
      },
      {
        id: "cable_crossing_spec",
        title: "Croisement de réseaux et protection mécanique par dalle (Fascicule 2 / 7)",
        src: cableImg,
        caption: "Plan type de croisement de canalisation de gaz avec d'autres réseaux enterrés (câbles électriques, conduites d'eau). Détaille l'épaisseur du lit de sable amortisseur, la pose d'une dalle de protection en béton armé ou de briques de protection, et la distance de sécurité minimale verticale de 0,50 m.",
        page: 38
      },
      {
        id: "crossing_spec",
        title: "Détail de Traversée de Route sous Gaine (Fascicule 2)",
        src: crossingImg,
        caption: "Dessin d'exécution technique d'une traversée de route nationale par fonçage ou tranchée ouverte avec gaine de protection en acier. Détaille la disposition des colliers isolants de centrage tous les 1.5m, des obturateurs étanches aux extrémités et du tube reniflard de respiration.",
        page: 40
      },
      {
        id: "crossing_slab_spec",
        title: "Ferraillage et Nomenclature d'une Dalle de Traversée (Fascicule 2)",
        src: crossingImg,
        caption: "Détail technique du ferraillage de la dalle de traversée en béton armé sous route. Présente la nomenclature complète des aciers (T12, T10, cadres), l'emplacement de la cornière d'angle (50x50x1.5), l'épaisseur du béton de propreté et les réservations d'évacuation des eaux pluviales.",
        page: 45
      },
      {
        id: "sandbag_additional_spec",
        title: "Planches de Blindage et Stabilisation en Tranchée (Fascicule 2)",
        src: sandbagImg,
        caption: "Schéma d'exécution des planches de blindage supplémentaires pour les terrains incultes ou instables. Présente le cas des planches encastrées dans les bords de la tranchée, stabilisées par des sacs de terre pour protéger la canalisation contre l'éboulement des parois.",
        page: 34
      },
      {
        id: "cable_crossing_clearance_spec",
        title: "Croisement de Câbles Souterrains (Fascicule 2)",
        src: cableImg,
        caption: "Plan type d'ingénierie PD&I décrivant le passage en dessus ou en dessous d'un câble souterrain. Spécifie la distance libre minimale E (0.40 m pour télécom/fibre, 0.50 m pour lignes électriques), le doublement du revêtement de part et d'autre de l'axe, la distance e par rapport au dispositif grillage avertisseur, et le remblai de sable fin.",
        page: 36
      }
    ],
    sections: [
      {
        id: "f2_s1",
        title: "Article 1 - Piste de Travail, Emprise & Libération des Terrains",
        page: 19,
        content: "La largeur d'emprise de la piste de travail mise à disposition de l'Entrepreneur varie en fonction du diamètre nominal de la canalisation et de la nature topographique du tracé. L'Entrepreneur est tenu d'avertir par écrit les autorités locales et les propriétaires fonciers au moins 8 jours ouvrables avant toute pénétration.",
        points: [
          "Avant le commencement de tout terrassement ou abattage d'arbres, un état des lieux contradictoire (PV réglementaire d'état des lieux) sera dressé avec le M.O., fixant les limites de la piste et l'inventaire des cultures.",
          "Le défrichage, l'essartage et le nivellement de la piste doivent préserver la couche superficielle arable de terre végétale qui sera mise en cordon séparé pour la reconstitution du sol en fin de chantier."
        ],
        procedure: {
          title: "Procédure d'Ouverture de Piste et Préparation de l'Emprise",
          steps: [
            "Notification écrite aux autorités locales et propriétaires fonciers (8 jours ouvrables minimum avant travaux).",
            "Établissement contradictoire du Procès-verbal d'état des lieux et bornage d'emprise réglementaire.",
            "Défrichage sélectif et abattage d'arbres sur l'emprise stricte de la piste autorisée.",
            "Décapage mécanique de la terre végétale superficielle (couche arable) et mise en cordon latéral séparé.",
            "Nivellement et compactage superficiel de la piste de travail pour assurer la circulation sécurisée des engins lourds."
          ],
          equipment: ["Bulldozer D8", "Pelle excavatrice", "Niveleuse (Grader)", "Compacteur à rouleaux vibrant"],
          tolerances: ["Largeur de piste : ± 0.50m par rapport aux limites approuvées", "Profondeur de décapage terre végétale : 15 à 20cm"]
        },
        qaqcChecklist: [
          "PV d'état des lieux signé contradictoirement par toutes les parties.",
          "Terre végétale stockée en cordon distinct, non mélangée aux déblais ordinaires.",
          "Clôtures ou accès rétablis temporairement pour les riverains.",
          "Signalisation de chantier en place aux croisements de routes ou pistes."
        ],
        relatedPv: "etat_des_lieux"
      },
      {
        id: "f2_s2",
        title: "Article 2 - Piquetage de l'Axe & Bornage",
        page: 21,
        content: "Le piquetage général consiste à reporter sur le terrain l'axe de la canalisation défini par le plan de tracé approuvé. Il est matérialisé par des piquets en bois ou métalliques solidement implantés.",
        points: [
          "L'espacement maximal des piquets de repérage de l'axe est de 100 mètres en zone cultivée ou vallonnée, et peut être étendu à 250 mètres en zone plate ou désertique.",
          "Chaque piquet d'axe doit porter l'indication du PK (point kilométrique). Aux points d'inflexion (angles de courbe), le piquet d'angle portera le numéro de l'angle et le rayon théorique de cintrage correspondant.",
          "Le piquetage de sécurité sous les lignes de transport d'énergie électrique aériennes haute tension (HT) doit comporter des balises de limitation de gabarit de hauteur pour les engins de levage."
        ],
        procedure: {
          title: "Procédure d'Implantation Topographique et Piquetage",
          steps: [
            "Transfert des coordonnées XY géoréférencées depuis les plans d'exécution officiels.",
            "Implantation des piquets d'axe aux espacements réglementaires et aux points kilométriques (PK) précis.",
            "Matérialisation rigoureuse des sommets d'angles et calcul du rayon théorique de cintrage requis.",
            "Mise en place de piquets témoins de déport (en dehors de l'emprise des terrassements) pour conserver l'axe.",
            "Balisage de sécurité physique et repérage des réseaux tiers (câbles, canalisations croisées)."
          ],
          equipment: ["Station totale de topographie", "Récepteurs GPS GNSS différentiels RTK", "Jalons et fiches d'arpenteur", "Peinture de marquage haute visibilité"],
          tolerances: ["Tolérance d'implantation planimétrique (XY) : ± 5cm", "Tolérance altimétrique (Z) : ± 2cm"]
        },
        qaqcChecklist: [
          "Carnet de piquetage visé et validé par le topographe agréé du Maître de l'Ouvrage.",
          "Repérage physique clair de tous les angles et PK sur le terrain.",
          "Piquets de déport implantés pour sécuriser la reconstruction de l'axe après passage de la pelle."
        ]
      },
      {
        id: "f2_s3",
        title: "Article 3 - Fouille de Tranchée et Hauteur de Recouvrement",
        page: 26,
        content: "L'ouverture de la tranchée ne doit être entreprise qu'après la réalisation complète du piquetage et de la piste. La hauteur minimale de recouvrement réglementaire (entre le niveau fini du sol et la génératrice supérieure du tube revêtu) est de 1,00 mètre en tracé courant.",
        points: [
          "En terrain désertique meuble ou rocheux plat, la hauteur de recouvrement minimale peut être réduite à 0,80 mètre après accord écrit du M.O.",
          "En cas de croisement d'ouvrages tiers (câbles électriques, conduites d'eau), la hauteur de recouvrement est ajustée pour garantir un espace libre vertical minimal de 0,50 m sous l'obstacle.",
          "La largeur minimale de la tranchée en fond de fouille est calculée selon la formule réglementaire : L = D + 40 cm (où D est le diamètre extérieur de la canalisation revêtue)."
        ],
        procedure: {
          title: "Procédure d'Ouverture des Tranchées",
          steps: [
            "Vérification de l'axe et des balisages de sécurité avant démarrage du terrassement.",
            "Excavation mécanique de la tranchée en respectant la largeur réglementaire L = D + 40 cm.",
            "Stockage des déblais à au moins 1.50 m du bord de la tranchée du côté opposé à la piste de passage.",
            "Purge systématique du fond de tranchée pour éliminer les saillies rocheuses ou pointues.",
            "Contrôle continu de la profondeur de fouille et des pentes de talutage pour éviter les éboulements."
          ],
          equipment: ["Pelle excavatrice chenillée", "Brise-roche hydraulique (BRH) en terrain dur", "Godet trapézoïdal pour talutage"],
          tolerances: ["Largeur de fond : D + 40 cm minimum", "Profondeur de couverture (Recouvrement) : ≥ 1,00 m (± 5cm)"]
        },
        qaqcChecklist: [
          "Profondeur de tranchée validée topographiquement au fond de fouille.",
          "Absence totale d'eau stagnante ou d'éboulement avant le lit de pose.",
          "Distance d'au moins 1,50 m entre le cordon de déblais et la lèvre de la tranchée."
        ],
        relatedIllustrationId: "trench_spec"
      },
      {
        id: "f2_s4",
        title: "Article 4 - Aménagement du Fond de Fouille & Lit de Pose",
        page: 28,
        content: "Le fond de la tranchée doit être soigneusement dressé et purgé de toute saillie de roche, pierre anguleuse ou corps dur susceptible de poinçonner ou de détériorer le revêtement anticorrosion du tube.",
        points: [
          "En terrain rocheux ou pierreux, l'Entrepreneur doit obligatoirement réaliser un lit de pose d'une épaisseur minimale de 10 cm de sable de rivière ou de terre meuble criblée.",
          "Le même sable de protection ou de la terre fine tamisée sera utilisé pour le premier remblaiement enveloppant le tube (jusqu'à 20 cm au-dessus de la génératrice supérieure) avant le remblayage de tout-venant compacté."
        ],
        procedure: {
          title: "Procédure d'Aménagement du Lit de Pose et Remblaiement Initial",
          steps: [
            "Nettoyage manuel final du fond de fouille pour retirer toute pierre ou détritus dur.",
            "Approvisionnement, étalement et régalage régulier d'un lit de sable fin d'une épaisseur constante de 10 cm.",
            "Descente contrôlée et mise en place de la canalisation sur le lit amortisseur.",
            "Enveloppement initial du tube avec du sable de rivière ou terre fine tamisée jusqu'à 20 cm au-dessus de sa génératrice supérieure.",
            "Pose du grillage avertisseur orange de sécurité à 30 cm au-dessus de la génératrice supérieure.",
            "Remblayage final par couches de 20 à 30 cm de tout-venant compacté mécaniquement."
          ],
          equipment: ["Crible mécanique portatif", "Camion benne pour apport de sable", "Dame sauteuse ou compacteur à plaque vibrante"],
          tolerances: ["Épaisseur minimale du lit de sable : 10 cm (0 / +5cm)", "Épaisseur du remblai initial tamisé : 20 cm minimum"]
        },
        qaqcChecklist: [
          "Type et qualité du sable de pose validés par le laboratoire d'essais du M.O.",
          "Vérification de l'absence de contact direct métal/roche ou PE/pierre tranchante.",
          "Grillage avertisseur orange posé à plat et centré sur l'axe du tube."
        ],
        relatedIllustrationId: "trench_spec"
      },
      {
        id: "f2_s5",
        title: "Article 5 - Cintrage à Froid des Tubes en Acier",
        page: 35,
        content: "Les changements de direction du tracé qui ne peuvent être réalisés par l'élasticité naturelle de la canalisation sont exécutés par cintrage à froid à l'aide d'une cintreuse hydraulique de chantier munie d'un sabot adapté au diamètre du tube.",
        points: [
          "Le cintrage à chaud est strictement interdit sur les tubes de ligne.",
          "Le rayon de courbure minimal pour un cintrage à froid ne doit pas être inférieur à 30 fois le diamètre extérieur nominal du tube (R ≥ 30 * Dn). En cas d'épaisseur importante ou d'aciers spéciaux, se référer aux abaques du Fascicule 7.",
          "Tout tube cintré présentant des plis, des ondulations prononcées, des ovalisations de section supérieures à 2,5% ou des rayures profondes sur le revêtement sera systématiquement rejeté."
        ],
        procedure: {
          title: "Procédure de Cintrage Hydraulique à Froid",
          steps: [
            "Mesure précise de l'angle requis par l'équipe de topographie.",
            "Sélection et inspection visuelle du tube en acier de ligne à cintrer.",
            "Mise en place du mandrin pneumatique intérieur (obligatoire pour prévenir l'aplatissement) et introduction dans la cintreuse.",
            "Serrage et application progressive des efforts hydrauliques par passes unitaires ne dépassant pas 1,5° d'inclinaison.",
            "Contrôle géométrique de la flèche et de l'ovalisation finale du tube.",
            "Inspection visuelle approfondie de l'intégralité du revêtement externe PE après cintrage."
          ],
          equipment: ["Machine cintreuse hydraulique de chantier", "Mandrin pneumatique de cintrage interne", "Gabarit de cintrage et curvimètre"],
          tolerances: ["Rayon de courbure minimal : R ≥ 30 * Dn", "Ovalisation maximale tolérée au sommet de courbe : ≤ 2,5% du diamètre nominal"]
        },
        qaqcChecklist: [
          "Absence totale de plissements, d'amorces de rupture ou d'ovalisation visible.",
          "Détection diélectrique de défaut de revêtement (Holiday Detector) après cintrage.",
          "Rayon de cintrage conforme à l'abaque réglementaire de l'Annexe 8."
        ],
        relatedIllustrationId: "bending_abaque_spec"
      },
      {
        id: "f2_s6",
        title: "Article 6 - Traversées d'Obstacles et Franchissements de Sécurité",
        page: 40,
        content: "Les traversées de routes nationales, de voies ferrées et de cours d'eau majeurs font l'objet de dispositions de sécurité renforcées. Ces ouvrages sont préférentiellement posés sous gaine de protection métallique ou en béton armé.",
        points: [
          "Le diamètre extérieur de la gaine de protection doit dépasser d'au moins 20 cm le diamètre extérieur du tube de transport pour permettre une isolation électrique parfaite.",
          "Le tube doit reposer à l'intérieur de la gaine sur des colliers de centrage isolants espacés d'au plus 1,50 mètre.",
          "L'étanchéité aux extrémités de la gaine est assurée par un obturateur souple en élastomère serré par des colliers inoxydables."
        ],
        procedure: {
          title: "Procédure d'Exécution de Traversée sous Gaine d'Acier (Fonçage/Tranchée)",
          steps: [
            "Alignement topographique rigoureux et excavation de la fosse de départ et d'arrivée de fonçage.",
            "Fonçage mécanique horizontal de la gaine de protection en acier.",
            "Soudage des colliers de centrage et d'isolation isolants en PEHD sur le tube de gaz de transport tous les 1.50 m.",
            "Enfilage (tirage) contrôlé du tube de transport revêtu à l'intérieur de la gaine d'acier.",
            "Mise en place des obturateurs d'étanchéité d'extrémité (cloches d'étanchéité en néoprène).",
            "Soudage et élévation des tubes de respiration (reniflards) de 2 pouces aux deux extrémités."
          ],
          equipment: ["Unité de fonçage horizontal (tarière ou pousse-tube)", "Grue ou excavatrice de forte capacité", "Holiday detector portable pour revêtement"],
          tolerances: ["Espacement maximal des colliers isolants : 1.50 m", "Diamètre de gaine : Tube de gaz + 200 mm minimum", "Hauteur du reniflard : 2.00 m au-dessus du sol fini"]
        },
        qaqcChecklist: [
          "Mesure de la résistance d'isolement électrique (mégohmmètre) entre le tube de transport et la gaine d'acier.",
          "Contrôle de l'alignement et de la pente de la gaine posée.",
          "Serrage parfait des colliers de fixation en acier inoxydable des obturateurs."
        ],
        relatedIllustrationId: "crossing_spec"
      }
    ]
  },
  {
    id: "fascicule_03",
    number: "03",
    title: "Assemblage par Soudure",
    summary: "Dispositions pour l'agrément des procédés de soudage, qualification des soudeurs, stockage des électrodes et contrôles non destructifs.",
    illustrations: [
      {
        id: "weld_defects_spec",
        title: "Classification des Défauts de Soudure (Inclusions & Collages) (Fascicule 3)",
        src: bendingImg,
        caption: "Tableau officiel répertoriant les défauts de soudage selon les Groupes 3 et 4. Illustre et classifie les inclusions solides (inclusion de laitier 301, de flux 302, d'oxyde 303, métallique 304) et les manques de fusion (manque de fusion des bords ou collage 4011, entre passes 4012, manque de pénétration ou d'interpénétration 402).",
        page: 72
      }
    ],
    sections: [
      {
        id: "f3_s1",
        title: "Article 1 - Agrément du Procédé de Soudage (WPS/PQR)",
        page: 59,
        content: "Toute opération de soudage sur le chantier doit être exécutée conformément à un mode opératoire de soudage qualifié et agréé par écrit par le Maître de l'Ouvrage ou son organisme de contrôle agréé avant le démarrage de la production.",
        points: [
          "L'Entrepreneur doit rédiger un Descriptif du Mode Opératoire de Soudage (DMOS) précisant les nuances d'acier, les diamètres, les épaisseurs, les types d'électrodes (cellulosiques, basiques, etc.), l'intensité, la tension et la vitesse de soudage.",
          "Des éprouvettes témoins sont soudées dans les conditions réelles du chantier puis soumises à des essais mécaniques destructifs en laboratoire agréé (traction, pliage à l'envers, pliage de côté, résilience Charpy et examens macrographiques)."
        ]
      },
      {
        id: "f3_s2",
        title: "Article 2 - Qualification des Soudeurs (WPQR)",
        page: 63,
        content: "Seuls les soudeurs ayant subi avec succès les épreuves de qualification réglementaires sous la surveillance du M.O. sont autorisés à souder sur l'ouvrage. La validité de la qualification est d'une année, à condition que le soudeur n'ait pas cessé de pratiquer pendant plus de 3 mois.",
        points: [
          "L'épreuve de qualification consiste à souder un joint complet dans la position la plus difficile applicable au projet (généralement position fixe montante ou descendante à 45°).",
          "Chaque soudeur qualifié recevra un numéro matricule et un poinçon d'identification individuel. Il doit frapper ou inscrire au marqueur indélébile son poinçon à 50 mm du joint soudé du côté supérieur."
        ],
        procedure: {
          title: "Procédure d'Évaluation et de Qualification des Soudeurs de Ligne",
          steps: [
            "Inscription du soudeur et vérification de ses diplômes d'aptitude de base.",
            "Attribution d'un numéro matricule temporaire et préparation des éprouvettes témoins en acier de nuance équivalente.",
            "Soudage d'un joint bout à bout complet sous la supervision directe de l'inspecteur QA/QC et du M.O. en position inclinée fixe (45° - position 6G).",
            "Examen visuel et contrôle radiographique (100%) du joint soudé.",
            "Usinage et essais de pliage/traction destructifs en laboratoire agréé.",
            "Émission du PV officiel de qualification de soudeur avec marquage du poinçon individuel attribué."
          ],
          equipment: ["Poste à souder régulé de chantier", "Gabarit de chanfreinage", "Étuve portable de chantier", "Matrice de pliage de laboratoire"],
          tolerances: ["Aucun défaut d'aspect (fissure, caniveau)", "Résistance à la traction ≥ résistance nominale du métal de base", "Angle de pliage sans fissure : 180°"]
        },
        qaqcChecklist: [
          "Procédure de soudage DMOS d'épreuve dûment approuvée et respectée.",
          "Contrôle radiographique du joint témoin déclaré 100% conforme selon API 1104.",
          "Poinçon d'identification unique gravé sur le registre et remis physiquement au soudeur."
        ],
        relatedPv: "qualification_soudeur"
      },
      {
        id: "f3_s3",
        title: "Article 3 - Stockage, Conditionnement et Étuve des Électrodes",
        page: 68,
        content: "Les produits d'apport (électrodes enrobées, fils) doivent être stockés dans leur emballage d'origine scellé, à l'abri de l'humidité, dans un local chauffé et ventilé.",
        points: [
          "Les électrodes de type basique, sensibles à la reprise d'humidité, doivent être obligatoirement étuvées à une température de 300°C à 350°C pendant au moins deux heures avant utilisation.",
          "Sur le chantier, les soudeurs doivent transporter les électrodes basiques dans des carquois chauffants individuels portatifs maintenus à une température d'au moins 70°C.",
          "Toute électrode ayant séjourné plus de 4 heures hors de l'étuve ou du carquois sans protection doit être mise au rebut."
        ]
      },
      {
        id: "f3_s4",
        title: "Article 4 - Contrôle Non Destructif des Joints Soudés (C.N.D.)",
        page: 76,
        content: "Toutes les soudures bout à bout exécutées sur le tracé de la canalisation de transport de gaz de la PD&I doivent être contrôlées à 100% par des méthodes non destructives (radiographie industrielle par rayons X, ou à défaut par rayons Gamma, complétée par des examens par ultrasons).",
        points: [
          "L'évaluation de la qualité des soudures se fait conformément aux normes API 1104 ou ISO 13847, selon les tolérances très strictes du Cahier des Charges.",
          "Les défauts inacceptables tels que fissures, manque de pénétration à la racine, collages, ou inclusions de laitier excessives entraînent le refus immédiat du joint soudé.",
          "En cas de réparation autorisée par le M.O., celle-ci doit être exécutée selon un mode opératoire spécifique et contrôlée à nouveau à 100%. Une deuxième réparation sur le même secteur est strictement interdite : le joint doit être coupé et remplacé par une manchette d'acier d'au moins 500 mm de longueur."
        ],
        procedure: {
          title: "Procédure de Contrôle Radiographique des Joints Soudés",
          steps: [
            "Nettoyage mécanique de la soudure (meulage des projections et calamine) pour obtenir une surface lisse.",
            "Pose des films radiographiques annulaires tout autour de la circonférence extérieure du joint.",
            "Installation de l'indicateur de qualité d'image (I.Q.I.) conforme à la norme ISO 19232.",
            "Établissement du périmètre de sécurité de radioprotection obligatoire (zone contrôlée).",
            "Exposition du joint au faisceau de Rayons X (crawler interne ou faisceau externe panoramique).",
            "Développement chimique des films en chambre noire de chantier.",
            "Lecture critique et interprétation par un inspecteur certifié COFREND/ASNT Niveau II minimum."
          ],
          equipment: ["Générateur de Rayons X directionnel ou panoramique", "Crawler de radiographie interne", "Films radiographiques de classe fine", "Négatoscope calibré haute intensité"],
          tolerances: ["Densité optique des clichés : 2.0 à 4.0", "Sensibilité de l'I.Q.I. : visible au moins jusqu'au fil requis", "Tolérance défauts : Aucune fissure tolérée, manque de pénétration ≤ 25 mm cumulés par 300 mm de soudure"]
        },
        qaqcChecklist: [
          "Attestation d'étalonnage et de conformité de la source et des appareils de mesure.",
          "Certificat d'aptitude médicale et dosimétrique valide des opérateurs radiologues.",
          "Rapport de contrôle radiographique officiel signé avec plan de localisation des clichés."
        ],
        relatedPv: "controle_radiographique"
      }
    ]
  },
  {
    id: "fascicule_04",
    number: "04",
    title: "Ouvrages Annexes & Peinture",
    summary: "Génie civil, massifs d'ancrage, supports de tuyauteries, clôtures de postes, et systèmes de peinture industrielle de protection anticorrosion.",
    illustrations: [
      {
        id: "poste_layout_spec",
        title: "Extrait du Plan d'Implantation d'un Poste de Détente (Fascicule 4)",
        src: posteImg,
        caption: "Aperçu authentique d'implantation générale de génie civil d'un poste de détente standard de la PD&I. Comprend la dalle de l'abri principal, les longrines de clôture, les massifs supports de tuyauteries aériennes et la disposition d'accès.",
        page: 82
      }
    ],
    sections: [
      {
        id: "f4_s1",
        title: "Article 1 - Terrassements de Génie Civil et Fondations de Postes",
        page: 81,
        content: "Les travaux de génie civil concernent la construction des fondations d'équipements, des dalles d'abri de détente, des massifs de butée et d'ancrage, ainsi que les clôtures de sécurité des différents postes du réseau de transport.",
        points: [
          "Les bétons utilisés doivent être des bétons de ciment armé de haute qualité, dosés à 350 kg/m³ de ciment de classe CPJ-CEM II/A 42.5.",
          "Les fouilles pour massifs d'ancrage doivent être creusées de manière à ce que le béton de butée soit coulé directement contre les parois de terre non remuée du terrain naturel, afin de garantir une reprise de poussée optimale.",
          "Toutes les surfaces de béton en contact permanent avec le sol agressif ou humide recevront obligatoirement une application de deux couches d'enduit bitumineux imperméable."
        ]
      },
      {
        id: "f4_s2",
        title: "Article 2 - Supports Métalliques & Ancrages Autoportants",
        page: 90,
        content: "Les canalisations aériennes à l'intérieur des postes doivent être supportées par des massifs en béton surmontés de berceaux de glissement métalliques ou de colliers d'ancrage.",
        points: [
          "Un isolement électrique complet et durable doit être assuré entre la conduite en acier et le support métallique ou le béton. Cet isolement est réalisé par l'interposition d'une plaque d'élastomère résiliente d'au moins 5 mm d'épaisseur.",
          "Les massifs d'ancrage situés sur les coudes ou changements brusques de direction doivent être calculés pour s'opposer aux forces de poussée dynamiques générées par la pression hydrostatique interne sous débit maximal."
        ]
      },
      {
        id: "f4_s3",
        title: "Article 3 - Système de Peinture Industrielle Anticorrosion",
        page: 93,
        content: "Toutes les surfaces métalliques aériennes non enterrées (tubes, vannes, structures de support, abris métalliques) doivent faire l'objet d'un traitement anticorrosion complet par peinture industrielle appliqué selon un processus rigoureux à cinq étapes successives.",
        points: [
          "Étape 1 : Sablage/grenaillage complet au degré de soin Sa 2.5 de la norme internationale ISO 8501-1, pour éliminer toute trace de calamine et de rouille.",
          "Étape 2 (Primaire) : Application immédiate en atelier d'une couche d'impression au minium de plomb de teinte naturelle d'une épaisseur minimale de 40 microns.",
          "Étape 3 (Intermédiaire 1) : Après montage sur site et retouches de soudure, application d'une deuxième couche de minium de plomb teintée au noir de fumée.",
          "Étape 4 (Intermédiaire 2) : Application d'une peinture intermédiaire de protection anticorrosion de couleur gris clair d'épaisseur 35 microns.",
          "Étape 5 (Finition) : Application finale d'une couche de peinture de finition glycérophtalique de couleur aluminium réfléchissant le rayonnement solaire d'une épaisseur minimale de 30 microns (Épaisseur totale sèche du système ≥ 140 microns)."
        ],
        procedure: {
          title: "Procédure de Traitement de Surface et d'Application de Peinture",
          steps: [
            "Nettoyage par dégraissage initial des surfaces métalliques au solvant agréé.",
            "Décapage abrasif par sablage ou grenaillage à sec jusqu'au degré de soin Sa 2.5 minimum (profil de rugosité Moyen G).",
            "Dépoussiérage rigoureux à l'air sec comprimé industriel sans huile.",
            "Application immédiate de la couche primaire au minium de plomb (épaisseur 40 µm) dans les 4 heures maximum après sablage.",
            "Application successive des couches intermédiaires et de la couche finale glycérophtalique d'aluminium (30 µm) en respectant scrupuleusement les temps de séchage et de recouvrement.",
            "Mesure finale de l'épaisseur totale sèche du système de peinture."
          ],
          equipment: ["Sableuse pneumatique industrielle", "Compresseur d'air haute pression avec déshuileur", "Appareil de mesure d'épaisseur sèche (Elcometer)", "Pistolet à peinture Airless"],
          tolerances: ["Degré de sablage requis : Sa 2.5 minimum", "Épaisseur sèche par couche primaire : ≥ 40 microns", "Épaisseur totale sèche finale du système : ≥ 140 microns"]
        },
        qaqcChecklist: [
          "Mesure de la rugosité de surface par rugosimètre ou bande Testex.",
          "Mesure continue des conditions hygrométriques de l'air (humidité relative ≤ 85% et température d'acier ≥ point de rosée + 3°C).",
          "Test d'adhérence par quadrillage (peeling test) conforme aux normes ISO 2409."
        ],
        relatedPv: "peinture_anticorrosion"
      }
    ]
  },
  {
    id: "fascicule_05",
    number: "05",
    title: "Essais et Épreuves",
    summary: "Règles pour le calibrage de la section géométrique, l'épreuve de résistance hydrostatique, et l'épreuve d'étanchéité par la méthode GAUVIN.",
    illustrations: [
      {
        id: "oued_spec",
        title: "Plan de Traversée d'Oued & Lestage (Fascicule 5/7)",
        src: ouedImg,
        caption: "Extrait de plan de pose pour traversée d'un oued. Représente l'enfouissement de la conduite sous le lit stable de l'oued avec des cavaliers de lestage en béton armé espacés pour annuler la force d'Archimède.",
        page: 111
      },
      {
        id: "water_compressibility_spec",
        title: "Table de Compressibilité & Dilatation Thermique de l'Eau (Fascicule 5)",
        src: bendingImg,
        caption: "Tableau officiel d'ingénierie fournissant les coefficients de compressibilité de l'eau (Chi x 10^6) en fonction de la température (2°C à 36°C) et de la pression (1 à 140 Bar), ainsi que la différence de dilatation thermique entre l'eau et l'acier (Beta x 10^6). Indispensable pour la compensation de l'épreuve d'étanchéité Gauvin.",
        page: 128
      },
      {
        id: "water_expansion_spec",
        title: "Courbes des Coefficients d'Expansion et de Compressibilité de l'Eau (Fascicule 5)",
        src: bendingImg,
        caption: "Abaque graphique représentant l'évolution des coefficients d'expansion thermique 'B' et de compressibilité 'A' de l'eau en fonction de la température et de la pression d'épreuve (American Institute of Physics Handbook). Permet de corriger les variations de pression induites par les cycles thermiques.",
        page: 130
      },
      {
        id: "pigging_train_spec",
        title: "Schéma d'un Remplissage Conventionnel & Train de Racleurs (Fascicule 5)",
        src: ouedImg,
        caption: "Schéma de principe du train de racleurs (pistons de remplissage et de purge) avec tête d'essai de départ et d'arrivée. Indique la disposition des vannes d'envoi d'eau de graissage, d'envoi du premier et deuxième pistons, et d'arrivée d'eau du bouchon tampon pour les épreuves hydrauliques.",
        page: 109
      },
      {
        id: "buoyancy_saddle_spec",
        title: "Détail de Cavalier de Lestage en Zone Inondable (Fascicule 5)",
        src: ouedImg,
        caption: "Plan d'exécution technique d'un cavalier de lestage (buoyancy control saddle) préfabriqué en béton armé. Prescrit une distance interaxe maximale de 5,00 m, une hauteur de couverture h1 (0,80m) ou h2 (1,00m) selon la zone, un revêtement renforcé et un recouvrement néoprène de 10mm sous le cavalier.",
        page: 112
      }
    ],
    sections: [
      {
        id: "f5_s1",
        title: "Article 1 - Calibrage de la Section Géométrique (Sizing)",
        page: 107,
        content: "Avant de procéder aux épreuves hydrauliques de résistance et d'étanchéité, l'Entrepreneur doit vérifier l'absence d'ovalisation anormale ou d'obstacle à l'intérieur de la canalisation. Cette vérification est effectuée par le passage d'un racleur de calibrage.",
        points: [
          "Le racleur de calibrage est équipé d'une plaque circulaire (plateau) en acier doux ou en aluminium d'une épaisseur minimale de 10 mm.",
          "Le diamètre extérieur du plateau de calibrage doit être égal à au moins 95% du diamètre intérieur nominal théorique du tube d'épaisseur maximale.",
          "Après récupération du racleur, le plateau ne doit présenter aucune déformation permanente, pli ou entaille majeure, sous peine de refus de la section de conduite."
        ]
      },
      {
        id: "f5_s2",
        title: "Article 2 - Épreuve Hydrostatique de Résistance",
        page: 108,
        content: "L'épreuve hydrostatique de résistance a pour but de valider la tenue mécanique des tubes et des assemblages soudés sous une pression supérieure à la pression maximale de service.",
        points: [
          "La conduite est remplie d'eau propre exempte de sédiments ou de bactéries agressives. La pression est montée par paliers successifs de contrôle (25%, 50%, 75% puis 100% de la pression d'épreuve Pe).",
          "La pression d'épreuve réglementaire Pe dépend de la catégorie de pose de la section concernée : Pe = 1.20 * PMS (Pression Max de Service) pour les zones rurales non habitées (Catégories II et III) ; et Pe = 1.50 * PMS pour les traversées de routes, voies ferrées ou zones habitées à forte densité (Catégorie I et Ia).",
          "La pression d'épreuve maximale doit être maintenue constante sans aucune baisse suspecte pendant une durée ininterrompue de 24 heures."
        ],
        procedure: {
          title: "Procédure d'Épreuve Hydraulique de Résistance",
          steps: [
            "Remplissage d'eau filtrée avec passage de racleurs bi-di de purge d'air.",
            "Installation de l'enregistreur de pression-température de chantier (Mano-thermographe).",
            "Montée en pression par paliers successifs de 25%, 50%, 75% de la pression Pe, avec maintien de 30 minutes à chaque palier pour déceler toute fuite manifeste.",
            "Montée finale à 100% de la pression d'épreuve réglementaire Pe (1,25 ou 1,50 fois la PMS).",
            "Maintien de la pression Pe pendant une durée réglementaire de 24 heures consécutives.",
            "Enregistrement continu des données de pression toutes les 15 minutes sur le disque officiel."
          ],
          equipment: ["Pompe de remplissage haut débit", "Pompe de pressurisation (épreuve) haute pression", "Manomètre étalonné de classe 0.1", "Mano-thermographe enregistreur à disque"],
          tolerances: ["Pression d'épreuve Pe : Minimum requis (1.25x ou 1.50x PMS) maintenu", "Baisse de pression admissible : 0 bar (hors influence thermique calculée)"]
        },
        qaqcChecklist: [
          "Certificats d'étalonnage valides de moins de 6 mois de tous les manomètres.",
          "Qualité de l'eau d'épreuve testée et jugée chimiquement non agressive.",
          "Absence de micro-suintement ou fuite sur toute la longueur de la section testée."
        ],
        relatedPv: "epreuve_resistance"
      },
      {
        id: "f5_s3",
        title: "Article 3 - Épreuve d'Étanchéité - Méthode GAUVIN",
        page: 111,
        content: "L'épreuve d'étanchéité succède immédiatement à l'épreuve de résistance. Elle utilise la méthode scientifique de GAUVIN pour détecter d'éventuelles micro-fuites indétectables au manomètre standard en corrélant précisément les variations de pression avec l'évolution de la température moyenne du sol.",
        points: [
          "Une période de stabilisation thermique obligatoire d'au moins 24 heures (pouvant aller jusqu'à 5 jours selon le diamètre et l'épaisseur) est requise après remplissage complet de la conduite pour équilibrer la température de l'eau avec le sol.",
          "On effectue un test de présence d'air résiduel par une décompression contrôlée en mesurant la quantité d'eau extraite. Le rapport de la chute de pression réelle sur la chute théorique doit être compris entre 0,90 et 1,00.",
          "Les mesures de pression s'effectuent à l'aide d'une balance manométrique de haute précision au 1/100 de bar, et les températures du sol sont relevées à la profondeur de pose par des sondes thermométriques calibrées.",
          "Les calculs du coefficient de compressibilité K et du coefficient thermique du sol permettent d'établir le bilan de fuite théorique. L'épreuve est déclarée satisfaisante si l'erreur de fermeture de l'équation de Gauvin est inférieure au seuil critique admissible d'étanchéité."
        ],
        procedure: {
          title: "Procédure d'Épreuve d'Étanchéité Compensée (Méthode GAUVIN)",
          steps: [
            "Stabilisation thermique de la conduite pleine d'eau pendant 24 à 48 heures minimum.",
            "Test d'air résiduel (Air-volume test) par purge et mesure volumétrique d'une décompression contrôlée de 1 bar.",
            "Raccordement de la balance manométrique de précision (sensibilité 0.01 bar) et des sondes thermiques de sol.",
            "Relevé horaire minutieux sur 24 heures de la pression (P) et des températures de sol (T) aux points de mesure désignés.",
            "Calcul thermodynamique compensé des variations théoriques de pression induites par la température (dp/dT).",
            "Établissement du graphique d'évolution et calcul de l'écart final (équation d'erreur de fermeture Gauvin)."
          ],
          equipment: ["Balance manométrique à poids couteaux étalonnée", "Sondes thermométriques de précision au 1/10 de degré", "Éprouvette graduée de précision pour purge volumétrique"],
          tolerances: ["Rapport du test d'air résiduel : 0.90 à 1.00", "Seuil d'erreur Gauvin admissible : ≤ 0.02 bar d'écart sur 24 heures"]
        },
        qaqcChecklist: [
          "Air residual test validé et conforme avant lancement de l'épreuve d'étanchéité.",
          "Lectures et graphiques visés par l'ingénieur calculs agréé du M.O.",
          "Bilan de fuite nul après compensation mathématique rigoureuse."
        ],
        relatedPv: "epreuve_etancheite"
      }
    ]
  },
  {
    id: "fascicule_06",
    number: "06",
    title: "Archives Techniques",
    summary: "Constitution des dossiers de récolement, plans conformes à l'exécution, dossier d'exploitation, carnet de soudure et documents administratifs.",
    sections: [
      {
        id: "f6_s1",
        title: "Article 1 - Dossier Technique de Conformité Administrative",
        page: 117,
        content: "L'Entrepreneur doit préparer et soumettre au Maître de l'Ouvrage le dossier complet exigé par l'Administration chargée du Contrôle de la Sécurité des Canalisations de Transport de Gaz en vue de l'obtention de l'autorisation officielle de mise en service industriel.",
        points: [
          "Ce dossier administratif comprend la carte d'identité globale de l'ouvrage, le profil en long définitif géoréférencé de la conduite, et l'inventaire des types de tubes installés.",
          "Il doit obligatoirement inclure les procès-verbaux officiels des épreuves hydrostatiques de résistance et d'étanchéité signés contradictoirement par les représentants du M.O., de l'Entrepreneur et de l'organisme de contrôle agréé."
        ]
      },
      {
        id: "f6_s2",
        title: "Article 2 - Dossier d'Exploitation, d'Entretien & Fiches Fournisseurs",
        page: 120,
        content: "Ce dossier regroupe toutes les informations indispensables à l'exploitation et à la maintenance courante de la canalisation et de ses postes annexes par le personnel d'exploitation de la PD&I.",
        points: [
          "Il contient les schémas de principe et de fonctionnement mécanique détaillés de tous les postes de détente, de coupure et de livraison.",
          "Les notices descriptives de fonctionnement, de démontage et d'entretien périodique des matériels de robinetterie (vannes de ligne, clapets anti-retour, soupapes de sécurité, régulateurs, filtres séparateurs).",
          "La liste nominative complète des pièces de rechange effectivement livrées dans les magasins du M.O. avec leur référence fabricant d'origine."
        ]
      }
    ]
  },
  {
    id: "fascicule_07",
    number: "07",
    title: "Annexes et Dessins Techniques",
    summary: "Recueil complet des fiches techniques, abaques de cintrage, tables de compressibilité de l'eau, et schémas d'exécution de génie civil.",
    illustrations: [
      {
        id: "trench_spec",
        title: "Profil en Travers Type de la Tranchée d'Enfouissement (Fascicule 7 / Annexe 2)",
        src: trenchImg,
        caption: "Profil de terrassement réglementaire pour tracé standard. Définit la largeur minimale de fouille (D + 0.40m), l'épaisseur du lit de pose en sable fin criblé (10cm), l'enrobage initial protecteur de la canalisation et le positionnement réglementaire du grillage avertisseur en plastique orange.",
        page: 12
      },
      {
        id: "sandbag_spec",
        title: "Détail de Protection de la Conduite par Sacs de Sable (Fascicule 7 / Annexe 3)",
        src: sandbagImg,
        caption: "Schéma d'exécution pour la protection et la stabilisation de la canalisation dans les pentes ou terrains instables à l'aide de sacs de sable ou de sacs de terre (sandbags). Permet de stabiliser le remblai, de prévenir l'érosion interne due au ravinement des eaux pluviales et de protéger l'acier contre les frottements rocheux.",
        page: 34
      },
      {
        id: "cable_crossing_spec",
        title: "Plan Type de Croisement de Câbles Souterrains (Fascicule 7 / Annexe 4)",
        src: cableImg,
        caption: "Plan type d'ingénierie PD&I décrivant le passage en dessus ou en dessous d'un câble souterrain (télécommunication, fibre optique ou lignes d'énergie BT/MT/HT). Spécifie la distance verticale minimale libre (clearance de 0.40 m à 0.50 m), le remblaiement obligatoire en sable de granulométrie contrôlée et la pose du grillage avertisseur.",
        page: 36
      },
      {
        id: "crossing_spec",
        title: "Plan de Traversée de Route Nationale (Fonçage & Tranchée) (Fascicule 7 / Annexe 5)",
        src: crossingImg,
        caption: "Dessin d'exécution technique d'une traversée de route nationale par fonçage horizontal ou tranchée ouverte avec gaine de protection en acier. Détaille la disposition des colliers isolants de centrage tous les 1.5m, des obturateurs étanches aux extrémités et du tube reniflard de respiration.",
        page: 40
      },
      {
        id: "oued_spec",
        title: "Profil de Pose pour la Traversée d'un Oued (Fascicule 7 / Annexe 6)",
        src: ouedImg,
        caption: "Extrait de plan de pose pour traversée d'un oued. Représente l'enfouissement de la conduite sous le lit stable de l'oued avec des cavaliers de lestage en béton armé espacés pour annuler la force d'Archimède (poussée d'Archimède) et la protection par matelas de gabions ou enrochements.",
        page: 111
      }
    ],
    sections: [
      {
        id: "f7_s_annexe1",
        title: "Annexe 1 - Symboles, Abréviations et Unités de Mesure de l'Ingénierie Gaz",
        page: 5,
        content: "Définition des symboles réglementaires utilisés dans les plans de l'ingénierie gazière de PD&I. Elle normalise les représentations graphiques pour les vannes de sectionnement, les piquages, la protection cathodique, les postes de coupure, ainsi que les unités de mesure de débit (Nm³/h), de pression (bar) et de température (°C).",
        points: [
          "Standardisation des abréviations : Dn (Diamètre Nominal), Ep (Épaisseur), Pms (Pression Maximale de Service), Pe (Pression d'Épreuve).",
          "Représentation graphique unifiée des raccords isolants monoblocs, des gares de racleurs et des postes de détente.",
          "Unités de pression légales : bar pour la pression relative et bar abs pour la pression absolue.",
          "Normalisation de la température de référence : 0°C et 1,01325 bar pour les Normo-mètres cubes (Nm³)."
        ]
      },
      {
        id: "f7_s_p26",
        title: "Annexe 2 - Profils Types de Tranchées (Terrain Normal, Rocheux & Sablonneux)",
        page: 26,
        content: "Le profil type de tranchée pour la pose en ligne courante exige une hauteur de couverture d'au moins 1,00 m au-dessus de la génératrice supérieure du tube pour le protéger des contraintes superficielles. Un lit de pose de sable ou de terre meuble de 10 cm est obligatoire en fond de fouille. Le remblayage s'effectue par des couches successives de terre tamisée exempte de pierres (20 cm) puis de remblai ordinaire compacté, surmonté d'un grillage avertisseur orange de sécurité.",
        points: [
          "Hauteur de recouvrement réglementaire minimale : 1,00 m (peut être réduite à 0,80 m en zone désertique).",
          "Largeur de tranchée réglementaire en fond de fouille : d + 40 cm (où d est le diamètre extérieur du tube).",
          "Positionnement du grillage avertisseur plastique de couleur orange à 30 cm au-dessus du tube.",
          "Lit de pose amortisseur de sable de carrière d'une épaisseur minimale de 10 cm."
        ]
      },
      {
        id: "f7_s_p32",
        title: "Annexe 3 - Dispositifs de Protection par Sacs de Sable en Forte Pente",
        page: 32,
        content: "Dans les sections à forte pente supérieure à 15%, le ruissellement des eaux de pluie présente un risque d'érosion interne de la tranchée. Le cahier des charges impose la pose d'ancrages par barrages de retenue de sacs de sable disposés à intervalles réguliers autour de la canalisation. Ces barrages stables stabilisent le remblai et guident les eaux vers les exutoires latéraux.",
        points: [
          "Applicable obligatoirement sur les déclivités du terrain supérieures à 15%.",
          "Sacs en fibres synthétiques imputrescibles remplis de sable de granulométrie fine.",
          "Espacement de calcul des barrages en sacs de sable : de 10 à 15 mètres selon le degré exact de la pente.",
          "Enveloppe complète de protection résiliente pour éviter les frottements directs et l'abrasion du revêtement en PE."
        ]
      },
      {
        id: "f7_s_p38",
        title: "Annexe 4 - Croisement de Réseaux Souterrains et Dalles de Protection",
        page: 38,
        content: "Lors du croisement d'un gazoduc avec un réseau tiers enterré (câble d'énergie, conduite d'eau potable ou de télécommunications), une distance verticale minimale de 0,50 m doit être scrupuleusement respectée. Pour prévenir tout contact mécanique ou électrique accidentel futur lors de travaux tiers, une dalles de protection mécanique (béton armé ou briques pleines) est installée entre les deux réseaux.",
        points: [
          "Distance de sécurité verticale minimale : 0,50 m entre les génératrices en regard.",
          "Lit de sable fin amortisseur entre le tube de gaz et la dalle de protection d'épaisseur minimale de 10 cm.",
          "Dalle de protection constituée de béton armé dosé à 350 kg/m³ ou de briques de terre cuite jointoyées.",
          "Mise en place d'un grillage avertisseur rouge spécifique pour l'électricité ou jaune pour le gaz au-dessus du croisement."
        ]
      },
      {
        id: "f7_s_p37",
        title: "Annexe 4 Bis - Parallélisme et Proximité de Câbles Électriques Souterrains",
        page: 37,
        content: "Le parallélisme ou la proximité étroite de conduites de gaz avec des câbles électriques souterrains d'énergie de moyenne (MT) ou haute tension (HT) exige des mesures préventives strictes pour éviter l'influence thermique directe sur l'enveloppe en acier ou son revêtement isolant en polyéthylène, ainsi que les risques lors de terrassements ultérieurs. Une distance de séparation horizontale réglementaire est requise.",
        points: [
          "Distance horizontale réglementaire minimale de 1,00 m en ligne droite en tracé parallèle courant.",
          "En cas d'encombrement extrême ou de passage forcé, la distance peut être réduite à 0,50 m à condition d'interposer un écran physique isolant résistant (dalles de béton, briques de terre cuite, demi-coquilles ou fourreaux PEHD).",
          "Les liaisons électriques HT/THT de forte puissance doivent être dimensionnées ou éloignées de manière à maintenir la température de la paroi du tube inférieure à 50°C sous charge nominale.",
          "Pose obligatoire de rubans ou grillages avertisseurs distincts parallèles : rouge spécifique pour l'électricité et jaune ou orange pour le gaz."
        ]
      },
      {
        id: "f7_s_p39",
        title: "Annexe 4 Ter - Croisement de Lignes Électriques Aériennes Haute Tension",
        page: 39,
        content: "Le franchissement aérien du tracé d'un gazoduc de transport par des lignes d'énergie électrique à haute tension (HTA/HTB) présente des risques d'influences électromagnétiques induites en régime permanent et transitoire (courts-circuits aériens). Des dispositions d'équipotentialité, de limitation d'induction et de sécurité d'exploitation d'engins mécaniques doivent être mises en œuvre.",
        points: [
          "Gabarit vertical de sécurité minimal : Distance verticale d'au moins 8,00 m (lignes < 50 kV) ou 12,00 m (lignes ≥ 50 kV) sous flèche maximale des conducteurs par rapport au sol.",
          "Aucun pylône de support de la ligne aérienne ne doit être implanté à moins de 10 m de la génératrice supérieure du tube de gaz (hors zone de servitude d'utilité publique).",
          "Installation obligatoire d'anneaux de terre équipotentiels (mise à la terre locale du tube) aux points d'induction maximale pour dériver les courants alternatifs vers le sol.",
          "Mise en œuvre de limiteurs de surtension à semi-conducteurs ou de raccordements spécifiques aux anodes sacrificielles de protection cathodique."
        ]
      },
      {
        id: "f7_s_p40",
        title: "Annexe 5 - Traversées de Routes Nationales et Départementales sous Gaine de Protection",
        page: 40,
        content: "Les traversées de routes nationales ou départementales s'effectuent sous gaine de protection en acier pour éviter la transmission directe des charges de trafic routier lourdes à la conduite de gaz de transport. La canalisation de gaz est centrée au sein de la gaine à l'aide de colliers isolants espacés régulièrement. Les extrémités de la gaine sont obturées de manière étanche et reliées à un tube reniflard de respiration s'élevant à l'air libre.",
        points: [
          "Gaine d'acier de diamètre supérieur d'au moins 200 mm à celui du gazoduc.",
          "Mise en place de colliers isolants de centrage en polyéthylène haute densité tous les 1,50 m.",
          "Obturateurs d'extrémité en élastomère étanche serrés par colliers en acier inoxydable.",
          "Tube reniflard de respiration de diamètre minimal 2 pouces s'élevant à 2,00 m au-dessus du sol avec chapeau pare-pluie."
        ]
      },
      {
        id: "f7_s_p111",
        title: "Annexe 6 - Traversées d'Oueds et Cavaliers de Lestage en Béton",
        page: 111,
        content: "Le franchissement des cours d'eau temporaires ou permanents (oueds) expose le gazoduc à des risques d'érosion de berges et de flottaison due à la poussée d'Archimède lors des crues. La conduite doit être enfouie à une profondeur d'au moins 1,50 m sous le lit stable estimé de l'oued. La compensation de la flottabilité est assurée par la pose de cavaliers lourds de lestage préfabriqués en béton armé vibré.",
        points: [
          "Profondeur de couverture minimale sous le lit de l'oued : h ≥ 1,50 m.",
          "Cavaliers de lestage en béton armé dosé à 350 kg/m³ de ciment avec un coefficient de sécurité contre la flottaison de 1,1.",
          "Protection mécanique du revêtement anticorrosion du tube par une selle résiliente en élastomère de 5 mm sous le cavalier.",
          "Pentes de raccordement des berges de l'oued limitées à 15° maximum pour garantir la stabilité géotechnique des talus."
        ]
      },
      {
        id: "f7_s_p115",
        title: "Annexe 6 Bis - Massifs d'Ancrage de Coudes en Béton",
        page: 115,
        content: "Aux points de changement de direction (coudes horizontaux ou verticaux) et aux extrémités fermées de la conduite, la pression interne du gaz génère des forces de poussée hydrostatiques considérables. Des massifs d'ancrage en béton de type poids doivent être coulés directement contre le terrain naturel non remanié pour transférer ces efforts au sol sans déplacement de la conduite.",
        points: [
          "Calcul de l'effort de poussée : Fp = 2 * P * S * sin(θ/2) (où P est la pression d'épreuve, S la section du tube, et θ l'angle de déviation).",
          "Béton armé dosé à un minimum de 350 kg de ciment CPA-CEM I par mètre cube.",
          "Interposition obligatoire d'une feuille élastomère résiliente de 5 mm d'épaisseur entre le tube et le béton pour éviter l'abrasion du revêtement lors des cycles thermiques.",
          "Le bétonnage doit laisser les soudures de raccordement du tube entièrement libres et accessibles pour le contrôle non destructif."
        ]
      },
      {
        id: "f7_s1",
        title: "Annexe 7 - Abaques Officiels de Cintrage à Froid et Compressibilité de l'Eau",
        page: 125,
        content: "Ces abaques fixent avec précision le rayon minimal de cintrage à froid admissible pour chaque diamètre nominal de tube en acier en fonction de la nuance de l'acier (X52, X60, X70) et de l'épaisseur nominale de paroi du tube. Ils intègrent également la table de compressibilité thermique de l'eau utilisée pour corriger les calculs de l'épreuve hydraulique de résistance.",
        points: [
          "Sert à calculer le nombre d'angles de cintrage nécessaires pour suivre la courbure verticale ou horizontale du tracé.",
          "Présente la table de compressibilité thermique de l'eau utilisée pour corriger les calculs de l'épreuve Gauvin (Fascicule 5).",
          "Coefficient de dilatation thermique de l'eau et sa variation selon la température (de 4°C à 40°C).",
          "Abaque de correction de pression pour compenser la température moyenne d'épreuve du tronçon de conduite."
        ]
      },
      {
        id: "f7_s_p126",
        title: "Annexe 8 - Abaque de Cintrage à Froid des Tubes en Acier API 5L",
        page: 126,
        content: "Le cintrage à froid des tubes sur le chantier doit être effectué à l'aide d'une cintreuse hydraulique de type machine à mâchoires lisses sans plissement. Le rayon de courbure minimal admissible de l'axe du tube est de R ≥ 30 * Dn (généralement R ≥ 30 * Dn pour les gros diamètres). Cette règle stricte évite d'induire des micro-fissures ou des contraintes résiduelles d'ovalisation critiques.",
        points: [
          "Rayon de cintrage minimal à froid : R ≥ 30 * Dn (ex : pour un tube de 12\" 3/4, R ≥ 9,70 m).",
          "Angle de déviation maximal autorisé par passe unitaire de cintrage : 1,5° pour les nuances X60 et X70.",
          "Ovalisation finale maximale admise au point de courbure : ≤ 2,5% du diamètre extérieur d'origine.",
          "Contrôle systématique par passage d'un calibre d'épaisseur après cintrage."
        ]
      },
      {
        id: "f7_s2",
        title: "Annexe 9 - Ouvrages de Traversées Spéciales (Voies Ferrées, Autoroutes, Caniveaux)",
        page: 130,
        content: "Ensemble des plans types pour la réalisation des traversées d'obstacles majeurs comme les voies ferrées de la SNTF, les autoroutes ou les caniveaux industriels à haute charge d'exploitation.",
        points: [
          "Traversée de route nationale par fonçage avec gaine en acier de forte épaisseur.",
          "Traversée de voie ferrée selon les normes de sécurité de la SNTF avec dalles de répartition de charge.",
          "Croisement type avec câbles électriques sous fourreaux de protection béton armé."
        ]
      },
      {
        id: "f7_s3",
        title: "Annexe 10 - Implantation de Postes de Coupure, de Sectionnement et de Détente",
        page: 185,
        content: "Ensemble des dessins d'architecture et d'implantation de génie civil pour postes de détente et postes de livraison de gazoducs de transport.",
        points: [
          "Plan de masse d'un poste de détente type avec positionnement de la double clôture de sécurité, du portail d'accès de 4 mètres de large, de la zone de roulement empierrée et des caniveaux d'évacuation d'eau pluviale.",
          "Détail des dalles de fondation en béton armé coulées sur hérisson pour réchauffeurs de gaz de procédé.",
          "Détail de la double clôture en panneaux profilés avec fil concertina supérieur anti-intrusion."
        ]
      },
      {
        id: "f7_s_p190",
        title: "Annexe 10 Bis - Gares de Racleurs d'Expédition et de Réception (Sas de Lancement)",
        page: 190,
        content: "Les gares de racleurs sont des équipements de sécurité indispensables installés aux extrémités du gazoduc (dans l'enceinte des postes de départ et d'arrivée) pour permettre le nettoyage, le calibrage et l'inspection interne périodique de la conduite par racleurs intelligents. Le dessin technique définit le piquage, le diamètre élargi du sas de lancement et les sécurités de fermeture mécanique.",
        points: [
          "Diamètre du sas d'introduction élargi d'au moins 2 pouces par rapport au diamètre nominal du gazoduc.",
          "Système de fermeture rapide équipé d'un interverrouillage mécanique breveté (interdiction d'ouverture sous pression).",
          "Vannes de bipasse et de décharge raccordées à la torche d'évacuation ou au bac de purge des condensats du poste.",
          "Pente légère de 1% du sas vers l'avant pour faciliter l'introduction du racleur et l'évacuation des sédiments."
        ]
      },
      {
        id: "f7_s_annexe11",
        title: "Annexe 11 - Procédures de Soudage Approuvées (WPS / PQR) et Métaux d'Apport",
        page: 195,
        content: "Spécification technique des cahiers de soudage réglementaires pour l'assemblage bout à bout des tubes en acier carbone API 5L. Elle définit les types de chanfrein, les températures de préchauffage requises selon les conditions climatiques, l'épaisseur unitaire des passes et les exigences de qualification des soudeurs agréés par PD&I.",
        points: [
          "Procédés de soudage approuvés : Électrode enrobée cellulosique (passes de pénétration) et basique (passes de remplissage et de finition).",
          "Contrôle de la température inter-passes : Maintien obligatoire d'une température minimale de 100°C sur les fortes épaisseurs.",
          "Chanfrein réglementaire en V à 30° avec un méplat de 1,6 mm, tolérance de désalignement High-Low inférieure à 1,6 mm.",
          "Traçabilité totale : Marquage indélébile de chaque soudure avec le poinçon personnel du soudeur qualifié."
        ]
      },
      {
        id: "f7_s_annexe12",
        title: "Annexe 12 - Spécifications et Raccordement de la Protection Cathodique",
        page: 200,
        content: "Schémas d'exécution pour la mise en place de la protection cathodique par courant imposé (soutirage) ou par anodes sacrificielles (magnésium). Elle détaille l'implantation des postes de soutirage (déversoir), les lits d'anodes profonds et les raccordements électriques sécurisés aux prises de potentiel (bornes d'essai).",
        points: [
          "Poste de soutirage : Redresseur automatique de courant asservi au potentiel de protection (maintenu entre -0,85 V et -1,15 V par rapport à l'électrode de référence Cu/CuSO₄).",
          "Lits d'anodes en silico-fonte ou graphite disposés en puits profonds (jusqu'à 50 m) pour minimiser la résistance de terre.",
          "Prises de potentiel : Boîtiers de mesure disposés au droit des vannes, croisements de réseaux et tous les 2 km.",
          "Câbles de liaison électrique de type NYY de forte section avec gaine de protection mécanique extérieure étanche."
        ]
      },
      {
        id: "f7_s_annexe13",
        title: "Annexe 13 - Revêtement Anticorrosion Externe en Polyéthylène Tri-Couche (3LPE)",
        page: 210,
        content: "Prescriptions d'application et de contrôle qualité du revêtement externe tri-couche en polyéthylène extrudé (3LPE). Il comprend une couche primaire d'époxy en poudre (FBE), un adhésif copolymère intermédiaire et une gaine de polyéthylène haute densité externe pour une excellente barrière anticorrosion et mécanique.",
        points: [
          "Épaisseur minimale réglementaire du revêtement 3LPE : de 2,2 mm à 3,5 mm selon le diamètre extérieur du tube.",
          "Essai de détection des défauts par balai électrique (Holiday Detector) sous une tension d'épreuve de 25 kV.",
          "Spécifications des bandes thermorétractables pour l'enrobage isolant des joints de soudure de raccordement sur chantier.",
          "Essai d'adhérence du revêtement (Peel Test) à réaliser périodiquement pour valider la qualité de l'application."
        ]
      },
      {
        id: "f7_s_annexe14",
        title: "Annexe 14 - Procédures d'Essais Hydrostatiques de Résistance et d'Étanchéité",
        page: 215,
        content: "Protocole technique pour la réalisation et l'évaluation des essais hydrauliques réglementaires de résistance mécanique et d'étanchéité à l'eau sur les tronçons de gazoducs terminés. Définit l'enchaînement des étapes de mise en pression, de stabilisation thermique et d'enregistrement graphique continu.",
        points: [
          "Pression d'épreuve de résistance (Pe) : Calculée à 1,5 fois la Pms en zone résidentielle (Classe A) et 1,25 fois en zone rurale.",
          "Durée d'enregistrement obligatoire : 24 heures continues pour l'essai d'étanchéité, avec instruments de mesure certifiés.",
          "Critère de conformité : Aucune variation de pression résiduelle non corrélable aux variations mesurées de température du sol.",
          "Procédure de vidange, de raclage et de séchage de la canalisation après l'épreuve à l'eau."
        ]
      },
      {
        id: "f7_s_annexe15",
        title: "Annexe 15 - Signalisation, Balisage et Bornes de Repérage de la Canalisation",
        page: 225,
        content: "Détails constructifs des dispositifs de signalisation de la conduite enterrée. Elle spécifie les dimensions, couleurs et inscriptions des bornes de balisage en béton ou métal, des plaques indicatrices au droit des vannes et de la signalisation aérienne de sécurité.",
        points: [
          "Bornes de repérage : Implantées à chaque changement de direction, au droit des franchissements et au minimum tous les 500 m.",
          "Inscriptions réglementaires : Logo PD&I, diamètre nominal de la conduite, pression nominale et numéro de téléphone d'urgence.",
          "Code couleur : Jaune sécurité pour le gaz à haute pression, blanc pour la protection cathodique.",
          "Plaques d'avertissement de survol aérien implantées aux limites de zones d'accès réglementé."
        ]
      },
      {
        id: "f7_s_annexe16",
        title: "Annexe 16 - Dispositifs de Sectionnement de Ligne (Vannes de Ligne et By-Pass)",
        page: 235,
        content: "Plans de montage types pour les vannes de sectionnement principales en ligne et leurs conduites de by-pass destinées à l'équilibrage des pressions avant ouverture. Elle spécifie le mode d'exploitation (manuel, motorisé ou pneumatique à sécurité positive).",
        points: [
          "Vannes de ligne de type sphérique à passage intégral (Ball Valve) avec double étanchéité (DBB - Double Block and Bleed).",
          "Piquages de by-pass dimensionnés à 1/3 du diamètre nominal pour permettre une égalisation douce de la pression en amont/aval.",
          "Actuateurs de vannes de sécurité à fermeture automatique en cas de baisse rapide de la pression du réseau (LBV - Line Break Valve).",
          "Raccordements de purge et d'évent s'élevant à 4 m au-dessus du sol avec dispositifs coupe-flammes réglementaires."
        ]
      },
      {
        id: "f7_s_annexe17",
        title: "Annexe 17 - Piquages de Raccordement et Opérations sous Pression (Hot Tapping)",
        page: 245,
        content: "Directives techniques et de sécurité pour la réalisation de piquages de dérivation sur conduite en service sans interruption du débit de gaz (piquage en charge ou Hot Tapping). Spécifie les calculs d'épaisseur du té enveloppant de renfort et les contrôles préalables.",
        points: [
          "Calcul de la température de paroi et de l'épaisseur minimale du tube porteur pour éviter le risque de perfonement thermique.",
          "Pose d'un té enveloppant de renforcement intégral (Full Encirclement Split Tee) soudé circonférentiellement.",
          "Contrôle ultrasonore (UT) à 100% de la zone de soudure sur le tube en charge avant de procéder au perçage.",
          "Vitesse maximale d'écoulement du gaz régulée pendant l'opération de coupe pour refroidir correctement la fraise."
        ]
      },
      {
        id: "f7_s_annexe18",
        title: "Annexe 18 - Joints Isolants Monoblocs (Raccords Diélectriques de Postes)",
        page: 255,
        content: "Spécifications de montage et de test des joints isolants monoblocs (raccords diélectriques) insérés sur la canalisation pour délimiter les zones protégées cathodiquement et empêcher la circulation de courants vagabonds vers les installations de surface des postes.",
        points: [
          "Résistance d'isolement électrique minimale en usine : supérieure à 10 Mégohms sous une tension de 1000 V CC.",
          "Essai d'étanchéité diélectrique à réaliser sur site après soudage à l'aide d'un éclateur de protection contre les surtensions.",
          "Installation obligatoire hors-sol ou en chambre de visite ventilée et étanche à l'humidité pour préserver l'isolement.",
          "Revêtement isolant interne et externe spécifique appliqué en usine pour résister aux hydrocarbures condensés."
        ]
      },
      {
        id: "f7_s_annexe19",
        title: "Annexe 19 - Clôtures de Sécurité Réglementaires et Portails des Postes",
        page: 265,
        content: "Dessins types d'architecture pour la sécurisation physique des enceintes des postes de coupure, de détente et de livraison. Elle normalise le type de grillage, la hauteur et la protection contre l'intrusion d'animaux ou de personnes non autorisées.",
        points: [
          "Clôture constituée d'un grillage métallique plastifié haute résistance de 2,00 m de hauteur surmonté de 3 rangs de ronces.",
          "Portail principal à double battant d'une largeur libre de 4,00 m pour permettre l'accès facile des camions de maintenance.",
          "Portillon piéton de service de 1,00 m équipé de serrure de sécurité PD&I avec barre anti-panique.",
          "Semelle en béton de fondation continue sous le grillage pour empêcher l'affouillement du sol par le ruissellement d'eau."
        ]
      },
      {
        id: "f7_s_annexe20",
        title: "Annexe 20 - Canalisations de Drainage et Évacuation des Eaux Pluviales des Postes",
        page: 275,
        content: "Système de collecte et de drainage des eaux météorologiques à l'intérieur de la plate-forme d'un poste de gaz. Elle spécifie la pente des caniveaux, la pose de regards de décantation et les séparateurs d'hydrocarbures obligatoires avant rejet à l'environnement.",
        points: [
          "Pente générale de la plate-forme du poste réglée à 1,5% vers les caniveaux périphériques en béton préfabriqué.",
          "Séparateur d'hydrocarbures par gravité installé en point bas pour traiter les eaux de ruissellement des zones de vannes.",
          "Regards de visite de dimensions 60x60 cm avec grilles amovibles en fonte ductile disposés tous les 20 m.",
          "Caniveaux de câbles d'instrumentation et de commande entièrement étanches avec dalles de couverture amovibles."
        ]
      },
      {
        id: "f7_s_annexe21",
        title: "Annexe 21 - Raccordements de Terre Générale et Liaisons Équipotentielles",
        page: 285,
        content: "Schémas de principe de la boucle de terre du poste et des liaisons équipotentielles reliant l'ensemble des structures métalliques, tuyauteries aériennes, gares de racleurs et armoires d'instrumentation pour éliminer les tensions de contact et de pas.",
        points: [
          "Boucle de terre périphérique en cuivre nu de section minimale 50 mm² enfouie à une profondeur de 0,80 m.",
          "Piquets de terre en acier cuivré de 2 m de longueur espacés régulièrement pour garantir une résistance globale inférieure à 10 Ohms.",
          "Raccordement des tuyauteries de gaz aériennes à la terre via des éclateurs de protection de type Ex (antidéflagrants).",
          "Liaisons de pontage souples en tresse de cuivre au droit des brides de vannes pour assurer la continuité électrique."
        ]
      },
      {
        id: "f7_s_annexe22",
        title: "Annexe 22 - Armoires de Télétransmission et Télémesure (SCADA / RTU)",
        page: 295,
        content: "Spécifications d'implantation et de câblage de l'unité terminale distante (RTU) et des équipements de transmission de données (fibre optique, liaison satellite ou radio) permettant la surveillance en temps réel de l'état du poste depuis le dispatching central.",
        points: [
          "Armoire de télétransmission auto-ventilée et climatisée avec protection contre la foudre et les surtensions d'alimentation.",
          "Système d'alimentation sans coupure (SASI / UPS) assurant une autonomie minimale de 48 heures sur batteries étanches.",
          "Raccordement des transmetteurs de pression, température et débit par câbles armés blindés de type instrumentation.",
          "Module d'interface SCADA conforme aux protocoles de communication PD&I de type Modbus TCP ou DNP3."
        ]
      },
      {
        id: "f7_s_annexe23",
        title: "Annexe 23 - Systèmes de Détection de Gaz et de Sécurité Incendie dans les Postes",
        page: 305,
        content: "Directives techniques pour l'implantation et le calibrage des capteurs de détection de fuite de gaz (méthane) et des détecteurs thermiques/flammes installés dans les locaux techniques fermés (cabines de détente, locaux de comptage).",
        points: [
          "Capteurs de détection de gaz à technologie infrarouge ou catalytique réglés pour s'alarmer à 10% et 20% de la LIE.",
          "Déclenchement automatique de l'électrovanne de sécurité principale (ESD - Emergency Shut Down) à 20% de la LIE.",
          "Système de ventilation forcée antidéflagrante (ATEX) asservi aux détecteurs de gaz pour balayer l'air intérieur.",
          "Sirènes d'alarme sonore extérieure et gyrophares de signalisation visuelle rouge installés aux accès du poste."
        ]
      },
      {
        id: "f7_s_annexe24",
        title: "Annexe 24 - Extincteurs Réglementaires et Moyens de Première Intervention",
        page: 315,
        content: "Plan d'implantation et spécifications des équipements mobiles et fixes d'extinction d'incendie obligatoires dans les postes. Elle détaille le choix des agents extincteurs et les quantités requises selon le volume de gaz exploité.",
        points: [
          "Extincteurs à poudre chimique sèche ABC de 50 kg montés sur roues disposés à proximité des cabines de détente.",
          "Extincteurs portatifs à dioxyde de carbone (CO₂) de 6 kg destinés aux feux électriques dans les locaux RTU et tableaux BT.",
          "Bacs à sable sec de 100 litres avec pelles à manche isolant disposés au niveau de la zone de vannes.",
          "Signalétique réglementaire normalisée indiquant l'emplacement et le mode d'utilisation de chaque extincteur."
        ]
      },
      {
        id: "f7_s_annexe25",
        title: "Annexe 25 - Plaques Signalétiques de Sécurité et Étiquetage de Vannes",
        page: 325,
        content: "Spécifications d'étiquetage des vannes, conduites et appareils de mesure à l'intérieur des installations de transport. Elle normalise le lettrage, le code de couleur et les matériaux résistant aux UV pour garantir une identification rapide par l'exploitant.",
        points: [
          "Plaques d'identification des vannes en acier inoxydable ou aluminium gravé fixées par colliers métalliques.",
          "Code de désignation normalisé PD&I : type de vanne (ex : MV-301), diamètre nominal et pression de service.",
          "Flèches indicatrices de sens d'écoulement du gaz peintes sur les canalisations aériennes (couleur jaune sécurité).",
          "Panneaux d'interdiction réglementaires : 'DÉFENSE DE FUMER', 'ACCÈS RÉSERVÉ AU PERSONNEL AUTORISÉ', 'DANGER GAZ'."
        ]
      },
      {
        id: "f7_s_annexe26",
        title: "Annexe 26 - Prescriptions de Terrassement à Proximité d'Ouvrages Existants",
        page: 335,
        content: "Directives méthodologiques pour la réalisation de fouilles à proximité immédiate ou au croisement d'ouvrages existants (autres gazoducs, conduites de carburant, canalisations d'eau de grand diamètre). Elle impose des limites d'utilisation d'engins mécaniques.",
        points: [
          "Obligation de réaliser des sondages manuels préalables (fouilles d'identification) pour localiser précisément l'ouvrage existant.",
          "Terrassement mécanique interdit à moins de 1,50 m de la paroi extérieure de la canalisation en service.",
          "Obligation d'installer un soutènement de blindage rigide pour éviter le glissement de terrain autour de la conduite sous pression.",
          "Surveillance continue et présence obligatoire d'un représentant qualifié de PD&I pendant les phases actives de fouille."
        ]
      },
      {
        id: "f7_s_annexe27",
        title: "Annexe 27 - Essais Non Destructifs des Joints Soudés (Radiographie, Ultrasons)",
        page: 345,
        content: "Protocole technique d'application et critères d'acceptabilité des contrôles non destructifs (CND) à réaliser sur 100% des soudures circonférentielles du gazoduc. Elle spécifie l'usage de la radiographie par rayons X ou gamma-graphie.",
        points: [
          "Contrôle radiographique systématique (100% RX) pour toutes les soudures de ligne et de raccordement (Golden Welds).",
          "Critères d'acceptation selon le code API 1104 (limites d'inclusion de laitier, manque de pénétration et soufflures).",
          "Contrôle par ultrasons (UT) complémentaire pour la levée de doute sur les défauts d'épaisseur et d'alignement.",
          "Archivage numérique obligatoire des clichés radiographiques avec rapports d'interprétation visés par un inspecteur certifié."
        ]
      },
      {
        id: "f7_s_annexe28",
        title: "Annexe 28 - Tolérances d'Alignement des Tubes (High-Low) et Accouplement",
        page: 355,
        content: "Spécifications géométriques pour l'accouplement des tubes avant soudage. Elle définit les limites admissibles de désalignement interne (High-Low) pour garantir une pénétration régulière de la racine de la soudure sans amorce de rupture.",
        points: [
          "Désalignement interne maximal toléré (High-Low) : ≤ 1,6 mm sur toute la circonférence du joint de soudure.",
          "Utilisation obligatoire d'un aligneur interne hydraulique (Internal Line-up Clamp) pour les diamètres supérieurs à 12 pouces.",
          "L'aligneur interne ne doit être relâché qu'après exécution complète de la première passe de soudage (passe de racine) à 100%.",
          "Mesure systématique à l'aide d'un calibre de soudure (Hi-Lo Gauge) avant le début du soudage de liaison."
        ]
      },
      {
        id: "f7_s_annexe29",
        title: "Annexe 29 - Procédures de Séchage, de Balayage et d'Étalonnage de la Canalisation",
        page: 365,
        content: "Méthodologie réglementaire pour éliminer l'eau résiduelle présente dans la canalisation après la réalisation des essais hydrostatiques. Elle spécifie les performances du séchage par air sec (ou par vide) pour prévenir les hydrates de gaz lors de l'exploitation.",
        points: [
          "Lancement de racleurs de séchage en mousse de forte densité poussés à l'air sec comprimé sans huile.",
          "Point de rosée cible de l'air de séchage en sortie de tronçon : égal ou inférieur à -40°C, maintenu stable pendant 4 heures.",
          "Séchage alternatif par le vide poussé (Vacuum Drying) pour les traversées d'obstacles complexes non raclables.",
          "Contrôle de la teneur en eau résiduelle à l'aide d'hygromètres de précision calibrés."
        ]
      },
      {
        id: "f7_s_annexe30",
        title: "Annexe 30 - Liste Minimale des Pièces de Rechange de Première Urgence",
        page: 375,
        content: "Définition des pièces de rechange et matériels de sécurité stratégiques devant être livrés par l'entrepreneur à la réception technique des travaux pour assurer l'exploitation et faire face aux incidents éventuels du réseau de transport.",
        points: [
          "Lot de joints diélectriques isolants monoblocs de secours pour chaque diamètre nominal représenté sur le tracé.",
          "Kits de rechange complets pour vannes de ligne (garnitures d'étanchéité, clapets, joints de tige de commande).",
          "Anodes de magnésium de secours et boîtiers de mesure pour la maintenance de la protection cathodique.",
          "Éléments filtrants pour les filtres à gaz d'entrée des postes de détente (consommables de mise en service)."
        ]
      },
      {
        id: "f7_s_annexe31",
        title: "Annexe 31 - Couples de Serrage Mécanique Réglementaires des Brides de Raccordement",
        page: 385,
        content: "Spécification technique normalisant les valeurs de couple de serrage et la méthode de serrage en croix des boulons d'assemblage des brides de canalisations sous pression de gaz (séries ANSI 150, 300, 600).",
        points: [
          "Utilisation obligatoire de clés dynamométriques hydrauliques calibrées ou de tendeurs de goujons hydrauliques.",
          "Méthode de serrage progressif en croix en 4 passes successives : 30%, 60%, 100% du couple cible, puis passe finale de contrôle.",
          "Valeurs de couple de serrage calculées pour atteindre une précontrainte de boulon égale à 50% de sa limite élastique.",
          "Lubrification réglementaire des filetages et faces d'appui d'écrous avec de la pâte anti-grippante haute température."
        ]
      },
      {
        id: "f7_s_annexe32",
        title: "Annexe 32 - Procédures Réglementaires d'Inertage et de Balayage à l'Azote",
        page: 395,
        content: "Protocole de sécurité pour la réalisation de l'inertage à l'azote (N₂) de la canalisation avant sa mise en gaz ou lors de travaux de modification. Elle vise à remplacer l'air présent par un gaz inerte pour éviter la formation de mélanges explosifs.",
        points: [
          "Teneur en oxygène (O₂) cible en bout de canalisation : strictement inférieure à 2% en volume pour valider l'inertage.",
          "Injection d'azote liquide vaporisé à température contrôlée supérieure à +5°C pour éviter le choc thermique sur l'acier.",
          "Utilisation de racleurs séparateurs spécifiques (azote/air et azote/gaz naturel) pour minimiser la zone d'interface et de mélange.",
          "Dispositifs d'évent sécurisés équipés de prises d'échantillonnage de gaz et d'analyseurs portatifs d'oxygène certifiés."
        ]
      },
      {
        id: "f7_s_annexe33",
        title: "Annexe 33 - Modèle Officiel de PV de Réception Technique avant Mise en Gaz",
        page: 405,
        content: "Document type de réception d'ouvrage à viser obligatoirement par la commission technique de PD&I, l'organisme de contrôle agréé et l'entrepreneur pour autoriser l'introduction du gaz naturel dans la canalisation.",
        points: [
          "Vérification de la conformité du dossier de construction complet (As-Built Documentation) et des radiographies de soudures.",
          "Validation des certificats d'épreuves hydrostatiques et du rapport de séchage de la conduite (point de rosée).",
          "Attestation de bon fonctionnement des équipements de protection cathodique et d'étanchéité diélectrique.",
          "Signature finale du Procès-Verbal de Réception Technique ouvrant droit à l'autorisation de mise en gaz réglementaire."
        ]
      },
      {
        id: "f7_s_annexe34",
        title: "Annexe 34 - Prescriptions Environnementales pour la Remise en État des Lieux",
        page: 415,
        content: "Obligations contractuelles de l'entrepreneur concernant la réhabilitation des terrains traversés après la pose du gazoduc. Elle vise à restaurer le profil naturel du sol, stabiliser les sols meubles et prévenir l'érosion.",
        points: [
          "Enlèvement complet de tous les déchets de chantier, restes d'électrodes de soudage et bandes de protection usagées.",
          "Régalage de la couche arable de terre végétale préalablement décapée et stockée séparément lors de l'ouverture de la piste.",
          "Restauration complète des fossés d'irrigation, des pistes agricoles et des clôtures privées croisées lors du tracé.",
          "Mise en œuvre de plantations de stabilisation ou de géotextiles anti-érosion sur les berges d'oueds restaurées."
        ]
      },
      {
        id: "f7_s_annexe35",
        title: "Annexe 35 - Guide de Maintenance Préventive et d'Inspection Décennale du Gazoduc",
        page: 425,
        content: "Cahier d'exploitation technique fixant la périodicité et le contenu des inspections à réaliser sur le gazoduc de transport en service. Elle normalise les contrôles de protection cathodique, les tournées de surveillance et les inspections par racleurs intelligents.",
        points: [
          "Tournées de surveillance pédestre ou aérienne de la piste de servitude : hebdomadaires en zone urbaine, mensuelles en zone rurale.",
          "Mesure systématique des potentiels de protection cathodique aux bornes de mesure tous les trimestres.",
          "Inspection interne par racleur instrumenté de mesure de perte d'épaisseur (MFL - Magnetic Flux Leakage) tous les 10 ans.",
          "Contrôle annuel de la conformité réglementaire de la double clôture et des dispositifs de coupure d'urgence des postes."
        ]
      }
    ]
  }
];

export const SPARE_PARTS_RULES: SparePartItem[] = [
  {
    id: "complete_devices",
    designation: "Matériels & appareils complets (Vannes, soupapes, détendeurs, compteurs, thermomètres, manomètres, etc.)",
    unit: "Unité (U)",
    ranges: [
      { minMI: 1, maxMI: 4.9, mrFormula: "1", calc: () => 1 },
      { minMI: 5, maxMI: 19.9, mrFormula: "2", calc: () => 2 },
      { minMI: 20, maxMI: 59.9, mrFormula: "4", calc: () => 4 },
      { minMI: 60, maxMI: 99.9, mrFormula: "5", calc: () => 5 },
      { minMI: 100, maxMI: Infinity, mrFormula: "5% de M.I", calc: (mi) => Math.ceil(0.05 * mi) }
    ]
  },
  {
    id: "flange_joints",
    designation: "Joints de brides",
    unit: "Unité (U)",
    ranges: [
      { minMI: 1, maxMI: 19.9, mrFormula: "5", calc: () => 5 },
      { minMI: 20, maxMI: 49.9, mrFormula: "10", calc: () => 10 },
      { minMI: 50, maxMI: 99.9, mrFormula: "20", calc: () => 20 },
      { minMI: 100, maxMI: Infinity, mrFormula: "20% de M.I", calc: (mi) => Math.ceil(0.20 * mi) }
    ]
  },
  {
    id: "threaded_studs",
    designation: "Tige filetée y compris 2 écrous et 2 rondelles par tige",
    unit: "Unité (U)",
    ranges: [
      { minMI: 1, maxMI: 49.9, mrFormula: "5", calc: () => 5 },
      { minMI: 50, maxMI: 99.9, mrFormula: "10", calc: () => 10 },
      { minMI: 100, maxMI: Infinity, mrFormula: "10% de M.I", calc: (mi) => Math.ceil(0.10 * mi) }
    ]
  },
  {
    id: "threaded_piping",
    designation: "Tuyauterie filetée et raccorderies à visser",
    unit: "Mètre (M)",
    ranges: [
      { minMI: 1, maxMI: Infinity, mrFormula: "20% de M.I", calc: (mi) => Math.ceil(0.20 * mi) }
    ]
  },
  {
    id: "piping_standard",
    designation: "Tuyauterie de ligne",
    unit: "Mètre (M)",
    ranges: [
      { minMI: 1, maxMI: Infinity, mrFormula: "10% de M.I", calc: (mi) => Math.ceil(0.10 * mi) }
    ]
  },
  {
    id: "groove_joints",
    designation: "Raccords & Joints de fonds de gorge",
    unit: "Unité (U)",
    ranges: [
      { minMI: 1, maxMI: Infinity, mrFormula: "20% de M.I", calc: (mi) => Math.ceil(0.20 * mi) }
    ]
  }
];

export const RIGHT_OF_WAY_TABLE = [
  { diameterInches: "3\" à 6\"", diameterMm: "80 à 150", a: 0.5, b: 2.5, c: 2.5, d: 2.5, total: 8 },
  { diameterInches: "8\" à 10\"", diameterMm: "200 à 250", a: 1.0, b: 2.5, c: 2.5, d: 4.0, total: 10 },
  { diameterInches: "12\" à 16\"", diameterMm: "300 à 400", a: 1.5, b: 2.5, c: 2.5, d: 5.5, total: 12 },
  { diameterInches: "18\" à 26\"", diameterMm: "450 à 650", a: 3.0, b: 2.5, c: 2.5, d: 8.0, total: 16 },
  { diameterInches: "28\" à 38\"", diameterMm: "700 à 950", a: 4.0, b: 2.5, c: 2.5, d: 11.0, total: 20 },
  { diameterInches: "40\" à 52\"", diameterMm: "1000 à 1300", a: 5.5, b: 2.5, c: 2.5, d: 13.5, total: 24 },
  { diameterInches: "54\" à 60\"", diameterMm: "1350 à 1500", a: 6.5, b: 2.5, c: 2.5, d: 16.5, total: 28 }
];

export const COLD_BENDING_DATA: BendingRecord[] = [
  {
    diameterInches: "4 1/2\"",
    gaugePlateDiameter: 105.2,
    thicknesses: { 4: 7.0, 5: 6.0, 6: 5.0, 7: 4.3, 8: 3.6, 9: 3.3, 10: 3.0 }
  },
  {
    diameterInches: "6 5/8\"",
    gaugePlateDiameter: 156.6,
    thicknesses: { 4: 10.7, 5: 8.5, 6: 7.3, 7: 6.2, 8: 5.4, 9: 4.8, 10: 4.3 }
  },
  {
    diameterInches: "8 5/8\"",
    gaugePlateDiameter: 205.0,
    thicknesses: { 4: 14.0, 5: 11.2, 6: 9.3, 7: 8.0, 8: 7.0, 9: 6.2, 10: 5.6 }
  },
  {
    diameterInches: "10 3/4\"",
    gaugePlateDiameter: 257.3,
    thicknesses: { 5: 14.0, 6: 11.6, 7: 10.0, 8: 8.7, 9: 7.8, 10: 7.0, 11: 6.4 }
  },
  {
    diameterInches: "12 3/4\"",
    gaugePlateDiameter: 305.6,
    thicknesses: { 5: 16.5, 6: 14.0, 7: 12.0, 8: 10.5, 9: 9.0, 10: 3.3, 11: 7.5 }
  },
  {
    diameterInches: "16\"",
    gaugePlateDiameter: 384.2,
    thicknesses: { 5: 20.0, 6: 17.5, 7: 15.0, 8: 13.0, 9: 12.0, 10: 10.0, 11: 9.5 }
  },
  {
    diameterInches: "20\"",
    gaugePlateDiameter: 482.5,
    thicknesses: { 6: 21.0, 7: 18.5, 8: 16.2, 9: 14.3, 10: 13.0, 11: 11.8, 12: 11.0 }
  },
  {
    diameterInches: "24\"",
    gaugePlateDiameter: 579.3,
    thicknesses: { 6: 25.5, 7: 22.0, 8: 19.5, 9: 17.0, 10: 15.5, 11: 14.0, 12: 13.0 }
  },
  {
    diameterInches: "30\"",
    gaugePlateDiameter: 725.5,
    thicknesses: { 7: 27.5, 8: 24.0, 9: 22.0, 10: 19.3, 11: 17.5, 12: 16.0 }
  },
  {
    diameterInches: "40\"",
    gaugePlateDiameter: 967.5,
    thicknesses: { 8: 32.0, 9: 28.5, 10: 25.5, 11: 23.5, 12: 21.5, 13: 20.0, 14: 18.5 }
  },
  {
    diameterInches: "48\"",
    gaugePlateDiameter: 1162.1,
    thicknesses: { 8: 37.3, 9: 33.0, 10: 30.5, 11: 28.0, 12: 25.5, 13: 24.0, 14: 22.0 }
  }
];
