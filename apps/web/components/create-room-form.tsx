"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createRoomAction, type RoomFormState } from "@/lib/actions/rooms";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="buttonPrimary" type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create room"} <span aria-hidden="true">→</span>
    </button>
  );
}

export function CreateRoomForm() {
  const [state, formAction] = useActionState<RoomFormState, FormData>(createRoomAction, {});

  return (
    <aside className="createRoomPanel">
      <span className="tinyLabel">NEW STUDY ROOM</span>
      <h2>Start with what's next.</h2>
      <form className="stackedForm" action={formAction}>
        <label className="field">
          <span>Room name</span>
          <input name="title" required maxLength={160} placeholder="Biology Midterm" />
        </label>
        <div className="fieldRow">
          <label className="field">
            <span>Subject</span>
            <input name="subject" maxLength={160} placeholder="Science" />
          </label>
          <label className="field">
            <span>Test date</span>
            <input name="testDate" type="date" />
          </label>
        </div>
        <label className="field">
          <span>Class or teacher</span>
          <input name="courseName" maxLength={160} placeholder="Period 3 · Ms. Alvarez" />
        </label>

        {state.error && (
          <p className="formError" role="alert">
            {state.error}
          </p>
        )}
        <Submit />
      </form>
    </aside>
  );
}
