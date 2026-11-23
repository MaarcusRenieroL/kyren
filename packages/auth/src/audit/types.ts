export type HookContext = {
  path?: string;
  headers?: Headers;
  request?: Request;
  body?: unknown;
  context: {
    returned?: unknown;
    newSession?: { user: { id: string } } | null;
  };
};

/** The user a reset token belongs to, read before the token is consumed. */
export const resetTokenUsers = new WeakMap<Request, string>();

export function failed(returned: unknown) {
  return returned instanceof Error;
}
