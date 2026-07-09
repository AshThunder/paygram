import { useCallback, useState } from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  quickActions: readonly string[];
  onQuickAction: (action: string) => void;
  disabled?: boolean;
  groupHint?: string | null;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  quickActions,
  onQuickAction,
  disabled,
  groupHint,
}: Props) {
  const [listening, setListening] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
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
  }, [onChange]);

  return (
    <div className="border-t border-surface-border bg-surface-dark px-4 py-3 pb-safe">
      {groupHint && (
        <p className="text-xs text-brand-muted mb-2 px-1">{groupHint}</p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {quickActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onQuickAction(action)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-brand-muted bg-brand/10 border border-brand/20 rounded-full hover:bg-brand/20 transition-colors"
          >
            {action}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={startVoice}
          disabled={disabled || listening}
          className="h-11 w-11 shrink-0 border border-surface-border rounded-xl text-lg disabled:opacity-40"
          title="Voice input"
        >
          {listening ? '…' : '🎤'}
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a payment…"
          disabled={disabled}
          className="flex-1 h-11 px-4 bg-surface-card border border-surface-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="h-11 px-5 bg-brand hover:bg-brand-light disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Send
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
