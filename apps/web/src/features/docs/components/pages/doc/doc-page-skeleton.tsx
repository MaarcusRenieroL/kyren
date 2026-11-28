/**
 * The frame the docs page shows while the editor bundle loads. It matches the
 * server-rendered loading state, so the switch is not a visible jump.
 */
export function DocPageSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] border-t">
      <main className="min-w-0 flex-1 bg-background">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-8 h-6 w-72 animate-pulse rounded-md bg-muted" />
          <div className="h-12 w-full max-w-2xl animate-pulse rounded-md bg-muted" />
          <div className="mt-10 h-80 animate-pulse rounded-md bg-muted" />
        </div>
      </main>
    </div>
  );
}
