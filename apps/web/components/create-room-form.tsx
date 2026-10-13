"use client";

import "./app-home.css";
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

function Optional() {
  return <small className="optionalTag">(optional)</small>;
}

export function CreateRoomForm() {
  const [state, formAction] = useActionState<RoomFormState, FormData>(createRoomAction, {});

  return (
    <aside className="createRoomPanel">
      <span className="tinyLabel">NEW STUDY ROOM</span>
      <h2>Start with what's next.</h2>
      <form className="stackedForm" action={formAction}>
        <label className="field">
          <span>Room name <Optional /></span>
          <input name="title" maxLength={160} placeholder="Biology Midterm" />
        </label>
        <div className="fieldRow">
          <label className="field">
            <span>Subject <Optional /></span>
            <input name="subject" maxLength={160} placeholder="Science" />
          </label>
          <label className="field">
            <span>Test date <Optional /></span>
            <input name="testDate" type="date" />
          </label>
        </div>
        <label className="field">
          <span>Class or teacher <Optional /></span>
          <input name="courseName" maxLength={160} placeholder="Period 3 · Ms. Alvarez" />
        </label>
        <p className="hintText">Skip the name and I&apos;ll name the room from your first study guide.</p>

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
