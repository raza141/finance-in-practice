"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { ApiError } from "@/core/http/ApiError";
import { Cart, type CartPick } from "@/domains/packages/services/Cart";
import { PackageTable } from "@/domains/packages/services/PackageTable";
import type { Package, PricingCourse } from "@/domains/packages/types";

import { Batches } from "../services/Batches";
import { RegistrationContract } from "../services/RegistrationContract";
import { StudentApiClient } from "../services/StudentApiClient";

const FIELD =
  "w-full rounded-md border border-line bg-canvas/80 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
const client = new StudentApiClient();
const { OTHER, EXTRA, LIMITS } = RegistrationContract;

type FormState = { kind: "editing"; error?: string } | { kind: "sending" } | { kind: "sent"; to: string };

const fieldsOf = (form: HTMLFormElement) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v)]));
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Please retry.");

/** After the server mailed a link: where to look next. */
function CheckInbox({ to, lead }: { to: string; lead: string }) {
  return (
    <div role="status" className="grid gap-2 rounded-lg border border-quant/30 bg-quant/5 p-4 text-sm">
      <p className="font-semibold text-ink">Check your inbox</p>
      <p className="text-ink/90">
        {lead} <span className="font-semibold">{to}</span>. Open it within 30 minutes on this or any device.
      </p>
      <p className="text-xs text-muted">Nothing there after a minute? Look in Spam or Promotions.</p>
    </div>
  );
}

/**
 * Join form. With `email` (back from Google, address proven): enrols at once and
 * opens the portal. Without: the visitor types their email and we mail a link
 * that confirms it first. `courses` = published courses with their sittings;
 * `packages` = the live packages. `picked` (on /pricing): course and package are
 * already chosen and go as hidden fields. Without it the form asks, starting from
 * the pick saved on /pricing (after the Google round trip, for one).
 */
