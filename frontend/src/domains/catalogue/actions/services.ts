"use server";

import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { ServiceRepository } from "../server/ServiceRepository";
import { CatalogueContract, type ServiceFieldErrors } from "../services/CatalogueContract";

/** Owner-only admin actions for the service catalogue. Each re-checks the session: server actions are public endpoints. */

export interface ServiceFormState {
  message?: string;
  errors?: ServiceFieldErrors;
}

async function repo(): Promise<ServiceRepository> {
  await AdminAuth.requireOwner();
  const services = ServiceRepository.fromEnv();
  if (!services) throw new Error("DATABASE_URL is not configured");
  return services;
}

const DUPLICATE: ServiceFormState = { errors: { code: "Another service already uses this code." }, message: "Please fix the highlighted fields." };

export async function saveService(_state: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const services = await repo();
  const parsed = CatalogueContract.parseService({ ...Object.fromEntries(formData), units: formData.getAll("units") });
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };
  const id = formData.get("id");
  if (typeof id === "string" && id) {
    const error = await services.update(id, parsed.input);
    if (error === "duplicate-code") return DUPLICATE;
    if (error) return { message: "This service no longer exists." };
    redirect(`/admin/services/${id}?notice=saved`);
  }
  const created = await services.create(parsed.input);
  if (created === "duplicate-code") return DUPLICATE;
  if (typeof created === "string") return { message: "Not saved." };
  redirect(`/admin/services/${created.id}?notice=created`);
}

export async function archiveService(formData: FormData): Promise<void> {
  const services = await repo();
  const id = String(formData.get("id"));
  const archive = formData.get("archive") === "true";
  await services.setArchived(id, archive);
  redirect(`/admin/services/${id}?notice=${archive ? "archived" : "reactivated"}`);
}

const PRICE_ERRORS = {
  overlap: "A price for this basis and currency already starts on or after that date: remove it, or choose a later start.",
  unit: "This service is not billed on that basis.",
  missing: "This service no longer exists.",
  "duplicate-code": "",
} as const;

export async function addServicePrice(formData: FormData): Promise<void> {
  const services = await repo();
  const id = String(formData.get("id"));
  const path = `/admin/services/${id}`;
  const service = await services.byId(id);
  if (!service) redirect("/admin/services");
  const parsed = CatalogueContract.parsePrice(Object.fromEntries(formData), service.units);
  if (typeof parsed === "string") redirect(`${path}?notice=price-refused&reason=${encodeURIComponent(parsed)}`);
  const error = await services.addPrice(id, parsed);
  if (error) redirect(`${path}?notice=price-refused&reason=${encodeURIComponent(PRICE_ERRORS[error])}`);
  redirect(`${path}?notice=price-added`);
}

export async function removeServicePrice(formData: FormData): Promise<void> {
  const services = await repo();
  const id = String(formData.get("id"));
  await services.removePrice(id, String(formData.get("priceId")));
  redirect(`/admin/services/${id}?notice=price-removed`);
}
