const STORAGE_KEY = 'mrmwsk-ai-history';

const state = {
  messages: [],
  engine: null,
  modelLoading: false,
  modelReady: false,
  isOnline: navigator.onLine,
  gpuSupported: false,
  actionApprovalRequired: true,
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
  const item = document.createElement('div');
  item.className = `message ${role}`;
  item.innerHTML = `
    <div class="message-header">
      <span>${role === 'user' ? 'You' : 'Assistant'}</span>
      <span>${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
    <div>${text}</div>
  `;
  ui.chat.appendChild(item);
  ui.chat.scrollTop = ui.chat.scrollHeight;
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
  } catch (error) {
    console.warn('Conversation history could not be saved:', error);
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    state.messages = parsed;
    parsed.forEach(({ role, text }) => appendMessage(role, text));
  } catch (error) {
    console.warn('Conversation history could not be loaded:', error);
  }
}

function updateOnlineStatus() {
  state.isOnline = navigator.onLine;
  ui.onlineStatus.textContent = state.isOnline ? 'Online' : 'Offline';
  ui.onlineStatus.className = `status-pill ${state.isOnline ? 'online' : 'offline'}`;
  ui.cloudProviderStatus.textContent = state.isOnline ? 'ready' : 'offline';
}

function detectWebGPU() {
  const hasGpu = 'gpu' in navigator;
  state.gpuSupported = Boolean(hasGpu);

  if (hasGpu) {
    ui.gpuStatus.textContent = 'WebGPU: supported';
    ui.gpuStatus.className = 'status-pill online';
  } else {
    ui.gpuStatus.textContent = 'WebGPU: unsupported';
    ui.gpuStatus.className = 'status-pill critical';
  }
}

async function initializeLocalEngine() {
  if (!state.gpuSupported) {
    ui.localStatus.textContent = 'Local AI: no WebGPU';
    ui.localStatus.className = 'status-pill critical';
    ui.localProviderStatus.textContent = 'unsupported';
    return;
  }

  if (state.modelLoading) return;
  state.modelLoading = true;

  try {
    ui.localStatus.textContent = 'Local AI: loading…';
    ui.localStatus.className = 'status-pill info';
    ui.localProviderStatus.textContent = 'loading';

    const { CreateMLCEngine } = await import('https://esm.sh/@mlc-ai/web-llm');
    const modelId = ui.modelSelect.value;

    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (progress) => {
        ui.localStatus.textContent = `Local AI: ${progress}`;
      },
    });

    state.engine = engine;
    state.modelReady = true;
    ui.localStatus.textContent = 'Local AI: model loaded';
    ui.localStatus.className = 'status-pill online';
    ui.localProviderStatus.textContent = 'ready';
  } catch (error) {
    console.error('WebLLM model failed to load:', error);
    state.engine = null;
    state.modelReady = false;
    ui.localStatus.textContent = 'Local AI: not loaded';
    ui.localStatus.className = 'status-pill critical';
    ui.localProviderStatus.textContent = 'error';
  } finally {
    state.modelLoading = false;
  }
}

async function generateLocalReply(prompt) {
  if (!state.modelReady || !state.engine) {
    return 'The local model is not loaded yet. Use “Load model” once your browser supports WebGPU and the model can be downloaded.';
  }

  try {
    const result = await state.engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
    });

    return result.choices?.[0]?.message?.content || 'The local model responded without visible text output.';
  } catch (error) {
    console.error('Local generation failed:', error);
    return 'The local model could not generate a response at this time. This usually means WebGPU support, model download, or browser compatibility needs attention.';
  }
}

async function generateCloudReply(prompt) {
  if (!navigator.onLine) {
    ui.cloudProviderStatus.textContent = 'offline';
    return 'The system is offline. Local inference is the safest option right now.';
  }

  ui.cloudProviderStatus.textContent = 'connecting';
  return 'Cloud fallback is designed as a secure backend-only integration. API keys are never embedded in the browser frontend.';
}

async function askAssistant(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed) return;

  appendMessage('user', trimmed);

  const useLocal = state.modelReady && !!state.engine;
  let answer = '';

  if (useLocal) {
    answer = await generateLocalReply(trimmed);
  } else {
    answer = await generateCloudReply(trimmed);
  }

  appendMessage('assistant', answer);
  state.messages.push({ role: 'user', text: trimmed });
  state.messages.push({ role: 'assistant', text: answer });
  saveHistory();

  ui.actionProviderStatus.textContent = state.actionApprovalRequired ? 'requires approval' : 'ready';
}

ui.sendBtn.addEventListener('click', async () => {
  const text = ui.promptInput.value.trim();
  if (!text) return;
  await askAssistant(text);
  ui.promptInput.value = '';
});

ui.loadModelBtn.addEventListener('click', async () => {
  await initializeLocalEngine();
});

ui.promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const value = ui.promptInput.value.trim();
    if (value) {
      askAssistant(value);
      ui.promptInput.value = '';
    }
  }
});

ui.approveExternal.addEventListener('change', (event) => {
  state.actionApprovalRequired = event.target.checked;
  ui.actionProviderStatus.textContent = state.actionApprovalRequired ? 'requires approval' : 'ready';
});

ui.storeLocal.addEventListener('change', () => {
  if (ui.storeLocal.checked) {
    saveHistory();
  }
});

ui.blockRemote.addEventListener('change', () => {
  console.log('Remote-request policy updated:', ui.blockRemote.checked ? 'blocked unless online' : 'relaxed');
});

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

updateOnlineStatus();
detectWebGPU();
loadHistory();

if (!state.messages.length) {
  appendMessage('assistant', 'Hello. I am MrMWSK\'s AI. I can run locally with WebLLM if your browser supports WebGPU, and I will only act on external systems after your approval.');
}
