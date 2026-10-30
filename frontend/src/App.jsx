import { useEffect, useState } from "react";
import InterviewFlow from "./InterviewFlow.jsx";
import { useChariotSpeech } from "./useChariotSpeech.js";

const copy = {
  hi: {
    language: "हिन्दी",
    greeting: "सरकारी योजनाएँ समझना हुआ आसान।",
    detail: "अपनी बात अपनी भाषा में कहें। फिर खेती से जुड़े छह तक सवालों के जवाब देकर तीन सरकारी योजनाओं की शुरुआती जाँच करें।",
    action: "बोलना शुरू करें",
    listening: "सुन रहे हैं…",
    requesting: "माइक की अनुमति का इंतज़ार…",
    stop: "सुनना बंद करें",
    heard: "आपने कहा",
    continue: "योजना की शुरुआती जाँच करें",
    hint: "जैसे: मुझे खेती के लिए मदद चाहिए",
    privacy: "आवाज़ Chariot को पहचान के लिए भेजी जाएगी; वहाँ सत्र और लिखे शब्द खाते के इतिहास में सहेजे जा सकते हैं। पहचान संख्या या बैंक जानकारी न बोलें।",
    phase: "आवाज़ की जाँच",
    phaseDetail: "अपनी ज़रूरत बोलें, फिर खेती के बारे में छह तक सवालों के जवाब दें। योजना की अंतिम पुष्टि सरकारी विभाग या बैंक करेगा।",
    online: "सर्वर जुड़ा है",
    offline: "सर्वर से जुड़ नहीं पाया",
    checking: "सर्वर जाँच रहे हैं",
    processing: "बोली बात लिख रहे हैं…",
    unsupported: "इस ब्राउज़र में आवाज़ पहचान नहीं है। नीचे अपनी ज़रूरत लिखकर जारी रखें।",
    failed: "आवाज़ नहीं सुन पाए। कृपया फिर कोशिश करें।",
    permissionDenied: "माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र की साइट सेटिंग में माइक्रोफ़ोन चालू करें, फिर कोशिश करें।",
    serviceNotAllowed: "ब्राउज़र ने आवाज़ पहचान सेवा रोक दी। साइट सेटिंग और इंटरनेट जाँचें।",
    audioCapture: "माइक्रोफ़ोन नहीं चल पाया। उसका कनेक्शन जाँचें और फिर कोशिश करें।",
    noSpeech: "कोई आवाज़ नहीं मिली। पास से साफ़ बोलकर फिर कोशिश करें।",
    network: "आवाज़ पहचान सेवा से नहीं जुड़ पाए। इंटरनेट जाँचें और फिर कोशिश करें।",
    languageNotSupported: "इस ब्राउज़र में हिन्दी आवाज़ पहचान उपलब्ध नहीं है।",
    fallbackLabel: "अपनी ज़रूरत यहाँ लिखें",
    fallbackAction: "आगे बढ़ें",
    textInstead: "या लिखकर जारी रखें",
    hideText: "लिखने का विकल्प छिपाएँ",
    fallbackHint: "यह शुरुआती जाँच है; लिखी बात अभी ब्राउज़र में ही रहेगी।",
  },
  en: {
    language: "English",
    greeting: "Government schemes, made easier to understand.",
    detail: "Say what you need, then answer up to six farming questions for a preliminary check against three government schemes.",
    action: "Start speaking",
    listening: "Listening…",
    requesting: "Waiting for microphone permission…",
    stop: "Stop listening",
    heard: "We heard",
    continue: "Check possible schemes",
    hint: "Speak in Hindi. For example: मुझे खेती के लिए मदद चाहिए",
    privacy: "Speech is sent to Chariot for recognition; its workspace may retain the session and transcript. Don’t share ID or bank details.",
    phase: "Voice check",
    phaseDetail: "Say what you need, then answer up to six farming questions. A government department or bank must make the final decision.",
    online: "Service connected",
    offline: "Service unavailable",
    checking: "Checking service",
    processing: "Transcribing your speech…",
    unsupported: "Speech recognition isn’t available here. You can enter your request below.",
    failed: "We couldn’t hear that. Please try again.",
    permissionDenied: "Microphone access was denied. Allow it in this site’s browser settings, then try again.",
    serviceNotAllowed: "The browser blocked its speech recognition service. Check site settings and your connection.",
    audioCapture: "The microphone could not be opened. Check its connection and try again.",
    noSpeech: "We didn’t detect speech. Speak nearby and try again.",
    network: "The speech service could not be reached. Check your connection and try again.",
    languageNotSupported: "Hindi speech recognition is not available in this browser.",
    fallbackLabel: "Write what you need",
    fallbackAction: "Continue",
    textInstead: "Or type instead",
    hideText: "Hide text entry",
    fallbackHint: "This is an initial check; your words stay in this browser for now.",
  },
};

