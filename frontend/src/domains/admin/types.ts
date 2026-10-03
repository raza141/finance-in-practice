/** A signed-in admin, as exposed to pages. Never carries the password hash. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  hasPassword: boolean;
  googleLinked: boolean;
}
