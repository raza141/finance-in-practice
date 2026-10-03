import type { Metadata } from "next";

import { PasswordForm } from "@/domains/admin/components/PasswordForm";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";

export const metadata: Metadata = { title: "Account" };

export default async function AdminAccountPage() {
  const admin = await AdminAuth.require();

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-normal tracking-tight italic">Account</h1>

      <dl className="mt-8 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Name</dt>
        <dd>{admin.name}</dd>
        <dt className="text-muted">Email</dt>
        <dd>{admin.email}</dd>
        <dt className="text-muted">Google sign-in</dt>
        <dd>{admin.googleLinked ? "Linked" : "Not linked yet (links on first Google sign-in)"}</dd>
      </dl>

      <section aria-labelledby="password-heading" className="mt-10">
        <h2 id="password-heading" className="font-mono text-xs tracking-[0.22em] text-muted uppercase">
          {admin.hasPassword ? "Change password" : "Set a password"}
        </h2>
        <p className="mt-2 mb-5 text-sm text-muted">
          {admin.hasPassword
            ? "Changing it signs you out on every other device."
            : "You currently sign in with Google only. Set a password to also sign in with email."}
        </p>
        <PasswordForm hasPassword={admin.hasPassword} />
      </section>
    </div>
  );
}
