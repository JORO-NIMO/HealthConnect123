/**
 * HealthConnect — Consultation Room (WebRTC + Socket.IO + Chat)
 * Works for both doctor and patient roles
 */

(async () => {
  const user = Auth.requireRole('patient', 'doctor');
  if (!user) return;

  const apptId = Utils.getParam('apptId');
  const roomId = Utils.getParam('roomId');

  // ─── State ────────────────────────────────────────────────────────────
  let localStream    = null;
  let peerConnection = null;
  let socket         = null;
  let isMicOn        = true;
  let isCamOn        = true;
  let isScreenSharing = false;
  let consultationId = null;
  let callStartTime  = null;
  let timerInterval  = null;
  let currentRoomId  = roomId || null;

  const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // ─── Load consultation ────────────────────────────────────────────────
  async function initConsultation() {
    try {
      if (apptId) {
        // Start or retrieve consultation
        const res = await API.post(`/appointments/${apptId}/consultation/start`, {});
        consultationId = res.data?.consultation?.id;
        currentRoomId  = res.data?.consultation?.roomId;
      }
      await initMedia();
      connectSocket();
      loadChatHistory();
    } catch (err) {
      updateStatus(`Error: ${err.message}`, false);
    }
  }

  // ─── Media ────────────────────────────────────────────────────────────
  async function initMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      document.getElementById('local-video').srcObject = localStream;
      document.getElementById('local-no-video').classList.add('hidden');
    } catch {
      updateStatus('Camera/mic access denied', false);
    }
  }

  window.toggleMic = function () {
    isMicOn = !isMicOn;
    localStream?.getAudioTracks().forEach(t => { t.enabled = isMicOn; });
    document.getElementById('mic-btn').textContent = isMicOn ? '🎤' : '🔇';
    document.getElementById('mic-btn').style.background = isMicOn ? 'var(--surface2)' : 'var(--red)';
  };

  window.toggleCamera = function () {
    isCamOn = !isCamOn;
    localStream?.getVideoTracks().forEach(t => { t.enabled = isCamOn; });
    document.getElementById('cam-btn').textContent = isCamOn ? '📹' : '📷';
    document.getElementById('cam-btn').style.background = isCamOn ? 'var(--surface2)' : 'var(--red)';
    document.getElementById('local-no-video').classList.toggle('hidden', isCamOn);
  };

  window.toggleScreenShare = async function () {
    if (isScreenSharing) {
      // Revert to camera
      const camTrack = localStream?.getVideoTracks()[0];
      if (peerConnection && camTrack) {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(camTrack);
      }
      isScreenSharing = false;
      document.getElementById('screen-btn').classList.remove('bg-primary');
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack  = screenStream.getVideoTracks()[0];
        if (peerConnection) {
          const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(screenTrack);
        }
        screenTrack.onended = () => window.toggleScreenShare();
        isScreenSharing = true;
        document.getElementById('screen-btn').classList.add('bg-primary');
      } catch { /* denied */ }
    }
  };

  // ─── Socket.IO ────────────────────────────────────────────────────────
  function connectSocket() {
    if (typeof io === 'undefined') return;

    socket = io(CONFIG.SOCKET_URL, {
      auth: { token: Auth.getToken() },
    });

    socket.on('connect', () => {
      updateStatus('Connected', true);
      socket.emit('join-room', { roomId: currentRoomId, userId: user.id });
    });

    socket.on('user-joined', async ({ userId }) => {
      if (userId !== user.id) {
        updateStatus('Peer connected — starting call', true);
        await createOffer();
      }
    });

    socket.on('webrtc-offer', async ({ offer }) => {
      await createAnswer(offer);
    });

    socket.on('webrtc-answer', async ({ answer }) => {
      await peerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('webrtc-ice', async ({ candidate }) => {
      try { await peerConnection?.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
    });

    socket.on('new-message', msg => appendChatMessage(msg));

    socket.on('user-left', () => {
      updateStatus('Peer disconnected', false);
      document.getElementById('remote-video').srcObject = null;
      document.getElementById('no-video-placeholder').classList.remove('hidden');
    });

    socket.on('disconnect', () => updateStatus('Disconnected', false));
  }

  // ─── WebRTC ───────────────────────────────────────────────────────────
  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    localStream?.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    peerConnection.ontrack = ({ streams }) => {
      document.getElementById('remote-video').srcObject = streams[0];
      document.getElementById('no-video-placeholder').classList.add('hidden');
      startTimer();
    };

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) socket?.emit('webrtc-ice', { roomId: currentRoomId, candidate });
    };
  }

  async function createOffer() {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket?.emit('webrtc-offer', { roomId: currentRoomId, offer });
  }

  async function createAnswer(offer) {
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket?.emit('webrtc-answer', { roomId: currentRoomId, answer });
  }

  // ─── Timer ────────────────────────────────────────────────────────────
  function startTimer() {
    callStartTime = Date.now();
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      document.getElementById('timer').textContent = `${m}:${s}`;
    }, 1000);
  }

  // ─── End Consultation ─────────────────────────────────────────────────
  window.endConsultation = async function () {
    if (!confirm('End this consultation?')) return;
    try {
      if (consultationId) await API.post(`/consultations/${consultationId}/end`, {});
    } catch { }
    cleanup();
    window.location.href = user.role === 'doctor'
      ? '/pages/doctor/dashboard.html'
      : '/pages/patient/dashboard.html';
  };

  function cleanup() {
    clearInterval(timerInterval);
    localStream?.getTracks().forEach(t => t.stop());
    peerConnection?.close();
    socket?.disconnect();
  }

  // ─── Chat ─────────────────────────────────────────────────────────────
  async function loadChatHistory() {
    if (!consultationId) return;
    try {
      const res = await API.get(`/consultations/${consultationId}/messages`);
      (res.data?.messages || []).forEach(appendChatMessage);
    } catch { }
  }

  window.sendMessage = function () {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';

    if (socket && currentRoomId) {
      socket.emit('send-message', {
        roomId: currentRoomId,
        consultationId,
        message: text,
      });
    }
    appendChatMessage({ senderName: 'You', message: text, isSelf: true, createdAt: new Date() });
  };

  function appendChatMessage({ senderName, message, isSelf, senderId, createdAt }) {
    const self = isSelf || senderId === user.id;
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `max-w-[80%] ${self ? 'ml-auto' : ''}`;
    div.innerHTML = `
      <div class="chat-bubble-${self ? 'out' : 'in'} px-3 py-2 rounded-2xl text-sm leading-relaxed">
        ${Utils.escapeHtml(message)}
      </div>
      <div class="text-xs mt-0.5 ${self ? 'text-right' : ''}" style="color:var(--text3)">${Utils.formatTime(createdAt)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ─── Prescription ─────────────────────────────────────────────────────
  window.addRxItem = function () {
    const container = document.getElementById('rx-items');
    const item = document.createElement('div');
    item.className = 'rx-item rounded-xl p-3 space-y-2';
    item.style.background = 'var(--bg2)';
    item.style.border = '1px solid var(--border)';
    item.innerHTML = `
      <div class="flex justify-between">
        <input type="text" placeholder="Medication name" class="rx-med input-dark flex-1">
        <button onclick="this.closest('.rx-item').remove()" class="ml-2" style="color:var(--text3)">×</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Dosage" class="rx-dosage input-dark">
        <input type="text" placeholder="Frequency" class="rx-freq input-dark">
      </div>
      <input type="text" placeholder="Duration" class="rx-duration input-dark">`;
    container.appendChild(item);
  };

  window.submitPrescription = async function () {
    if (!consultationId) return Utils.showAlert('rx-alert', 'No active consultation', 'error');
    const btn = document.getElementById('submit-rx-btn');
    Utils.setLoading(btn, true, 'Issuing…');
    Utils.hideAlert('rx-alert');

    const items = [...document.querySelectorAll('.rx-item')].map(item => ({
      medicationName: item.querySelector('.rx-med')?.value?.trim(),
      dosage:         item.querySelector('.rx-dosage')?.value?.trim(),
      frequency:      item.querySelector('.rx-freq')?.value?.trim(),
      duration:       item.querySelector('.rx-duration')?.value?.trim(),
    })).filter(i => i.medicationName);

    if (!items.length) {
      Utils.setLoading(btn, false);
      return Utils.showAlert('rx-alert', 'Add at least one medication', 'error');
    }

    try {
      await API.post(`/consultations/${consultationId}/prescriptions`, {
        diagnosis: document.getElementById('rx-diagnosis').value.trim(),
        items,
        notes: document.getElementById('rx-notes').value.trim() || undefined,
      });
      Utils.showAlert('rx-alert', 'Prescription issued!', 'success');
    } catch (err) {
      Utils.showAlert('rx-alert', err.message || 'Failed to issue prescription', 'error');
    } finally {
      Utils.setLoading(btn, false);
    }
  };

  // ─── Status indicator ─────────────────────────────────────────────────
  function updateStatus(text, online) {
    document.getElementById('status-text').textContent = text;
    document.getElementById('status-dot').style.background = online ? 'var(--green)' : 'var(--text3)';
    document.getElementById('status-dot').className = 'w-2 h-2 rounded-full';
  }

  // Update remote user name if available
  document.getElementById('remote-name').textContent = user.role === 'doctor' ? 'Patient' : 'Doctor';

  window.addEventListener('beforeunload', cleanup);

  await initConsultation();
})();
