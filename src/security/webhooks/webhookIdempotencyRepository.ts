/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SEC-01-FIX-06-R1 — DURABLE WEBHOOK IDEMPOTENCY REPOSITORY
 *
 * Responsibility:
 * - Provides durable, atomic, multi-instance-safe webhook event idempotency
 *   backed by Firestore Admin transactions in `payment_webhook_events`.
 * - Derives deterministic, collision-resistant document keys from `provider + eventId`
 *   using SHA-256 (never using `providerTransactionId` alone).
 * - Manages atomic lease acquisition (`processing`), completion (`completed`),
 *   controlled failure (`failed`), and expired-lease takeover with strict `leaseToken`
 *   ownership verification.
 * - Never stores secrets, HMAC signatures, raw webhook bodies, or personal data.
 * - Fails closed on any Firestore transaction or persistence error (zero in-memory fallback).
 */

import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import {
  PAYMENT_WEBHOOK_EVENTS_COLLECTION,
  type AcquireWebhookEventLeaseInput,
  type AcquireWebhookEventLeaseResult,
  type CompleteWebhookEventLeaseInput,
  type CompleteWebhookEventLeaseResult,
  type FailWebhookEventLeaseInput,
  type FailWebhookEventLeaseResult,
  type WebhookFirestoreDb,
  type WebhookFirestoreDocRef,
  type WebhookFirestoreDocSnapshot,
  type WebhookFirestoreTransaction,
  type WebhookIdempotencyEventRecord,
  type WebhookIdempotencyEventStatus
} from "./webhookTypes.ts";

export const DEFAULT_WEBHOOK_LEASE_DURATION_MS = 60_000;

export interface WebhookIdempotencyRepository {
  deriveDocumentId(provider: "paddle", eventId: string): string;
  acquireEventLease(input: AcquireWebhookEventLeaseInput): Promise<AcquireWebhookEventLeaseResult>;
  completeEventLease(
    input: CompleteWebhookEventLeaseInput
  ): Promise<CompleteWebhookEventLeaseResult>;
  failEventLease(input: FailWebhookEventLeaseInput): Promise<FailWebhookEventLeaseResult>;
  getEventRecord(
    provider: "paddle",
    eventId: string
  ): Promise<WebhookIdempotencyEventRecord | null>;
}

export interface WebhookIdempotencyRepositoryDeps {
  adminDb: WebhookFirestoreDb;
  nowMs?: () => number;
  defaultLeaseDurationMs?: number;
  generateLeaseToken?: () => string;
}

/**
 * Derives a deterministic, non-ambiguous Firestore document key from `provider` and `eventId`
 * using SHA-256 (`paddle_<64-char-sha256>`).
 * Never uses `providerTransactionId` as the idempotency key.
 */
export function deriveWebhookEventDocumentId(provider: "paddle", eventId: string): string {
  const cleanProvider = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const cleanEventId = typeof eventId === "string" ? eventId.trim() : "";

  if (cleanProvider !== "paddle") {
    throw new Error(`Unsupported webhook provider for idempotency key: '${String(provider)}'`);
  }
  if (!cleanEventId) {
    throw new Error("Cannot derive webhook idempotency document key from an empty eventId.");
  }

  const digest = crypto
    .createHash("sha256")
    .update(`${cleanProvider}:${cleanEventId}`, "utf8")
    .digest("hex");

  return `${cleanProvider}_${digest}`;
}

export function generateSecureLeaseToken(): string {
  return `lease_${crypto.randomBytes(16).toString("hex")}`;
}

function isDocSnapshotExisting(snap: WebhookFirestoreDocSnapshot | null | undefined): boolean {
  if (!snap) return false;
  if (typeof snap.exists === "function") {
    return Boolean(snap.exists());
  }
  return Boolean(snap.exists);
}

/**
 * Converts a stored Firestore Timestamp, Date, ISO string, or epoch millisecond value
 * into epoch milliseconds for deterministic lease expiration comparison inside transactions.
 */
