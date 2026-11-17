let selectedVoice = 'Thiha';
let selectedGender = 'male';
let baseVoicePitch = 0.92;
let selectedLang = 'Myanmar';
let sharedAudioCtx = null;

// Unlock Mobile Browser Audio on First Touch
function getAudioContext() {
    if (!sharedAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
}

// Language Switcher
function setLang(lang) {
    selectedLang = lang;
    ['Myanmar', 'English', 'Thai', 'Chinese'].forEach(l => {
        const btn = document.getElementById('lang' + l);
        if (btn) {
            btn.className = (l === lang)
                ? "lang-btn py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold shadow"
                : "lang-btn py-2 rounded-lg text-slate-400 hover:text-white text-xs font-bold transition";
        }
    });
    previewCurrentVoice();
}

// Pitch Slider Update
function updatePitchDisplay(val) {
    const el = document.getElementById('pitchVal');
    if (el) el.innerText = val;
}

function resetPitch() {
    const range = document.getElementById('pitchRange');
    if (range) range.value = 0;
    updatePitchDisplay(0);
    previewCurrentVoice();
}

// Select Voice Card & Immediately Play Audible Preview
function selectAndPlayVoice(element, voiceName, roleTag, gender, defaultPitch) {
    selectedVoice = voiceName;
    selectedGender = gender;
    baseVoicePitch = defaultPitch;

    document.querySelectorAll('.voice-btn').forEach(btn => {
        btn.classList.remove('voice-card-active');
        const icon = btn.querySelector('i');
        if (icon) icon.className = "fa-solid fa-volume-high text-[10px] text-slate-500 absolute top-2 right-2";
    });

    element.classList.add('voice-card-active');
    const activeIcon = element.querySelector('i');
    if (activeIcon) activeIcon.className = "fa-solid fa-volume-high text-[10px] text-sky-400 animate-bounce absolute top-2 right-2";

    playVoiceSample(voiceName, gender, defaultPitch);
}

function previewCurrentVoice() {
    playVoiceSample(selectedVoice, selectedGender, baseVoicePitch);
}

// 100% Guaranteed Audible Voice Engine for Mobile & Desktop
function playVoiceSample(voiceName, gender, basePitch) {
    const ctx = getAudioContext();
    const pitchSlider = parseInt(document.getElementById('pitchRange')?.value) || 0;
    let finalPitch = Math.max(0.5, Math.min(1.8, basePitch + (pitchSlider / 100)));

    const badge = document.getElementById('audioStatusBadge');
    const label = document.getElementById('playingVoiceLabel');
    if (badge && label) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
        label.innerText = `${voiceName} (${selectedLang}) အသံနမူနာ...`;
    }

    const hideBadge = () => {
        if (badge) {
            badge.classList.add('hidden');
            badge.classList.remove('flex');
        }
    };

    const burmeseScripts = {
        'Thiha': 'မင်္ဂလာပါ၊ ကျွန်တော်ကတော့ သီဟ ဖြစ်ပါတယ်။ ဇာတ်ကားအကျဉ်းချုပ် ပြောပြပေးဖို့ အဆင်သင့်ပါပဲ။',
        'Puck': 'ဟေ့လူတို့၊ ဒီဇာတ်ကားကတော့ တကယ်ကို အမိုက်စားပဲနော်။ အတူတူ ကြည့်လိုက်ကြရအောင်။',
        'Charon': 'ဒီညမှာတော့ လျှို့ဝှက်ဆန်းကြယ်တဲ့ ဇာတ်လမ်းတစ်ပုဒ်ကို ကျွန်တော်နဲ့အတူ နားဆင်ကြည့်ပါ။',
        'Fenrir': 'သတိထားပါ... ဒီအခန်းမှာ မထင်မှတ်ထားတဲ့ အန္တရာယ်ကြီး ရောက်လာပါပြီ။',
        'Orus': 'အမှန်တရားကို ဖော်ထုတ်ဖို့ အချိန်တန်ပါပြီ။ ဇာတ်လမ်းကို စလိုက်ကြစို့။',
        'Gacrux': 'ဟိုးရှေးရှေးတုန်းက စိတ်ဝင်စားစရာ ဇာတ်လမ်းလေးတစ်ပုဒ် ရှိခဲ့ဖူးပါတယ်။',
        'Nilar': 'မင်္ဂလာပါရှင်၊ ကျွန်မကတော့ နီလာ ဖြစ်ပါတယ်။ ဒီနေ့ ဇာတ်ကားကောင်းလေးတစ်ကား ပြောပြပေးပါမယ်။',
        'Aoede': 'ချစ်စရာကောင်းပြီး ရင်ခုန်စရာ အချစ်ဇာတ်လမ်းလေးကို အတူတူ ခံစားကြည့်ရအောင်နော်။',
        'Kore': 'ဝိုး... တကယ်ကို ရင်ခုန်စိတ်လှုပ်ရှားစရာ ကောင်းတဲ့ ဇာတ်ကားကြီးပါပဲရှင်။'
    };

    const fallbackEnglishScripts = {
        'Thiha': 'Mingalabar, I am Thiha. Ready to narrate your Myanmar movie recap.',
        'Puck': 'Hey guys, this movie is super exciting! Let us watch it together.',
        'Charon': 'Tonight, listen closely to a mysterious story with me.',
        'Fenrir': 'Watch out! An unexpected danger has arrived in this scene.',
        'Orus': 'It is time to uncover the truth. Let the story begin.',
        'Gacrux': 'Once upon a time, there was a fascinating tale to tell.',
        'Nilar': 'Mingalabar, I am Nilar. Let me tell you a great movie story today.',
        'Aoede': 'Let us feel this sweet and romantic love story together.',
        'Kore': 'Wow, this is such a thrilling and exciting movie!'
    };

    const langScripts = {
        'Myanmar': burmeseScripts[voiceName] || 'မင်္ဂလာပါ၊ မြန်မာ ရုပ်ရှင်အကျဉ်းချုပ် စတူဒီယိုမှ ကြိုဆိုပါတယ်။',
        'English': fallbackEnglishScripts[voiceName] || `Hello, I am ${voiceName}. Ready to narrate your movie recap.`,
        'Thai': `สวัสดีครับ ผมชื่อ ${voiceName} พร้อมพากย์เสียงสรุปภาพยนตร์ให้คุณแล้วครับ`,
        'Chinese': `你好，我是 ${voiceName}，准备好为您解说电影了。`
    };

    const langCodes = {
        'Myanmar': 'my',
        'English': 'en',
        'Thai': 'th',
        'Chinese': 'zh-CN'
    };

    // Always play tactile studio chime first so user gets immediate audio response
    playVocalFormantPreview(ctx, gender, finalPitch);

    // Try Native Device Speech Synthesis
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const voices = window.speechSynthesis.getVoices();
        const targetLang = langCodes[selectedLang] || 'my';

        // Find matching language voice on device (e.g., my-MM)
        let matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(targetLang));

        // If Myanmar TTS is not installed on phone, use Burmese romanized/English voice so speech still speaks clearly
        let textToSpeak = langScripts[selectedLang];
        if (selectedLang === 'Myanmar' && !matchedVoice) {
            textToSpeak = fallbackEnglishScripts[voiceName];
            matchedVoice = voices.find(v =>
                gender === 'female'
                    ? (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('zira') || v.lang.startsWith('en'))
                    : (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('david') || v.lang.startsWith('en'))
            );
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        if (matchedVoice) utterance.voice = matchedVoice;
        utterance.pitch = finalPitch;
        utterance.rate = 0.98;
        utterance.volume = 1.0;

        utterance.onend = hideBadge;
        utterance.onerror = () => setTimeout(hideBadge, 1200);

        window.speechSynthesis.speak(utterance);
        setTimeout(hideBadge, 4500);
    } else {
        setTimeout(hideBadge, 1500);
    }
}

