import { useEffect, useRef, useState } from "react";
import { getInterviewQuestions, interviewCopy, parseSpokenChoice } from "./interviewFlow.js";
import { useSpeechSynthesis } from "./useSpeechSynthesis.js";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function localized(value, language) {
  if (typeof value === "string") return value;
  return value?.[language] || value?.en || "";
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="inline-block h-4 w-4 align-[-0.15em]">
      <path d="M3.5 8v4h3l4 3V5l-4 3h-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13 7a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function verificationNote(status, language) {
  const notes = {
    official_source_reviewed_case_verification_required: {
      hi: "सरकारी स्रोत देखा गया; परिवार और राज्य की पुष्टि बाकी है।",
      en: "Official source reviewed; family and state verification remains.",
    },
    official_scheme_portal_reviewed_bank_assessment_required: {
      hi: "योजना का सरकारी पृष्ठ देखा गया; ऋण का फैसला बैंक करेगा।",
      en: "Government scheme page reviewed; the bank makes the credit decision.",
    },
    official_guidelines_reviewed_current_state_and_season_notification_required: {
      hi: "सरकारी दिशानिर्देश देखे गए; मौजूदा राज्य और मौसम की सूची जाँचनी होगी।",
      en: "Official guidelines reviewed; the current state and season list must be checked.",
    },
  };
  return notes[status]?.[language] || (language === "hi" ? "जाँच की स्थिति योजना के पृष्ठ पर देखें।" : language === "pa" ? "ਜਾਂਚ ਦੀ ਸਥਿਤੀ ਯੋਜਨਾ ਦੇ ਸਰਕਾਰੀ ਪੰਨੇ ’ਤੇ ਵੇਖੋ।" : "Check the scheme page for verification status.");
}

function buildShareMessage(assessment, language, copy) {
  const results = (assessment?.results || [])
    .filter((result) => result.eligibility_status !== "ineligible")
    .slice(0, 3);
  const lines = [copy.shareIntro, ""];

  if (!results.length) {
    lines.push(copy.shareNoMatches);
  } else {
    results.forEach((result, index) => {
      lines.push(`${index + 1}. ${localized(result.name, language)} — ${copy.status[result.eligibility_status] || copy.status.needs_verification}`);
      if (result.reasons?.length) lines.push(`${copy.reason}: ${localized(result.reasons[0], language)}`);
      if (result.benefit_summary && result.verification_status !== "unverified") {
        lines.push(`${copy.benefit}: ${localized(result.benefit_summary, language)}`);
      }
      if (result.required_documents?.length) {
        lines.push(`${copy.documents}: ${result.required_documents.map((item) => localized(item, language)).join("; ")}`);
      }
      result.official_sources?.forEach((source) => lines.push(`${localized(source.label, language)}: ${source.url}`));
      lines.push("");
    });
  }

  lines.push(copy.shareDisclaimer);
  return lines.join("\n");
}

