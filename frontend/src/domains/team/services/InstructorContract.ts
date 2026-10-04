/** What the admin instructor form saves. Mirrors the columns of 007_instructors. */
export interface InstructorInput {
  name: string;
  role: string;
  bio: string;
  background: string;
  education: string[];
  highlights: string[];
  photo: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type InstructorField = keyof InstructorInput;
export type InstructorFieldErrors = Partial<Record<InstructorField, string>>;
export type InstructorParseResult = { ok: true; input: InstructorInput } | { ok: false; errors: InstructorFieldErrors };

/**
 * Validation for the admin instructor form. The database CHECK constraints
 * enforce the same limits; checking here gives per-field messages.
 */
export class InstructorContract {
  static readonly LIMITS = {
    name: [2, 80],
    role: [2, 120],
    bio: [20, 1200],
    background: 800,
    education: [10, 160],
    highlights: [12, 40],
    photo: 500,
  } as const;

  private static readonly PHOTO = /^(\/team\/[A-Za-z0-9._-]+|https:\/\/\S+)$/;

  /** One entry per line; blank lines dropped. */
  static lines(raw: string): string[] {
    return raw.split("\n").map((line) => line.trim()).filter(Boolean);
  }

  /** Comma-separated chips; blanks dropped. */
  static chips(raw: string): string[] {
    return raw.split(",").map((chip) => chip.trim()).filter(Boolean);
  }

  static parse(fields: Record<string, unknown>): InstructorParseResult {
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const errors: InstructorFieldErrors = {};
    const { LIMITS } = InstructorContract;
    const between = (field: "name" | "role" | "bio", value: string) => {
      const [min, max] = LIMITS[field];
      if (value.length < min || value.length > max) errors[field] = `Use ${min}–${max} characters.`;
    };

    const name = text("name");
    between("name", name);
    const role = text("role");
    between("role", role);
    const bio = text("bio");
    between("bio", bio);

    const background = text("background");
    if (background.length > LIMITS.background) errors.background = `At most ${LIMITS.background} characters.`;

    const education = InstructorContract.lines(text("education"));
    if (education.length > LIMITS.education[0] || education.some((e) => e.length > LIMITS.education[1])) {
      errors.education = `At most ${LIMITS.education[0]} lines of ${LIMITS.education[1]} characters.`;
    }

    const highlights = InstructorContract.chips(text("highlights"));
    if (highlights.length > LIMITS.highlights[0] || highlights.some((h) => h.length > LIMITS.highlights[1])) {
      errors.highlights = `At most ${LIMITS.highlights[0]} tags of ${LIMITS.highlights[1]} characters.`;
    }

    const photo = text("photo");
    if (photo && (!InstructorContract.PHOTO.test(photo) || photo.length > LIMITS.photo)) {
      errors.photo = "Use an https:// image link or a file in public/team/, e.g. /team/raza.jpg.";
    }

    const sortRaw = text("sortOrder");
    const sortOrder = sortRaw === "" ? 0 : Number(sortRaw);
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 1000) errors.sortOrder = "Whole number, e.g. 1, 2, 3.";

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return {
      ok: true,
      input: {
        name,
        role,
        bio,
        background,
        education,
        highlights,
        photo: photo || null,
        sortOrder,
        isActive: fields.isActive === "on" || fields.isActive === "true",
      },
    };
  }
}
