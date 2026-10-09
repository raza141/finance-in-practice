import "server-only";

import { ServiceRepository } from "@/domains/catalogue/server/ServiceRepository";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

import type { InvoiceFormOptions } from "../components/InvoiceForm";
import type { InvoiceItem } from "../types";
import { AgreementRepository } from "./AgreementRepository";
import { BankAccountRepository } from "./BankAccountRepository";
import { ClientRepository } from "./ClientRepository";

/**
 * What the document form picks from: saved clients, bank accounts, active
 * courses, active services (plus archived ones the document already uses, so
 * an older draft still shows them) and live agreements.
 */
export class InvoiceFormLoader {
  static async options(items: readonly InvoiceItem[] = []): Promise<InvoiceFormOptions> {
    const services = ServiceRepository.fromEnv();
    const usedIds = items.flatMap((item) => (item.serviceId ? [item.serviceId] : []));
    const [clients, banks, courses, active, used, agreements, settings] = await Promise.all([
      ClientRepository.fromEnv()?.all() ?? [],
      BankAccountRepository.fromEnv()?.all() ?? [],
      CourseRepository.fromEnv()?.all() ?? [],
      services?.all() ?? [],
      services?.byIds(usedIds) ?? [],
      AgreementRepository.fromEnv()?.active() ?? [],
      SettingsRepository.load(),
    ]);
    return {
      clients,
      banks,
      settings,
      courses: courses.filter((course) => course.isActive).map(({ title, priceMinor, currency }) => ({ title, priceMinor, currency })),
      services: [...active, ...used.filter((s) => s.archivedAt)],
      agreements,
    };
  }
}
