import { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/hooks/ToastProvider';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  groupHint?: string | null;
  compact?: boolean;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  groupHint,
  compact = false,
}: Props) {
  const [listening, setListening] = useState(false);
  const toast = useToast();
  const canSend = Boolean(value.trim()) && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Voice input is not available in Telegram yet — type your payment instead');
      return;
    }
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
      const text = event.results[0]?.[0]?.transcript;
      if (text) onChange(text.trim());
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }, [onChange, toast]);

  const sendButton = (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!canSend}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-md transition-all hover:opacity-95 active:scale-95 disabled:bg-surface-container-high disabled:text-outline disabled:shadow-none disabled:active:scale-100"
      aria-label="Send message"
    >
      <Icon name="arrow_upward" className="text-[24px]" filled />
    </button>
  );

  if (compact) {
    return (
      <div className="pointer-events-none fixed bottom-tab-bar left-0 right-0 z-30 mx-auto max-w-[390px] bg-surface-container-lowest px-container-padding pb-safe pt-2">
        {groupHint && (
          <p className="pointer-events-auto mb-2 rounded-xl border border-primary-fixed bg-primary-fixed/40 px-3 py-2 text-body-sm text-on-primary-fixed-variant">
            {groupHint}
          </p>
        )}
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-full border border-surface-container-highest bg-surface-container-lowest px-4 py-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              disabled={disabled}
              className="min-w-0 flex-1 border-none bg-transparent text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-0"
            />
          </div>
          {sendButton}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-tab-bar left-0 right-0 z-30 mx-auto w-full max-w-[390px] border-t border-surface-variant bg-background px-container-padding py-3 pb-safe">
      {groupHint && (
        <p className="pointer-events-auto mb-2 rounded-xl border border-primary-fixed bg-primary-fixed/40 px-3 py-2 text-body-sm text-on-primary-fixed-variant">
          {groupHint}
        </p>
      )}
      <div className="pointer-events-auto flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-outline-variant/50 bg-surface-container-lowest px-4 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or amount..."
            disabled={disabled}
            className="min-w-0 flex-1 border-none bg-transparent p-0 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
          />
        </div>
        {sendButton}
        <button
          type="button"
          onClick={startVoice}
          disabled={disabled || listening}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 disabled:opacity-40 ${
            listening ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
          }`}
          aria-label="Voice input"
        >
          <Icon name={listening ? 'more_horiz' : 'mic'} className="text-[22px]" />
        </button>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    };
    webkitSpeechRecognition?: Window['SpeechRecognition'];
  }
}
