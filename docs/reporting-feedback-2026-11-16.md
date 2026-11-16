# Reporting financier — retours du 16 novembre 2026

Demandes : réalisé noir, budget bleu, N−1 mauve ; trajectoires CA et marge brute distinctes, sans EBITDA superposé ; suivi clients >90 jours (option >60) ; explication et correction de l'écart de cash.

- Palette commune : réalisé #111111, budget #2563eb, N−1 #7030a0. Les écarts favorables/défavorables et catégories de risque gardent leur sémantique ; ils ne sont pas des séries N−1. BFR/cash réalisés : noir, opacité/pointillés pour distinguer les indicateurs.
- CA et marge brute mensuels repris des lignes calculées du P&L, société entière ou départements sélectionnés. N−1 = même mois de l'année précédente ; valeurs manquantes nulles. Budget Gimi 2026 et budget analytique existants divisés par 12, comme le prorata YTD déjà validé, sans profil saisonnier inventé. Pas de budget 2025/2027 inventé pour un LTM qui traverse deux années. Lonneux : N−1 mensuel et budget absents restent vides.
- Suivi recouvrement : factures et avoirs signés nets par client dans les tranches >90 et 61–90 ; total >60. Aucun paiement non lettré imputé arbitrairement. Les tiers créditeurs nets dans la tranche sont exclus de la liste de relance. Détail et liens vers les pièces conservés, pas d'envoi de relance.
- Diagnostic réel : copie historique cash Gimi importée le 8 octobre, clôture enregistrée différente du bilan Odoo actuel au même arrêté du 31 octobre 2026. Les 729 kEUR / 31 décembre 2026 mentionnés n'ont pas été reproduits dans les données actuelles : ne pas leur attribuer une cause précise sans autre preuve.
- Copie précédente sauvegardée hors Git, nouvel import via connecteur Odoo en lecture seule et repository existant. 34 fins de mois janvier 2024–octobre 2026 rapprochées, puis relecture après sauvegarde PostgreSQL. Clôture actualisée identique au bilan Odoo contrôlé ; montants privés conservés dans le compte rendu utilisateur et les preuves locales, hors Git.
- Évolution cash : contrôle en lecture de la clôture enregistrée contre le bilan Odoo au même jour ; signale un écart et l'import ancien, ou un contrôle indisponible. Un GET ne remplace jamais l'historique. Une égalité avec la copie n'est pas un rapprochement bancaire. Moyenne journalière et clôture fin de mois restent clairement distinctes.

Les réserves historiques de Lonneux restent documentées dans lonneux-treasury.md. Les tests de couleurs/séries, budget manquant, tranches/avoirs et fraîcheur sont indépendants des données privées, conservées hors Git.

Mise à jour validée le 16 novembre : N−1 passe au mauve #7030a0, repris du visuel « Reference » fourni, afin de distinguer la référence des encaissements et variations favorables verts.
