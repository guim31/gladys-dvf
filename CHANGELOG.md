# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.1.0] - 2026-10-29

### Added

- 100 m and 200 m zones around the house, for dense city centres; next to each median of the
  widget, the number of sales it rests on (still none under 3 sales).
- The number and street of the sales, when the DVF file gives them, in the widget and at the end
  of the summary sentence of the scene action and trigger (with the latest sale of the zone);
  a widget setting hides them. The data saved by 1.0 are downloaded once again to get them.
- A widget setting for the number of sales shown: 1, 3, 5 or 10 (10 by default, the most Gladys
  shows in a widget list).

## [1.0.0] - 2026-10-29

### Added

- Property sales published around your home in France, from the open DVF data (DGFiP,
  geolocated by Etalab): one device per zone, around a house of Gladys (300 m to 2 km, or its
  whole commune), every located house, or a commune by its INSEE code.
- Median price per m² of flats and houses over the last 12 published months and the 12 months
  before, number of sales, date of the latest sale, month the data reach.
- Scene trigger "New property sales published", with their count, at every DVF release.
- Scene action "Property sales summary": one sentence to send in a message.
- Dashboard widget: median prices and the 10 latest sales (type, rooms, surface, price, date,
  distance), each block can be hidden.
- "Check now" action, clear status messages (no location, unknown commune, Alsace-Moselle and
  Mayotte without DVF, service unreachable), four languages (en, fr, de, es).

[Unreleased]: https://github.com/guim31/gladys-dvf/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/guim31/gladys-dvf/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/guim31/gladys-dvf/releases/tag/v1.0.0
