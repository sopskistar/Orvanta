export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role?: string;
  company?: string;
  /** Publish ratings and outcomes only when supplied and approved by the client. */
  rating?: 1 | 2 | 3 | 4 | 5;
  result?: string;
  /** Set true only after verifying the real review and receiving publication permission. */
  approved: boolean;
}

// Add only genuine reviews with permission. See docs/TESTIMONIALS.md.
// Keep private consent records outside this public repository.
export const testimonials: readonly Testimonial[] = [];

// Service examples, never presented as customer quotes or measured results.
export const serviceScenarios = [
  {
    id: "after-hours",
    title: "After-hours enquiries",
    businessType: "Domestic cleaning",
    description: "Capture a caller’s contact details, property information and cleaning request outside opening hours.",
    handoff: "Your team reviews the enquiry and returns the call during business hours.",
  },
  {
    id: "unanswered-calls",
    title: "Calls while your team is on site",
    businessType: "Commercial cleaning",
    description: "Collect the site location, service requirements and callback details when your team cannot answer.",
    handoff: "Your team has the context it needs to discuss the work and prepare a quote.",
  },
  {
    id: "appointment-requests",
    title: "Appointment requests",
    businessType: "Carpet and upholstery cleaning",
    description: "Record the requested service, preferred dates and caller details in one enquiry.",
    handoff: "Your team checks appointment availability and confirms the booking directly.",
  },
  {
    id: "quote-follow-up",
    title: "Clearer quote follow-up",
    businessType: "End-of-tenancy cleaning",
    description: "Collect property size, requested cleaning tasks and preferred timing before a callback.",
    handoff: "Your team reviews the requirements and confirms the quote with the customer.",
  },
] as const;

export function approvedTestimonials(entries: readonly Testimonial[]): Testimonial[] {
  return entries.filter(entry => entry.approved === true && entry.id.trim() && entry.quote.trim() && entry.author.trim()
    && (entry.rating === undefined || (Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5)));
}
