import "server-only";

import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

import type { InvoiceFormOptions } from "../components/InvoiceForm";
import { BankAccountRepository } from "./BankAccountRepository";
import { ClientRepository } from "./ClientRepository";

/** The saved clients, bank accounts and courses the invoice form picks from. */
export class InvoiceFormLoader {
  static async options(): Promise<InvoiceFormOptions> {
    const [clients, banks, courses, settings] = await Promise.all([
      ClientRepository.fromEnv()?.all() ?? [],
      BankAccountRepository.fromEnv()?.all() ?? [],
      CourseRepository.fromEnv()?.all() ?? [],
      SettingsRepository.load(),
    ]);
    return {
      clients,
      banks,
      settings,
      courses: courses.map(({ title, priceMinor, currency }) => ({ title, priceMinor, currency })),
    };
  }
}
