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
  accent
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
  /** Chat variant only: "learn" tints the bar teal so the mode is visible at the input. */
  accent?: "learn";
}) {
  const canSend = !disabled && Boolean(value.trim());

  if (variant === "chat") {
    return (
      <form
        className={`chatComposer ${className}`.trim()}
        data-accent={accent}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
      >
        <div className="chatRow">
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
