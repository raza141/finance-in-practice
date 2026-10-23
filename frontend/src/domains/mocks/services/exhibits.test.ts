import { describe, expect, it } from "vitest";

import { MockContract } from "./MockContract";
import { MockExhibits } from "./MockExhibits";

describe("MockExhibits.parse", () => {
  it("splits text, a titled table (rule row optional) and a chart, in order", () => {
    const text = [
      "Delta reports under IFRS.",
      "Exhibit 1: Delta Corp (AED m)",
      "| Item | 2025 | 2024 |",
      "|---|---:|---:|",
      "| Revenue | 840 | 790 |",
      "Using Exhibit 1 and the curve below:",
      "Chart: Spot rate curve",
      "| Maturity | Spot (%) |",
      "| 1 | 3.20 |",
      "| 2 | 3.65 |",
    ].join("\n");
    expect(MockExhibits.parse(text)).toEqual([
      { kind: "text", text: "Delta reports under IFRS." },
      { kind: "table", title: "Exhibit 1: Delta Corp (AED m)", header: ["Item", "2025", "2024"], rows: [["Revenue", "840", "790"]] },
      { kind: "text", text: "Using Exhibit 1 and the curve below:" },
      { kind: "chart", title: "Spot rate curve", header: ["Maturity", "Spot (%)"], rows: [["1", "3.20"], ["2", "3.65"]], csv: "Maturity,Spot (%)\n1,3.20\n2,3.65" },
    ]);
  });

  it("leaves text without rows alone, including a title-like line with nothing under it", () => {
    expect(MockExhibits.parse("Table: none here\nJust text.")).toEqual([{ kind: "text", text: "Table: none here\nJust text." }]);
  });

  it("reports ragged rows, a header with no rows and a chart that isn't numbers", () => {
    expect(MockExhibits.problems("| A | B |\n| 1 |", "Question")).toEqual(["Question table row 1 has 1 cells, the header has 2"]);
    expect(MockExhibits.problems("Table: T\n| A | B |", "Vignette")).toEqual(['Vignette table "T" has a header but no rows']);
    expect(MockExhibits.problems("Chart: Curve\n| Year | Rate |\n| 1 | x |\n| 2 | 3 |", "Question")[0]).toMatch(/^Question chart "Curve": Row 2/);
    expect(MockExhibits.problems("Amounts in $|x|$ terms", "Question")).toEqual([]);
  });
});

describe("MockContract.parseSheet with exhibits", () => {
  const HEADER = "Number\tTopic\tVignette\tQuestion\tOption_A\tOption_B\tOption_C\tCorrect_Option";

  it("keeps a table typed into one Excel cell (pasted: quoted, Alt+Enter line breaks)", () => {
    const cell = '"Exhibit 1: Spot rates\n| Year | Spot (%) |\n| 1 | 3.20 |\n| 2 | 3.65 |"';
    const sheet = MockContract.parseSheet(`${HEADER}\n1\tFixed Income\t${cell}\tThe 1y1y forward rate is closest to:\t4.10%\t4.25%\t4.40%\tA`);
    expect(sheet.ok && MockExhibits.parse(sheet.questions[0].vignette)[0]).toMatchObject({ kind: "table", rows: [["1", "3.20"], ["2", "3.65"]] });
  });

  it("refuses the upload when a table is broken, naming the row", () => {
    const sheet = MockContract.parseSheet(`${HEADER}\n1\tFSA\t"| A | B |\n| 1 |"\tQ?\tx\ty\tz\tA`);
    expect(sheet).toEqual({ ok: false, errors: ["Row 2: Vignette table row 1 has 1 cells, the header has 2."] });
  });
});
