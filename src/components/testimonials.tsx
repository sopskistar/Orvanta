import { approvedTestimonials, serviceScenarios, testimonials, type Testimonial } from "@/content/testimonials";

export function Testimonials({ entries = testimonials }: { entries?: readonly Testimonial[] }) {
  const approved = approvedTestimonials(entries);
  if (!approved.length) return <section className="testimonials-section section-light" aria-labelledby="testimonials-title">
    <div className="container">
      <div className="section-heading"><h2 id="testimonials-title">Enquiry capture<br />in practice.</h2><p>Illustrative service scenarios, not customer testimonials or measured results.</p></div>
      <div className="testimonial-list">
        {serviceScenarios.map(scenario => <article className="testimonial service-scenario" key={scenario.id}>
          <h3>{scenario.title}</h3>
          <p className="testimonial-attribution">{scenario.businessType}</p>
          <p>{scenario.description}</p>
          <p className="scenario-handoff">{scenario.handoff}</p>
        </article>)}
      </div>
    </div>
  </section>;

  return <section className="testimonials-section section-light" aria-labelledby="testimonials-title">
    <div className="container">
      <div className="section-heading"><h2 id="testimonials-title">In our clients’ words.</h2></div>
      <div className="testimonial-list">
        {approved.map(review => <figure className="testimonial" key={review.id}>
          {review.rating !== undefined && <div className="testimonial-rating" role="img" aria-label={`${review.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, index) => <svg key={index} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={index < review.rating! ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5"><path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2-4.5-4.4 6.3-.9Z" /></svg>)}
          </div>}
          <blockquote><p>{review.quote}</p></blockquote>
          {review.result && <p className="testimonial-result">{review.result}</p>}
          <figcaption><span className="testimonial-author">{review.author}</span>
            {(review.role || review.company) && <span className="testimonial-attribution">{[review.role, review.company].filter(Boolean).join(", ")}</span>}
          </figcaption>
        </figure>)}
      </div>
    </div>
  </section>;
}
