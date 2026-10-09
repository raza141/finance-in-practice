"use server";

import { revalidatePath } from "next/cache";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { SettingsRepository } from "../server/SettingsRepository";
import { SettingsContract, type SettingsFieldErrors } from "../services/SettingsContract";

export interface SettingsFormState {
  message?: string;
  errors?: SettingsFieldErrors;
  saved?: boolean;
}

/** Re-checks the session: server actions are public POST endpoints. */
export async function saveSettings(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const admin = await AdminAuth.requireOwner();
  const repo = SettingsRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  const parsed = SettingsContract.parse(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };
  await repo.save(parsed.settings, admin.id);
  revalidatePath("/admin", "layout");
  revalidatePath("/invoice", "layout");
  return { saved: true };
}
