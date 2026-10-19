"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Database } from "@/core/db/Database";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { LeadRepository } from "@/domains/resources/server/LeadRepository";
import { PhotoStorage } from "@/domains/team/server/PhotoStorage";

import { QuestionRepository } from "../server/QuestionRepository";
import { QuestionContract, QuestionValidationError } from "../services/QuestionContract";
import { QuestionTaxonomy } from "../services/QuestionTaxonomy";

export type QuestionActionState = { ok: boolean; message: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function questions(): QuestionRepository {
  const repo = QuestionRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** Every public page a question can appear on. Scheduled ones also roll over on the pages' 5-minute revalidate. */
function revalidatePublic(): void {
  revalidatePath("/cfa/questions", "layout");
  revalidatePath("/cfa/question-of-the-day");
  revalidatePath("/sitemap.xml");
}

/** Create (no id) or update. Topic and slug are locked once a question is live: its URL may already be on LinkedIn. */
export async function saveQuestion(_prev: QuestionActionState, form: FormData): Promise<QuestionActionState> {
  await AdminAuth.require();
  const id = String(form.get("id") ?? "");
  let input;
  try {
    input = QuestionContract.parse(form);
  } catch (error) {
    if (error instanceof QuestionValidationError) return { ok: false, message: error.message };
    throw error;
  }

  const repo = questions();
  let savedId = id;
  try {
    if (id) {
      if (!UUID.test(id)) return { ok: false, message: "Unknown question." };
      const existing = await repo.byId(id);
      if (!existing) return { ok: false, message: "That question no longer exists." };
      const live = existing.publishAt !== null && existing.publishAt <= new Date();
      if (live && (existing.slug !== input.slug || existing.topic !== input.topic)) {
        return { ok: false, message: `It's live, so its URL stays ${QuestionTaxonomy.path(existing)}. Put the topic and slug back.` };
      }
      await repo.update(id, input);
    } else {
      savedId = await repo.create(input);
    }
  } catch (error) {
    if (Database.isUniqueViolation(error)) return { ok: false, message: "That URL slug is already used by another question." };
    console.error("[questions] save failed", error);
    return { ok: false, message: "Saving failed. Please retry." };
  }
  revalidatePublic();
  if (!id) redirect(`/admin/questions/${savedId}?saved=1`);
  refresh();
  return { ok: true, message: input.publishAt ? `Saved. Live from ${QuestionContract.toGst(input.publishAt).replace("T", " ")} GST.` : "Saved as a draft." };
}

export async function deleteQuestion(form: FormData): Promise<void> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  if (UUID.test(id)) await questions().remove(id);
  revalidatePublic();
  redirect("/admin/questions");
}

/** A handwritten or diagram solution; the browser has already scaled it to a JPEG under 4 MB. */
export async function uploadSolutionImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  await AdminAuth.require();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  const problem = await PhotoStorage.verify(file);
  if (problem) return { error: problem };
  try {
    return { url: await PhotoStorage.upload(file, "cfa/solution") };
  } catch (error) {
    console.error("[questions] image upload failed", error);
    return { error: "Upload failed. Is BLOB_READ_WRITE_TOKEN set?" };
  }
}

/** Owner: public pages and the daily email each have their own switch; both start off. */
export async function setQuestionSwitch(form: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const name = form.get("name") === "emails" ? "emails" : "pages";
  await questions().setSwitch(name, form.get("on") === "1");
  revalidatePublic();
  refresh();
}

/** From the daily email's link. Same answer for any id, so it reveals nothing. */
export async function unsubscribeDaily(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  if (UUID.test(id)) await LeadRepository.fromEnv()?.unsubscribe(id);
  redirect("/cfa/unsubscribe?done=1");
}
