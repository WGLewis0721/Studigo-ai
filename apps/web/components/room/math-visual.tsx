"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import type { FractionBar, MathVisual } from "@studigo/learning";

const BLANK_MARKER = "____";

export type MathPresentation = { visual: MathVisual; description: string };
export type MathSolutionStep = { text: string; visual?: MathVisual; description?: string };

function Fraction({ top, bottom, label }: { top: ReactNode; bottom: string; label: string }) {
  return (
    <span className="mathFrac" role="img" aria-label={label}>
      <span className="mathFracTop">{top}</span>
      <span className="mathFracBottom">{bottom}</span>
    </span>
  );
}

/**
 * Text with every a/b drawn as a stacked fraction. When `filled` is given, the
 * blank marker becomes the answer slot, including as the top of a fraction.
 */
export function MathText({ text, filled }: { text: string; filled?: string }) {
  const slot = <span className={`inlineBlank ${filled ? "inlineBlankFilled" : ""}`}>{filled || "?"}</span>;
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(/(\d+|\?|____)\/(\d+)|____/g)) {
    const at = match.index ?? 0;
    nodes.push(<Fragment key={`t${at}`}>{text.slice(last, at)}</Fragment>);
    if (match[2]) {
      const blank = match[1] === BLANK_MARKER;
      nodes.push(
        <Fraction
          key={`f${at}`}
          top={blank ? slot : match[1]}
          bottom={match[2]}
          label={`${blank ? filled || "blank" : match[1] === "?" ? "unknown" : match[1]} over ${match[2]}`}
        />
      );
    } else {
      nodes.push(<Fragment key={`b${at}`}>{slot}</Fragment>);
    }
    last = at + match[0].length;
  }
  nodes.push(<Fragment key="end">{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}

const BAR_WIDTH = 240;
const BAR_HEIGHT = 34;

/** Shaded parts carry a hatch as well as a darker fill, so the picture does not depend on colour. */
function Bar({ bar }: { bar: FractionBar }) {
  const hatch = useId();
  const width = BAR_WIDTH / bar.parts;
  return (
    <svg className="mathBar" viewBox={`0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
        </pattern>
      </defs>
      {Array.from({ length: bar.parts }, (_, index) => (
        <g key={index}>
          <rect x={index * width} y="0" width={width} height={BAR_HEIGHT} className={index < bar.shaded ? "mathPartShaded" : "mathPart"} />
          {index < bar.shaded && <rect x={index * width} y="0" width={width} height={BAR_HEIGHT} fill={`url(#${hatch})`} />}
        </g>
      ))}
      <rect x="0" y="0" width={BAR_WIDTH} height={BAR_HEIGHT} className="mathOutline" />
    </svg>
  );
}

const CELL = 24;
const GRID_LEFT = 52;
const GRID_TOP = 24;

function AreaGrid({ columns, rows, unit, description }: { columns: number; rows: number; unit: string; description: string }) {
  const width = columns * CELL;
  const height = rows * CELL;
  return (
    <svg className="mathGrid" viewBox={`0 0 ${GRID_LEFT + width + 4} ${GRID_TOP + height + 4}`} role="img" aria-label={description}>
      <text x={GRID_LEFT + width / 2} y="15" textAnchor="middle" className="mathGridLabel">{`${columns} ${unit}`}</text>
      <text x={GRID_LEFT - 8} y={GRID_TOP + height / 2 + 4} textAnchor="end" className="mathGridLabel">{`${rows} ${unit}`}</text>
      {Array.from({ length: rows * columns }, (_, index) => (
        <rect
          key={index}
          x={GRID_LEFT + (index % columns) * CELL}
          y={GRID_TOP + Math.floor(index / columns) * CELL}
          width={CELL}
          height={CELL}
          className="mathCell"
        />
      ))}
      <rect x={GRID_LEFT} y={GRID_TOP} width={width} height={height} className="mathOutline" />
    </svg>
  );
}

/** Draws a visual spec exactly as given. Every quantity comes from the spec; nothing is computed here. */
export function MathFigure({ visual, description }: MathPresentation) {
  if (visual.kind === "ratio_table") {
    return (
      <table className="mathTable">
        <caption className="srOnly">{description}</caption>
        <thead>
          <tr>
            {visual.headers.map((header) => (
              <th key={header} scope="col">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visual.rows.map(([first, second], index) => (
            <tr key={index}>
              <td>{first}</td>
              <td>{second === null ? <span className="inlineBlank">?</span> : second}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (visual.kind === "area_grid") {
    return (
      <figure className="mathFigure">
        <AreaGrid columns={visual.columns} rows={visual.rows} unit={visual.unit} description={description} />
      </figure>
    );
  }
  return (
    <figure className="mathFigure" role="img" aria-label={description}>
      {visual.bars.map((bar, index) => (
        <div className="mathBarRow" key={index}>
          <span className="mathOperator" aria-hidden="true">{index > 0 ? visual.operator : ""}</span>
          <Bar bar={bar} />
          <span className="mathBarLabel" aria-hidden="true">
            <MathText text={bar.label} />
          </span>
        </div>
      ))}
    </figure>
  );
}

/** The worked solution, one step at a time. Each press reveals the next step; nothing animates. */
export function MathSteps({ steps }: { steps: MathSolutionStep[] }) {
  const [shown, setShown] = useState(1);
  return (
    <div className="mathSteps">
      <ol aria-live="polite">
        {steps.slice(0, shown).map((step, index) => (
          <li key={index}>
            <p>
              <MathText text={step.text} />
            </p>
            {step.visual && <MathFigure visual={step.visual} description={step.description ?? ""} />}
          </li>
        ))}
      </ol>
      {shown < steps.length && (
        <button type="button" className="mathNextStep" onClick={() => setShown(shown + 1)}>
          Show the next step ({shown} of {steps.length})
        </button>
      )}
    </div>
  );
}
