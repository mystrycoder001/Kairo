// js/voice.js — Audio Capture Logic with Groq Whisper
import { $, showToast } from './app.js';

export function initVoice(onComplete) {
    const micBtn = $('mic-btn');
    const micIcon = $('mic-icon');
    const statusText = $('status-text');
    const transcriptDisplay = $('transcript-display');
    const recordingDot = $('recording-dot');
    const timerDisplay = $('recording-timer');
    const stopBtn = $('stop-btn');
    const generateBtn = $('generate-prompt-btn');

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let timerInterval = null;
    let seconds = 0;

    micBtn?.addEventListener('click', async () => {
        if (isRecording) return; // Prevent multiple clicks

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop()); // Stop mic
            };

            mediaRecorder.start();
            isRecording = true;
            
            // Update UI
            micIcon.textContent = 'graphic_eq';
            statusText.textContent = 'Listening...';
            recordingDot?.classList.remove('hidden');
            if(stopBtn) stopBtn.disabled = false;
            startTimer();

        } catch (err) {
            showToast('❌ Microphone access denied or unavailable.');
            console.error(err);
        }
    });

    stopBtn?.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;

            // Update UI immediately
            micIcon.textContent = 'mic';
            statusText.textContent = 'Transcribing...';
            recordingDot?.classList.add('hidden');
            stopBtn.disabled = true;
            stopTimer();
        }
    });

    generateBtn?.addEventListener('click', () => {
        const text = transcriptDisplay.value.trim();
        if(text) onComplete(text);
    });

    function startTimer() {
        seconds = 0;
        timerDisplay.textContent = '00:00';
        timerInterval = setInterval(() => {
            seconds++;
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            timerDisplay.textContent = `${m}:${s}`;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    async function processAudio(blob) {
        statusText.textContent = 'Transcribing via Groq Whisper...';
        micIcon.classList.add('animate-spin');

        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            // First check if response is JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("API returned non-JSON response");
            }

            const data = await response.json();
            if(!response.ok) throw new Error(data.error || 'Transcription failed');

            transcriptDisplay.value = data.text;
            statusText.textContent = 'Transcription complete';
            if(generateBtn) generateBtn.disabled = false;
        } catch (err) {
            console.error('Groq Transcription Failed, Retrying with Web Speech API:', err);
            statusText.textContent = 'Retrying...';
            showToast('🔄 Groq busy. Falling back to local AI...');
            
            // FALLBACK: Use Web Speech API for local transcription
            try {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) throw new Error('Web Speech API not supported');

                const recognition = new SpeechRecognition();
                recognition.lang = 'en-US';
                recognition.interimResults = false;
                recognition.maxAlternatives = 1;

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    transcriptDisplay.value = transcript;
                    statusText.textContent = 'Transcription complete (Local fallback)';
                    if(generateBtn) generateBtn.disabled = false;
                };

                recognition.onerror = () => {
                    statusText.textContent = 'Error';
                    showToast('❌ Local transcription also failed.');
                };

                recognition.start();
                showToast('🎤 Speak now for local backup...');
            } catch (fallbackErr) {
                showToast('❌ Transcription unavailable in this browser.');
                statusText.textContent = 'Error';
            }
        } finally {
            micIcon.classList.remove('animate-spin');
        }
    }
}
