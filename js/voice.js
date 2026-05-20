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
              document.querySelector('[onclick*="generatePromptFromVoice"]')
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
    const prompt = data.result || data.prompt || data.text || ''
    
    if (prompt) {
      // Try multiple possible output element IDs
      const outputEl = 
        document.getElementById('voice-prompt-output') ||
        document.getElementById('prompt-output') ||
        document.getElementById('voice-output')
      
      const containerEl = 
        document.getElementById('voice-output-container') ||
        document.getElementById('prompt-output-container') ||
        document.getElementById('voice-output-wrapper')
      
      if (outputEl) outputEl.textContent = prompt
      if (containerEl) containerEl.style.display = 'block'
      
      // If elements still not found, create them dynamically
      if (!outputEl) {
        const div = document.createElement('div')
        div.style.cssText = 'background:#111;border:1px solid #333;border-radius:12px;padding:20px;margin-top:24px;color:white;white-space:pre-wrap;font-size:15px;line-height:1.6;text-align:left'
        div.textContent = prompt
        
        const copyBtn = document.createElement('button')
        copyBtn.textContent = 'Copy Prompt'
        copyBtn.style.cssText = 'margin-top:12px;background:white;color:black;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-weight:700'
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(prompt)
          copyBtn.textContent = 'Copied!'
          setTimeout(() => copyBtn.textContent = 'Copy Prompt', 2000)
        }
        
        const wrapper = document.createElement('div')
        wrapper.appendChild(div)
        wrapper.appendChild(copyBtn)
        
        const screen = document.getElementById('screen-voice')
        if (screen) screen.appendChild(wrapper)
      }
      
    } else {
      alert('Error: ' + JSON.stringify(data))
    }
    
  } catch(err) {
    console.error('Generate error:', err)
    alert('Error generating prompt: ' + err.message)
  } finally {
    if (btn) { btn.textContent = '✦ Generate Prompt'; btn.disabled = false }
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
