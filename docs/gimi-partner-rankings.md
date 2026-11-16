# GIMI — Classements clients et fournisseurs

Vues YTD et LTM, dates comptables bornées au dernier mois clôturé : janvier à la clôture ou douze mois inclusifs. Périmètre société entière, affiché uniquement dans la vue globale du reporting mensuel. Aucune extrapolation, aucune modification des affectations analytiques.

Clients : comptes de la rubrique CA configurée (préfixe le plus spécifique), montants Odoo validés crédit moins débit. Le total avant exclusions est rapproché au même compte de résultat, sur les mêmes dates. Les montants sans partenaire, notamment les écritures de situation, ne sont pas affectés artificiellement à un client.

Fournisseurs : `account.move`, factures et avoirs fournisseurs validés, `amount_untaxed_signed` en devise société inversé une seule fois pour présenter les achats nets positifs. Toutes les natures facturées restent incluses, y compris charges sociales facturées et immobilisations ; il ne s'agit ni des seuls comptes 60, ni des paiements, ni du CA global des fournisseurs. Les OD sans facture fournisseur sont exclues de ce périmètre.

Les contacts sont regroupés par `commercial_partner_id`. À la demande explicite de Berina, Bajoma et MBP sont exclus des DEUX classements, totaux et pourcentages. L'identification porte sur le nom de la société commerciale, normalisé (Bajoma, MBP ou MBP Group, avec les formes SA/SRL/SPRL). Les contacts rattachés sont aussi exclus ; aucun rapprochement approximatif avec une autre dénomination. Les montants exclus sont gardés séparément pour le rapprochement. Le contrôle du CA compare le total comptable AVANT exclusions au P&L.

Classement décroissant des dix plus gros montants nets positifs. Les autres montants, avoirs nets négatifs et non attribués restent dans les totaux externes ; la part est calculée sur ce total net hors sociétés liées. Un total net nul ou négatif ne donne pas de pourcentage. Groupes lus intégralement puis contrôlés avec un total indépendant ; aucune réponse tronquée n'est affichée. Périmètre GIMI vérifié, lecture seule via le connecteur existant, accès société contrôlé sur la route backend.

Synthèse en kEUR, détail en EUR avec centimes ; noms et liens Odoo des tiers réels. Le bouton Actualiser rafraîchit également ces classements. Les données et extractions privées restent hors Git.
