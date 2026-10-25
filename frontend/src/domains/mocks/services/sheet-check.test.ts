import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { MockContract } from "./MockContract";

// Checks a question sheet with the importer's own rules, without uploading: SHEET=/path/to/file.csv npm run mocks:check
it.runIf(!!process.env.SHEET)("question sheet passes the upload check", () => {
  const sheet = MockContract.parseSheet(readFileSync(process.env.SHEET!, "utf8"));
  if (sheet.ok) {
    const topics = Object.entries(Object.groupBy(sheet.questions, (q) => q.topic)).map(([t, qs]) => `${t}: ${qs!.length}`);
    console.log(`OK: ${sheet.questions.length} questions\n${topics.join("\n")}`);
  } else console.log(sheet.errors.join("\n"));
  expect(sheet.ok ? [] : sheet.errors).toEqual([]);
});
