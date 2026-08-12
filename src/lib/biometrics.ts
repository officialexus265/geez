/**
 * Biometric unlock helpers (Fingerprint / Face ID).
 * Works in the Capacitor APK. On web, falls back gracefully.
 */

export async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function canUseBiometrics(): Promise<boolean> {
  if (!(await isNative())) return false;
  try {
    const { NativeBiometric } = await import(
      "@capgo/capacitor-native-biometric"
    );
    const result = await NativeBiometric.isAvailable();
    return !!result?.isAvailable;
  } catch {
    try {
      // alternate package name some projects use
      const mod = await import("@capacitor-community/biometric-auth");
      const BiometricAuth = (mod as any).BiometricAuth || (mod as any).default;
      const status = await BiometricAuth.checkBiometry();
      return !!status?.isAvailable;
    } catch {
      return false;
    }
  }
}

export async function promptBiometrics(
  reason = "Unlock GEEZ"
): Promise<boolean> {
  try {
    const { NativeBiometric } = await import(
      "@capgo/capacitor-native-biometric"
    );
    await NativeBiometric.verifyIdentity({
      reason,
      title: "GEEZ",
      subtitle: "Confirm it's you",
      description: reason,
    });
    return true;
  } catch {
    try {
      const mod = await import("@capacitor-community/biometric-auth");
      const BiometricAuth = (mod as any).BiometricAuth || (mod as any).default;
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: "Cancel",
        allowDeviceCredential: true,
      });
      return true;
    } catch {
      return false;
    }
  }
}

const FLAG = "geez-biometrics-enabled";

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
  } catch {}
}
