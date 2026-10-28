let controller = new AbortController();

export function getMulticallSignal() {
  return controller.signal;
}

export function setMulticallEnabled(enabled: boolean) {
  if (!enabled) controller.abort(new DOMException("EVM multicall disabled", "AbortError"));
  else if (controller.signal.aborted) controller = new AbortController();
}
