import { ButtonLink } from "@/core/components/ui/ButtonLink";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-28 text-center">
      <p className="font-mono text-sm text-quant">HTTP 404 · p &lt; 0.05</p>
      <h1 className="mt-4 text-4xl font-black">This page is an outlier</h1>
      <p className="mt-4 text-muted">
        The page you are looking for does not exist or has moved.
      </p>
      <div className="mt-8">
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </section>
  );
}
