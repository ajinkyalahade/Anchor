import { useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionLike;
    webkitSpeechRecognition: new () => SpeechRecognitionLike;
  }
}

export default function VoiceInput({ onTranscript, disabled, className = '' }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  if (!isSupported) return null;

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      onTranscript(e.results[0][0].transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
      className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
        listening
          ? 'bg-red-500/15 text-red-400 animate-pulse'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent-focus)] hover:bg-[color-mix(in_srgb,var(--color-accent-focus)_8%,transparent)]'
      } ${className}`}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
