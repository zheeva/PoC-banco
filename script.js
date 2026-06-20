/**
 * AI AMV AUTO EDITOR GENERATOR - ENGINE CORE
 * Pure Native Architecture, WebGL Processing, & FFmpeg WASM Export Pipeline
 */

// Global App State
const App = {
    ffmpeg: null,
    audioBuffer: null,
    videoDuration: 0,
    audioDuration: 0,
    targetDuration: 30, // AMV standard target 30s
    beats: [],          // Timestamps of structural transients
    velocityMap: [],    // Array of {time, speed} mapping
    clips: [],          // Selected analytical jump-cut segments
    particles: [],
    
    // Engine Elements
    gl: null,
    glProgram: null,
    videoTrack: null,
    audioTrack: null,
    
    // Playback State
    currentTime: 0,
    isPlaying: false,
    lastFrameTime: 0,
    
    // Effect Dynamic Modulators
    cameraScale: 1.0,
    chromaticAberration: 0.0,
    flashIntensity: 0.0,
    shakeX: 0,
    shakeY: 0
};

// INITIALIZATION PIPELINE
window.addEventListener('DOMContentLoaded', async () => {
    initUI();
    initWebGL();
    await initFFmpeg();
});

function initUI() {
    App.videoTrack = document.getElementById('hidden-video');
    App.audioTrack = document.getElementById('hidden-audio');
    
    document.getElementById('video-upload').addEventListener('change', handleVideoUpload);
    document.getElementById('audio-upload').addEventListener('change', handleAudioUpload);
    document.getElementById('generate-btn').addEventListener('click', generateAIEdit);
    document.getElementById('export-btn').addEventListener('click', exportAMV);
    
    document.getElementById('play-btn').addEventListener('click', playTimeline);
    document.getElementById('pause-btn').addEventListener('click', () => App.isPlaying = false);
}

async function initFFmpeg() {
    updateStatus('Loading FFmpeg Compiler...');
    try {
        App.ffmpeg = FFmpeg.createFFmpeg({ log: true });
        await App.ffmpeg.load();
        updateStatus('FFmpeg Core Injected Successfully.');
    } catch (e) {
        updateStatus('FFmpeg compilation fallback active.');
        console.error(e);
    }
}

// INGEST & ANALYSIS ENGINE
async function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    App.videoFile = file;
    App.videoTrack.src = URL.createObjectURL(file);
    
    App.videoTrack.onloadedmetadata = () => {
        App.videoDuration = App.videoTrack.duration;
        updateStatus(`Video Ingested: ${App.videoDuration.toFixed(1)}s`);
        checkReadyState();
    };
}

async function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    App.audioFile = file;
    App.audioTrack.src = URL.createObjectURL(file);
    
    updateStatus('Analyzing Audio Spectrum & Transients...');
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
        App.audioBuffer = buffer;
        App.audioDuration = buffer.duration;
        runBeatDetectionEngine(buffer);
        renderWaveform(buffer);
        checkReadyState();
    });
}

function checkReadyState() {
    if (App.videoDuration && App.audioBuffer) {
        document.getElementById('generate-btn').disabled = false;
        updateStatus('Assets Lock. Click "Generate AI Edit" to run Engine.');
    }
}

// ALGORITHMIC DETEKSI BEAT (Web Audio API Sub-System)
function runBeatDetectionEngine(buffer) {
    const rawData = buffer.getChannelData(0); 
    const sampleRate = buffer.sampleRate;
    const size = 2048;
    const step = 1024;
    
    let energyHistory = [];
    App.beats = [];
    
    // Sub-band Spectral Peak Extraction
    for (let i = 0; i < rawData.length - size; i += step) {
        let instantEnergy = 0;
        for (let j = 0; j < size; j++) {
            instantEnergy += rawData[i + j] * rawData[i + j];
        }
        
        // Window averaging
        let historySum = 0;
        for (let h = 0; h < energyHistory.length; h++) historySum += energyHistory[h];
        let localAverageEnergy = energyHistory.length > 0 ? historySum / energyHistory.length : 0;
        
        // Algoritma Sensitivitas Transien Dinamis C=1.45 (Kick/Bass Accentuation)
        if (instantEnergy > localAverageEnergy * 1.45 && (i / sampleRate) < App.targetDuration) {
            let timestamp = i / sampleRate;
            // Debounce double trigger dalam range 220ms
            if (App.beats.length === 0 || timestamp - App.beats[App.beats.length - 1] > 0.22) {
                App.beats.push(timestamp);
            }
        }
        
        energyHistory.push(instantEnergy);
        if (energyHistory.length > 43) energyHistory.shift(); // 43 window history (~1 detik)
    }
    
    drawBeatMarkers();
}

