"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRoomAction, renameRoomAction, type RoomFormState } from "@/lib/actions/rooms";
import type { StudyRoom } from "@/lib/rooms";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="buttonPrimary" type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function RoomSettings({ room, onClose }: { room: StudyRoom; onClose: () => void }) {
  const [state, formAction] = useActionState<RoomFormState, FormData>(renameRoomAction, {});

  return (
    <section className="roomSettings" role="dialog" aria-modal="true" aria-labelledby="room-settings-title">
      <div className="roomSettingsHead">
        <div><span className="tinyLabel">ROOM SETTINGS</span><strong id="room-settings-title">Study Room</strong></div>
        <button type="button" onClick={onClose}>Done</button>
      </div>
      <form className="settingsForm" action={formAction}>
        <input type="hidden" name="roomId" value={room.id} />
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
          <span>Explanation level</span>
          <select name="explainLevel" defaultValue={room.explain_level}>
            <option value="simpler">Simpler — plain words, more everyday examples</option>
            <option value="standard">Standard — the level of the material</option>
            <option value="deeper">Deeper — more precise, assumes the basics</option>
          </select>
        </label>
        <label className="field">
          <span>Test date</span>
          <input
            name="testDate"
            type="date"
            defaultValue={room.test_date ? room.test_date.slice(0, 10) : ""}
          />
        </label>

        {state.error && (
          <p className="formError" role="alert">
            {state.error}
          </p>
        )}

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
