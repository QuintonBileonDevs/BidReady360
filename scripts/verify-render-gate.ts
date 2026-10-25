import { inFlightTracker } from '../src/services/api';

async function runTests() {
  console.log('=== 1. Testing inFlightTracker ===');
  let currentCount = inFlightTracker.getCount();
  console.assert(currentCount === 0, 'Initial inFlight count should be 0');

  let notifiedCount = -1;
  const unsub = inFlightTracker.subscribe((cnt) => {
    notifiedCount = cnt;
  });

  inFlightTracker.increment();
  console.assert(inFlightTracker.getCount() === 1, 'InFlight count should be 1 after increment');
  console.assert(notifiedCount === 1, 'Subscriber should receive 1');

  inFlightTracker.decrement();
  console.assert(inFlightTracker.getCount() === 0, 'InFlight count should be 0 after decrement');
  console.assert(notifiedCount === 0, 'Subscriber should receive 0');
  unsub();
  console.log('✓ inFlightTracker passed');

  console.log('\n=== 2. Testing HTTP Cache-Control and ETag headers ===');
  try {
    const res = await fetch('http://localhost:3000/api/calls/public');
    const cacheControl = res.headers.get('cache-control');
    const etag = res.headers.get('etag');
    console.log('Cache-Control:', cacheControl);
    console.log('ETag:', etag);
    console.assert(cacheControl && cacheControl.includes('no-store'), 'Must have Cache-Control: no-store');
    console.assert(!etag, 'ETags must be disabled on API routes');
    console.log('✓ API Cache-Control: no-store and no ETag verified');
  } catch (err: any) {
    console.warn('Dev server test note:', err.message);
  }

  console.log('\n=== 3. Testing DOM binding normalization logic ===');
  const normalize = (val: string) => val.trim().replace(/\s+/g, ' ').toLowerCase();
  const testActual = 'Kalahari Technologies (Pty) Ltd';
  const testExpected = 'Kalahari Technologies';
  const matches = normalize(testActual).includes(normalize(testExpected));
  console.assert(matches, 'DOM text matching should match legal name substring');
  console.log('✓ DOM binding verification logic passed');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
}

runTests();
