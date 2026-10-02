import { siteConfig } from "@/core/config/site";

export function CredentialsBar() {
  return (
    <section
      aria-label="Tutor credentials"
      data-sequence="credentials"
      className="border-y border-line bg-surface/60"
    >
      <ul className="tabular-data mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 py-6 text-sm sm:flex-row sm:gap-0 sm:divide-x sm:divide-line sm:px-6">
        {siteConfig.credentials.map((credential) => (
          <li
            key={credential}
            data-anim="credential"
            className="flex items-center gap-3 font-medium tracking-wide text-ink/90 sm:px-8"
          >
            <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-quant" />
            {credential}
          </li>
        ))}
      </ul>
    </section>
  );
}
