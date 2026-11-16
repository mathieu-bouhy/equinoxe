# GIMI — balances âgées et synthèse cash

Périmètre et méthodes validés par Berina le 16 novembre 2026. Publication Render explicitement autorisée après vérification.

## Navigation

Trois vues GIMI, dérivées du registre sans réécriture PostgreSQL : Trésorerie clients, Trésorerie fournisseurs, Synthèse cash. Synthèse compacte dans Reporting mensuel (société entière) et BFR. Les autres sociétés ne changent pas.

## Balances âgées

- Odoo exclusivement en lecture seule via le connecteur existant et sa liste fermée de méthodes.
- Restriction explicite à la société Odoo active du compte de connexion GIMI, dans le contexte et les domaines des comptes/écritures. Refus d'un mélange de sociétés ou d'une devise comptable différente de EUR.
- Comptes commerciaux 40 de type asset_receivable et 44 de type liability_payable, archives comprises. Les comptes fiscaux 41 mal typés client restent exclus. Les comptes 407 du périmètre sont isolés en douteux.
- Écritures validées seulement ; devise société, TTC, centimes conservés. Montants débiteurs positifs pour les clients, convention inverse pour les fournisseurs. Avoirs signés conservés, y compris si une tranche devient négative.
- Date affichée : fin du dernier mois clôturé configuré ou aujourd'hui en Europe/Brussels. Historique : treize fins de mois consécutives jusqu'au mois clôturé, jamais extrapolé.
- Échéances = date_maturity de la ligne comptable. Date égale à l'arrêté : non échue. Retards 1–30 / 31–60 / 61–90 / >90 jours. Une date absente est isolée, sans substitution.
- Solde historique d'une ligne existant à la date = amount_residual actuel + partiels débiteurs dont max_date est postérieure à l'arrêté − partiels créditeurs postérieurs. Lire aussi les lettrages futurs, même au-delà d'aujourd'hui, pour annuler leur effet sur le solde courant.
- Charger les lignes actuellement ouvertes OU lettrées depuis la première fin de mois ; une ligne soldée avant toute la fenêtre est nulle à tous les arrêtés et peut être exclue. Pagination par id ; aucun résultat tronqué.
- Factures et avoirs séparés des autres écritures, paiements, reports et comptes douteux. Aucun paiement non lettré n'est affecté arbitrairement à une facture. Détail par ligne d'échéance, pas un comptage de factures uniques.
- Contrôle indépendant read_group par compte/date : factures et avoirs + autres + douteux = solde comptable net. Écart > 0,01 EUR signalé, jamais corrigé automatiquement. Ce contrôle de total ne certifie pas l'exhaustivité des lettrages ni le recouvrement.
- Reconstruction à partir des lettrages actuellement présents ; une suppression ou modification rétroactive de lettrage peut changer l'historique. Pas d'archive comptable certifiée ni de preuve d'un rapprochement bancaire.
- Les quatre semaines à venir montrent les échéances contractuelles, pas une prévision de règlements effectifs.
- Pas de filtre département : aucune ventilation des créances/dettes supposée depuis les clés du P&L.
- Cache mémoire de cinq minutes, par connecteur, date et clôture. Pas de stockage partagé nouveau ni de migration. Les erreurs restent distinctes d'une absence de données.

## Synthèse cash et BFR

- Réutilise getBalance et getBfr : cash = classe 5, mêmes comptes que Trésorerie et placements ; BFR = rubriques configurées, sans nouvelle interprétation des signes.
- Treize soldes de fin de mois, évolution du cash, BFR et impact cash mensuel = opposé de la variation du BFR. Pas de prétendue causalité unique entre cash et BFR.
- Stocks = classe 3 hors 37 ; travaux en cours = classe 37. EBITDA YTD repris du compte de résultat configuré, pas assimilé à du cash encaissé.
- Aucun ratio de conversion cash/EBITDA fabriqué à partir d'un pont non réconcilié. Les délais DSO/DPO ne font pas partie de cette première livraison.

## Vérification

Tests des tranches, échéances absentes, avoirs signés, paiements partiels et futurs, historique, contrôles manquants/écarts, isolation société, refus des mutations, droits lecteur/administrateur et retrait d'accès pendant la session. Contrôle réel au 31 octobre 2026 : les deux balances se rapprochent à moins d'un centime sur les treize fins de mois. Données privées et fixtures réelles conservées hors Git dans tmp/.
