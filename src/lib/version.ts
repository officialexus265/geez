/** Simple semver-ish compare: "1.0.2" > "1.0.1" */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export function isVersionBelow(current: string, minimum: string): boolean {
  if (!current || !minimum) return false;
  return compareVersions(current, minimum) < 0;
}

/** Web / default build version — bump when you ship a new APK */
export const APP_VERSION = "1.0.0";
