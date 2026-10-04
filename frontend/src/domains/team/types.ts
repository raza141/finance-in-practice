export interface Instructor {
  id: string;
  name: string;
  /** One-line role shown under the name, e.g. "Lead Instructor · CFA® & FRM®". */
  role: string;
  /** A file in /public/team/ or an https:// image URL. Falls back to a monogram when absent. */
  photo?: string;
  bio: string;
  education: readonly string[];
  background: string;
  /** Short credential / specialism chips. */
  highlights: readonly string[];
  links?: readonly { label: string; href: string }[];
  /** Lowest first on /about. */
  sortOrder: number;
  isActive: boolean;
}
