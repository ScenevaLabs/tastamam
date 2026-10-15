export default function Loading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/40" />
      </div>
    </div>
  );
}