copy.pa = {
  ...copy.en,
  language: "ਪੰਜਾਬੀ",
  greeting: "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਨੂੰ ਸਮਝਣਾ ਹੁਣ ਆਸਾਨ।",
  detail: "ਆਪਣੀ ਗੱਲ ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਦੱਸੋ ਅਤੇ ਖੇਤੀ ਬਾਰੇ ਛੇ ਤੱਕ ਸੌਖੇ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ।",
  action: "ਬੋਲਣਾ ਸ਼ੁਰੂ ਕਰੋ",
  listening: "ਸੁਣ ਰਹੇ ਹਾਂ…",
  requesting: "ਮਾਈਕ ਦੀ ਇਜਾਜ਼ਤ ਦੀ ਉਡੀਕ…",
  stop: "ਸੁਣਨਾ ਬੰਦ ਕਰੋ",
  heard: "ਤੁਸੀਂ ਕਿਹਾ",
  continue: "ਯੋਜਨਾਵਾਂ ਦੀ ਜਾਂਚ ਕਰੋ",
  hint: "ਉਦਾਹਰਨ: ਮੈਨੂੰ ਖੇਤੀ ਲਈ ਮਦਦ ਚਾਹੀਦੀ ਹੈ",
  privacy: "ਆਵਾਜ਼ ਪਛਾਣ ਲਈ Chariot ਨੂੰ ਭੇਜੀ ਜਾਂਦੀ ਹੈ। ਪਛਾਣ ਨੰਬਰ ਜਾਂ ਬੈਂਕ ਜਾਣਕਾਰੀ ਨਾ ਦਿਓ।",
  phase: "ਆਵਾਜ਼ ਦੀ ਜਾਂਚ",
  phaseDetail: "ਆਪਣੀ ਲੋੜ ਦੱਸੋ ਅਤੇ ਖੇਤੀ ਬਾਰੇ ਛੇ ਤੱਕ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ। ਅੰਤਿਮ ਪੁਸ਼ਟੀ ਸਰਕਾਰੀ ਵਿਭਾਗ ਜਾਂ ਬੈਂਕ ਕਰੇਗਾ।",
  online: "ਸਰਵਰ ਜੁੜਿਆ ਹੈ",
  offline: "ਸਰਵਰ ਨਾਲ ਜੁੜ ਨਹੀਂ ਸਕੇ",
  checking: "ਸਰਵਰ ਦੀ ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ",
  processing: "ਤੁਹਾਡੀ ਗੱਲ ਲਿਖੀ ਜਾ ਰਹੀ ਹੈ…",
  unsupported: "ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਆਵਾਜ਼ ਪਛਾਣ ਉਪਲਬਧ ਨਹੀਂ। ਹੇਠਾਂ ਲਿਖ ਕੇ ਜਾਰੀ ਰੱਖੋ।",
  failed: "ਆਵਾਜ਼ ਪਛਾਣ ਨਹੀਂ ਹੋ ਸਕੀ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  permissionDenied: "ਮਾਈਕ ਦੀ ਇਜਾਜ਼ਤ ਨਹੀਂ ਮਿਲੀ। ਬ੍ਰਾਊਜ਼ਰ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਮਾਈਕ ਚਾਲੂ ਕਰੋ।",
  noSpeech: "ਕੋਈ ਆਵਾਜ਼ ਨਹੀਂ ਮਿਲੀ। ਨੇੜੇ ਤੋਂ ਸਾਫ਼ ਬੋਲ ਕੇ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  fallbackLabel: "ਆਪਣੀ ਲੋੜ ਇੱਥੇ ਲਿਖੋ",
  fallbackAction: "ਅੱਗੇ ਜਾਓ",
  textInstead: "ਜਾਂ ਲਿਖ ਕੇ ਜਾਰੀ ਰੱਖੋ",
  hideText: "ਲਿਖਣ ਦਾ ਵਿਕਲਪ ਲੁਕਾਓ",
  fallbackHint: "ਇਹ ਸ਼ੁਰੂਆਤੀ ਜਾਂਚ ਹੈ।",
};

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-8 w-8">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  const [language, setLanguage] = useState("hi");
  const [initialRequest, setInitialRequest] = useState("");
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [serviceStatus, setServiceStatus] = useState("checking");
  const speechInput = useChariotSpeech();
  const { transcript, error: voiceMessage } = speechInput;
  const starting = ["requesting", "connecting"].includes(speechInput.status);
  const listening = speechInput.status === "listening";
  const processing = speechInput.status === "processing";
  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language === "pa" ? "pa" : language === "hi" ? "hi" : "en";
  }, [language]);

  useEffect(() => {
    if (speechInput.status === "error") setShowTextFallback(true);
  }, [speechInput.status]);

  useEffect(() => {
    let cancelled = false;
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    fetch(`${apiBase}/api/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API health check failed");
        return response.json();
      })
      .then((health) => {
        if (!cancelled) setServiceStatus(health.status === "ok" && health.speech_configured ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setServiceStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function startListening() {
    speechInput.clear();
    setShowTextFallback(false);
    speechInput.start(language);
  }

  function stopListening() {
    speechInput.stop();
  }

  const statusLabel = {
    checking: t.checking,
    online: t.online,
    offline: t.offline,
    processing: t.processing,
  }[serviceStatus];

  return (
    <main className="app-shell min-h-screen bg-[#dce8cd] px-3 py-3 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="app-frame mx-auto flex max-w-[1440px] flex-col overflow-hidden rounded-[1.5rem] border border-[#cfdbc1] bg-[#fffefa] shadow-[0_24px_80px_-42px_rgba(42,64,37,0.38)] sm:rounded-[2rem]">
        <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5 lg:px-12">
          <a href="#home" className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest" aria-label="Sahayak home">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span>
              <span className="block font-display text-xl font-bold leading-tight tracking-tight text-ink">सहायक</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">SAHAYAK</span>
            </span>
          </a>

          <label className="sr-only" htmlFor="language">Choose language</label>
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-full border border-line bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-forest"
          >
            <option value="hi">हिन्दी</option>
            <option value="en">English</option>
            <option value="pa">ਪੰਜਾਬੀ</option>
          </select>
        </header>

        <section id="home" className={`grid flex-1 items-center gap-10 px-5 py-10 sm:gap-12 sm:px-8 sm:py-14 lg:gap-20 lg:px-14 lg:py-12 ${interviewStarted ? "grid-cols-1" : "lg:grid-cols-[1.05fr_0.95fr]"}`}>
          {interviewStarted ? (
            <div className="mx-auto w-full max-w-4xl">
              <InterviewFlow
                language={language}
                transcript={transcript}
                transcriptComplete={speechInput.status === "idle" && Boolean(transcript.trim())}
                initialRequest={initialRequest}
                listening={listening}
                starting={starting}
                processing={processing}
                voiceMessage={voiceMessage}
                startListening={startListening}
                stopListening={stopListening}
                clearTranscript={speechInput.clear}
                onRestart={() => {
                  stopListening();
                  speechInput.clear();
                  setInterviewStarted(false);
                  setInitialRequest("");
                  setShowTextFallback(false);
                }}
              />
            </div>
          ) : <div className="mx-auto w-full max-w-xl lg:mx-0">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8e3d4] bg-[#eff4eb] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-forest">
              <span className="h-2 w-2 rounded-full bg-forest" aria-hidden="true" />
              {language === "hi" ? "आपकी भाषा में, आपकी मदद के लिए" : language === "pa" ? "ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਮਦਦ ਲਈ" : "Here to help, in your language"}
            </p>
            <h1 className="font-display max-w-[14ch] text-4xl font-semibold leading-[1.13] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[3.7rem]">
              {t.greeting}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted sm:text-lg">
              {t.detail}
            </p>

            <div className="mt-9 flex flex-col items-start gap-4">
              <button
                type="button"
                onClick={listening || starting ? stopListening : startListening}
                aria-pressed={listening}
                aria-busy={starting || processing}
                disabled={processing}
                className={`group inline-flex min-h-16 w-full max-w-sm items-center justify-center gap-3 rounded-full px-6 text-base font-bold shadow-[0_12px_28px_-14px_rgba(28,76,51,0.45)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest disabled:cursor-wait disabled:opacity-75 ${listening ? "bg-[#a64735] text-white hover:bg-[#8d392b]" : "bg-[#e2ed68] text-[#26331f] hover:bg-[#d6e35a]"}`}
              >
                <span className={`grid h-11 w-11 place-items-center rounded-full ${listening ? "bg-white/15" : "bg-[#293a27]/10"}`}>
                  <MicrophoneIcon />
                </span>
                {listening && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />}
                {listening ? t.stop : starting ? t.requesting : processing ? t.processing : t.action}
              </button>
              {(starting || listening || processing) && (
                <p className="flex items-center gap-2 text-sm font-semibold text-forest" role="status" aria-live="polite">
                  <span className={`h-2.5 w-2.5 rounded-full ${listening ? "animate-pulse bg-[#a64735]" : "bg-[#b79a4b]"}`} aria-hidden="true" />
                  {listening ? t.listening : processing ? t.processing : t.requesting}
                </p>
              )}
              <p className="text-sm text-muted">{t.hint}</p>
              <button
                type="button"
                onClick={() => {
                  if (listening || starting) stopListening();
                  setShowTextFallback((visible) => !visible);
                }}
                disabled={processing}
                className="min-h-10 rounded-lg text-sm font-semibold text-forest underline decoration-[#b8cdbb] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-60"
              >
                {showTextFallback ? t.hideText : t.textInstead}
              </button>
            </div>

            <div className="mt-7 min-h-16" aria-live="polite" aria-atomic="true">
              {transcript && (
                <div className="max-w-lg rounded-2xl border border-line bg-white/70 px-5 py-3.5">
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted">{t.heard}</span>
                  <p className="mt-1 text-base font-medium leading-7 text-ink">{transcript}</p>
                  <button type="button" onClick={() => { setInitialRequest(transcript.trim()); speechInput.clear(); setShowTextFallback(false); setInterviewStarted(true); }} className="mt-3 min-h-11 rounded-xl bg-forest px-4 text-sm font-bold text-white transition hover:bg-forest-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    {t.continue}
                  </button>
                </div>
              )}
              {voiceMessage && <p className="max-w-lg text-sm leading-6 text-[#8d392b]">{voiceMessage}</p>}
            </div>

            {showTextFallback && (
              <form
                className="mb-6 max-w-lg"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!textDraft.trim()) return;
                  speechInput.clear();
                  speechInput.setTranscript(textDraft.trim());
                  setTextDraft("");
                  setShowTextFallback(false);
                }}
              >
                <label htmlFor="text-fallback" className="mb-2 block text-sm font-semibold text-ink">{t.fallbackLabel}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="text-fallback"
                    value={textDraft}
                    onChange={(event) => setTextDraft(event.target.value)}
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/70 focus-visible:ring-2 focus-visible:ring-forest"
                    placeholder={t.hint}
                    autoFocus
                  />
                  <button type="submit" className="min-h-12 rounded-xl bg-forest px-5 text-sm font-bold text-white transition hover:bg-forest-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    {t.fallbackAction}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{t.fallbackHint}</p>
              </form>
            )}

            <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-muted">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
                <path d="M5.75 8V5.75a4.25 4.25 0 0 1 8.5 0V8m-9.5 0h10.5v8.25H4.75V8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              {t.privacy}
            </p>
          </div>}

          {!interviewStarted && <aside className="relative mx-auto w-full max-w-[28rem] lg:justify-self-end" aria-label={t.phase}>
            <div className="absolute -right-5 -top-7 h-28 w-28 rounded-full bg-[#e4eadb] sm:-right-8 sm:-top-10 sm:h-36 sm:w-36" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[2rem] border border-[#e6e3d9] bg-white p-7 shadow-[0_20px_60px_-40px_rgba(42,52,39,0.35)] sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">01 / 03</span>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">{t.phase}</h2>
                </div>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3f1e9] text-forest">
                  <MicrophoneIcon />
                </div>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-7 text-muted">{t.phaseDetail}</p>
              <div className="mt-8 flex gap-2" aria-hidden="true">
                <span className="h-1.5 flex-1 rounded-full bg-forest" />
                <span className="h-1.5 flex-1 rounded-full bg-[#e8e6dc]" />
                <span className="h-1.5 flex-1 rounded-full bg-[#e8e6dc]" />
              </div>
              <div className="mt-8 rounded-2xl bg-[#f7f6f1] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{language === "hi" ? "आगे क्या बनेगा" : language === "pa" ? "ਅੱਗੇ ਕੀ ਹੋਵੇਗਾ" : "What comes next"}</p>
                <div className="mt-4 space-y-3">
                  {(language === "hi"
                    ? ["छह तक आसान सवाल", "जाँची हुई योजना की जानकारी", "शर्तें और ज़रूरी कागज़"]
                    : language === "pa"
                      ? ["ਛੇ ਤੱਕ ਸੌਖੇ ਸਵਾਲ", "ਜਾਂਚੀ ਹੋਈ ਯੋਜਨਾ ਜਾਣਕਾਰੀ", "ਸ਼ਰਤਾਂ ਅਤੇ ਲੋੜੀਂਦੇ ਕਾਗਜ਼"]
                      : ["Up to six simple questions", "Reviewed scheme information", "Conditions and required documents"]
                  ).map((step, index) => (
                    <div key={step} className="flex items-center gap-3 text-sm font-medium text-ink">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#d8e3d4] bg-white text-[11px] font-bold text-forest">{index + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative mt-4 flex items-center gap-2 px-2 text-xs font-medium text-muted" role="status" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${serviceStatus === "online" ? "bg-[#458454]" : serviceStatus === "offline" ? "bg-[#b05b46]" : "animate-pulse bg-[#b79a4b]"}`} aria-hidden="true" />
              {statusLabel}
            </div>
          </aside>}
        </section>

        <footer className="flex flex-col gap-2 border-t border-line px-5 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span>{language === "hi" ? "सरकारी योजनाओं की जानकारी — सरल और सबके लिए" : language === "pa" ? "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਦੀ ਜਾਣਕਾਰੀ — ਸੌਖੀ ਅਤੇ ਸਭ ਲਈ" : "Government scheme information, made simpler for everyone"}</span>
          <span>{language === "hi" ? "हिंदी · English" : language === "pa" ? "ਪੰਜਾਬੀ · English · हिन्दी" : "ਹिन्दी · English · ਪੰਜਾਬੀ"}</span>
        </footer>
      </div>
    </main>
  );
}

export default App;
