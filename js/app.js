// app.js — Kairo SPA router & all screen logic
import { VoiceRecorder }                        from './voice.js';
import { generatePrompt, generatePassport }     from './gemini.js';
import { savePassport, loadPassport, getPassportFormData,
         populateForm, getPassportText, savePassportText,
         getSyncHistory, saveSyncHistoryItem } from './passport.js';
import { generateSessionSync }                  from './session-sync.js';
import { enforceTrial }                         from './trial.js';

/* ============================================================
   UTILS
   ============================================================ */
function $(id) { return document.getElementById(id); }

function showToast(msg, duration = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, duration);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ Copied to clipboard!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('✅ Copied!');
  }
}

/* ============================================================
   ROUTER
   ============================================================ */
const SCREENS = ['landing', 'voice', 'passport', 'sync', 'output'];

function navigateTo(screenId) {
  SCREENS.forEach(id => {
    const el = $(`screen-${id}`);
    if (!el) return;
    if (id === screenId) {
      el.style.display = 'block';
      requestAnimationFrame(() => el.classList.add('active'));
    } else {
      el.classList.remove('active');
      setTimeout(() => { if (!el.classList.contains('active')) el.style.display = 'none'; }, 400);
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   LANDING SCREEN
   ============================================================ */
function initLanding() {
  $('landing-trial-btn').addEventListener('click',   () => {
    if(!enforceTrial($('trial-modal'))) navigateTo('voice');
  });
  $('landing-passport-btn').addEventListener('click', () => navigateTo('passport'));
  $('nav-build-btn').addEventListener('click',        () => {
    if(!enforceTrial($('trial-modal'))) navigateTo('voice');
  });
  $('nav-passport-btn').addEventListener('click',     () => navigateTo('passport'));
  $('nav-sync-btn').addEventListener('click',         () => {
    if(!enforceTrial($('trial-modal'))) navigateTo('sync');
  });
  $('nav-logo-btn').addEventListener('click',         () => navigateTo('landing'));

  $('upgrade-pro-btn').addEventListener('click', () => {
    showToast('Redirecting to Stripe...', 2000);
    setTimeout(() => $('trial-modal').classList.add('hidden'), 2000);
  });
}

/* ============================================================
   VOICE SCREEN
   ============================================================ */
function initVoice() {
  const micBtn        = $('mic-btn');
  const micIcon       = $('mic-icon');
  const micRings      = $('mic-rings');
  const pauseBtn      = $('pause-btn');
  const stopBtn       = $('stop-btn');
  const statusText    = $('status-text');
  const recordingDot  = $('recording-dot');
  const timerEl       = $('recording-timer');
  const waveform      = $('waveform');
  const transcript    = $('transcript-display');
  const clearBtn      = $('clear-transcript-btn');
  const generateBtn   = $('generate-prompt-btn');
  const generateText  = $('generate-btn-text');
  const generateLoader= $('generate-btn-loader');
  const fallbackNote  = $('voice-fallback-note');
  const textInput     = $('text-input-fallback');

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });

  let voiceState = 'idle';

  const recorder = new VoiceRecorder({
    onTranscript(full, interim) {
      transcript.textContent = full + interim;
      checkGenerateBtn();
    },
    onStatusChange(state, errInfo) {
      voiceState = state;
      updateVoiceUI(state, errInfo);
    },
    onTimerTick(time) {
      timerEl.textContent = time;
    }
  });

  if (!recorder.supported) {
    fallbackNote.textContent = '⚠️ Voice recording not supported in this browser. You can still type your idea below and generate a prompt.';
    micBtn.disabled = true;
    micBtn.style.opacity = '0.4';
  }

  function updateVoiceUI(state) {
    const isRecording = state === 'recording';
    const isPaused    = state === 'paused';
    const isStopped   = state === 'stopped' || state === 'idle';

    micIcon.textContent = isRecording ? '⏺️' : isPaused ? '▶️' : '🎙️';
    micBtn.classList.toggle('recording', isRecording);
    micRings.classList.toggle('recording', isRecording);
    waveform.classList.toggle('active', isRecording);
    recordingDot.classList.toggle('hidden', isStopped);
    timerEl.classList.toggle('hidden', isStopped);

    statusText.textContent = {
      idle:      'Tap the mic to start recording',
      recording: 'Listening…',
      paused:    'Paused — tap mic to resume',
      stopped:   'Recording stopped — review and generate',
      error:     'Mic error. Please type your idea below.'
    }[state] || '';

    pauseBtn.disabled = isStopped;
    stopBtn.disabled  = isStopped;
    pauseBtn.textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
  }

  function getInputText() {
    const voiceText = transcript.textContent.trim() || transcript.innerText.trim();
    const typedText = textInput.value.trim();
    return typedText || voiceText;
  }

  function checkGenerateBtn() {
    generateBtn.disabled = getInputText().length < 3;
  }

  micBtn.addEventListener('click', () => {
    if (!recorder.supported) return;
    if (voiceState === 'idle' || voiceState === 'stopped') recorder.start();
    else if (voiceState === 'recording') recorder.pause();
    else if (voiceState === 'paused') recorder.resume();
  });

  pauseBtn.addEventListener('click', () => {
    if (voiceState === 'recording') recorder.pause();
    else if (voiceState === 'paused') recorder.resume();
  });

  stopBtn.addEventListener('click', () => recorder.stop());

  clearBtn.addEventListener('click', () => {
    transcript.textContent = '';
    recorder.fullTranscript = '';
    checkGenerateBtn();
  });

  transcript.addEventListener('input', checkGenerateBtn);

  generateBtn.addEventListener('click', async () => {
    const text = getInputText();
    if (!text) return;

    if (enforceTrial($('trial-modal'))) return;

    generateText.classList.add('hidden');
    generateLoader.classList.remove('hidden');
    generateBtn.disabled = true;

    try {
      const prompt = await generatePrompt(text);
      window._kairoGeneratedPrompt  = prompt;
      window._kairoOriginalTranscript = text;
      navigateTo('output');
      initOutputScreen(prompt);
    } catch (err) {
      showToast(`❌ Error: ${err.message}`, 4000);
    } finally {
      generateText.classList.remove('hidden');
      generateLoader.classList.add('hidden');
      generateBtn.disabled = false;
      checkGenerateBtn();
    }
  });

  const refineBtn = $('refine-btn');
  if (refineBtn) {
    refineBtn.addEventListener('click', () => {
      navigateTo('voice');
      if (window._kairoOriginalTranscript) {
        transcript.textContent = window._kairoOriginalTranscript;
        checkGenerateBtn();
      }
    });
  }

  $('new-prompt-btn')?.addEventListener('click', () => {
    transcript.textContent = '';
    recorder.reset();
    checkGenerateBtn();
    navigateTo('voice');
  });
}

/* ============================================================
   PASSPORT SCREEN
   ============================================================ */
function renderSyncHistory() {
  const historyList = $('session-history-list');
  const history = getSyncHistory();
  if (history.length === 0) {
    historyList.innerHTML = `<p class="empty-history">No saved sessions yet. Use Session Sync to save contexts here.</p>`;
    return;
  }
  historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-item-header">
        <span class="history-item-time">${item.time}</span>
        <button class="history-item-copy" data-text="${encodeURIComponent(item.text)}">📋 Copy</button>
      </div>
      <div class="history-item-text">${item.text}</div>
    </div>
  `).join('');

  historyList.querySelectorAll('.history-item-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      copyText(decodeURIComponent(btn.dataset.text));
    });
  });
}

function initPassport() {
  const form         = $('passport-form');
  const genBtn       = $('generate-passport-btn');
  const genBtnText   = $('passport-btn-text');
  const genBtnLoader = $('passport-btn-loader');
  const outputEl     = $('passport-output');
  const outputText   = $('passport-output-text');
  const copyBtn      = $('copy-passport-btn');

  const saved = loadPassport();
  if (saved) populateForm(saved);

  const savedText = getPassportText();
  if (savedText) {
    outputText.textContent = savedText;
    outputEl.classList.remove('hidden');
  }

  renderSyncHistory();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceTrial($('trial-modal'))) return;

    const data = getPassportFormData();
    savePassport(data);

    genBtnText.classList.add('hidden');
    genBtnLoader.classList.remove('hidden');
    genBtn.disabled = true;

    try {
      const text = await generatePassport(data);
      savePassportText(text);
      outputText.textContent = text;
      outputEl.classList.remove('hidden');
      outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('🪪 AI Passport generated!');
    } catch (err) {
      showToast(`❌ Error: ${err.message}`, 4000);
    } finally {
      genBtnText.classList.remove('hidden');
      genBtnLoader.classList.add('hidden');
      genBtn.disabled = false;
    }
  });

  copyBtn.addEventListener('click', () => copyText(outputText.textContent));
}

/* ============================================================
   SESSION SYNC SCREEN
   ============================================================ */
function initSync() {
  const inputEl = $('sync-input');
  const genBtn = $('generate-sync-btn');
  const genBtnText = $('sync-btn-text');
  const genLoader = $('sync-btn-loader');
  const outputCont = $('sync-output-container');
  const outputText = $('sync-output-text');
  const copyBtn = $('copy-sync-btn');
  const saveBtn = $('save-sync-history-btn');

  inputEl.addEventListener('input', () => {
    genBtn.disabled = inputEl.value.trim().length < 10;
  });

  genBtn.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if (enforceTrial($('trial-modal'))) return;

    genBtnText.classList.add('hidden');
    genLoader.classList.remove('hidden');
    genBtn.disabled = true;

    try {
      const block = await generateSessionSync(text);
      outputText.textContent = block;
      outputCont.classList.remove('hidden');
      showToast('🔄 Context Block Generated!');
    } catch (err) {
      showToast(`❌ Error: ${err.message}`, 4000);
    } finally {
      genBtnText.classList.remove('hidden');
      genLoader.classList.add('hidden');
      genBtn.disabled = false;
    }
  });

  copyBtn.addEventListener('click', () => copyText(outputText.textContent + '\n\n— Generated by Kairo (kairo.app)'));
  
  saveBtn.addEventListener('click', () => {
    saveSyncHistoryItem(outputText.textContent);
    showToast('💾 Saved to Passport History!');
    renderSyncHistory();
  });
}

/* ============================================================
   OUTPUT SCREEN
   ============================================================ */
function initOutputScreen(promptText) {
  const outputEl     = $('prompt-output-text');
  const copyBtn      = $('copy-prompt-btn');
  const shareBtn     = $('share-prompt-btn');
  const passportToggle = $('passport-toggle');

  let basePrompt     = promptText || window._kairoGeneratedPrompt || '';
  outputEl.textContent = basePrompt;

  function getDisplayPrompt() {
    let finalPrompt = basePrompt;
    if (passportToggle.checked) {
      const passport = getPassportText();
      if (passport) finalPrompt = `${passport}\n\n---\n\n${basePrompt}`;
    }
    return finalPrompt;
  }

  passportToggle.addEventListener('change', () => {
    outputEl.textContent = getDisplayPrompt();
    showToast(passportToggle.checked ? '🪪 Passport added!' : '🪪 Passport removed');
  });

  copyBtn.addEventListener('click', () => copyText(getDisplayPrompt()));

  shareBtn.addEventListener('click', async () => {
    const text = getDisplayPrompt() + '\n\n— Powered by Kairo';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Kairo Prompt', url: 'https://kairo.app', text });
        showToast('✅ Shared!');
      } catch { /* user cancelled */ }
    } else {
      copyText(text);
    }
  });

  ['open-chatgpt', 'open-gemini', 'open-claude'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', async () => {
      await copyText(getDisplayPrompt()).catch(() => {});
      showToast('📋 Prompt copied! Paste it in the AI tool.');
    });
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  SCREENS.forEach(id => {
    const el = $(`screen-${id}`);
    if (el && id !== 'landing') el.style.display = 'none';
  });

  initLanding();
  initVoice();
  initPassport();
  initSync();

  const stored = sessionStorage.getItem('kairo_last_prompt');
  if (stored) { window._kairoGeneratedPrompt = stored; }

  console.log('%c🎙️ Kairo loaded — One Voice. All AIs.', 'color:#a855f7;font-weight:bold;font-size:14px');
});
