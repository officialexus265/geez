/**
 * Biometric unlock (Fingerprint / Face ID) for the Capacitor APK.
 * Uses Function-based dynamic import so TypeScript does not require
 * the native package at Vercel build time.
 */

const FLAG = "geez-biometrics-enabled";

async function loadNativeBiometric(): Promise<any | null> {
  try {
    // Avoid static analysis: do not use a string literal import path TS can resolve
    const importer = new Function(
      "return import('@capgo/capacitor-native-biometric')"
    ) as () => Promise<any>;
    const mod = await importer();
    return mod?.NativeBiometric ?? null;
  } catch {
    return null;
  }
}

export async function isNative(): Promise<boolean> {
  try {
    const importer = new Function(
      "return import('@capacitor/core')"
    ) as () => Promise<any>;
    const mod = await importer();
    return !!mod?.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export async function canUseBiometrics(): Promise<boolean> {
  if (!(await isNative())) return false;
  try {
    const NativeBiometric = await loadNativeBiometric();
    if (!NativeBiometric?.isAvailable) return false;
    const result = await NativeBiometric.isAvailable();
    return !!result?.isAvailable;
  } catch {
    return false;
  }
}

export async function promptBiometrics(
  reason = "Unlock GEEZ"
): Promise<boolean> {
  try {
    const NativeBiometric = await loadNativeBiometric();
    if (!NativeBiometric?.verifyIdentity) return false;
    await NativeBiometric.verifyIdentity({
      reason,
      title: "GEEZ",
      subtitle: "Confirm it's you",
      description: reason,
    });
    return true;
  } catch {
    return false;
  }
}

export function isBiometricsEnabled(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function setBiometricsEnabled(on: boolean) {
  try {
    localStorage.setItem(FLAG, on ? "1" : "0");
  } catch {
    // ignore
  }
}
