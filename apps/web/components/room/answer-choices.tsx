"use client";

import { useId } from "react";

/** Native radios share one tactile key across Quiz and full tests. No grading here. */
export function AnswerChoices({ choices, selected, onSelect, disabled, result, binary = false }: {
  choices: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  result?: { correctChoice: number | null } | null;
  binary?: boolean;
}) {
  const name = useId();
  return <fieldset className={`choiceList answerChoices ${binary ? "choiceListBinary" : ""}`} disabled={disabled}>
    <legend className="srOnly">Answer choices. Choose one answer.</legend>
    {choices.map((choice, index) => {
      const state = result
        ? index === result.correctChoice ? "choiceCorrect" : index === selected ? "choiceWrong" : ""
        : index === selected ? "choiceSelected" : "";
      return <label key={index} className={`choiceItem ${state}`}>
        <input className="srOnly" type="radio" name={name} checked={selected === index} onChange={() => onSelect(index)} />
        <i aria-hidden="true">{binary ? index === 0 ? "T" : "F" : String.fromCharCode(65 + index)}</i>
        <span>{choice}</span>
        {result && index === result.correctChoice && <b className="choiceVerdict">✓ Correct answer{index === selected ? " · Your answer" : ""}</b>}
        {result && index === selected && index !== result.correctChoice && <b className="choiceVerdict">✕ Your answer</b>}
        {!result && selected === index && <b className="choiceVerdict">Selected</b>}
      </label>;
    })}
  </fieldset>;
}
