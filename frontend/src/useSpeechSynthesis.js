import { useCallback, useEffect, useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useSpeechSynthesis(language) {
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState("");
  const contextRef = useRef(null);
  const controllerRef = useRef(null);
  const readerRef = useRef(null);
  const sourcesRef = useRef(new Set());
  const generationRef = useRef(0);

  const releaseAudio = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    for (const source of sourcesRef.current) {
      source.onended = null;
      try { source.stop(); } catch { /* The chunk may already have ended. */ }
      source.disconnect();
    }
    sourcesRef.current.clear();
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") context.close().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    releaseAudio();
    setSpeaking(false);
  }, [releaseAudio]);

  const speak = useCallback(async (value) => {
    const text = value?.trim();
    if (!text) return;

    stop();
    const generation = generationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setMessage("");
    setSpeaking(true);

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is unavailable in this browser.");
      const context = new AudioContextClass();
      contextRef.current = context;
      await context.resume();

      const response = await fetch(`${apiBase}/api/speech/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Speech generation failed.");
      if (!response.body) throw new Error("Streaming audio is unavailable in this browser.");
      if (generation !== generationRef.current) return;

      const reader = response.body.getReader();
      readerRef.current = reader;
      let nextStart = context.currentTime + 0.04;
      let pendingByte = null;
      let audioBytes = 0;
      let lastChunk = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (generation !== generationRef.current) return;

        let bytes = value;
        if (pendingByte) {
          const combined = new Uint8Array(bytes.length + 1);
          combined[0] = pendingByte[0];
          combined.set(bytes, 1);
          bytes = combined;
          pendingByte = null;
        }
        if (bytes.length % 2 === 1) {
          pendingByte = bytes.slice(-1);
          bytes = bytes.subarray(0, bytes.length - 1);
        }
        if (!bytes.length) continue;

        const samples = new Float32Array(bytes.length / 2);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let index = 0; index < samples.length; index += 1) {
          samples[index] = view.getInt16(index * 2, true) / 32768;
        }

        const buffer = context.createBuffer(1, samples.length, 44100);
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        const chunk = { source, ended: false, finish: null };
        source.onended = () => {
          chunk.ended = true;
          sourcesRef.current.delete(source);
          source.disconnect();
          chunk.finish?.();
        };
        const playAt = Math.max(context.currentTime + 0.015, nextStart);
        source.start(playAt);
        nextStart = playAt + buffer.duration;
        lastChunk = chunk;
        audioBytes += bytes.length;
        sourcesRef.current.add(source);
      }

      if (audioBytes === 0 || !lastChunk) throw new Error("Speech generation returned empty audio.");
      await new Promise((resolve) => {
        if (lastChunk.ended) resolve();
        else lastChunk.finish = resolve;
      });
      if (generation === generationRef.current) {
        releaseAudio();
        setSpeaking(false);
      }
    } catch (playbackError) {
      if (playbackError?.name === "AbortError" || generation !== generationRef.current) return;
      releaseAudio();
      setSpeaking(false);
      setMessage(language === "hi"
        ? "आवाज़ का जवाब उपलब्ध नहीं है। आप स्क्रीन पर लिखा जवाब पढ़ सकते हैं।"
        : language === "pa"
          ? "ਬੋਲੀ ਵਿੱਚ ਜਵਾਬ ਉਪਲਬਧ ਨਹੀਂ। ਸਕ੍ਰੀਨ ’ਤੇ ਲਿਖਿਆ ਜਵਾਬ ਪੜ੍ਹੋ।"
          : "Spoken output is unavailable. You can read the response on screen.");
    }
  }, [language, releaseAudio, stop]);

  useEffect(() => () => {
    generationRef.current += 1;
    releaseAudio();
  }, [releaseAudio]);

  return { speak, stop, speaking, message, supported: true };
}
