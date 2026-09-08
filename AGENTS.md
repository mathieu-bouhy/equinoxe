# AGENTS.md — Equinoxe

Instructions de projet validées par Mathieu Bouhy le 8 septembre 2026. Portée : dépôt `equinoxe` et ses sous-dossiers, pas les autres projets de la machine.

## Lecture des règles métier

Avant toute tâche touchant le reporting, les calculs, les imports, la facturation ou l’interface, lire les sections concernées de [docs/agent-business-rules.md](docs/agent-business-rules.md). Elles font partie des instructions validées de ce projet.

[AGENTS.plan.md](AGENTS.plan.md) conserve l’historique de discussion et les constats datés ; ce n’est pas une autre source de règles actives. En cas de contradiction avec cette archive, appliquer ce fichier et la référence métier. Ne pas interpréter un constat d’audit comme une correction déjà réalisée.

## 1. Décisions validées

Mathieu a accepté toutes les propositions du plan le 8 septembre 2026. Ces règles remplacent les anciennes préférences contradictoires, sauf nouvelle demande explicite compatible avec les instructions de priorité supérieure.

- **Planification** : petit correctif, annoncer puis exécuter ; changement de calcul, migration, droits ou architecture, présenter un plan et obtenir sa validation préalable. Ne pas redemander une validation déjà donnée pour le même plan ; demander de nouveau si le périmètre change matériellement.
- **Publication** : travailler et tester en local. Publier uniquement sur demande « pousse », « publie » ou demande équivalente explicite. Une publication comprend GitHub puis la vérification du déploiement Render. Aucun push automatique à chaque sauvegarde locale.
- **Collaboration** : branches de travail et pull requests vers `main`, contrôles avant fusion, préservation du travail de Berina. Aucun conflit résolu silencieusement, aucun push forcé.
- **Données locales** : accès à la base partagée pour l’usage réel ; tests et expérimentations sur une base isolée. Annoncer quand une modification locale touche les données partagées.
- **Sauvegardes** : sauvegarde avant migration sensible, contrôle de restauration et journal des changements de configuration. L’accord valide cette politique, pas une infrastructure encore inexistante : définir la rétention et les moyens lors du plan de mise en œuvre, sans nouvelle dépense sans accord.
- **Cash-flow** : distinguer flux après intérêts historiques et financement d’acquisition, sans double déduction. Le périmètre chiffré et les libellés d’une correction doivent être validés avant modification des formules ; cette approbation de méthode ne certifie pas les calculs actuels.

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

## 8. Vérifications avant livraison

- Code : `bun run typecheck`, tests ciblés puis `bun run test`, et `bun run build` selon le changement. Ne pas présenter le nombre de tests comme une garantie de couverture complète.
- UI : tester le parcours réellement demandé dans le navigateur, chargement, erreurs, détails, sauvegarde/rechargement et largeur des colonnes. Contrôler aussi le responsive lorsque la mise en page change.
- Autorisations : administrateur, lecteur autorisé, lecteur interdit, accès retiré pendant une session et accès par URL directe.
- Persistance : une nouvelle lecture doit retrouver la valeur sauvegardée ; tests concurrents sur un environnement isolé, sans créer/supprimer des utilisateurs réels comme fixtures.
- Finance : rapprochement des détails et totaux, signe des charges, années historiques inchangées, annualisation unique, cas sans CA, comptes non affectés et sources manquantes.
- Odoo : liste de lecture seule et refus de toute méthode d’écriture ; les tests métier destructifs sont interdits sur la production.
- Local : vérifier frontend et API ; s’ils sont gérés par un superviseur, relancer le service identifié plutôt qu’empiler des processus. Ne pas promettre qu’un portable éteint restera accessible.
- Livraison : dire ce qui est prêt localement, ce qui est enregistré dans la base partagée, ce qui est publié et ce qui reste à vérifier. Donner le lien utile.

## 9. Limites et entretien des instructions

- Une règle décrit le résultat attendu ; elle ne garantit pas que toutes les parties existantes du code la respectent. Vérifier en particulier les écritures concurrentes, les initialisations de données et les rapprochements de trésorerie.
- Ne pas modifier le code métier, les données, l’infrastructure ou les droits au seul motif de la présence de ce fichier. Travailler dans le périmètre de la demande courante.
- Conserver ce fichier et sa référence métier cohérents lorsque Mathieu valide une nouvelle règle ; garder les constats temporaires hors des règles durables.
- Ne pas modifier le fichier global `~/.codex/AGENTS.md` pour une préférence propre à Equinoxe.
- Ces fichiers sont locaux tant qu’ils ne sont pas publiés. Berina les récupérera avec le dépôt lors d’une synchronisation après publication ; cela ne modifie pas automatiquement sa configuration Codex personnelle.
