# Subscription recurrence consistency architecture

## Authority and scope

`Subscription` plus its task rows is the sole authority for future recurring schedule content. The reconciler only considers pending subscription orders whose recurrence `sourceWeek` is inside the future window. It never mutates subscription/UI records.

Preserved without change:
- completed and historical orders;
- manual/non-subscription orders;
- `plannedAt` and `startAt` on a materialized recurrence order (intentional moves);
- user deletion tombstones;
- holiday suppression.

## Locked-order policy

`lockedFully` protects placement, not stale denormalized subscription content. For an authorized subscription edit or backup-gated global remediation, a future pending locked row may have authoritative contact/address, employee, source label, and task rows replaced. Its order id, `plannedAt`, `startAt`, lock flag, and `sourceWeek` survive. If its `sourceWeek` is no longer expected, it is removed like any other stale future recurrence row.

## Duration policy

Task rows copied to regenerated orders mirror `TaskLine.durationMin` exactly, including zero. Calendar presentation continues to apply the existing non-persistent 60-minute fallback. Reconciliation never writes that fallback into either subscription tasks or order tasks.

## Operational interfaces

- `GET /api/subscriptions/recurrence-audit`: admin-only, read-only global dry run. It reports aggregate changes and identifiers, with no customer PII and no apply endpoint.
- `auditSubscriptionOrderConsistency()`: reusable read-only service.
- `applySubscriptionOrderReconciliation()`: global transaction-safe apply. It fails closed unless `RECURRENCE_RECONCILIATION_BACKUP_PROOF` is configured and the caller supplies the exact proof. No production write should be run until an independently verified backup has produced that proof.
- Subscription edits call `reconcileEditedSubscriptionInTransaction()` in the same transaction as the authoritative edit, preventing new divergence.

## Determinism and safety

The pure planner sorts by subscription/week/order id, uses `(subscriptionId, sourceWeek)` as the recurrence identity, deterministically keeps the lowest-id duplicate, and emits create/update/delete sets. Apply recomputes inside a serializable transaction and retries Prisma `P2034` conflicts. A second run against reconciled state has zero changes.
