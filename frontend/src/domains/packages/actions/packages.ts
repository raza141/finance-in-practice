"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { OwnerNotice } from "@/domains/students/server/OwnerNotice";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

import { PackageRepository } from "../server/PackageRepository";
import { PackageTable, type PackageFieldErrors } from "../services/PackageTable";

/** Admin → Pricing (owner), the student's request to change package, and the owner's answer. */

export interface PackageFormState {
  message?: string;
  errors?: PackageFieldErrors;
}

export async function savePackage(_state: PackageFormState, formData: FormData): Promise<PackageFormState> {
  await AdminAuth.requireOwner();
  const repo = PackageRepository.fromEnv();
  if (!repo) return { message: "The database is not configured." };
  const parsed = PackageTable.parse(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };
  const id = String(formData.get("id") ?? "");
  const saved = await repo.save(id || null, parsed.input);
  if (!saved) return { message: "This package no longer exists." };
  revalidatePath("/pricing");
  revalidatePath("/courses/[slug]", "page");
  redirect(`/admin/pricing?notice=${id ? "saved" : "created"}#p-${saved}`);
}

/** Signed-in student: ask to move to another package ("none" withdraws). The owner applies it in Clients. */
export async function requestPackage(formData: FormData): Promise<void> {
  const student = await StudentAuth.current();
  const repo = PackageRepository.fromEnv();
  if (!student || !repo) return;
  const raw = String(formData.get("package") ?? "");
  const wanted = raw === "none" ? null : await repo.byId(raw);
  if (raw !== "none" && !wanted?.isActive) return;
  if ((await repo.request(student.id, wanted?.id ?? null)) && wanted) {
    const { current } = await repo.ofClient(student.id);
    await OwnerNotice.send(
      `${student.name} asks to change package`,
      "Package change request",
      [
        ["Student", student.name],
        ["Now on", current?.name ?? "No package"],
        ["Wants", `${wanted.name}${wanted.hours ? `, ${PackageTable.hours(wanted)} for ${PackageTable.price(wanted)}` : ""}`],
        ["Next step", "Apply it on their client page, or close the request"],
      ],
      student.id,
    );
  }
  refresh();
}

/** Owner: put the client on a package from today (their old package agreement ends), or close their request. */
export async function applyPackage(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const repo = PackageRepository.fromEnv();
  const clientId = String(formData.get("clientId"));
  const packageId = String(formData.get("packageId") ?? "");
  if (!repo) redirect(`/admin/clients/${clientId}?notice=package-refused`);
  if (formData.get("answer") === "dismiss") {
    await repo.request(clientId, null);
    redirect(`/admin/clients/${clientId}?notice=package-dismissed`);
  }
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const applied = await repo.assign(clientId, packageId, today);
  redirect(`/admin/clients/${clientId}?notice=${applied ? "package-applied" : "package-refused"}`);
}