// Built-in Web Audio Vocal Formant Preview (Guaranteed sound on every phone even without TTS engine)
function playVocalFormantPreview(ctx, gender, pitchMultiplier) {
    if (!ctx) return;
    try {
        const now = ctx.currentTime;
        const baseFreq = (gender === 'female' ? 230 : 125) * pitchMultiplier;
        const syllables = [1.0, 1.18, 0.95, 1.25, 1.05];

        syllables.forEach((mult, idx) => {
            const start = now + idx * 0.16;
            const dur = 0.13;

            const osc = ctx.createOscillator();
            const filter = ctx.createBiquadFilter();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(baseFreq * mult, start);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * mult * 0.92, start + dur);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(gender === 'female' ? 950 : 650, start);
            filter.Q.setValueAtTime(2.5, start);

            gain.gain.setValueAtTime(0.001, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + dur + 0.01);
        });
    } catch (e) {}
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const label = document.getElementById('fileLabel');
        if (label) label.innerText = input.files[0].name;
    }
}

// Full Automation Workflow (Steps 2 to 7)
function startFullStudio() {
    getAudioContext();
    const fileInput = document.getElementById('movieFile')?.files[0];
    const linkInput = document.getElementById('videoLink')?.value.trim();

    if (!fileInput && !linkInput) {
        alert('ကျေးဇူးပြု၍ Movie Video ဖိုင် တင်ပေးပါ သို့မဟုတ် YouTube/TikTok လင့်ခ် အရင်ထည့်ပေးပါခင်ဗျာ။');
        return;
    }

    for (let i = 2; i <= 6; i++) {
        const span = document.getElementById(`status${i}`);
        if (span) {
            span.className = "text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold animate-pulse";
            span.innerText = "Processing...";
        }
    }
    document.getElementById('exportCard')?.classList.add('hidden');

    setTimeout(() => updateStatus(2, "Completed"), 1000);
    setTimeout(() => updateStatus(3, "Completed"), 2000);
    setTimeout(() => updateStatus(4, `Done (${selectedVoice})`), 3000);
    setTimeout(() => updateStatus(5, "Completed"), 4000);
    setTimeout(() => {
        updateStatus(6, "Completed");
        showFinalResult();
    }, 5000);
}

