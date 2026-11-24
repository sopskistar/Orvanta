export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role?: string;
  company?: string;
  /** Set true only after verifying the real review and receiving publication permission. */
  approved: boolean;
}

// Add only genuine reviews with permission. See docs/TESTIMONIALS.md.
// Keep private consent records outside this public repository.
export const testimonials: readonly Testimonial[] = [];

export function approvedTestimonials(entries: readonly Testimonial[]): Testimonial[] {
  return entries.filter(entry => entry.approved === true && entry.id.trim() && entry.quote.trim() && entry.author.trim());
}
