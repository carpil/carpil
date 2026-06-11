import { initializeApp, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { runTripRequestExpirySweep } from './scheduled/trip-request-expiry'

initializeApp()

const REGION = 'us-central1'

export const healthcheck = onRequest({ region: REGION }, (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'carpil-functions' })
})

// Single Firebase project, three Firestore DBs ((default)/staging/prod). One named
// export per DB, each pinned to its database id (per the Functions deploy strategy).
const expirySweepFor = (databaseId: string): ReturnType<typeof onSchedule> =>
  onSchedule({ schedule: 'every 15 minutes', region: REGION }, async () => {
    const db = getFirestore(getApp(), databaseId)
    const result = await runTripRequestExpirySweep(db)
    console.log(`[trip-request-expiry] db=${databaseId} expired=${result.expired} reverted=${result.reverted}`)
  })

export const tripRequestExpirySweepDefault = expirySweepFor('(default)')
export const tripRequestExpirySweepStaging = expirySweepFor('staging')
export const tripRequestExpirySweepProd = expirySweepFor('prod')
