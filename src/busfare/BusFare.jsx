import { useEffect, useMemo, useState } from 'react';
import { readGtfsZip, parseGtfsTables } from './gtfs';
import { sampleGtfsTables } from './sampleGtfs';
import { findCheaperOptions, walkMinutes } from './fare';
import './busfare.css';

// 停留所に一意な表示ラベルを付ける（同名停留所は id で区別）
function buildStopLabels(stops) {
  const nameCount = {};
  for (const s of stops) nameCount[s.name] = (nameCount[s.name] || 0) + 1;
  const labelToStop = {};
  const labelOf = {};
  for (const s of stops) {
    const label = nameCount[s.name] > 1 ? `${s.name}（${s.id}）` : s.name;
    labelToStop[label] = s;
    labelOf[s.id] = label;
  }
  return { labelToStop, labelOf };
}

// 停留所を入力／選択するコンボボックス。
// モジュールスコープに置くことで、再レンダー中に入力フォーカスが外れるのを防ぐ。
function StopPicker({ label, value, onPick, listId, labelOf, labelToStop, sortedStops }) {
  const [text, setText] = useState(value ? labelOf[value] || '' : '');
  // 外部から value が変わったとき（ファイル読込でのリセット等）に表示を同期する。
  // useEffect ではなくレンダー中の前回値比較で更新する（React 推奨パターン）。
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value ? labelOf[value] || '' : '');
  }
  return (
    <label className="bf-field">
      <span>{label}</span>
      <input
        type="text"
        list={listId}
        value={text}
        placeholder="停留所名を入力 / 選択"
        onChange={(ev) => {
          const v = ev.target.value;
          setText(v);
          const stop = labelToStop[v];
          onPick(stop ? stop.id : '');
        }}
      />
      <datalist id={listId}>
        {sortedStops.map((s) => <option key={s.id} value={labelOf[s.id]} />)}
      </datalist>
    </label>
  );
}

