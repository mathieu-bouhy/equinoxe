# Equinoxe

Application locale de pilotage multi-sociétés. Le premier jalon inclut Gimi, l’authentification locale, les accès par société, les placeholders de dashboards et le test réel d’une intégration Odoo en lecture seule.

## Démarrage

Prérequis : [Bun](https://bun.sh) (version récente).

```bash
cp .env.example apps/api/.env.local
bun install
bun run dev
```

Ouvrez `http://localhost:5173`. L’API écoute sur le port 3001. Le premier administrateur est créé au démarrage avec `EQUINOXE_ADMIN_EMAIL`, `EQUINOXE_ADMIN_PASSWORD` et `EQUINOXE_ADMIN_NAME` si aucun utilisateur n’existe.

Les données se trouvent dans `data/`, ignoré par Git. Pour un autre emplacement, renseignez `APP_DATA_DIR` (chemin relatif à `apps/api` ou absolu).

## Configuration Odoo et sécurité production

Dans `apps/api/.env.local`, renseignez `GIMI_ODOO_BASE_URL`, `GIMI_ODOO_DATABASE`, `GIMI_ODOO_USERNAME` et `GIMI_ODOO_API_KEY`. La page **Intégrations** teste une authentification JSON-RPC Odoo ; elle ne transmet ni ne stocke jamais le secret. Une configuration absente s’affiche comme « Non configuré ».

Vous pouvez utiliser une clé API dont l’utilisateur Odoo a des droits étendus. La clé reste exclusivement dans `apps/api/.env.local`, n’est jamais envoyée au navigateur et n’est jamais stockée dans les fichiers de données. Un utilisateur de service limité reste une défense supplémentaire recommandée, mais il n’est pas requis pour utiliser Equinoxe.

Equinoxe impose sa propre protection : son connecteur repose sur une liste fermée de méthodes JSON-RPC de lecture (`read`, `search`, `search_read`, `read_group`…). Une méthode d’écriture comme `create`, `write`, `unlink`, `copy` ou une action métier est refusée par le connecteur avant tout envoi à Odoo. Le test d’intégration n’utilise que l’authentification et ne réalise aucune lecture ou écriture métier. Hors environnement local, l’URL Odoo doit être en HTTPS.

## Architecture

- `apps/web` : React/Vite, React Router, TanStack Query et composants UI.
- `apps/api` : serveur Bun, Zod, sessions HMAC HTTP-only, autorisations et connecteurs.
- `packages/shared` : modèles et contrats partagés.
- `data` : fichiers JSON locaux avec écritures atomiques.

La société Gimi et ses trois définitions de dashboards sont initialisées automatiquement. Pour ajouter une société, utilisez l’API d’administration (ou étendez l’écran dédié) ; les dashboards sont des enregistrements liés à la société. Pour ajouter un connecteur, implémentez la même surface que `OdooConnector`, puis associez-le au `connectorType` de la société : les routes métier ne parlent pas directement à Odoo.

## Vérifications

```bash
bun run typecheck
bun run test
bun run build
```

Les variables et les données locales contenant des secrets sont exclues de Git. Ne versionnez jamais `apps/api/.env.local` ni le dossier `data`.

## Déploiement Render (première version partagée)

Le dépôt inclut un `render.yaml` et un `Dockerfile` pour déployer l'application comme un unique service HTTPS. Le frontend et l'API partagent alors la même origine, ce qui préserve les cookies de session HTTP-only.

1. Dans Render, choisissez **New > Blueprint** puis sélectionnez ce dépôt et la branche `main`.
2. Render détecte `render.yaml`. Vérifiez la région **Frankfurt**, le plan **Starter** et le disque persistant de 1 Go monté sur `/var/data`.
3. Avant le premier déploiement, renseignez les variables dont la valeur est demandée : administrateur Equinoxe, `APP_ORIGIN` (l'URL `https://…onrender.com` fournie par Render) et les variables Odoo Gimi/Lonneux. Ne copiez jamais `apps/api/.env.local` dans GitHub.
4. Lancez le déploiement et vérifiez `https://votre-url/health`, puis connectez-vous à l'application.

Le disque persistant convient à cette première version avec une seule instance applicative. Pour la montée en charge, le multi-instance ou une exigence de haute disponibilité, la prochaine évolution sera la migration des repositories JSON vers PostgreSQL.
