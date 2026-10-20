"use client";

import { useEffect, useState } from "react";

/**
 * "Challenge a friend": WhatsApp and LinkedIn with the question link ready to send,
 * the phone's own share sheet where the browser has one, and a copy-link fallback.
 */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  const message = `Can you solve this CFA question? ${title}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the share sheet only exists in some browsers; checked after hydration
    setNative(typeof navigator.share === "function");
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const share = async () => {
    try {
      await navigator.share({ title, text: message, url });
    } catch {}
  };

  const button = "inline-flex h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors";
  return (
    <section
      aria-labelledby="challenge-friend"
      className="mt-10 rounded-2xl border border-gold/50 bg-gold/[0.07] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6"
    >
      <div>
        <h2 id="challenge-friend" className="font-sans text-lg font-semibold text-gold">
          Challenge a friend
        </h2>
        <p className="mt-1 text-sm text-muted">Send this question to someone studying for the CFA exam.</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${button} bg-[#25d366] text-[#06301a] hover:bg-[#3ee07a]`}
        >
          <WhatsAppIcon />
          WhatsApp
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${button} bg-[#0a66c2] text-white hover:bg-[#1877d6]`}
        >
          <LinkedInIcon />
          LinkedIn
        </a>
        {native && (
          <button type="button" onClick={share} className={`${button} bg-gold text-canvas hover:bg-gold-bright`}>
            Share
          </button>
        )}
        <button type="button" onClick={copy} className={`${button} border border-line font-normal text-ink/90 hover:border-gold/60`}>
          {copied ? "Link copied" : "Copy link"}
        </button>
        <span aria-live="polite" className="sr-only">
          {copied ? "Link copied" : ""}
        </span>
      </div>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6a3.7 3.7 0 0 1 3.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.3ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2ZM7.1 20.5H3.5V9h3.6v11.5ZM22.2 0H1.8A1.8 1.8 0 0 0 0 1.7v20.6A1.8 1.8 0 0 0 1.8 24h20.4a1.8 1.8 0 0 0 1.8-1.7V1.7A1.8 1.8 0 0 0 22.2 0Z" />
    </svg>
  );
}
