import { useCallback, useEffect, useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const outputSampleRate = 16000;
const speechRmsThreshold = 0.01;
const silenceDurationMs = 2000;

const copy = {
  hi: {
    unsupported: "इस ब्राउज़र में माइक से आवाज़ लेना उपलब्ध नहीं है। नीचे लिखकर जारी रखें।",
    denied: "माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र की साइट सेटिंग में माइक चालू करें।",
    missing: "माइक्रोफ़ोन नहीं मिला। उसका कनेक्शन जाँचें और फिर कोशिश करें।",
    failed: "आवाज़ पहचान सेवा से नहीं जुड़ पाए। फिर कोशिश करें या नीचे लिखें।",
    empty: "कोई आवाज़ नहीं मिली। पास से साफ़ बोलकर फिर कोशिश करें।",
  },
  en: {
    unsupported: "Microphone capture is not available in this browser. Type below to continue.",
    denied: "Microphone permission was denied. Allow it in this site’s browser settings.",
    missing: "No microphone was found. Check its connection and try again.",
    failed: "Speech recognition could not connect. Try again or type below.",
    empty: "No speech was detected. Speak nearby and try again.",
  },
  pa: {
    unsupported: "ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਮਾਈਕ ਦੀ ਆਵਾਜ਼ ਉਪਲਬਧ ਨਹੀਂ। ਹੇਠਾਂ ਲਿਖ ਕੇ ਜਾਰੀ ਰੱਖੋ।",
    denied: "ਮਾਈਕ ਦੀ ਇਜਾਜ਼ਤ ਨਹੀਂ ਮਿਲੀ। ਸਾਈਟ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਮਾਈਕ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ।",
    missing: "ਮਾਈਕ ਨਹੀਂ ਮਿਲਿਆ। ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    failed: "ਆਵਾਜ਼ ਪਛਾਣ ਸੇਵਾ ਨਾਲ ਜੁੜ ਨਹੀਂ ਸਕੇ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਲਿਖੋ।",
    empty: "ਕੋਈ ਬੋਲੀ ਨਹੀਂ ਮਿਲੀ। ਨੇੜੇ ਤੋਂ ਬੋਲ ਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  },
};

function resample(input, inputRate) {
  if (inputRate === outputSampleRate) return input;
  const ratio = inputRate / outputSampleRate;
  const output = new Float32Array(Math.floor(input.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), input.length);
    let total = 0;
    for (let sample = start; sample < end; sample += 1) total += input[sample];
    output[index] = total / Math.max(1, end - start);
  }
  return output;
}

function toPcm16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return pcm.buffer;
}

function websocketUrl(language) {
  const base = new URL(apiBase, window.location.href);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/api/speech/transcribe";
  base.search = new URLSearchParams({ language: ["en", "pa"].includes(language) ? language : "hi" }).toString();
  return base.toString();
}

function closeCapture(session, closeSocket = false) {
  if (!session) return;
  if (session.processor) {
    session.processor.onaudioprocess = null;
    session.processor.disconnect();
  }
  session.source?.disconnect();
  session.gain?.disconnect();
  session.stream?.getTracks().forEach((track) => track.stop());
  if (session.context && session.context.state !== "closed") {
    session.context.close().catch(() => {});
  }
  if (closeSocket && session.socket?.readyState < WebSocket.CLOSING) {
    session.socket.close();
  }
}

