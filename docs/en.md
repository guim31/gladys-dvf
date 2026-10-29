# DVF: property sales

Brings into Gladys the **property sales published around your home** in France and the **median
prices per m²** of flats and houses, from **Demandes de valeurs foncières (DVF)**: the sales
recorded by the DGFiP (French tax administration), geolocated and published as open data by
Etalab. No account, no key.

> **It is information, not a valuation of your home.** DVF only publishes the price, the date,
> the type and the surface of a property sold: not its condition, floor or works. A median over
> few sales varies a lot. Integration not affiliated with the DGFiP nor Etalab.
>
> Tested on the real DVF files (Toulouse, Vigoulet-Auzil, Paris) and on the SDK's fake Gladys,
> not yet on a real Gladys instance: feedback welcome.

## What you get

- **A "Property sales" device** per followed zone, with:
  - the **median price per m²** of **flats** and **houses** over the **last 12 published
    months**, and over the **12 months before** (to compare year on year);
  - the **number of sales** of dwellings over both periods;
  - the **date of the latest sale published** and the **month the data reach**.
- A **scene trigger** "New property sales published", with their number, at every new DVF
  release.
- A **scene action** "Property sales summary": a sentence ready to send in a message ("Within
  1 km of Maison: 225 sales in the 12 months published up to December 2025; median prices: flats
  4,866 €/m².").
- A dashboard **widget**: the median prices and the **10 latest sales** of the zone (type,
  rooms, surface, price, date, distance from the house).
- A **"Check now"** button in the configuration, giving that summary for each zone.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from Gladys: the integration reads `files.data.gouv.fr` (the DVF files) and
  `geo.api.gouv.fr` (the commune of a location).
- A house **in France**, outside **Alsace-Moselle** (Bas-Rhin, Haut-Rhin, Moselle) and
  **Mayotte**, where DVF does not exist (own land register).
- For the default option, the **location of your house** in Gladys (Settings, Houses). The
  integration asks for it at installation (the "location" permission). It is only used to find
  the communes of the zone and the distance of the sales; it is neither stored nor written to the
  logs.

## Configuration

### Settings

| Setting                       | What it does                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Location                      | **My house in Gladys** (default), **All my houses in Gladys** or **A commune (INSEE code)**.                                             |
| House                         | Empty (default): every house of Gladys that has a location, one device each. A house: that one only.                                     |
| Zone around the house         | **300 m**, **500 m**, **1 km** (default), **2 km**, or **Its whole commune**. A circle may cover several communes: their sales are read. |
| INSEE code of the commune     | 5 characters, **not the postcode**: `31555` for Toulouse, `2A004` for Ajaccio.                                                           |
| Language of the feature names | Names of the features of a new device, language of the dates, of the summary and of the trigger variables. French by default.            |

Save, then open the **Discover** tab of the integration and add the device. The first download
takes from a few seconds (small commune) to a minute (Paris).

### Paris, Lyon, Marseille

DVF is published there **by district** (arrondissement). Around a house, the integration reads
the districts the zone touches; with "Its whole commune", the district of the house; with the
INSEE code of the city (`75056`, `69123`, `13055`), all its districts.

### Check it: "Check now"

The button reads the houses, the zone and the data again, then shows a summary per zone. A clear
error message shows at the top of the configuration when something is missing (no location,
unknown INSEE code, commune without DVF, service unreachable).

## Device

| Feature                                   | Value                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Flats, median €/m² (12 months)            | Median price per m² of the sales of a single flat, last 12 published months. |
| Houses, median €/m² (12 months)           | The same for houses.                                                         |
| Flats / Houses, median €/m² (year before) | The same medians over the 12 months before.                                  |
| Sales (12 months), Sales (year before)    | Number of sales of dwellings (flats and houses) over each period.            |
| Latest sale published                     | Date of the most recent sale of the zone.                                    |
| Data published up to                      | The month the current DVF release reaches ("December 2025").                 |

A median is only published from **3 sales**: below that, the feature stays without a value. The
"last 12 months" are those **of the release**, not of today: DVF comes months after the sales.

## Widget

Add the **Property sales** widget to the dashboard. Settings: the **zone** (empty: the first
one), and two switches to **hide the median prices** or **the latest sales**. It shows three
tiles (flats, houses, number of sales), then up to 10 sales, and the source with the name given
to the device in Gladys. No address is shown.

## Scene trigger and action

- **New property sales published**: fires when a new DVF release brings sales more recent than
  the latest known in the zone. Filter: the zone (empty: every zone). Variables: number of new
  sales, zone, release month, sales over 12 months, flat and house medians, summary sentence. The
  first release seen (or a changed zone) fires nothing: it is the baseline.
- **Property sales summary**: returns the summary sentence and the figures of a zone, for the
  next action (send a message, for example).

## Scene examples

- "When new sales are published around Maison, send me the summary on Telegram."
- "On the first of the month at 9 am, send me the summary of the sales of my commune."

## Data, licence and quotas

- **Source**: "Demandes de valeurs foncières géolocalisées", DGFiP and Etalab, under the Licence
  Ouverte 2.0, on `files.data.gouv.fr/geo-dvf`. Five years of sales, updated **twice a year**
  (around April and October), months after the sales.
- **Sales kept**: sales, off-plan sales and auctions including at least one flat or house.
  Exchanges, building plots and expropriations are left out. The price per m² only comes from the
  sales of a single dwelling (outbuildings included, no shop or office), outliers excluded (under 200 or over
  50,000 €/m²).
- **Downloads**: a small index page **once a day** to see whether a new release is out; the
  files (one per commune and year) **only** when it is, kept in `/data`. No quota is published
  for these services; the integration stays far below any reasonable one.
- **DVF reuse terms**: trying to **re-identify** people (sellers, buyers) is forbidden. The
  files hold no name; the integration neither keeps nor shows an address, only the type, the
  surface, the price, the date and a distance.

## Troubleshooting

| Symptom                                     | What to do                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| "No house of Gladys has a location"         | Place the house on the map in Settings → Houses, or choose "A commune (INSEE code)".        |
| "no DVF data in Alsace-Moselle and Mayotte" | DVF does not exist in these departments: the integration cannot show anything there.        |
| "files.data.gouv.fr cannot be reached"      | Check the Internet access of Gladys. The integration retries every hour and keeps its data. |
| A median stays empty                        | Fewer than 3 sales of that type in the zone: make it larger (2 km, or the whole commune).   |
| The sales are months old                    | Normal: DVF is published twice a year, several months late.                                 |

Detailed logs: environment variable `LOG_LEVEL=debug`.

## Limits

- The data are **4 to 10 months behind** the sales, and a sale may only appear in a later
  release.
- A 2 km zone reads the communes found at the centre and at 12 points of the circle: a commune
  touched only between two points may be missed.
- The sales without coordinates in DVF (rare) only count with "Its whole commune" or an INSEE
  code.
- The feature names are frozen when the device is created.
