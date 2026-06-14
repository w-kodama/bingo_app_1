// 動作確認用のサンプル GTFS（区間制運賃）。
// 1路線「サンプル線」に停留所を約300m間隔で並べ、2停留所ごとに区間（zone）を割り当てる。
// 区間が離れるほど運賃が上がるため、「1つ先まで歩くと区間をまたいで安くなる」例を再現できる。
//
//   停留所:  S1  S2 | S3  S4 | S5  S6 | S7  S8
//   区間:    Z1  Z1 | Z2  Z2 | Z3  Z3 | Z4  Z4
//   運賃: 同一区間150円 / 1区間200円 / 2区間270円 / 3区間340円

const STOP_NAMES = [
  '中央駅前', '本町', '市役所前', '南公園', '桜ヶ丘', '緑町', '工業団地', '北車庫前',
];
const ZONES = ['Z1', 'Z1', 'Z2', 'Z2', 'Z3', 'Z3', 'Z4', 'Z4'];

const BASE_LAT = 35.6800;
const BASE_LON = 139.7000;
const STEP_LAT = 0.0027; // ≒ 300m

const FARE_BY_DIFF = { 0: 150, 1: 200, 2: 270, 3: 340 };
const ZONE_INDEX = { Z1: 0, Z2: 1, Z3: 2, Z4: 3 };

function buildStops() {
  let csv = 'stop_id,stop_name,stop_lat,stop_lon,zone_id\n';
  STOP_NAMES.forEach((name, i) => {
    const lat = (BASE_LAT + STEP_LAT * i).toFixed(6);
    const lon = BASE_LON.toFixed(6);
    csv += `S${i + 1},${name},${lat},${lon},${ZONES[i]}\n`;
  });
  return csv;
}

function buildFares() {
  // fare_attributes：差額（区間数）ごとの運賃
  let attrs = 'fare_id,price,currency_type,payment_method,transfers\n';
  for (const [diff, price] of Object.entries(FARE_BY_DIFF)) {
    attrs += `fare_d${diff},${price},JPY,0,0\n`;
  }

  // fare_rules：全区間ペア（origin × destination）
  let rules = 'fare_id,route_id,origin_id,destination_id\n';
  const zones = ['Z1', 'Z2', 'Z3', 'Z4'];
  for (const o of zones) {
    for (const d of zones) {
      const diff = Math.abs(ZONE_INDEX[o] - ZONE_INDEX[d]);
      rules += `fare_d${diff},R1,${o},${d}\n`;
    }
  }
  return { attrs, rules };
}

export function sampleGtfsTables() {
  const { attrs, rules } = buildFares();
  return {
    'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\nA1,サンプル交通(デモ),https://example.com,Asia/Tokyo\n',
    'routes.txt': 'route_id,route_short_name,route_long_name,route_type\nR1,サンプル線,中央駅前〜北車庫前,3\n',
    'stops.txt': buildStops(),
    'fare_attributes.txt': attrs,
    'fare_rules.txt': rules,
  };
}
