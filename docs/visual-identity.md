# Identités visuelles — 9 octobre 2026

La demande finale conserve une base blanche mais renforce les repères colorés : navigation, onglets actifs, en-têtes des tableaux, lignes calculées et totaux. Elle remplace la consigne intermédiaire « tout blanc ».

## Références consultées

- Equinoxe : kit validé du 18 septembre 2026, vert `#163c34` et corail `#ed8b6b`, logo original.
- Gimi : https://www.gimi.be/fr/ — jaune `#ffc543`, texte sombre `#2d0d07` relevés sur le site.
- Lonneux : https://menuiserielonneux.be/ — vert `#96bf11` et bois `#d5a88c` relevés sur le site. Le vert des boutons a été assombri pour permettre une lecture confortable du texte blanc.
- Eurodrill : https://www.eurodrill.be/ — déclinaison bleu `#008fbe` et vert `#82b54c` inspirée du logo visible sur le site, plutôt que du violet standard des boutons Odoo. Ce sont des adaptations visuelles, pas un relevé de charte officielle.

Les dossiers analysés reçoivent des accents éditoriaux : turquoise Medipost, pain doré Smiling Baker, végétal Europlantes, mauve S.M.P. Ces couleurs ne sont pas présentées comme leurs chartes officielles.

## Application

`apps/web/src/company-theme.css` centralise les palettes et la hiérarchie des rapports. `Shell` transmet l’identité de la société ou du dossier courant via `data-brand`. Chaque entrée du menu conserve sa couleur, indépendamment de l’espace ouvert. La navigation générale garde l’identité Equinoxe.

- Corps de page et détails sur blanc ; nuances légères pour séparer les groupes.
- Onglet actif en couleur pleine, textes contrastés, focus visible.
- En-têtes teintés, calculs intermédiaires discrets, résultats clés plus marqués.
- Colonnes budget bleutées ; écarts favorables verts et défavorables rouges. Les couleurs des sociétés ne remplacent pas ces états financiers.
- Aucune modification des chiffres, formules ou permissions.

## Aperçu isolé

L’aperçu `127.0.0.1:43128` utilisait un jeu de démonstration initial contenant Gimi et Lonneux. Eurodrill a été ajouté à ce jeu local via le service de préparation existant et le serveur de démonstration a été redémarré avec son option locale Eurodrill. Aucune société de la base partagée n’a été créée, activée ou modifiée. Les connecteurs Odoo ne sont pas configurés dans cet aperçu : les données indisponibles restent signalées comme telles.
