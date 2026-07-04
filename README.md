# Market & Portfolio Intelligence Dashboard

ニュース、重要イベント、サンプルポートフォリオを一画面で結びつける、金融リサーチ向けのWebダッシュボードです。

個人の取引管理ツールではなく、保有銘柄のリスク露出とマーケット材料の関連を見せるポートフォリオ用デモとして作っています。

**Live Demo:** https://market-portfolio-intelligence-dashboard.onrender.com

## What This App Does

- サンプルポートフォリオの評価額、損益、保有銘柄を表示
- 資産クラス、通貨、地域、セクター別のリスク露出を可視化
- RSSニュースを取得し、金融キーワードで重要度をスコアリング
- ニュースタグと保有銘柄テーマを照合し、影響候補を表示
- FOMC、日銀、CPI、雇用統計、OPECなどの重要イベントを一覧化
- 画面上のエディタでサンプル銘柄を追加、編集、削除
- npm依存なしで、Node.js単体で起動

## Financial Viewpoint

- ニュースを単に並べるのではなく、保有銘柄のテーマに紐づけています。
- USD比率、地域、セクター、資産クラスを分けて見ることで、ポートフォリオの偏りを確認できます。
- 売買推奨ではなく、マーケット材料と保有リスクを整理するためのリサーチUIです。

## Demo Portfolio

サンプルとして次のような銘柄を入れています。画面上の「サンプル銘柄エディタ」から変更できます。

| Symbol | Name | Theme |
| --- | --- | --- |
| 7203.T | Toyota Motor | Japan, FX, China, Cyclical |
| 8035.T | Tokyo Electron | Semiconductor, Growth, China |
| 5020.T | ENEOS Holdings | Energy, Inflation, Defensive |
| AAPL | Apple | US, Growth, FX, Consumer |
| VOO | Vanguard S&P 500 ETF | US, Broad Market, Rates |

## Tech Stack

| Area | Tools |
| --- | --- |
| Backend | Node.js HTTP server |
| Frontend | HTML, CSS, JavaScript |
| Market Data | Yahoo Finance chart API, CoinGecko |
| News | Yahoo News RSS, NHK RSS, Google News RSS |
| Events | Seeded macro calendar, FOMC schedule sync |

## Local Development

```bash
cd market_portfolio_intelligence_dashboard
node server.js
```

Then open:

```text
http://127.0.0.1:4173
```

If port `4173` is already used:

```bash
PORT=4174 node server.js
```

## Deployment

Render の Web Service で動かす場合は、次の設定を使えます。

```text
Build Command: npm install
Start Command: node server.js
Environment Variables:
  HOST=0.0.0.0
```

公開済みURL:

```text
https://market-portfolio-intelligence-dashboard.onrender.com
```

このリポジトリには `render.yaml` も入れているため、Render の Blueprint として作成することもできます。無料枠では初回アクセス時に起動待ちが発生することがあります。

## Project Structure

```text
market_portfolio_intelligence_dashboard/
  server.js
  package.json
  render.yaml
  data/
    store.json
  public/
    index.html
    app.js
    styles.css
```

## Notes

- このアプリはポートフォリオ用のデモアプリです。
- 株式投資の助言や売買推奨を目的としたものではありません。
- 公開RSSや無料マーケットデータは遅延、制限、停止が発生する可能性があります。
- `data/store.json` は個人データではなく、公開用のサンプルポートフォリオです。
