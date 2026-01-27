// Variables globales
let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let recordings = [];

// Elementos del DOM
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const timer = document.getElementById('timer');
const recordingStatus = document.getElementById('recordingStatus');
const audioPreview = document.getElementById('audioPreview');
const previewPlayer = document.getElementById('previewPlayer');
const sessionTitle = document.getElementById('sessionTitle');
const sessionNotes = document.getElementById('sessionNotes');
const saveBtn = document.getElementById('saveBtn');
const discardBtn = document.getElementById('discardBtn');
const recordingsList = document.getElementById('recordingsList');
const emptyState = document.getElementById('emptyState');
const downloadAllBtn = document.getElementById('downloadAllBtn');

// Inicializar la app
function init() {
    loadRecordings();
    renderRecordings();
    
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    saveBtn.addEventListener('click', saveRecording);
    discardBtn.addEventListener('click', discardRecording);
    downloadAllBtn.addEventListener('click', downloadAllRecordings);
}

// Iniciar grabación
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            previewPlayer.src = audioUrl;
            previewPlayer.dataset.blob = audioUrl;
            audioPreview.classList.remove('hidden');
            
            // Generar título automático
            const now = new Date();
            sessionTitle.value = `Sesión del ${now.toLocaleDateString('es-ES')} - ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        };
        
        mediaRecorder.start();
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        
        // Actualizar UI
        startBtn.disabled = true;
        stopBtn.disabled = false;
        recordingStatus.innerHTML = '<div class="status-dot recording"></div><span>Grabando...</span>';
        
        showToast('Grabación iniciada', 'success');
    } catch (error) {
        console.error('Error al acceder al micrófono:', error);
        showToast('Error: No se pudo acceder al micrófono', 'error');
    }
}

// Detener grabación
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        clearInterval(timerInterval);
        
        // Actualizar UI
        startBtn.disabled = false;
        stopBtn.disabled = true;
        recordingStatus.innerHTML = '<div class="status-dot"></div><span>Listo para grabar</span>';
        timer.textContent = '00:00';
        
        showToast('Grabación detenida', 'success');
    }
}

// Actualizar temporizador
function updateTimer() {
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Guardar grabación
function saveRecording() {
    const title = sessionTitle.value.trim() || 'Sin título';
    const notes = sessionNotes.value.trim();
    const audioUrl = previewPlayer.dataset.blob;
    
    // Convertir blob URL a base64 para almacenamiento
    fetch(audioUrl)
        .then(res => res.blob())
        .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const recording = {
                    id: Date.now(),
                    title: title,
                    notes: notes,
                    date: new Date().toISOString(),
                    audioData: reader.result
                };
                
                recordings.push(recording);
                saveToLocalStorage();
                renderRecordings();
                discardRecording();
                
                showToast('Sesión guardada correctamente', 'success');
            };
            reader.readAsDataURL(blob);
        });
}

// Descartar grabación
function discardRecording() {
    audioPreview.classList.add('hidden');
    previewPlayer.src = '';
    sessionTitle.value = '';
    sessionNotes.value = '';
}

// Renderizar lista de grabaciones
function renderRecordings() {
    if (recordings.length === 0) {
        recordingsList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    recordingsList.innerHTML = recordings
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(recording => {
            const date = new Date(recording.date);
            const formattedDate = date.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="recording-item" data-id="${recording.id}">
                    <div class="recording-header">
                        <div class="recording-info">
                            <h3>${recording.title}</h3>
                            <div class="recording-date">${formattedDate}</div>
                        </div>
                        <div class="recording-actions">
                            <button class="btn btn-small btn-download" onclick="downloadAudio(${recording.id})">
                                💾 Audio
                            </button>
                            <button class="btn btn-small btn-download" onclick="downloadNotes(${recording.id})">
                                📄 Notas
                            </button>
                            <button class="btn btn-small btn-delete" onclick="deleteRecording(${recording.id})">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    <div class="recording-audio">
                        <audio controls src="${recording.audioData}"></audio>
                    </div>
                    
                    ${recording.notes ? `
                        <div class="recording-notes">
                            <h4>Notas / Transcripción:</h4>
                            <p>${recording.notes}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        })
        .join('');
}

// Descargar audio individual
function downloadAudio(id) {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;
    
    const link = document.createElement('a');
    link.href = recording.audioData;
    link.download = `${recording.title}.webm`;
    link.click();
    
    showToast('Descargando audio...', 'success');
}

// Descargar notas individuales
function downloadNotes(id) {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;
    
    const content = `${recording.title}\n${'='.repeat(50)}\nFecha: ${new Date(recording.date).toLocaleString('es-ES')}\n\n${recording.notes || 'Sin notas'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recording.title} - Notas.txt`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('Descargando notas...', 'success');
}

// Descargar backup completo
function downloadAllRecordings() {
    if (recordings.length === 0) {
        showToast('No hay grabaciones para descargar', 'error');
        return;
    }
    
    // Crear un archivo de texto con todas las transcripciones
    let allNotes = 'BACKUP COMPLETO DE SESIONES\n';
    allNotes += '='.repeat(70) + '\n\n';
    
    recordings.forEach((recording, index) => {
        allNotes += `SESIÓN ${index + 1}: ${recording.title}\n`;
        allNotes += `Fecha: ${new Date(recording.date).toLocaleString('es-ES')}\n`;
        allNotes += '-'.repeat(70) + '\n';
        allNotes += recording.notes || 'Sin notas';
        allNotes += '\n\n' + '='.repeat(70) + '\n\n';
    });
    
    const notesBlob = new Blob([allNotes], { type: 'text/plain' });
    const notesUrl = URL.createObjectURL(notesBlob);
    
    const notesLink = document.createElement('a');
    notesLink.href = notesUrl;
    notesLink.download = `Backup_Sesiones_${new Date().toISOString().split('T')[0]}.txt`;
    notesLink.click();
    
    // Descargar cada audio
    recordings.forEach((recording, index) => {
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = recording.audioData;
            link.download = `${index + 1}_${recording.title}.webm`;
            link.click();
        }, index * 500); // Delay entre descargas
    });
    
    showToast(`Descargando ${recordings.length} audios y transcripciones...`, 'success');
}

// Eliminar grabación
function deleteRecording(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta grabación?')) {
        recordings = recordings.filter(r => r.id !== id);
        saveToLocalStorage();
        renderRecordings();
        showToast('Grabación eliminada', 'success');
    }
}

// Guardar en localStorage
function saveToLocalStorage() {
    localStorage.setItem('psychologyRecordings', JSON.stringify(recordings));
}

// Cargar desde localStorage
function loadRecordings() {
    const stored = localStorage.getItem('psychologyRecordings');
    if (stored) {
        recordings = JSON.parse(stored);
    }
}

// Mostrar toast
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
