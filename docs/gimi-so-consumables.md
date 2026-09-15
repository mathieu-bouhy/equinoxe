# SO facturés : valeur commandée des consommables

Cette analyse remplace celle des achats 600100 par `gimi_type`. Le titre de l’onglet reste « Achats — SO liés », mais l’ancienne clé système et ses branches de calcul ont été retirées. Elle n’avait pas été activée sur les comptes partagés.

## Périmètre et calcul validés

- SO confirmés, date de commande du 1er janvier 2023 au mois clôturé (maximum décembre 2026). Les dates UTC Odoo sont converties en dates calendaires Europe/Brussels.
- Liens explicites `account.move.line.sale_line_ids` → `sale.order.line.order_id`. Factures clients validées uniquement (`out_invoice`, `posted`), dates comptables depuis 2023 jusqu’au mois clôturé. Ni brouillons, ni avoirs, ni achats. Le mois arrêté s’applique à la sélection des factures et des SO.
- Comptes appartenant à la rubrique CA par les préfixes configurés, et non par approximation du libellé. Affectations actuelles capturées au calcul. Un SO est candidat si un des comptes liés possède une part incendie. Il est attribué seulement si tous les comptes de CA liés à ses lignes facturées donnent le même département incendie à 100 %. Comptes mixtes, inconnus ou départements contradictoires : SO à vérifier, exclu des deux montants.
- Tous les produits `product.product.type = consu`, suivis en stock ou non. Exclure `service`, `combo`, sections/notes et acomptes. Pas de filtre sur `gimi_type`.
- Montant par ligne : quantité commandée × prix unitaire HT après remise, arrondi au centime après multiplication. Le champ Odoo `price_reduce_taxexcl` est arrondi au centime : ne pas le multiplier par la quantité. Pour un prix hors taxes, calculer le prix remisé sans arrondi (`price_unit × (1 − discount/100)`). Conserver séparément `price_subtotal` Odoo : certains SO historiques présentent des écarts avec leurs prix/remises actuels ; afficher ces écarts sans remplacer le calcul demandé. Pour un prix taxe incluse (y compris taxes groupées), le sous-total HT Odoo fournit la valeur nette hors taxes. Les identifiants, quantités, prix, remises, sous-totaux source et calculés, et liens de factures sont conservés.
- Dédupliquer les SO et leurs lignes, même en cas de facturation partielle, de plusieurs factures ou d’une facture couvrant plusieurs commandes. Attribuer la totalité du montant du SO à son année de commande, pas à celle des factures. Cela ne constitue pas le CA comptabilisé : la valeur commandée peut dépasser le montant facturé et les avoirs ne la réduisent pas.
- EUR seulement dans les deux totaux ; autres devises isolées, jamais additionnées comme des euros. Pourcentage = département / (installation + maintenance) pour la même année. Total nul → pourcentage indisponible. Période future non importée → montant indisponible, pas zéro. Pas d’extrapolation.

Les lignes de facture incendie sans lien explicite vers un SO sont comptées dans un avertissement ; aucun rapprochement textuel ou montant approximatif ne leur invente un SO. Les SO annulés/hors période et ceux sans facture validée ne font pas partie de l’analyse. Les types de produits et affectations sont ceux connus lors du recalcul, pas un historique de leurs modifications.

## Persistance, sécurité et archive

GET et POST `/v1/companies/:id/so-consumables`, réservés aux administrateurs Gimi. GET relit sans recalculer. POST relit Odoo via le connecteur à liste fermée de méthodes de lecture, contrôle les données, sauvegarde et relit PostgreSQL. Délai de réponse dédié de 255 secondes ; les appels Odoo ont leurs propres délais et reprises bornés. Un problème de réponse peut survenir après une sauvegarde : relire avant de relancer.

Document PostgreSQL `so-consumables:<companyId>` dans `equinoxe_documents`. Verrou transactionnel par société couvrant première création et mises à jour. Un ancien calcul ne remplace pas un plus récent. Versions précédentes sous `so-consumables:<companyId>:archive:<startedAt>`, sans purge automatique. Pas de repli fichier local et aucune donnée privée dans Git.

Le retrait de l’ancien document `purchase-so:<companyId>` est une opération explicite (`archivePreviousAnalysis`), jamais un effet de démarrage ou de lecture. Copie dans `purchase-so:<companyId>:retired:<timestamp>`, comparaison JSONB intégrale, puis suppression de l’ancienne clé dans la même transaction. Les archives préexistantes restent disponibles. Une récupération nécessite de relire une archive et de vérifier son format ; ne pas mélanger l’ancien et le nouveau modèle.

Les comptes et clés actuels ne sont jamais modifiés par cette analyse. Aucun changement à Odoo, aux utilisateurs ou aux autres sociétés.

## Vérifications

`bun run typecheck`, `bun run test`, `bun run build`.

Depuis `apps/api`, `bun --env-file=.env.local scripts/verify-so-consumables-postgres.ts` teste création, relecture, concurrence, restauration et retrait récupérable dans une table temporaire de session qui masque la table réelle. Aucun document métier réel n’est touché par ce test.

Contrôler en navigateur : quatre lignes/quatre années, unité kEUR et montants exacts au survol, pourcentages, calcul et confirmation, rechargement, détails par année/département, cas exclus, recherche, pagination et défilement contenu sur mobile.
