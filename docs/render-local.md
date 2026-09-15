# Publier Equinoxe depuis un poste de l'équipe

Les paramètres privés Render sont regroupés avec les paramètres Odoo dans `apps/api/.env.local`. Le 14 septembre 2026, ils ont été renseignés pour le service `equinoxe` (`srv-d9uvr1ijobas73bu6lmg`), qui suit la branche `main` du dépôt `mathieu-bouhy/equinoxe`.

## Transmettre la configuration à Léa ou Bérina

Transmettre le fichier uniquement par un canal privé aux personnes autorisées. Le placer au même endroit dans leur copie du projet, en préservant leurs paramètres locaux s'ils existent déjà. Ce fichier contient également les accès Odoo et la connexion PostgreSQL partagée : une API locale qui utilise cette base agit sur les données réelles. Les tests restent sur des données isolées.

Le fichier est ignoré par Git et ne doit jamais être ajouté de force. Aucun secret n'est nécessaire dans le frontend ni dans les fichiers versionnés.

## Paramètres Render

| Variable | Utilisation |
|---|---|
| `RENDER_SERVICE_ID` | Identifiant du service Equinoxe |
| `RENDER_DEPLOY_BRANCH` | Branche actuellement déployée : `main` |
| `RENDER_SERVICE_URL` | Adresse publique de l'application |
| `RENDER_DEPLOY_HOOK_URL` | URL secrète autorisant le déclenchement d'un déploiement |

Le lien secret permet de déclencher un déploiement de ce service. Il ne donne pas accès au tableau de bord, aux logs ni aux paramètres Render. Pour ces fonctions, chaque personne doit disposer de son propre accès au workspace et se connecter, par exemple avec `render login`.

Le CLI Render ne charge pas automatiquement ce fichier dotenv. Pour utiliser le hook, le programme ou Codex doit charger explicitement `apps/api/.env.local`, puis utiliser `RENDER_DEPLOY_HOOK_URL` sans en afficher la valeur.

## Publication avec Codex

Prompt à utiliser après une demande explicite de publication :

> Lis les instructions du dépôt. Vérifie la branche, les modifications et l'état distant, puis teste les changements sur des données isolées. Publie le code via une pull request et respecte les validations avant fusion dans main. Si un déploiement Render est encore nécessaire après la fusion, charge les paramètres RENDER_* depuis apps/api/.env.local sans afficher les secrets. Vérifie que le hook cible exactement le service RENDER_SERVICE_ID sur api.render.com en HTTPS, puis envoie une requête POST au hook. Ne change pas sa référence de commit pour contourner la branche commune. Distingue déploiement lancé, en attente et terminé. Vérifie ensuite le commit déployé et le parcours modifié avec les moyens disponibles. Si tu n'as pas accès au statut ou au commit Render, signale cette limite et n'annonce pas une publication vérifiée.

Un appel au hook déploie du code déjà présent sur GitHub ; il n'envoie pas les fichiers locaux. Un simple push d'une branche personnelle ne remplace donc pas la fusion dans `main`.

Ne jamais ouvrir le hook dans un navigateur pour « vérifier le lien » : une requête GET peut déclencher un déploiement. Render documente `200` comme un lancement et `202` comme une mise en attente ; ces réponses ne prouvent pas que le déploiement est terminé. Voir la [documentation officielle des hooks Render](https://render.com/docs/deploy-hooks).

## État de la mise en place

Configuration et correspondance service/branche vérifiées dans le tableau de bord le 14 septembre 2026. L'URL secrète a été enregistrée localement sans appel au hook. Aucun déploiement n'a été déclenché pour tester ces accès. Les variables de connexion déjà présentes ont été conservées.
