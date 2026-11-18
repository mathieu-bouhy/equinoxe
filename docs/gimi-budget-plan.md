# Budget Gimi 2027–2036

## Périmètre de la première version

Le budget constitue un espace distinct du reporting financier. La première sous-section couvre 2027 à 2036, avec 2027 comme année de travail prioritaire. Elle contient six écrans : résultats, KPI et hypothèses utiles, scénarios, rémunérations, CAPEX, puis bâtiment et flux internes.

Les hypothèses sont persistées par société dans PostgreSQL et protégées par un numéro de révision. Un utilisateur autorisé à Gimi peut les consulter ; seule l'Administration peut les modifier. La page Résultats présente un premier compte de résultat prévisionnel agrégé de 2026 à 2036.

## Hypothèses de scénarios

- Base proposée : situation intermédiaire au 31 octobre 2026, avec case de sélection et validation séparée.
- Best case : croissance 15 %, achats 28 % du CA, services et biens divers 8 %, rémunérations 24 %.
- Neutral case : croissance 12 %, achats 34 % du CA, services et biens divers 12 %, rémunérations 30 %.
- Worst case : croissance 5 %, achats 40 % du CA, services et biens divers 12,5 %, rémunérations 32 %.
- Le BFR reste vide tant que sa méthode et son taux n'ont pas été confirmés.
- Toutes les valeurs sont éditables année par année. Une case cochée signifie que l'hypothèse a été revue avec Basile ; elle ne transforme pas l'hypothèse en donnée comptable réalisée.

## Rémunérations

Chaque recrutement précise le nombre, la fonction, le département, la commission paritaire, la date d'entrée et le coût annuel de référence 2026. Lorsque la fonction correspond à une fonction existante dans la comptabilité analytique, l'interface propose la moyenne des coûts annuels connus sans l'imposer.

Le coût budgété applique l'indexation annuelle puis un prorata journalier entre la date d'entrée et la fin de l'année. L'hypothèse CP 200 est initialisée à 4,17 %. L'indexation CP 149.01 reste vide jusqu'à validation ; aucun taux n'est inventé.

## Bâtiment et flux internes

- Nouveau loyer : le loyer actuel de 145 000 € reste appliqué de janvier à avril 2028, puis le loyer annuel de 340 000 € s'applique à partir de mai. L'indexation de 1,5 % intervient à chaque anniversaire en mai.
- Bajoma : 20 804,03 € HTVA par mois, soit 25 172,87 € TVAC au taux de 21 %. Seul le montant HTVA affecte le compte de résultat budgété. La date de début reste éditable et est initialisée au 1er janvier 2027.
- La grille liée à la rémunération dirigeant est confidentielle : elle reste côté API et n'est jamais renvoyée au navigateur. Le résultat budgétaire l'intègre uniquement dans un agrégat de services et biens divers.

## KPI, décisions et saisonnalité

- Les KPI de référence sont lus dans les rapports Odoo déjà utilisés par le compte de résultat extrapolé, l'analyse de marge, le BFR et le CAPEX. Une source indisponible reste affichée comme telle ; elle ne devient jamais un zéro ou une estimation implicite.
- La page suit les décisions à prendre avec Basile : croissance et mix, récurrence, prix/volume, carnet de commandes, inflation achats, répercussion tarifaire, productivité, effectifs, BFR, stocks, véhicules, CAPEX, bâtiment, financement, impôts et saisonnalité.
- La saisonnalité mensuelle 2027 reprend la distribution complète du CA et de la marge brute de 2025. Pour les mois déjà clôturés en 2026, elle combine à parts égales leur profil relatif 2025 et 2026, tout en conservant le poids total de ces mois dans l'année 2025. Le résultat est renormalisé et réconcilié exactement avec les totaux annuels 2027.
- Cette saisonnalité est une proposition à valider, pas une donnée réalisée. Elle n'est calculée que si les rapports mensuels Odoo 2025 et 2026 sont disponibles.

## CAPEX

- Les familles budgétaires suivent le reporting Investissements – CAPEX : logiciels, véhicules, informatique et mobilier, installations et outillage, terrains et constructions, aménagements, location-financement, immobilisations en cours et autres immobilisations.
- Le réalisé de la dernière période Odoo sert uniquement de repère. Le budget 2027–2036 est complété manuellement ; aucune répétition automatique des acquisitions passées n'est appliquée.
- La grille contient des montants d'investissement hors TVA. Calendrier de paiement, TVA, financement, cessions et amortissements doivent encore être reliés au futur plan de trésorerie.

## Contrôles attendus avant le compte de résultat prévisionnel

- Valider la méthode de BFR et les ratios par scénario.
- Confirmer l'indexation CP 149.01 et la définition du coût salarial utilisé : brut, coût employeur ou coût analytique complet.
- Confirmer la date de départ de la refacturation Bajoma.
- Confirmer si l'indexation du loyer intervient à l'anniversaire du bail ou au 1er janvier.
- Valider la formule confidentielle et son traitement d'un EBITDA hors de la grille sans l'exposer dans l'interface.
