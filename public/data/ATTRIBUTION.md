# Map data attribution

- `geonames-cities.tsv` is a trimmed city-name and coordinate extract from GeoNames `cities15000.zip` and `countryInfo.txt`. GeoNames data is available under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Source: [GeoNames downloads](https://www.geonames.org/dumps/).
- `world-countries-110m.json` is [world-atlas 2.0.2](https://github.com/topojson/world-atlas)'s TopoJSON redistribution of [Natural Earth 1:110m country boundaries](https://www.naturalearthdata.com/). Natural Earth map data is public domain; the world-atlas code is MIT licensed.
- `../../lib/us-states-10m.json` is the [US Atlas 3.0.1](https://github.com/topojson/us-atlas) TopoJSON redistribution of U.S. Census Bureau state boundaries. US Atlas is ISC licensed; Census boundary data is public domain.

The app bundles these files so city search, GPS-to-city matching, and the globe run without a third-party map or geocoding request. The city list is a practical gazetteer, not a complete list of every settlement.
