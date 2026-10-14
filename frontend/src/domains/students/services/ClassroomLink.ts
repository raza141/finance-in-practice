/** A Google Classroom invite link, e.g. https://classroom.google.com/c/NzQ…?cjc=abc123. Pure; mirrors the 038 CHECK. */
export class ClassroomLink {
  static readonly MAX = 300;

  static isValid(value: string): boolean {
    if (value.length > ClassroomLink.MAX) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "classroom.google.com" && url.pathname.length > 1;
    } catch {
      return false;
    }
  }
}
