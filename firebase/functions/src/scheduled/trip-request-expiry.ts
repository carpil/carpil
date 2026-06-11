import { Firestore, Timestamp } from 'firebase-admin/firestore'

export interface ExpirySweepResult {
  expired: number
  reverted: number
}

// Lifecycle housekeeping for passenger demand (MS1.4). Two passes:
//   1. open|matching requests whose demand window has passed -> expired
//   2. matching requests whose driver proposal deadline passed (but the window is
//      still valid) -> back to open so other drivers can pick them up
// Pure transition logic; idempotent (re-running on already-final docs is a no-op).
// NOTE: pushing `demand_expired` to creators is deferred until the functions
// package gains the Expo sender (shared with CARPIL-247/326).
export const runTripRequestExpirySweep = async (db: Firestore): Promise<ExpirySweepResult> => {
  const now = Timestamp.now()
  let expired = 0
  let reverted = 0

  const windowExpired = await db.collection('trip_requests')
    .where('status', 'in', ['open', 'matching'])
    .where('expiresAt', '<', now)
    .get()
  for (const doc of windowExpired.docs) {
    await doc.ref.update({ status: 'expired', updatedAt: now })
    expired++
  }

  const stillMatching = await db.collection('trip_requests')
    .where('status', '==', 'matching')
    .get()
  for (const doc of stillMatching.docs) {
    const proposalExpiresAt = doc.data().proposedByDriver?.expiresAt as Timestamp | undefined
    if (proposalExpiresAt != null && proposalExpiresAt.toMillis() < now.toMillis()) {
      await doc.ref.update({ status: 'open', proposedByDriver: null, updatedAt: now })
      reverted++
    }
  }

  return { expired, reverted }
}
