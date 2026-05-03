# NMR Well Log Analyzer

## Project Overview
A plain HTML, CSS, and JavaScript web application for quantitative interpretation of rock and fluid properties from NMR well log data. Served as a static site using `npx serve`.

## Architecture
- **Stack**: Plain HTML + CSS + JavaScript (no build step)
- **Server**: `npx serve` on port 5000
- **Charts**: Chart.js (CDN)
- **Excel I/O**: SheetJS / xlsx (CDN)
- **Chart export**: html2canvas (CDN)

## Pages
- `index.html` — Home page
- `analysis.html` — Analysis page (file upload, charts, table)
- `about.html` — About NMR theory & principles

## Key Files
- `css/home.css` — Home page styles
- `css/analysis.css` — Analysis page styles
- `css/about.css` — About page styles
- `js/analysis.js` — Analysis logic (NMR computation, charts, file parsing)
- `favicon.svg` — App favicon
- `NMR_sample_data.xlsx` — Sample data for download

## Features
- Sticky navigation bar with page links
- Hero section with animated gradient background
- File upload with drag-and-drop (Excel/CSV)
- NMR computation: Porosity, FFI, BFV, Permeability (SDR), RQI
- 5 vertical depth-vs-property charts (Chart.js)
- Summary statistics panel
- Results table with Excel export
- Chart download as PNG (html2canvas)
- About page with NMR theory, equations, and interpretation guide

## Running
```
npx serve -p 5000 .
```
