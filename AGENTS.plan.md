# Equinoxe — plan approuvé et archive de discussion

Statut : PROPOSITIONS APPROUVÉES PAR MATHIEU — 8 septembre 2026.

Les six propositions de la section 1 ont été acceptées. Les règles actives sont désormais dans [AGENTS.md](AGENTS.md) et [docs/agent-business-rules.md](docs/agent-business-rules.md). Le reste de ce document conserve le texte discuté et les constats datés ; il ne prime pas sur ces fichiers.

L’approbation autorise l’installation des instructions locales. Elle ne change pas le mode de l’interface Codex et ne déclenche aucune migration, modification des calculs, infrastructure payante ou publication.

Après validation par Mathieu, installer les règles retenues dans `AGENTS.md` à la racine du dépôt `equinoxe`, puis retirer de la version active les questions et constats temporaires. Ne pas remplacer le fichier global `~/.codex/AGENTS.md` par les règles spécifiques à Equinoxe.

Le nom prévu est bien `AGENTS.md` : Codex distingue les instructions globales des instructions de projet. La documentation OpenAI a guidé ce choix de portée et de nom, pas les règles métier ci-dessous. [Documentation officielle](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## 1. Décisions approuvées

| Sujet | Proposition | Alternative / conséquence | Décision |
| --- | --- | --- | --- |
| Plan avant modification | Petit correctif : annonce concise puis exécution. Changement de calcul, migration, droits ou architecture : plan et validation préalable. | Plan à valider pour absolument chaque modification, plus lent. | Proposition approuvée |
| GitHub et Render | Préparer et tester en local ; publier lorsqu’on demande « pousse » ou « publie ». Une publication comprend la vérification du déploiement Render. | Publication automatique après chaque modification locale terminée et testée ; ne jamais publier à chaque sauvegarde intermédiaire. | Proposition approuvée |
| Collaboration | Branches de travail et pull requests vers `main`, contrôles avant fusion ; aucune résolution silencieuse des conflits. | Push direct sur `main` après vérifications, mais isolation moindre entre les travaux. | Proposition approuvée |
| Données locales | Conserver l’accès à la base partagée pour utiliser les vraies données ; tests et expérimentations sur une base isolée. Toujours annoncer qu’une modification locale touche la base partagée. | Tout développement sur une copie séparée ; les données ne seront alors pas instantanément identiques. | Proposition approuvée |
| Sauvegardes | Sauvegarde avant migration sensible, contrôle de restauration et journal des changements de configuration. | Fréquence, rétention, hébergement et éventuel coût à définir ; aucune nouvelle dépense sans accord. | Proposition approuvée |
| Cash-flow disponible pour la dette | Documenter deux niveaux distincts : flux après intérêts historiques, puis financement d’acquisition, sans double déduction. Faire valider le périmètre exact et les libellés avant de modifier les formules. | Un flux avant tout service de dette demande notamment de retraiter les intérêts déjà présents dans le résultat. | Méthode approuvée ; rapprochement à valider avant correction |

Les demandes successives sur la publication et sur le cash-flow ont évolué. Ne pas choisir silencieusement une ancienne formulation comme règle permanente. Les changements explicites les plus récents priment sur les anciennes préférences, dans les limites des règles de sécurité applicables.

## 2. Mission et manière de travailler

- Développer et maintenir Equinoxe, plateforme interne de reporting financier, analyse de dossiers et configuration multi-sociétés.
- Collaborer avec Mathieu Bouhy et Berina Pepic. Préserver le travail des autres contributeurs.
- Communiquer en français, simplement, avec des mises à jour courtes. Expliquer un résultat et ses limites plutôt que présenter des promesses générales.
- Distinguer une demande d’explication, de diagnostic, de modification et de publication. Une analyse seule n’autorise pas une modification de production.
- Quand Mathieu demande de planifier, rester sur l’analyse, les options et le brouillon jusqu’à validation de l’implémentation. Ne pas prétendre avoir basculé le mode de l’application si cela n’a pas été fait.
- Ne pas élargir spontanément le produit : pas de nouvel agent conversationnel, planificateur, infrastructure ou application native sans demande.
- Une fonctionnalité déjà développée n’est pas nécessairement déployée, ni exempte d’erreurs. Vérifier le code, les données et l’environnement concernés.

## 3. Architecture et repères

- Dépôt : `mathieu-bouhy/equinoxe` sur GitHub. Vérifier le remote et la branche avant toute opération Git.
- Monorepo Bun : `apps/web` pour React/TypeScript/Vite, `apps/api` pour Bun/TypeScript/Zod, `packages/shared` pour les contrats.
- Frontend : React Router, TanStack React Query, composants UI internes, Lucide et CSS structuré. Recharts est disponible mais les comparaisons de concurrents utilisent désormais des tableaux.
- Backend : routes `/v1`, services métier, repositories et connecteurs. Toute nouvelle logique de calcul va dans un service testable, pas dans un composant ou une longue route.
- Ne pas reproduire les fichiers monolithiques existants. Refactoriser seulement la partie nécessaire à la demande, sans réécriture massive non demandée.
- Local : frontend port 5173, API port 3001. Le processus peut être géré par le service macOS `com.equinoxe.local` : vérifier son existence avant de l’utiliser.
- Production connue : `https://equinoxe.onrender.com`. Vérifier l’URL et le service actifs avant d’annoncer une publication.
- Configuration sensible : `apps/api/.env.local` en local, variables du service en production. Ne pas lire ou afficher leurs valeurs inutilement.
- Commandes à la racine : `bun install`, `bun run dev`, `bun run dev:web`, `bun run dev:api`, `bun run typecheck`, `bun run test`, `bun run build`.

## 4. Git, travail commun et publication

Avant de modifier le code :

1. Identifier le dépôt et les éventuelles instructions plus spécifiques.
2. Examiner `git status`, la branche, les modifications locales et le dernier commit.
3. Récupérer les références distantes avec `git fetch`, puis comparer le travail local et distant.
4. Si une mise à jour est nécessaire et compatible, intégrer la version distante sans écraser les modifications locales. Ne pas faire de pull aveugle sur un arbre sale.
5. En cas de divergence ou de conflit fonctionnel avec Berina, présenter les fichiers concernés et des solutions de rapprochement. Ne pas pousser avant résolution.

Pour publier, selon la politique validée en section 1 :

- Vérifier uniquement les changements concernés, les tests et l’absence de secrets. Ne pas embarquer tous les fichiers non suivis sans inspection.
- Contrôler à nouveau l’état distant juste avant le push. Ne jamais forcer le push ni réécrire l’historique partagé pour faire disparaître le travail de quelqu’un.
- Identifier le commit publié et vérifier que Render déploie ce commit, pas seulement qu’un push a réussi.
- Contrôler `/health`, la connexion, les routes profondes et la fonctionnalité modifiée sur la version en ligne.
- Si le déploiement échoue ou reste en attente, le dire clairement. Ne pas annoncer « Render à jour » avant preuve.
- Préférer un revert documenté pour annuler un changement partagé. Un retour du code ne restaure pas les données PostgreSQL ; traiter les migrations séparément.
- Une configuration de déploiement présente dans Git ne prouve pas qu’elle est activée sur le service Render.

## 5. Persistance : ne jamais remettre les valeurs utilisateur à zéro

### Source de vérité

- Pour les environnements partagés, utilisateurs, autorisations, hypothèses de business plan, rubriques, clés analytiques, affectations et données de facturation doivent être persistés dans PostgreSQL.
- Le repository actuel utilise notamment des documents JSONB dans `equinoxe_documents`. Ne pas confondre ces documents en base avec les anciens fichiers JSON du disque.
- Vérifier que les environnements visent la même base logique sans exposer les URLs contenant des identifiants. Les URLs interne Render et externe locale peuvent être différentes.
- Une API locale branchée sur la base partagée agit sur les données réelles, même si le navigateur indique « Local ».
- Éviter tout repli silencieux sur JSON si PostgreSQL est attendu mais indisponible : signaler l’indisponibilité plutôt que montrer un autre jeu d’utilisateurs.

### Écritures et migrations

- Un démarrage, login, rafraîchissement ou déploiement ne doit pas remettre des utilisateurs ou hypothèses aux valeurs par défaut.
- Les valeurs par défaut servent uniquement aux champs réellement absents. Préserver une valeur saisie égale à zéro, négative ou volontairement vide lorsque le contrat l’autorise.
- Utiliser des modifications ciblées et transactionnelles. Éviter les lectures suivies d’un remplacement complet de collection qui peuvent écraser un changement concurrent.
- L’initialisation d’un document absent doit elle aussi préserver une création concurrente ; un verrou sur les seules mises à jour ultérieures ne suffit pas.
- Importer les anciens JSON par opération explicite, sauvegardée, validée et rejouable sans doublons. Ne pas utiliser une migration comme initialisation répétée à chaque démarrage.
- Conserver les identifiants et les liens entre sociétés, comptes, employés, clés et rubriques.
- Les fichiers sources et sauvegardes contenant des données privées restent hors Git, sauf accord spécifique portant sur ces données et leur destination.
- Un bouton Enregistrer doit envoyer les données, gérer les erreurs et confirmer la réussite seulement après persistance. Vérifier la relecture après rechargement et depuis une autre session.
- Ne jamais promettre qu’un utilisateur ne pourra « plus jamais » disparaître : fournir les contrôles réalisés, les protections et les limites réelles.

## 6. Odoo de production : lecture seule obligatoire

- Gimi et Lonneux sont connectés à des instances Odoo de production. Aucun changement métier n’y est autorisé depuis Equinoxe.
- Passer par le connecteur existant et sa liste fermée de méthodes de lecture. Refuser toute méthode d’écriture ou action métier avant l’envoi réseau.
- Ne pas contourner cette protection par un script ad hoc, un autre client HTTP, le navigateur, un accès SQL ou une méthode RPC arbitraire.
- Ne pas ajouter de mécanisme permettant au frontend de choisir librement un modèle ou une méthode RPC.
- Ne pas créer, modifier, valider, annuler ou supprimer une facture, écriture, compte ou partenaire, même pour tester.
- Une clé disposant de droits d’écriture dans Odoo reste une clé d’écriture : la protection applicative ne transforme pas ses droits. Ne pas garantir une impossibilité absolue si quelqu’un change ou contourne le code ; préserver la défense applicative et recommander une restriction côté source lorsque possible.
- Secrets exclusivement côté backend, expurgés des logs, erreurs et réponses. Aucun secret dans Git, `localStorage`, les documents d’instructions ou le bundle web.
- Respecter timeouts, pagination et relance bornée sur erreur réseau temporaire. Ne pas confondre erreur réseau, refus d’accès et résultat vide.
- Les ajustements de configuration demandés concernent Equinoxe/PostgreSQL, pas la comptabilité Odoo.

## 7. Utilisateurs et droits

- Deux rôles : administrateur et lecteur. Un administrateur gère les utilisateurs et configurations ; un lecteur ne voit que les sociétés et dossiers analysés autorisés.
- Contrôler les rôles et accès dans le backend pour chaque route, y compris les détails, exports et appels directs par URL.
- Isoler les configurations par société/dossier ; modifier Gimi ne doit jamais modifier Lonneux ou Medipost.
- Création, modification, retrait d’accès et gestion du mot de passe doivent être persistants et vérifiables après reconnexion.
- Ne jamais réinitialiser un mot de passe à partir des variables du premier administrateur lors d’un démarrage ordinaire.
- Préserver une possibilité d’administration ; faire valider une suppression ou désactivation sensible, notamment celle du dernier administrateur actif.
- Hash robuste, cookie HTTP-only, gestion d’expiration et des comptes inactifs, erreurs lisibles, aucun mot de passe visible dans les listes ou logs.
- Une connexion dans un autre environnement doit consulter les mêmes utilisateurs lorsque cet environnement est annoncé comme connecté à la base partagée.

## 8. Reporting et sources historiques

- Noms de référence : Gimi, Lonneux, Medipost. Les variantes issues de la dictée ne justifient pas de créer une nouvelle société.
- Séparer « Sociétés existantes » et « Dossiers analysés ». Conserver une navigation et des configurations propres à chacun.
- Les dashboards proviennent du registre par société. Ne pas réintroduire les anciens placeholders Synthèse/Finance/Opérations à la place des rapports développés.
- Gimi : données comptables Odoo, écritures validées. Lonneux : historique 2024–2025 issu de l’import Excel et 2026 issu d’Odoo, avec inclusion des factures non validées demandée pour Lonneux seulement.
- Import Lonneux : prendre les lignes portant un vrai numéro de compte ; ne pas additionner à nouveau titres et sous-totaux du fichier.
- Medipost : comptes historiques issus des documents fournis ; 2025 est provisoire. Les détails 2024–2025 proviennent du PDF ; ne pas inventer des sous-comptes pour 2023 lorsque seul l’agrégat est disponible.
- Conserver la provenance, la période et les limites de précision. Ne pas remplacer une donnée indisponible par zéro sans justification.
- Toute rubrique utilise la configuration et ses préfixes/relations, pas une approximation basée uniquement sur le libellé. Un code `false`, vide ou invalide n’est pas un compte de ventes.
- Le mois clôturé enregistré borne les rapports concernés. Ne pas utiliser automatiquement le mois courant de l’ordinateur à sa place.
- LTM Gimi : périodes consécutives de douze mois inclusifs, de la plus ancienne à gauche à la plus récente à droite ; pas de fenêtre de treize mois.
- Extrapolation : année courante configurée = cumul janvier à mois clôturé × 12 / numéro du mois ; années closes inchangées. Ne jamais annualiser deux fois.
- L’expansion mensuelle ajoute des colonnes horizontalement, pas des lignes. Préserver les mêmes détails et règles de configuration entre normal, LTM et extrapolé.

## 9. Calculs financiers : traçabilité avant tout

- Définir pour chaque montant : source, périmètre de comptes, période, signe, formule et unité. Faire les calculs avant l’arrondi d’affichage.
- Utiliser une convention cohérente : produits positifs et charges négatives lorsque c’est celle du compte de résultat. Dans ce cas, soustraire une charge signifie additionner son montant déjà négatif, pas inverser deux fois son signe.
- Marge brute demandée pour le compte de résultat Medipost : chiffre d’affaires + autres produits d’exploitation − marchandises/approvisionnements ; services et biens divers en dessous. Ne pas appliquer automatiquement cette définition à un autre rapport dont le périmètre est différent.
- Gimi, Analyse de marge analytique : chiffre d’affaires et marchandises des rubriques configurées, sans ajouter spontanément les autres produits, salaires ou frais généraux.
- Résultat après impôts → rajouts des charges non décaissées pertinentes → variation du BFR → investissements décaissés → financement, selon le périmètre validé du pont de trésorerie.
- Un amortissement comptable n’est pas un décaissement. Les reprises, cessions, transferts, apports et autres opérations non monétaires doivent être analysés, pas assimilés à des CapEx payés.
- Un compte d’amortissement cumulé comme 241900 ne doit pas devenir à lui seul un investissement décaissé. Ne pas déduire les intérêts une deuxième fois s’ils figurent déjà dans le résultat de départ.
- La variation du BFR dans le cash-flow Gimi doit reprendre exactement le calcul de l’onglet BFR ; son impact trésorerie a le signe opposé à la hausse du BFR.
- Conserver les rubriques BFR demandées, notamment stocks et en-cours séparés. Expliquer les inclusions/exclusions et le périmètre fiscal/social ; ne pas changer une définition belge sans analyse sourcée et validation.
- Pour les pourcentages BFR de l’année partielle, utiliser un chiffre d’affaires annualisé conformément au mois sélectionné.
- Réconciliation : trésorerie d’ouverture + flux nets identifiés = trésorerie de clôture du bilan. Ne pas reprendre sous une autre ligne les mêmes comptes déjà inclus dans le cash-flow libre après dette.
- Une baisse de capitaux propres ou une affectation du résultat ne prouve pas un dividende payé. Identifier les véritables flux et contreparties avant de présenter une distribution.
- Ne pas forcer un écart à zéro ni le baptiser « autres mouvements » pour faire paraître la réconciliation terminée. Si des preuves manquent, isoler l’écart, expliquer ce qui reste à vérifier et ne pas déclarer le calcul validé.
- Les totaux du détail doivent se rapprocher des agrégats à la précision de la source. Des PDF arrondis ne permettent pas de promettre une preuve à l’euro près.

## 10. Medipost : business plan et analyses

- Présenter l’historique 2023–2025 et les prévisions 2026–2028 dans le compte de résultat principal, avec les analyses de trésorerie et les années clairement alignées.
- Les hypothèses de projection ne changent jamais les comptes historiques 2023–2025.
- Hypothèses éditables et persistantes : croissance, taux des grandes rubriques, loyers, ajustements de rémunération, CapEx annuels, financement et paramètres de trésorerie.
- CapEx : montants annuels en milliers d’euros dans les hypothèses opérationnelles, et non une hypothèse globale du schéma d’acquisition.
- Augmentation de loyer : charge négative. Retrait du coût de l’ancien dirigeant : impact positif. Nouveau dirigeant : charge négative. Respecter les ajustements signés saisis sans inverser leur effet une seconde fois.
- Séparer charges financières historiques et intérêts du nouveau crédit. Les charges historiques doivent être configurables en pourcentage du CA ; aucun intérêt du nouveau crédit avant le début de l’acquisition.
- Dernière demande de remboursement : échéance annuelle constante, capital + intérêts, et non capital constant. Expliquer cette distinction si une nouvelle demande mélange les deux.
- Le financement d’acquisition reçu par la holding ne constitue pas une entrée de trésorerie de Medipost. Modéliser séparément l’extraction de trésorerie et le service de la dette selon les hypothèses validées.
- Les montants de départ déjà discutés sont des valeurs initiales, pas des constantes à réinjecter à chaque déploiement. Les dernières valeurs enregistrées priment.
- Analyse des marchés : quatre segments distincts — nutrition/stomie/incontinence ; bandagerie/mobilité/domicile ; matériel médical général B2B ; pharmacie/parapharmacie omnicanal.
- Adapter concurrence, pression concurrentielle, géographie et perspectives à chaque segment. Préserver une conclusion transversale et les questions de diligence.
- Pour Medipost, fonder les ratios sur les comptes récents disponibles dans l’application, notamment 2025 provisoire, plutôt que revenir automatiquement à l’info memo. Ne pas diviser un EBITDA 2025 par un effectif d’une autre année sans l’indiquer.
- Concurrents : tableaux annuels comparables, unités explicites, CA, achats, marge, personnel, services, EBITDA, pourcentages et ETP quand les sources les fournissent. Ne pas inventer une valeur absente.
- Analyses INAMI, réglementation et croissance des marchés : sources primaires datées, distinction Belgique/Flandre/Wallonie et distinction faits, prévisions et hypothèses.
- Recherche multi-agents seulement lorsqu’elle est demandée ou prévue par les instructions applicables : spécialistes pertinents et vérificateur indépendant, avec désaccords documentés. Aucun appel multi-agents pour cette simple rédaction de règles.

## 11. Gimi : comptabilité analytique

- Employer « clé de répartition » plutôt que « code analytique » dans l’interface de configuration concernée.
- Ordre des départements dans l’analyse : Incendie installation, Incendie maintenance, Intrusion, LED, puis Autres pour les comptes sans affectation valide.
- Une clé peut répartir un compte entre plusieurs départements. Vérifier le total de 100 % et conserver la somme de tous les départements égale au montant du compte.
- Les affectations et nouvelles clés sont de la configuration persistée ; ne pas rejouer une première affectation automatique au démarrage.
- Conserver les choix manuels existants. Une suggestion par intitulé ne remplace pas silencieusement une affectation validée.
- « Répartition des comptes » regroupe les comptes dans les rubriques et l’ordre du compte de résultat ; privilégier le préfixe le plus spécifique pour éviter les doubles affectations, notamment 603 par rapport à 60.
- Employés : coût annuel salaire provenant de AR ; coût annuel voiture = AQ − AR. Conserver la source importée et les colonnes nécessaires à l’audit.
- Règles initiales demandées : techniciens et manager SAV en maintenance ; électriciens et technico-commerciaux en installation. Les autres fonctions ambiguës nécessitent une affectation explicite.
- Coût salaire actuel et coûts véhicules : totaux par département, pourcentages du total, détail des personnes et non-réparti.
- Coût salaire par mois 2025–2026 : exclure une personne avant son mois d’entrée. Convention actuelle : mois d’entrée entier, sans prorata journalier ; faire valider avant de changer cette convention. Signaler les dates d’entrée manquantes.
- La clé au nombre d’employés suit la même méthode partout ; dans le calcul mensuel, recalculer avec les personnes présentes ce mois-là. Ne pas introduire des méthodes incompatibles entre backend et frontend.
- Analyse de marge : trois blocs dans un tableau, CA, marchandises, marge, chacun avec cinq départements et un total. Comptes consultables en détail, historiques réalisés et dernière année extrapolée.
- Les clés actuelles s’appliquent actuellement aux trois années. Ne pas prétendre disposer d’un historique des clés ; une répartition versionnée par période serait une évolution à décider.
- « Calcul des pourcentages » est pour l’instant un emplacement à préciser. Ne pas inventer ses futurs calculs à partir de son titre.

## 12. Facturation et import des rendez-vous

- Préserver le libellé Facturation et la présentation mensuelle demandée.
- Les imports de calendrier doivent être explicites, via une action utilisateur, pas une synchronisation permanente ajoutée sans demande.
- Dédupliquer les événements par identité stable de source ; préserver les heures corrigées, les saisies manuelles et leurs rattachements.
- Ne pas réimporter les JSON locaux en écrasant les données partagées. Produire un bilan des ajouts, mises à jour et corrections conservées.
- Prévoir un export exploitable dans Excel/Google Sheets sans transmettre le fichier à un service externe non autorisé.

## 13. Présentation et expérience utilisateur

- Interface française, professionnelle, chaleureuse, cohérente avec Equinoxe : fond crème `#f7f1e8`, blanc, brun `#3b1f12`, accent doré `#f4b533`, bordures `#eadbc6`.
- Police principale Manrope avec fallback ; composants partagés, focus visible, erreurs intégrées, chargement et sauvegarde explicites. Aucun `alert()` natif.
- Préserver les pages existantes plutôt que changer leur esthétique à chaque ajout.
- Rapports financiers : milliers d’euros sans symbole euro dans chaque cellule, sans décimales ; préciser l’unité. Les écritures comptables peuvent conserver leur précision en euros et centimes pour l’audit.
- Pourcentages visibles sans bouton d’activation, plus discrets que les montants. Indiquer le dénominateur : CA total ou CA du département, notamment pour le taux de marge.
- Colonnes annuelles de largeur égale, chiffres et années alignés à droite, en-têtes lisibles. Alignement cohérent entre tableaux comparables.
- Les tableaux restent à la largeur du contenu de page ; ne pas réintroduire la réduction générale de largeur rejetée. Sur petit écran, contenir le défilement horizontal au tableau.
- Différencier rubriques sources, formules, totaux et détails. En configuration, privilégier des lignes propres, une poignée de déplacement claire et un ordre modifiable.
- Un drilldown doit montrer des comptes réels, avec numéros complets, intitulés et contributions signées, pas uniquement une explication textuelle.
- Masquer les comptes dont toutes les périodes affichées sont réellement nulles ; ne pas masquer une donnée absente comme si elle valait zéro.
- Quand un lien vers une écriture Odoo est proposé, libellé « Odoo », aligné à droite, sans secret et pointant sur la bonne écriture.
- Éviter les accroches décoratives qui ont été rejetées ; privilégier l’information utile.

## 14. Vérifications avant livraison

- Code : `bun run typecheck`, tests ciblés puis `bun run test`, et `bun run build` selon le changement. Ne pas présenter le nombre de tests comme une garantie de couverture complète.
- UI : tester le parcours réellement demandé dans le navigateur, chargement, erreurs, détails, sauvegarde/rechargement et largeur des colonnes. Contrôler aussi le responsive lorsque la mise en page change.
- Autorisations : administrateur, lecteur autorisé, lecteur interdit, accès retiré pendant une session et accès par URL directe.
- Persistance : une nouvelle lecture doit retrouver la valeur sauvegardée ; tests concurrents sur un environnement isolé, sans créer/supprimer des utilisateurs réels comme fixtures.
- Finance : rapprochement des détails et totaux, signe des charges, années historiques inchangées, annualisation unique, cas sans CA, comptes non affectés et sources manquantes.
- Odoo : liste de lecture seule et refus de toute méthode d’écriture ; les tests métier destructifs sont interdits sur la production.
- Local : vérifier frontend et API ; s’ils sont gérés par un superviseur, relancer le service identifié plutôt qu’empiler des processus. Ne pas promettre qu’un portable éteint restera accessible.
- Livraison : dire ce qui est prêt localement, ce qui est enregistré dans la base partagée, ce qui est publié et ce qui reste à vérifier. Donner le lien utile.

## 15. Constats à ne pas confondre avec des garanties

Ces constats proviennent de l’inspection locale lors de la rédaction, pas d’un audit complet de production :

- Le README contient encore des descriptions du premier jalon et doit être remis à jour séparément.
- Le repository PostgreSQL dispose de mutations verrouillées, mais aussi de remplacements complets de documents et d’une initialisation de document absent à examiner pour les accès concurrents.
- Plusieurs initialisations du store utilisent encore des séquences lecture/écriture. La règle « ne pas écraser » décrit le résultat exigé, pas une certification que tout le code le garantit déjà.
- Les dernières modifications analytiques et l’analyse de marge sont présentes dans l’arbre local ; ne pas supposer qu’elles sont déjà sur GitHub ou Render.
- Le fichier de workflow GitHub existe localement mais apparaît non suivi à cette inspection ; cela ne prouve pas l’existence de contrôles distants actifs.
- La présence d’un `autoDeploy` dans `render.yaml` ne confirme pas à elle seule l’état du service Render.
- Le pont de trésorerie et les définitions de flux ont fait l’objet de demandes de correction répétées. Un agent doit les revalider sur preuves avant de les qualifier d’exacts.

## 16. Plan initial de validation (archive)

1. Choisir la politique de planification, de publication et de travail sur les données partagées.
2. Relire les règles métier, en priorité cash-flow, CapEx, intérêts, BFR et convention historique des clés analytiques.
3. Conserver les règles durables dans un `AGENTS.md` concis ; déplacer si nécessaire les détails de référence et constats temporaires dans une documentation liée.
4. Faire valider le texte final par Mathieu, puis créer le fichier de projet actif sans modifier ses autres projets.
5. À la demande de publication, versionner le fichier validé dans GitHub pour que Berina le récupère avec le code. Cela ne modifie pas automatiquement son installation Codex ni son dossier local non synchronisé.

Les instructions locales ont été installées après approbation. Les audits correctifs, migrations et publications restent des opérations distinctes, à demander et vérifier séparément.
