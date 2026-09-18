import { TypeSafeClient } from '@typesafe-ai/sdk';
import { config } from '../config.js';

// Shared client for the server and scripts. Model, base URL and log level come from
// TYPESAFE_DEFAULT_MODEL, TYPESAFE_BASE_URL and TYPESAFE_LOG_LEVEL, else the SDK defaults
// (jev-latest, https://api.typesafe.ai, warn). 429 and 5xx responses are retried by the SDK.
export const typesafe = new TypeSafeClient(config.typesafe);
