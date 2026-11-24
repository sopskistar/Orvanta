import { approvedTestimonials, testimonials, type Testimonial } from "@/content/testimonials";

export function Testimonials({ entries = testimonials }: { entries?: readonly Testimonial[] }) {
  const approved = approvedTestimonials(entries);
  if (!approved.length) return null;

  return <section className="testimonials-section section-light" aria-labelledby="testimonials-title">
    <div className="container">
      <div className="section-heading"><h2 id="testimonials-title">In our clients’ words.</h2></div>
      <div className="testimonial-list">
        {approved.map(review => <figure className="testimonial" key={review.id}>
          <blockquote><p>{review.quote}</p></blockquote>
          <figcaption><span className="testimonial-author">{review.author}</span>
            {(review.role || review.company) && <span className="testimonial-attribution">{[review.role, review.company].filter(Boolean).join(", ")}</span>}
          </figcaption>
        </figure>)}
      </div>
    </div>
  </section>;
}
