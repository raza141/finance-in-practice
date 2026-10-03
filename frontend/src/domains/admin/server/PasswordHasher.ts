import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/**
 * scrypt password hashing. Hashes are self-describing,
 * `scrypt$<N>$<r>$<p>$<salt b64>$<key b64>`, so parameters can be raised
 * later without breaking existing passwords.
 */
export class PasswordHasher {
  static readonly MIN_LENGTH = 10;
  static readonly MAX_LENGTH = 200;

  private static readonly N = 16384;
  private static readonly R = 8;
  private static readonly P = 1;
  private static readonly KEY_LENGTH = 64;

  /** Verified against when the email is unknown, so timing doesn't reveal which emails exist. */
  private static dummy: Promise<string> | null = null;

  static async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const { N, R, P, KEY_LENGTH } = PasswordHasher;
    const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
    return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
  }

  static async verify(password: string, stored: string | null): Promise<boolean> {
    if (!stored) {
      PasswordHasher.dummy ??= PasswordHasher.hash("dummy-password-for-timing");
      await PasswordHasher.verify(password, await PasswordHasher.dummy);
      return false;
    }
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [N, r, p] = parts.slice(1, 4).map(Number);
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    const key = await scryptAsync(password, salt, expected.length, { N, r, p, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(key, expected);
  }

  /** Returns a reason when the password is unacceptable, else null. */
  static weakness(password: string): string | null {
    if (password.length < PasswordHasher.MIN_LENGTH) {
      return `Password must be at least ${PasswordHasher.MIN_LENGTH} characters.`;
    }
    if (password.length > PasswordHasher.MAX_LENGTH) {
      return `Password must be at most ${PasswordHasher.MAX_LENGTH} characters.`;
    }
    return null;
  }
}
