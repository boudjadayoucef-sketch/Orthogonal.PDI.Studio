# PD&I — Agents spécialisés, pipeline-design-skill et calculs Python

## Principe

Le dépôt **PD-I** contient l'application SaaS, le workspace, le modèle JSON central, les imports/exports et l'interface.

Le dépôt **pipeline-design-skill** servira aux agents spécialisés : reconnaissance croquis, analyse photo, piping JSON, DXF, validation, QA engineering.

## Règle importante

Les agents IA ne doivent pas faire les calculs techniques finaux.

```txt
IA = reconnaissance, extraction, assistance, orchestration
Python = calculs techniques déterministes et vérifiables
```

## Calculs à faire par Python

- longueurs et cumuls ;
- coordonnées ISO ;
- pentes et niveaux Z ;
- DN/NPS, unités, conversions ;
- nomenclature/BOM ;
- poids estimatifs ;
- validation réseau, ports, soudures ;
- parsing DXF → JSON ;
- génération JSON → DXF ;
- génération PDF/DXF/rapports.

## Workflow cible

```txt
Photo réelle / Croquis / DXF / Manuel
→ agent spécialisé + script Python
→ JSON PD&I
→ validation humaine
→ ISO
→ PDF / DXF / impression
```

## Règle d'intégration

Chaque skill doit produire ou valider des données structurées, jamais seulement du texte libre.
