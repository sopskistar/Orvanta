export function BrandMark({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true"><path d="M35.3 12.7a16 16 0 1 0 0 22.6" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /><path d="M24 24h18" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>;
}

export function Brand() {
  return <span className="brand"><BrandMark /><span>Orvanta</span></span>;
}

export function PlayIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 4.8a1 1 0 0 1 1.5-.86l11 7.2a1 1 0 0 1 0 1.72l-11 7.2a1 1 0 0 1-1.5-.86Z" /></svg>;
}
