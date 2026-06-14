// GTFS（General Transit Feed Specification）の最小パーサ。
// バス運賃計算に必要なテーブルだけを読み込む。
//   stops.txt           … 停留所（緯度経度・zone_id）
//   fare_attributes.txt … 運賃額（price）
//   fare_rules.txt      … 運賃ルール（origin/destination zone → fare_id）
//   routes.txt          … 路線名（表示用）
//
// zip ファイルでもサンプル CSV でも、同じ「{ ファイル名: CSVテキスト }」形式に
// 変換してから parseGtfsTables() に渡す。

import JSZip from 'jszip';

// --- CSV パーサ（ダブルクォート・カンマ・改行・BOM に対応） --------------------
export function parseCsv(text) {
  if (!text) return [];
  // BOM 除去
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // エスケープされた "
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // CRLF / CR を無視（次の \n か行末で確定）
    } else {
      field += c;
    }
  }
  // 末尾の行
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''))
    .map((r) => {
      const obj = {};
      header.forEach((key, idx) => { obj[key] = (r[idx] ?? '').trim(); });
      return obj;
    });
}

// --- zip → { ファイル名: CSVテキスト } -----------------------------------------
export async function readGtfsZip(fileOrBuffer) {
  const zip = await JSZip.loadAsync(fileOrBuffer);
  const tables = {};
  const wanted = ['stops', 'fare_attributes', 'fare_rules', 'routes', 'agency'];
  await Promise.all(
    Object.keys(zip.files).map(async (path) => {
      const name = path.split('/').pop().replace(/\.txt$/i, '');
      if (wanted.includes(name) && !zip.files[path].dir) {
        tables[`${name}.txt`] = await zip.files[path].async('string');
      }
    })
  );
  return tables;
}

// --- 共通パイプライン：{ ファイル名: CSVテキスト } → 構造化データ -------------
export function parseGtfsTables(tables) {
  const get = (name) => parseCsv(tables[name] || '');

  const stopsRaw = get('stops.txt');
  const fareAttrsRaw = get('fare_attributes.txt');
  const fareRulesRaw = get('fare_rules.txt');
  const routesRaw = get('routes.txt');
  const agencyRaw = get('agency.txt');

  // 停留所（親停留所 location_type=1 や乗り場は除外し、実際に乗降する停留所のみ）
  const stops = stopsRaw
    .filter((s) => s.stop_id && (!s.location_type || s.location_type === '0'))
    .map((s) => ({
      id: s.stop_id,
      name: s.stop_name || s.stop_id,
      lat: parseFloat(s.stop_lat),
      lon: parseFloat(s.stop_lon),
      zone: s.zone_id || '',
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));

  const fareAttributes = {};
  for (const f of fareAttrsRaw) {
    if (!f.fare_id) continue;
    fareAttributes[f.fare_id] = {
      id: f.fare_id,
      price: parseFloat(f.price),
      currency: f.currency_type || 'JPY',
    };
  }

  const fareRules = fareRulesRaw.map((r) => ({
    fareId: r.fare_id,
    routeId: r.route_id || '',
    originId: r.origin_id || '',
    destinationId: r.destination_id || '',
    containsId: r.contains_id || '',
  }));

  const routes = {};
  for (const r of routesRaw) {
    routes[r.route_id] = r.route_short_name || r.route_long_name || r.route_id;
  }

  const agencyName = agencyRaw[0]?.agency_name || '';

  return { stops, fareAttributes, fareRules, routes, agencyName };
}
