"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRoomAction, renameRoomAction, type RoomFormState } from "@/lib/actions/rooms";
import type { StudyRoom } from "@/lib/rooms";
import { RoomColorPicker } from "./room-color-picker";
import { RoomCompanionSettings } from "@/components/companion/companion";
import { gaugeLabel, readGauge, writeGauge } from "@/lib/accuracy-bar";
import "./phase3-rooms.css";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="buttonPrimary" type="submit" disabled={pending}>
      {pending ? "Applying…" : "Apply"}
    </button>
  );
}

export function RoomSettings({ room, onClose, closing = false }: { room: StudyRoom; onClose: () => void; closing?: boolean }) {
  const [state, formAction] = useActionState<RoomFormState, FormData>(renameRoomAction, {});
  const [gauge, setGauge] = useState(50);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => { setGauge(readGauge(room.id)); }, [room.id]);
  useEffect(() => {
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    )).filter((element) => element.getClientRects().length > 0);
    // Desktop hides the phone's Done button; focus the first visible control.
    (controls()[0] ?? dialog).focus({ preventScroll: true });
    function containFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { event.preventDefault(); dialog?.focus(); return; }
      if (!dialog?.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      if (invoker?.isConnected) invoker.focus({ preventScroll: true });
    };
  }, []);

  return (
    <section ref={dialogRef} tabIndex={-1} className="roomSettings" data-state={closing ? "closing" : "open"} role="dialog" aria-modal="true" aria-labelledby="room-settings-title">
      <div className="roomSettingsHead">
        <div><span className="tinyLabel">YOUR LEARNING SPACE / CONTROLS</span><strong id="room-settings-title">Study Room settings</strong></div>
        <button type="button" onClick={onClose}>Done</button>
      </div>
      <form className="settingsForm" action={formAction}>
        <p className="roomSettingsIntro">Set up this room your way. Apply saves the room details and explanation level; answer temperature and companion preferences use their own controls.</p>
        <input type="hidden" name="roomId" value={room.id} />
        <div className="settingsFields">
          <label className="field">
            <span>Room name</span>
            <input name="title" defaultValue={room.title} required maxLength={160} />
          </label>
          <label className="field">
            <span>Subject</span>
            <input name="subject" defaultValue={room.subject ?? ""} maxLength={160} />
          </label>
          <label className="field">
            <span>Class or teacher</span>
            <input name="courseName" defaultValue={room.course_name ?? ""} maxLength={160} />
          </label>
          <label className="field">
            <span>Explanation level <small>(Coach and Learn, whole Study Room)</small></span>
            <select name="explainLevel" defaultValue={room.explain_level}>
              <option value="simpler">Simpler: plain words, more everyday examples</option>
              <option value="standard">Standard: the level of the material</option>
              <option value="deeper">Deeper: more precise, assumes the basics</option>
            </select>
          </label>
          <div className="accuracyGauge">
            <span>Answer temperature <small>(this Study Room)</small></span>
            <div className="accuracyGaugeEnds"><span>Cold · 50%</span><strong>{gaugeLabel(gauge)}</strong><span>Hot · 100%</span></div>
            <input
              name="gauge"
              aria-label="Answer temperature for this Study Room"
              type="range"
              min={50}
              max={100}
              step={1}
              value={gauge}
              aria-valuemin={50}
              aria-valuemax={100}
              aria-valuenow={gauge}
              aria-valuetext={gaugeLabel(gauge)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setGauge(next);
                writeGauge(room.id, next);
              }}
            />
            <small>
              {gauge >= 90
                ? "Hot: the answer has to cover about 90–100% of the idea. Coach rejects an incomplete answer and corrects the whole thing. The words do not have to match."
                : `Cold to warm: about ${gauge}% of the idea is enough. Coach accepts the part you got and fills in the rest. The words do not have to match.`}
            </small>
          </div>
          <label className="field">
            <span>Test date</span>
            <input
              name="testDate"
              type="date"
              defaultValue={room.test_date ? room.test_date.slice(0, 10) : ""}
            />
          </label>
        </div>

        <RoomColorPicker roomId={room.id} />
        <RoomCompanionSettings roomId={room.id} />

        {state.error && (
          <p className="formError" role="alert">
            {state.error}
          </p>
        )}
        {state.appliedAt && <p role="status">Applied. Coach and Learn will use this explanation level from the next reply.</p>}

        <div className="settingsActions">
          <SaveButton />
          <button className="ghostButton" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </form>

      <form
        className="dangerZone"
        action={deleteRoomAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Delete “${room.title}”? Its documents, chunks, quizzes, and mastery go with it.`
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="roomId" value={room.id} />
        <div>
          <strong>Delete this Study Room</strong>
          <small>Removes the originals and everything Studigo learned from them.</small>
        </div>
        <button className="danger" type="submit">
          Delete room
        </button>
      </form>
    </section>
  );
}
