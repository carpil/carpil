import { logger } from 'firebase-functions'
import { onSchedule, ScheduledEvent } from 'firebase-functions/v2/scheduler'
import { getApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { sendPushNotifications } from '../push/send'

const REGION = 'us-central1'
const SCHEDULE = 'every 1 minutes'
const AUTO_CANCEL_AFTER_MS = 45 * 60 * 1000

const RIDE_STATUS_ACTIVE = 'active'
const RIDE_STATUS_CANCELLED = 'cancelled'

interface RideDoc {
  id: string
  status: string
  departureDate: Timestamp | null
  deletedAt: Timestamp | null
  driver: { id: string, name?: string }
  passengers?: Array<{ id: string, name?: string }>
}

interface UserDoc {
  pushToken?: string[]
}

const autoCancel = async (databaseId: string): Promise<void> => {
  const db = getFirestore(getApp(), databaseId)
  const now = Date.now()
  const cutoff = Timestamp.fromMillis(now - AUTO_CANCEL_AFTER_MS)

  const snap = await db
    .collection('rides')
    .where('status', '==', RIDE_STATUS_ACTIVE)
    .where('deletedAt', '==', null)
    .where('departureDate', '<=', cutoff)
    .get()

  if (snap.empty) {
    logger.debug('ride-lifecycle: no expired rides', { databaseId })
    return
  }

  logger.info('ride-lifecycle: cancelling expired rides', {
    databaseId,
    count: snap.size
  })

  for (const doc of snap.docs) {
    const ride = { id: doc.id, ...(doc.data() as Omit<RideDoc, 'id'>) }
    try {
      await cancelOneRide(db, ride, databaseId)
    } catch (err) {
      logger.error('ride-lifecycle: failed to cancel ride', {
        databaseId,
        rideId: ride.id,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
}

const cancelOneRide = async (
  db: FirebaseFirestore.Firestore,
  ride: RideDoc,
  databaseId: string
): Promise<void> => {
  const nowDate = new Date()

  await db.collection('rides').doc(ride.id).update({
    status: RIDE_STATUS_CANCELLED,
    cancelledAt: nowDate,
    updatedAt: nowDate
  })

  if (ride.driver?.id) {
    await db.collection('users').doc(ride.driver.id).update({
      currentRideId: null,
      inRide: false
    })
  }

  const passengers = Array.isArray(ride.passengers) ? ride.passengers : []
  if (passengers.length === 0) {
    logger.info('ride-lifecycle: cancelled ride (no passengers)', {
      databaseId,
      rideId: ride.id
    })
    return
  }

  const deviceTokens: string[] = []
  for (const passenger of passengers) {
    const userSnap = await db.collection('users').doc(passenger.id).get()
    const user = userSnap.data() as UserDoc | undefined
    deviceTokens.push(...(user?.pushToken ?? []))
  }

  if (deviceTokens.length > 0) {
    await sendPushNotifications({
      pushTokens: deviceTokens,
      title: 'Viaje cancelado',
      body: 'Tu viaje fue cancelado por inactividad.',
      data: { rideId: ride.id, url: `carpil://ride/${ride.id}?source=push` }
    })
  }

  logger.info('ride-lifecycle: cancelled ride + notified passengers', {
    databaseId,
    rideId: ride.id,
    passengerCount: passengers.length,
    notified: deviceTokens.length
  })
}

const buildScheduler = (databaseId: string) =>
  onSchedule({ schedule: SCHEDULE, region: REGION }, async (_event: ScheduledEvent) => {
    await autoCancel(databaseId)
  })

export const rideLifecycleDev = buildScheduler('(default)')
export const rideLifecycleStaging = buildScheduler('staging')
export const rideLifecycleProd = buildScheduler('prod')
