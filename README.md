# Koppie-Kat

AI retail copy generator. Upload a product photo, choose a tone, and get back ready-to-post descriptions, social media scripts, or campaign concepts — powered by a vision model that reads the image directly.

**Live:** [koppie-kat.vercel.app](https://koppie-kat.vercel.app/)

## What it does

Upload up to three product images and pick an output type:

* **Product description** — headline, hook, feature bullets, use suggestion, mood line
* **Instagram carousel** — six-slide structure with caption and hashtags
* **TikTok script** — scroll-stopping hook, beat drop, CTA, audio suggestions
* **Campaign concept** — big idea, creative direction, influencer tiers, launch timeline

Each output type has three tone settings: neutral, high-end, and fun.

## Why it exists

Built for a fashion retail business where staff were writing product copy manually — 3 to 5 minutes per item with inconsistent grammar and tone. Koppie-Kat brings it down to roughly 20 seconds and keeps the voice consistent across the catalogue.

## Architecture

The app is two files:

* `index.html` — the frontend, vanilla HTML/JS
* `api/generate.js` — Vercel serverless function that validates input and calls the Anthropic vision API

The serverless function handles all API communication. The Anthropic key lives in Vercel's environment variables and never reaches the browser. Input is validated server-side: MIME type whitelist, file size cap, section and tone value checks.

## Run locally

```
npm install
npx vercel dev
```

Requires `ANTHROPIC_API_KEY` set in `.env` (see `.env.example`).

## Deploy

Deployed to Vercel. The serverless function runs with 1024 MB memory and a 30-second timeout.
