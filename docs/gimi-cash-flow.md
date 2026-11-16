# Pont de trésorerie GIMI — méthode validée le 16 novembre 2026

Périmètre : GIMI uniquement. La méthode et la publication ont été expressément validées par Berina après remise du rapprochement Odoo / BNB 2024–2025 / synthèse VERDIN. Aucun changement des écritures Odoo ni des configurations PostgreSQL.

## Calcul

Le service `gimi-cash-flow.ts` complète le pont existant avec des mouvements identifiés. Il relit les montants ; aucun montant de bouclage n'est enregistré.

- Résultat configuré, plus comptes 634 et 761 absents des rubriques (sans double comptage si les rubriques évoluent).
- Amortissements : signe positif, inverse des charges du P&L.
- BFR : même définition et même variation que l'onglet BFR, impact de signe opposé. Le compte 409 reste inclus : aucune deuxième réintégration du 634.
- Immobilisations : variation brute 20–27, puis neutralisation des variations d'amortissements cumulés hors dotations. Ce rapprochement n'est pas présenté comme une liste d'investissements payés.
- Comptes 28 et 29 : variation opposée des positions ; les importations, intérêts capitalisés et compensations sont expliqués séparément.
- Financement : variations positives et négatives des comptes 17/42/43. Libellé de variation nette, sans prétendre mesurer les remboursements bruts.
- Fusion Dallemagne : capitaux propres effectivement repris dans l'écriture Odoo 73309. Les autres positions importées figurent dans les rubriques correspondantes. Pas d'apport bancaire fictif.
- Compte 151 : neutralisation de la reprise de subside au résultat.
- Compensations de dividendes identifiées : écritures 73459 et 101323. Pas de mouvement bancaire supplémentaire.
- Dividendes : paiements identifiés par le pont historique ; exclusion de l'avance en compte courant de l'écriture 98058, déjà dans le BFR. Les écritures d'affectation 694/471 ne sont pas des paiements.

Les références d'écritures sont spécifiques à GIMI. Les montants de ces preuves sont relus via le connecteur de lecture seule, bornés à la date de clôture. Aucun traitement similaire n'est appliqué à Lonneux.

## Contrôle et limites

La réconciliation est toujours `clôture − ouverture − flux avant dividendes − dividendes signés`. Elle reste visible ; aucune ligne « autres mouvements » ne l'absorbe. Une preuve supprimée, une nouvelle distribution non identifiée ou une opération non monétaire nouvelle peut créer un résiduel à analyser.

Le périmètre de trésorerie reste celui du bilan, classe 5 incluant la classe 58. Années closes : janvier–décembre ; dernière année : janvier–dernier mois clôturé. Les annexes BNB sont arrondies ; les centimes proviennent d'Odoo. Un rapprochement comptable ne constitue pas une certification des relevés bancaires.

Les détails signés rejoignent chaque rubrique. La documentation d'audit, les fichiers PDF et les extractions privées restent hors Git. Tests : amortissements, hausses de financement, compensations, preuves absentes ou postérieures à la clôture, résiduel nouveau conservé, cohérence des détails.
