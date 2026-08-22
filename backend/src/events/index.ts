import { env } from "../config/env.js";
import type { EventPublisher } from "./publisher.js";
import { MockEventPublisher } from "./mockPublisher.js";
import { LocalHttpEventPublisher } from "./localPublisher.js";

export const eventPublisher: EventPublisher =
  env.EVENT_PUBLISHER === "local"
    ? new LocalHttpEventPublisher()
    : new MockEventPublisher();
