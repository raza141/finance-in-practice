"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { InstructorRepository } from "../server/InstructorRepository";
import { InstructorContract, type InstructorFieldErrors } from "../services/InstructorContract";

/**
 * Admin instructor management. Each action re-checks the session: server
 * actions are public POST endpoints regardless of which page renders them.
 */

export interface InstructorFormState {
  message?: string;
  errors?: InstructorFieldErrors;
}

async function repository(): Promise<InstructorRepository> {
  await AdminAuth.require();
  const repo = InstructorRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** /about lists the team and the home page teases the first instructor. */
function revalidateTeam(): void {
  revalidatePath("/about");
  revalidatePath("/");
}

export async function saveInstructor(_state: InstructorFormState, formData: FormData): Promise<InstructorFormState> {
  const repo = await repository();
  const parsed = InstructorContract.parse(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };

  const id = formData.get("id");
  if (typeof id === "string" && id) {
    if (!(await repo.update(id, parsed.input))) return { message: "This instructor no longer exists." };
  } else {
    await repo.create(parsed.input);
  }
  revalidateTeam();
  redirect("/admin/instructors");
}

export async function setInstructorActive(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await repo.setActive(id, formData.get("active") === "true");
  revalidateTeam();
  refresh();
}

export async function deleteInstructor(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await repo.remove(id);
  revalidateTeam();
  redirect("/admin/instructors");
}
