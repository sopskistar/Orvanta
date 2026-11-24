import test from 'node:test';
import assert from 'node:assert/strict';
import { testimonials, approvedTestimonials } from '../src/content/testimonials.ts';
import { renderTestimonials, syntheticReview } from './testimonial-fixture.mjs';

test('no invented customers are published; four labelled scenarios keep the section visible',()=>{
  assert.deepEqual(testimonials,[]);
  const html=renderTestimonials();
  assert.match(html,/Illustrative service scenarios, not customer testimonials or measured results/);
  assert.equal((html.match(/<article /g)||[]).length,4);
  assert.doesNotMatch(html,/<blockquote>|<figcaption>|out of 5 stars|In our clients/);
});
test('unapproved and incomplete entries cannot create public review markup',()=>{
  const entries=[{...syntheticReview,approved:false},{...syntheticReview,quote:'  '},{...syntheticReview,author:''},{...syntheticReview,id:''}];
  assert.deepEqual(approvedTestimonials(entries),[]);
  assert.doesNotMatch(renderTestimonials(entries),/<blockquote>|Synthetic QA fixture/);
});
test('only supplied and approved ratings and results appear',()=>{
  const html=renderTestimonials([{...syntheticReview,rating:4,result:'Approved outcome fixture'}]);
  assert.match(html,/aria-label="4 out of 5 stars"/);
  assert.match(html,/Approved outcome fixture/);
  assert.doesNotMatch(renderTestimonials([syntheticReview]),/out of 5 stars/);
  for(const rating of [0,6,4.5,NaN]) {
    assert.doesNotMatch(renderTestimonials([{...syntheticReview,rating}]),/out of 5 stars|Synthetic QA fixture/);
  }
});
test('only approved complete entries render with semantic quotation and attribution',()=>{
  const html=renderTestimonials([{...syntheticReview,approved:false,quote:'PRIVATE_UNAPPROVED_FIXTURE'},syntheticReview]);
  assert.match(html,/<section[^>]+aria-labelledby="testimonials-title"/);
  assert.match(html,/<blockquote>/);
  assert.match(html,/<figcaption>/);
  assert.match(html,/Synthetic QA fixture/);
  assert.doesNotMatch(html,/PRIVATE_UNAPPROVED_FIXTURE/);
});
test('review text is escaped and optional attribution is truly optional',()=>{
  const html=renderTestimonials([{...syntheticReview,quote:'<script>not executable</script>',company:undefined,role:undefined}]);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.doesNotMatch(html,/testimonial-attribution/);
});
