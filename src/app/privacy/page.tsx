import { business, pageMetadata } from "@/lib/business";

export const metadata = pageMetadata("Privacy", "How the Orvanta launch website handles website visits, email enquiries and the recorded demonstration.", "/privacy/");

export default function Privacy() {
  const host = business.hostingProvider === "vercel" ? "Vercel" : business.hostingProvider === "cloudflare" ? "Cloudflare Pages" : "The provider hosting this website";
  return <><section className="page-hero"><div className="container"><h1>Privacy, clearly.</h1><p>How information is handled on this Orvanta website.</p></div></section><section className="section-light privacy-section"><article className="container prose">
    <h2>Who to contact</h2><p>For questions about this website or your information, contact Orvanta at <a href={`mailto:${business.email}`}>{business.email}</a>.</p>
    <h2>Information you choose to send</h2><p>This website does not have an enquiry submission form. Email links open your own email service. If you email us, we receive your email address, message and anything else you choose to include, and use that information to respond and discuss your request.</p><p>Please avoid sending customer records, passwords, identity documents or other sensitive information in an initial enquiry. This website does not request government ID or selfie uploads.</p>
    <h2>Email and service providers</h2><p>The current contact inbox uses Google’s Gmail service. Your own email provider also processes messages you send. {host} may process technical request information, such as IP addresses, browser details and access logs, to deliver and protect the site.</p><p>The site’s code and public assets are maintained in GitHub. Email enquiries are not published to that repository. Fonts, images and the video are served with the website; viewing the recorded demo does not start a live Retell call.</p>
    <h2>Cookies and analytics</h2><p>Orvanta has not added advertising trackers, analytics scripts or application cookies to this launch website. Your hosting or email provider may process information under its own policies. Native video playback is handled by your browser.</p>
    <h2>The recorded demonstration</h2><p>The Mia demo is a recorded video using Retell AI. Watching it does not start a call or submit your information. The website does not send visitor enquiry data to Retell, Neon, Resend or Calendly.</p>
    <h2>Keeping and removing information</h2><p>This notice does not promise a fixed retention period. If you want to ask about information you have shared, request a correction or request deletion, email the contact address above. We will review your request in the context of the information held and any applicable obligations.</p>
    <h2>Future integrations</h2><p>If we add a connected form, automatic notifications, customer records or booking tools, this notice will need to describe the actual collection, providers and handling before those features are used.</p>
  </article></section></>;
}
