(() => {
  const ENQUIRY = 'https://www.getclientcapture.co.uk/enquiry.html';
  const shell = document.getElementById('atlasShell');
  const launch = document.getElementById('atlasLaunch');
  const close = document.getElementById('atlasClose');
  const messagesEl = document.getElementById('atlasMessages');
  const form = document.getElementById('atlasForm');
  const input = document.getElementById('atlasInput');
  const mic = document.getElementById('atlasMic');
  const voiceToggle = document.getElementById('atlasVoice');
  const replayButton = document.getElementById('atlasReplay');
  const stopButton = document.getElementById('atlasStop');
  const suggestions = document.querySelectorAll('[data-atlas-prompt]');

  let history = [];
  let busy = false;
  let speakReplies = localStorage.getItem('atlas_voice') !== 'off';
  let currentAudio = null;
  let currentAudioUrl = '';
  let lastSpokenText = '';
  let speechRequest = null;

  const addMessage = (text, type = 'bot', isHTML = false) => {
    const div = document.createElement('div');
    div.className = `atlas-msg ${type}`;
    if (isHTML) div.innerHTML = text;
    else div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  };

  function setVoiceUI() {
    voiceToggle.textContent = speakReplies ? '🔊' : '🔇';
    voiceToggle.setAttribute('aria-label', speakReplies ? 'Mute Atlas replies' : 'Enable spoken Atlas replies');
    voiceToggle.title = speakReplies ? 'Voice on' : 'Voice off';
  }

  function stopVoice() {
    if (speechRequest) {
      speechRequest.abort();
      speechRequest = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = '';
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    document.body.classList.remove('atlas-speaking');
  }

  function browserVoiceFallback(text) {
    if (!speakReplies || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, ''));
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v => /Daniel|Arthur|George|Ryan|Oliver/i.test(v.name)) ||
      voices.find(v => /^en[-_](GB|IE)/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 0.9;
    utterance.pitch = 0.88;
    utterance.volume = 0.9;
    utterance.onstart = () => document.body.classList.add('atlas-speaking');
    utterance.onend = () => document.body.classList.remove('atlas-speaking');
    utterance.onerror = () => document.body.classList.remove('atlas-speaking');
    speechSynthesis.speak(utterance);
  }

  async function speak(text, { replay = false } = {}) {
    const clean = String(text || '').replace(/https?:\/\/\S+/g, '').trim();
    if (!clean || !speakReplies) return;
    if (!replay) lastSpokenText = clean;
    stopVoice();

    speechRequest = new AbortController();
    document.body.classList.add('atlas-speaking');

    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean }),
        signal: speechRequest.signal
      });
      if (!response.ok) throw new Error('Premium voice unavailable');

      const blob = await response.blob();
      currentAudioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentAudioUrl);
      currentAudio.preload = 'auto';
      currentAudio.volume = 0.94;
      currentAudio.playbackRate = 0.97;
      currentAudio.onended = stopVoice;
      currentAudio.onerror = () => {
        stopVoice();
        browserVoiceFallback(clean);
      };
      await currentAudio.play();
    } catch (error) {
      if (error.name !== 'AbortError') browserVoiceFallback(clean);
      else document.body.classList.remove('atlas-speaking');
    } finally {
      speechRequest = null;
    }
  }

  const openChat = () => {
    shell.classList.add('open');
    shell.setAttribute('aria-hidden', 'false');
    setTimeout(() => input.focus(), 120);
  };

  const closeChat = () => {
    shell.classList.remove('open');
    shell.setAttribute('aria-hidden', 'true');
    stopVoice();
  };

  launch.addEventListener('click', openChat);
  close.addEventListener('click', closeChat);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && shell.classList.contains('open')) closeChat();
  });

  setVoiceUI();
  voiceToggle.addEventListener('click', () => {
    speakReplies = !speakReplies;
    localStorage.setItem('atlas_voice', speakReplies ? 'on' : 'off');
    setVoiceUI();
    if (!speakReplies) stopVoice();
    else if (lastSpokenText) speak(lastSpokenText, { replay: true });
  });
  stopButton?.addEventListener('click', stopVoice);
  replayButton?.addEventListener('click', () => {
    if (lastSpokenText && speakReplies) speak(lastSpokenText, { replay: true });
  });

  const setBusy = state => {
    busy = state;
    input.disabled = state;
    form.querySelector('.atlas-send').disabled = state;
  };

  async function askAtlas(question) {
    const clean = question.trim().slice(0, 800);
    if (!clean || busy) return;
    stopVoice();
    addMessage(clean, 'user');
    input.value = '';
    input.style.height = '42px';
    setBusy(true);
    const typing = addMessage('', 'bot');
    typing.innerHTML = '<span class="atlas-typing"><i></i><i></i><i></i></span>';

    try {
      const response = await fetch('/api/atlas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, history: history.slice(-8) })
      });
      const data = await response.json().catch(() => ({}));
      typing.remove();
      if (!response.ok) throw new Error(data.error || 'Atlas is temporarily unavailable.');
      const answer = String(data.reply || '').trim();
      addMessage(answer || 'I could not form a reply. Please use the enquiry form and Ross will help directly.', 'bot');
      history.push({ role: 'user', content: clean }, { role: 'assistant', content: answer });
      history = history.slice(-10);
      speak(answer);
    } catch (error) {
      typing.remove();
      addMessage(`${error.message}\n\nYou can still start your project using the enquiry form below.`, 'error');
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    askAtlas(input.value);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = '42px';
    input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
  });
  suggestions.forEach(btn => btn.addEventListener('click', () => {
    openChat();
    askAtlas(btn.dataset.atlasPrompt);
  }));

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      stopVoice();
      mic.classList.add('atlas-listening');
      mic.textContent = '●';
    };
    recognition.onend = () => {
      mic.classList.remove('atlas-listening');
      mic.textContent = '🎙';
    };
    recognition.onerror = () => {
      mic.classList.remove('atlas-listening');
      mic.textContent = '🎙';
    };
    recognition.onresult = event => {
      const text = event.results[0][0].transcript;
      input.value = text;
      askAtlas(text);
    };
    mic.addEventListener('click', () => {
      try { recognition.start(); } catch (_) {}
    });
  } else {
    mic.hidden = true;
  }

  addMessage('I’m Atlas, your guide to ClientCapture. Tell me what your business does and I’ll recommend the strongest digital front desk, portal or immersive experience for you.');
  addMessage(`Ready to begin? <a class="atlas-enquire" href="${ENQUIRY}" target="_blank" rel="noopener">Start Your World →</a>`, 'bot', true);
})();
