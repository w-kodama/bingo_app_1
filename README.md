# バス運賃くらべ

いつも使うバス停を選ぶと、**少し歩くだけで運賃が安くなる乗り方**を探す Web アプリです。
React + Vite で動作し、サーバーや認証は不要です。

## 使い方

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173/` を開きます。

1. 初期表示は内蔵の **サンプル GTFS（区間制運賃）**。例として「中央駅前 → 桜ヶ丘」を選ぶと、
   1つ先まで歩いて区間をまたぐと安くなる、と表示されます。
2. 実在の事業者で使うときは「**GTFS(zip)を読み込む**」から、その事業者が公開している
   GTFS（GTFS-JP）の zip ファイルを選びます。すべてブラウザ内で解析され、外部送信はしません。

## 運賃の仕組み

GTFS の運賃データを使います。

| ファイル | 役割 |
| --- | --- |
| `stops.txt` | 停留所の緯度経度と `zone_id`（区間） |
| `fare_attributes.txt` | 運賃額（`price`） |
| `fare_rules.txt` | 乗車区間 `origin_id` × 降車区間 `destination_id` → `fare_id` |

乗車停留所・降車停留所それぞれの徒歩圏内（スライダーで調整）にある代替停留所を含めて
全組み合わせの運賃を比較し、最安の乗り方と差額・必要な徒歩距離を提示します。
区間制（`zone_id` ＋ `origin_id`/`destination_id`）と全線均一運賃に対応しています。

## ファイル構成

- `index.html` / `busfare.html` … エントリ（どちらもバスアプリ）
- `src/busfare/main.jsx` … React エントリ
- `src/busfare/BusFare.jsx` … 画面（停留所選択・結果表示）
- `src/busfare/gtfs.js` … GTFS の zip / CSV パーサ
- `src/busfare/fare.js` … 運賃検索・徒歩距離・「安くなる乗り方」探索
- `src/busfare/sampleGtfs.js` … 動作確認用のサンプル GTFS

## デプロイ（GitHub Pages）

```bash
npm run deploy
```

`vite build --base=/bingo_app_1/` でビルドし、`gh-pages` ブランチへ公開します。
公開 URL: `https://w-kodama.github.io/bingo_app_1/`
