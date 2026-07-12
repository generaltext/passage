# Passage

A quiet, permanent, plaintext record of everywhere you and the people you travel with have been: **flights**, **places**, and **stays**, painted onto a map and totted up into stats. It's a *log, not a live tracker* · live flight status is the airline's job for three hours; the history is the thing worth keeping for decades.

No account, no ads, no lock-in. Everything Passage knows lives in a handful of plain files in your workspace that you own, can read by hand, hand to your AI, and keep long after any app is gone. A child's complete flight log from birth is a keepsake no cloud app survives long enough to deliver.

## What it does

- **The map is the app.** A full-bleed world you can pan and zoom. Countries and US states you've set foot in are painted in; every trip draws as an arc; stays drop pins. Zoom into a country to see its states; click any place to see the trips and stays that touch it.
- **Log any kind of trip.** A flight, a train, a drive, a ferry, a bus. Flights use IATA codes (`JFK → LIS`); everything else uses city names. Airports, cities, countries, distances, and the map are all computed offline from bundled tables · you just type.
- **Log the stays too** · where you slept, with a lodging name and dates as fuzzy as your memory (`2019`, `summer 2019`, or a real date).
- **Stats & year-in-review** · trips, miles, countries, airports, how you travelled, longest trip, most-travelled route, first and latest · per person and for the whole family.
- **Per-person layers.** Everyone who travels with you is a person with their own colour, so "everywhere Mia has been before she was five" is one click.

## The three models it writes

All under your app data folder, in `v1/`, as plain files you own:

- **`v1/people.jsonl`** · one person per line: `{"id":"mia","name":"Mia","color":"#22c07a","born":"2021-03-02"}`
- **`v1/trips.jsonl`** · a movement from one place to another, of any kind: `{"type":"flight","date":"2026-06-14","from":"JFK","to":"LIS","number":"TP208","who":["travis","mia"]}` or `{"type":"drive","from":"Boston, MA","to":"Stowe, VT","who":["travis"]}`
- **`v1/stays.jsonl`** · where you stayed: `{"place":"Lisbon, PT","name":"apartment in Alfama","when":"2026-06","who":["travis","mia"]}`
- **`v1/places/<person>.txt`** · a hand-editable "been" list, one code per line (`PT`, `US-CA`, `city:Lisbon,PT`). Edit it in ten seconds in any text editor; Passage reads it back and suggests additions from your log.

Because it's all plaintext, you can back-fill from a TripIt or Flighty export by pasting it in, or just ask your General Text AI to *"scan my inbox for flight confirmations and append them to trips.jsonl."*
