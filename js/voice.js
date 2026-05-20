// js/voice.js — Frontend Stabilization Pass v2 — Full diagnostic logging
import { $, showToast, logError } from './utils.js';

export function initVoice(onComplete) {
    console.log('[Voice] initVoice() called');

    // 1. Element Discovery with Defensive Checks
    const micBtn = $('mic-btn');
    if (!micBtn) {
        console.warn('[Voice] mic-btn not found in DOM, skipping init');
        return;
    }

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

    console.log('[Voice] All DOM elements found, attaching listeners');

    // 2. UI Listeners
    transcriptDisplay?.addEventListener('input', () => {
        if (generateBtn) generateBtn.disabled = transcriptDisplay.value.trim().length === 0;
    });

    micBtn.addEventListener('click', async () => {
        console.log('[Voice] Mic button clicked, isRecording:', isRecording);
        if (isRecording) {
            stopRecordingFlow();
            return;
        }
        try {
            await startRecordingFlow();
        } catch (err) {
            console.error('[Voice] startRecordingFlow threw:', err);
            logError('VoiceCapture', err);
            showToast('❌ Could not start recording: ' + (err.message || 'Unknown error'));
            cleanupRecordingState();
        }
    });

    stopBtn?.addEventListener('click', () => {
        stopRecordingFlow();
    });

    generateBtn?.addEventListener('click', () => {
        const text = transcriptDisplay?.value.trim();
        console.log('[Voice] Generate button clicked, text length:', text?.length || 0);
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
        console.log('[Voice] startRecordingFlow() called');
        if (isRecording) return;
        isRecording = true;
        resetUI();

        // Check browser capabilities
        console.log('[Voice] navigator.mediaDevices exists:', !!navigator.mediaDevices);
        console.log('[Voice] getUserMedia exists:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('[Voice] getUserMedia not available — likely not HTTPS or unsupported browser');
            showToast("⚠️ Voice capture requires HTTPS. Please use the live site.");
            if (statusText) statusText.textContent = "Voice unsupported. Please type.";
            isRecording = false;
            resetMicUI();
            return;
        }

        try {
            console.log('[Voice] Requesting microphone access...');
            if (statusText) statusText.textContent = 'Requesting mic access...';

            // Request microphone stream exactly once
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[Voice] Microphone access granted, tracks:', mediaStream.getTracks().length);
            
            // Instantly update UI to listening
            updateUIForRecording('Listening...');

            // Check supported MIME types and pick the best one
            let mimeType = '';
            const mimeOptions = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/wav'
            ];
            
            for (const mime of mimeOptions) {
                if (MediaRecorder.isTypeSupported(mime)) {
                    mimeType = mime;
                    break;
                }
            }
            
            console.log('[Voice] Selected MIME type:', mimeType || 'browser default');

            // Create MediaRecorder with best supported format
            const recorderOptions = mimeType ? { mimeType } : undefined;
            mediaRecorder = new MediaRecorder(mediaStream, recorderOptions);
            audioChunks = [];

            console.log('[Voice] MediaRecorder created, state:', mediaRecorder.state);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunks.push(e.data);
                    console.log('[Voice] Audio chunk received, size:', e.data.size);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('[Voice] MediaRecorder stopped, chunks:', audioChunks.length);
                const recordedMimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
                console.log('[Voice] Audio blob created, size:', audioBlob.size, 'type:', recordedMimeType);
                
                const ext = getAudioExtension(recordedMimeType);
                
                if (audioBlob.size < 100) {
                    console.warn('[Voice] Audio blob too small, likely empty recording');
                    showToast('⚠️ Recording too short. Please try again.');
                    if (statusText) statusText.textContent = 'Recording too short';
                    return;
                }
                
                await processAudioWithGroq(audioBlob, ext, recordedMimeType);
                
                // Cleanup tracks
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error('[Voice] MediaRecorder error:', event.error);
                showToast('❌ Recording error: ' + (event.error?.message || 'Unknown'));
                cleanupRecordingState();
            };

            mediaRecorder.start();
            console.log('[Voice] MediaRecorder started');
        } catch (err) {
            console.error('[Voice] getUserMedia or recorder setup failed:', err);
            logError('VoiceStart', err);
            const isPermDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('permission');
            const msg = isPermDenied ? '🎤 Microphone permission denied. Please allow mic access in browser settings.' : '⚠️ Voice unavailable: ' + err.message;
            if (statusText) statusText.textContent = isPermDenied ? "Permission Required" : "Type your idea instead";
            showToast(msg);
            cleanupRecordingState();
        }
    }

    function stopRecordingFlow() {
        console.log('[Voice] stopRecordingFlow() called');
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
        console.log('[Voice] processAudioWithGroq() called, blob size:', blob.size);
        if (statusText) statusText.textContent = 'Transcribing...';
        if (micIcon) micIcon.classList.add('animate-spin');

        const formData = new FormData();
        formData.append('audio', blob, `recording.${ext}`);

        try {
            console.log('[Voice] Sending audio to /api/transcribe...');
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            console.log('[Voice] Transcribe response status:', response.status);
            const data = await response.json();
            console.log('[Voice] Transcribe response data:', JSON.stringify(data));
            
            if (!response.ok) throw new Error(data.error || 'Transcription failed');

            if (transcriptDisplay) {
                const existing = transcriptDisplay.value.trim();
                transcriptDisplay.value = existing ? existing + ' ' + data.text : data.text;
                if (generateBtn) generateBtn.disabled = false;
            }
            if (statusText) statusText.textContent = 'Transcription complete ✓';
            showToast('✅ Voice transcribed successfully');
        } catch (err) {
            console.error('[Voice] Transcription API error:', err);
            logError('GroqTranscribe', err);
            if (statusText) statusText.textContent = "Transcription failed. Type below.";
            showToast('❌ Transcription failed: ' + (err.message || 'Server error'));
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

    console.log('[Voice] initVoice() complete — mic button is ready');
}
