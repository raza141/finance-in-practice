/**
 * Print setup for a document page: only the document, full-bleed on A4, with
 * no site chrome and no browser margins or headers. The documents carry
 * tighter print spacing so a normal one fits one page at full size; nothing
 * is scaled (scaling just before printing is drawn differently by different
 * browsers and clipped the header). A very long document continues on page 2.
 */
const PRINT_CSS =
  "@media print{body>:not(main){display:none!important}html,body{background:#fff!important}main{padding-top:0!important}@page{size:A4;margin:0}}";

export function OnePagePrint() {
  return <style>{PRINT_CSS}</style>;
}
