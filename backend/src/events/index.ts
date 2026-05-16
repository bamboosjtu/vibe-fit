import { env } from "../config/env.js";
import type { EventPublisher } from "./publisher.js";
import { MockEventPublisher } from "./mockPublisher.js";
import { PubSubEventPublisher } from "./pubsubPublisher.js";

export const eventPublisher: EventPublisher =
  env.EVENT_PUBLISHER === "pubsub"
    ? new PubSubEventPublisher()
    : new MockEventPublisher();
