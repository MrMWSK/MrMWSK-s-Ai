const STORAGE_KEY = 'mrmwsk-ai-history';
const MAX_HISTORY_MESSAGES = 500;

const state = {
  messages: [],
  engine: null,
  modelLoading: false,
  modelReady: false,
  hasGeneratedResponse: false,
  isOnline: navigator.onLine,
  gpuSupported: false,
  busy: false,
};

const ui = {
  chat: document.getElementById('chat'),
  promptInput: document.getElementById('promptInput'),
  sendBtn: document.getElementById('sendBtn'),
  loadModelBtn: document.getElementById('loadModelBtn'),
  modelSelect: document.getElementById('modelSelect'),
  onlineStatus: document.getElementById('onlineStatus'),
  localStatus: document.getElementById('localStatus'),
  gpuStatus: document.getElementById('gpuStatus'),
  localProviderStatus: document.getElementById('localProviderStatus'),
  cloudProviderStatus: document.getElementById('cloudProviderStatus'),
  actionProviderStatus: document.getElementById('actionProviderStatus'),
  approveExternal: document.getElementById('approveExternal'),
  storeLocal: document.getElementById('storeLocal'),
  blockRemote: document.getElementById('blockRemote'),
};

function appendMessage(role, text) {
  const item = document.createElement('article');
  item.className = `message ${role === 'user' ? 'user' : 'assistant'}`;

  const header = document.createElement('div');
  header.className = 'message-header';
  const author = document.createElement('span');
  author.textContent = role === 'user' ? 'You' : 'Assistant';
  const time = document.createElement('time');
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  header.append(author, time);

  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = String(text);
  item.append(header, body);
  ui.chat.appendChild(item);
  ui.chat.scrollTop = ui.chat.scrollHeight;
}

function saveHistory() {
  if (!ui.storeLocal.checked) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.warn('Could not clear local history:', error); }
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages.slice(-MAX_HISTORY_MESSAGES)));
  } catch (error) {
    console.warn('Conversation history could not be saved:', error);
  }
}

function loadHistory() {
  if (!ui.storeLocal.checked) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    state.messages = parsed
      .filter((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.text === 'string')
      .slice(-MAX_HISTORY_MESSAGES);

    state.messages.forEach(({ role, text }) => appendMessage(role, text));
  } catch (error) {
    console.warn('Conversation history could not be loaded:', error);
  }
}

function updateOnlineStatus() {
  state.isOnline = navigator.onLine;
  ui.onlineStatus.textContent = state.isOnline ? 'Network available' : 'Offline';
  ui.onlineStatus.className = `status-pill ${state.isOnline ? 'online' : 'offline'}`;
  ui.cloudProviderStatus.textContent = state.isOnline ? 'ready' : 'offline';
}

async function detectWebGPU() {
  if (!navigator.gpu) {
    state.gpuSupported = false;
    ui.gpuStatus.textContent = 'WebGPU: unavailable';
    ui.gpuStatus.className = 'status-pill critical';
    return;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    state.gpuSupported = Boolean(adapter);
    ui.gpuStatus.textContent = adapter ? 'WebGPU: available' : 'WebGPU: no compatible adapter';
    ui.gpuStatus.className = adapter ? 'status-pill online' : 'status-pill critical';
  } catch (error) {
    state.gpuSupported = false;
    ui.gpuStatus.textContent = 'WebGPU: unavailable';
    ui.gpuStatus.className = 'status-pill critical';
    console.warn('WebGPU adapter check failed:', error);
  }
}

