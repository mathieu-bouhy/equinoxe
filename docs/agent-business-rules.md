# Règles métier Equinoxe — référence des agents

Règles validées le 8 septembre 2026, complémentaires à [AGENTS.md](../AGENTS.md). Lire les sections utiles avant d’agir. Ce document ne déclenche pas d’implémentation et ne certifie pas l’exactitude du code existant.

## 8. Reporting et sources historiques

- Noms de référence : Gimi, Lonneux, Medipost. Les variantes issues de la dictée ne justifient pas de créer une nouvelle société.
- Séparer « Sociétés existantes » et « Dossiers analysés ». Conserver une navigation et des configurations propres à chacun.
- Les dashboards proviennent du registre par société. Ne pas réintroduire les anciens placeholders Synthèse/Finance/Opérations à la place des rapports développés.
- Gimi : données comptables Odoo, écritures validées. Lonneux : historique 2024–2025 issu de l’import Excel et 2026 issu d’Odoo, avec inclusion des factures non validées demandée pour Lonneux seulement.
- Import Lonneux : prendre les lignes portant un vrai numéro de compte ; ne pas additionner à nouveau titres et sous-totaux du fichier.
- Medipost : comptes historiques issus des documents fournis ; 2025 est provisoire. Les détails 2024–2025 proviennent du PDF ; ne pas inventer des sous-comptes pour 2023 lorsque seul l’agrégat est disponible.
- Conserver la provenance, la période et les limites de précision. Ne pas remplacer une donnée indisponible par zéro sans justification.
- Toute rubrique utilise la configuration et ses préfixes/relations, pas une approximation basée uniquement sur le libellé. Un code `false`, vide ou invalide n’est pas un compte de ventes.
- Le mois clôturé enregistré borne les rapports concernés. Ne pas utiliser automatiquement le mois courant de l’ordinateur à sa place.
- LTM Gimi : périodes consécutives de douze mois inclusifs, de la plus ancienne à gauche à la plus récente à droite ; pas de fenêtre de treize mois.
- Extrapolation : année courante configurée = cumul janvier à mois clôturé × 12 / numéro du mois ; années closes inchangées. Ne jamais annualiser deux fois.
- L’expansion mensuelle ajoute des colonnes horizontalement, pas des lignes. Préserver les mêmes détails et règles de configuration entre normal, LTM et extrapolé.

## 9. Calculs financiers : traçabilité avant tout

