export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "finance",
  "support",
  "ops",
] as const;

export const OWNER_EMAILS = ["officialnexus265@gmail.com"];

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(
    String(role || "").trim().toLowerCase() as (typeof STAFF_ROLES)[number]
  );
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return OWNER_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function isStaffAccount(
  role: string | null | undefined,
  email: string | null | undefined
): boolean {
  return isStaffRole(role) || isOwnerEmail(email);
}

/** Member-only routes staff should not use */
export const MEMBER_ONLY_PREFIXES = [
  "/dashboard",
  "/deposit",
  "/withdraw",
  "/goals",
  "/history",
  "/loans",
  "/referrals",
  "/dual",
  "/receipt",
];

export function isMemberOnlyPath(pathname: string): boolean {
  return MEMBER_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}
