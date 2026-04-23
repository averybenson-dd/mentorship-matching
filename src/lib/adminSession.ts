import { ADMIN_PASSWORD } from "../constants";

const SESSION_FLAG = "dxlx-mentorship-admin";
const SESSION_PWD = "dxlx-mentorship-admin-pwd";

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_FLAG) === "1";
}

export function loginAdmin(password: string): boolean {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_FLAG, "1");
    sessionStorage.setItem(SESSION_PWD, password);
    return true;
  }
  return false;
}

/** Used for Supabase Edge calls — cleared on logout. */
export function getAdminPassword(): string | null {
  return sessionStorage.getItem(SESSION_PWD);
}

export function logoutAdmin() {
  sessionStorage.removeItem(SESSION_FLAG);
  sessionStorage.removeItem(SESSION_PWD);
}
