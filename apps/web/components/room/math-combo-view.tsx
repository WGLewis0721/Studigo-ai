"use client";

import { useState } from "react";
import type { ComboPicture, MathCombo } from "@/lib/math-combo";
import "./math-combo.css";

/** Plays a math combo one move at a time. The picture shows the same moves. */
export function MathComboView({ combo }: { combo: MathCombo }) {
  const flat = combo.columns.flatMap((column, columnIndex) => column.steps.map((_, stepIndex) => ({ columnIndex, stepIndex })));
  const last = Math.max(0, flat.length - 1);
  const stop = combo.hideLast ? Math.max(0, last - 1) : last;
  const [lit, setLit] = useState(0);
  const shown = Math.min(lit, stop);

  return (
    <div className="mathCombo">
      {combo.picture ? <ComboPicture picture={combo.picture} /> : null}
      <div className={combo.columns.length > 1 ? "mathComboCols" : "mathComboCols one"}>
        {combo.columns.map((column, columnIndex) => (
          <ol key={column.title} className="mathComboCol">
            <li className="mathComboTitle">{column.title}</li>
            {column.steps.map((step, stepIndex) => {
              const order = flat.findIndex((item) => item.columnIndex === columnIndex && item.stepIndex === stepIndex);
              const on = order <= shown;
              const hidden = combo.hideLast && order === last;
              return (
                <li key={step.move} className={on ? "mathComboStep on" : "mathComboStep"} aria-current={order === shown ? "step" : undefined}>
                  <span>{step.move}</span>
                  <strong>{hidden ? "—" : step.result}</strong>
                  <em>{on && !hidden ? step.note : ""}</em>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
      {shown < stop ? (
        <button type="button" className="mathComboNext" onClick={() => setLit(shown + 1)}>Next move</button>
      ) : null}
    </div>
  );
}

function ComboPicture({ picture }: { picture: ComboPicture }) {
  if (picture.kind === "fraction-bar") {
    return (
      <svg className="mathComboPic" viewBox="0 0 320 132" aria-hidden="true">
        {picture.bars.map((bar, index) => (
          <FractionBar key={bar.label} y={8 + index * 42} label={bar.label} filled={bar.filled} parts={bar.parts} />
        ))}
      </svg>
    );
  }
  if (picture.kind === "number-line") {
    const end = picture.jumps.reduce((sum, jump) => sum + jump, picture.from);
    const span = 280;
    const xAt = (value: number) => 20 + (end === 0 ? span / 2 : (value / end) * span);
    let cursor = picture.from;
    const jumps = picture.jumps.map((jump) => {
      const from = cursor;
      cursor += jump;
      return { from, to: cursor };
    });
    return (
      <svg className="mathComboPic" viewBox="0 0 320 72" aria-hidden="true">
        <line x1="20" x2="300" y1="36" y2="36" stroke="currentColor" strokeWidth="1.5" />
        {end <= 20 ? Array.from({ length: end + 1 }, (_, value) => (
          <g key={value}>
            <line x1={xAt(value)} x2={xAt(value)} y1="28" y2="44" stroke="currentColor" />
            <text x={xAt(value)} y="60" textAnchor="middle" fontSize="11" fill="currentColor">{value}</text>
          </g>
        )) : null}
        {jumps.map((jump) => (
          <path key={`${jump.from}-${jump.to}`} d={`M ${xAt(jump.from)} 28 Q ${(xAt(jump.from) + xAt(jump.to)) / 2} 8 ${xAt(jump.to)} 28`} fill="none" stroke="var(--tone, #3c7cff)" strokeWidth="1.5" />
        ))}
      </svg>
    );
  }
  return (
    <table className="mathComboPlace">
      <thead>
        <tr>{picture.places.map((place) => <th key={place}>{place}</th>)}</tr>
      </thead>
      <tbody>
        <tr>{picture.start.map((cell, index) => <td key={index}>{cell}</td>)}</tr>
        {picture.regrouped ? <tr>{picture.regrouped.map((cell, index) => <td key={index}>{cell}</td>)}</tr> : null}
      </tbody>
    </table>
  );
}

function FractionBar({ y, label, filled, parts }: { y: number; label: string; filled: number; parts: number }) {
  const x = 64;
  const width = 220;
  const height = 26;
  const part = width / Math.max(parts, 1);
  const shown = Math.max(0, Math.min(parts, filled));
  return (
    <g>
      <text x="56" y={y + 18} textAnchor="end" fontSize="12" fill="currentColor">{label}</text>
      <rect x={x} y={y} width={width} height={height} fill="var(--snow-2, #eef1f6)" stroke="currentColor" />
      {shown > 0 ? <rect x={x} y={y} width={part * shown} height={height} fill="var(--tone, #3c7cff)" /> : null}
      {Array.from({ length: Math.max(parts - 1, 0) }, (_, index) => (
        <line key={index} x1={x + part * (index + 1)} x2={x + part * (index + 1)} y1={y} y2={y + height} stroke="currentColor" />
      ))}
    </g>
  );
}
