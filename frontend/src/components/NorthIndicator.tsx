export function NorthIndicator() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 select-none">
      <div className="rounded-lg border border-line bg-panel/90 px-3 py-2 backdrop-blur-sm">
        <svg width="72" height="88" viewBox="0 0 72 88" aria-label="Site north">
          <circle cx="36" cy="44" r="26" fill="#0c0e12" stroke="#2a3140" />
          <polygon points="36,16 42,44 36,40 30,44" fill="#e8a838" />
          <polygon points="36,72 42,44 36,48 30,44" fill="#2a3140" />
          <text x="36" y="14" textAnchor="middle" fill="#e8a838" fontSize="12" fontWeight="700">
            N
          </text>
          <text x="36" y="86" textAnchor="middle" fill="#8b93a7" fontSize="9">
            S
          </text>
          <text x="66" y="48" textAnchor="middle" fill="#8b93a7" fontSize="9">
            E
          </text>
          <text x="6" y="48" textAnchor="middle" fill="#8b93a7" fontSize="9">
            W
          </text>
        </svg>
        <div className="mt-0.5 text-center text-[10px] uppercase tracking-wide text-muted">
          Site north
        </div>
      </div>
    </div>
  );
}
