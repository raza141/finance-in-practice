export interface Instructor {
  id: string;
  name: string;
  /** One-line role shown under the name, e.g. "Lead Instructor · CFA® & FRM®". */
  role: string;
  /** Path under /public, e.g. "/team/raza.jpg". Falls back to a monogram when absent. */
  photo?: string;
  bio: string;
  education: readonly string[];
  background: string;
  /** Short credential / specialism chips. */
  highlights: readonly string[];
  links?: readonly { label: string; href: string }[];
  /** True while the profile still holds placeholder copy that must be replaced. */
  placeholder?: boolean;
}
