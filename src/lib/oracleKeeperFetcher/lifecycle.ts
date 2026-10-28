let controller = new AbortController();

export function getEvmOracleSignal() {
  return controller.signal;
}

export function setEvmOracleEnabled(enabled: boolean) {
  if (!enabled) controller.abort(new DOMException("EVM oracle disabled", "AbortError"));
  else if (controller.signal.aborted) controller = new AbortController();
}
