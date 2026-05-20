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
    document.getElementById('mic-btn').classList.add('recording')
    document.getElementById('mic-btn').textContent = '⏹'
    document.getElementById('mic-status').textContent = 'Recording... Click to stop'
    document.getElementById('waveform').style.display = 'block'
    console.log('Recording started')
  }
  
  recognition.onresult = (event) => {
    let transcript = ''
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript
    }
    document.getElementById('voice-transcript').value = transcript
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
  document.getElementById('mic-btn').classList.remove('recording')
  document.getElementById('mic-btn').textContent = '🎤'
  document.getElementById('mic-status').textContent = 'Click to start recording'
  document.getElementById('waveform').style.display = 'none'
}

async function generatePromptFromVoice() {
  const transcript = document
    .getElementById('voice-transcript').value.trim()
  
  if (!transcript) {
    alert('Please record or type something first')
    return
  }
  
  const btn = document.getElementById('generate-btn')
  btn.textContent = 'Generating...'
  btn.disabled = true
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    const response = await fetch('/api/generate-prompt', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (session?.access_token || '')
      },
      body: JSON.stringify({ 
        text: transcript,
        transcript: transcript 
      })
    })
    
    const data = await response.json()
    console.log('API response:', data)
    
    const prompt = data.result || data.prompt || data.text || ''
    
    if (prompt) {
      document.getElementById('prompt-output').textContent = prompt
      document.getElementById('prompt-output-container').style.display = 'block'
      document.getElementById('prompt-output-container')
        .scrollIntoView({ behavior: 'smooth' })
    } else {
      alert('No prompt generated. Check API keys in Vercel.')
    }
    
  } catch(err) {
    console.error('Generate error:', err)
    alert('Error: ' + err.message)
  } finally {
    btn.textContent = '✦ Generate Prompt'
    btn.disabled = false
  }
}

function copyPrompt() {
  const text = document.getElementById('prompt-output').textContent
  navigator.clipboard.writeText(text).then(() => {
    const btn = window.event?.target || document.querySelector('#prompt-output-container button[onclick="copyPrompt()"]');
    if (btn) {
      btn.textContent = 'Copied!'
      setTimeout(() => btn.textContent = 'Copy', 2000)
    }
  })
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
