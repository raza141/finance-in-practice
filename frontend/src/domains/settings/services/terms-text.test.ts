import { describe, expect, it } from "vitest";

import { TermsText } from "./TermsText";

describe("TermsText", () => {
  it("splits sections, paragraphs and lists", () => {
    expect(TermsText.parse("## Payment\nDue by the date\non your invoice.\n\n- One\n- Two\n\n## Law\nAbu Dhabi.")).toEqual([
      { heading: "Payment", blocks: [{ kind: "p", text: "Due by the date on your invoice." }, { kind: "ul", items: ["One", "Two"] }] },
      { heading: "Law", blocks: [{ kind: "p", text: "Abu Dhabi." }] },
    ]);
  });

  it("publishes the starting draft as is, and refuses text without sections or bodies", () => {
    expect(TermsText.check(TermsText.draft())).toBeNull();
    expect(TermsText.check("Just one long paragraph without any heading at all, which is not enough.")).not.toBeNull();
    expect(TermsText.check("## Empty\n\n## Also empty and long enough to pass the length check okay")).not.toBeNull();
    expect(TermsText.check("## Short\nx")).not.toBeNull();
  });
});