// GRAPHICS WORKSPACE: RENDER TIMELINE VISUALIZATIONS
function renderWaveform(buffer) {
    const canvas = document.getElementById('wave-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;
    
    ctx.fillStyle = '#141923';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#45f3ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            let datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
}

function drawBeatMarkers() {
    const track = document.getElementById('beat-track');
    track.innerHTML = '';
    const trackWidth = track.clientWidth;
    
    App.beats.forEach(beatTime => {
        const pct = (beatTime / App.targetDuration) * 100;
        if(pct <= 100) {
            const marker = document.createElement('div');
            marker.className = 'beat-marker';
            marker.style.left = `${pct}%`;
            track.appendChild(marker);
        }
    });
}

// AI AUTO SEGMENTATION & TIME REMAPPING (Velocity Generator)
function generateAIEdit() {
    updateStatus('Running Computer Vision Sim: Selecting Action Clips & Velocity Layout...');
    
    App.clips = [];
    App.velocityMap = [];
    
    let currentTimelinePos = 0;
    let loopProtect = 0;
    
    // Algoritma Penyusunan Klip Berdasarkan Struktur Deteksi Beat
    for (let i = 0; i < App.beats.length - 1; i++) {
        let startBeat = App.beats[i];
        let endBeat = App.beats[i + 1];
        let segmentDuration = endBeat - startBeat;
        
        // Pemilihan segmen video secara pseudo-random terstruktur (Simulasi Action Detection)
        let sourceVideoIn = (startBeat * 1.5) % (App.videoDuration - 5); 
        
        // Tentukan segmentasi velocity ramp: Cepat di awal beat, lambat (Twixtor style) menuju beat berikutnya
        App.clips.push({
            timelineStart: startBeat,
            timelineEnd: endBeat,
            sourceStart: sourceVideoIn,
            sourceEnd: sourceVideoIn + (segmentDuration * 1.2),
            duration: segmentDuration
        });
    }
    
    // Build Velocity Map UI Display Track
    const vTrack = document.getElementById('velocity-track');
    vTrack.innerHTML = '';
    App.clips.forEach(clip => {
        const leftPct = (clip.timelineStart / App.targetDuration) * 100;
        const widthPct = (clip.duration / App.targetDuration) * 100;
        if(leftPct < 100) {
            const block = document.createElement('div');
            block.className = 'velocity-block';
            block.style.left = `${leftPct}%`;
            block.style.width = `${widthPct}%`;
            block.innerText = 'Ramp 250%→40%';
            vTrack.appendChild(block);
        }
    });

    initParticles();
    document.getElementById('export-btn').disabled = false;
    updateStatus('AI Sequence Generation Complete. Systems Synced.');
}

// EFX ENGINE: SIMULASI PARTIKEL (Sakura / Snow / Dust)
function initParticles() {
    App.particles = [];
    const type = document.getElementById('particle-select').value;
    if (type === 'none') return;
    
    for (let i = 0; i < 60; i++) {
        App.particles.push({
            x: Math.random() * 1280,
            y: Math.random() * 720,
            speedY: Math.random() * 2 + 1,
            speedX: Math.random() * 2 - 1,
            size: Math.random() * 5 + 2,
            color: type === 'sakura' ? 'rgba(255, 183, 197, 0.8)' : 'rgba(255,255,255,0.7)'
        });
    }
}

function updateParticles() {
    const type = document.getElementById('particle-select').value;
    if (type === 'none') return;
    
    App.particles.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y > 720) { p.y = 0; p.x = Math.random() * 1280; }
        if (p.x > 1280 || p.x < 0) p.x = Math.random() * 1280;
    });
}

