/**
 * Adds someone to the admin allowlist (or updates their name/password).
 *
 *   npm run admin:add -- --email you@example.com --name "Your Name"
 *   npm run admin:add -- --email you@example.com --name "Your Name" --password
 *
 * Without --password the admin signs in with Google (an account using the
 * same email) and can set a password later under Admin → Account. With
 * --password you are prompted for one; it is never echoed or logged.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import { neon } from "@neondatabase/serverless";

import { PasswordHasher } from "../../src/domains/admin/server/PasswordHasher.ts";

class HiddenPrompt {
  /** Read one line from the terminal without echoing it. */
  static ask(question: string): Promise<string> {
    if (!process.stdin.isTTY) throw new Error("--password needs an interactive terminal");
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const writer = rl as unknown as { _writeToOutput: (text: string) => void };
    let muted = false;
    writer._writeToOutput = (text) => {
      if (!muted || text.includes("\n")) process.stdout.write(muted ? "\n" : text);
    };
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
      muted = true;
    });
  }
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase() ?? "";
const name = values.name?.trim() ?? "";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name) {
  console.error('Usage: npm run admin:add -- --email you@example.com --name "Your Name" [--password]');
  process.exit(1);
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to frontend/.env.local (see .env.example).");
  process.exit(1);
}

let passwordHash: string | null = null;
if (values.password) {
  const password = await HiddenPrompt.ask("Password: ");
  const weakness = PasswordHasher.weakness(password);
  if (weakness) {
    console.error(weakness);
    process.exit(1);
  }
  if ((await HiddenPrompt.ask("Confirm password: ")) !== password) {
    console.error("Passwords don't match.");
    process.exit(1);
  }
  passwordHash = await PasswordHasher.hash(password);
}

const sql = neon(url);
const [row] = (await sql`
  INSERT INTO admin_users (email, name, password_hash)
  VALUES (${email}, ${name}, ${passwordHash})
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        password_hash = COALESCE(EXCLUDED.password_hash, admin_users.password_hash),
        active = true
  RETURNING (xmax = 0) AS inserted
`) as { inserted: boolean }[];

console.log(
  `${row.inserted ? "Added" : "Updated"} admin ${email}` +
    (passwordHash ? " with a password." : ". They can sign in with Google using this email."),
);
