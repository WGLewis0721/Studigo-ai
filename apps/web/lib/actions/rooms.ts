"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RoomFormState = { error?: string };

function readTitle(formData: FormData) {
  return String(formData.get("title") || "").trim().slice(0, 160);
}

function optional(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value ? value.slice(0, 160) : null;
}

export async function createRoomAction(
  _previous: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const user = await requireUser();
  const title = readTitle(formData);
  if (!title) return { error: "Give the room a name, like “Biology Midterm”." };

  const testDate = String(formData.get("testDate") || "").trim();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_rooms")
    .insert({
      owner_id: user.id,
      title,
      subject: optional(formData, "subject"),
      course_name: optional(formData, "courseName"),
      test_date: testDate ? new Date(`${testDate}T00:00:00Z`).toISOString() : null
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/app");
  redirect(`/app/rooms/${data.id}`);
}

export async function renameRoomAction(
  _previous: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  await requireUser();
  const roomId = String(formData.get("roomId") || "");
  const title = readTitle(formData);
  if (!roomId) return { error: "Missing room." };
  if (!title) return { error: "A Study Room needs a name." };

  const testDate = String(formData.get("testDate") || "").trim();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("study_rooms")
    .update({
      title,
      subject: optional(formData, "subject"),
      course_name: optional(formData, "courseName"),
      test_date: testDate ? new Date(`${testDate}T00:00:00Z`).toISOString() : null
    })
    .eq("id", roomId);

  if (error) return { error: error.message };

  revalidatePath("/app");
  revalidatePath(`/app/rooms/${roomId}`);
  return {};
}

export async function deleteRoomAction(formData: FormData) {
  const user = await requireUser();
  const roomId = String(formData.get("roomId") || "");
  if (!roomId) return;

  const supabase = await createServerSupabaseClient();

  // Remove the stored originals first; the database cascade handles the rows,
  // but storage objects have no foreign key to cascade from.
  const { data: documents } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("room_id", roomId);

  const paths = (documents ?? []).map((document) => document.storage_path as string);
  if (paths.length) {
    await supabase.storage.from("study-materials").remove(paths);
  }

  await supabase.from("study_rooms").delete().eq("id", roomId).eq("owner_id", user.id);

  revalidatePath("/app");
  redirect("/app");
}
