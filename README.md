# MrMWSK-s-Ai

A powerful private AI assistant with offline intelligence, internet access and expandable integrations.

## Repository layout

- `index.html` — main AI app shell and premium chat interface
- `assets/app.css` — responsive visual design for the app
- `assets/app.js` — local state, WebGPU detection, WebLLM integration, local storage, and privacy controls

## First setup

1. Open a terminal in the project folder.
2. Start a local web server from the repo root:

```bash
cd /path/to/MrMWSK-s-Ai
python -m http.server 8000
```

3. Open the app in a modern browser:

```text
http://localhost:8000/
```

## Browser requirements

- Best performance on the latest Chrome or Edge build on Windows, macOS, or Android.
- WebGPU must be enabled for local model execution.
- If WebGPU is missing or unsupported, the app stays in a safe offline state instead of falsely claiming a model is running.

## Local AI status

This app does not claim local AI works until the browser actually loads a model and generates a response.

- The app checks `navigator.gpu` before trying to initialize WebLLM.
- If WebGPU is unsupported, the UI shows a clear warning.
- If the model does not load, the app shows an error state rather than pretending the assistant is ready.

## Privacy and secure integration rules

- No API keys are stored in the frontend.
- External actions require explicit user approval.
- Local conversation history is stored in `localStorage` only.
- Remote provider access should be routed through a secure backend or proxy, not embedded in browser code.

## Offline-first architecture

- Local inference is the priority path.
- Online provider fallback is available only when the browser is online.
- The app keeps clear status labels for online/offline, local AI readiness, and WebGPU capability.

## Notes

This is the first working interface for MrMWSK's AI. It is intentionally conservative: if a model cannot load, the UI explains the issue instead of claiming success.
