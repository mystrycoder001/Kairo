// js/voice.js — Frontend Stabilization Pass
import { $, showToast, logError } from './app.js';

export function initVoice(onComplete) {
    // 1. Element Discovery with Defensive Checks
    const micBtn = $('mic-btn');
    if (!micBtn) return; // Exit early if not on a screen with mic

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

    // 2. Browser Support Check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasVoiceSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !!SpeechRecognition;

    if (!hasVoiceSupport) {
        if (statusText) statusText.textContent = "Voice recording not supported in this browser.";
        micBtn.disabled = true;
        if (micIcon) micIcon.style.opacity = '0.3';
    }

    // 3. UI Listeners
    transcriptDisplay?.addEventListener('input', () => {
        if (generateBtn) generateBtn.disabled = transcriptDisplay.value.trim().length === 0;
    });

    micBtn.addEventListener('click', async () => {
        if (isRecording) {
            stopRecordingFlow();
            return;
        }
        try {
            await startRecordingFlow();
        } catch (err) {
            logError('VoiceCapture', err);
            showToast('❌ Could not start recording');
            isRecording = false; // Ensure reset on error
        }
    });

    stopBtn?.addEventListener('click', () => {
        stopRecordingFlow();
    });

    generateBtn?.addEventListener('click', () => {
        const text = transcriptDisplay?.value.trim();
        if (text) onComplete(text);
    });

    // 4. Recording Logic
    async function startRecordingFlow() {
        isRecording = true;
        resetUI();

        // Check for mic permission first
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            isRecording = false;
            showToast('🎤 Microphone permission required');
            return;
        }

        if (SpeechRecognition) {
            try {
                recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                let fullTranscript = transcriptDisplay?.value || '';

                recognition.onstart = () => updateUIForRecording('Listening...');
                recognition.onresult = (event) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                    }
                    if (finalTranscript && transcriptDisplay) {
                        // FIXED: Append instead of overwrite
                        fullTranscript = (fullTranscript ? fullTranscript + ' ' : '') + finalTranscript;
                        transcriptDisplay.value = fullTranscript.trim();
                        if (generateBtn) generateBtn.disabled = false;
                    }
                };
                recognition.onerror = (err) => {
                    logError('SpeechRecognition', err);
                    // Only fallback if it's a serious error, not end-of-speech
                    if (err.error !== 'no-speech' && err.error !== 'aborted') {
                        tryMediaRecorderFallback();
                    }
                };
                recognition.onend = () => {
                    // Auto-restart if still recording (handles Chrome's auto-stop)
                    if (isRecording && recognition) {
                        try { recognition.start(); } catch(e) { /* already started */ }
                    }
                };
                recognition.start();
                return;
            } catch (e) {
                logError('SpeechRecognitionInit', e);
                tryMediaRecorderFallback();
            }
        } else {
            tryMediaRecorderFallback();
        }
    }

    async function tryMediaRecorderFallback() {
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
            updateUIForRecording('Neural Sync (Recording...)');
        } catch (err) {
            logError('MediaRecorderFallback', err);
            if (statusText) statusText.textContent = "Type your idea instead";
            showToast('⚠️ Voice unavailable');
            isRecording = false;
            resetMicUI();
        }
    }

    function stopRecordingFlow() {
        isRecording = false;
        if (recognition) {
            try { recognition.stop(); } catch(e) { /* ignore */ }
            recognition = null;
        }
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        resetMicUI();
        stopTimer();
        if (statusText) statusText.textContent = 'Recording complete';
    }

    function resetMicUI() {
        if (micIcon) micIcon.textContent = 'mic';
        if (micIcon) micIcon.classList.remove('animate-spin');
        recordingDot?.classList.add('hidden');
        if (stopBtn) stopBtn.disabled = true;
    }

    function updateUIForRecording(status) {
        if (micIcon) micIcon.textContent = 'graphic_eq';
        if (statusText) statusText.textContent = status || 'Capture Active';
        recordingDot?.classList.remove('hidden');
        if (stopBtn) stopBtn.disabled = false;
        startTimer();
    }

    function resetUI() {
        seconds = 0;
        if (timerDisplay) timerDisplay.textContent = '00:00';
    }

    async function processAudioWithGroq(blob) {
        if (statusText) statusText.textContent = 'Transcribing...';
        micIcon?.classList.add('animate-spin');

        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Transcription failed');

            if (transcriptDisplay) {
                // Append transcription to existing text
                const existing = transcriptDisplay.value.trim();
                transcriptDisplay.value = existing ? existing + ' ' + data.text : data.text;
                if (generateBtn) generateBtn.disabled = false;
            }
            if (statusText) statusText.textContent = 'Transcription complete';
        } catch (err) {
            logError('GroqTranscribe', err);
            if (statusText) statusText.textContent = "Voice unavailable. Type below.";
            showToast('❌ Transcription failed');
        } finally {
            micIcon?.classList.remove('animate-spin');
        }
    }

    function startTimer() {
        clearInterval(timerInterval);
        seconds = 0;
        timerInterval = setInterval(() => {
            seconds++;
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            if (timerDisplay) timerDisplay.textContent = `${m}:${s}`;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }
}
