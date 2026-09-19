import { beforeEach, describe, it } from 'vitest'
import { assertFails } from '@firebase/rules-unit-testing'
import {
  addDoc,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore
} from 'firebase/firestore'

import {
  firestoreAs,
  seedDoc,
  seedDriverApplication,
  unauthenticatedFirestore,
  useRulesTestEnvironment
} from './helpers'

// V4/V16: the owner could read and rewrite their own driver application (status included),
// and the legacy ride_requests match was public. These collections are written and read
// only by the API through the Admin SDK.

const OWNER_UID = 'alice'
const APPLICATION_ID = 'application-1'
const RIDE_ID = 'ride-heredia-sanpedro'

useRulesTestEnvironment()

describe('driver_applications/{id}: API-only even for the applicant (V4/V16)', () => {
  beforeEach(async () => {
    await seedDriverApplication(APPLICATION_ID, OWNER_UID)
  })

  const ownerApplicationDoc = () => doc(firestoreAs(OWNER_UID), 'driver_applications', APPLICATION_ID)

  it('[AC10] denies the owner getting their application', async () => {
    await assertFails(getDoc(ownerApplicationDoc()))
  })

  it('[AC10] denies the owner querying their application by userId', async () => {
    const db = firestoreAs(OWNER_UID)

    await assertFails(
      getDocs(
        query(
          collection(db, 'driver_applications'),
          where('userId', '==', OWNER_UID),
          orderBy('createdAt', 'desc'),
          limit(1)
        )
      )
    )
  })

  it('[AC10] denies the owner creating an application', async () => {
    const db = firestoreAs(OWNER_UID)

    await assertFails(
      addDoc(collection(db, 'driver_applications'), {
        userId: OWNER_UID,
        fullName: 'Alice',
        cedula: '112345678',
        address: 'Heredia',
        whatsapp: '+50688887777',
        vehicle: null,
        documents: { cedulaFront: '', cedulaBack: '', vehicleRegistration: '' },
        status: 'draft',
        currentStep: 1,
        statusHistory: [{ status: 'draft', changedAt: new Date(), changedBy: 'system' }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    )
  })

  it('[AC10] denies the owner self-approving', async () => {
    await assertFails(updateDoc(ownerApplicationDoc(), { status: 'approved' }))
  })

  it('[AC10] denies the owner editing the form fields', async () => {
    await assertFails(
      updateDoc(ownerApplicationDoc(), {
        fullName: 'Alice Edited',
        cedula: '198765432',
        address: 'San José',
        whatsapp: '+50677776666',
        currentStep: 1,
        updatedAt: serverTimestamp()
      })
    )
  })

  it('[AC10] denies the owner sending the updateDriverApplicationStatus payload', async () => {
    await assertFails(
      updateDoc(ownerApplicationDoc(), {
        status: 'approved',
        reviewedBy: OWNER_UID,
        reviewNote: null,
        statusHistory: arrayUnion({ status: 'approved', changedAt: new Date(), changedBy: OWNER_UID }),
        updatedAt: serverTimestamp()
      })
    )
  })
})

const rideRequestCollections = ['ride-requests', 'ride_requests']

const clients: Array<{ label: string, firestore: () => Firestore }> = [
  { label: 'a signed-in user', firestore: () => firestoreAs(OWNER_UID) },
  { label: 'an unauthenticated client', firestore: unauthenticatedFirestore }
]

describe.each(rideRequestCollections)('%s: API-only (V4)', (collectionName) => {
  beforeEach(async () => {
    await seedDoc(`${collectionName}/request-1`, {
      id: 'request-1',
      creator: { id: 'bob', name: 'Bob', profilePicture: '' },
      status: 'active',
      departureDate: new Date('2026-09-02T12:00:00Z'),
      deletedAt: null
    })
  })

  describe.each(clients)('as $label', ({ firestore }) => {
    it(`[AC6] denies get on ${collectionName}`, async () => {
      await assertFails(getDoc(doc(firestore(), collectionName, 'request-1')))
    })

    it(`[AC6] denies list on ${collectionName}`, async () => {
      await assertFails(getDocs(collection(firestore(), collectionName)))
    })

    it(`[AC6] denies create on ${collectionName}`, async () => {
      await assertFails(
        setDoc(doc(firestore(), collectionName, 'request-forged'), {
          id: 'request-forged',
          creator: { id: OWNER_UID, name: 'Alice', profilePicture: '' },
          status: 'active',
          departureDate: new Date('2026-09-03T12:00:00Z')
        })
      )
    })
  })
})

describe('server-only collections stay closed to their owners (regression)', () => {
  it('[REG] denies the payer reading, listing or writing rides/{id}/payments', async () => {
    await seedDoc(`rides/${RIDE_ID}/payments/payment-1`, {
      id: 'payment-1',
      rideId: RIDE_ID,
      userId: OWNER_UID,
      amount: 2500,
      currency: 'crc',
      status: 'pending',
      paymentMethod: 'sinpe',
      attachmentUrl: 'https://firebasestorage.googleapis.com/receipt',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    const db = firestoreAs(OWNER_UID)
    const paymentDoc = doc(db, 'rides', RIDE_ID, 'payments', 'payment-1')

    await assertFails(getDoc(paymentDoc))
    await assertFails(getDocs(collection(db, 'rides', RIDE_ID, 'payments')))
    await assertFails(getDocs(query(collectionGroup(db, 'payments'), where('userId', '==', OWNER_UID))))
    await assertFails(updateDoc(paymentDoc, { status: 'succeeded' }))
  })

  it('[REG] denies the owner reading or marking users/{uid}/notifications', async () => {
    await seedDoc(`users/${OWNER_UID}/notifications/notification-1`, {
      id: 'notification-1',
      type: 'ride_joined',
      title: 'Nuevo pasajero',
      body: 'Bob se unió a tu viaje',
      data: {},
      read: false,
      createdAt: new Date()
    })
    const db = firestoreAs(OWNER_UID)
    const notificationDoc = doc(db, 'users', OWNER_UID, 'notifications', 'notification-1')

    await assertFails(getDoc(notificationDoc))
    await assertFails(getDocs(collection(db, 'users', OWNER_UID, 'notifications')))
    await assertFails(updateDoc(notificationDoc, { read: true }))
  })

  it('[REG] denies the owner reading or writing users/{uid}/recurring_routes', async () => {
    await seedDoc(`users/${OWNER_UID}/recurring_routes/route-1`, {
      id: 'route-1',
      userId: OWNER_UID,
      seats: 3,
      price: 2500,
      clusterKeys: ['d1u0:d1u1'],
      lastNotifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    const db = firestoreAs(OWNER_UID)

    await assertFails(getDoc(doc(db, 'users', OWNER_UID, 'recurring_routes', 'route-1')))
    await assertFails(getDocs(collection(db, 'users', OWNER_UID, 'recurring_routes')))
    await assertFails(
      setDoc(doc(db, 'users', OWNER_UID, 'recurring_routes', 'route-forged'), { userId: OWNER_UID })
    )
  })

  it('[REG] denies the creator reading, listing or writing trip_requests', async () => {
    await seedDoc('trip_requests/trip-1', {
      id: 'trip-1',
      creator: OWNER_UID,
      status: 'open',
      seatsNeeded: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    const db = firestoreAs(OWNER_UID)

    await assertFails(getDoc(doc(db, 'trip_requests', 'trip-1')))
    await assertFails(getDocs(query(collection(db, 'trip_requests'), where('creator', '==', OWNER_UID))))
    await assertFails(setDoc(doc(db, 'trip_requests', 'trip-forged'), { creator: OWNER_UID, status: 'open' }))
  })

  it('[REG] denies the rated user reading, listing or writing rides/{id}/ratings', async () => {
    await seedDoc(`rides/${RIDE_ID}/ratings/rating-1`, {
      id: 'rating-1',
      raterId: 'bob',
      targetUserId: OWNER_UID,
      rideId: RIDE_ID,
      rating: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    const db = firestoreAs(OWNER_UID)
    const ratingDoc = doc(db, 'rides', RIDE_ID, 'ratings', 'rating-1')

    await assertFails(getDoc(ratingDoc))
    await assertFails(
      getDocs(query(collection(db, 'rides', RIDE_ID, 'ratings'), where('targetUserId', '==', OWNER_UID)))
    )
    await assertFails(updateDoc(ratingDoc, { rating: 5 }))
    await assertFails(
      setDoc(doc(db, 'rides', RIDE_ID, 'ratings', 'rating-forged'), {
        raterId: OWNER_UID,
        targetUserId: 'bob',
        rideId: RIDE_ID,
        rating: 1
      })
    )
  })

  it('[REG] denies the owner reading or writing vehicles', async () => {
    await seedDoc('vehicles/vehicle-1', {
      id: 'vehicle-1',
      userId: OWNER_UID,
      applicationId: APPLICATION_ID,
      brand: 'Toyota',
      model: 'Yaris',
      year: 2018,
      color: 'Gris',
      plate: 'BCD123',
      availableSeats: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    const db = firestoreAs(OWNER_UID)

    await assertFails(getDoc(doc(db, 'vehicles', 'vehicle-1')))
    await assertFails(getDocs(query(collection(db, 'vehicles'), where('userId', '==', OWNER_UID))))
    await assertFails(setDoc(doc(db, 'vehicles', 'vehicle-forged'), { userId: OWNER_UID, plate: 'FAKE01' }))
  })
})
