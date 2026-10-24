import { AsyncLocalStorage } from "node:async_hooks";

// Next's server test helpers expect the AsyncLocalStorage global that its runtime installs.
(globalThis as { AsyncLocalStorage?: typeof AsyncLocalStorage }).AsyncLocalStorage ??= AsyncLocalStorage;
