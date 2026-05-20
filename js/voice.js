// js/voice.js — Frontend Stabilization Pass
import { $, showToast, logError } from './utils.js';

export function initVoice(onComplete) {
    // 1. Element Discovery with Defensive Checks
    const micBtn = $('mic-btn');
    if (!micBtn) return; // Exit early if not on a screen with mic

    const micIcon = $('mic-icon');
    const micRings = $('mic-rings');
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
    let mediaStream = null;

    // 2. UI Listeners
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
            cleanupRecordingState();
        }
    });

    stopBtn?.addEventListener('click', () => {
        stopRecordingFlow();
    });

    generateBtn?.addEventListener('click', () => {
        const text = transcriptDisplay?.value.trim();
        if (text) onComplete(text);
    });

    // Audio type detection helper
    function getAudioExtension(mimeType) {
        if (mimeType.includes('webm')) return 'webm';
        if (mimeType.includes('mp4') || mimeType.includes('aac') || mimeType.includes('m4a')) return 'm4a';
        if (mimeType.includes('ogg')) return 'ogg';
        if (mimeType.includes('wav')) return 'wav';
        return 'webm';
    }

    // 3. Recording Logic
    async function startRecordingFlow() {
        if (isRecording) return;
        isRecording = true;
        resetUI();

        // Check browser capabilities
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast("⚠️ Voice capture is not supported in this browser context (requires HTTPS).");
            if (statusText) statusText.textContent = "Voice unsupported. Please type.";
            isRecording = false;
            resetMicUI();
            return;
        }

        try {
            // Request microphone stream exactly once
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Instantly update UI to listening
            updateUIForRecording('Listening...');

            // Create MediaRecorder - let browser choose its default format
            mediaRecorder = new MediaRecorder(mediaStream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const recordedMimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
                const ext = getAudioExtension(recordedMimeType);
                
                await processAudioWithGroq(audioBlob, ext, recordedMimeType);
                
                // Cleanup tracks
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorder.start();
        } catch (err) {
            logError('VoiceStart', err);
            const isPermDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('permission');
            const msg = isPermDenied ? '🎤 Microphone permission denied' : '⚠️ Voice unavailable or unsupported';
            if (statusText) statusText.textContent = isPermDenied ? "Permission Required" : "Type your idea instead";
            showToast(msg);
            cleanupRecordingState();
        }
    }

    function stopRecordingFlow() {
        if (!isRecording) return;
        isRecording = false;
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try { mediaRecorder.stop(); } catch(e) { logError('MediaRecorderStop', e); }
        }
        
        resetMicUI();
        stopTimer();
        if (statusText) statusText.textContent = 'Recording complete';
    }

    function cleanupRecordingState() {
        isRecording = false;
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        resetMicUI();
        stopTimer();
    }

    function resetMicUI() {
        if (micIcon) {
            micIcon.textContent = 'mic';
            micIcon.classList.remove('animate-pulse');
        }
        if (micRings) micRings.classList.add('hidden');
        recordingDot?.classList.add('hidden');
        if (stopBtn) stopBtn.disabled = true;
    }

    function updateUIForRecording(status) {
        if (micIcon) {
            micIcon.textContent = 'graphic_eq';
            micIcon.classList.add('animate-pulse');
        }
        if (micRings) micRings.classList.remove('hidden');
        if (statusText) statusText.textContent = status || 'Capture Active';
        recordingDot?.classList.remove('hidden');
        if (stopBtn) stopBtn.disabled = false;
        startTimer();
    }

    function resetUI() {
        seconds = 0;
        if (timerDisplay) timerDisplay.textContent = '00:00';
    }

    async function processAudioWithGroq(blob, ext, mimeType) {
        if (statusText) statusText.textContent = 'Transcribing...';
        if (micIcon) micIcon.classList.add('animate-spin');

        const formData = new FormData();
        formData.append('audio', blob, `recording.${ext}`);

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Transcription failed');

            if (transcriptDisplay) {
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
            if (micIcon) micIcon.classList.remove('animate-spin');
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
