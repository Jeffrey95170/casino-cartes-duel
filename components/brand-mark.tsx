export function BrandMark({
  compact = false,
  showTagline = false,
}: {
  compact?: boolean;
  showTagline?: boolean;
}) {
  return (
    <span
      className={`brand-mark${compact ? " compact" : ""}${showTagline ? " with-tagline" : ""}`}
      aria-label="Capture 52"
    >
      <span className="brand-emblem" aria-hidden="true">
        <span>♠</span>
        <span>♦</span>
      </span>
      <span className="brand-copy" aria-hidden="true">
        <strong>
          CAPTURE <span className="brand-number">5<em>2</em></span>
        </strong>
        {showTagline && <small>Think. Build. Capture.</small>}
      </span>
    </span>
  );
}
