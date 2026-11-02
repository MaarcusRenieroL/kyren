/** True for a Postgres unique-constraint failure, however the driver wrapped it. */
export function isUniqueViolation(error: unknown) {
  const candidate = error as {
    code?: string;
    cause?: { code?: string };
  } | null;

  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}
