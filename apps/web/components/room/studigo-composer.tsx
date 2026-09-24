"use client";

import { StudigoMascot } from "@/components/studigo-mascot";

export function StudigoComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  maxLength,
  className = "",
  ariaLabel = "Ask Studigo"
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const canSend = !disabled && Boolean(value.trim());

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
        placeholder="Ask Studigo"
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
