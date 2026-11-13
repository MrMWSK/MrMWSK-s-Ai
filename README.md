# MrMWSK's AI — Offline PWA

A branded, installable Progressive Web App using **MLC WebLLM** for real on-device language-model inference.

## What works
- Real local AI chat through WebLLM/WebGPU (not a simulated response).
- Compact Qwen2 0.5B model selected as a starting point.
- Local text/Markdown/CSV/JSON file reading; file contents are added to AI context when chatting.
- Local chat history, export, clear, and privacy controls.
- Installable PWA with an offline app shell/service worker.

## Important offline behavior
This is an **offline-capable** app, not an app with the model preloaded in this ZIP. On first launch, while online, the browser downloads the WebLLM runtime and model weights. Model download can be large and needs free storage. Once the app assets and model have finished caching, chat inference runs on-device without sending prompts to a cloud AI service. Keep the app installed and do not clear browser site data/model cache.

Requires a WebGPU-compatible browser/device. The 0.5B model is a small starting model and answer quality is limited compared with larger models. Many phones may not have enough GPU memory or WebGPU support. If WebGPU is unavailable, this browser build cannot run the model.

## Run locally
Install Node.js 20+ then:

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. For production:

```bash
npm run build
npm run preview
```

Deploy the contents of `dist/` to an HTTPS static host (GitHub Pages, Cloudflare Pages, Netlify, etc.). HTTPS is required for service workers/PWA installation and WebGPU secure-context access. After opening the deployed app online once, install it from Chrome's menu: **Install app** or **Add to Home screen**.

## Model and source
The WebLLM package is `@mlc-ai/web-llm` version 0.2.88. The supplied `v0.2.88 source code.zip` is the upstream MLC WebLLM source distribution; it is not itself a ready-to-run mobile app. The app uses the published package through npm. WebLLM and its runtime/model assets are subject to their respective upstream licenses and model licenses. Check model terms before redistribution.

## Privacy
Prompts and completions are processed locally by WebLLM once the model is loaded. The first app/runtime/model downloads require internet. Browser storage is controlled by the user and can be cleared by the browser. This app has no account system, analytics, or server-side chat endpoint.

## Project layout
- `src/main.js` — application UI and WebLLM integration
- `src/style.css` — MrMWSK's AI theme and responsive layout
- `public/sw.js` — offline app-shell caching
- `public/manifest.webmanifest` — installable PWA metadata
