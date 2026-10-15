"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRoomAction, renameRoomAction, type RoomFormState } from "@/lib/actions/rooms";
import type { StudyRoom } from "@/lib/rooms";
import { RoomColorPicker } from "./room-color-picker";
import { RoomCompanionSettings } from "@/components/companion/companion";
import { gaugeLabel, readGauge, writeGauge } from "@/lib/accuracy-bar";

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
  useEffect(() => { setGauge(readGauge(room.id)); }, [room.id]);

  return (
    <section className="roomSettings" data-state={closing ? "closing" : "open"} role="dialog" aria-modal="true" aria-labelledby="room-settings-title">
      <div className="roomSettingsHead">
        <div><span className="tinyLabel">ROOM SETTINGS</span><strong id="room-settings-title">Study Room</strong></div>
        <button type="button" onClick={onClose}>Done</button>
      </div>
      <form className="settingsForm" action={formAction}>
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
