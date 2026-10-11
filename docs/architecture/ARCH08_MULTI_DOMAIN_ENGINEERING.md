# ARCH-08 — MULTI-DOMAIN ENGINEERING ARCHITECTURE

## 0. STATUT & RÉFÉRENCE

- **Identifiant** : ARCH-08
- **Module** : Multi-Domain Engineering Architecture
- **Statut** : PASS / IMPLEMENTED
- **Socle amont** : ARCH-00 à ARCH-07 (LOCKED)
- **Couche d'appartenance** : `PRODUCT_CORE` (Layer 1 — ARCH-07)

---

## 1. OBJECTIF & ARCHITECTURE CIBLE

ARCH-08 fait évoluer l'architecture de PD&I pour supporter de manière unifiée plusieurs domaines d'ingénierie industrielle (`PIPING`, `PIPELINE`, `PACKAGE`, `EQUIPMENT`) sans créer de moteurs parallèles, de copies divergentes ou de duplication du modèle métier.

### 1.1 Principe Fondamental
> **Les domaines d'ingénierie partagent les modèles et services communs (géométrie 2D/3D, modèle universel, quantification BOM/MTO), tout en conservant leurs contraintes métier et vocabulaires spécifiques via des descripteurs et adaptateurs orthogonaux.**

### 1.2 Diagramme Architectural Global

```text
                    PD&I ENGINEERING PLATFORM
                              │
              ┌───────────────┼───────────────┐
              │               │               │
           PIPELINE         PIPING       PACKAGE/SKID
              │               │               │
              └───────────────┼───────────────┘
                              │
                          EQUIPMENT
                              │
                              ▼
                   COMMON ENGINEERING MODEL
                    (PdiUniversalEntity)
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          GEOMETRY         NORMATIVE       QUANTIFICATION
             │                │                │
          2D / 3D        CODES / RULES       BOM/MTO
             │                │                │
             └────────────────┼────────────────┘
                              │
                         DELIVERABLES
```

---

## 2. LES DOMAINES D'INGÉNIERIE (`EngineeringDomain`)

Les 4 domaines canoniques sont définis de façon stricte et internationale :

| Domaine (`EngineeringDomainId`) | Libellé international | Description d'application | Références de codes applicables |
| :--- | :--- | :--- | :--- |
| **`PIPING`** | Piping Engineering (Process & Plant Facilities) | Tuyauteries de procédé, utilités et auxiliaires en intérieur de limites (refineries, usines chimiques, centrales). | ASME B31.3, EN 13480, ASME B31.1 |
| **`PIPELINE`** | Pipeline Engineering (Transmission & Distribution) | Canalisations de transport longue distance et distribution (gaz naturel, hydrocarbures, hydrogène). | ASME B31.4, ASME B31.8, ASME B31.12, ISO 13623 |
| **`PACKAGE`** | Package & Skid Modular Engineering | Unités modulaires pré-assemblées, skids de pompage/compression, enveloppes de transport et points de raccordement. | ASME B31.3, EN 13480 |
| **`EQUIPMENT`** | Equipment & Pressure Vessels Engineering | Équipements mécaniques sous pression, colonnes, ballons, réservoirs de stockage, pompes et tubulures (nozzles). | ASME B31.3, EN 13480 |

---

## 3. DOMAINE VS CAPABILITÉ (`Domain vs Capability`)

Une distinction nette est établie entre :
- **Le Domaine** (`EngineeringDomainId`) : Ce qu'est le projet ou le sous-système industriel.
- **La Capacité** (`EngineeringCapabilityId`) : Ce que le logiciel sait calculer, manipuler ou délivrer.

Un domaine n'embarque pas nécessairement toutes les capacités :

```text
PIPING
  ├── 2D, 3D, ISOMETRIC
  ├── COMPONENT_SELECTION
  ├── NORMATIVE_VALIDATION, CALCULATION
  └── BOM, MTO, WELD, SPOOL, DELIVERABLES

PIPELINE
  ├── 2D, 3D
  ├── ALIGNMENT, STATIONS (Points kilométriques / PK)
  ├── COMPONENT_SELECTION
  ├── NORMATIVE_VALIDATION, CALCULATION
  └── BOM, MTO, WELD, DELIVERABLES (pas de spool atelier)

PACKAGE
  ├── 2D, 3D, ISOMETRIC
  ├── COMPONENT_SELECTION
  ├── NORMATIVE_VALIDATION, CALCULATION
  └── BOM, MTO, WELD, SPOOL, DELIVERABLES

EQUIPMENT
  ├── 2D, 3D
  ├── COMPONENT_SELECTION
  ├── CALCULATION
  └── BOM, MTO, DELIVERABLES
```

Le registre `EngineeringDomainRegistry` permet de vérifier dynamiquement si une capacité est active pour un domaine via `isCapabilitySupported(domainId, capability)`.

---

## 4. DOMAINE VS CLIENT (`Domain vs Client`)

Conformément à **ARCH-07**, le domaine d'ingénierie est **100% indépendant de l'organisation cliente** :

```text
EngineeringDomain               PdiOrganizationProfile
       │                                   │
       ▼                                   ▼
PIPELINE / PIPING /            CLIENT / COMPANY / EPC
PACKAGE / EQUIPMENT            (Profil paramétrable)
```

- Un projet `PIPELINE` peut être réalisé pour n'importe quel opérateur ou EPC international.
- Aucune mention, logo, préfixe ou division client historique n'est codé en dur dans les descripteurs ou registres de domaine.
- L'audit systématique `FORBIDDEN_HISTORICAL_CLIENT_PATTERNS` est garanti à 100%.

---