export function JoinForm({ courses, packages, email, picked }: { courses: PricingCourse[]; packages: Package[]; email?: string; picked?: CartPick }) {
  const router = useRouter();
  // What they picked on /pricing (read after hydration), until they change it here.
  const saved = Cart.parse(useSyncExternalStore(Cart.subscribe, Cart.snapshot, () => null));
  const [ownCourse, setCourse] = useState<string | null>(null);
  const [ownPackage, setPackageId] = useState<string | null>(null);
  const course = picked?.course ?? ownCourse ?? saved?.course ?? "";
  const packageId = picked?.packageId ?? ownPackage ?? saved?.packageId ?? "";
  const [state, setState] = useState<FormState>({ kind: "editing" });

  const sittings = courses.find((c) => c.title === course)?.sittings ?? [];
  const offered = PackageTable.forCourse(packages, sittings.length > 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = fieldsOf(event.currentTarget);
    setState({ kind: "sending" });
    try {
      if (!email) {
        await client.emailLink({ ...fields, intent: "register" });
        setState({ kind: "sent", to: fields.email });
        return;
      }
      await client.join(fields);
      Cart.clear();
      // The session cookie is set: /student now renders the signed-in portal.
      router.replace("/student");
      router.refresh();
    } catch (error) {
      setState({ kind: "editing", error: messageOf(error) });
    }
  }

  if (state.kind === "sent") return <CheckInbox to={state.to} lead="We sent a link to confirm your email to" />;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset disabled={state.kind === "sending"} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className={LABEL}>Full name</span>
          <input name="name" required autoComplete="name" minLength={LIMITS.name[0]} maxLength={LIMITS.name[1]} className={FIELD} />
        </label>
        {email ? (
          <div className="grid gap-1.5">
            <span className={LABEL}>Google account</span>
            <p className="flex items-center gap-2 rounded-md border border-quant/30 bg-quant/5 px-3 py-2.5 text-sm text-ink">
              <span aria-hidden className="text-quant">✓</span>
              {email}
            </p>
          </div>
        ) : (
          <label className="grid gap-1.5">
            <span className={LABEL}>Email</span>
            <input name="email" type="email" required autoComplete="email" maxLength={LIMITS.email} className={FIELD} />
          </label>
        )}
        <label className="grid gap-1.5">
          <span className={LABEL}>Mobile (WhatsApp)</span>
          <input name="phone" type="tel" required autoComplete="tel" maxLength={LIMITS.phone[1]} placeholder="+971 50 123 4567" className={FIELD} />
        </label>
        {picked ? (
          <>
            <input type="hidden" name="course" value={picked.course} />
            <input type="hidden" name="package" value={picked.packageId} />
          </>
        ) : (
          <label className="grid gap-1.5">
            <span className={LABEL}>Course</span>
            <select name="course" required value={course} onChange={(e) => setCourse(e.target.value)} className={FIELD}>
              <option value="" disabled>
                Choose a course
              </option>
              <optgroup label="Exam courses">
                {courses.map((c) => (
                  <option key={c.title} value={c.title}>
                    {c.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Consultancy">
                {EXTRA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Anything else">
                <option value={OTHER}>School, university or other subject</option>
              </optgroup>
            </select>
          </label>
        )}
        {sittings.length > 0 && (
          <label className="grid gap-1.5">
            <span className={LABEL}>Exam sitting (your batch)</span>
            <select key={course} name="batch" required defaultValue="" className={FIELD}>
              <option value="" disabled>
                Which exam are you taking?
              </option>
              {sittings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value={Batches.NOT_SURE}>{Batches.NOT_SURE}</option>
            </select>
          </label>
        )}
        {course === OTHER && (
          <label className="grid gap-1.5">
            <span className={LABEL}>What would you like to study?</span>
            <input name="topic" required minLength={LIMITS.topic[0]} maxLength={LIMITS.topic[1]} placeholder="e.g. AP Statistics, corporate finance" className={FIELD} />
          </label>
        )}
        {!picked && course && offered.length > 0 && (
          <fieldset className="grid gap-1.5">
            <legend className={`${LABEL} mb-1.5`}>Package</legend>
            <div className="grid gap-2">
              {offered.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-line p-3 transition-colors has-[:checked]:border-quant/70 has-[:checked]:bg-quant/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-quant/60"
                >
                  <input
                    type="radio"
                    name="package"
                    value={p.id}
                    required
                    checked={packageId === p.id}
                    onChange={() => setPackageId(p.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-quant)]"
                  />
                  <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="text-muted tabular-nums">
                      {PackageTable.isCustom(p) ? PackageTable.price(p) : `${PackageTable.hours(p)}, ${PackageTable.price(p)}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <a href="/pricing" className="text-xs text-quant underline-offset-2 hover:underline">
              Compare packages
            </a>
          </fieldset>
        )}
        <label className="flex items-start gap-2.5 text-sm text-ink/90">
          <input name="acceptTerms" type="checkbox" value="yes" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-quant)]" />
          <span>
            I accept the{" "}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-quant underline-offset-2 hover:underline">
              terms and conditions
            </a>
            {offered.some((p) => p.id === packageId && !PackageTable.isCustom(p)) && ", and this package as my agreement"}.
          </span>
        </label>
        {/* Honeypot: hidden from people, filled by bots. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      </fieldset>
      {state.kind === "editing" && state.error && (
        <p role="alert" className="text-sm text-gold">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="inline-flex h-11 items-center justify-center rounded-md bg-gold px-6 text-sm font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-50"
      >
        {email ? (state.kind === "sending" ? "Opening your portal…" : "Join and open my portal") : state.kind === "sending" ? "Sending…" : "Register"}
      </button>
      <p className="text-xs text-muted">We only use these details to arrange your lessons, and message you on WhatsApp to confirm.</p>
    </form>
  );
}

/** Sign-in for students without a Google account: we email a link if the address is a student's. */
export function EmailSignIn() {
  const [state, setState] = useState<FormState>({ kind: "editing" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = fieldsOf(event.currentTarget);
    setState({ kind: "sending" });
    try {
      await client.emailLink({ ...fields, intent: "signin" });
      setState({ kind: "sent", to: fields.email });
    } catch (error) {
      setState({ kind: "editing", error: messageOf(error) });
    }
  }

  if (state.kind === "sent") return <CheckInbox to={state.to} lead="If you're registered, a sign-in link is on its way to" />;

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor="signin-email" className={LABEL}>
        No Google account? Sign in by email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="signin-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={LIMITS.email}
          placeholder="you@example.com"
          disabled={state.kind === "sending"}
          className={FIELD}
        />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="h-10 shrink-0 rounded-md border border-quant/50 px-4 text-sm font-semibold text-quant transition-colors hover:bg-quant/10 disabled:opacity-50"
        >
          {state.kind === "sending" ? "Sending…" : "Email me a link"}
        </button>
      </div>
      {state.kind === "editing" && state.error && (
        <p role="alert" className="text-sm text-gold">
          {state.error}
        </p>
      )}
    </form>
  );
}
