function extractData() {
    const link = document.getElementById('videoLink').value;
    const srtInput = document.getElementById('srtFile').files[0];
    const loading = document.getElementById('loading');
    const resultBox = document.getElementById('extractResult');

    if (!link && !srtInput) {
        alert('ကျေးဇူးပြု၍ YouTube လင့်ခ် (သို့မဟုတ်) .srt ဖိုင် တစ်ခုခု ထည့်ပါခင်ဗျာ။');
        return;
    }

    loading.classList.remove('hidden');
    resultBox.value = '';

    // Simulate Extraction Process
    setTimeout(() => {
        loading.classList.add('hidden');
        let sourceName = srtInput ? srtInput.name : link;
        resultBox.value = `[SUCCESS] ဇာတ်လမ်းအချက်အလက် ထုတ်ယူပြီးပါပြီ!\n` +
                          `📂 Source: ${sourceName}\n\n` +
                          `⏱️ [00:00 - 01:30] ဇာတ်လမ်း အစပိုင်း မိတ်ဆက်နှင့် ဇာတ်ကောင်ပေါ်လာခြင်း။\n` +
                          `⏱️ [01:31 - 05:00] ပင်မပြဿနာ စတင်ပေါ်ပေါက်လာပြီး လျှို့ဝှက်ချက်ကို ရှာဖွေခြင်း။\n` +
                          `⏱️ [05:01 - 10:00] အလှည့်အပြောင်းနှင့် အထွတ်အထိပ် (Climax) အပိုင်း။\n\n` +
                          `👉 ဆက်လက်၍ ဒုတိယအဆင့် (AI Script ရေးသားခြင်း) သို့ သွားရောက်နိုင်ပါပြီ။`;
    }, 2000);
}
