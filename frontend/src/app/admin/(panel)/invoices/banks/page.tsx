import type { Metadata } from "next";
import Link from "next/link";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { deleteBank, setDefaultBank } from "@/domains/invoices/actions/billing";
import { BankForm } from "@/domains/invoices/components/BillingForms";
import { BankAccountRepository } from "@/domains/invoices/server/BankAccountRepository";

export const metadata: Metadata = { title: "Bank accounts" };

const NOTICES: Record<string, string> = { saved: "Bank account saved.", added: "Bank account added." };

/** The one place bank details are set up; the default is preselected on new invoices. */
export default async function BankAccountsPage({ searchParams }: PageProps<"/admin/invoices/banks">) {
  await AdminAuth.requireOwner();
  const repo = BankAccountRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const accounts = await repo.all();
  const notice = NOTICES[String((await searchParams).notice)];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/invoices" className="text-sm text-muted hover:text-ink">
        ← Invoices
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">Bank accounts</h1>
      <p className="mt-2 text-sm text-muted">
        Printed under “Payment information”. The default is chosen on new invoices; pick another on the invoice to change how it is paid.
        Editing an account doesn’t change invoices already issued.
      </p>
      {notice && (
        <p role="status" className="mt-4 text-sm text-quant">
          {notice}
        </p>
      )}

      <div className="mt-8 grid gap-4">
        {accounts.map((account) => (
          <details key={account.id} className="rounded-lg border border-line p-5">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="text-ink">{account.bankName}</span>
              <span className="font-mono text-xs text-muted">{account.iban || account.accountNumber}</span>
              {account.isDefault && <span className="rounded border border-gold/50 px-2 py-0.5 font-mono text-[10px] tracking-wider text-gold uppercase">Default</span>}
            </summary>
            <div className="mt-5">
              <BankForm account={account} />
            </div>
            <div className="mt-5 flex gap-3 border-t border-line pt-4">
              {!account.isDefault && (
                <form action={setDefaultBank}>
                  <input type="hidden" name="id" value={account.id} />
                  <PendingButton pendingLabel="Saving…" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
                    Make default
                  </PendingButton>
                </form>
              )}
              <form action={deleteBank}>
                <input type="hidden" name="id" value={account.id} />
                <PendingButton pendingLabel="Deleting…" className="h-9 px-3 text-sm text-red-300/90 hover:underline">
                  Delete
                </PendingButton>
              </form>
            </div>
          </details>
        ))}
      </div>

      <section className="mt-10 rounded-lg border border-line p-5">
        <h2 className="mb-5 text-sm text-quant">{accounts.length === 0 ? "Add your bank" : "Add another bank"}</h2>
        <BankForm />
      </section>
    </div>
  );
}