export default function BusFare() {
  const [gtfs, setGtfs] = useState(null);
  const [sourceName, setSourceName] = useState('');
  const [boardId, setBoardId] = useState('');
  const [alightId, setAlightId] = useState('');
  const [radius, setRadius] = useState(400);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 初期表示でサンプルデータを読み込む
  useEffect(() => {
    setGtfs(parseGtfsTables(sampleGtfsTables()));
    setSourceName('サンプル交通（デモデータ）');
  }, []);

  const { labelToStop, labelOf } = useMemo(
    () => (gtfs ? buildStopLabels(gtfs.stops) : { labelToStop: {}, labelOf: {} }),
    [gtfs]
  );
  const sortedStops = useMemo(
    () => (gtfs ? [...gtfs.stops].sort((a, b) => a.name.localeCompare(b.name, 'ja')) : []),
    [gtfs]
  );

  const boardStop = gtfs?.stops.find((s) => s.id === boardId) || null;
  const alightStop = gtfs?.stops.find((s) => s.id === alightId) || null;

  const result = useMemo(() => {
    if (!gtfs || !boardStop || !alightStop || boardStop.id === alightStop.id) return null;
    return findCheaperOptions(boardStop, alightStop, gtfs, radius);
  }, [gtfs, boardStop, alightStop, radius]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const tables = await readGtfsZip(file);
      if (!tables['stops.txt']) throw new Error('stops.txt が見つかりません');
      const data = parseGtfsTables(tables);
      if (data.stops.length === 0) throw new Error('有効な停留所が読み込めませんでした');
      setGtfs(data);
      setSourceName(`${data.agencyName || file.name}（${data.stops.length}停留所）`);
      setBoardId('');
      setAlightId('');
      if (data.fareRules.length === 0 && Object.keys(data.fareAttributes).length === 0) {
        setError('このGTFSには運賃情報（fare_attributes / fare_rules）が含まれていないため、運賃計算できません。');
      }
    } catch (err) {
      setError(`読み込みに失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }

  function loadSample() {
    setGtfs(parseGtfsTables(sampleGtfsTables()));
    setSourceName('サンプル交通（デモデータ）');
    setBoardId('');
    setAlightId('');
    setError('');
  }

  const pickerProps = { labelOf, labelToStop, sortedStops };

  return (
    <div className="bf-root">
      <header className="bf-header">
        <h1>🚌 バス運賃くらべ</h1>
        <p className="bf-sub">
          いつも使う停留所を選ぶと、<strong>少し歩くだけで運賃が安くなる乗り方</strong>を探します。
        </p>
      </header>

      <section className="bf-card">
        <div className="bf-source">
          <span>データ: <strong>{sourceName || '未読み込み'}</strong></span>
          <div className="bf-source-actions">
            <label className="bf-btn bf-btn-file">
              GTFS(zip)を読み込む
              <input type="file" accept=".zip" onChange={handleFile} hidden />
            </label>
            <button className="bf-btn bf-btn-ghost" onClick={loadSample}>サンプルに戻す</button>
          </div>
        </div>
        {loading && <p className="bf-note">読み込み中…</p>}
        {error && <p className="bf-error">{error}</p>}
      </section>

      <section className="bf-card">
        <StopPicker label="① 乗車する停留所" value={boardId} onPick={setBoardId} listId="bf-board" {...pickerProps} />
        <StopPicker label="② 降車する停留所" value={alightId} onPick={setAlightId} listId="bf-alight" {...pickerProps} />

        <label className="bf-field">
          <span>歩いてもよい距離: <strong>{radius}m</strong>（徒歩 約{walkMinutes(radius)}分）</span>
          <input
            type="range" min="100" max="1000" step="50"
            value={radius} onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>
      </section>

      {boardStop && alightStop && boardStop.id === alightStop.id && (
        <section className="bf-card"><p className="bf-note">乗車と降車が同じ停留所です。別の停留所を選んでください。</p></section>
      )}

      {result && <Results result={result} labelOf={labelOf} boardStop={boardStop} alightStop={alightStop} />}
    </div>
  );
}

function Results({ result, labelOf, boardStop, alightStop }) {
  const { baseFare, cheapest, options } = result;

  if (baseFare === null && options.length === 0) {
    return (
      <section className="bf-card">
        <p className="bf-error">この区間の運賃データが見つかりませんでした。GTFSに運賃ルールが含まれているかご確認ください。</p>
      </section>
    );
  }

  return (
    <>
      <section className="bf-card bf-result">
        <div className="bf-base">
          <span className="bf-base-label">そのまま乗ると</span>
          <span className="bf-base-fare">{baseFare !== null ? `${baseFare}円` : '—'}</span>
          <span className="bf-base-route">{labelOf[boardStop.id]} → {labelOf[alightStop.id]}</span>
        </div>

        {cheapest ? (
          <div className="bf-cheaper">
            <div className="bf-cheaper-head">
              <span className="bf-badge">💡 {cheapest.savings}円 安くなります</span>
            </div>
            <ul className="bf-walk-list">
              {cheapest.boardStop.id !== boardStop.id && (
                <li>
                  乗車を <strong>{labelOf[cheapest.boardStop.id]}</strong> に変更
                  <span className="bf-walk">（{cheapest.boardWalkM}m / 徒歩約{walkMinutes(cheapest.boardWalkM)}分）</span>
                </li>
              )}
              {cheapest.alightStop.id !== alightStop.id && (
                <li>
                  降車を <strong>{labelOf[cheapest.alightStop.id]}</strong> に変更
                  <span className="bf-walk">（{cheapest.alightWalkM}m / 徒歩約{walkMinutes(cheapest.alightWalkM)}分）</span>
                </li>
              )}
            </ul>
            <div className="bf-cheaper-fare">→ <strong>{cheapest.fare}円</strong>（合計 約{cheapest.totalWalkM}m / 徒歩約{walkMinutes(cheapest.totalWalkM)}分）</div>
          </div>
        ) : (
          <p className="bf-note">この区間は、近くの停留所まで歩いても安くなりませんでした。今の乗り方が最安です 👍</p>
        )}
      </section>

      {options.length > 1 && (
        <section className="bf-card">
          <h2 className="bf-h2">近くの停留所を使った場合の運賃一覧</h2>
          <table className="bf-table">
            <thead>
              <tr><th>乗車</th><th>降車</th><th>徒歩</th><th>運賃</th><th>差額</th></tr>
            </thead>
            <tbody>
              {options.slice(0, 12).map((o, i) => (
                <tr key={i} className={o.savings > 0 ? 'bf-row-cheap' : ''}>
                  <td>{labelOf[o.boardStop.id]}{o.boardWalkM > 0 && <small> +{o.boardWalkM}m</small>}</td>
                  <td>{labelOf[o.alightStop.id]}{o.alightWalkM > 0 && <small> +{o.alightWalkM}m</small>}</td>
                  <td>{o.totalWalkM}m</td>
                  <td>{o.fare}円</td>
                  <td className={o.savings > 0 ? 'bf-save' : o.savings < 0 ? 'bf-more' : ''}>
                    {o.savings > 0 ? `-${o.savings}` : o.savings < 0 ? `+${-o.savings}` : '±0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="bf-footer">
        <p>※ 運賃はGTFSの区間（zone_id）データに基づく目安です。実際の運賃は事業者の最新情報をご確認ください。</p>
      </footer>
    </>
  );
}
