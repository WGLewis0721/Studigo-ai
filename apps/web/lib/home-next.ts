import type { RoomReadiness } from "./rooms";
import type { WeakArea } from "./study-planning";

/**
 * What Home says is next. Everything here is derived from the room's real
 * state (its test date, its topics, its practice history). When there is
 * nothing to derive, it says so instead of inventing a number.
 */

const DAY = 86_400_000;

export type FocusRoom = { id: string; title: string; test_date: string | null; updated_at: string };

/** Whole days until the test, counted in the viewer's calendar days. Null when there is no date. */
export function daysUntil(testDate: string | null, now: number): number | null {
  if (!testDate) return null;
  const at = Date.parse(testDate);
  if (Number.isNaN(at)) return null;
  return Math.ceil((at - now) / DAY);
}

/** The room to lead with: the nearest test that has not passed, else the room touched most recently. */
export function pickFocusRoom<T extends FocusRoom>(rooms: T[], now: number): T | null {
  if (!rooms.length) return null;
  const upcoming = rooms
    .map((room) => ({ room, days: daysUntil(room.test_date, now) }))
    .filter((item): item is { room: T; days: number } => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days || b.room.updated_at.localeCompare(a.room.updated_at));
  if (upcoming.length) return upcoming[0].room;
  return [...rooms].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

export type HomeNext = {
  roomId: string;
  title: string;
  /** Studigo's one line about the test date. */
  line: string;
  /** The heading of the next-up card. */
  heading: string;
  note: string;
  /** A plain count of what has been practiced; null when the room has no topics yet. */
  progress: string | null;
  /** Where "Continue" lands in the room. */
  mode: "learn" | "quiz" | "cards" | "materials";
};

export function testLine(days: number | null): string {
  if (days === null) return "No test date yet. Add one in Room Settings when you know it.";
  if (days < 0) return "That test date has passed. Set the next one in Room Settings.";
  if (days === 0) return "Your test is today.";
  if (days === 1) return "Your test is tomorrow.";
  return `Your test is in ${days} days.`;
}

export function progressLine(readiness: Pick<RoomReadiness, "topicCount" | "practicedTopicCount" | "masteredCount">): string | null {
  if (!readiness.topicCount) return null;
  const strong = readiness.masteredCount ? `, ${readiness.masteredCount} strong` : "";
  return `${readiness.practicedTopicCount} of ${readiness.topicCount} topics practiced${strong}`;
}

export function buildHomeNext(
  room: FocusRoom,
  areas: WeakArea[],
  readiness: Pick<RoomReadiness, "topicCount" | "practicedTopicCount" | "masteredCount">,
  now: number
): HomeNext {
  const base = { roomId: room.id, title: room.title, line: testLine(daysUntil(room.test_date, now)), progress: progressLine(readiness) };
  if (!readiness.topicCount) {
    return { ...base, heading: "Add your study guide", note: "Studigo teaches only from what you add. Topics appear once it has read the guide.", mode: "materials" };
  }
  const first = areas[0];
  if (!first) {
    return { ...base, heading: "Everything here is strong", note: "Nothing is slipping right now. A quiz keeps it that way.", mode: "quiz" };
  }
  return { ...base, heading: first.topic.title, note: first.reasons[0] ?? `${first.label}. Practice it next.`, mode: first.recommendation };
}
