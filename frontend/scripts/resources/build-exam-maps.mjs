// Builds the free Exam Map PDFs in public/resources from the data below.
//   node scripts/resources/build-exam-maps.mjs
// Needs a Chrome binary: CHROME=/path/to/chrome, or Playwright's headless shell in its default cache.
// Weights mirror the course modules in the database; facts mirror ExamFacts.ts. Update both together.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const LOGO = `file://${join(ROOT, "public/brand/fip-logo.png")}`;
const SITE = "financeinpractice.me";
const WHATSAPP = { label: "+971 58 807 0565", href: "https://wa.me/971588070565" };

const CFA_TM =
  "CFA® and Chartered Financial Analyst® are registered trademarks owned by CFA Institute. CFA Institute does not endorse, promote or warrant the accuracy or quality of the services offered by Finance in Practice.";
const FRM_TM =
  "FRM® and Financial Risk Manager® are trademarks owned by the Global Association of Risk Professionals (GARP). GARP does not endorse, promote, review or warrant the accuracy of the services offered by Finance in Practice.";

const MAPS = [
  {
    file: "cfa-level-i-exam-map.pdf",
    exam: "CFA® Level I",
    sub: "Where the marks are, how the exam works, and a 12-week route to exam day.",
    facts: [
      ["180", "multiple-choice questions"],
      ["2 × 135", "minutes, two sessions"],
      ["300+", "study hours reported by passing candidates"],
      ["43%", "pass rate, Aug 2026 (CFA Institute)"],
    ],
    weightSource: "CFA Institute 2027 topic outline",
    weights: [
      ["Ethical and Professional Standards", "10-15%", true],
      ["Quantitative Methods", "11-14%", true],
      ["Financial Statement Analysis", "11-14%", true],
      ["Equities", "11-14%", true],
      ["Fixed Income", "11-14%", true],
      ["Portfolio Construction", "8-12%"],
      ["Derivatives and Risk Management", "6-9%"],
      ["Economics", "6-9%"],
      ["Alternative Investments", "6-9%"],
      ["Corporate Finance", "6-9%"],
    ],
    callout: [
      "The five gold topics are about 55–70% of the exam.",
      "Ethics, Quant, FSA, Equities and Fixed Income decide most results. Master them first, then build the rest around them.",
    ],
    windows: "Level I runs in February, May, August and November. Check dates and fees at cfainstitute.org.",
    pace: "About 25 hours a week. Studying 15 hours a week? Stretch the same order over 20 weeks.",
    plan: [
      ["Wk 1–2", "Quantitative Methods + Economics", "The toolkit: time value, statistics, rates."],
      ["Wk 3–4", "Financial Statement Analysis", "Biggest reading load. Start early."],
      ["Wk 5", "Corporate Finance", "Short; builds on FSA."],
      ["Wk 6–7", "Equities", "Valuation models and market structure."],
      ["Wk 8–9", "Fixed Income", "Pricing, yield, duration. Practise daily."],
      ["Wk 10", "Derivatives + Alternative Investments", "Payoffs and how each asset behaves."],
      ["Wk 11", "Portfolio Construction + Ethics", "Ethics last, so it is fresh on exam day."],
      ["Wk 12", "Mock exams + review", "Two full mocks. Fix the error pattern, not just the question."],
    ],
    rules: [
      ["About 90 seconds per question.", "Flag anything over two minutes and come back."],
      ["No penalty for wrong answers.", "Never leave a question blank."],
      ["Formulas are not given.", "Know them well enough to rebuild them, not just recite them."],
      ["Mocks under exam timing", "in the last two weeks show your real pace."],
    ],
    trademark: CFA_TM,
  },
  {
    file: "cfa-level-ii-exam-map.pdf",
    exam: "CFA® Level II",
    sub: "Where the marks are, how item sets work, and a 12-week route to exam day.",
    facts: [
      ["22", "item sets (a case plus four questions)"],
      ["88", "multiple-choice questions"],
      ["2 × 132", "minutes, two sessions"],
      ["300+", "study hours reported by passing candidates"],
    ],
    weightSource: "CFA Institute 2027 topic outline",
    weights: [
      ["Ethical and Professional Standards", "10-15%", true],
      ["Equities", "10-15%", true],
      ["Financial Statement Analysis", "10-15%", true],
      ["Fixed Income", "10-15%", true],
      ["Portfolio Construction", "10-15%", true],
      ["Quantitative Methods", "5-10%"],
      ["Economics", "5-10%"],
      ["Corporate Finance", "5-10%"],
      ["Derivatives", "5-10%"],
      ["Alternative Investments", "5-10%"],
    ],
    callout: [
      "The five gold topics are 50–75% of the exam.",
      "Level II is about applying models to a case. Equity and fixed income valuation, FSA and ethics carry the result.",
    ],
    windows: "Level II runs in May, August and November. Check dates and fees at cfainstitute.org.",
    pace: "About 25 hours a week. Studying 15 hours a week? Stretch the same order over 20 weeks.",
    plan: [
      ["Wk 1", "Quantitative Methods + Economics", "Regression output and currency parity: read them, don't derive them."],
      ["Wk 2–3", "Financial Statement Analysis", "Intercorporate investments, multinationals, earnings quality."],
      ["Wk 4", "Corporate Finance", "Capital structure, dividends, ESG and restructuring."],
      ["Wk 5–6", "Equities", "DCF, residual income and multiples. Heaviest valuation block."],
      ["Wk 7–8", "Fixed Income", "Term structure, arbitrage-free trees, credit analysis."],
      ["Wk 9", "Derivatives + Alternative Investments", "Pricing forwards, swaps and options; real estate and private capital."],
      ["Wk 10–11", "Portfolio Construction + Ethics", "Ethics last, so it is fresh on exam day."],
      ["Wk 12", "Mock exams + review", "Full item-set mocks under time. Fix the error pattern."],
    ],
    rules: [
      ["About 3 minutes per question.", "Each item set should take about 12 minutes."],
      ["Read the questions before the case.", "Then read the vignette knowing what to look for."],
      ["Cases include data you don't need.", "Spotting the right number is half the question."],
      ["No penalty for wrong answers.", "Never leave a question blank."],
    ],
    trademark: CFA_TM,
  },
  {
    file: "frm-part-i-exam-map.pdf",
    exam: "FRM® Part I",
    sub: "Where the marks are, how the exam works, and a 12-week route to exam day.",
    facts: [
      ["100", "multiple-choice questions"],
      ["4h", "one session"],
      ["240", "study hours, a typical target"],
      ["47%", "pass rate, Nov 2025 (GARP)"],
    ],
    weightSource: "GARP 2026 FRM Part I study guide",
    weights: [
      ["Valuation and Risk Models", "30%", true],
      ["Financial Markets and Products", "30%", true],
      ["Quantitative Analysis", "20%"],
      ["Foundations of Risk Management", "20%"],
    ],
    callout: [
      "The two gold topics are 60% of the exam.",
      "Valuation and Risk Models and Financial Markets and Products decide most results. Quant is the toolkit both of them use.",
    ],
    covers: [
      ["Valuation and Risk Models", "Measure market, credit and operational risk, and value the instruments behind it: VaR, bond and option pricing, stress testing."],
      ["Financial Markets and Products", "How banks, funds and derivatives markets work, and how each product transfers risk."],
      ["Quantitative Analysis", "Probability, regression and time-series tools used to model risk."],
      ["Foundations of Risk Management", "How firms govern risk, CAPM and performance measures, and what went wrong in the classic failures."],
    ],
    windows: "FRM Part I runs in May, August and November. Check dates and fees at garp.org.",
    pace: "About 20 hours a week. Studying 12 hours a week? Stretch the same order over 20 weeks.",
    plan: [
      ["Wk 1–2", "Foundations of Risk Management", "Governance, CAPM and the classic failures. Sets the vocabulary."],
      ["Wk 3–5", "Quantitative Analysis", "Probability, regression, time series, simulation."],
      ["Wk 6–8", "Financial Markets and Products", "Banks, futures, forwards, swaps, options, MBS."],
      ["Wk 9–11", "Valuation and Risk Models", "VaR, bond and option pricing, credit and operational risk."],
      ["Wk 12", "Mock exams + review", "Two full mocks under time. Fix the error pattern."],
    ],
    rules: [
      ["About 2.4 minutes per question.", "Flag anything over three minutes and come back."],
      ["No penalty for wrong answers.", "Never leave a question blank."],
      ["Approved calculators only.", "TI BA II Plus or HP 12C models: practise on the one you will use."],
      ["Formulas are not given.", "Know them well enough to rebuild them."],
    ],
    trademark: FRM_TM,
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mid = (w) => {
  const n = w.match(/\d+(?:\.\d+)?/g).map(Number);
  return n.length === 1 ? n[0] : (n[0] + n[1]) / 2;
};

const CSS = `
@page { size: A4; margin: 0 }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
body { margin:0; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color:#0f172a }
.page { width:210mm; height:297mm; padding:30mm 16mm 22mm; position:relative; page-break-after: always; overflow:hidden }
.page:last-child { page-break-after: auto }
.head { position:absolute; inset:0 0 auto; height:18mm; background:#0b1120; display:flex; align-items:center; justify-content:space-between; padding:0 16mm; border-bottom:.8mm solid #d4af37 }
.head img { height:8.5mm }
.head span { font: 600 7.5pt/1 Menlo, monospace; letter-spacing:.18em; color:#94a3b8; text-transform:uppercase }
.foot { position:absolute; left:16mm; right:16mm; bottom:8mm; display:flex; justify-content:space-between; border-top:1px solid #e2e8f0; padding-top:2.5mm; font-size:7.5pt; color:#64748b }
.foot a { color:#0e7490; text-decoration:none }
.eyebrow { font: 600 9pt/1 Menlo, monospace; letter-spacing:.2em; color:#0e7490; text-transform:uppercase }
h1 { font: 700 28pt/1.1 Georgia, serif; margin:3mm 0 2mm }
h1 em { color:#b8921f; font-style:italic }
.sub { color:#475569; font-size:11pt; margin:0 }
h2 { font: 700 15pt/1.2 Georgia, serif; margin:9mm 0 3mm }
.facts { display:flex; gap:4mm; margin-top:7mm }
.fact { flex:1; border:1px solid #e2e8f0; border-top:1mm solid #22d3ee; border-radius:2mm; padding:4mm }
.fact b { display:block; font: 700 19pt/1 Menlo, monospace }
.fact span { display:block; margin-top:1.5mm; font-size:8.5pt; color:#64748b }
table { width:100%; border-collapse:collapse }
.weights td { padding:2.2mm 0; font-size:10pt; vertical-align:middle; border-bottom:1px solid #f1f5f9 }
.weights .t { width:64mm }
.weights .w { width:18mm; text-align:right; font-family:Menlo,monospace; font-size:9pt }
.weights .bar span { display:block; height:4mm; border-radius:1mm; background:#67b7c9 }
.weights .bar span.hi { background:#d4af37 }
.legend { font-size:8.5pt; color:#64748b; margin-top:2mm }
.legend i { display:inline-block; width:3mm; height:3mm; background:#d4af37; border-radius:.6mm; vertical-align:-.4mm; margin:0 1mm 0 0 }
.callout { margin-top:6mm; border-left:1.2mm solid #d4af37; background:#fdf8e8; padding:4mm 5mm; font-size:10.5pt; line-height:1.45 }
.note { margin-top:5mm; font-size:9pt; color:#475569 }
.plan td { padding:2.6mm 0; border-bottom:1px solid #f1f5f9; font-size:10pt; vertical-align:top }
.plan .wk { width:22mm; font: 700 9pt Menlo, monospace; color:#0e7490 }
.plan span { color:#64748b; font-size:9pt }
ul { margin:0; padding-left:5mm; font-size:10pt; line-height:1.55 }
.cta { margin-top:7mm; background:#0b1120; color:#f8fafc; border-radius:3mm; padding:6mm 7mm }
.cta b { font: 700 15pt Georgia, serif; color:#d4af37 }
.cta p { margin:2mm 0 0; font-size:10pt; color:#cbd5e1 }
.cta a { color:#22d3ee; text-decoration:none }
.disclaimer { position:absolute; left:16mm; right:16mm; bottom:18mm; font-size:7pt; color:#94a3b8; line-height:1.45 }
`;

function page(map, n, total, body, last = false) {
  return `<section class="page">
  <div class="head"><img src="${LOGO}" alt="Finance in Practice"><span>Free guide · ${esc(map.exam)} Exam Map</span></div>
  ${body}
  ${last ? `<p class="disclaimer">For educational purposes only. Finance in Practice does not provide financial, investment or regulated advisory services. ${esc(map.trademark)}</p>` : ""}
  <div class="foot"><span><a href="https://${SITE}">${SITE}</a> · WhatsApp <a href="${WHATSAPP.href}">${WHATSAPP.label}</a></span><span>Page ${n} of ${total}</span></div>
</section>`;
}

function html(map) {
  const top = Math.max(...map.weights.map(([, w]) => mid(w)));
  const weights = map.weights
    .map(([t, w, hi]) => `<tr><td class="t">${esc(t)}</td><td class="bar"><span class="${hi ? "hi" : ""}" style="width:${Math.round((mid(w) / top) * 100)}%"></span></td><td class="w">${w}</td></tr>`)
    .join("");
  const first = `
  <div class="eyebrow">Finance in Practice · Free guide</div>
  <h1>${esc(map.exam).replace("®", '<sup style="font-size:.45em">®</sup>')} <em>Exam Map</em></h1>
  <p class="sub">${esc(map.sub)}</p>
  <div class="facts">${map.facts.map(([v, l]) => `<div class="fact"><b>${v}</b><span>${esc(l)}</span></div>`).join("")}</div>
  <h2>Where the marks are</h2>
  <table class="weights">${weights}</table>
  <p class="legend"><i></i>High priority: the heaviest topics. Weights: ${esc(map.weightSource)}.</p>
  <div class="callout"><b>${esc(map.callout[0])}</b> ${esc(map.callout[1])}</div>
  ${map.covers ? `<h2>What each topic covers</h2><ul>${map.covers.map(([t, d]) => `<li><b>${esc(t)}.</b> ${esc(d)}</li>`).join("")}</ul>` : ""}
  <p class="note"><b>Exam windows:</b> ${esc(map.windows)}</p>`;
  const second = `
  <div class="eyebrow">12-week route</div>
  <h2 style="margin-top:3mm">A plan that follows how topics build on each other</h2>
  <p style="font-size:10pt;color:#475569;margin:0 0 3mm">${esc(map.pace)}</p>
  <table class="plan">${map.plan.map(([wk, t, s]) => `<tr><td class="wk">${wk}</td><td><b>${esc(t)}</b><br><span>${esc(s)}</span></td></tr>`).join("")}</table>
  <h2>Exam-day rules worth knowing</h2>
  <ul>${map.rules.map(([b, r]) => `<li><b>${esc(b)}</b> ${esc(r)}</li>`).join("")}</ul>
  <div class="cta">
    <b>Want this plan built around your exam date?</b>
    <p>Book a free 30-minute diagnostic session. We find your weak topics and map your route to exam day. At your home in Abu Dhabi or live online.</p>
    <p><a href="https://${SITE}/#book">${SITE}/#book</a> &nbsp;·&nbsp; WhatsApp <a href="${WHATSAPP.href}">${WHATSAPP.label}</a></p>
  </div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(map.exam)} Exam Map</title><style>${CSS}</style></head><body>
${page(map, 1, 2, first)}
${page(map, 2, 2, second, true)}
</body></html>`;
}

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  const shell = readdirSync(cache).find((d) => d.startsWith("chromium_headless_shell-"));
  if (!shell) throw new Error("No Chrome found: set CHROME=/path/to/chrome");
  return join(cache, shell, "chrome-headless-shell-mac-x64/chrome-headless-shell");
}

const bin = chrome();
const work = mkdtempSync(join(tmpdir(), "exam-maps-"));
for (const map of MAPS) {
  const src = join(work, map.file.replace(".pdf", ".html"));
  writeFileSync(src, html(map));
  const out = join(ROOT, "public/resources", map.file);
  execFileSync(bin, ["--headless", "--no-pdf-header-footer", "--allow-file-access-from-files", `--print-to-pdf=${out}`, `file://${src}`], { stdio: "ignore" });
  console.log("wrote", out);
}
