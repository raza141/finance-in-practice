"use server";

import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { BankAccountRepository } from "../server/BankAccountRepository";
import { ClientRepository } from "../server/ClientRepository";
import { InvoiceContract, type BankFieldErrors, type ClientFieldErrors } from "../services/InvoiceContract";

/**
 * Saved clients and bank accounts. Each action re-checks the session: server
 * actions are public POST endpoints regardless of which page renders them.
 */

export interface ClientFormState {
  message?: string;
  errors?: ClientFieldErrors;
}

export interface BankFormState {
  message?: string;
  errors?: BankFieldErrors;
}

async function clients(): Promise<ClientRepository> {
  await AdminAuth.require();
  const repo = ClientRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

async function banks(): Promise<BankAccountRepository> {
  await AdminAuth.require();
  const repo = BankAccountRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

export async function saveClient(_state: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const repo = await clients();
  const parsed = InvoiceContract.parseClient(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };
  const id = formData.get("id");
  if (typeof id === "string" && id) {
    if (!(await repo.update(id, parsed.input))) return { message: "This client no longer exists." };
  } else {
    await repo.create(parsed.input);
  }
  redirect("/admin/clients");
}

export async function deleteClient(formData: FormData): Promise<void> {
  const repo = await clients();
  await repo.remove(String(formData.get("id")));
  redirect("/admin/clients");
}

export async function saveBank(_state: BankFormState, formData: FormData): Promise<BankFormState> {
  const repo = await banks();
  const parsed = InvoiceContract.parseBank(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };
  const id = formData.get("id");
  if (typeof id === "string" && id) {
    if (!(await repo.update(id, parsed.input))) return { message: "This bank account no longer exists." };
    redirect("/admin/invoices/banks?notice=saved");
  }
  await repo.create(parsed.input);
  redirect("/admin/invoices/banks?notice=added");
}

export async function setDefaultBank(formData: FormData): Promise<void> {
  const repo = await banks();
  await repo.setDefault(String(formData.get("id")));
  redirect("/admin/invoices/banks");
}

export async function deleteBank(formData: FormData): Promise<void> {
  const repo = await banks();
  await repo.remove(String(formData.get("id")));
  redirect("/admin/invoices/banks");
}