- Définir pour chaque montant : source, périmètre de comptes, période, signe, formule et unité. Faire les calculs avant l’arrondi d’affichage.
- Utiliser une convention cohérente : produits positifs et charges négatives lorsque c’est celle du compte de résultat. Dans ce cas, soustraire une charge signifie additionner son montant déjà négatif, pas inverser deux fois son signe.
- Marge brute demandée pour le compte de résultat Medipost : chiffre d’affaires + autres produits d’exploitation − marchandises/approvisionnements ; services et biens divers en dessous. Ne pas appliquer automatiquement cette définition à un autre rapport dont le périmètre est différent.
- Gimi, Analyse de marge analytique : chiffre d’affaires et marchandises des rubriques configurées, sans ajouter spontanément les autres produits, salaires ou frais généraux.
- Résultat après impôts → rajouts des charges non décaissées pertinentes → variation du BFR → investissements décaissés → financement, selon le périmètre validé du pont de trésorerie.
- Un amortissement comptable n’est pas un décaissement. Les reprises, cessions, transferts, apports et autres opérations non monétaires doivent être analysés, pas assimilés à des CapEx payés.
- Un compte d’amortissement cumulé comme 241900 ne doit pas devenir à lui seul un investissement décaissé. Ne pas déduire les intérêts une deuxième fois s’ils figurent déjà dans le résultat de départ.
- La variation du BFR dans le cash-flow Gimi doit reprendre exactement le calcul de l’onglet BFR ; son impact trésorerie a le signe opposé à la hausse du BFR.
- Conserver les rubriques BFR demandées, notamment stocks et en-cours séparés. Expliquer les inclusions/exclusions et le périmètre fiscal/social ; ne pas changer une définition belge sans analyse sourcée et validation.
- Pour les pourcentages BFR de l’année partielle, utiliser un chiffre d’affaires annualisé conformément au mois sélectionné.
- Réconciliation : trésorerie d’ouverture + flux nets identifiés = trésorerie de clôture du bilan. Ne pas reprendre sous une autre ligne les mêmes comptes déjà inclus dans le cash-flow libre après dette.
- Une baisse de capitaux propres ou une affectation du résultat ne prouve pas un dividende payé. Identifier les véritables flux et contreparties avant de présenter une distribution.
- Ne pas forcer un écart à zéro ni le baptiser « autres mouvements » pour faire paraître la réconciliation terminée. Si des preuves manquent, isoler l’écart, expliquer ce qui reste à vérifier et ne pas déclarer le calcul validé.
- Les totaux du détail doivent se rapprocher des agrégats à la précision de la source. Des PDF arrondis ne permettent pas de promettre une preuve à l’euro près.
- Gimi, Évolution trésorerie (méthode validée le 8 septembre 2026) : même périmètre de comptes de classe 5 que « Trésorerie et placements » du bilan, écritures Odoo validées, débit moins crédit. Repartir du solde au 31 décembre 2023 et des mouvements depuis le 1er janvier 2024, jusqu’au dernier mois clôturé sélectionné.
- Moyenne mensuelle = moyenne des soldes de fin de journée sur tous les jours calendaires, week-ends inclus. Un jour sans mouvement conserve le solde précédent. Minimum et maximum portent sur ces soldes journaliers, jamais sur des variations intrajournalières. Calculer avant l’arrondi d’affichage ; conserver les centimes dans l’export CSV.
- L’historique de trésorerie est une copie PostgreSQL contrôlée, actualisable explicitement par un administrateur depuis Odoo en lecture seule. Une période non importée reste signalée comme manquante, sans report fictif présenté comme réalisé. Un import incomplet ou non rapproché ne doit pas remplacer le précédent.
- Le pont de trésorerie Gimi possède son onglet « Flux de trésorerie ». Son déplacement hors du compte de résultat ne constitue pas une validation ou une correction de ses formules ni de ses écarts de réconciliation existants.

## 10. Medipost : business plan et analyses

- Présenter l’historique 2023–2025 et les prévisions 2026–2028 dans le compte de résultat principal, avec les analyses de trésorerie et les années clairement alignées.
- Les hypothèses de projection ne changent jamais les comptes historiques 2023–2025.
- Hypothèses éditables et persistantes : croissance, taux des grandes rubriques, loyers, ajustements de rémunération, CapEx annuels, financement et paramètres de trésorerie.
- CapEx : montants annuels en milliers d’euros dans les hypothèses opérationnelles, et non une hypothèse globale du schéma d’acquisition.
- Augmentation de loyer : charge négative. Retrait du coût de l’ancien dirigeant : impact positif. Nouveau dirigeant : charge négative. Respecter les ajustements signés saisis sans inverser leur effet une seconde fois.
- Séparer charges financières historiques et intérêts du nouveau crédit. Les charges historiques doivent être configurables en pourcentage du CA ; aucun intérêt du nouveau crédit avant le début de l’acquisition.
- Dernière demande de remboursement : échéance annuelle constante, capital + intérêts, et non capital constant. Expliquer cette distinction si une nouvelle demande mélange les deux.
- Le financement d’acquisition reçu par la holding ne constitue pas une entrée de trésorerie de Medipost. Modéliser séparément l’extraction de trésorerie et le service de la dette selon les hypothèses validées.
- Les montants de départ déjà discutés sont des valeurs initiales, pas des constantes à réinjecter à chaque déploiement. Les dernières valeurs enregistrées priment.
- Analyse des marchés : quatre segments distincts — nutrition/stomie/incontinence ; bandagerie/mobilité/domicile ; matériel médical général B2B ; pharmacie/parapharmacie omnicanal.
- Adapter concurrence, pression concurrentielle, géographie et perspectives à chaque segment. Préserver une conclusion transversale et les questions de diligence.
- Pour Medipost, fonder les ratios sur les comptes récents disponibles dans l’application, notamment 2025 provisoire, plutôt que revenir automatiquement à l’info memo. Ne pas diviser un EBITDA 2025 par un effectif d’une autre année sans l’indiquer.
- Concurrents : tableaux annuels comparables, unités explicites, CA, achats, marge, personnel, services, EBITDA, pourcentages et ETP quand les sources les fournissent. Ne pas inventer une valeur absente.
- Analyses INAMI, réglementation et croissance des marchés : sources primaires datées, distinction Belgique/Flandre/Wallonie et distinction faits, prévisions et hypothèses.
- Recherche multi-agents seulement lorsqu’elle est demandée ou prévue par les instructions applicables : spécialistes pertinents et vérificateur indépendant, avec désaccords documentés.

