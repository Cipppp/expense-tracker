export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-secondary rounded" />
        <div className="h-9 w-64 bg-secondary rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-card border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[360px] rounded-lg bg-card border border-border" />
        <div className="h-[360px] rounded-lg bg-card border border-border" />
      </div>
    </div>
  );
}
