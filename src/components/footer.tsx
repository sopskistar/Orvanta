import Link from "next/link";
import { Brand } from "./brand";
import { business, emailHref } from "@/lib/business";

export function Footer() {
  return <footer className="site-footer"><div className="container">
    <div className="footer-top"><div><Link href="/" aria-label="Orvanta home"><Brand /></Link><p>Thoughtful systems.<br />A clearer next step.</p></div>
      <nav aria-label="Footer navigation"><Link href="/services/">Services</Link><Link href="/demo/">The demo</Link><Link href="/contact/">Contact</Link><Link href="/privacy/">Privacy</Link></nav>
      <div className="footer-email"><span>Let’s talk about your business.</span><a href={emailHref}>{business.email}</a></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Orvanta</span><span>AI receptionist setup, websites &amp; workflows</span></div>
  </div></footer>;
}