## 5. DOMAINE VS NORMATIF (`Domain vs Normative`)

Le domaine technique **ne contient jamais** de règles, de formules ou de calculs normatifs codés en dur :

```text
PROJECT
   │
   ▼
ENGINEERING DOMAIN
   │ (déclare les codes de conception applicables, ex: ASME B31.8, ASME B31.3)
   ▼
NORMATIVE CONTEXT (APPLICABLE STANDARD ID)
   │
   ▼
NORMATIVE ENGINE (NORM-01..14 / ASME B31.3 Foundation)
   (seule autorité de qualification, calcul d'épaisseur et compatibilité)
```

- Le domaine se contente de référencer des identifiants (`defaultNormativeDesignCodeRefs`).
- Aucune formule (ex: Barlow, Facteur de conception F) n'est inventée ou bypassée dans le domaine.

---

## 6. MODÈLE UNIVERSEL & INTEROPÉRABILITÉ (`Universal Model`)

Le modèle universel canonique `PdiUniversalEntity` (établi en ARCH-03 et consolidé en ARCH-07) demeure l'**unique pivot technique** :

```text
DOMAIN PROJECTION
       │
       ▼
DOMAIN ADAPTER
       │
       ▼
PdiUniversalEntity  (CommonEngineeringEntity)
       │
       ├── 2D / 3D / Isométrique
       ├── MTO & BOM
       ├── Soudures & Spools
       └── Délivrables
```

### Règle d'Or Anti-Duplication (ARCH-08 §22)
Il est strictement interdit de créer des modèles parallèles concurrents tels que :
- `PipelineUniversalEntity` ❌
- `PipingUniversalEntity` ❌
- `PackageUniversalEntity` ❌
- `EquipmentUniversalEntity` ❌

Les attributs spécifiques à chaque domaine (`PipelineDomainAttributes`, `PipingDomainAttributes`, etc.) sont injectés via `attachDomainAttributes` et portés de manière transparente sans altérer le contrat universel.

---

## 7. GÉOMÉTRIE COMMUNE (2D, 3D, Isométrique)

La géométrie est commune et partagée :
- Graphe topologique (`IsoNode`, `IsoSegment`, `IsoPoint3D`).
- Moteur 2D vectoriel (plans, profils d'alignement, dalles et contours).
- Moteur 3D et extrusion volumique (`PdiVolume`, `PdiPoint2D`).
- Aucune duplication des moteurs géométriques par domaine (`Pipeline2DEngine`, etc. proscrits).

---

## 8. QUANTIFICATION COMMUNE (BOM / MTO / Spools / Soudures)

L'estimation physique et les métrés d'ingénierie reposent sur le socle commun `PRODUCT_CORE` :
- `PdiEngineeringMtoItem`
- `PdiEngineeringBomSummary`
- `PdiSpoolEntry` & `PdiWeldEntry`

Chaque domaine renseigne ses lignes de métré selon son découpage (tronçons continus pour le pipeline, spools préfabriqués pour le piping et le skid), mais le format et la structure MTO sont universels.

---

## 9. FRONTIÈRE COMMERCIALE (ARCH-07 STRICT ISOLATION)

La séparation entre ingénierie et chiffrage commercial est scrupuleusement respectée :

```text
ENGINEERING DOMAIN
       │
       ▼
MTO / BOM (Quantités physiques réelles uniquement)
       │
       ▼
COMMERCIAL / CHIFFRAGE (Layer 4 — BoQ / Bordereau de Prix)
       │
       └── Price Book / Unit Rates / Cost Estimation
```

- Aucun descripteur ou objet de domaine technique ne manipule de prix, de devise ou de montant.
- Tout prix manquant produit `UNVERIFIED_COST` (non-fabrication de valeur).

---

## 10. RÈGLES D'EXTENSION

Pour ajouter un nouveau domaine technique (ex: `SUBSEA`, `OFFSHORE`, `MINING`) :
1. Déclarer l'identifiant dans `EngineeringDomainId`.
2. Déclarer les capacités supportées dans `EngineeringCapabilityId`.
3. Créer le descripteur dans `src/pdi/engineering/domains/`.
4. Enregistrer le descripteur dans `EngineeringDomainRegistry`.
5. Utiliser exclusivement `PdiUniversalEntity` comme entité technique sous-jacente.
6. Ne jamais coder de règles normatives ni de prix financiers dans le descripteur.

---

## 11. MATRICE DE CONFORMITÉ DES TESTS

| ID Test | Objet du Test | Statut |
| :--- | :--- | :--- |
| **TEST 01** | Tous les domaines déclarés sont valides et enregistrés | **PASS** |
| **TEST 02** | Aucun domaine ne dépend directement d'un client | **PASS** |
| **TEST 03** | Aucun domaine ne contient de prix commerciaux | **PASS** |
| **TEST 04** | Les domaines utilisent et enrichissent le modèle universel commun | **PASS** |
| **TEST 05** | Les capabilities sont orthogonales et sélectives | **PASS** |
| **TEST 06** | Le domaine ne contient pas de règles normatives codées en dur | **PASS** |
| **TEST 07** | `PdiOrganizationProfile` reste strictement séparé du domaine | **PASS** |
| **TEST 08** | Le Product Core et les projets restent client-neutral | **PASS** |
| **TEST 09** | Non-régression — ARCH-07 Suite complète | **PASS** (23/23) |
| **TEST 10** | Non-régression — NORM-01..14 Global Normative Integration | **PASS** (45/45) |
| **TEST 11** | Contrôle de non-duplication du modèle universel | **PASS** |
| **TEST 12** | Chaîne d'autorité de frontière respectée | **PASS** |
