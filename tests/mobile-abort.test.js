import { test, expect } from 'bun:test';
import { AbortController as NativeAbortController } from '../node_modules/abort-controller/dist/abort-controller.js';
import { checkCancellation, withRequestTimeout } from '../src/services/abort';

// This is the same basic controller React Native installs in setUpXHR.js.
test('enhancement cancellation check works with the native signal lacking modern methods', () => {
  const controller = new NativeAbortController();
  expect(controller.signal.throwIfAborted).toBeUndefined();
  expect(() => checkCancellation(controller.signal)).not.toThrow();
  controller.abort();
  expect(() => checkCancellation(controller.signal)).toThrow('Processing canceled.');
  try { checkCancellation(controller.signal); } catch (error) { expect(error.name).toBe('AbortError'); }
});
test('already canceled requests do not perform I/O', async () => {
  const controller = new NativeAbortController(); controller.abort();
  let called = false;
  await expect(withRequestTimeout(async () => { called = true; }, 100, controller.signal)).rejects.toThrow('Processing canceled.');
  expect(called).toBe(false);
});
test('parent cancellation aborts the request using the native controller', async () => {
  const controller = new NativeAbortController();
  const request = withRequestTimeout(signal => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('transport aborted')));
  }), 1000, controller.signal);
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
});
test('timeouts abort requests and report an actionable error', async () => {
  let requestSignal;
  const request = withRequestTimeout(signal => new Promise((_resolve, reject) => {
    requestSignal = signal;
    signal.addEventListener('abort', () => reject(new Error('transport aborted')));
  }), 5);
  await expect(request).rejects.toThrow('Request timed out.');
  expect(requestSignal.aborted).toBe(true);
});
test('successful requests clear timeouts and detach parent cancellation', async () => {
  const controller = new NativeAbortController(); let requestSignal;
  expect(await withRequestTimeout(async signal => { requestSignal = signal; return 'complete'; }, 5, controller.signal)).toBe('complete');
  controller.abort();
  await new Promise(resolve => setTimeout(resolve, 15));
  expect(requestSignal.aborted).toBe(false);
});
test('transport failures keep their original message', async () => {
  await expect(withRequestTimeout(async () => { throw new Error('Network request failed'); }, 100)).rejects.toThrow('Network request failed');
});
