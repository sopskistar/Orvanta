import Link from "next/link";
import Image from "next/image";
import { BrandMark, PlayIcon } from "@/components/brand";
import { ContactCta } from "@/components/contact-cta";
import { Testimonials } from "@/components/testimonials";
import { business, pageMetadata } from "@/lib/business";

export const metadata = pageMetadata("AI receptionist setup for cleaning companies", business.description, "/");

export default function Home() {
  return <>
    <section className="home-hero"><div className="container">
      <h1>Keep customer enquiries moving, even when your team is busy.</h1>
      <div className="hero-bottom"><div className="hero-intro"><p>Orvanta configures AI receptionists, business websites and connected workflows around the way your business works.</p><div className="hero-actions"><Link href="/demo/" className="button"><PlayIcon />Watch the demo</Link><Link href="/contact/" className="text-link">Discuss your setup</Link></div></div>
        <Link href="/demo/" className="hero-demo" aria-label={`Watch ${business.demo.title}`}><Image src="/demo/poster.jpg" alt="Orvanta cleaning enquiry demo title frame" width={320} height={180} priority /><span><span className="preview-play"><PlayIcon /></span><span>Mia<small>Cleaning enquiry demo</small></span></span></Link>
      </div>
      <div className="hero-foot"><span>Built around your business</span><span>Starting with cleaning companies</span></div>
    </div></section>

    <section className="problem-section section-light"><div className="container problem-layout"><div><h2>A busy team.<br />A ringing phone.<br />An enquiry on hold.</h2><p>When you’re on a job, the next customer can be hard to get back to.</p></div><div className="problem-answer"><BrandMark /><h3>Give that enquiry<br />a place to land.</h3><p>An AI receptionist can collect the details your cleaning team needs for a callback. Start with after-hours or unanswered calls, with your routing and boundaries agreed first.</p><Link className="text-link" href="/services/#receptionist">Explore receptionist setup</Link></div></div></section>

    <section className="services-section"><div className="container"><div className="section-heading"><h2>One enquiry.<br />A more connected journey.</h2><p>Custom services to help customers reach you and help your team follow up.</p></div><div className="service-cards">
      <Link href="/services/#receptionist" className="service-card service-featured"><h3>AI receptionist<br />setup</h3><p>A conversation shaped around your services, questions and callback process.</p><span className="card-link">Explore the service</span></Link>
      <div className="service-secondary"><Link href="/services/#websites" className="service-card"><h3>Business websites</h3><p>A clear home for your business and a useful next step for visitors.</p><span className="card-link">Explore website design</span></Link><Link href="/services/#workflows" className="service-card"><h3>Enquiry workflows</h3><p>Connect capture, organisation and follow-up around your team’s tools.</p><span className="card-link">Explore integrations</span></Link></div>
    </div></div></section>

    <section className="demo-feature section-light"><div className="container"><div className="section-heading"><h2>{business.demo.title}</h2><p>{business.demo.description}</p></div><Link href="/demo/" className="demo-preview"><Image src="/demo/poster.jpg" alt="Orvanta receptionist demo title frame" width={1920} height={1080} sizes="(max-width: 700px) 100vw, 1200px" /><span className="demo-preview-control"><PlayIcon />Watch the demo</span></Link></div></section>

    <section className="pilot-section"><div className="container pilot-layout"><div><h2>A focused pilot.<br />Room to get it right.</h2><p>Agree scope, usage costs and test scenarios before rollout.</p><Link href="/contact/" className="text-link">Talk through a pilot</Link></div><ol className="pilot-list"><li><h3>Define the handoff</h3><p>Choose the calls and callback details.</p></li><li><h3>Configure and test</h3><p>Review conversations and edge cases together.</p></li><li><h3>Review before rollout</h3><p>Check results and agree what to adjust.</p></li></ol></div></section>
    <Testimonials />
    <ContactCta />
  </>;
}