export function parseFirestoreTimeMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof (value as any)?.toMillis === "function") {
    const ms = Number((value as any).toMillis());
    return Number.isFinite(ms) ? ms : null;
  }
  if (
    typeof value === "object" &&
    typeof (value as any).seconds === "number" &&
    Number.isFinite((value as any).seconds)
  ) {
    const nanos = typeof (value as any).nanoseconds === "number" ? (value as any).nanoseconds : 0;
    return (value as any).seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildFirestoreTimestamp(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

function sanitizeErrorCode(rawErrorCode: string): string {
  const trimmed = typeof rawErrorCode === "string" ? rawErrorCode.trim() : "";
  if (!trimmed) return "UNKNOWN_PROCESSING_ERROR";
  // Keep only safe identifier characters to prevent accidental leakage of sensitive strings
  const cleaned = trimmed.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 96);
  return cleaned || "UNKNOWN_PROCESSING_ERROR";
}

function normalizeStoredRecord(
  raw: Record<string, unknown>,
  fallbackProvider: "paddle",
  fallbackEventId: string
): WebhookIdempotencyEventRecord {
  const statusRaw = raw.status;
  const status: WebhookIdempotencyEventStatus =
    statusRaw === "completed" || statusRaw === "failed" || statusRaw === "processing"
      ? statusRaw
      : "processing";

  const attemptCount =
    typeof raw.attemptCount === "number" && Number.isFinite(raw.attemptCount) && raw.attemptCount >= 1
      ? Math.floor(raw.attemptCount)
      : 1;

  return {
    provider: (raw.provider as "paddle") || fallbackProvider,
    eventId: typeof raw.eventId === "string" ? raw.eventId : fallbackEventId,
    eventType: typeof raw.eventType === "string" ? raw.eventType : "transaction.completed",
    status,
    attemptCount,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    leaseExpiresAt: raw.leaseExpiresAt ?? null,
    leaseToken: typeof raw.leaseToken === "string" ? raw.leaseToken : null,
    completedAt: raw.completedAt ?? null,
    lastErrorCode: typeof raw.lastErrorCode === "string" ? raw.lastErrorCode : null
  };
}

/**
 * Executes a Firestore transaction using `adminDb.runTransaction`.
 * If the injected test double does not provide `runTransaction`, fails closed unless
 * the database object explicitly provides `runTransaction`.
 */
async function executeFirestoreTransaction<T>(
  adminDb: WebhookFirestoreDb,
  fn: (tx: WebhookFirestoreTransaction) => Promise<T>
): Promise<T> {
  if (!adminDb || typeof adminDb.runTransaction !== "function") {
    throw new Error(
      "Firestore Admin transaction support (adminDb.runTransaction) is required for durable webhook idempotency."
    );
  }
  return adminDb.runTransaction(fn);
}

export function createWebhookIdempotencyRepository(
  deps: WebhookIdempotencyRepositoryDeps
): WebhookIdempotencyRepository {
  const nowMs = deps.nowMs ?? (() => Date.now());
  const defaultLeaseDurationMs =
    deps.defaultLeaseDurationMs && deps.defaultLeaseDurationMs > 0
      ? deps.defaultLeaseDurationMs
      : DEFAULT_WEBHOOK_LEASE_DURATION_MS;
  const generateToken = deps.generateLeaseToken ?? generateSecureLeaseToken;

  function getEventDocRef(provider: "paddle", eventId: string): {
    documentId: string;
    docRef: WebhookFirestoreDocRef;
  } {
    const documentId = deriveWebhookEventDocumentId(provider, eventId);
    const docRef = deps.adminDb.collection(PAYMENT_WEBHOOK_EVENTS_COLLECTION).doc(documentId);
    return { documentId, docRef };
  }

  return {
    deriveDocumentId(provider: "paddle", eventId: string): string {
      return deriveWebhookEventDocumentId(provider, eventId);
    },

    async acquireEventLease(
      input: AcquireWebhookEventLeaseInput
    ): Promise<AcquireWebhookEventLeaseResult> {
      const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
      const eventType = typeof input.eventType === "string" ? input.eventType.trim() : "";

      if (input.provider !== "paddle") {
        throw new Error(`Unsupported provider '${String(input.provider)}' for webhook idempotency.`);
      }
      if (!eventId) {
        throw new Error("Webhook eventId is required to acquire an idempotency lease.");
      }
      if (!eventType) {
        throw new Error("Webhook eventType is required to acquire an idempotency lease.");
      }

      const leaseDurationMs =
        typeof input.leaseDurationMs === "number" && input.leaseDurationMs > 0
          ? input.leaseDurationMs
          : defaultLeaseDurationMs;

      const { documentId, docRef } = getEventDocRef(input.provider, eventId);

      return executeFirestoreTransaction(deps.adminDb, async (tx) => {
        const snap = await tx.get(docRef);
        const currentTimeMs = nowMs();
        const nowTimestamp = buildFirestoreTimestamp(currentTimeMs);
        const expiresTimestamp = buildFirestoreTimestamp(currentTimeMs + leaseDurationMs);

        // Case 1: Document absent -> create with status: "processing"
        if (!isDocSnapshotExisting(snap)) {
          const leaseToken = generateToken();
          const newRecord: WebhookIdempotencyEventRecord = {
            provider: "paddle",
            eventId,
            eventType,
            status: "processing",
            attemptCount: 1,
            createdAt: nowTimestamp,
            updatedAt: nowTimestamp,
            leaseExpiresAt: expiresTimestamp,
            leaseToken,
            completedAt: null,
            lastErrorCode: null
          };

          await Promise.resolve(
            tx.set(docRef, newRecord as unknown as Record<string, unknown>)
          );

          return {
            outcome: "acquired" as const,
            documentId,
            leaseToken,
            attemptCount: 1,
            record: newRecord
          };
        }

        const existingData = snap.data() || {};
        const existingRecord = normalizeStoredRecord(existingData, "paddle", eventId);

        // Case 2: Document already "completed" -> never re-run business processing
        if (existingRecord.status === "completed") {
          return {
            outcome: "already_processed" as const,
            documentId,
            record: existingRecord
          };
        }

        // Case 3: Document "processing" -> check lease expiration
        if (existingRecord.status === "processing") {
          const leaseExpiresMs = parseFirestoreTimeMs(existingRecord.leaseExpiresAt);
          const hasValidActiveLease =
            typeof existingRecord.leaseToken === "string" &&
            existingRecord.leaseToken.trim().length > 0 &&
            leaseExpiresMs !== null &&
            leaseExpiresMs > currentTimeMs;

          if (hasValidActiveLease) {
            return {
              outcome: "in_progress" as const,
              documentId,
              record: existingRecord
            };
          }

          // Case 4: Document "processing" with expired lease -> atomic takeover
          const newLeaseToken = generateToken();
          const nextAttemptCount = existingRecord.attemptCount + 1;
          const takenOverRecord: WebhookIdempotencyEventRecord = {
            provider: "paddle",
            eventId,
            eventType,
            status: "processing",
            attemptCount: nextAttemptCount,
            createdAt: existingRecord.createdAt ?? nowTimestamp,
            updatedAt: nowTimestamp,
            leaseExpiresAt: expiresTimestamp,
            leaseToken: newLeaseToken,
            completedAt: null,
            lastErrorCode: existingRecord.lastErrorCode ?? null
          };

          await Promise.resolve(
            tx.set(docRef, takenOverRecord as unknown as Record<string, unknown>)
          );

          return {
            outcome: "acquired" as const,
            documentId,
            leaseToken: newLeaseToken,
            attemptCount: nextAttemptCount,
            record: takenOverRecord
          };
        }

        // Case 5: Document "failed" -> controlled retry with new lease token and incremented attemptCount
        const retryLeaseToken = generateToken();
        const retryAttemptCount = existingRecord.attemptCount + 1;
        const retriedRecord: WebhookIdempotencyEventRecord = {
          provider: "paddle",
          eventId,
          eventType,
          status: "processing",
          attemptCount: retryAttemptCount,
          createdAt: existingRecord.createdAt ?? nowTimestamp,
          updatedAt: nowTimestamp,
          leaseExpiresAt: expiresTimestamp,
          leaseToken: retryLeaseToken,
          completedAt: null,
          lastErrorCode: existingRecord.lastErrorCode ?? null
        };

        await Promise.resolve(
          tx.set(docRef, retriedRecord as unknown as Record<string, unknown>)
        );

        return {
          outcome: "acquired" as const,
          documentId,
          leaseToken: retryLeaseToken,
          attemptCount: retryAttemptCount,
          record: retriedRecord
        };
      });
    },

    async completeEventLease(
      input: CompleteWebhookEventLeaseInput
    ): Promise<CompleteWebhookEventLeaseResult> {
      const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
      const leaseToken = typeof input.leaseToken === "string" ? input.leaseToken.trim() : "";

      if (input.provider !== "paddle" || !eventId || !leaseToken) {
        throw new Error(
          "Valid provider, eventId, and leaseToken are required to complete a webhook idempotency lease."
        );
      }

      const { documentId, docRef } = getEventDocRef(input.provider, eventId);

      return executeFirestoreTransaction(deps.adminDb, async (tx) => {
        const snap = await tx.get(docRef);
        if (!isDocSnapshotExisting(snap)) {
          return {
            ok: false as const,
            code: "EVENT_NOT_FOUND" as const,
            error: `Cannot finalize webhook event '${eventId}': idempotency document does not exist.`
          };
        }

        const existingData = snap.data() || {};
        const existingRecord = normalizeStoredRecord(existingData, "paddle", eventId);

        // Verify strict leaseToken ownership before finalizing
        if (
          existingRecord.status !== "processing" ||
          !existingRecord.leaseToken ||
          existingRecord.leaseToken !== leaseToken
        ) {
          return {
            ok: false as const,
            code: "LEASE_CONFLICT" as const,
            error: `Lease conflict for webhook event '${eventId}': leaseToken is no longer owned by this instance.`
          };
        }

        const currentTimeMs = nowMs();
        const nowTimestamp = buildFirestoreTimestamp(currentTimeMs);

        const completedRecord: WebhookIdempotencyEventRecord = {
          provider: existingRecord.provider,
          eventId: existingRecord.eventId,
          eventType: existingRecord.eventType,
          status: "completed",
          attemptCount: existingRecord.attemptCount,
          createdAt: existingRecord.createdAt ?? nowTimestamp,
          updatedAt: nowTimestamp,
          leaseExpiresAt: null,
          leaseToken: null,
          completedAt: nowTimestamp,
          lastErrorCode: null
        };

        await Promise.resolve(
          tx.set(docRef, completedRecord as unknown as Record<string, unknown>)
        );

        return {
          ok: true as const,
          documentId,
          record: completedRecord
        };
      });
    },

    async failEventLease(
      input: FailWebhookEventLeaseInput
    ): Promise<FailWebhookEventLeaseResult> {
      const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
      const leaseToken = typeof input.leaseToken === "string" ? input.leaseToken.trim() : "";
      const safeErrorCode = sanitizeErrorCode(input.errorCode);

      if (input.provider !== "paddle" || !eventId || !leaseToken) {
        throw new Error(
          "Valid provider, eventId, and leaseToken are required to record a failed webhook lease."
        );
      }

      const { documentId, docRef } = getEventDocRef(input.provider, eventId);

      return executeFirestoreTransaction(deps.adminDb, async (tx) => {
        const snap = await tx.get(docRef);
        if (!isDocSnapshotExisting(snap)) {
          return {
            ok: false as const,
            code: "EVENT_NOT_FOUND" as const,
            error: `Cannot mark webhook event '${eventId}' as failed: document not found.`
          };
        }

        const existingData = snap.data() || {};
        const existingRecord = normalizeStoredRecord(existingData, "paddle", eventId);

        // Only the active lease holder may transition the event to "failed"
        if (
          existingRecord.status !== "processing" ||
          !existingRecord.leaseToken ||
          existingRecord.leaseToken !== leaseToken
        ) {
          return {
            ok: false as const,
            code: "LEASE_CONFLICT" as const,
            error: `Lease conflict for webhook event '${eventId}': cannot mark failed with stale leaseToken.`
          };
        }

        const currentTimeMs = nowMs();
        const nowTimestamp = buildFirestoreTimestamp(currentTimeMs);

        const failedRecord: WebhookIdempotencyEventRecord = {
          provider: existingRecord.provider,
          eventId: existingRecord.eventId,
          eventType: existingRecord.eventType,
          status: "failed",
          attemptCount: existingRecord.attemptCount,
          createdAt: existingRecord.createdAt ?? nowTimestamp,
          updatedAt: nowTimestamp,
          leaseExpiresAt: null,
          leaseToken: null,
          completedAt: null,
          lastErrorCode: safeErrorCode
        };

        await Promise.resolve(
          tx.set(docRef, failedRecord as unknown as Record<string, unknown>)
        );

        return {
          ok: true as const,
          documentId,
          record: failedRecord
        };
      });
    },

    async getEventRecord(
      provider: "paddle",
      eventId: string
    ): Promise<WebhookIdempotencyEventRecord | null> {
      const cleanEventId = typeof eventId === "string" ? eventId.trim() : "";
      if (provider !== "paddle" || !cleanEventId) return null;

      const { docRef } = getEventDocRef(provider, cleanEventId);
      if (typeof docRef.get !== "function") {
        return null;
      }

      const snap = await docRef.get();
      if (!isDocSnapshotExisting(snap)) {
        return null;
      }

      const raw = snap.data();
      if (!raw || typeof raw !== "object") {
        return null;
      }

      return normalizeStoredRecord(raw, provider, cleanEventId);
    }
  };
}
