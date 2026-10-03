"use server";

import { redirect } from "next/navigation";

import { AdminAuth } from "../server/AdminAuth";

export interface FormState {
  message?: string;
  ok?: boolean;
  /** Echoed back so a failed login doesn't clear the email field. */
  email?: string;
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { message: "Enter your email and password.", email: typeof email === "string" ? email : "" };
  }
  if (email.length > 254 || password.length > 200) return { message: "Incorrect email or password.", email };

  const result = await AdminAuth.loginWithPassword(email, password);
  if (!result.ok) return { message: result.message, email };
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await AdminAuth.logout();
  redirect("/admin/login");
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const current = formData.get("current");
  const next = formData.get("next");
  const confirm = formData.get("confirm");
  if (typeof next !== "string" || typeof confirm !== "string") return { message: "Enter a new password." };
  if (next !== confirm) return { message: "The new passwords don't match." };

  const result = await AdminAuth.changePassword(typeof current === "string" ? current : "", next);
  return result.ok ? { ok: true, message: "Password saved. Your other sessions were signed out." } : { message: result.message };
}
