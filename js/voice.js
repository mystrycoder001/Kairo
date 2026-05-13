// voice.js — Web Speech API wrapper

export class VoiceRecorder {
  constructor({ onTranscript, onStatusChange, onTimerTick }) {
    this.onTranscript    = onTranscript;
    this.onStatusChange  = onStatusChange;
    this.onTimerTick     = onTimerTick;

    this.recognition     = null;
    this.state           = 'idle'; // idle | recording | paused | stopped
    this.fullTranscript  = '';
    this.timerInterval   = null;
    this.seconds         = 0;
    this.supported       = false;

    this._init();
  }

  _init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.supported = false; return; }
    this.supported = true;
    this.recognition = new SR();
    this.recognition.continuous      = true;
    this.recognition.interimResults  = true;
    this.recognition.lang            = 'en-US';

    this.recognition.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final) this.fullTranscript += final;
      this.onTranscript(this.fullTranscript, interim);
    };

    this.recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.error('SpeechRecognition error:', e.error);
      this.stop();
      this.onStatusChange('error', e.error);
    };

    this.recognition.onend = () => {
      // auto-restart if still recording (browser cuts off after ~60s)
      if (this.state === 'recording') {
        try { this.recognition.start(); } catch (_) {}
      }
    };
  }

  start() {
    if (!this.supported) return;
    this.state = 'recording';
    this.fullTranscript = '';
    this.seconds = 0;
    this.recognition.start();
    this._startTimer();
    this.onStatusChange('recording');
  }

  pause() {
    if (this.state !== 'recording') return;
    this.state = 'paused';
    try { this.recognition.stop(); } catch (_) {}
    this._stopTimer();
    this.onStatusChange('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'recording';
    try { this.recognition.start(); } catch (_) {}
    this._startTimer();
    this.onStatusChange('recording');
  }

  stop() {
    this.state = 'stopped';
    try { this.recognition.stop(); } catch (_) {}
    this._stopTimer();
    this.onStatusChange('stopped');
  }

  reset() {
    this.stop();
    this.state = 'idle';
    this.fullTranscript = '';
    this.seconds = 0;
    this.onStatusChange('idle');
  }

  _startTimer() {
    this._stopTimer();
    this.timerInterval = setInterval(() => {
      this.seconds++;
      this.onTimerTick(this._formatTime(this.seconds));
    }, 1000);
  }

  _stopTimer() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  _formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }
}
