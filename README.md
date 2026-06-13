# Coded research journal

Starter project: Vite + React + IBM Carbon + d3

Quick start

1. Install dependencies

```bash
npm install
```

2. Run dev server

```bash
npm run dev
```

Weekly Sankey update

```bash
npm run set-sankey-source
```

Use this whenever you add a new weekly `practice_events...csv` file.

1. Copy the new CSV into `data/csv/`
2. Run `npm run set-sankey-source`
3. When prompted, enter the exact filename
4. The script updates the active Sankey source and regenerates `src/data/sankey.json`

Notes:

- The live Sankey chart reads its active CSV from `src/data/active-sankey-source.json`
- If the dev server is already running, refresh the browser after updating the source
- The command will show you the available `practice_events` CSV files before asking

Deploy after update

After checking the Sankey locally, deploy the latest version to GitHub Pages:

```bash
npm run deploy
```

Recommended weekly flow:

1. Add the new CSV to `data/csv/`
2. Run `npm run set-sankey-source`
3. Check the chart locally with `npm run dev`
4. Deploy with `npm run deploy`

This project includes a Carbon UI shell header, a theme toggle and a simple d3 placeholder.

Live demo

- Intent: a minimal landing page and interactive Sankey demo for reflexive practice data visualisation.
- Live: https://munomono.github.io/coded-research-journal/  (deployed to GitHub Pages)
