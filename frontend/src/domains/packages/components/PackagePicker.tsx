"use client";

import { useRef, useState, type ReactNode } from "react";

import { EmailSignIn, JoinForm } from "@/domains/students/components/JoinForm";
import { RegistrationContract } from "@/domains/students/services/RegistrationContract";

import { Cart } from "../services/Cart";
import { PackageTable, type CourseGroup } from "../services/PackageTable";
import type { Package, PricingCourse } from "../types";

const OTHER = RegistrationContract.OTHER;

/** A choice in the course filter: a published course, or a subject without a page (sent as "Other"). */
interface Choice {
  key: string;
  course: string;
  slug: string;
  label: string;
  hint: string;
  group: CourseGroup;
}

const SUBJECTS: readonly Choice[] = [
  { key: "university", course: OTHER, slug: "university", label: "University subject", hint: "Hourly or monthly", group: "university" },
  { key: "other", course: OTHER, slug: "other", label: "Something else", hint: "A custom plan", group: "other" },
];

/** One line of the summary: label, dotted leader, value. */
function Term({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-line" />
      <dd className={`text-right tabular-nums ${strong ? "text-xl font-semibold text-ink" : "text-sm text-ink"}`}>{value}</dd>
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-quant/15 text-[11px] text-quant">
        ✓
      </span>
      <span className="text-pretty">{children}</span>
    </li>
  );
}

/**
 * /pricing in one place: the course, the package, then registration in the same
 * view. Choosing keeps the pick in the URL (shareable) and in this browser (Cart),
 * so it survives the Google round trip.
 */
