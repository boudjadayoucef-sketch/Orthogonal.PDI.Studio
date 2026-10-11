# PD&I — Orchestrateur et pipeline-design-skill

## Décision d'architecture

PD&I est l'application SaaS principale et l'orchestrateur du workflow piping.

Le dépôt `pipeline-design-skill` sera utilisé comme base d'agents spécialisés et de procédures techniques.
AS-DE-PIQUE pourra le consulter pour aider à auditer, orienter et préparer les intégrations.

## Rôle des agents

Les agents spécialisés facilitent le travail :

- Agent Vision PD&I : photo réelle → observations structurées ;
- Agent Croquis : croquis main → lignes/symboles/cotes ;
- Agent CAO : DXF/PDF → entités exploitables ;
- Agent JSON : consolidation du modèle PD&I ;
- Agent ISO : génération/validation isométrique ;
- Agent QA Engineering : contrôle règles métier.

## Règle calculs

Les calculs techniques ne sont pas faits par IA générative.

```txt
IA = reconnaissance, extraction, assistance, orchestration
Python = calculs déterministes, vérifiables, versionnés
```

Calculs Python : longueurs, cotes, pentes, coordonnées ISO, DN/NPS, BOM, poids, validation ports/soudures, DXF/PDF.

## Flux cible

```txt
Photo / Croquis / DXF / Manuel
→ agent spécialisé
→ script Python
→ JSON PD&I
→ validation humaine
→ ISO / PDF / DXF
```

## Stockage

Les photos/croquis/scans sont temporaires dans le navigateur.
Seul le JSON PD&I est conservé durablement par défaut.
