// 運賃計算ロジック。
// GTFS の fare_rules は停留所の zone_id（区間）を使って運賃を決める：
//   origin_id（乗車区間） × destination_id（降車区間） → fare_id → price
// 日本の区間制バス運賃はこのモデルで表現できる。

// --- 距離（ハバーサイン公式、メートル） ---------------------------------------
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 徒歩時間（分）。不動産表示などで使う 80m/分 を採用。
export function walkMinutes(meters) {
  return Math.max(1, Math.round(meters / 80));
}

// --- 運賃検索：乗車停留所 origin → 降車停留所 dest の運賃（円） ----------------
// 見つからなければ null。複数該当する場合は最安を返す。
export function lookupFare(origin, dest, gtfs) {
  const { fareRules, fareAttributes } = gtfs;
  let best = null;

  for (const rule of fareRules) {
    // origin / destination が指定されている場合は zone_id と一致が条件。
    // 空欄（フラット運賃）の場合は無条件で一致とみなす。
    if (rule.originId && rule.originId !== origin.zone) continue;
    if (rule.destinationId && rule.destinationId !== dest.zone) continue;

    const attr = fareAttributes[rule.fareId];
    if (!attr || !Number.isFinite(attr.price)) continue;

    if (best === null || attr.price < best.price) {
      best = { price: attr.price, fareId: rule.fareId, rule };
    }
  }

  // fare_rules が一切無い（fare_attributes だけの全線均一運賃）場合のフォールバック
  if (best === null && fareRules.length === 0) {
    const prices = Object.values(fareAttributes)
      .map((a) => a.price)
      .filter((p) => Number.isFinite(p));
    if (prices.length) best = { price: Math.min(...prices), fareId: null, rule: null };
  }

  return best ? best.price : null;
}

// --- 近隣の停留所（徒歩圏内）を距離順に返す ------------------------------------
export function nearbyStops(target, stops, radiusM) {
  return stops
    .map((s) => ({ stop: s, dist: distanceMeters(target, s) }))
    .filter((x) => x.dist <= radiusM)
    .sort((a, b) => a.dist - b.dist);
}

// --- メイン：歩けば安くなるかを判定する ----------------------------------------
// 乗車停留所 boardStop と降車停留所 alightStop を基準に、
// 徒歩 radiusM 圏内の代替停留所まで含めて全組み合わせの運賃を比較し、
// 「最安の乗り方」と「基準との差額」「必要な徒歩」を返す。
export function findCheaperOptions(boardStop, alightStop, gtfs, radiusM) {
  const baseFare = lookupFare(boardStop, alightStop, gtfs);

  const boardCandidates = nearbyStops(boardStop, gtfs.stops, radiusM);
  const alightCandidates = nearbyStops(alightStop, gtfs.stops, radiusM);

  const options = [];
  for (const b of boardCandidates) {
    for (const a of alightCandidates) {
      const fare = lookupFare(b.stop, a.stop, gtfs);
      if (fare === null) continue;
      const walkM = b.dist + a.dist;
      options.push({
        boardStop: b.stop,
        alightStop: a.stop,
        boardWalkM: Math.round(b.dist),
        alightWalkM: Math.round(a.dist),
        totalWalkM: Math.round(walkM),
        fare,
        savings: baseFare === null ? null : baseFare - fare,
      });
    }
  }

  // 安い順 → 同額なら歩く距離が短い順
  options.sort((x, y) => x.fare - y.fare || x.totalWalkM - y.totalWalkM);

  const cheapest = options.find((o) => o.savings !== null && o.savings > 0) || null;

  return { baseFare, cheapest, options };
}
