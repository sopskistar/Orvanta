import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { business, emailHref, pageMetadata } from "@/lib/business";

export const metadata = pageMetadata("Contact", "Discuss an AI receptionist pilot, a business website or your enquiry workflow with Orvanta by email.", "/contact/");

export default function Contact() {
  return <><section className="page-hero"><div className="container"><h1>Tell us where<br />enquiries get stuck.</h1><p>Let’s discuss your business, the calls you can’t get to and what a useful first setup could look like.</p></div></section><section className="section-light contact-section"><div className="container contact-layout"><div className="contact-direct"><BrandMark /><h2>Start with an email.</h2><a className="contact-address" href={emailHref}>{business.email}</a><p>Use the button to open your email app, or copy the address into your preferred email service.</p><a href={emailHref} className="button">Email Orvanta</a><p className="contact-privacy">We’ll use what you share to respond to your enquiry. <Link href="/privacy/">Read our privacy notice</Link>.</p></div><div className="contact-prompts"><h3>A few things to include</h3><ul className="plain-list"><li>Your business name and the services you offer</li><li>When calls are hardest to answer</li><li>How enquiries reach your team today</li><li>What you’d like help setting up</li></ul><p>A short introduction is enough. You don’t need to send customer records or sensitive account information.</p><div className="contact-expectation"><h3>What happens next?</h3><p>We’ll discuss the scope, tools and testing a pilot would need. Any booking or additional integration is agreed separately.</p></div></div></div></section></>;
}
