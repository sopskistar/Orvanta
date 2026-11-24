import { existsSync } from "node:fs";
import path from "node:path";
import { DemoPlayer } from "@/components/demo-player";
import { ContactCta } from "@/components/contact-cta";
import { business, pageMetadata } from "@/lib/business";

export const metadata = pageMetadata(business.demo.title, business.demo.description, "/demo/");

export default function Demo() {
  const available = existsSync(path.join(process.cwd(), "public", business.demo.path));
  return <><section className="page-hero demo-page-hero"><div className="container"><h1>{business.demo.title}</h1><p id="demo-description">{business.demo.description}</p></div></section>
    <section className="demo-player-section"><div className="container"><DemoPlayer available={available} /></div></section>
    <ContactCta /></>;
}
