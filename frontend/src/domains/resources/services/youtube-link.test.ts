import { describe, expect, it } from "vitest";

import { YouTubeLink } from "./YouTubeLink";

describe("YouTubeLink", () => {
  it("reads the id from every common link shape", () => {
    const id = "dQw4w9WgXcQ";
    for (const link of [
      id,
      `https://www.youtube.com/watch?v=${id}&t=42s`,
      `https://youtu.be/${id}?si=abc`,
      `https://youtube.com/shorts/${id}`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
    ]) {
      expect(YouTubeLink.id(link)).toBe(id);
    }
  });

  it("refuses other sites and broken ids", () => {
    expect(YouTubeLink.id("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(YouTubeLink.id("https://vimeo.com/123")).toBeNull();
    expect(YouTubeLink.id("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(YouTubeLink.id("javascript:alert(1)")).toBeNull();
    expect(YouTubeLink.id("")).toBeNull();
  });
});
