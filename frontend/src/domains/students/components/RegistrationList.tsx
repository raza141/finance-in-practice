import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { approveRegistration, dismissRegistration } from "../actions/registrations";
import type { StudentRegistration } from "../types";

const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Sign-ups from /student waiting for the owner. Approving creates (or updates) the client with the chosen course. */
export function RegistrationList({ registrations, courses: titles }: { registrations: StudentRegistration[]; courses: string[] }) {
  if (registrations.length === 0) return null;
  const courses = [...new Set(titles)];
  return (
    <section id="registrations" className="mt-8 rounded-lg border border-gold/40 bg-gold/5 p-5">
      <h2 className="text-lg">
        New registrations <span className="ml-1 rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-canvas">{registrations.length}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        Approve with a course to let them sign in at /student (pick an internal course such as Academic Mentorship Program for &ldquo;Other&rdquo;).
        Approving emails them a sign-in link (when email sending is set up).
      </p>
      <ul className="mt-4 divide-y divide-line/60">
        {registrations.map((r) => {
          const whatsapp = `https://wa.me/${r.phone.replace(/\D/g, "")}`;
          return (
            <li key={r.id} className="grid gap-3 py-3 text-sm lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-semibold text-ink">
                  {r.name} <span className="font-normal text-muted">· {WHEN.format(new Date(r.createdAt))}</span>
                </p>
                <p className="text-muted">
                  {r.email} ·{" "}
                  <a href={whatsapp} target="_blank" rel="noreferrer" className="text-quant hover:underline">
                    {r.phone}
                  </a>
                </p>
                <p className="text-ink/90">Wants: {r.course}</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <form action={approveRegistration} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <select name="course" required defaultValue={courses.includes(r.course) ? r.course : ""} aria-label="Course to give" className={`${FIELD} mt-0 w-56`}>
                    <option value="" disabled>
                      Course to give…
                    </option>
                    {courses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <PendingButton pendingLabel="Approving…" className="h-9 rounded-md bg-quant/15 px-3 text-sm font-medium text-quant hover:bg-quant/25">
                    Approve
                  </PendingButton>
                </form>
                <form action={dismissRegistration}>
                  <input type="hidden" name="id" value={r.id} />
                  <PendingButton pendingLabel="Dismissing…" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-red-300">
                    Dismiss
                  </PendingButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
