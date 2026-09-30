"use client";

import { StudigoMascot } from "@/components/studigo-mascot";

export function StudigoComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  maxLength,
  className = "",
  ariaLabel = "Ask Studigo",
  variant = "default",
  placeholder = "Ask Studigo",
  asking = false,
  onToggleAsk
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  ariaLabel?: string;
  /** "chat" is the docked messenger-style bar used inside the Coach window. */
  variant?: "default" | "chat";
  placeholder?: string;
  /** Chat variant only: a one-shot "question from my materials" switch. */
  asking?: boolean;
  onToggleAsk?: () => void;
}) {
  const canSend = !disabled && Boolean(value.trim());

  if (variant === "chat") {
    return (
      <form
        className={`chatComposer ${className}`.trim()}
        data-asking={asking ? "true" : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
      >
        {asking && <span className="chatAskHint" role="status">Question · answered only from your materials</span>}
        <div className="chatRow">
        {onToggleAsk && (
          <button
            className="chatAsk"
            type="button"
            aria-pressed={asking}
            aria-label="Ask a question from my materials"
            title="Ask a question from my materials"
            onClick={onToggleAsk}
            disabled={disabled}
          >
            ?
          </button>
        )}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          maxLength={maxLength}
          disabled={disabled}
          enterKeyHint="send"
          autoComplete="off"
        />
        <button className="chatSend" type="submit" aria-label="Send to Studigo" disabled={!canSend}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className={`studigoComposer askComposerLive ${className}`.trim()}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        maxLength={maxLength}
        disabled={disabled}
      />
      <button
        className="studigoComposerAction"
        type="submit"
        aria-label="Send to Studigo"
        disabled={!canSend}
      >
        <StudigoMascot state={disabled ? "thinking" : "welcome"} size={30} mark />
      </button>
    </form>
  );
}