function StatusBadge({ status, language, copy }) {
  const styles = {
    potentially_eligible: "border-[#cfe0d0] bg-[#edf5ed] text-[#285b3d]",
    needs_verification: "border-[#e8dcb5] bg-[#faf5e5] text-[#6f5720]",
    ineligible: "border-[#ead1c9] bg-[#fbefec] text-[#8d392b]",
  };
  return (
    <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${styles[status] || styles.needs_verification}`}>
      {copy.status[status] || copy.status.needs_verification}
    </span>
  );
}

function SchemeResult({ result, language, copy, speak, speaking, stopSpeech }) {
  const sourceDate = result.official_sources?.[0]?.checked_at;
  const speechText = [
    localized(result.name, language),
    copy.status[result.eligibility_status] || copy.status.needs_verification,
    localized(result.overview, language),
    ...result.reasons.map((reason) => localized(reason, language)),
    ...result.conditions_to_verify.map((condition) => localized(condition, language)),
    ...result.required_documents.map((document) => localized(document, language)),
  ].join(". ");
  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h3 className="font-display text-xl font-semibold leading-8 text-ink">{localized(result.name, language)}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={result.eligibility_status} language={language} copy={copy} />
          <button type="button" onClick={() => speaking ? stopSpeech() : speak(speechText)} className="min-h-10 rounded-full border border-line bg-white px-3 text-xs font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
            {speaking ? copy.stopSpeech : <><SpeakerIcon /> {copy.listenScheme}</>}
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm leading-7 text-muted">{localized(result.overview, language)}</p>
      <p className="mt-3 rounded-xl bg-[#f7f6f1] px-4 py-3 text-sm leading-6 text-ink">
        <strong>{copy.benefit}: </strong>{localized(result.benefit_summary, language)}
      </p>

      {result.reasons?.length > 0 && (
        <section className="mt-5">
          <h4 className="text-sm font-bold text-ink">{copy.reason}</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            {result.reasons.map((reason, index) => <li key={index}>{localized(reason, language)}</li>)}
          </ul>
        </section>
      )}

      {result.conditions_to_verify?.length > 0 && (
        <section className="mt-5">
          <h4 className="text-sm font-bold text-ink">{copy.verify}</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            {result.conditions_to_verify.map((condition, index) => <li key={index}>{localized(condition, language)}</li>)}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h4 className="text-sm font-bold text-ink">{copy.documents}</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
          {result.required_documents.map((document, index) => <li key={index}>{localized(document, language)}</li>)}
        </ul>
      </section>

      <p className="mt-5 text-xs leading-5 text-muted">{verificationNote(result.verification_status, language)}{sourceDate ? ` ${language === "hi" ? "स्रोत देखा:" : language === "pa" ? "ਸਰੋਤ ਜਾਂਚਿਆ:" : "Source checked:"} ${sourceDate}.` : ""}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {result.official_sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-forest underline decoration-[#b8cdbb] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
            {localized(source.label, language)} ↗
          </a>
        ))}
      </div>
    </article>
  );
}

function InterviewFlow({ language, transcript, transcriptComplete, initialRequest, listening, starting, processing, voiceMessage, startListening, stopListening, clearTranscript, onRestart }) {
  const text = interviewCopy[language];
  const questions = getInterviewQuestions(language);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [textAnswer, setTextAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [requestState, setRequestState] = useState("idle");
  const [assessment, setAssessment] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [shareMessageCopied, setShareMessageCopied] = useState(false);
  const handledTranscript = useRef("");
  const speech = useSpeechSynthesis(language);
  const question = questions[questionIndex];
  const isLoading = requestState === "loading";

  useEffect(() => {
    if (requestState !== "idle" || !question) return undefined;
    let cancelled = false;

    async function askThenListen() {
      await speech.speak(question.prompt);
      if (!cancelled) startListening();
    }

    askThenListen();
    return () => {
      cancelled = true;
      speech.stop();
      stopListening();
    };
  }, [questionIndex, language, requestState]);

  useEffect(() => {
    if (requestState !== "complete" || !assessment) return;
    const rows = (assessment.results || []).slice(0, 3);
    const response = rows.length
      ? `${text.resultsTitle}. ${rows.map((result) => `${localized(result.name, language)}. ${text.status[result.eligibility_status] || text.status.needs_verification}`).join(". ")}. ${text.spokenSummary}`
      : text.noResults;
    speech.speak(response.slice(0, 1000));
  }, [assessment, requestState, language]);

  async function requestAssessment(nextAnswers) {
    setRequestState("loading");
    setErrorMessage("");
    try {
      const response = await fetch(`${apiBase}/api/eligibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      if (!response.ok) throw new Error(`Assessment failed (${response.status})`);
      const result = await response.json();
      setAssessment(result);
      setRequestState("complete");
    } catch {
      setRequestState("error");
    }
  }

  function saveAnswer(value) {
    if (isLoading) return;
    speech.stop();
    const answerLabel = question.kind === "choice"
      ? question.options.find((option) => option.value === value)?.label || text.skip
      : value.trim() || text.skip;
    setConversation((previous) => [
      ...previous.filter((item) => item.key !== question.key),
      { key: question.key, text: answerLabel },
    ]);
    const nextAnswers = { ...answers, [question.key]: value };
    setAnswers(nextAnswers);
    setTextAnswer("");
    setErrorMessage("");
    clearTranscript();
    if ((question.key === "farming" && value === "no") || questionIndex === questions.length - 1) {
      requestAssessment(nextAnswers);
    } else {
      setQuestionIndex(questionIndex + 1);
    }
  }

  function applySpokenAnswer() {
    if (!transcript.trim()) return;
    if (question.kind === "text") {
      saveAnswer(transcript.trim());
      return;
    }
    const value = parseSpokenChoice(question.key, transcript);
    if (!value) {
      setErrorMessage(text.ambiguous);
      return;
    }
    saveAnswer(value);
  }

  useEffect(() => {
    const spokenAnswer = transcript.trim();
    if (!spokenAnswer) {
      handledTranscript.current = "";
      return;
    }
    if (!transcriptComplete || isLoading || handledTranscript.current === spokenAnswer) return;

    // Chariot sends transcript deltas while processing. Only a finalized transcript
    // (status idle) reaches this effect, so an answer is submitted exactly once.
    handledTranscript.current = spokenAnswer;
    applySpokenAnswer();
  }, [transcript, transcriptComplete, isLoading, question.key, applySpokenAnswer]);

  function submitText(event) {
    event.preventDefault();
    if (!textAnswer.trim() && question.key !== "state" && question.key !== "crop_season") return;
    saveAnswer(textAnswer.trim());
  }

  async function retryAssessment() {
    await requestAssessment(answers);
  }

  if (requestState === "complete" && assessment) {
    const results = assessment.results || [];
    const hasPotential = results.some((result) => result.eligibility_status !== "ineligible");
    const shareMessage = buildShareMessage(assessment, language, text);
    const smsMessage = [
      text.shareIntro,
      ...(results.filter((result) => result.eligibility_status !== "ineligible").slice(0, 3).map((result) => {
        const details = [
          `${localized(result.name, language)} — ${localized(result.reasons?.[0] || result.eligibility_summary, language)}`,
          result.required_documents?.[0] && `${text.documents}: ${localized(result.required_documents[0], language)}`,
          result.official_sources?.[0]?.url,
        ].filter(Boolean);
        return details.join("; ");
      })),
      ...(!hasPotential ? [text.shareNoMatches] : []),
      text.shareDisclaimer,
    ].join("\n");
    return (
      <div className="max-w-3xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted">{language === "hi" ? "चरण 02 / 03" : language === "pa" ? "ਪੜਾਅ 02 / 03" : "STEP 02 / 03"}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{text.resultsTitle}</h2>
          </div>
          <button type="button" onClick={onRestart} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{text.restart}</button>
        </div>
        <p className="mb-5 rounded-xl border border-[#e6e3d9] bg-white/70 p-4 text-sm leading-6 text-muted">{localized(assessment.notice, language)} {text.noApproval}</p>
        {!hasPotential && <p className="mb-5 rounded-xl bg-[#f7f6f1] p-4 text-sm leading-6 text-muted">{text.noResults}</p>}
        <div className="space-y-4">
          {results.slice(0, 3).map((result) => <SchemeResult key={result.id} result={result} language={language} copy={text} speak={speech.speak} speaking={speech.speaking} stopSpeech={speech.stop} />)}
        </div>
        <section className="mt-6 rounded-2xl border border-line bg-white p-5" aria-label={text.shareTitle}>
          <h3 className="font-display text-lg font-semibold text-ink">{text.shareTitle}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{text.shareHelp}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-forest px-4 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{text.shareWhatsApp}</a>
            <a href={`sms:?body=${encodeURIComponent(smsMessage)}`} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{text.shareSms}</a>
            <button type="button" onClick={async () => {
              try {
                await navigator.clipboard.writeText(smsMessage);
                setShareMessageCopied(true);
              } catch {
                setShareMessageCopied(false);
              }
            }} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{shareMessageCopied ? text.shareCopied : text.shareCopySms}</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted" role="status">{shareMessageCopied ? text.shareCopiedHelp : text.shareSendHelp}</p>
        </section>
        {speech.message && <p className="mt-4 text-sm leading-6 text-muted" role="status">{speech.message}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted">{language === "hi" ? "चरण 02 / 03" : language === "pa" ? "ਪੜਾਅ 02 / 03" : "STEP 02 / 03"}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{text.title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{text.intro}</p>
        </div>
        <button type="button" onClick={onRestart} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{text.restart}</button>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
        {(initialRequest || conversation.length > 0) && (
          <div className="mb-5 space-y-2" aria-label={language === "hi" ? "बातचीत" : language === "pa" ? "ਗੱਲਬਾਤ" : "Conversation"} aria-live="polite">
            {initialRequest && (
              <p className="max-w-[90%] rounded-xl bg-[#f7f6f1] px-4 py-3 text-sm leading-6 text-ink">
                <span className="mb-1 block text-xs font-bold text-muted">{language === "hi" ? "आपने कहा" : language === "pa" ? "ਤੁਸੀਂ ਕਿਹਾ" : "You said"}</span>
                {initialRequest}
              </p>
            )}
            {conversation.map((message) => (
              <p key={message.key} className="ml-auto max-w-[90%] rounded-xl bg-[#eff4eb] px-4 py-3 text-sm leading-6 text-ink">
                <span className="mb-1 block text-xs font-bold text-muted">{language === "hi" ? "आपका जवाब" : language === "pa" ? "ਤੁਹਾਡਾ ਜਵਾਬ" : "Your answer"}</span>
                {message.text}
              </p>
            ))}
          </div>
        )}
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="text-sm font-bold text-forest">{text.question} {questionIndex + 1} {text.of} 6</span>
          <span className="text-xs font-semibold text-muted">{questionIndex + 1}/6</span>
        </div>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#e8e6dc]" role="progressbar" aria-valuemin="1" aria-valuemax="6" aria-valuenow={questionIndex + 1} aria-label={`${text.question} ${questionIndex + 1} ${text.of} 6`}>
          <span className="block h-full rounded-full bg-forest transition-[width]" style={{ width: `${((questionIndex + 1) / 6) * 100}%` }} />
        </div>

        <h3 className="font-display text-2xl font-semibold leading-9 text-ink">{question.prompt}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{question.helper}</p>

        <div className="mt-5 flex flex-col items-start gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => speech.speaking ? speech.stop() : speech.speak(question.prompt)} className="min-h-12 rounded-full border border-line bg-white px-4 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
              {speech.speaking ? text.stopSpeech : <><SpeakerIcon /> {text.listenQuestion}</>}
            </button>
            <button type="button" onClick={() => { speech.stop(); listening || starting ? stopListening() : startListening(); }} aria-pressed={listening} aria-busy={starting || processing} disabled={processing} className={`inline-flex min-h-12 items-center gap-3 rounded-full px-5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-wait disabled:opacity-75 ${listening ? "bg-[#a64735]" : "bg-forest"}`}>
              <span className="h-2.5 w-2.5 rounded-full bg-white/90" aria-hidden="true" />
              {listening ? text.stop : starting ? text.requesting : processing ? text.processing : text.listen}
            </button>
          </div>
          {(listening || starting || processing) && <p className="text-sm font-semibold text-forest" role="status" aria-live="polite">{listening ? `${text.listening} ${text.silenceSubmit}` : processing ? text.processing : text.requesting}</p>}
          {transcript && (
            <div className="w-full rounded-xl border border-line bg-[#f7f6f1] p-4" aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{language === "hi" ? "आपने कहा" : language === "pa" ? "ਤੁਸੀਂ ਕਿਹਾ" : "We heard"}</p>
              <p className="mt-1 text-base leading-7 text-ink">{transcript}</p>
            </div>
          )}
          {voiceMessage && <p className="text-sm leading-6 text-[#8d392b]" role="status">{voiceMessage}</p>}
          {errorMessage && <p className="text-sm leading-6 text-[#8d392b]" role="alert">{errorMessage}</p>}
          {speech.message && <p className="text-sm leading-6 text-muted" role="status">{speech.message}</p>}
        </div>

        {question.kind === "choice" ? (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {question.options.map((option) => (
              <button key={option.value} type="button" onClick={() => saveAnswer(option.value)} disabled={isLoading} className="min-h-14 rounded-xl border border-line bg-white px-4 py-3 text-left text-sm font-semibold leading-6 text-ink transition hover:border-[#afc6b1] hover:bg-[#f3f7f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50">
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <form className="mt-6" onSubmit={submitText}>
            <label htmlFor={`answer-${question.key}`} className="mb-2 block text-sm font-semibold text-ink">{text.answerLabel}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id={`answer-${question.key}`} value={textAnswer} onChange={(event) => setTextAnswer(event.target.value)} maxLength={question.key === "state" ? 50 : 120} placeholder={question.placeholder || text.placeholder} className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-forest" />
              <button type="submit" className="min-h-12 rounded-xl bg-forest px-5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{text.next}</button>
            </div>
            <button type="button" onClick={() => saveAnswer("")} className="mt-3 min-h-10 rounded-lg px-3 text-sm font-semibold text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">{text.skip}</button>
          </form>
        )}

        {questionIndex > 0 && (
          <button type="button" onClick={() => { setQuestionIndex(questionIndex - 1); setTextAnswer(answers[questions[questionIndex - 1].key] || ""); setErrorMessage(""); clearTranscript(); }} className="mt-5 min-h-10 rounded-lg px-3 text-sm font-semibold text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">
            {text.back}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted">{text.privacy}</p>

      {isLoading && <p className="mt-6 rounded-xl bg-[#eff4eb] p-4 text-sm font-semibold text-forest" role="status" aria-live="polite">{text.resultsLoading}</p>}
      {requestState === "error" && (
        <div className="mt-6 rounded-xl border border-[#ead1c9] bg-[#fbefec] p-4" role="alert">
          <p className="text-sm leading-6 text-[#8d392b]">{text.resultsError}</p>
          <button type="button" onClick={retryAssessment} className="mt-3 min-h-10 rounded-lg bg-white px-4 text-sm font-bold text-forest ring-1 ring-line">{text.retry}</button>
        </div>
      )}
    </div>
  );
}

export default InterviewFlow;
