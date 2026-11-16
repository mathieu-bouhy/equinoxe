# Lonneux — balances âgées et synthèse cash

Extension demandée et publication autorisée par Berina le 16 novembre 2026, sur la même méthode que GIMI.

- Reprise des composants et services communs, sans copier la configuration ou les données GIMI. Résolution du connecteur Lonneux uniquement ; contrôle de la société active « Lonneux », contexte allowed_company_ids et domaines société. Caches isolés par connecteur/société.
- Même méthode de reconstruction des encours, tranches d'échéance et contrôles que docs/gimi-treasury.md. Factures et avoirs validés uniquement pour les encours ; autres écritures, paiements non lettrés et douteux séparés. Liens facture et exports propres à Lonneux.
- Historique mensuel exploitable à partir de janvier 2026. Les quelques écritures 2025 présentes dans Odoo ne constituent pas un historique complet ; aucun faux zéro 2025 ni report automatique de l'historique Excel annuel. Les écritures antérieures restent prises en compte dans la reconstruction des soldes 2026.
- Dernier mois configuré au contrôle : septembre 2026, donc neuf fins de mois disponibles. Les bornes suivent automatiquement la clôture enregistrée, sans changer ce paramètre à la publication.
- Cash/BFR selon les fonctions existantes, écritures validées et mêmes rubriques Lonneux. Cash = classe 5, sans correction arbitraire de reprise. Travaux en cours absents du détail des comptes 37 : valeur indisponible (null / tiret), pas zéro supposé.
- EBITDA cohérent avec le compte de résultat YTD Lonneux : factures non validées incluses comme dans cette vue. Cette exception est explicitée et ne s'applique pas aux encours, au cash ou au BFR.
- Réserves visibles : reprise des soldes d'ouverture et exhaustivité des règlements à vérifier ; compte d'attente 499 non nul ; absence de capitaux propres dans Odoo. Un rapprochement des totaux ne certifie pas l'exhaustivité de la reprise ni un rapprochement bancaire.
- Nouvelles entrées Trésorerie clients, Trésorerie fournisseurs, Synthèse cash. Résumé dans Reporting mensuel et BFR. Liens internes, identité visuelle et fichiers CSV propres à Lonneux. RH et budgets absents restent inchangés.
- Odoo en lecture seule, sans migration ni écriture des configurations partagées. Tests sur données isolées ; fixtures privées hors Git.

Contrôle réel : les deux encours se rapprochent de la balance Odoo à moins de 0,01 EUR sur les neuf fins de mois janvier–septembre 2026. Cet accord arithmétique ne lève pas les réserves comptables ci-dessus.
