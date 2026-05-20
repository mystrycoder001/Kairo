import { supabase } from './auth.js';

let recognition = null
let isRecording = false

function toggleRecording() {
  if (isRecording) {
    stopRecording()
  } else {
    startRecording()
  }
}

function startRecording() {
  const SpeechRecognition = 
    window.SpeechRecognition || 
    window.webkitSpeechRecognition
  
  if (!SpeechRecognition) {
    alert('Voice not supported in this browser. Please use Chrome.')
    return
  }
  
  recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'
  
  recognition.onstart = () => {
    isRecording = true
    const micBtn = document.getElementById('mic-btn')
    if (micBtn) {
      micBtn.classList.add('recording')
      micBtn.textContent = '⏹'
    }
    const micStatus = document.getElementById('mic-status')
    if (micStatus) {
      micStatus.textContent = 'Recording... Click to stop'
    }
    const waveform = document.getElementById('waveform')
    if (waveform) {
      waveform.style.display = 'block'
    }
    console.log('Recording started')
  }
  
  recognition.onresult = (event) => {
    let transcript = ''
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript
    }
    const transcriptEl = document.getElementById('voice-transcript')
    if (transcriptEl) {
      transcriptEl.value = transcript
    }
    console.log('Transcript:', transcript)
  }
  
  recognition.onerror = (event) => {
    console.error('Speech error:', event.error)
    if (event.error === 'not-allowed') {
      alert('Microphone permission denied. Please allow microphone access.')
    }
    stopRecording()
  }
  
  recognition.onend = () => {
    if (isRecording) {
      recognition.start()
    }
  }
  
  recognition.start()
}

function stopRecording() {
  isRecording = false
  if (recognition) recognition.stop()
  const micBtn = document.getElementById('mic-btn')
  if (micBtn) {
    micBtn.classList.remove('recording')
    micBtn.textContent = '🎤'
  }
  const micStatus = document.getElementById('mic-status')
  if (micStatus) {
    micStatus.textContent = 'Click to start recording'
  }
  const waveform = document.getElementById('waveform')
  if (waveform) {
    waveform.style.display = 'none'
  }
}

async function generatePromptFromVoice() {
  const transcriptEl = document.getElementById('voice-transcript')
  const transcript = transcriptEl?.value?.trim()
  
  if (!transcript) { 
    alert('Please record or type something first')
    return 
  }
  
  const btn = document.getElementById('generate-voice-btn') ||
    document.querySelector('button[onclick*="generatePromptFromVoice"]') ||
    document.querySelector('#screen-voice button:last-of-type')
  
  const originalText = btn?.textContent || '✦ Generate Prompt'
  if (btn) { btn.textContent = 'Generating...'; btn.disabled = true }
  
  try {
    const { data: { session } } = await window.supabase.auth.getSession()
    
    const res = await fetch('/api/generate-prompt', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (session?.access_token || '')
      },
      body: JSON.stringify({ text: transcript, transcript: transcript })
    })
    
    const data = await res.json()
    console.log('API response:', data)
    
    const prompt = data.result || data.prompt || data.text || ''
    
    if (!prompt) {
      alert('No prompt returned. Error: ' + JSON.stringify(data))
      return
    }
    
    // Remove any existing output
    const existing = document.getElementById('dynamic-output')
    if (existing) existing.remove()
    
    // Create output div dynamically
    const outputDiv = document.createElement('div')
    outputDiv.id = 'dynamic-output'
    outputDiv.style.cssText = `
      margin-top: 24px;
      background: #111;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      text-align: left;
    `
    outputDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;
        align-items:center;margin-bottom:12px">
        <span style="color:#888;font-size:12px;
          text-transform:uppercase;letter-spacing:1px">
          Generated Prompt
        </span>
        <div style="display:flex;gap:8px">
          <button id="copy-prompt-btn" style="
            background:#222;border:1px solid #333;
            color:white;padding:6px 16px;
            border-radius:8px;cursor:pointer;font-size:13px">
            Copy
          </button>
          <button onclick="window.open('https://chat.openai.com','_blank')" style="
            background:#222;border:1px solid #333;
            color:white;padding:6px 16px;
            border-radius:8px;cursor:pointer;font-size:13px">
            ChatGPT
          </button>
          <button onclick="window.open('https://claude.ai','_blank')" style="
            background:#222;border:1px solid #333;
            color:white;padding:6px 16px;
            border-radius:8px;cursor:pointer;font-size:13px">
            Claude
          </button>
        </div>
      </div>
      <p id="final-prompt-text" style="
        color:white;font-size:15px;
        line-height:1.6;margin:0;
        white-space:pre-wrap">${prompt}</p>
    `
    
    // Add copy functionality
    outputDiv.querySelector('#copy-prompt-btn').onclick = () => {
      navigator.clipboard.writeText(prompt)
      outputDiv.querySelector('#copy-prompt-btn').textContent = 'Copied!'
      setTimeout(() => {
        outputDiv.querySelector('#copy-prompt-btn').textContent = 'Copy'
      }, 2000)
    }
    
    // Append to voice screen
    const screen = document.getElementById('screen-voice')
    if (screen) {
      screen.querySelector('[style*="max-width"]')?.appendChild(outputDiv) ||
      screen.appendChild(outputDiv)
    } else {
      document.body.appendChild(outputDiv)
    }
    
    outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    console.log('Prompt displayed successfully')
    
  } catch(err) {
    console.error('Generate error:', err)
    alert('Error: ' + err.message)
  } finally {
    if (btn) { btn.textContent = originalText; btn.disabled = false }
  }
}

function copyPrompt() {
  const text = document.getElementById('prompt-output')?.textContent || document.getElementById('voice-prompt-output')?.textContent
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = window.event?.target || document.querySelector('#prompt-output-container button[onclick="copyPrompt()"]');
      if (btn) {
        btn.textContent = 'Copied!'
        setTimeout(() => btn.textContent = 'Copy', 2000)
      }
    })
  }
}

// Bind to window so inline onclick handlers in HTML can access them
window.toggleRecording = toggleRecording;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.generatePromptFromVoice = generatePromptFromVoice;
window.copyPrompt = copyPrompt;

// Keep app.js export happy
export function initVoice() {
  console.log('[Voice] Speech Recognition system bound successfully.');
}
