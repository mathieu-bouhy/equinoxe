# Navigation et droits — refonte du 9 octobre 2026

## Comportement

- Rôles affichés : Administration et Utilisateur. Administration conserve tous les accès.
- À la création et à la modification, un formulaire enregistre le profil, les sociétés, les dossiers, le droit Equinoxe et, si renseigné, le nouveau mot de passe.
- La navigation développe les sous-menus sous leur rubrique. Configuration regroupe les utilisateurs, les intégrations (avec choix de société) et les configurations par société.
- Un utilisateur sans société peut accéder à ses dossiers, à Equinoxe ou à son profil. Les pages non autorisées sont bloquées, même par URL directe. L’API vérifie à nouveau les droits sur chaque requête ; le menu rafraîchit les droits toutes les 30 secondes.
- L’accès Equinoxe permet de consulter et exporter Facturation. Les opérations d’administration existantes (import, tarifs et correction des heures) restent réservées à Administration.
- La dernière connexion réussie est affichée à l’heure de Bruxelles. Ce champ n’est pas un historique exhaustif des sessions.
- Les mots de passe existants restent hachés. L’affichage par bouton œil concerne uniquement la nouvelle saisie.

## Identité visuelle

À la demande finale de Mathieu le 9 octobre 2026, les pages conservent une base blanche, avec des repères colorés plus présents dans les menus, onglets et tableaux. Les accents Equinoxe vert profond et corail et le logo proviennent du kit graphique validé du site vitrine (`Kit-Equinoxe-2026`, 18 septembre 2026). Les sociétés et dossiers ont leurs propres déclinaisons, décrites dans [visual-identity.md](visual-identity.md). Les couleurs de données (favorable/défavorable) restent distinctes et les tableaux conservent leurs structures et unités.

## Persistance et compatibilité

Les nouveaux champs `companyIds` et `equinoxAccess` sont stockés avec l’utilisateur dans `users.json`, le document JSONB PostgreSQL du même nom en environnement partagé. Ainsi, une sauvegarde de formulaire utilise une seule mutation transactionnelle du document utilisateurs. Aucun changement de schéma SQL ni réimport des données n’est nécessaire.

Pour un compte historique sans `companyIds`, la lecture utilise les attributions existantes de `company-access.json`. Une liste `companyIds: []` signifie explicitement aucun accès et ne déclenche pas de repli. Les anciens endpoints de gestion des accès continuent de fonctionner et écrivent désormais le document utilisateurs. Les comptes historiques `viewer` sont reconnus et présentés comme Utilisateur ; les nouveaux comptes utilisent `user`. Sans `equinoxAccess`, un non-administrateur n’a pas accès à Facturation.

**Publication à coordonner :** toutes les API qui utilisent la base partagée doivent recevoir cette version avant de gérer les comptes. Une ancienne API ne connaît pas le rôle `user` et son validateur peut supprimer les nouveaux champs lors d’une écriture. Ne pas exploiter simultanément l’ancienne et la nouvelle version contre les utilisateurs partagés. Avant publication, sauvegarder les documents utilisateurs et attributions ; en cas de retour à une ancienne version, traiter également ces données et ne pas se contenter d’un retour du code.

## Vérifications locales

Tests API : création et relecture, modification complète, validation sans modification partielle, doublon concurrent, droits legacy, retrait en session ouverte, compte inactif, protection de son accès Administration, mot de passe remplacé, exclusion des secrets des réponses et date de connexion.

Parcours navigateur sur données isolées : navigation et accordéons, modification des accès et rechargement, changement de compte sans cache résiduel, compte limité à un dossier, compte limité à Equinoxe, refus par URL directe, formulaire et menu mobile à 390 pixels. La connexion réelle PostgreSQL et les données partagées ne sont pas utilisées pour ces tests.
