"use server";

import { refresh, revalidatePath } from "next/cache";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { VideoRepository } from "../server/VideoRepository";
import { YouTubeLink } from "../services/YouTubeLink";

export type VideoActionState = { ok: boolean; message: string } | null;

function videos(): VideoRepository {
  const repo = VideoRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** Adds a YouTube video to /resources from any YouTube link. */
export async function addVideo(_prev: VideoActionState, form: FormData): Promise<VideoActionState> {
  await AdminAuth.require();
  const id = YouTubeLink.id(String(form.get("link") ?? ""));
  const title = String(form.get("title") ?? "").trim().replace(/\s+/g, " ");
  if (!id) return { ok: false, message: "That isn't a YouTube video link. Copy it from YouTube's Share button." };
  if (!title || title.length > 120) return { ok: false, message: "Give the video a title (up to 120 characters)." };
  const added = await videos().add(id, title);
  revalidatePath("/resources");
  refresh();
  return added ? { ok: true, message: "Added. It's on the Resources page now." } : { ok: false, message: "That video is already on the list." };
}

export async function removeVideo(form: FormData): Promise<void> {
  await AdminAuth.require();
  await videos().remove(String(form.get("id")));
  revalidatePath("/resources");
  refresh();
}
