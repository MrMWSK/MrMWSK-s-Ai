import { CreateMLCEngine, prebuiltAppConfig } from "@mlc-ai/web-llm";
import "./style.css";

const MODEL="Qwen2-0.5B-Instruct-q4f16_1-MLC";
const $=s=>document.querySelector(s);
let engine=null, loading=false, messages=JSON.parse(localStorage.getItem("mrmwsk_offline_chat")||"[]");
let attachedText="";
const app=$("#app");
app.innerHTML=`
<div class="layout">
 <aside class="sidebar">
  <div class="brand"><div class="mark">M</div><div><b>MrMWSK's AI</b><small>PRIVATE OFFLINE WORKSPACE</small></div></div>
  <div class="navtitle">WORKSPACE</div>
  <button class="nav active" data-tab="chat">✧ <span>AI Chat</span></button>
  <button class="nav" data-tab="files">▤ <span>Local files</span></button>
  <button class="nav" data-tab="privacy">⬡ <span>Privacy & storage</span></button>
  <div class="sidefoot"><span class="live-dot"></span> Runs on this device<br><small>No account · No API key</small></div>
 </aside>
 <main>
  <header><div><div class="eyebrow">YOUR PRIVATE AI WORKSPACE</div><h1 id="heading">AI Chat</h1></div><div class="status" id="status">Model not loaded</div></header>
  <section id="tab-chat" class="tab active">
   <div class="intro"><span class="pill">ON-DEVICE AI</span><h2>Think clearly. Work privately.</h2><p>Your prompts are processed in this browser using a model downloaded to your device. After setup, chat can work without internet.</p></div>
   <div class="modelbar">
    <div><b>Local model</b><small id="model-note">Qwen 2 · 0.5B · compact starting model</small></div>
    <button class="btn" id="load">Download & load model</button>
   </div>
   <div class="progress-wrap" id="progress-wrap" hidden><div class="progress"><i id="progress"></i></div><small id="progress-text">Preparing model…</small></div>
   <div class="chatbox"><div class="chathead"><b>Conversation</b><div><button class="tiny" id="export">Export</button><button class="tiny" id="clear">Clear</button></div></div>
    <div id="messages" class="messages"></div>
    <div class="composer"><textarea id="prompt" rows="2" placeholder="Ask something… (Enter to send)"></textarea><button class="send" id="send" disabled>Send ↗</button></div>
   </div>
   <p class="hint">First-time setup needs internet to download the AI engine and model. The model can be large; keep this tab open until loading completes. WebGPU-compatible browser and sufficient device memory are required.</p>
  </section>
  <section id="tab-files" class="tab">
   <div class="panel"><h2>Read a file locally</h2><p>Choose a text, Markdown, or CSV file. Its contents stay in this browser. You can ask the AI about it from the chat.</p>
    <label class="drop">Choose document<input id="file" type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"></label>
    <div id="fileinfo" class="muted">No document selected.</div><pre id="filepreview">Your local file preview appears here.</pre>
    <button class="btn secondary" id="askfile" disabled>Ask AI about this file</button>
   </div>
  </section>
  <section id="tab-privacy" class="tab">
   <div class="panel"><h2>Privacy & storage</h2>
    <div class="setting"><div><b>Save conversations on this device</b><small>Stored in this browser's local storage.</small></div><input type="checkbox" id="save" checked></div>
    <div class="setting"><div><b>Model files</b><small>WebLLM stores downloaded model assets in browser cache/storage. Clear site data in browser settings to remove them.</small></div><span class="tag">Local cache</span></div>
    <div class="setting"><div><b>Network use</b><small>Only required for first-time app/model download. Chat inference runs locally after the model is loaded.</small></div><span class="tag">No cloud API</span></div>
    <button class="btn danger" id="wipe">Delete saved conversation</button>
   </div>
  </section>
  <footer>© 2026 MrMWSK's AI <span>Local-first · WebLLM engine · No cloud chat</span></footer>
 </main>
</div>`;

