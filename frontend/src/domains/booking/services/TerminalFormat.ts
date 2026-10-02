/** Locale-independent, terminal-style formatting (identical on server and client). */
export class TerminalFormat {
  private static readonly MONTHS = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  private static readonly WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  /** "2026-10-08" -> "OCT 08" */
  static date(isoDate: string): string {
    const [, month, day] = isoDate.split("-");
    return `${TerminalFormat.MONTHS[Number(month) - 1]} ${day}`;
  }

  /** "2026-10-08" -> "THU" */
  static weekday(isoDate: string): string {
    return TerminalFormat.WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
  }

  static slots(count: number): string {
    return `${count} ${count === 1 ? "SLOT" : "SLOTS"}`;
  }
}
