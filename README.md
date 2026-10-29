# DVF property sales for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
**property sales published around your home in France** and the **median prices per m²** of
flats and houses, from the open data **Demandes de valeurs foncières (DVF)** of the DGFiP,
geolocated by Etalab. No account, no key.

Documentation for users: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

Not affiliated with the DGFiP nor Etalab. Tested on the real DVF files and the SDK's fake Gladys,
not yet on a real Gladys instance: feedback welcome.

## Features

- One device per zone: around a house of Gladys (100 m, 200 m, 300 m, 500 m, 1 km, 2 km or its whole commune),
  every located house, or a commune by its INSEE code.
- Features: median price per m² of flats and houses over the last 12 published months and the 12
  months before, number of sales over both, date of the latest sale, month the data reach.
- Scene trigger `new_sales`: a new DVF release brings sales in the zone, with their count.
- Scene action `summary`: one sentence on a zone (sales, median prices), to send in a message.
- Dashboard widget `sales`: median prices (with the number of sales behind each) and the 1 to 10
  latest sales (number and street when DVF gives them, type, surface, price, date, distance);
  each block, and the addresses, can be hidden.
- Four languages (English, French, German, Spanish).

## Requirements

- Gladys Assistant **5.3.0** or later (`countries` and `keywords` of the manifest, `houses`
  select of the configuration).
- Internet access from Gladys to `files.data.gouv.fr` and `geo.api.gouv.fr`.
- A home in France, outside Alsace-Moselle and Mayotte (no DVF there).

## Installation

In Gladys: **Integrations → Install from GitHub**, then paste
`https://github.com/guim31/gladys-dvf`. Open the integration's configuration, choose the zone
(1 km around your house in Gladys by default), save, then create the device in the **Discover**
tab. Add the **Property sales** widget to a dashboard if you like.

## How it works

- Once a day, the integration reads the index of
  [`files.data.gouv.fr/geo-dvf`](https://files.data.gouv.fr/geo-dvf/) to find the latest release
  (`2025-12`: data up to December 2025). Only when a new release is out does it download the CSV
  files of the communes of the zone, one per commune and year, keeping a compact form of the
  residential sales in `/data` (date, type, surface, rooms, price, coordinates, number and street).
- The communes of a zone come from [`geo.api.gouv.fr`](https://geo.api.gouv.fr): the commune at
  the house and at 12 points of the circle. Paris, Lyon and Marseille are read by district.
- Sales kept: sales, off-plan sales and auctions including a flat or a house. The price per m²
  comes from one-dwelling sales only, between 200 and 50,000 €/m²; a median needs 3 sales.
- The devices are published with `should_poll: false`: the container republishes the states on
  its own hourly timer (unchanged values every 12 hours).

## Limitations

- DVF is published twice a year, 4 to 10 months after the sales.
- No DVF in Alsace-Moselle (Bas-Rhin, Haut-Rhin, Moselle) and Mayotte.
- The DVF reuse terms forbid re-identifying people: the integration shows a sale's number and
  street as Etalab publishes them, never a name, and anything built on it must not try to find
  who sold or bought.
- Gladys shows 10 rows at most in a widget list: the widget cannot show more sales.
- A median is not a valuation: DVF knows nothing of the condition, floor or works of a property.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the fake Gladys of the SDK
(`@gladysassistant/integration-sdk/testing`) and fake `files.data.gouv.fr` and `geo.api.gouv.fr`
serving [`test/fixtures/dvf`](test/fixtures/dvf): real DVF files of Toulouse (sales within 500 m
of the place du Capitole) and Vigoulet-Auzil, with the street, parcel and lot columns emptied and
the coordinates rounded. They never touch the network. `test/gladys-rules.test.js` checks every
discovered device against the category/type table of the Gladys core.

## Credits

- [DGFiP](https://www.impots.gouv.fr) for the DVF data and
  [Etalab](https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/) for
  their geolocated version (Licence Ouverte 2.0).
- [geo.api.gouv.fr](https://geo.api.gouv.fr) (Etalab) for the communes.
- No Home Assistant integration for DVF was found to build on.

## License

[Apache-2.0](LICENSE).
