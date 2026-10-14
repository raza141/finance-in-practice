import type { Metadata } from "next";
import Link from "next/link";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { removeVideo } from "@/domains/resources/actions/videos";
import { VideoForm } from "@/domains/resources/components/VideoForm";
import { VideoRepository } from "@/domains/resources/server/VideoRepository";
import { YouTubeLink } from "@/domains/resources/services/YouTubeLink";

export const metadata: Metadata = { title: "Videos" };

/** YouTube videos on the public Resources page. Course-only videos belong in Google Classroom. */
export default async function AdminVideosPage() {
  await AdminAuth.require();
  const repo = VideoRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const videos = await repo.all();

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">Videos</h1>
        <Link href="/resources" className="text-sm text-quant hover:underline">
          Resources page ↗
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Upload to YouTube, then paste the link here: it shows on the Resources page straight away. Only a thumbnail loads until a
        visitor presses play, so videos don&rsquo;t slow the site. For students only, post the video in Google Classroom instead:
        &ldquo;Unlisted&rdquo; videos can still be watched by anyone who gets the link.
      </p>

      <div className="mt-8">
        <VideoForm />
      </div>

      {videos.length === 0 ? (
        <p className="mt-10 text-muted">No videos yet. The Videos section stays hidden on the site until you add one.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-lg border border-line">
          {videos.map((v) => (
            <li key={v.id} className="flex items-center gap-4 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              <img src={YouTubeLink.thumbnail(v.youtubeId)} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded object-cover" />
              <a href={`https://youtu.be/${v.youtubeId}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:text-quant">
                {v.title}
              </a>
              <form action={removeVideo}>
                <input type="hidden" name="id" value={v.id} />
                <PendingButton pendingLabel="Removing…" className="text-xs text-red-300/90 hover:underline">
                  Remove
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
