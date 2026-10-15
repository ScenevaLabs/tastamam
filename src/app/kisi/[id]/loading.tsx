export default function Loading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-8">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg border border-border bg-muted/40" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
      </div>
    </div>
  );
}