export function PackagePicker({
  courses,
  packages,
  initialKey,
  initialPackage,
  delivery,
}: {
  courses: PricingCourse[];
  packages: Package[];
  /** A course title, or a SUBJECTS key ("university", "other"). */
  initialKey: string;
  initialPackage: string;
  delivery: string;
}) {
  const choices: Choice[] = [
    ...courses.map((c) => ({
      key: c.title,
      course: c.title,
      slug: c.slug,
      label: c.title,
      hint: PackageTable.groupOf(c) === "exam" ? "Exam preparation" : c.category,
      group: PackageTable.groupOf(c),
    })),
    ...SUBJECTS,
  ];
  const [key, setKey] = useState(initialKey);
  const [chosen, setChosen] = useState(initialPackage);
  const checkout = useRef<HTMLElement>(null);

  const choice = choices.find((c) => c.key === key) ?? null;
  const offered = choice ? PackageTable.forCourse(packages, choice.group) : [];
  const priced = offered.filter((p) => !PackageTable.isCustom(p));
  const custom = offered.find((p) => PackageTable.isCustom(p));
  const { common, own } = PackageTable.compare(offered);
  const pick = offered.find((p) => p.id === chosen) ?? null;

  function sync(next: Choice | null, packageId: string) {
    const params = new URLSearchParams();
    if (next) params.set("course", next.slug);
    if (packageId) params.set("package", packageId);
    window.history.replaceState(null, "", `/pricing${params.size ? `?${params}` : ""}`);
  }

  function chooseCourse(next: Choice) {
    setKey(next.key);
    // A package the new course doesn't offer is dropped.
    const keep = PackageTable.forCourse(packages, next.group).some((p) => p.id === chosen) ? chosen : "";
    setChosen(keep);
    sync(next, keep);
  }

  function choosePackage(id: string) {
    if (!choice) return;
    setChosen(id);
    sync(choice, id);
    Cart.write({ course: choice.course, packageId: id });
    requestAnimationFrame(() => checkout.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }

  const button = (p: Package, label: string) => {
    const selected = chosen === p.id;
    return (
      <button
        type="button"
        onClick={() => choosePackage(p.id)}
        aria-pressed={selected}
        className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quant ${
          selected
            ? "bg-quant text-canvas"
            : p.featured
              ? "bg-gold text-canvas hover:bg-gold-bright"
              : "border border-gold/50 text-gold hover:border-gold hover:bg-gold/10"
        }`}
      >
        {selected ? (
          <>
            <span aria-hidden>✓</span> Selected package
          </>
        ) : (
          label
        )}
      </button>
    );
  };

  return (
    <div className="grid gap-12">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">Your course</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-canvas p-1 *:last:odd:col-span-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] sm:*:last:odd:col-span-1">
          {choices.map((c) => {
            const on = c.key === key;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => chooseCourse(c)}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-quant ${
                  on ? "bg-quant/15 text-quant shadow-[inset_0_0_0_1px] shadow-quant/60" : "text-ink/90 hover:bg-surface-raised"
                }`}
              >
                <span className="text-sm font-semibold text-balance">{c.label}</span>
                <span className={`text-xs ${on ? "text-quant/80" : "text-muted"}`}>{c.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {!choice ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">Choose your course to see its packages.</p>
      ) : (
        <section aria-label={`Packages for ${choice.label}`} className="grid gap-6">
          {priced.length > 0 && (
            <ul className={`grid gap-5 ${priced.length >= 3 ? "lg:grid-cols-3" : priced.length === 2 ? "md:grid-cols-2" : ""}`}>
              {priced.map((p) => {
                const selected = chosen === p.id;
                const perHour = PackageTable.perHour(p);
                const features = own.get(p.id) ?? [];
                return (
                  <li
                    key={p.id}
                    className={`row-span-4 grid grid-rows-subgrid gap-6 rounded-2xl border p-6 transition-colors sm:p-7 ${
                      selected ? "border-quant bg-quant/[0.06] ring-1 ring-quant" : p.featured ? "border-gold/50 bg-surface" : "border-line bg-surface"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg font-semibold text-balance text-ink">{p.name}</h2>
                        {p.featured && <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">Recommended</span>}
                      </div>
                      {p.tagline && <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted">{p.tagline}</p>}
                    </div>

                    <div className="border-t border-line pt-6">
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-semibold tracking-tight text-ink tabular-nums">{PackageTable.price(p)}</span>
                        {PackageTable.per(p) && <span className="text-sm text-muted">{PackageTable.per(p)}</span>}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/90">
                        {PackageTable.hours(p)}
                        {perHour && <span className="rounded-full bg-quant/10 px-2.5 py-0.5 text-xs text-quant tabular-nums">{perHour}</span>}
                      </p>
                    </div>

                    <ul className="grid content-start gap-3 text-sm">
                      {features.map((f) => (
                        <Check key={f.label}>
                          <span className="text-ink">{f.label}</span>
                          {f.value !== "Included" && <span className="block text-muted">{f.value}</span>}
                        </Check>
                      ))}
                    </ul>

                    <div className="self-end">{button(p, `Choose ${p.name}`)}</div>
                  </li>
                );
              })}
            </ul>
          )}

          {custom && (
            <div
              className={`grid gap-5 rounded-2xl border p-6 sm:p-7 md:grid-cols-[1fr_16rem] md:items-center ${
                chosen === custom.id ? "border-quant bg-quant/[0.06] ring-1 ring-quant" : "border-line bg-surface/60"
              }`}
            >
              <div>
                <h2 className="text-lg font-semibold text-ink">{custom.name}</h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-pretty text-muted">
                  Your own pace, more hours or set milestones. Register here and we&rsquo;ll plan the details with you on WhatsApp.
                </p>
              </div>
              {button(custom, "Choose Custom")}
            </div>
          )}

          {common.length > 0 && (
            <section aria-labelledby="included-heading" className="grid gap-6 rounded-2xl border border-line p-6 sm:p-7 md:grid-cols-[15rem_1fr]">
              <div>
                <h2 id="included-heading" className="text-lg font-semibold text-ink">
                  Every package includes
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted">Teaching, live reviews and check-in calls all count toward your hours.</p>
              </div>
              <div className="grid gap-4">
                <ul className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  {common.map((f) => (
                    <Check key={f.label}>
                      <span className="text-ink">{f.label}</span>
                      {f.value !== "Included" && <span className="text-muted">: {f.value.toLowerCase()}</span>}
                    </Check>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-pretty text-muted">{delivery}</p>
              </div>
            </section>
          )}
        </section>
      )}

      {choice && pick && (
        <section
          ref={checkout}
          id="checkout"
          aria-labelledby="checkout-heading"
          className="grid scroll-mt-24 overflow-hidden rounded-3xl border border-white/10 bg-canvas/60 md:grid-cols-[minmax(0,22rem)_1fr]"
        >
          <div className="grid content-start gap-6 border-b border-white/10 bg-[radial-gradient(circle_at_15%_15%,rgb(34_211_238/0.12),transparent_60%)] p-6 sm:p-8 md:border-r md:border-b-0">
            <h2 id="checkout-heading" className="text-2xl font-normal italic">
              Your choice
            </h2>
            <dl className="grid gap-3">
              <Term label="Course" value={choice.course === OTHER ? choice.label : choice.course} />
              <Term label="Package" value={pick.name} />
              <Term label="Hours" value={PackageTable.hours(pick)} />
              {PackageTable.perHour(pick) && <Term label="Per hour" value={PackageTable.perHour(pick) ?? ""} />}
              <div className="mt-2 border-t border-line pt-4">
                <Term label="Price" value={`${PackageTable.price(pick)} ${PackageTable.per(pick)}`.trim()} strong />
              </div>
            </dl>
            <div className="grid gap-2 text-sm leading-relaxed text-pretty text-muted">
              <p>
                {PackageTable.isCustom(pick)
                  ? "Sending this form reserves your place. We'll plan the hours, pace and fee with you on WhatsApp, then send your agreement."
                  : "Sending this form reserves your package. We'll confirm on WhatsApp, then send your agreement and invoice."}
              </p>
              <p className="text-xs">You can ask to change your package later from your portal.</p>
            </div>
          </div>

          <div className="grid content-start gap-5 p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-ink">Register</h3>
            {/* A plain link: the pick is already saved in this browser for the way back from Google. */}
            <a
              href="/api/student/auth/google"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-quant/50 px-6 text-sm font-semibold text-quant transition-colors hover:bg-quant/10"
            >
              Continue with Google
            </a>
            <p className="flex items-center gap-3 text-xs text-muted">
              <span aria-hidden className="h-px flex-1 bg-line" />
              or with your email
              <span aria-hidden className="h-px flex-1 bg-line" />
            </p>
            <JoinForm key={`${choice.key}|${pick.id}`} courses={courses} packages={packages} picked={{ course: choice.course, packageId: pick.id }} />
            <details className="border-t border-line pt-4 text-sm text-muted">
              <summary className="cursor-pointer hover:text-ink">Already a student? Sign in instead</summary>
              <div className="mt-3">
                <EmailSignIn />
              </div>
            </details>
          </div>
        </section>
      )}
    </div>
  );
}
