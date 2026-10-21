"use client";

import { ASSESSMENT_LABELS, ASSESSMENT_MODES, type AssessmentMode } from "@/lib/practice-assessment";

/** Native checkboxes let learners select one format or combine several. */
export function AssessmentModePicker({ value, onChange, disabled = false }: {
  value: AssessmentMode[];
  onChange: (value: AssessmentMode[]) => void;
  disabled?: boolean;
}) {
  function toggle(mode: AssessmentMode, checked: boolean) {
    onChange(checked ? ASSESSMENT_MODES.filter((item) => item === mode || value.includes(item))
      : value.filter((item) => item !== mode));
  }
  return <fieldset className="assessmentModePicker" disabled={disabled}>
    <legend>Question types</legend>
    <p>Choose one or more ways to practice.</p>
    <div className="assessmentModeOptions">
      {ASSESSMENT_MODES.map((mode) => <label key={mode} className={value.includes(mode) ? "assessmentModeSelected" : ""}>
        <input type="checkbox" checked={value.includes(mode)} onChange={(event) => toggle(mode, event.target.checked)} />
        <span>{ASSESSMENT_LABELS[mode]}</span>
      </label>)}
    </div>
    {value.length === 0 && <p className="formError" role="alert">Choose at least one question type to continue.</p>}
  </fieldset>;
}
