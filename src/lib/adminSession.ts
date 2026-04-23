import { ADMIN_PASSWORD } from "../constants";

const SESSION_KEY = "dxlx-mentorship-admin";

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function loginAdmin(password: string): boolean {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  }
  return false;
}

export function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
}
