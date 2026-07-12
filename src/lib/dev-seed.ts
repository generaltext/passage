// dev-seed.ts — sample data for the "Try it live" demo (and standalone dev when
// empty). A realistic multi-person family history with a mix of trip types +
// stays so the map paints, arcs of every kind show, and stats look alive. Seeds
// ONLY when the workspace is empty, so it never clobbers a real user's files.

import { PATHS } from '~/lib/types'

const TRIPS = `
{"type":"flight","date":"2015-09-03","from":"SFO","to":"JFK","number":"UA28","carrier":"UA","who":["travis"]}
{"type":"flight","date":"2016-05-20","from":"JFK","to":"LHR","number":"BA112","carrier":"BA","who":["travis","ana"]}
{"type":"train","date":"2016-05-24","from":"London, GB","to":"Paris, FR","carrier":"Eurostar","who":["travis","ana"]}
{"type":"flight","date":"2016-05-31","from":"CDG","to":"JFK","number":"AF8","carrier":"AF","who":["travis","ana"]}
{"type":"flight","date":"2017-07-11","from":"JFK","to":"MAD","number":"IB6252","carrier":"IB","who":["travis","ana"]}
{"type":"flight","date":"2019-06-14","from":"JFK","to":"LIS","number":"TP208","carrier":"TP","who":["travis","ana"]}
{"type":"drive","date":"2019-07-02","from":"Boston, MA","to":"Stowe, VT","fromLat":42.358,"fromLon":-71.06,"toLat":44.465,"toLon":-72.687,"who":["travis","ana"],"note":"summer road trip"}
{"type":"drive","date":"2019-07-05","from":"Stowe, VT","to":"Portland, ME","fromLat":44.465,"fromLon":-72.687,"toLat":43.661,"toLon":-70.255,"who":["travis","ana"]}
{"type":"flight","date":"2022-10-02","from":"BOS","to":"SEA","number":"AS23","carrier":"AS","who":["travis"]}
{"type":"flight","date":"2023-04-18","from":"JFK","to":"NRT","number":"JL5","carrier":"JL","who":["travis"]}
{"type":"train","date":"2023-04-22","from":"Tokyo, JP","to":"Kyoto, JP","carrier":"Shinkansen","who":["travis"]}
{"type":"flight","date":"2023-05-01","from":"NRT","to":"JFK","number":"JL4","carrier":"JL","who":["travis"]}
{"type":"flight","date":"2024-12-20","from":"JFK","to":"GRU","number":"LA8181","carrier":"LA","who":["travis","ana"]}
{"type":"flight","date":"2026-06-14","from":"JFK","to":"LIS","number":"TP208","carrier":"TP","who":["travis","ana","mia"]}
`.trim()

const STAYS = `
{"place":"Paris, FR","name":"Hôtel du Marais","when":"2016-05","who":["travis","ana"]}
{"place":"Stowe, VT","name":"lakeside cabin","when":"summer 2019","lat":44.465,"lon":-72.687,"who":["travis","ana"]}
{"place":"Kyoto, JP","name":"ryokan near Gion","when":"2023-04","who":["travis"]}
{"place":"Lisbon, PT","name":"apartment in Alfama","when":"2026-06","who":["travis","ana","mia"]}
`.trim()

// Leave a few log-implied countries OUT of the hand lists so the "suggested from
// your log" flow has something to accept (Travis: no JP/BR; Ana: no ES; Mia bare).
const PLACES: Record<string, string> = {
  travis: `# one place code per line — edit by hand any time
US
US-CA
US-NY
US-VT
US-ME
GB
FR
PT
IT
MX
CA`,
  ana: `US
GB
FR
PT
BR`,
  mia: `US`,
}

export async function seedDemo(): Promise<void> {
  const gt = window.gt
  const people = [
    { id: 'travis', name: 'Travis', color: '#5b6cff' },
    { id: 'ana', name: 'Ana', color: '#ff5a4d' },
    { id: 'mia', name: 'Mia', color: '#22c07a', born: '2021-03-02' },
  ]
  await gt.writeFile(PATHS.people, people.map((p) => JSON.stringify(p)).join('\n') + '\n')
  await gt.writeFile(PATHS.trips, TRIPS + '\n')
  await gt.writeFile(PATHS.stays, STAYS + '\n')
  for (const [id, text] of Object.entries(PLACES)) {
    await gt.writeFile(PATHS.places(id), text.replace(/\n*$/, '') + '\n')
  }
}