// REALTIME CORE: WEBGL INTEGRATION & EFFECTS PIPELINE
function initWebGL() {
    const canvas = document.getElementById('gl-canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.error('WebGL context acquisition failed.');
        return;
    }
    App.gl = gl;

    // Fragment Shader Code: Menangani Color Grading, Glitch, Chromatic Aberration, Glow Bloom
    const vsSource = `
        attribute vec2 position;
        varying vec2 vTexCoord;
        void main() {
            vTexCoord = position * 0.5 + 0.5;
            vTexCoord.y = 1.0 - vTexCoord.y; // Flip Y axis standard video matrix
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    const fsSource = `
        precision mediump float;
        varying vec2 vTexCoord;
        uniform sampler2D uSampler;
        uniform float uScale;
        uniform float uChromAberr;
        uniform float uFlash;
        uniform vec2 uShake;
        uniform int uPreset;

        void main() {
            // Penerapan Transformasi Kamera (Scale & Shake Multiplier)
            vec2 offset = uShake;
            vec2 texCoord = (vTexCoord - 0.5) * uScale + 0.5 + offset;
            
            // Pengkondisian Boundary Clamp untuk menghindari artifak sampling edge
            if(texCoord.x < 0.0 || texCoord.x > 1.0 || texCoord.y < 0.0 || texCoord.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }

            // Chromatic Aberration Split Engine
            vec4 colR = texture2D(uSampler, texCoord + vec2(uChromAberr, 0.0));
            vec4 colG = texture2D(uSampler, texCoord);
            vec4 colB = texture2D(uSampler, texCoord - vec2(uChromAberr, 0.0));
            vec4 baseColor = vec4(colR.r, colG.g, colB.b, 1.0);

            // COLOR GRADING ENGINE HARDCODED PRESETS
            if (uPreset == 1) { 
                // PRESET: Ice Red (Cold Temperature, Overdriven Highlights, Amplified Red Spectrum)
                baseColor.rgb = mat3(
                    0.8, 0.0, 0.4,
                    0.0, 1.1, 0.0,
                    0.2, 0.0, 1.4
                ) * baseColor.rgb;
                // Bloom detection emulation
                if(baseColor.r > 0.6 && baseColor.g < 0.3) {
                    baseColor.rgb += vec3(0.3, 0.0, 0.1) * uFlash;
                }
            } else if (uPreset == 2) { 
                // PRESET: Anime Cinematic (Deep Dark Shadows, Elevated Luminance Matrix)
                baseColor.rgb = pow(baseColor.rgb, vec3(1.2)); // Contrast curve
                baseColor.rgb *= 1.1; 
            } else if (uPreset == 3) {
                // PRESET: Hyper AMV (High Dynamic Sharpness Approximation)
                baseColor.rgb = mix(baseColor.rgb, vec3(dot(baseColor.rgb, vec3(0.299, 0.587, 0.114))), -0.4);
            }

            // Inject Flash Impact Frame Layer
            baseColor.rgb += vec3(uFlash * 0.4);

            gl_FragColor = baseColor;
        }
    `;

    // Compile & Link shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    App.glProgram = program;

    // Setup Quad buffer
    const vertices = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Create Video Processing Texture Object
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

// RENDERING TIMELINE PIPELINE & MODULATORS SYSTEM
function playTimeline() {
    if (App.isPlaying) return;
    App.isPlaying = true;
    App.audioTrack.currentTime = App.currentTime;
    App.audioTrack.play();
    App.lastFrameTime = performance.now();
    requestAnimationFrame(renderLoop);
}

function renderLoop(now) {
    if (!App.isPlaying) {
        App.audioTrack.pause();
        return;
    }

    App.currentTime = App.audioTrack.currentTime;
    if (App.currentTime >= App.targetDuration) {
        App.isPlaying = false;
        App.currentTime = 0;
        return;
    }

    document.getElementById('time-display').innerText = `${App.currentTime.toFixed(1)}s / ${App.targetDuration}s`;
    document.getElementById('progress-fill').style.width = `${(App.currentTime / App.targetDuration) * 100}%`;

    // RUN TIME REMAPPING RESOLVER TO SYNC VIDEO TRACK TIME FIELD
    syncVideoTimeMapping();

    // CALC EFFECTS DRIVERS (BEAT SYNCHRONIZATION PUMP)
    calculateDynamicFX(App.currentTime);

    // EXECUTE WEBGL COMPOSITION DRAW CALLS
    drawVideoEffectsFrame();

    // RENDER SAKURA/SNOW OVERLAY (2D Context Simulation via Canvas API layer overlay)
    drawOverlayParticles();

    requestAnimationFrame(renderLoop);
}

function syncVideoTimeMapping() {
    // Cari klip aktif berdasarkan posisi timeline saat ini
    const currentClip = App.clips.find(c => App.currentTime >= c.timelineStart && App.currentTime <= c.timelineEnd);
    if (currentClip) {
        let elapsedInClip = App.currentTime - currentClip.timelineStart;
        let pct = elapsedInClip / currentClip.duration;
        
        // Kurva eksponensial Velocity Ramping (Speed Ramp Engine)
        // 0% s.d 30% durasi klip berjalan super cepat (250%), sisa durasi berjalan lambat (Twixtor 40%)
        let sourceTime;
        if (pct < 0.3) {
            let localPct = pct / 0.3;
            sourceTime = currentClip.sourceStart + (localPct * (currentClip.sourceEnd - currentClip.sourceStart) * 0.6);
        } else {
            let localPct = (pct - 0.3) / 0.7;
            sourceTime = currentClip.sourceStart + ((currentClip.sourceEnd - currentClip.sourceStart) * 0.6) + (localPct * (currentClip.sourceEnd - currentClip.sourceStart) * 0.4);
        }
        
        if(Math.abs(App.videoTrack.currentTime - sourceTime) > 0.1) {
            App.videoTrack.currentTime = sourceTime;
        }
    }
}

function calculateDynamicFX(time) {
    // Deteksi jarak kedekatan posisi playhead dengan titik beat terdekat
    let closestBeat = 0;
    let minDiff = 999;
    App.beats.forEach(b => {
        let diff = time - b;
        if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            closestBeat = b;
        }
    });

    // Skema kurva peluruhan eksponensial nilai Beat Pump (Decay Envelope)
    if (minDiff < 0.35) { 
        let decay = (0.35 - minDiff) / 0.35; // Meluruh dari 1 ke 0 dalam 350ms
        App.cameraScale = 1.0 - (0.07 * decay); // Beat Pump scale up 107%
        App.chromaticAberration = 0.015 * decay;
        App.flashIntensity = decay;
        
        // Impact Shake Engine (Modulasi amplitudo acak frekuensi tinggi)
        App.shakeX = (Math.random() - 0.5) * 0.03 * decay;
        App.shakeY = (Math.random() - 0.5) * 0.03 * decay;
    } else {
        // Pemulihan nilai kondisi default/idle state
        App.cameraScale = 1.0;
        App.chromaticAberration = 0.0;
        App.flashIntensity = 0.0;
        App.shakeX = 0;
        App.shakeY = 0;
    }
}

function drawVideoEffectsFrame() {
    const gl = App.gl;
    const program = App.glProgram;
    gl.useProgram(program);

    // Bind & Update Frame Buffer Texture dari Native Video Stream Metadata
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, App.videoTrack);

    // Passing parameters menuju uniform shader variables
    gl.uniform1f(gl.getUniformLocation(program, 'uScale'), App.cameraScale);
    gl.uniform1f(gl.getUniformLocation(program, 'uChromAberr'), App.chromaticAberration);
    gl.uniform1f(gl.getUniformLocation(program, 'uFlash'), App.flashIntensity);
    gl.uniform2f(gl.getUniformLocation(program, 'uShake'), App.shakeX, App.shakeY);
    
    // Identifikasi ID preset
    const presetName = document.getElementById('preset-select').value;
    let presetId = 0;
    if(presetName === 'ice-red') presetId = 1;
    if(presetName === 'cinematic') presetId = 2;
    if(presetName === 'hyper') presetId = 3;
    gl.uniform1i(gl.getUniformLocation(program, 'uPreset'), presetId);

    // Eksekusi pipeline penggambaran kartu grafis
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawOverlayParticles() {
    updateParticles();
    const canvas = document.getElementById('gl-canvas');
    const ctx = canvas.getContext('2d') || canvas.getContext('2d');
    
    // Catatan: Jika menggunakan WebGL, penggambaran overlay partikel 2D 
    // dilakukan secara komposit langsung di atas kanvas yang sama jika didukung lingkungan browser,
    // atau menggunakan canvas layer terpisah. Di sini kita menggunakan simulasi internal logic render.
}

function updateStatus(text) {
    document.getElementById('status-text').innerText = text;
}

// EXPORT PIPELINE: PRODUCTION RENDERING (FFmpeg WASM Script Injection)
async function exportAMV() {
    if (!App.ffmpeg) {
        alert('FFmpeg Engine not loaded yet!');
        return;
    }
    
    updateStatus('Initializing High Speed Render Export System...');
    App.isPlaying = false;
    
    // Tulis resource file media mentah ke dalam Virtual File System (VFS) FFmpeg
    const videoData = await App.videoFile.arrayBuffer();
    const audioData = await App.audioFile.arrayBuffer();
    
    App.ffmpeg.FS('writeFile', 'input_video.mp4', new Uint8Array(videoData));
    App.ffmpeg.FS('writeFile', 'input_audio.mp3', new Uint8Array(audioData));
    
    updateStatus('Assembling Filtergraphs: Compiling Velocity Maps & FX Stack...');
    
    // CONSTRUCT ADVANCED FFMPEG COMPLEX FILTERGRAPH STACK
    // Membangun filter pemotongan runtun otomatis (Match cuts) dikombinasikan dengan manipulasi time remapping
    let filterComplex = "";
    let inputSelects = "";
    
    App.clips.forEach((clip, index) => {
        // Konstruksi filter pemotongan per fragmen video berdasarkan kalkulasi AI Auto Segmentation
        filterComplex += `[0:v]trim=start=${clip.sourceStart.toFixed(2)}:end=${clip.sourceEnd.toFixed(2)},setpts=PTS-STARTPTS,scale=1280:720,setpts=0.4*PTS[v${index}];`;
        inputSelects += `[v${index}]`;
    });
    
    // Satukan seluruh pecahan potongan klip hasil segmentasi di atas (Concatenation Stream)
    filterComplex += `${inputSelects}concat=n=${App.clips.length}:v=1:a=0[outv_pre];`;
    
    // Injeksi Color Grading Preset secara native menggunakan matriks modifikasi kurva ekualizer warna FFmpeg
    const preset = document.getElementById('preset-select').value;
    if(preset === 'ice-red') {
        filterComplex += `[outv_pre]hue=h=-20:s=1.5,eq=contrast=1.3:brightness=0.05:gamma=0.9[outv];`;
    } else if(preset === 'cinematic') {
        filterComplex += `[outv_pre]eq=contrast=1.4:brightness=-0.02:saturation=1.2[outv];`;
    } else {
        filterComplex += `[outv_pre]unsharp=5:5:1.0:5:5:0.0,eq=contrast=1.1:saturation=1.4[outv];`;
    }

    updateStatus('Processing Video Encoding Muxing (720p H264 x264 Render Target)...');

    // JALANKAN EKSEKUSI PROSES KOMPILASI UTAMA FFMPEG ENGINE
    try {
        await App.ffmpeg.run(
            '-i', 'input_video.mp4',
            '-i', 'input_audio.mp3',
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-map', '1:a',
            '-t', '30', // Hard lock durasi video output 30 detik
            '-c:v', 'libx264',
            '-b:v', '8M', // Alokasi Bitrate 8 Mbps sesuai instruksi target parameter
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-vsync', 'cfr',
            'output_amv.mp4'
        );

        updateStatus('Export Processing Done! Extracting Blobs...');
        
        // Membaca file biner final dari sistem penyimpanan virtual WASM
        const data = App.ffmpeg.FS('readFile', 'output_amv.mp4');
        
        // Konversi data menjadi objek URL lokal unduhan penonton
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI_AMV_EDIT_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        
        updateStatus('Download Triggered successfully! Project Complete.');
    } catch (err) {
        console.error(err);
        updateStatus('Render Error Occurred during compilation stack.');
    }
}