function render(){
 const box=$("#messages");box.replaceChildren();
 const list=messages.length?messages:[{role:"assistant",content:"Welcome to MrMWSK's AI. Load the local model to begin. Your first model download requires internet; after it is cached, you can use AI chat offline."}];
 for(const m of list){const el=document.createElement("article");el.className="bubble "+m.role;const who=document.createElement("small");who.textContent=m.role==="user"?"YOU":"MRMWSK'S AI";const body=document.createElement("div");body.textContent=m.content;el.append(who,body);box.append(el)}
 box.scrollTop=box.scrollHeight;
}
function persist(){if($("#save").checked)localStorage.setItem("mrmwsk_offline_chat",JSON.stringify(messages.slice(-80)));else localStorage.removeItem("mrmwsk_offline_chat")}
function setStatus(t,ok=false){$("#status").textContent=t;$("#status").classList.toggle("ok",ok)}
function setProgress(p,t){$("#progress-wrap").hidden=false;$("#progress").style.width=Math.max(0,Math.min(100,p*100))+"%";$("#progress-text").textContent=t}
async function loadModel(){
 if(loading||engine)return;loading=true;$("#load").disabled=true;$("#load").textContent="Loading…";
 try{
  if(!navigator.gpu)throw new Error("WebGPU is not available in this browser/device. Try an updated Chrome browser on supported hardware.");
  setStatus("Downloading model…");
  engine=await CreateMLCEngine(MODEL,{initProgressCallback:p=>setProgress(p.progress||0,p.text||"Downloading model…")});
  setStatus("Local AI ready",true);$("#load").textContent="Model ready";$("#send").disabled=false;
  setProgress(1,"Model ready. You can now disconnect from the internet.");
 }catch(e){engine=null;setStatus("Model unavailable");$("#load").disabled=false;$("#load").textContent="Try loading again";setProgress(0,e.message||String(e))}
 finally{loading=false}
}
async function send(){
 const prompt=$("#prompt").value.trim();if(!prompt||!engine||loading)return;
 $("#prompt").value="";messages.push({role:"user",content:prompt});persist();render();$("#send").disabled=true;
 const answer={role:"assistant",content:""};messages.push(answer);render();
 try{
  const context=attachedText?`The user has supplied this local document for context:\n${attachedText.slice(0,18000)}\n\n`: "";
  const history=messages.slice(-12,-2).map(m=>({role:m.role,content:m.content}));
  const stream=await engine.chat.completions.create({messages:[{role:"system",content:"You are MrMWSK's AI, a helpful, careful assistant. Be clear and practical. The conversation is processed locally on the user's device."},...history.slice(-10),{role:"user",content:context+prompt}],stream:true,temperature:0.7});
  for await(const chunk of stream){answer.content+=chunk.choices?.[0]?.delta?.content||"";render()}
  if(!answer.content)answer.content="The model returned an empty response.";
 }catch(e){answer.content="Generation failed: "+(e.message||String(e))}
 persist();render();$("#send").disabled=false;$("#prompt").focus();
}
$("#load").addEventListener("click",loadModel);$("#send").addEventListener("click",send);
$("#prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
$("#clear").addEventListener("click",()=>{messages=[];persist();render()});
$("#export").addEventListener("click",()=>{const blob=new Blob([messages.map(m=>`${m.role.toUpperCase()}\\n${m.content}`).join("\\n\\n")],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="MrMWSK-AI-chat.txt";a.click();URL.revokeObjectURL(a.href)});
$("#save").checked=localStorage.getItem("mrmwsk_save_chat")!=="false";
$("#save").addEventListener("change",e=>{localStorage.setItem("mrmwsk_save_chat",String(e.target.checked));if(!e.target.checked)localStorage.removeItem("mrmwsk_offline_chat");else persist()});
$("#wipe").addEventListener("click",()=>{messages=[];persist();render()});
$("#file").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>3*1024*1024){$("#fileinfo").textContent="File exceeds 3 MB.";return}attachedText=await f.text();$("#fileinfo").textContent=`${f.name} · ${f.size.toLocaleString()} bytes · read locally` ;$("#filepreview").textContent=attachedText.slice(0,24000);$("#askfile").disabled=false});
$("#askfile").addEventListener("click",()=>{document.querySelector('[data-tab="chat"]').click();$("#prompt").value="Please summarize this document, explain its key points, and answer my questions about it.";$("#prompt").focus()});
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.id==="tab-"+b.dataset.tab));$("#heading").textContent=b.querySelector("span")?.textContent||b.textContent.trim()}));
render();
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("/sw.js").catch(()=>{});
