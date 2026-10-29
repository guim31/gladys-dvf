# DVF : ventes immobilières

Amène dans Gladys les **ventes immobilières publiées autour de chez vous** et les **prix médians
au m²** des appartements et des maisons, d'après **Demandes de valeurs foncières (DVF)** :
les ventes enregistrées par la DGFiP (impôts), géolocalisées et diffusées en données ouvertes
par Etalab. Sans compte ni clé.

> **C'est une information, pas une estimation de votre bien.** DVF ne publie que le prix, la
> date, le type et la surface d'un bien vendu : pas son état, son étage ni ses travaux. Une
> médiane sur peu de ventes varie beaucoup. Intégration non affiliée à la DGFiP ni à Etalab.
>
> Testée sur les vrais fichiers DVF (Toulouse, Vigoulet-Auzil, Paris) et sur le faux Gladys du
> SDK, pas encore sur une instance Gladys réelle : vos retours sont bienvenus.

## Ce que vous obtenez

- **Un appareil « Ventes immobilières »** par zone suivie, avec :
  - le **prix médian au m²** des **appartements** et des **maisons** sur les **12 derniers mois
    publiés**, et sur les **12 mois d'avant** (pour comparer d'une année sur l'autre) ;
  - le **nombre de ventes** de logements sur ces deux périodes ;
  - la **date de la dernière vente publiée** et le **mois jusqu'où vont les données**.
- Un **déclencheur de scène** « Nouvelles ventes immobilières publiées », avec leur nombre, à
  chaque nouvelle publication DVF.
- Une **action de scène** « Résumé des ventes immobilières » : une phrase prête à envoyer par
  message (« À 1 km de Maison : 225 ventes sur les 12 mois publiés jusqu'à décembre 2025 ;
  prix médians : appartements 4 866 €/m². »).
- Un **widget** de tableau de bord : les prix médians et les **10 dernières ventes** de la zone
  (type, pièces, surface, prix, date, distance de la maison).
- Un bouton **« Vérifier maintenant »** dans la configuration, qui donne ce résumé pour chaque
  zone.

## Prérequis

