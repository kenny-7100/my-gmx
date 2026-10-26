import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

// Commands and events share one socket; events can arrive before command replies.
export class InspectorClient extends EventEmitter {
  constructor(url, timeout = 5000) {
    super();
    this.timeout = timeout;
    this.pending = new Map();
    this.scripts = new Map();
    this.sequence = 0;
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const command = this.pending.get(message.id);
        if (!command) return;
        clearTimeout(command.timer);
        this.pending.delete(message.id);
        if (message.error) command.reject(new Error("Inspector command failed."));
        else command.resolve(message.result);
      } else {
        if (message.method === "Debugger.scriptParsed") this.scripts.set(message.params.scriptId, message.params);
        if (message.method === "Debugger.paused") this.paused = true;
        if (message.method === "Debugger.resumed") this.paused = false;
        this.emit(message.method, message.params);
      }
    });
    const disconnected = () => {
      for (const command of this.pending.values()) {
        clearTimeout(command.timer);
        command.reject(new Error("Inspector disconnected."));
      }
      this.pending.clear();
    };
    this.socket.addEventListener("close", disconnected);
    this.socket.addEventListener("error", disconnected);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Inspector connection timed out.")), this.timeout);
      this.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      this.socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("Inspector unavailable."));
        },
        { once: true }
      );
    });
  }

  send(method, params = {}) {
    assert.equal(this.socket.readyState, WebSocket.OPEN, "Inspector is not connected.");
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Inspector command timed out."));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method) {
    let listener;
    let timer;
    const cancel = () => {
      clearTimeout(timer);
      this.removeListener(method, listener);
    };
    const promise = new Promise((resolve, reject) => {
      listener = (params) => {
        cancel();
        resolve(params);
      };
      this.once(method, listener);
      timer = setTimeout(() => {
        cancel();
        reject(new Error("Inspector event timed out."));
      }, this.timeout);
    });
    // A request may fail before its corresponding event is awaited.
    promise.catch(() => undefined);
    return { promise, cancel };
  }

  async close() {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Inspector disconnect timed out.")), this.timeout);
      this.socket.addEventListener(
        "close",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      this.socket.close();
    });
  }
}