async function initializeLocalEngine() {
  if (state.modelLoading) return;
  if (!state.gpuSupported) {
    ui.localStatus.textContent = 'Local AI: WebGPU unavailable';
    ui.localStatus.className = 'status-pill critical';
    ui.localProviderStatus.textContent = 'unsupported';
    return;
  }

  state.modelLoading = true;
  ui.loadModelBtn.disabled = true;
  ui.localStatus.textContent = 'Local model: loading…';
  ui.localStatus.className = 'status-pill info';
  ui.localProviderStatus.textContent = 'loading';

  try {
    const { CreateMLCEngine } = await import('https://esm.sh/@mlc-ai/web-llm');
    const engine = await CreateMLCEngine(ui.modelSelect.value, {
      initProgressCallback: (progress) => {
        const detail = typeof progress === 'string' ? progress : progress?.text || 'Downloading and initializing';
        ui.localStatus.textContent = `Local model: ${detail}`;
      },
    });

    state.engine = engine;
    state.modelReady = true;
    state.hasGeneratedResponse = false;
    ui.localStatus.textContent = 'Local model loaded';
    ui.localStatus.className = 'status-pill info';
    ui.localProviderStatus.textContent = 'ready';
  } catch (error) {
    console.error('WebLLM model failed to load:', error);
    state.engine = null;
    state.modelReady = false;
    ui.localStatus.textContent = 'Local model: failed to load';
    ui.localStatus.className = 'status-pill critical';
    ui.localProviderStatus.textContent = 'load error';
  } finally {
    state.modelLoading = false;
    ui.loadModelBtn.disabled = false;
  }
}

async function generateLocalReply() {
  if (!state.modelReady || !state.engine) {
    return 'No local model is loaded. Select a model and choose “Load model” to try browser-based inference.';
  }

  try {
    const history = state.messages.map(({ role, text }) => ({ role, content: text }));
    const result = await state.engine.chat.completions.create({
      messages: history,
      max_tokens: 256,
    });

    const response = result.choices?.[0]?.message?.content;
    if (typeof response !== 'string' || !response.trim()) {
      throw new Error('The model returned an empty response.');
    }

    state.hasGeneratedResponse = true;
    ui.localStatus.textContent = 'Local AI: response generated';
    ui.localStatus.className = 'status-pill online';
    ui.localProviderStatus.textContent = 'verified';
    return response;
  } catch (error) {
    console.error('Local generation failed:', error);
    ui.localStatus.textContent = 'Local AI: generation failed';
    ui.localStatus.className = 'status-pill critical';
    ui.localProviderStatus.textContent = 'generation error';
    return 'The local model did not generate a response. Check browser compatibility, available memory, and the developer console for details.';
  }
}

async function askAssistant(prompt) {
  const text = prompt.trim();
  if (!text || state.busy) return;

  state.busy = true;
  ui.sendBtn.disabled = true;
  appendMessage('user', text);
  state.messages.push({ role: 'user', text });

  let answer;
  if (state.modelReady && state.engine) {
    answer = await generateLocalReply();
  } else {
    answer = 'No AI provider is active yet. Load a local WebLLM model to generate a response. Cloud providers and external actions are not configured in this version.';
  }

  appendMessage('assistant', answer);
  state.messages.push({ role: 'assistant', text: answer });
  saveHistory();
  state.busy = false;
  ui.sendBtn.disabled = false;
}

ui.sendBtn.addEventListener('click', async () => {
  const text = ui.promptInput.value;
  if (!text.trim()) return;
  ui.promptInput.value = '';
  await askAssistant(text);
});

ui.loadModelBtn.addEventListener('click', initializeLocalEngine);

ui.modelSelect.addEventListener('change', () => {
  state.engine = null;
  state.modelReady = false;
  state.hasGeneratedResponse = false;
  ui.localStatus.textContent = 'Local AI: model not loaded';
  ui.localStatus.className = 'status-pill info';
  ui.localProviderStatus.textContent = 'not loaded';
});

ui.promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const text = ui.promptInput.value;
    if (text.trim()) {
      ui.promptInput.value = '';
      askAssistant(text);
    }
  }
});

ui.approveExternal.addEventListener('change', () => {
  ui.actionProviderStatus.textContent = 'not connected';
});

ui.blockRemote.addEventListener('change', () => {
  ui.cloudProviderStatus.textContent = 'not configured';
});

ui.storeLocal.addEventListener('change', () => {
  if (ui.storeLocal.checked) saveHistory();
  else {
    state.messages = [];
    ui.chat.replaceChildren();
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.warn('Could not clear local history:', error); }
  }
});

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

updateOnlineStatus();
detectWebGPU();
loadHistory();

if (!state.messages.length) {
  appendMessage('assistant', 'Welcome. This interface is ready. Load a local model to test inference; the app will report success only after it generates a real response.');
}
