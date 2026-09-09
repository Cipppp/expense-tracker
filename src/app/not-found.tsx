import Link from "next/link";

/** 404 în limba aplicației, nu pagina implicită a framework-ului. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="eyebrow">404</div>
        <h1 className="font-display text-3xl">Pagina nu există</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Linkul e greșit sau pagina a fost mutată.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Înapoi la dashboard
        </Link>
      </div>
    </div>
  );
}
