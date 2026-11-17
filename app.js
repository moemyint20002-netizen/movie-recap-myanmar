let selectedVoice = 'Thiha';
let selectedLang = 'Myanmar';

function setLang(lang) {
    selectedLang = lang;
    ['Myanmar', 'English', 'Thai', 'Chinese'].forEach(l => {
        const btn = document.getElementById('lang' + l);
        if (l === lang) {
            btn.className = "px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold";
        } else {
            btn.className = "px-4 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-semibold hover:bg-gray-700";
        }
    });
}

function selectVoice(element, voiceName) {
    selectedVoice = voiceName;
    document.querySelectorAll('.voice-btn').forEach(b => {
        b.className = "voice-btn bg-gray-950 border border-gray-800 p-2.5 rounded-xl text-center hover:border-gray-600 transition";
        b.querySelector('p:last-child').className = "text-[10px] text-gray-400";
    });
    element.className = "voice-btn bg-blue-600/20 border border-blue-500 p-2.5 rounded-xl text-center transition";
    element.querySelector('p:last-child').className = "text-[10px] text-blue-400";
}

function startFullStudio() {
    const fileInput = document.getElementById('movieFile').files[0];
    if (!fileInput) {
        alert('ကျေးဇူးပြု၍ ပထမဆုံး Movie Video ဖိုင်ကို အရင် Upload တင်ပေးပါခင်ဗျာ။');
        return;
    }

    // Reset status
    for (let i = 2; i <= 6; i++) {
        const span = document.getElementById(`status${i}`);
        span.className = "text-xs bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-full animate-pulse";
        span.innerText = "Processing...";
    }
    document.getElementById('exportCard').classList.add('hidden');

    // Step-by-step Simulation with selected Voice
    setTimeout(() => { updateStatus(2, "Completed"); }, 1500);
    setTimeout(() => { updateStatus(3, "Completed"); }, 3000);
    setTimeout(() => { updateStatus(4, `Done (${selectedVoice})`); }, 4500);
    setTimeout(() => { updateStatus(5, "Completed"); }, 6000);
    setTimeout(() => {
        updateStatus(6, "Completed");
        document.getElementById('exportCard').classList.remove('hidden');
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 7500);
}

function updateStatus(step, text) {
    const span = document.getElementById(`status${step}`);
    span.className = "text-xs bg-green-600/20 text-green-400 px-3 py-1 rounded-full font-semibold";
    span.innerHTML = `<i class="fa-solid fa-check mr-1"></i> ${text}`;
}

function downloadVideo() {
    alert('ဗီဒီယိုဖိုင်ကို Download ဆွဲယူနေပါပြီ...');
}
