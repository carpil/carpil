import { beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'

import {
  buildUserInfo,
  firestoreAs,
  firstDocSnapshot,
  seedRide,
  unauthenticatedFirestore,
  useRulesTestEnvironment
} from './helpers'

// V4: rides were world-readable and client-writable. The ride screen only needs to listen
// to one ride doc (useRealtimeRide); joining, pricing and cancelling go through the API.

const RIDE_ID = 'ride-heredia-sanpedro'
const DRIVER_UID = 'driver1'
const PASSENGER_UID = 'passenger1'
const STRANGER_UID = 'stranger'

useRulesTestEnvironment()

beforeEach(async () => {
  await seedRide(RIDE_ID, { driverId: DRIVER_UID, passengerIds: [PASSENGER_UID] })
})

describe('rides/{rideId}: signed-in clients can open one ride (V4)', () => {
  it('[AC5] lets a signed-in non-participant get a ride', async () => {
    await assertSucceeds(getDoc(doc(firestoreAs(STRANGER_UID), 'rides', RIDE_ID)))
  })

  it('[AC5] lets a signed-in non-participant listen to a ride like useRealtimeRide does', async () => {
    await assertSucceeds(firstDocSnapshot(doc(firestoreAs(STRANGER_UID), 'rides', RIDE_ID)))
  })

  it('[AC5] lets a signed-in user get a ride id that does not exist', async () => {
    const missingRide = doc(firestoreAs(STRANGER_UID), 'rides', 'ride-that-was-never-created')

    await assertSucceeds(getDoc(missingRide))
    await assertSucceeds(firstDocSnapshot(missingRide))
  })

  it('[AC5] denies an unauthenticated get', async () => {
    await assertFails(getDoc(doc(unauthenticatedFirestore(), 'rides', RIDE_ID)))
  })
})

describe('rides: no bulk listing (V4)', () => {
  it('[AC5] denies a signed-in user listing every ride', async () => {
    await assertFails(getDocs(collection(firestoreAs(STRANGER_UID), 'rides')))
  })

  it('[AC5] denies a signed-in user querying active rides', async () => {
    const db = firestoreAs(STRANGER_UID)

    await assertFails(getDocs(query(collection(db, 'rides'), where('status', '==', 'active'))))
  })

  it('[AC5] denies a signed-in user paging rides one at a time', async () => {
    await assertFails(getDocs(query(collection(firestoreAs(STRANGER_UID), 'rides'), limit(1))))
  })

  it('[AC5] denies the driver listing only their own rides', async () => {
    const db = firestoreAs(DRIVER_UID)

    await assertFails(getDocs(query(collection(db, 'rides'), where('driver.id', '==', DRIVER_UID), limit(1))))
  })

  it('[AC5] denies an unauthenticated listing', async () => {
    await assertFails(getDocs(collection(unauthenticatedFirestore(), 'rides')))
  })
})

describe('rides/{rideId}: every write goes through the API (V4)', () => {
  it('[AC5] denies a user appending themselves to passengers and passengerIds', async () => {
    const db = firestoreAs(STRANGER_UID)

    await assertFails(
      updateDoc(doc(db, 'rides', RIDE_ID), {
        passengers: [buildUserInfo(PASSENGER_UID), buildUserInfo(STRANGER_UID)],
        passengerIds: arrayUnion(STRANGER_UID)
      })
    )
  })

  it('[AC5] denies a user appending their bare uid to passengers', async () => {
    const db = firestoreAs(STRANGER_UID)

    await assertFails(updateDoc(doc(db, 'rides', RIDE_ID), { passengers: arrayUnion(STRANGER_UID) }))
  })

  it('[AC5] denies the driver changing the price', async () => {
    await assertFails(updateDoc(doc(firestoreAs(DRIVER_UID), 'rides', RIDE_ID), { price: 1 }))
  })

  it('[AC5] denies the driver changing availableSeats', async () => {
    await assertFails(updateDoc(doc(firestoreAs(DRIVER_UID), 'rides', RIDE_ID), { availableSeats: 10 }))
  })

  it('[AC5] denies the driver changing the status', async () => {
    await assertFails(updateDoc(doc(firestoreAs(DRIVER_UID), 'rides', RIDE_ID), { status: 'completed' }))
  })

  it('[AC5] denies the driver soft-deleting the ride', async () => {
    await assertFails(updateDoc(doc(firestoreAs(DRIVER_UID), 'rides', RIDE_ID), { deletedAt: new Date() }))
  })

  it('[AC5] denies a passenger changing the price', async () => {
    await assertFails(updateDoc(doc(firestoreAs(PASSENGER_UID), 'rides', RIDE_ID), { price: 1 }))
  })

  it('[AC5] denies a user creating a ride with themselves as the driver', async () => {
    const db = firestoreAs(STRANGER_UID)

    await assertFails(
      setDoc(doc(db, 'rides', 'ride-forged'), {
        id: 'ride-forged',
        driver: buildUserInfo(STRANGER_UID),
        passengers: [],
        passengerIds: [],
        availableSeats: 3,
        price: 1000,
        status: 'active',
        deletedAt: null
      })
    )
  })

  it('[AC5] denies the driver deleting the ride', async () => {
    await assertFails(deleteDoc(doc(firestoreAs(DRIVER_UID), 'rides', RIDE_ID)))
  })
})
