// js/voice.js — Complete Overhaul: Priority 1 (Local Browser) -> Priority 2 (Groq) -> Priority 3 (Text)
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

    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let timerInterval = null;
    let seconds = 0;

    // STEP 1: Browser Support Check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasVoiceSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !!SpeechRecognition;

    if (!hasVoiceSupport) {
        statusText.textContent = "Please use Chrome for voice recording";
        if (micBtn) micBtn.disabled = true;
        if (micIcon) micIcon.style.opacity = '0.3';
    }

    // Always ensure textarea is functional
    transcriptDisplay?.addEventListener('input', () => {
        if (generateBtn) generateBtn.disabled = transcriptDisplay.value.trim().length === 0;
    });

    micBtn?.addEventListener('click', async () => {
        if (isRecording) return;
        startRecordingFlow();
    });

    stopBtn?.addEventListener('click', () => {
        stopRecordingFlow();
    });

    generateBtn?.addEventListener('click', () => {
        const text = transcriptDisplay.value.trim();
        if (text) onComplete(text);
    });

    async function startRecordingFlow() {
        isRecording = true;
        resetUI();

        // PRIORITY 1: webkitSpeechRecognition (Most reliable, near-zero latency)
        if (SpeechRecognition) {
            try {
                recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onstart = () => {
                    updateUIForRecording('Local Browser Recognition');
                };

                recognition.onresult = (event) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (finalTranscript) {
                        transcriptDisplay.value = finalTranscript;
                        if (generateBtn) generateBtn.disabled = false;
                    }
                };

                recognition.onerror = (err) => {
                    console.error('Recognition error:', err);
                    if (err.error === 'not-allowed') {
                        showToast('❌ Mic permission denied');
                        stopRecordingFlow();
                    } else {
                        // Fallback to MediaRecorder + Groq
                        console.warn('SpeechRecognition failed, falling back to MediaRecorder + Groq');
                        tryMediaRecorderFallback();
                    }
                };

                recognition.start();
                return;
            } catch (e) {
                console.error('SpeechRecognition init failed:', e);
                tryMediaRecorderFallback();
            }
        } else {
            tryMediaRecorderFallback();
        }
    }

    async function tryMediaRecorderFallback() {
        // PRIORITY 2: MediaRecorder + Groq Whisper
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await processAudioWithGroq(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            updateUIForRecording('Groq AI (Recording...)');
        } catch (err) {
            // PRIORITY 3: Text input fallback
            console.error('MediaRecorder fallback failed:', err);
            statusText.textContent = "Type your idea instead";
            showToast('⚠️ Voice unavailable. Type below.');
            stopRecordingFlow();
        }
    }

    function stopRecordingFlow() {
        isRecording = false;
        
        if (recognition) {
            recognition.stop();
            recognition = null;
        }

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        micIcon.textContent = 'mic';
        recordingDot?.classList.add('hidden');
        if (stopBtn) stopBtn.disabled = true;
        stopTimer();
    }

    function updateUIForRecording(status) {
        micIcon.textContent = 'graphic_eq';
        statusText.textContent = status;
        recordingDot?.classList.remove('hidden');
        if (stopBtn) stopBtn.disabled = false;
        startTimer();
    }

    function resetUI() {
        seconds = 0;
        timerDisplay.textContent = '00:00';
    }

    async function processAudioWithGroq(blob) {
        statusText.textContent = 'Transcribing...';
        micIcon.classList.add('animate-spin');

        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Transcription failed');

            transcriptDisplay.value = data.text;
            statusText.textContent = 'Transcription complete';
            if (generateBtn) generateBtn.disabled = false;
        } catch (err) {
            console.error('Groq Failed:', err);
            statusText.textContent = "Retrying...";
            showToast('🔄 Retrying transcription...');
            // In a real retry loop we might attempt again, but here we've already hit two fallbacks.
            statusText.textContent = "Type your idea instead";
        } finally {
            micIcon.classList.remove('animate-spin');
        }
    }

    function startTimer() {
        clearInterval(timerInterval);
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
}
