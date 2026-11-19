import { toastError } from "@zentro/ui/index";

/**
 * Copies text, and says so when the browser refuses (no permission, or an
 * insecure page) instead of failing silently. Resolves to whether it worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    toastError(
      null,
      "Your browser blocked copying. Select the text and copy it instead.",
    );

    return false;
  }
}
