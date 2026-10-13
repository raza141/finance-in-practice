import "server-only";

import { GoogleOAuth } from "@/domains/admin/server/GoogleOAuth";

/** Student sign-in reuses the admin Google client with its own callback and state cookie. */
export class StudentOAuth {
  static readonly CALLBACK_PATH = "/api/student/auth/google/callback";
  static readonly STATE_COOKIE = "fip_student_oauth";
  static readonly COOKIE_PATH = "/api/student/auth/google";

  static client(origin: string): GoogleOAuth | null {
    return GoogleOAuth.fromEnv(origin, process.env, StudentOAuth.CALLBACK_PATH);
  }
}
