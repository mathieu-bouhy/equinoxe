# Eurodrill — rapports financiers

Eurodrill réutilise les méthodes du compte de résultat global, du LTM, de l’extrapolé, du bilan, de la trésorerie et du BFR de Gimi. Les écritures Odoo retenues sont exclusivement validées. Chaque société conserve ses propres identifiants de rubriques et références de formules. Les sous-rubriques sectorielles et affectations analytiques Gimi ne sont pas copiées.

## Connexion en lecture seule

Les variables `EURODRILL_ODOO_BASE_URL`, `EURODRILL_ODOO_DATABASE`, `EURODRILL_ODOO_USERNAME` et `EURODRILL_ODOO_API_KEY` restent côté API, dans le fichier local ignoré par Git et les variables Render. Aucun secret n’est stocké dans les documents métier PostgreSQL.

La sélection du connecteur est explicite pour Gimi, Lonneux et Eurodrill. Une société inconnue reste non configurée ; elle ne récupère jamais les accès Gimi. Les appels métier passent par la liste fermée de méthodes de lecture du connecteur Odoo. Aucun audit ni test ne modifie les écritures de production.

## Configuration explicite

Les scripts se lancent depuis `apps/api` en chargeant `.env.local` :

- `scripts/stage-eurodrill.ts <YYYY-MM>` prépare la société inactive, les trois comptes de résultat et leurs rubriques, sans remplacer une société déjà présente.
- `scripts/setup-eurodrill-finance.ts` ajoute le bilan et la trésorerie à partir d’un instantané contrôlé.
- `scripts/setup-eurodrill-bfr.ts` ajoute le BFR et copie les rubriques actuelles de Gimi avec des identifiants indépendants.

Ces opérations verrouillent les documents concernés dans une transaction, archivent leur état précédent dans `equinoxe_documents` et préservent les autres sociétés. Elles sont idempotentes et ne sont jamais déclenchées au démarrage. Les archives sont conservées jusqu’à une décision explicite de nettoyage. Une restauration doit préserver les changements ultérieurs des autres sociétés.

`verify-eurodrill-postgres.ts` et `verify-eurodrill-finance.ts` vérifient la création, le rejeu, la préservation des autres sociétés et la restauration dans des tables temporaires de session. Les tests BFR couvrent la copie et le remappage des rubriques.

## Trésorerie et couverture historique

Le document `cash-history:<companyId>` est enregistré dans PostgreSQL Equinoxe. Chaque fin de mois est rapprochée d’un total Odoo indépendant. Un rapprochement avec Odoo ne prouve pas l’exhaustivité des mouvements bancaires historiques.

Les minimums et maximums portent sur les soldes de fin de journée ; la moyenne inclut tous les jours calendaires. Chaque mois expose les comptes inclus, même nuls, avec ouverture, mouvement net, moyenne et clôture. Les comptes actifs apparaissent en premier. La somme des détails retrouve les agrégats avant arrondi. `CashMonth.accounts` enrichit le contrat dérivé sans migration du snapshot ni changement de périmètre.

Les lectures couvrent aussi 2024. Une somme annuelle nulle ne signifie pas nécessairement une base vide : les annulations et reprises peuvent neutraliser les mouvements. Les indicateurs de couverture signalent les données historiques incomplètes ; aucune annulation, reprise ou dette n’est exclue automatiquement pour modifier le résultat.

`OdooConnector.getCashAudit` lit des modèles et champs fixes via la passerelle de lecture seule. Il n’expose aucune route RPC générique. Les résultats chiffrés des audits, les identifiants de pièces, les exports et les analyses privées restent hors Git.

## Accès local et publication

`scripts/preview-eurodrill.ts` démarre un aperçu sur `127.0.0.1:3002`. Il copie la configuration, les rubriques BFR et les historiques dans un répertoire temporaire, utilise un compte de démonstration local et ferme la connexion PostgreSQL avant de servir les pages. Les rapports lisent les données Odoo réelles. Ce serveur de revue ne doit pas être publié ni exposé sur le réseau.

`LOCAL_EURODRILL_ENABLED=true` permet aux utilisateurs déjà autorisés de consulter Eurodrill localement lorsque son statut partagé est encore inactif. Ce paramètre ne change pas PostgreSQL, ne s’applique à aucune autre société et est ignoré en production. Aucun droit lecteur n’est attribué automatiquement. Le cookie de l’aperçu est distinct du cookie de l’application habituelle.

Avant activation partagée, publier le connecteur explicite et configurer les quatre variables Eurodrill sur Render. L’ancienne version traitait les sociétés inconnues comme Gimi : elle ne doit plus servir de trafic au moment de l’activation. Vérifier le déploiement, puis modifier uniquement le statut d’Eurodrill, avec archive, verrou et relecture, sans réinitialiser ses rubriques ni le mois choisi. Contrôler ensuite les routes authentifiées et la connexion Odoo.

## Interface et validation

Les pourcentages sont secondaires visuellement et une légende précise leur base. Les bases différentes conservent leur propre légende. Le clic sur un mois de trésorerie affiche le détail des comptes et les soldes journaliers.

L’éditeur BFR réinitialise son brouillon au changement de société, confirme la sauvegarde et préserve les autres sociétés par mutation ciblée.

Les tests couvrent la sélection du connecteur, le refus des méthodes d’écriture avant tout envoi, les droits administrateur et lecteur, le remappage des formules, les périodes LTM, l’extrapolation de la seule année courante et le rapprochement des détails mensuels. Les vérifications de navigation portent sur le serveur habituel, en complément de l’aperçu isolé.