## 11. Gimi : comptabilité analytique

- SO consommables (remplacement validé le 9 septembre 2026) : SO confirmés depuis 2023 liés aux factures clients validées, comptes de la rubrique Chiffre d’affaires et affectations analytiques actuelles. Conserver les SO rattachés sans ambiguïté à Incendie installation ou Incendie maintenance ; isoler les rattachements mixtes/ambigus. Ne plus utiliser `gimi_type` ni la répartition ligne par ligne des achats du 600100 de l’analyse abandonnée.
- Montant par SO = valeur des quantités commandées HT après remise des lignes de type `consu` (Biens, suivis en stock ou non), hors services, combos, notes/sections et acomptes. Compter chaque SO une seule fois dans l’année de commande (date Odoo UTC convertie en Europe/Brussels), même avec plusieurs factures. Il s’agit de valeur commandée et non de CA déjà facturé : les quantités facturées et les avoirs ne remplacent pas les quantités du SO.
- L’onglet conserve le titre « Achats — SO liés » : quatre colonnes 2023–2026 et quatre lignes (montant installation, part installation, montant maintenance, part maintenance). Pourcentage de chaque département sur leur somme annuelle, tiret si total nul. 2026 borné au mois clôturé, sans extrapolation. Bouton Recalculer explicite, détails par SO et facture/compte conservés dans PostgreSQL, archives récupérables et absence de repli JSON. Aucun changement d’affectation, de clé ou des rapports existants. Ancienne analyse retirée et archivée, ancienne clé Gimi Type supprimée du programme.

- Comptes de résultat normal, LTM et extrapolé : sélection multiple des quatre départements, calcul de toutes les rubriques avec les clés enregistrées, ventilation mensuelle avant agrégation ou extrapolation. « Société entière » conserve le rapport global et les non-affectés ; le détail des règles et limites est documenté dans `docs/gimi-analytic-profit-loss.md`.

- Employer « clé de répartition » plutôt que « code analytique » dans l’interface de configuration concernée.
- Ordre des départements dans l’analyse : Incendie installation, Incendie maintenance, Intrusion, LED, puis Autres pour les comptes sans affectation valide.
- Une clé peut répartir un compte entre plusieurs départements. Vérifier le total de 100 % et conserver la somme de tous les départements égale au montant du compte.
- Les affectations et nouvelles clés sont de la configuration persistée ; ne pas rejouer une première affectation automatique au démarrage.
- Conserver les choix manuels existants. Une suggestion par intitulé ne remplace pas silencieusement une affectation validée.
- « Répartition des comptes » regroupe les comptes dans les rubriques et l’ordre du compte de résultat ; privilégier le préfixe le plus spécifique pour éviter les doubles affectations, notamment 603 par rapport à 60.
- « Répartition des comptes » affiche aussi 2025 réalisé et 2026 extrapolé, montants du compte entier avant ventilation, y compris pour les non-affectés et non-classés. Reprendre les écritures validées Odoo et l’extrapolation existante au mois clôturé, avec le signe du compte de résultat. Les montants sont consultatifs, jamais enregistrés dans les affectations ; un échec de lecture affiche « — », pas zéro.
- Employés : coût annuel salaire provenant de AR ; coût annuel voiture = AQ − AR. Conserver la source importée et les colonnes nécessaires à l’audit.
- Règles initiales demandées : techniciens et manager SAV en maintenance ; électriciens et technico-commerciaux en installation. Les autres fonctions ambiguës nécessitent une affectation explicite.
- Coût salaire actuel et coûts véhicules : totaux par département, pourcentages du total, détail des personnes et non-réparti.
- Coût salaire par mois 2025–2026 : exclure une personne avant son mois d’entrée. Convention actuelle : mois d’entrée entier, sans prorata journalier ; faire valider avant de changer cette convention. Signaler les dates d’entrée manquantes.
- Date de fin facultative et modifiable dans Répartition employés : vide = aucune limite. Mois de départ inclus en entier, exclusion dès le mois suivant (validé le 8 septembre 2026). Même présence pour salaire et véhicule mensuels. Trier les employés par fonction, puis nom et prénom.
- Clé système « Salaire » réservée aux comptes : répartir les montants comptables réels de chaque mois avec la même base salariale connue que le tableau mensuel, puis additionner les mois. Signaler les coûts manquants. Ne pas utiliser une moyenne annuelle de pourcentages. Sans base utilisable, tout reste non réparti ; ne jamais affecter cette clé à un employé (calcul circulaire).
- Les tableaux Coût salaire par mois et Coût véhicule par mois partagent le moteur de présence/répartition. La clé Salaire est calculée par le programme, avec un identifiant stable, sans réécriture des clés enregistrées à chaque démarrage.
- La clé système « Voiture » suit exactement la clé Salaire, mais utilise les pourcentages connus de Coût véhicule par mois (coût annuel voiture / 12 et mêmes règles de présence). Appliquer les pourcentages au montant comptable de chaque mois avant toute somme ou extrapolation. Sans base véhicule utilisable, laisser le montant non réparti. Réservée aux comptes, identifiant stable, aucune affectation existante remplacée automatiquement.
- La clé au nombre d’employés suit la même méthode partout ; dans le calcul mensuel, recalculer avec les personnes présentes ce mois-là. Ne pas introduire des méthodes incompatibles entre backend et frontend.
- Analyse de marge : trois blocs dans un tableau, CA, marchandises, marge, chacun avec cinq départements et un total. Comptes consultables en détail, historiques réalisés et dernière année extrapolée.
- Les clés actuelles s’appliquent actuellement aux trois années. Ne pas prétendre disposer d’un historique des clés ; une répartition versionnée par période serait une évolution à décider.
- « Calcul des pourcentages » est pour l’instant un emplacement à préciser. Ne pas inventer ses futurs calculs à partir de son titre.

