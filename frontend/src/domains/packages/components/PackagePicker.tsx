"use client";

import { useRef, useState } from "react";

import { RegistrationContract } from "@/domains/students/services/RegistrationContract";
import { EmailSignIn, JoinForm } from "@/domains/students/components/JoinForm";

import { Cart } from "../services/Cart";
import { PackageTable } from "../services/PackageTable";
import type { Package, PricingCourse } from "../types";

const OTHER = RegistrationContract.OTHER;
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";

/** One line of the term sheet: label, dotted leader, value. */
function Term({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-sm text-muted">{label}</dt>
      <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-line" />
      <dd className={`text-right tabular-nums ${strong ? "text-xl font-semibold text-ink" : "text-sm text-ink"}`}>{value}</dd>
    </div>
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
  initialCourse,
  initialPackage,
  delivery,
}: {
  courses: PricingCourse[];
  packages: Package[];
  initialCourse: string;
  initialPackage: string;
  delivery: string;
}) {
  const [course, setCourse] = useState(initialCourse);
  const [chosen, setChosen] = useState(initialPackage);
  const checkout = useRef<HTMLElement>(null);

  const current = courses.find((c) => c.title === course);
  const exam = (current?.sittings.length ?? 0) > 0;
  const offered = PackageTable.forCourse(packages, exam);
  const priced = offered.filter((p) => !PackageTable.isCustom(p));
  const custom = offered.find(PackageTable.isCustom);
  const { common, rows } = PackageTable.compare(offered);
  const pick = offered.find((p) => p.id === chosen) ?? null;

  function sync(nextCourse: string, nextPackage: string) {
    const params = new URLSearchParams();
    const slug = courses.find((c) => c.title === nextCourse)?.slug ?? (nextCourse === OTHER ? "other" : "");
    if (slug) params.set("course", slug);
    if (nextPackage) params.set("package", nextPackage);
    window.history.replaceState(null, "", `/pricing${params.size ? `?${params}` : ""}#packages`);
  }

  function chooseCourse(title: string) {
    setCourse(title);
    // A package the new course doesn't offer is dropped.
    const keep = PackageTable.forCourse(packages, (courses.find((c) => c.title === title)?.sittings.length ?? 0) > 0).some((p) => p.id === chosen);
    if (!keep) setChosen("");
    sync(title, keep ? chosen : "");
  }

  function choosePackage(id: string) {
    setChosen(id);
    sync(course, id);
    Cart.write({ course, packageId: id });
    requestAnimationFrame(() => checkout.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }

  const chip = (title: string, label: string) => (
    <button
      key={title}
      type="button"
      onClick={() => chooseCourse(title)}
      aria-pressed={course === title}
      className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-quant/60 focus-visible:outline-none ${
        course === title ? "border-quant bg-quant/15 font-semibold text-quant" : "border-line text-muted hover:border-quant/50 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div id="packages" className="grid scroll-mt-24 gap-10">
      <fieldset>
        <legend className="mb-3 text-lg text-ink">Which course?</legend>
        <div className="flex flex-wrap gap-2">
          {courses.map((c) => chip(c.title, c.title))}
          {chip(OTHER, "University, consultancy or other")}
        </div>
      </fieldset>

      {course === "" ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-muted">Pick your course to see its packages.</p>
      ) : (
        <>
          {priced.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-3" aria-label="Packages">
              {priced.map((p) => {
                const selected = chosen === p.id;
                return (
                  <li
                    key={p.id}
                    className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                      selected ? "border-quant bg-quant/[0.07]" : p.featured ? "border-gold/60 bg-surface" : "border-line bg-surface"
                    }`}
                  >
                    {p.featured && (
                      <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-0.5 text-xs font-semibold text-canvas">Recommended</span>
                    )}
                    <h2 className="text-xl font-semibold text-ink">{p.name}</h2>
                    {p.tagline && <p className="mt-1 text-sm text-muted">{p.tagline}</p>}
                    <p className="mt-5 text-4xl font-semibold tracking-tight text-ink tabular-nums">{PackageTable.price(p)}</p>
                    <p className="mt-1 text-sm text-muted tabular-nums">
                      {PackageTable.hours(p)}
                      {p.hours !== 1 && <span className="text-quant">, {PackageTable.perHour(p)}</span>}
                    </p>
                    {rows.length > 0 && (
                      <dl className="mt-5 grid flex-1 content-start gap-3 border-t border-line pt-5 text-sm">
                        {rows.map((r) => {
                          const value = r.values[priced.indexOf(p)];
                          return (
                            <div key={r.label}>
                              <dt className="text-muted">{r.label}</dt>
                              <dd className={value ? "text-ink" : "text-muted/60"}>{value || "Not included"}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                    <button
                      type="button"
                      onClick={() => choosePackage(p.id)}
                      aria-pressed={selected}
                      className={`mt-6 h-11 rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-quant/60 focus-visible:outline-none ${
                        selected ? "bg-quant text-canvas" : "bg-gold text-canvas hover:bg-gold-bright"
                      }`}
                    >
                      {selected ? "Chosen" : `Choose ${p.hours} hour${p.hours === 1 ? "" : "s"}`}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {custom && (
            <div
              className={`flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between ${
                chosen === custom.id ? "border-quant bg-quant/[0.07]" : "border-line bg-surface/60"
              }`}
            >
              <div>
                <h2 className="text-xl font-semibold text-ink">{custom.name}</h2>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  {custom.tagline || "Hours, pace and place agreed with you."} You register, we agree the details on WhatsApp, and your agreement follows.
                </p>
              </div>
              <button
                type="button"
                onClick={() => choosePackage(custom.id)}
                aria-pressed={chosen === custom.id}
                className={`h-11 shrink-0 rounded-md border px-6 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-quant/60 focus-visible:outline-none ${
                  chosen === custom.id ? "border-quant bg-quant text-canvas" : "border-gold/60 text-gold hover:bg-gold/10"
                }`}
              >
                {chosen === custom.id ? "Chosen" : "Choose Custom"}
              </button>
            </div>
          )}

          {priced.length > 0 && common.length > 0 && (
            <section aria-labelledby="included-heading" className="grid gap-4 rounded-2xl border border-line p-6 md:grid-cols-[14rem_1fr]">
              <div>
                <h2 id="included-heading" className="text-lg text-ink">
                  Every package includes
                </h2>
                <p className="mt-2 text-sm text-muted">Teaching, live reviews and check-in calls count toward your hours.</p>
              </div>
              <ul className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                {common.map((f) => (
                  <li key={f.label} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-quant/20 text-[10px] text-quant">
                      ✓
                    </span>
                    <span className="text-ink">
                      {f.label}
                      {f.value !== "Included" && <span className="text-muted">: {f.value.toLowerCase()}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted md:col-start-2">{delivery}</p>
            </section>
          )}
        </>
      )}

      {pick && (
        <section
          ref={checkout}
          id="checkout"
          aria-labelledby="checkout-heading"
          className="grid scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/10 bg-canvas/60 md:grid-cols-[minmax(0,22rem)_1fr]"
        >
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_15%_15%,rgb(34_211_238/0.14),transparent_60%)] p-6 sm:p-8 md:border-r md:border-b-0">
            <h2 id="checkout-heading" className="text-2xl font-normal italic">
              Your package
            </h2>
            <dl className="mt-6 grid gap-3">
              <Term label="Course" value={course === OTHER ? "To agree with you" : course} />
              <Term label="Package" value={pick.name} />
              <Term label="Hours" value={pick.hours === null ? "Agreed with you" : String(pick.hours)} />
              {pick.hours !== null && pick.hours > 1 && <Term label="Per hour" value={PackageTable.perHour(pick) ?? ""} />}
              <div className="mt-2 border-t border-line pt-4">
                <Term label="Total" value={PackageTable.price(pick)} strong />
              </div>
            </dl>
            <p className="mt-6 text-sm text-muted">
              {PackageTable.isCustom(pick)
                ? "After you register, we message you on WhatsApp to agree hours, pace and fee. Your agreement follows."
                : "Registering makes this package your agreement. We confirm on WhatsApp and send your invoice."}
            </p>
            <p className="mt-3 text-xs text-muted">Your package stays the same until you ask to change it from your portal.</p>
          </div>

          <div className="grid content-start gap-5 p-6 sm:p-8">
            <p className={LABEL}>Register</p>
            {/* A plain link: the pick is already saved in this browser for the way back from Google. */}
            <a
              href="/api/student/auth/google"
              className="inline-flex h-12 items-center justify-center rounded-md border border-quant/50 px-6 text-sm font-semibold text-quant transition-colors hover:bg-quant/10"
            >
              Continue with Google
            </a>
            <p className="flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
              <span aria-hidden className="h-px flex-1 bg-line" />
              or with your email
              <span aria-hidden className="h-px flex-1 bg-line" />
            </p>
            <JoinForm key={`${course}|${pick.id}`} courses={courses} packages={packages} picked={{ course, packageId: pick.id }} />
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
