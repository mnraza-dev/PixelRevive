// Use the basic AbortController API supported by React Native and browsers.
// React Native's signal does not necessarily implement throwIfAborted/timeout.
export function checkCancellation(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    const error = new Error('Processing canceled.');
    error.name = 'AbortError';
    throw error;
  }
}

export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
  parent?: AbortSignal | null
): Promise<T> {
  checkCancellation(parent);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let timedOut = false;
  parent?.addEventListener('abort', cancel);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, milliseconds);
  try {
    return await operation(controller.signal);
  } catch (error) {
    checkCancellation(parent);
    if (timedOut) {
      throw new Error('Request timed out. Check your backend connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', cancel);
  }
}