## 12. Facturation et import des rendez-vous

- Préserver le libellé Facturation et la présentation mensuelle demandée.
- Les imports de calendrier doivent être explicites, via une action utilisateur, pas une synchronisation permanente ajoutée sans demande.
- Dédupliquer les événements par identité stable de source ; préserver les heures corrigées, les saisies manuelles et leurs rattachements.
- Ne pas réimporter les JSON locaux en écrasant les données partagées. Produire un bilan des ajouts, mises à jour et corrections conservées.
- Prévoir un export exploitable dans Excel/Google Sheets sans transmettre le fichier à un service externe non autorisé.

## 13. Présentation et expérience utilisateur

- Interface française, professionnelle, chaleureuse, cohérente avec Equinoxe : fond crème `#f7f1e8`, blanc, brun `#3b1f12`, accent doré `#f4b533`, bordures `#eadbc6`.
- Police principale Manrope avec fallback ; composants partagés, focus visible, erreurs intégrées, chargement et sauvegarde explicites. Aucun `alert()` natif.
- Préserver les pages existantes plutôt que changer leur esthétique à chaque ajout.
- Rapports financiers : milliers d’euros sans symbole euro dans chaque cellule, sans décimales ; préciser l’unité. Les écritures comptables peuvent conserver leur précision en euros et centimes pour l’audit.
- Pourcentages visibles sans bouton d’activation, plus discrets que les montants. Indiquer le dénominateur : CA total ou CA du département, notamment pour le taux de marge.
- Colonnes annuelles de largeur égale, chiffres et années alignés à droite, en-têtes lisibles. Alignement cohérent entre tableaux comparables.
- Les tableaux restent à la largeur du contenu de page ; ne pas réintroduire la réduction générale de largeur rejetée. Sur petit écran, contenir le défilement horizontal au tableau.
- Différencier rubriques sources, formules, totaux et détails. En configuration, privilégier des lignes propres, une poignée de déplacement claire et un ordre modifiable.
- Un drilldown doit montrer des comptes réels, avec numéros complets, intitulés et contributions signées, pas uniquement une explication textuelle.
- Masquer les comptes dont toutes les périodes affichées sont réellement nulles ; ne pas masquer une donnée absente comme si elle valait zéro.
- Quand un lien vers une écriture Odoo est proposé, libellé « Odoo », aligné à droite, sans secret et pointant sur la bonne écriture.
- Éviter les accroches décoratives qui ont été rejetées ; privilégier l’information utile.
