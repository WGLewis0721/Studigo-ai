"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRoomAction, renameRoomAction, type RoomFormState } from "@/lib/actions/rooms";
import type { StudyRoom } from "@/lib/rooms";
import { RoomColorPicker } from "./room-color-picker";
import { RoomCompanionSettings } from "@/components/companion/companion";
import { readAccuracySetting, writeAccuracySetting, type AccuracySetting } from "@/lib/accuracy-bar";

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
  const [accuracy, setAccuracy] = useState<AccuracySetting>("low");
  useEffect(() => { setAccuracy(readAccuracySetting(room.id) ?? "low"); }, [room.id]);

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
          <label className="field">
            <span>How much of the guide an answer must cover <small>(this Study Room)</small></span>
            <input
              name="accuracy"
              type="range"
              min={0}
              max={1}
              step={1}
              value={accuracy === "high" ? 1 : 0}
              aria-valuetext={accuracy === "high" ? "High, about 80 to 95 percent" : "Low, about half is enough"}
              onChange={(event) => {
                const next: AccuracySetting = event.target.value === "1" ? "high" : "low";
                setAccuracy(next);
                writeAccuracySetting(room.id, next);
              }}
            />
            <small>{accuracy === "high" ? "High: about 80–95% of the expected points. Wording does not have to match." : "Low: about half the expected points is enough. A first pass uses this unless you move the slider."}</small>
          </label>
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
