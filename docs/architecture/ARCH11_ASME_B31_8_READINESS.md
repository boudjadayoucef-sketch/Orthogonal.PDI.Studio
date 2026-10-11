# ARCH-11 — ASME B31.8 GAS PIPELINE ENGINEERING & CALCULATION READINESS

## 0. STATUT & RÉFÉRENCE

- **Identifiant** : ARCH-11
- **Module** : ASME B31.8 Gas Pipeline Engineering & Calculation Readiness
- **Statut** : IMPLEMENTED (en attente d'audit utilisateur)
- **Socle amont** : ARCH-00 à ARCH-10, NORM-01 à NORM-14
- **Couche d'appartenance** : Intégration contrôlée Couche A (`PIPELINE` Engineering Model) ↔ Couche B (`MultiCodeResolver` / `DesignCodeEngine`)

---

## 1. OBJECTIF ET PÉRIMÈTRE

L'objectif d'**ARCH-11** est d'intégrer de manière typée et déterministe l'architecture d'ingénierie des pipelines de transport et de distribution de gaz (`ASME-B31.8`) avec le **Pipeline Engineering Model** (`ARCH-10`) et le **Multi-Code Resolver** (`ARCH-09`), en garantissant la séparation stricte et vérifiable des 6 niveaux suivants :

1. **Engineering domain identification** : validation structurelle du `PipelineSystem` / `PipelineSegment` dans le domaine `"PIPELINE"` et vérification du service fluide déclaré (`GAS_SERVICE_DECLARED` vs `HYDROGEN_OR_BLEND_REQUIRES_DEDICATED_EVALUATION` vs `NON_GAS_FLUID_MISMATCH` vs `UNDECLARED_SERVICE`).
2. **Code and edition identification** : résolution déterministe de `ASME-B31.8` et identification de l'édition `2022` inscrite dans `PDI_STANDARDS_REGISTRY` via `MultiCodeResolver`, exclusivement à partir de références structurées.
3. **Normative evidence and verification status** : inspection du statut réel du document source `DOC-ASME-B31.8-2022` (`UNVERIFIED` dans `UPCOMING_NORMATIVE_SOURCE_DOCUMENTS`) et des preuves `NormativeEvidence` d'édition (`UNVERIFIED` par défaut).
4. **Calculation qualification** : évaluation de la qualification des références de formules `ASME-B31.8` dans `DESIGN_CODE_CALCULATION_REGISTRY` (`NOT_QUALIFIED`, `qualifiedFormulaCount: 0`).
5. **Calculation availability** : évaluation de la disponibilité réelle des calculs `ASME-B31.8` (`NOT_IMPLEMENTED`, `isCalculationAvailable: false`).
6. **Numerical execution and result validation** : garde d'exécution numérique stricte (`executeGuardedB31_8PipelineCalculation`) interdisant toute substitution inter-codes (`ASME-B31.3`, `ASME-B31.8`, `ASME-B31.12`) et **bloquant directement toute délégation à `executeEngineeringCalculation()`** tant que `readiness.status !== "READY_FOR_CALCULATION"` ou `readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation !== true` (y compris sur `BLOCKED_CALCULATION_NOT_IMPLEMENTED` et `BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE`), sans jamais inventer d'équation, de clause ou de coefficient.

---

## 2. HONNÊTETÉ NORMATIVE ET SÉCURITÉ DE CALCUL

Conformément à l'inspection du dépôt :
- `PDI_STANDARDS_REGISTRY["ASME-B31.8"]` identifie le standard `ASME B31.8` (édition `2022`).
- `UPCOMING_NORMATIVE_SOURCE_DOCUMENTS` référence `DOC-ASME-B31.8-2022` avec le statut explicite **`UNVERIFIED`**.
- Aucun texte normatif licencié ou vérifié des clauses, équations et tables de facteurs d'`ASME B31.8` n'est présent dans le dépôt.
- En conséquence, **aucune équation, clause, table de facteur (`F`, `E`, `T`), limite ou formule numérique `ASME-B31.8` n'a été inventée ni activée**. `DESIGN_CODE_CALCULATION_REGISTRY` conserve `ASME-B31.8` au statut `NOT_IMPLEMENTED`.

---

## 3. FICHIERS CRÉÉS ET MODIFIÉS

| Fichier | Action | Rôle |
| :--- | :--- | :--- |
| `src/pdi/normative/types/b31_8ReadinessTypes.ts` | Créé | Contrats TypeScript immuables des 6 étapes d'évaluation de préparation B31.8 (`B31_8PipelineReadinessRequest`, `B31_8PipelineReadinessResult`, rapports d'étapes 1 à 6, `B31_8GuardedCalculationExecutionResult`). |
| `src/pdi/normative/engine/b31_8ReadinessEngine.ts` | Créé / Mis à jour (`ARCH-11-FIX-01`) | Validateur anti-inférence (`validateB31_8PipelineReadinessRequest`), constructeur de contexte (`buildPipelineMultiCodeResolutionContext`), moteur d'évaluation à 6 étapes (`evaluateB31_8PipelineReadiness`) et garde d'exécution numérique stricte (`executeGuardedB31_8PipelineCalculation`). |
| `src/pdi/normative/tests/arch11B31_8PipelineReadinessTests.ts` | Créé / Mis à jour (`ARCH-11-FIX-01`) | Suite de tests déterministe ARCH-11 (10 scénarios complets incluant les tests de non-délégation de la garde stricte). |
| `src/pdi/normative/tests/arch11B31_8PipelineReadinessTests.spec.ts` | Créé | Adaptateur Vitest pour l'exécution via `npm test`. |
| `src/pdi/normative/index.ts` | Modifié | Réexport public des types, fonctions et tests ARCH-11. |
| `docs/architecture/ARCH11_ASME_B31_8_READINESS.md` | Créé / Mis à jour (`ARCH-11-FIX-01`) | Documentation architecturale fidèle au code livré. |
