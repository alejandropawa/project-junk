# Probix

Probix is a football analytics app built with Next.js, Supabase, and the SportMonks API. It serves live fixtures, transparent prediction cards, historic settlement views, and internal engine audit tooling.

## Development

Run the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Probix Backtesting

Run the internal prediction audit report with:

```bash
npm run probix:backtest
```

Useful variants:

```bash
npm run probix:backtest -- --json
npm run probix:backtest -- --limit=500
```

The report reads `prediction_reports` using `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. It compares legacy rows against gated rows, counts
`NO_BET` avoids, reports ROI/hit rate by safety status, volatility bucket,
market family, combo size, and confidence bucket, and includes closing-line
value metrics:

- percentage of picks that beat closing odds
- average CLV
- CLV by market family, league, confidence bucket, and safety status

Probix stores published odds as the opening price. Settlement/repair refreshes
current closing odds from SportMonks and computes CLV as
`publishedOdds / closingOdds - 1`, so positive CLV means Probix beat the closing
market.
