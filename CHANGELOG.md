# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

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
