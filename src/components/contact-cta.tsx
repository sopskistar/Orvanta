import Link from "next/link";

export function ContactCta() {
  return <section className="contact-band"><div className="container contact-band-inner"><h2>Start with the calls<br />you can’t get to.</h2><div><p>Tell us where enquiries get stuck.<br />We configure a setup around your team.</p><Link href="/contact/" className="button">Discuss your setup</Link></div></div></section>;
}