- Gladys Assistant **5.3.0** ou plus récent.
- Un accès à Internet depuis Gladys : l'intégration lit `files.data.gouv.fr` (les fichiers DVF)
  et `geo.api.gouv.fr` (la commune d'une position).
- Une maison **en France**, hors **Alsace-Moselle** (Bas-Rhin, Haut-Rhin, Moselle) et
  **Mayotte**, où DVF n'existe pas (livre foncier propre).
- Pour l'option par défaut, la **position de votre maison** dans Gladys (Paramètres, Maisons).
  L'intégration la demande à l'installation (permission « localisation »). Elle ne sert qu'à
  trouver les communes de la zone et la distance des ventes ; elle n'est ni enregistrée ni
  écrite dans les journaux.

## Configuration

### Réglages

| Réglage                            | Ce qu'il fait                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Position                           | **Ma maison dans Gladys** (par défaut), **Toutes mes maisons dans Gladys** ou **Une commune (code INSEE)**.                                         |
| Maison                             | Vide (par défaut) : toutes les maisons de Gladys qui ont une position, un appareil chacune. Une maison : celle-là seulement.                        |
| Zone autour de la maison           | **300 m**, **500 m**, **1 km** (par défaut), **2 km**, ou **Toute sa commune**. Un cercle peut couvrir plusieurs communes : leurs ventes sont lues. |
| Code INSEE de la commune           | 5 caractères, **ce n'est pas le code postal** : `31555` pour Toulouse, `2A004` pour Ajaccio.                                                        |
| Langue des noms de fonctionnalités | Noms des fonctionnalités du nouvel appareil, langue des dates, du résumé et des variables du déclencheur. Français par défaut.                      |

Enregistrez, puis ouvrez l'onglet **Découverte** de l'intégration et ajoutez l'appareil. Le
premier téléchargement prend de quelques secondes (petite commune) à une minute (Paris).

### Paris, Lyon, Marseille

DVF y est publié **par arrondissement**. Autour d'une maison, l'intégration lit les
arrondissements que touche la zone ; avec « Toute sa commune », l'arrondissement de la maison ;
avec le code INSEE de la ville (`75056`, `69123`, `13055`), tous ses arrondissements.

### Vérifier : « Vérifier maintenant »

Le bouton relit les maisons, la zone et les données, puis affiche un résumé par zone. Un message
d'erreur clair s'affiche en haut de la configuration si quelque chose manque (pas de position,
code INSEE inconnu, commune sans DVF, service injoignable).

## Appareil

| Fonctionnalité                                   | Valeur                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Appartements, €/m² médian (12 mois)              | Prix médian au m² des ventes d'un seul appartement, 12 derniers mois publiés. |
| Maisons, €/m² médian (12 mois)                   | La même chose pour les maisons.                                               |
| Appartements / Maisons, €/m² médian (an d'avant) | Les mêmes médianes sur les 12 mois précédents.                                |
| Ventes (12 mois), Ventes (an d'avant)            | Nombre de ventes de logements (appartements et maisons) sur chaque période.   |
| Dernière vente publiée                           | Date de la vente la plus récente de la zone.                                  |
| Données publiées jusqu'à                         | Le mois jusqu'où va la publication DVF en cours (« décembre 2025 »).          |

Une médiane n'est publiée qu'à partir de **3 ventes** : en dessous, la fonctionnalité reste sans
valeur. Les « 12 derniers mois » sont ceux **de la publication**, pas de la date du jour : DVF
arrive des mois après les ventes.

## Widget

Ajoutez le widget **Ventes immobilières** au tableau de bord. Réglages : la **zone** (vide : la
première), et deux interrupteurs pour **masquer les prix médians** ou **les dernières ventes**.
Il montre trois tuiles (appartements, maisons, nombre de ventes), puis jusqu'à 10 ventes, et la
source avec le nom donné à l'appareil dans Gladys. Aucune adresse n'y figure.

## Déclencheur et action de scène

- **Nouvelles ventes immobilières publiées** : se déclenche quand une nouvelle publication DVF
  apporte des ventes plus récentes que la dernière connue de la zone. Filtre : la zone (vide :
  toutes). Variables : nombre de nouvelles ventes, zone, mois de publication, ventes sur 12 mois,
  médianes appartements et maisons, phrase de résumé. La première publication vue (ou une zone
  modifiée) ne déclenche rien : elle sert de référence.
- **Résumé des ventes immobilières** : rend la phrase de résumé et les chiffres d'une zone, à
  reprendre dans l'action suivante (envoyer un message, par exemple).

## Exemples de scènes

- « Quand de nouvelles ventes sont publiées autour de Maison, m'envoyer le résumé sur
  Telegram. »
- « Le premier du mois, à 9 h, m'envoyer le résumé des ventes de ma commune. »

## Données, licence et quotas

- **Source** : « Demandes de valeurs foncières géolocalisées », DGFiP et Etalab, sous Licence
  Ouverte 2.0, sur `files.data.gouv.fr/geo-dvf`. Cinq ans de ventes, mises à jour **deux fois par
  an** (avril et octobre environ), des mois après les ventes.
- **Ventes retenues** : ventes, ventes en l'état futur d'achèvement et adjudications comprenant
  au moins un appartement ou une maison. Échanges, terrains à bâtir et expropriations sont
  écartés. Le prix au m² ne vient que des ventes d'un seul logement (dépendances comprises),
  hors prix aberrants (moins de 200 ou plus de 50 000 €/m²).
- **Téléchargements** : une petite page d'index **une fois par jour** pour voir si une nouvelle
  publication est sortie ; les fichiers (un par commune et par an) **seulement** quand elle sort,
  gardés dans `/data`. Aucun quota n'est publié pour ces services ; l'intégration en reste très
  loin.
- **Conditions de réutilisation de DVF** : il est interdit de chercher à **réidentifier** les
  personnes (vendeurs, acheteurs). Les fichiers ne contiennent aucun nom ; l'intégration ne garde
  ni n'affiche d'adresse, seulement le type, la surface, le prix, la date et une distance.

## Dépannage

| Symptôme                                      | Que faire                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| « Aucune maison de Gladys n'a de position »   | Placez la maison sur la carte dans Paramètres → Maisons, ou choisissez « Une commune (code INSEE) ».  |
| « pas de DVF en Alsace-Moselle ni à Mayotte » | DVF n'existe pas dans ces départements : l'intégration ne peut rien y afficher.                       |
| « files.data.gouv.fr est injoignable »        | Vérifiez l'accès à Internet de Gladys. L'intégration réessaie toutes les heures et garde ses données. |
| Une médiane reste vide                        | Moins de 3 ventes de ce type dans la zone : agrandissez-la (2 km, ou toute la commune).               |
| Les ventes datent de plusieurs mois           | C'est normal : DVF est publié deux fois par an, avec plusieurs mois de retard.                        |

Journaux détaillés : variable d'environnement `LOG_LEVEL=debug`.

## Limites

- Les données ont **4 à 10 mois de retard** sur les ventes, et une vente peut apparaître dans
  une publication plus tardive.
- Une zone de 2 km lit les communes trouvées au centre et en 12 points du cercle : une commune
  touchée seulement entre deux points peut manquer.
- Les ventes sans coordonnées dans DVF (rares) ne comptent que dans le mode « Toute sa commune »
  ou par code INSEE.
- Les noms des fonctionnalités sont figés à la création de l'appareil.
