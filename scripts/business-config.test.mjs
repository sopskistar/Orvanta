import test from 'node:test';
import assert from 'node:assert/strict';

const keys=['NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_HOSTING_PROVIDER','CF_PAGES','CF_PAGES_URL','VERCEL_PROJECT_PRODUCTION_URL'];
let run=0;
async function withConfig(values, check) {
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    for(const key of keys)delete process.env[key];
    Object.assign(process.env,values);
    await check(await import(`../src/lib/business.ts?config-test=${++run}`));
  } finally {
    for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
  }
}

test('Pages preview and legacy Vercel URLs cannot replace the production origin',async()=>{
  await withConfig({CF_PAGES:'1',CF_PAGES_URL:'https://deployment.synthetic-pages-test.invalid',VERCEL_PROJECT_PRODUCTION_URL:'old-host.invalid'},({business,pageMetadata})=>{
    assert.equal(business.hostingProvider,'cloudflare');
    assert.equal(business.siteUrl,'https://getorvanta.xyz');
    const metadata=pageMetadata('Demo','Enquiry demo','/demo/');
    assert.equal(metadata.alternates.canonical,'https://getorvanta.xyz/demo/');
    assert.equal(metadata.openGraph.url,'https://getorvanta.xyz/demo/');
    assert.equal(metadata.openGraph.siteName,'Orvanta');
    assert.equal(metadata.openGraph.images[0].url,'https://getorvanta.xyz/brand/social-preview.png');
    assert.equal(metadata.twitter.images[0].url,'https://getorvanta.xyz/brand/social-preview.png');
    assert.equal(metadata.twitter.title,'Demo | Orvanta');
  });
});
test('the explicit stable project origin takes precedence over deployment URLs',async()=>{
  await withConfig({NEXT_PUBLIC_SITE_URL:'https://stable.synthetic-pages-test.invalid/demo/',CF_PAGES:'1',CF_PAGES_URL:'https://deployment.synthetic-pages-test.invalid'},({business})=>{
    assert.equal(business.siteUrl,'https://stable.synthetic-pages-test.invalid');
  });
});
test('local builds need no host, database or integration credentials',async()=>{
  await withConfig({},({business,pageMetadata})=>{
    assert.equal(business.siteUrl,'https://getorvanta.xyz');
    assert.equal(business.hostingProvider,'cloudflare');
    assert.equal(pageMetadata('Demo','Demo','/demo/').alternates.canonical,'https://getorvanta.xyz/demo/');
    assert.equal(business.email,'julianahonour@gmail.com');
  });
});
test('invalid protocols fail before incorrect metadata is exported',async()=>{
  await assert.rejects(withConfig({NEXT_PUBLIC_SITE_URL:'ftp://invalid.example'},()=>{}),/must be an http\(s\) URL/);
});
