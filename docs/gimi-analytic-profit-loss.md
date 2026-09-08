# Compte de résultat Gimi par départements

## Utilisation

Les rapports Compte de résultat, LTM et extrapolé proposent quatre cases : Incendie installation, Incendie maintenance, Intrusion, LED. Plusieurs cases additionnent les départements. La sélection reste identique lors du passage entre ces trois onglets ; elle n’est pas une configuration enregistrée. « Société entière » affiche le rapport global original, non filtré. Aucune case cochée en mode analytique n’est pas assimilée à la société entière.

## Règles de calcul

- Les écritures validées sont regroupées par compte et par mois, en lecture seule dans Odoo. Le signe est crédit moins débit, comme dans le compte de résultat.
- Les affectations et les clés actuellement enregistrées sont appliquées aux années consultées. Il ne s’agit pas d’une reconstitution des anciennes configurations.
- Les clés fixes, y compris la clé Chiffre d’affaires enregistrée, conservent leurs pourcentages configurés. Les clés Salaire et Voiture utilisent les bases mensuelles des tableaux de coûts correspondants, en tenant compte des dates d’entrée et de fin.
- Chaque montant mensuel est ventilé avant addition. Le LTM additionne exactement douze mois. L’extrapolé multiplie uniquement le total de la dernière année par 12 / numéro du mois clôturé ; les mois et les écritures affichés restent réalisés.
- Toutes les formules de rubriques (marge, EBITDA, résultats) sont recalculées sur les montants retenus, sans changer les formules enregistrées. Les pourcentages utilisent le chiffre d’affaires de la sélection et de la période. Une base nulle affiche « — ».
- Les comptes sans clé valide ou sans base de coût exploitable restent non répartis : ils sont listés dans un avertissement et exclus des départements. La somme des quatre départements **plus ces montants** retrouve les comptes sources. Cela concerne aussi les impôts non affectés : le résultat analytique n’est pas un résultat fiscal autonome.
- Les coûts ou dates manquants sont signalés. Les bases salariales connues ne constituent pas un historique réel de paie.
- Un contrôle compare la somme des mois de chaque compte au total Odoo de chaque période (tolérance d’un centime). Une incohérence produit une erreur explicite, pas un total fabriqué.

## Détail et sécurité

Les rubriques et sous-rubriques s’ouvrent jusqu’aux comptes. Les comptes sans activité retenue sur tous les mois sont masqués ; une activité mensuelle qui s’annule sur l’année reste consultable. Un clic sur le montant d’un compte ouvre un tableau sous le rapport : débit/crédit originaux, pourcentage retenu, montant analytique, lien vers l’écriture Odoo. Les lectures sont paginées. Un montant extrapolé est distingué du total réellement comptabilisé.

Les endpoints GET `/v1/companies/:id/profit-loss/analytic` et `/analytic/entries` contrôlent la session, l’accès à Gimi, les paramètres et les périodes. Aucun salarié individuel ni coût salarial individuel n’est renvoyé par ces endpoints. Ils ne modifient pas les affectations, les hypothèses, le bilan ou les flux de trésorerie.

## Vérifications

`bun run test`, `bun run typecheck`, `bun run build`.

Tests isolés : conservation des sommes dans les trois modes, formules, affectation exclusive, coûts mensuels, périodes, erreurs, autorisations et révocation, pagination Odoo exclusivement en lecture, sélecteur et conservation du rapport global. Vérifications navigateur complémentaires : sélection multiple, changement d’onglet/mois, drilldowns, liens, absence de débordement sur mobile, colonnes égales et erreur Odoo intégrée.
