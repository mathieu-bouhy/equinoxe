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

## Budget 2026 analytique

- Pour le chiffre d’affaires (comptes 70), le budget des départements provient de l’onglet « analyse 60 et 70 » du fichier Budget 2026 : Incendie installation additionne dépannage, fourniture et installation ; Incendie maintenance reprend contrat ; Intrusion et LED sont repris directement. Les autres catégories commerciales du fichier ne sont pas affectées aux quatre départements.
- Pour les comptes 60 et toutes les autres rubriques sources, le budget société est multiplié par la part analytique obtenue avec les clés actuelles sur le réalisé 2026, du 1er janvier au dernier mois clôturé. Les clés Salaire et Voiture conservent donc leur calcul mensuel.
- Si le réalisé société 2026 d’une rubrique est nul, ou si le ratio produit une part hors de 0 à 100 %, le budget analytique affiche « — » au lieu d’inventer une ventilation.
- Marge brute, coûts hors achats, EBITDA et résultats sont recalculés à partir des budgets analytiques des rubriques sources. Le compte de résultat YTD prorate ensuite ces budgets selon le nombre de mois clôturés ; LTM et extrapolé utilisent le budget annuel.

## Détail et sécurité

Les rubriques et sous-rubriques s’ouvrent jusqu’aux comptes. Les comptes sans activité retenue sur tous les mois sont masqués ; une activité mensuelle qui s’annule sur l’année reste consultable. Un clic sur le montant d’un compte ouvre un tableau sous le rapport : débit/crédit originaux, pourcentage retenu, montant analytique, lien vers l’écriture Odoo. Les lectures sont paginées. Un montant extrapolé est distingué du total réellement comptabilisé.

Les endpoints GET `/v1/companies/:id/profit-loss/analytic` et `/analytic/entries` contrôlent la session, l’accès à Gimi, les paramètres et les périodes. Aucun salarié individuel ni coût salarial individuel n’est renvoyé par ces endpoints. Ils ne modifient pas les affectations, les hypothèses, le bilan ou les flux de trésorerie.

## Vérifications

`bun run test`, `bun run typecheck`, `bun run build`.

Tests isolés : conservation des sommes dans les trois modes, formules, affectation exclusive, coûts mensuels, périodes, erreurs, autorisations et révocation, pagination Odoo exclusivement en lecture, sélecteur et conservation du rapport global. Vérifications navigateur complémentaires : sélection multiple, changement d’onglet/mois, drilldowns, liens, absence de débordement sur mobile, colonnes égales et erreur Odoo intégrée.


## Chargement et cache — 9 octobre 2026

Le rapport Société entière est chargé en premier et reste monté, masqué pendant la sélection analytique. Aucun appel analytique n’est lancé tant qu’aucun département n’est choisi. Le retour au global retrouve son contenu et ses lignes ouvertes. Les rapports récents restent frais 60 secondes dans la session navigateur, sans rechargement automatique au retour du focus ; le cache est vidé à la déconnexion. Une modification locale des rubriques, clés ou du mois clôturé invalide les vues concernées.

Le connecteur conserve au maximum 24 résultats pendant 60 secondes et regroupe les lectures identiques simultanées. Le cache est propre à chaque société/connexion ; la clé inclut les périodes, les rubriques et leurs formules, les sous-rubriques et la sélection des écritures validées/brouillons. Les montants mensuels sont réutilisés entre départements, mais les clés analytiques sont relues et appliquées au moment du calcul. Les erreurs ne sont pas conservées ; les résultats sont clonés pour éviter qu’une extrapolation altère la source. Les droits restent vérifiés par l’API avant chaque réponse. Aucun changement des formules financières.

Le premier chargement dépend d’Odoo. Mesure locale le 9 octobre 2026, Gimi YTD au mois configuré : environ 1,8 s à froid, moins de 1 ms pour la même lecture du connecteur en cache, contenu strictement identique. Cette mesure exclut le réseau navigateur, l’authentification Equinoxe et le rendu ; elle ne garantit pas un chargement initial instantané.
