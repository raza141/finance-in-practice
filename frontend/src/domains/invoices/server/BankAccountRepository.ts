import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { BankAccount, BankDetails } from "../types";

interface BankRow {
  id: string;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  branch: string;
  swift: string;
  is_default: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The owner's bank accounts for "Payment information" (migration 013). At most one is the default. */
export class BankAccountRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): BankAccountRepository | null {
    const sql = Database.sql();
    return sql ? new BankAccountRepository(sql) : null;
  }

  /** Default first. */
  async all(): Promise<BankAccount[]> {
    const rows = (await this.sql`SELECT * FROM bank_accounts ORDER BY is_default DESC, created_at`) as BankRow[];
    return rows.map(BankAccountRepository.toAccount);
  }

  async byId(id: string): Promise<BankAccount | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`SELECT * FROM bank_accounts WHERE id = ${id}`) as BankRow[];
    return row ? BankAccountRepository.toAccount(row) : null;
  }

  /** The first account added becomes the default. */
  async create(input: BankDetails): Promise<string> {
    const [row] = (await this.sql`
      INSERT INTO bank_accounts (bank_name, account_title, account_number, iban, branch, swift, is_default)
      VALUES (${input.bankName}, ${input.accountTitle}, ${input.accountNumber}, ${input.iban}, ${input.branch},
              ${input.swift}, NOT EXISTS (SELECT 1 FROM bank_accounts WHERE is_default))
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  async update(id: string, input: BankDetails): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE bank_accounts SET bank_name = ${input.bankName}, account_title = ${input.accountTitle},
        account_number = ${input.accountNumber}, iban = ${input.iban}, branch = ${input.branch},
        swift = ${input.swift}, updated_at = now()
      WHERE id = ${id} RETURNING id
    `;
    return rows.length > 0;
  }

  /** Clear the old default before setting the new one: the unique index is checked row by row. */
  async setDefault(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql.transaction([
      this.sql`UPDATE bank_accounts SET is_default = false WHERE is_default AND id <> ${id}`,
      this.sql`UPDATE bank_accounts SET is_default = true, updated_at = now() WHERE id = ${id}`,
    ]);
  }

  /** Issued invoices keep their snapshot of the details. */
  async remove(id: string): Promise<void> {
    if (UUID.test(id)) await this.sql`DELETE FROM bank_accounts WHERE id = ${id}`;
  }

  static details(account: BankDetails): BankDetails {
    const { bankName, accountTitle, accountNumber, iban, branch, swift } = account;
    return { bankName, accountTitle, accountNumber, iban, branch, swift };
  }

  private static toAccount(row: BankRow): BankAccount {
    return {
      id: row.id,
      bankName: row.bank_name,
      accountTitle: row.account_title,
      accountNumber: row.account_number,
      iban: row.iban,
      branch: row.branch,
      swift: row.swift,
      isDefault: row.is_default,
    };
  }
}
