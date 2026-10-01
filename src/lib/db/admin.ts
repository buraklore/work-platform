/**
 * PRIVILEGED database access that bypasses Row Level Security.
 * Allowed only in: cron routes, webhooks, the platform admin area, and tests.
 * Never import this from a feature's user-facing code path.
 */
import "server-only";
import { getDb } from "./client";

export const adminDb = () => getDb();
