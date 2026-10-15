import type { ReactNode } from "react";
import { ModeGlyph } from "@/components/mode-glyph";
import { ActionGlyph } from "./action-glyph";

export function Phase3Key({ children, tone = "teal", variant = "solid", icon, disabled, onClick, type = "button", className = "" }: {
  children: ReactNode; tone?: "teal" | "tangerine" | "blueberry" | "dandelion" | "ink";
  variant?: "solid" | "quiet"; icon?: ReactNode; disabled?: boolean;
  onClick?: () => void; type?: "button" | "submit"; className?: string;
}) {
  return <button className={`p3Key p3Key--${tone} p3Key--${variant} ${className}`} type={type} disabled={disabled} onClick={onClick}>{icon}<span>{children}</span></button>;
}

export function ModeSwitch({ active, onChange }: { active: "learn" | "coach" | "practice"; onChange: (mode: "learn" | "coach" | "practice") => void }) {
  const modes = [
    { id: "learn", label: "Learn", glyph: "learn" },
    { id: "coach", label: "Coach", glyph: "coach" },
    { id: "practice", label: "Practice", glyph: "quiz" }
  ] as const;
  return <div className="p3Modes" role="group" aria-label="Learning mode">{modes.map(mode => <button key={mode.id} type="button" className="p3Modes__item" data-active={active === mode.id} onClick={() => onChange(mode.id)} aria-pressed={active === mode.id}><ModeGlyph name={mode.glyph} size={20}/><span>{mode.label}</span></button>)}</div>;
}

export function ObjectiveRail({ current }: { current: number }) {
  const steps = ["Brief", "Show", "Try", "Check"];
  return <ol className="p3Rail" aria-label="Lesson position">{steps.map((step, index) => <li key={step} data-state={index < current ? "complete" : index === current ? "current" : "upcoming"} aria-current={index === current ? "step" : undefined}><span className="p3Rail__dot" aria-hidden="true">{index < current ? "✓" : String(index + 1)}</span><span>{step}</span></li>)}</ol>;
}

export function EvidenceTicket({ title, page, onClick, eyebrow = "FROM YOUR MATERIAL" }: { title: string; page: string; onClick: () => void; eyebrow?: string }) {
  return <button type="button" className="p3Ticket" onClick={onClick} aria-label={`Find it in ${title}, ${page}`}><span className="p3Ticket__glyph"><ActionGlyph name="find" size={25}/></span><span className="p3Ticket__text"><small>{eyebrow}</small><strong>{title}</strong><span>{page} · Find it</span></span><span className="p3Ticket__arrow" aria-hidden="true">↗</span></button>;
}

export function ChoiceKeys({ choices, selected, onSelect }: { choices: readonly string[]; selected: number | null; onSelect: (index: number) => void }) {
  return <div className="p3Choices" role="radiogroup" aria-label="Choose one answer">{choices.map((choice, index) => <button key={choice} type="button" className="p3Choice" role="radio" aria-checked={selected === index} tabIndex={selected === index || (selected === null && index === 0) ? 0 : -1} onClick={() => onSelect(index)} onKeyDown={event => { if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return; event.preventDefault(); const next = (index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + choices.length) % choices.length; onSelect(next); (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus(); }}><span className="p3Choice__radio" aria-hidden="true"/><span>{choice}</span></button>)}</div>;
}

export function SourceSpotlight({ title, page, passage, note, onClose }: { title: string; page: string; passage: string; note: string; onClose: () => void }) {
  return <div className="p3SourceBackdrop" onClick={onClose}><aside className="p3Source" role="dialog" aria-modal="true" aria-label="Source passage" onClick={event => event.stopPropagation()}><div className="p3Source__header"><span className="p3Eyebrow">SOURCE SPOTLIGHT</span><button className="p3IconButton" type="button" onClick={onClose} aria-label="Close source passage">×</button></div><div className="p3Source__paper"><span className="p3Source__page">{page}</span><h2>{title}</h2><p className="p3Source__passage">{passage}</p></div><p className="p3Source__note">{note}</p><Phase3Key variant="quiet" onClick={onClose}>Back to lesson</Phase3Key></aside></div>;
}

export function EvidenceRecovery({ state, onRetry, onOriginal }: { state: "missing" | "partial" | "stale"; onRetry?: () => void; onOriginal?: () => void }) {
  const copy = {
    missing: { title: "We can’t show that passage yet.", body: "This material has no verified source passage. You can keep learning, or choose a different material.", action: "Choose material" },
    partial: { title: "We found only part of the passage.", body: "The source text may be incomplete. Open the original before relying on this explanation.", action: "Open original" },
    stale: { title: "This source has changed.", body: "The passage is no longer linked to the current material. Refresh the evidence before using it.", action: "Refresh source" }
  }[state];
  const action = state === "partial" ? onOriginal : onRetry;
  return <div className="p3Recovery" role="status" data-state={state}><span className="p3Recovery__icon" aria-hidden="true"><ActionGlyph name={state === "partial" ? "original" : "source"} size={24}/></span><div><span className="p3Eyebrow">SOURCE {state.toUpperCase()}</span><h3>{copy.title}</h3><p>{copy.body}</p><Phase3Key variant="quiet" onClick={action} disabled={!action}>{copy.action}</Phase3Key></div></div>;
}
