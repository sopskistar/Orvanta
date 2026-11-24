// Development-only rendering helper. Never imported by website routes.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import * as data from '../src/content/testimonials.ts';
const require = createRequire(import.meta.url);
const code = ts.transpileModule(fs.readFileSync(new URL('../src/components/testimonials.tsx', import.meta.url),'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const componentModule = { exports: {} };
new Function('require','module','exports',code)(name => name === '@/content/testimonials' ? data : require(name),componentModule,componentModule.exports);
export const renderTestimonials = entries => renderToStaticMarkup(createElement(componentModule.exports.Testimonials, entries === undefined ? {} : { entries }));
export const syntheticReview = {
  id: 'synthetic-qa-only',
  quote: 'Synthetic layout fixture for local quality checks. This is not a customer review and must never appear on the public website.',
  author: 'Synthetic QA fixture',
  role: 'Local rendering test',
  company: 'Not a customer',
  approved: true,
};
