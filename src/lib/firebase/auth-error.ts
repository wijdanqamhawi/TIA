import type { FirebaseError } from "firebase/app";

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailInUse"
  | "weakPassword"
  | "invalidEmail"
  | "tooManyRequests"
  | "generic";

/**
 * Maps a Firebase Auth client-SDK error code to a translation key under
 * the `Auth.errors` namespace, never surfacing the raw Firebase error
 * message to the user.
 */
export function mapAuthErrorToKey(error: unknown): AuthErrorKey {
  const code = (error as FirebaseError)?.code;

  switch (code) {
    case "auth/invalid-email":
      return "invalidEmail";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "invalidCredentials";
    case "auth/email-already-in-use":
      return "emailInUse";
    case "auth/weak-password":
      return "weakPassword";
    case "auth/too-many-requests":
      return "tooManyRequests";
    default:
      return "generic";
  }
}
