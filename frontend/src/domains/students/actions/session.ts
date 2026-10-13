"use server";

import { redirect } from "next/navigation";

import { StudentAuth } from "../server/StudentAuth";

export async function signOutStudent(): Promise<void> {
  await StudentAuth.logout();
  redirect("/student");
}
