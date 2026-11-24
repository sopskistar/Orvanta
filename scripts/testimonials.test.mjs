import test from 'node:test';
import assert from 'node:assert/strict';
import { testimonials, approvedTestimonials } from '../src/content/testimonials.ts';
import { renderTestimonials, syntheticReview } from './testimonial-fixture.mjs';

test('launch data is empty and the entire section produces no HTML',()=>{
  assert.deepEqual(testimonials,[]);
  assert.equal(renderTestimonials(), '');
});
test('unapproved and incomplete entries cannot create public review markup',()=>{
  const entries=[{...syntheticReview,approved:false},{...syntheticReview,quote:'  '},{...syntheticReview,author:''},{...syntheticReview,id:''}];
  assert.deepEqual(approvedTestimonials(entries),[]);
  assert.equal(renderTestimonials(entries),'');
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