export function useChariotSpeech() {
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const sessionRef = useRef(null);
  const generationRef = useRef(0);

  const stop = useCallback(() => {
    generationRef.current += 1;
    const session = sessionRef.current;
    if (!session) {
      setStatus("idle");
      return;
    }
    if (session.finalizing) return;
    session.finalizing = true;

    closeCapture(session);
    if (session.socket?.readyState === WebSocket.OPEN && session.sentSamples > 0) {
      setStatus("processing");
      session.socket.send(JSON.stringify({ type: "input.done" }));
    } else {
      session.finished = true;
      closeCapture(session, true);
      sessionRef.current = null;
      setStatus("idle");
      if (session.hadStarted && session.sentSamples === 0) {
        setStatus("error");
        setError(copy[session.language].empty);
      }
    }
  }, []);

  const start = useCallback(async (language) => {
    if (sessionRef.current) stop();
    const attempt = generationRef.current + 1;
    generationRef.current = attempt;
    setTranscript("");
    setError("");

    const selectedLanguage = ["en", "pa"].includes(language) ? language : "hi";
    const messages = copy[selectedLanguage];
    if (!navigator.mediaDevices?.getUserMedia || !window.WebSocket || !(window.AudioContext || window.webkitAudioContext)) {
      setStatus("error");
      setError(messages.unsupported);
      return;
    }

    setStatus("requesting");
    let stream;
    try {
      // This request starts directly from the microphone button's click handler.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (permissionError) {
      if (generationRef.current !== attempt) return;
      setStatus("error");
      setError(["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(permissionError?.name)
        ? messages.denied
        : permissionError?.name === "NotFoundError" ? messages.missing : messages.failed);
      return;
    }

    if (generationRef.current !== attempt) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const session = { stream, socket: null, context: null, processor: null, source: null, gain: null, sentSamples: 0, language: selectedLanguage, finished: false, finalizing: false, hadStarted: false, speechDetected: false, lastSpeechAt: 0 };
    sessionRef.current = session;
    setStatus("connecting");

    try {
      const socket = new WebSocket(websocketUrl(language));
      session.socket = socket;
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Speech connection timed out.")), 20000);
        socket.onopen = () => {};
        socket.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error("Speech connection failed."));
        };
        socket.onmessage = (message) => {
          let event;
          try { event = JSON.parse(message.data); } catch { return; }
          if (event.type === "ready") {
            window.clearTimeout(timeout);
            resolve();
          } else if (event.type === "error") {
            window.clearTimeout(timeout);
            reject(new Error(event.message || "Speech recognition failed."));
          }
        };
      });

      if (generationRef.current !== attempt) {
        closeCapture(session, true);
        return;
      }

      socket.onmessage = (message) => {
        let event;
        try { event = JSON.parse(message.data); } catch { return; }
        if (event.type === "transcript.delta") {
          setTranscript((current) => `${current}${event.text || ""}`);
        } else if (event.type === "transcript.done") {
          session.finished = true;
          const finalText = (event.text || "").trim();
          setTranscript(finalText);
          setStatus(finalText ? "idle" : "error");
          if (!finalText) setError(messages.empty);
          closeCapture(session, true);
          sessionRef.current = null;
        } else if (event.type === "error") {
          session.finished = true;
          setStatus("error");
          setError(messages.failed);
          closeCapture(session, true);
          sessionRef.current = null;
        }
      };
      socket.onclose = () => {
        if (sessionRef.current === session && !session.finished) {
          closeCapture(session);
          sessionRef.current = null;
          setStatus("error");
          setError(copy[selectedLanguage].failed);
        }
      };

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio capture is not supported.");
      const context = new AudioContextClass();
      session.context = context;
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const gain = context.createGain();
      gain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        const samples = event.inputBuffer.getChannelData(0);
        let squaredTotal = 0;
        for (let index = 0; index < samples.length; index += 1) squaredTotal += samples[index] * samples[index];
        const rms = Math.sqrt(squaredTotal / Math.max(1, samples.length));
        const now = Date.now();
        if (rms >= speechRmsThreshold) {
          session.speechDetected = true;
          session.lastSpeechAt = now;
        }

        const pcm = toPcm16(resample(samples, context.sampleRate));
        if (!pcm.byteLength) return;
        session.sentSamples += pcm.byteLength / 2;
        socket.send(pcm);

        // Finalize two seconds after the user's voice falls quiet. Chariot then
        // emits transcript.done, which the interview uses as the submitted answer.
        if (session.speechDetected && !session.finalizing && now - session.lastSpeechAt >= silenceDurationMs) {
          stop();
        }
      };
      session.source = source;
      session.processor = processor;
      session.gain = gain;
      source.connect(processor);
      processor.connect(gain);
      gain.connect(context.destination);
      session.hadStarted = true;
      setStatus("listening");
    } catch (connectionError) {
      if (generationRef.current !== attempt) {
        closeCapture(session, true);
        if (sessionRef.current === session) sessionRef.current = null;
        return;
      }
      session.finished = true;
      closeCapture(session, true);
      if (sessionRef.current === session) sessionRef.current = null;
      setStatus("error");
      setError(messages.failed);
    }
  }, [stop]);

  const clear = useCallback(() => {
    setTranscript("");
    setError("");
  }, []);

  useEffect(() => () => {
    generationRef.current += 1;
    closeCapture(sessionRef.current, true);
  }, []);

  return { status, transcript, setTranscript, error, start, stop, clear };
}
