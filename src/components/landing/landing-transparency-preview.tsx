const ROWS = [
  {
    meci: "Sepsi vs Metaloglobus",
    cota: "@3,76",
    conf: "85%",
    status: "won" as const,
  },
  {
    meci: "Voluntari vs UTA",
    cota: "@2,94",
    conf: "73%",
    status: "lost" as const,
  },
  {
    meci: "Oțelul vs U. Cluj",
    cota: "@3,22",
    conf: "80%",
    status: "won" as const,
  },
  {
    meci: "Dinamo vs Hermannstadt",
    cota: "@4,95",
    conf: "68%",
    status: "pending" as const,
  },
];

export function LandingTransparencyPreview() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border/55 bg-elevated/40">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Exemplu de istoric recent cu statusuri și cote - ilustrativ pentru transparență
        </caption>
        <thead>
          <tr className="border-b border-border/50 bg-muted/35 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            <th className="px-4 py-3.5 font-medium md:px-6">Meci</th>
            <th className="hidden w-[88px] px-2 py-3.5 font-medium sm:table-cell md:px-3">Cotă</th>
            <th className="hidden w-[72px] px-2 py-3.5 font-medium md:table-cell md:px-3">Încredere</th>
            <th className="w-[100px] px-4 py-3.5 font-medium md:px-6">Status</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.meci} className="border-b border-border/35 last:border-0">
              <td className="px-4 py-3.5 font-medium text-foreground md:px-6">{r.meci}</td>
              <td className="hidden tabular-nums text-foreground-secondary sm:table-cell md:px-3">{r.cota}</td>
              <td className="hidden tabular-nums text-foreground-secondary md:table-cell md:px-3">{r.conf}</td>
              <td className="px-4 py-3.5 md:px-6">
                <span
                  className={
                    r.status === "won"
                      ? "rounded-md bg-success/14 px-2 py-1 text-[12px] font-semibold text-success"
                      : r.status === "lost"
                        ? "rounded-md bg-destructive/14 px-2 py-1 text-[12px] font-semibold text-destructive"
                        : "rounded-md bg-muted/60 px-2 py-1 text-[12px] font-medium text-foreground-muted"
                  }
                >
                  {r.status === "won" ? "Câștig" : r.status === "lost" ? "Pierdere" : "În evaluare"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border/45 px-4 py-3 text-[11px] leading-snug text-foreground-muted md:px-6">
        Rânduri demonstrative - în aplicație, fiecare predicție salvată rămâne adresabilă din Istoric după rezolvare.
      </p>
    </div>
  );
}