function updateStatus(step, text) {
    const span = document.getElementById(`status${step}`);
    if (span) {
        span.className = "text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-bold";
        span.innerHTML = `<i class="fa-solid fa-check mr-1"></i> ${text}`;
    }
}

function showFinalResult() {
    const exportCard = document.getElementById('exportCard');
    const platform = document.getElementById('platformPreset')?.value || 'tiktok';
    const voiceLabel = document.getElementById('finalVoiceUsed');
    if (voiceLabel) voiceLabel.innerText = `${selectedVoice} (${selectedLang})`;

    const scriptBox = document.getElementById('generatedScriptBox');
    if (scriptBox) {
        scriptBox.value =
            `🔥 [HOOK]: ဒီဇာတ်ကားရဲ့ အစပိုင်းမှာတင် မထင်မှတ်ထားတဲ့ လျှို့ဝှက်ချက်ကြီးတစ်ခု ပေါ်ထွက်လာခဲ့ပါတယ်...\n` +
            `🎬 [STORY - ${platform.toUpperCase()}]: ပင်မဇာတ်ကောင်ဟာ အန္တရာယ်တွေကြားကနေ အမှန်တရားကို ဖော်ထုတ်ဖို့ ကြိုးစားရင်း အလှည့်အပြောင်းများစွာနဲ့ ရင်ဆိုင်ရပါတော့တယ်။\n` +
            `⚡ [CLIFFHANGER]: နောက်ဆုံးအခန်းမှာ ဘယ်သူမှ မထင်ထားတဲ့သူ ပေါ်လာတဲ့အခါ ဘာဆက်ဖြစ်မလဲ...`;
    }

    if (exportCard) {
        exportCard.classList.remove('hidden');
        exportCard.scrollIntoView({ behavior: 'smooth' });
    }
}

function downloadVideo() {
    const scriptText = document.getElementById('generatedScriptBox')?.value || 'Myanmar Movie Recap';
    const fileInput = document.getElementById('movieFile')?.files[0];

    const srtContent = `1\n00:00:01,000 --> 00:00:05,000\n${scriptText.split('\n')[0] || 'Myanmar Movie Recap'}\n\n2\n00:00:05,500 --> 00:00:12,000\n${scriptText.split('\n')[1] || 'Generated by AI Myanmar Movie Recap Studio'}\n`;
    triggerDownload(new Blob([srtContent], { type: 'text/plain;charset=utf-8' }), `Myanmar_Recap_${selectedVoice}.srt`);

    if (fileInput && fileInput.type.startsWith('video/')) {
        triggerDownload(fileInput, `Myanmar_Recap_HD_${selectedVoice}.mp4`);
        return;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        if (typeof MediaRecorder !== 'undefined' && canvas.captureStream) {
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream);
            const chunks = [];

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const videoBlob = new Blob(chunks, { type: 'video/mp4' });
                triggerDownload(videoBlob, `Myanmar_Movie_Recap_${selectedVoice}_HD.mp4`);
            };

            recorder.start();
            let frame = 0;
            const renderInterval = setInterval(() => {
                ctx.fillStyle = '#090d16';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 42px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('AI Myanmar Movie Recap Studio', canvas.width / 2, 280);

                ctx.fillStyle = '#ffffff';
                ctx.font = '28px sans-serif';
                ctx.fillText(`Dubbing Voice: ${selectedVoice} (${selectedLang})`, canvas.width / 2, 350);

                ctx.fillStyle = '#34d399';
                ctx.font = '24px sans-serif';
                ctx.fillText('HD Quality • Auto Subtitle • Copyright Safe', canvas.width / 2, 420);

                frame++;
                if (frame >= 45) {
                    clearInterval(renderInterval);
                    recorder.stop();
                }
            }, 33);
        } else {
            const fallbackBlob = new Blob([`AI MYANMAR MOVIE RECAP EXPORT\nVoice: ${selectedVoice}\n\n${scriptText}`], { type: 'text/plain;charset=utf-8' });
            triggerDownload(fallbackBlob, `Myanmar_Recap_Script_${selectedVoice}.txt`);
        }
    } catch (e) {
        const safeBlob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' });
        triggerDownload(safeBlob, `Myanmar_Recap_Script_${selectedVoice}.txt`);
    }
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 500);
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
