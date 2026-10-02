"use server";

import { drainStorageCleanup } from "@/lib/storage-cleanup";
import { parseTestDate } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { serverLocalSession } from '../local-beta-context';
import { createLocalRoom,updateLocalRoom,deleteLocalRoom } from '../local-beta-room-actions';

export type RoomFormState = { error?: string; appliedAt?: number };

function readTitle(formData: FormData) {
  return String(formData.get("title") || "").trim().slice(0, 160);
}

const EXPLAIN_LEVELS = new Set(["simpler", "standard", "deeper"]);

/** Pitch of the explanations, not their content. Unknown values fall back. */
function readExplainLevel(formData: FormData) {
  const value = String(formData.get("explainLevel") || "standard");
  return EXPLAIN_LEVELS.has(value) ? value : "standard";
}

function optional(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value ? value.slice(0, 160) : null;
}

async function insertRoom(formData: FormData): Promise<{ roomId: string } | { error: string }> {
  const local=await serverLocalSession();
  if(local){try{const roomId=createLocalRoom(local,readTitle(formData));revalidatePath('/app');return {roomId};}catch{return {error:'Could not create room. Use a short title.'};}}
  const user = await requireUser();
  const title = readTitle(formData);
  if (!title) return { error: "Give the room a name, like “Biology Midterm”." };

  let testDate: string | null;
  try { testDate = parseTestDate(formData.get("testDate")); }
  catch { return { error: "Choose a valid test date." }; }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_rooms")
    .insert({
      owner_id: user.id,
      title,
      subject: optional(formData, "subject"),
      course_name: optional(formData, "courseName"),
      test_date: testDate
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/app");
  return { roomId: data.id as string };
}

export async function createRoomAction(
  _previous: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const created = await insertRoom(formData);
  if ("error" in created) return { error: created.error };
  redirect(`/app/rooms/${created.roomId}`);
}

/**
 * First-run setup creates the room and then finishes in the browser (the room's
 * color is saved there, and Studigo leaps in), so it returns the id instead of
 * redirecting.
 */
export async function createFirstRoomAction(formData: FormData): Promise<{ roomId?: string; error?: string }> {
  return insertRoom(formData);
}

export async function renameRoomAction(
  _previous: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const local=await serverLocalSession();
  if(local){try{const id=String(formData.get('roomId')??'');updateLocalRoom(local,{id,title:readTitle(formData),subject:optional(formData,'subject'),courseName:optional(formData,'courseName'),testDate:parseTestDate(formData.get('testDate')),level:readExplainLevel(formData)});revalidatePath('/app');revalidatePath('/app/rooms/'+id);return {appliedAt:Date.now()};}catch{return {error:'Could not apply room settings.'};}}
  const user = await requireUser();
  const roomId = String(formData.get("roomId") || "");
  const title = readTitle(formData);
  if (!roomId) return { error: "Missing room." };
  if (!title) return { error: "A Study Room needs a name." };

  let testDate: string | null;
  try { testDate = parseTestDate(formData.get("testDate")); }
  catch { return { error: "Choose a valid test date." }; }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_rooms")
    .update({
      title,
      subject: optional(formData, "subject"),
      course_name: optional(formData, "courseName"),
      test_date: testDate,
      explain_level: readExplainLevel(formData)
    })
    .eq("id", roomId).eq("owner_id", user.id).select("id").maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Study Room not found. Your changes were not applied." };

  revalidatePath("/app");
  revalidatePath(`/app/rooms/${roomId}`);
  return { appliedAt: Date.now() };
}

export async function deleteRoomAction(formData: FormData) {
  const local=await serverLocalSession();
  if(local){deleteLocalRoom(local,String(formData.get('roomId')??''));revalidatePath('/app');redirect('/app');}
  const user = await requireUser();
  const roomId = String(formData.get("roomId") || "");
  if (!roomId) return;

  const supabase = await createServerSupabaseClient();

  // The database trigger records every storage path atomically with the cascade.
  const { error } = await supabase.from("study_rooms").delete().eq("id", roomId).eq("owner_id", user.id);
  if (error) throw new Error("The room could not be deleted. Please retry.");
  await drainStorageCleanup(user.id).catch(() => { /* durable outbox remains */ });

  revalidatePath("/app");
  redirect("/app");
}
