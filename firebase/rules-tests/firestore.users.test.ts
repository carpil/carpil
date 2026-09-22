import { beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type UpdateData
} from 'firebase/firestore'

import {
  firestoreAs,
  firstDocSnapshot,
  seedUser,
  unauthenticatedFirestore,
  useRulesTestEnvironment
} from './helpers'

// V2: verification.*, role and isDriver gate privileged API actions
// (api/src/middlewares/verification.middleware.ts), so a client write to its own
// users doc was a self-approval. The Admin SDK owns this doc; the client only listens.

const OWNER_UID = 'alice'
const OTHER_UID = 'mallory'
const NEW_SIGNUP_UID = 'newbie'

useRulesTestEnvironment()

beforeEach(async () => {
  await seedUser(OWNER_UID, { pendingPaymentRideIds: ['ride-unpaid'], averageRating: 3.1 })
})

const ownerUserDoc = () => doc(firestoreAs(OWNER_UID), 'users', OWNER_UID)

describe('users/{uid}: the owner cannot self-approve verification (V2)', () => {
  it('[AC1] denies self-approving KYC with setDoc merge', async () => {
    await assertFails(
      setDoc(ownerUserDoc(), { verification: { kyc: { status: 'approved' } } }, { merge: true })
    )
  })

  it('[AC1] denies self-verifying the phone with setDoc merge', async () => {
    await assertFails(
      setDoc(ownerUserDoc(), { verification: { phone: { verified: true } } }, { merge: true })
    )
  })

  it('[AC1] denies self-granting the grandfathered KYC bypass with setDoc merge', async () => {
    await assertFails(
      setDoc(ownerUserDoc(), { verification: { kyc: { grandfathered: true } } }, { merge: true })
    )
  })

  it("[AC1] denies updateDoc on 'verification.kyc.status'", async () => {
    await assertFails(updateDoc(ownerUserDoc(), 'verification.kyc.status', 'approved'))
  })

  it("[AC1] denies updateDoc on 'verification.phone.verified'", async () => {
    await assertFails(updateDoc(ownerUserDoc(), 'verification.phone.verified', true))
  })

  it("[AC1] denies updateDoc on 'verification.kyc.grandfathered'", async () => {
    await assertFails(updateDoc(ownerUserDoc(), 'verification.kyc.grandfathered', true))
  })
})

describe('users/{uid}: the owner cannot write privileged or bootstrap fields (V2)', () => {
  it('[AC2] denies self-promoting to super_admin', async () => {
    await assertFails(setDoc(ownerUserDoc(), { role: 'super_admin' }, { merge: true }))
  })

  it('[AC2] denies self-flagging isDriver', async () => {
    await assertFails(setDoc(ownerUserDoc(), { isDriver: true }, { merge: true }))
  })

  it('[AC2] denies self-setting driverStatus', async () => {
    await assertFails(setDoc(ownerUserDoc(), { driverStatus: 'approved' }, { merge: true }))
  })

  it('[AC2] denies the legacy updateUserState bootstrap payload', async () => {
    await assertFails(
      setDoc(
        ownerUserDoc(),
        {
          lastUpdated: new Date(),
          currentRideId: 'ride_42',
          inRide: true,
          isDriver: true,
          pendingReviewRideIds: []
        },
        { merge: true }
      )
    )
  })
})

// A field blocklist (verification, role, isDriver...) would pass every test above, so these
// pin the rule to deny-all: the owner cannot write even fields that look harmless.
const unprivilegedUpdates: Array<{ label: string, update: UpdateData<DocumentData> }> = [
  { label: 'lastUpdated alone', update: { lastUpdated: new Date() } },
  { label: 'their display name', update: { name: 'Alice Renamed' } },
  { label: 'activeMode', update: { activeMode: 'driver' } },
  { label: 'a push token via arrayUnion', update: { pushToken: arrayUnion('ExponentPushToken[forged]') } },
  { label: 'pendingPaymentRideIds cleared to skip paying', update: { pendingPaymentRideIds: [] } },
  { label: 'an inflated averageRating', update: { averageRating: 5 } }
]

describe('users/{uid}: the owner cannot write any field, not just privileged ones (V2)', () => {
  it.each(unprivilegedUpdates)('[AC2] denies the owner updating $label', async ({ update }) => {
    await assertFails(updateDoc(ownerUserDoc(), update))
  })
})

describe('users/{uid}: create and delete stay server-side (V2)', () => {
  it('[AC3] denies a new user creating their own doc before the API does', async () => {
    const db = firestoreAs(NEW_SIGNUP_UID)

    await assertFails(
      setDoc(doc(db, 'users', NEW_SIGNUP_UID), {
        name: 'Newbie',
        verification: { kyc: { status: 'approved' } }
      })
    )
  })

  it('[AC3] denies the owner deleting their own doc', async () => {
    await assertFails(deleteDoc(ownerUserDoc()))
  })

  it("[AC3] denies another signed-in user writing someone else's doc", async () => {
    const db = firestoreAs(OTHER_UID)

    await assertFails(
      setDoc(doc(db, 'users', OWNER_UID), { verification: { kyc: { status: 'approved' } } }, { merge: true })
    )
  })

  it("[AC3] denies another signed-in user deleting someone else's doc", async () => {
    await assertFails(deleteDoc(doc(firestoreAs(OTHER_UID), 'users', OWNER_UID)))
  })
})

describe('users/{uid}: reads are limited to the owner listening to their own doc (V2)', () => {
  it('[AC4] lets the owner get their own doc', async () => {
    await assertSucceeds(getDoc(ownerUserDoc()))
  })

  it('[AC4] lets the owner listen to their own doc like subscribeToUser does', async () => {
    await assertSucceeds(firstDocSnapshot(ownerUserDoc()))
  })

  it('[AC4] lets a brand-new signup listen to their own doc before the API creates it', async () => {
    const newSignupDoc = doc(firestoreAs(NEW_SIGNUP_UID), 'users', NEW_SIGNUP_UID)

    await assertSucceeds(getDoc(newSignupDoc))
    await assertSucceeds(firstDocSnapshot(newSignupDoc))
  })

  it("[AC4] denies another signed-in user reading someone else's doc", async () => {
    await assertFails(getDoc(doc(firestoreAs(OTHER_UID), 'users', OWNER_UID)))
  })

  it('[AC4] denies an unauthenticated read', async () => {
    await assertFails(getDoc(doc(unauthenticatedFirestore(), 'users', OWNER_UID)))
  })

  it('[AC4] denies listing the users collection', async () => {
    await assertFails(getDocs(collection(firestoreAs(OWNER_UID), 'users')))
  })

  it("[AC4] denies a query scoped to the caller's own id", async () => {
    const db = firestoreAs(OWNER_UID)

    await assertFails(getDocs(query(collection(db, 'users'), where('id', '==', OWNER_UID))))
  })

  it('[AC4] denies paging the users collection one doc at a time', async () => {
    await assertFails(getDocs(query(collection(firestoreAs(OWNER_UID), 'users'), limit(1))))
  })

  it('[AC4] denies a collection-group query over every users collection', async () => {
    await assertFails(getDocs(collectionGroup(firestoreAs(OTHER_UID), 'users')))
  })
})
