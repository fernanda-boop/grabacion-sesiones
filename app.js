// Variables globales
let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let recordings = [];
let currentAudioBlob = null;

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
    console.log('Inicializando app...');
    loadRecordings();
    renderRecordings();
    
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    saveBtn.addEventListener('click', saveRecording);
    discardBtn.addEventListener('click', discardRecording);
    downloadAllBtn.addEventListener('click', downloadAllRecordings);
    
    // Verificar soporte de MediaRecorder
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Tu navegador no soporta grabación de audio', 'error');
        startBtn.disabled = true;
    }
}

// Iniciar grabación
async function startRecording() {
    console.log('Intentando iniciar grabación...');
    
    try {
        // Solicitar permisos del micrófono
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        
        console.log('Permisos de micrófono obtenidos');
        
        // Verificar qué tipo de audio soporta el navegador
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }
        
        console.log('Usando formato:', mimeType);
        
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                console.log('Chunk de audio recibido:', event.data.size, 'bytes');
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('Grabación detenida. Procesando audio...');
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            currentAudioBlob = audioBlob;
            const audioUrl = URL.createObjectURL(audioBlob);
            previewPlayer.src = audioUrl;
            audioPreview.classList.remove('hidden');
            
            console.log('Audio procesado. Tamaño:', audioBlob.size, 'bytes');
            
            // Generar título automático
            const now = new Date();
            sessionTitle.value = `Sesión del ${now.toLocaleDateString('es-ES')} - ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
            
            // Limpiar el stream
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('Error en MediaRecorder:', event.error);
            showToast('Error durante la grabación', 'error');
        };
        
        mediaRecorder.start(1000); // Guardar chunks cada segundo
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        
        console.log('Grabación iniciada correctamente');
        
        // Actualizar UI
        startBtn.disabled = true;
        stopBtn.disabled = false;
        recordingStatus.innerHTML = '<div class="status-dot recording"></div><span>Grabando...</span>';
        
        showToast('Grabación iniciada', 'success');
        
    } catch (error) {
        console.error('Error completo:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            showToast('Permiso denegado. Por favor permite el acceso al micrófono', 'error');
        } else if (error.name === 'NotFoundError') {
            showToast('No se encontró ningún micrófono', 'error');
        } else if (error.name === 'NotReadableError') {
            showToast('El micrófono está siendo usado por otra aplicación', 'error');
        } else {
            showToast('Error: ' + error.message, 'error');
        }
    }
}

// Detener grabación
function stopRecording() {
    console.log('Deteniendo grabación...');
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
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
    console.log('Guardando grabación...');
    
    if (!currentAudioBlob) {
        showToast('No hay audio para guardar', 'error');
        return;
    }
    
    const title = sessionTitle.value.trim() || 'Sin título';
    const notes = sessionNotes.value.trim();
    
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
        
        console.log('Grabación guardada con ID:', recording.id);
        showToast('Sesión guardada correctamente', 'success');
    };
    
    reader.onerror = () => {
        console.error('Error al leer el audio');
        showToast('Error al guardar el audio', 'error');
    };
    
    reader.readAsDataURL(currentAudioBlob);
}

// Descartar grabación
function discardRecording() {
    audioPreview.classList.add('hidden');
    previewPlayer.src = '';
    sessionTitle.value = '';
    sessionNotes.value = '';
    currentAudioBlob = null;
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
                            <h3>${escapeHtml(recording.title)}</h3>
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
                            <p>${escapeHtml(recording.notes)}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        })
        .join('');
}

// Función para escapar HTML y prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Descargar audio individual
function downloadAudio(id) {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;
    
    const link = document.createElement('a');
    link.href = recording.audioData;
    const extension = recording.audioData.includes('audio/mp4') ? '.m4a' : '.webm';
    link.download = `${recording.title}${extension}`;
    link.click();
    
    showToast('Descargando audio...', 'success');
}

// Descargar notas individuales
function downloadNotes(id) {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;
    
    const content = `${recording.title}\n${'='.repeat(50)}\nFecha: ${new Date(recording.date).toLocaleString('es-ES')}\n\n${recording.notes || 'Sin notas'}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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
    
    const notesBlob = new Blob([allNotes], { type: 'text/plain;charset=utf-8' });
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
            const extension = recording.audioData.includes('audio/mp4') ? '.m4a' : '.webm';
            link.download = `${index + 1}_${recording.title}${extension}`;
            link.click();
        }, index * 500);
    });
    
    showToast(`Descargando ${recordings.length} audios y transcripciones...`, 'success');
}

// Eliminar grabación
function deleteRecording(id) {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;
    
    const card = document.querySelector(`[data-id="${id}"]`);
    const deleteBtn = card.querySelector('.btn-delete');
    
    if (deleteBtn.textContent === '🗑️') {
        deleteBtn.textContent = '¿Confirmar?';
        deleteBtn.style.background = '#fc8181';
        
        setTimeout(() => {
            if (deleteBtn.textContent === '¿Confirmar?') {
                deleteBtn.textContent = '🗑️';
                deleteBtn.style.background = '#fc8181';
            }
        }, 3000);
        return;
    }
    
    recordings = recordings.filter(r => r.id !== id);
    saveToLocalStorage();
    renderRecordings();
    showToast('Grabación eliminada', 'success');
}

// Guardar en localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('psychologyRecordings', JSON.stringify(recordings));
        console.log('Datos guardados en localStorage');
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            showToast('Almacenamiento lleno. Descarga backup y elimina grabaciones antiguas', 'error');
        } else {
            console.error('Error al guardar:', e);
        }
    }
}

// Cargar desde localStorage
function loadRecordings() {
    try {
        const stored = localStorage.getItem('psychologyRecordings');
        if (stored) {
            recordings = JSON.parse(stored);
            console.log('Grabaciones cargadas:', recordings.length);
        }
    } catch (e) {
        console.error('Error al cargar grabaciones:', e);
        recordings = [];
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

// Inicializar cuando cargue la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
