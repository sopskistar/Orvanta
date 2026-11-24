import Link from "next/link";

export default function NotFound() {
  return <section className="page-hero not-found"><div className="container"><h1>A different<br />way forward.</h1><p>We couldn’t find that page. Explore our services or head back to Orvanta’s home page.</p><div className="hero-actions"><Link href="/" className="button">Back to home</Link><Link href="/services/" className="text-link">Explore services</Link></div></div></section>;
}
