import { useCallback, useRef, useState } from 'react';

interface SpeechInputResult {
  listening: boolean;
  transcript: string;
  supported: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechInput(onResult?: (text: string) => void): SpeechInputResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;

  const supported = !!SpeechRecognition;

  const start = useCallback(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-HT'; // Closest to Haitian Creole
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      onResult?.(text);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [SpeechRecognition, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, transcript, supported, start, stop };
}
