import { beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  addDoc,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore
} from 'firebase/firestore'

import {
  firestoreAs,
  firstQuerySnapshot,
  seedChat,
  seedMessage,
  unauthenticatedFirestore,
  useRulesTestEnvironment
} from './helpers'

// V4: any signed-in user could read or rewrite any chat and add themselves as a participant.
// The app only reads messages and marks them seen (app/(app)/chats/[chatId].tsx); the API
// owns chat docs and message creation.

const CHAT_ID = 'chat-heredia-sanpedro'
const MESSAGE_ID = 'message-1'
const DRIVER_UID = 'driver1'
const PASSENGER_UID = 'p1'
const OTHER_PASSENGER_UID = 'p2'
const OUTSIDER_UID = 'mallory'

useRulesTestEnvironment()

beforeEach(async () => {
  await seedChat(CHAT_ID, {
    ownerId: DRIVER_UID,
    participants: [DRIVER_UID, PASSENGER_UID, OTHER_PASSENGER_UID]
  })
})

const messagesQuery = (db: Firestore) =>
  query(collection(doc(db, 'chats', CHAT_ID), 'messages'), orderBy('createdAt', 'asc'))

const messageDoc = (db: Firestore) => doc(db, 'chats', CHAT_ID, 'messages', MESSAGE_ID)

const markSeenLikeTheApp = async (db: Firestore, userId: string): Promise<void> => {
  const snapshot = await getDoc(messageDoc(db))
  const seenBy: string[] = snapshot.data()?.seenBy ?? []
  await updateDoc(messageDoc(db), { seenBy: [...seenBy, userId] })
}

describe('chats/{chatId}: the parent doc is API-only (V4)', () => {
  it('[AC7] denies a participant getting the chat doc', async () => {
    await assertFails(getDoc(doc(firestoreAs(PASSENGER_UID), 'chats', CHAT_ID)))
  })

  it("[AC7] denies a participant querying the chats they're in", async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(
      getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', PASSENGER_UID)))
    )
  })

  it('[AC7] denies an outsider adding themselves to participants', async () => {
    const db = firestoreAs(OUTSIDER_UID)

    await assertFails(updateDoc(doc(db, 'chats', CHAT_ID), { participants: arrayUnion(OUTSIDER_UID) }))
  })

  it('[AC7] denies the owner deleting the chat', async () => {
    await assertFails(deleteDoc(doc(firestoreAs(DRIVER_UID), 'chats', CHAT_ID)))
  })

  it('[AC7] denies a signed-in user creating a chat', async () => {
    const db = firestoreAs(OUTSIDER_UID)

    await assertFails(
      setDoc(doc(db, 'chats', 'chat-forged'), {
        id: 'chat-forged',
        participants: [OUTSIDER_UID, DRIVER_UID],
        owner: OUTSIDER_UID,
        rideId: 'ride-heredia-sanpedro'
      })
    )
  })
})

describe('chats/{chatId}/messages: only participants read (V4)', () => {
  beforeEach(async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, { senderId: DRIVER_UID, seenBy: [DRIVER_UID] })
  })

  it('[AC8] lets a participant run the exact messages listener the app uses', async () => {
    await assertSucceeds(firstQuerySnapshot(messagesQuery(firestoreAs(PASSENGER_UID))))
  })

  it('[AC8] lets a participant get the messages once', async () => {
    await assertSucceeds(getDocs(messagesQuery(firestoreAs(PASSENGER_UID))))
  })

  it('[AC8] denies a non-participant querying the messages', async () => {
    await assertFails(getDocs(messagesQuery(firestoreAs(OUTSIDER_UID))))
  })

  it('[AC8] denies a non-participant getting one message', async () => {
    await assertFails(getDoc(messageDoc(firestoreAs(OUTSIDER_UID))))
  })

  it('[AC8] denies an unauthenticated query', async () => {
    await assertFails(getDocs(messagesQuery(unauthenticatedFirestore())))
  })

  it("[AC8] denies a participant a collection-group query over every chat's messages", async () => {
    await assertFails(getDocs(collectionGroup(firestoreAs(PASSENGER_UID), 'messages')))
  })
})

describe('chats/{chatId}/messages: participants may only mark themselves as seen (V4)', () => {
  beforeEach(async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, { senderId: DRIVER_UID, seenBy: [DRIVER_UID] })
  })

  it('[AC9] lets a participant mark seen with the app overwrite [...seenBy, me]', async () => {
    await assertSucceeds(markSeenLikeTheApp(firestoreAs(PASSENGER_UID), PASSENGER_UID))
  })

  it('[AC9] lets a participant mark seen with arrayUnion(me)', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertSucceeds(updateDoc(messageDoc(db), { seenBy: arrayUnion(PASSENGER_UID) }))
  })

  it('[AC9] lets a participant re-write seenBy when they are already in it', async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, { senderId: DRIVER_UID, seenBy: [DRIVER_UID, PASSENGER_UID] })
    const db = firestoreAs(PASSENGER_UID)

    await assertSucceeds(updateDoc(messageDoc(db), { seenBy: [DRIVER_UID, PASSENGER_UID] }))
    await assertSucceeds(updateDoc(messageDoc(db), { seenBy: arrayUnion(PASSENGER_UID) }))
  })

  it('[AC9] tolerates a stale overwrite that drops a concurrent reader', async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, {
      senderId: DRIVER_UID,
      seenBy: [DRIVER_UID, OTHER_PASSENGER_UID]
    })
    const db = firestoreAs(PASSENGER_UID)

    await assertSucceeds(updateDoc(messageDoc(db), { seenBy: [DRIVER_UID, PASSENGER_UID] }))
  })

  it('[AC9] denies adding another participant with an overwrite', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(updateDoc(messageDoc(db), { seenBy: [DRIVER_UID, OTHER_PASSENGER_UID] }))
  })

  it('[AC9] denies adding another participant with arrayUnion', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(updateDoc(messageDoc(db), { seenBy: arrayUnion(OTHER_PASSENGER_UID) }))
  })

  it('[AC9] denies adding another participant once the caller is already in seenBy', async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, { senderId: DRIVER_UID, seenBy: [DRIVER_UID, PASSENGER_UID] })
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(
      updateDoc(messageDoc(db), { seenBy: [DRIVER_UID, PASSENGER_UID, OTHER_PASSENGER_UID] })
    )
    await assertFails(updateDoc(messageDoc(db), { seenBy: arrayUnion(OTHER_PASSENGER_UID) }))
  })

  it('[AC9] denies growing seenBy by more than one entry', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(
      updateDoc(messageDoc(db), { seenBy: [DRIVER_UID, PASSENGER_UID, PASSENGER_UID] })
    )
  })

  it('[AC9] denies seenBy as a string', async () => {
    await assertFails(updateDoc(messageDoc(firestoreAs(PASSENGER_UID)), { seenBy: PASSENGER_UID }))
  })

  it('[AC9] denies seenBy as a map', async () => {
    await assertFails(updateDoc(messageDoc(firestoreAs(PASSENGER_UID)), { seenBy: { 0: PASSENGER_UID } }))
  })

  it('[AC9] denies deleting seenBy with deleteField()', async () => {
    await assertFails(updateDoc(messageDoc(firestoreAs(PASSENGER_UID)), { seenBy: deleteField() }))
  })

  it('[AC9] denies wiping seenBy to an empty list', async () => {
    await assertFails(updateDoc(messageDoc(firestoreAs(PASSENGER_UID)), { seenBy: [] }))
  })

  it('[AC9] denies an overwrite that leaves the caller out of seenBy', async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, { senderId: DRIVER_UID, seenBy: [DRIVER_UID, PASSENGER_UID] })

    await assertFails(updateDoc(messageDoc(firestoreAs(PASSENGER_UID)), { seenBy: [DRIVER_UID] }))
  })

  it('[AC9] denies a participant rewriting the content', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(updateDoc(messageDoc(db), { content: 'U2FsdGVkX1+forged' }))
  })

  it('[AC9] denies rewriting the content while marking seen', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(
      updateDoc(messageDoc(db), {
        content: 'U2FsdGVkX1+forged',
        seenBy: arrayUnion(PASSENGER_UID)
      })
    )
  })

  it('[AC9] denies a participant re-attributing the message to themselves', async () => {
    await assertFails(updateDoc(messageDoc(firestoreAs(PASSENGER_UID)), { userId: PASSENGER_UID }))
  })

  it('[AC9] denies backdating createdAt while marking seen', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(
      updateDoc(messageDoc(db), {
        createdAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
        seenBy: arrayUnion(PASSENGER_UID)
      })
    )
  })

  it('[AC9] denies adding a new field while marking seen', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(updateDoc(messageDoc(db), { deletedAt: new Date(), seenBy: arrayUnion(PASSENGER_UID) }))
  })

  it('[AC9] denies the sender editing their own message content', async () => {
    await assertFails(updateDoc(messageDoc(firestoreAs(DRIVER_UID)), { content: 'U2FsdGVkX1+edited' }))
  })

  it('[AC9] lets the sender re-mark their own message as seen', async () => {
    await assertSucceeds(updateDoc(messageDoc(firestoreAs(DRIVER_UID)), { seenBy: arrayUnion(DRIVER_UID) }))
  })

  it('[AC9] denies a participant creating a message', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(
      addDoc(collection(db, 'chats', CHAT_ID, 'messages'), {
        content: 'U2FsdGVkX1+forged',
        userId: PASSENGER_UID,
        createdAt: new Date(),
        seenBy: []
      })
    )
  })

  it('[AC9] denies a participant deleting a message', async () => {
    await assertFails(deleteDoc(messageDoc(firestoreAs(PASSENGER_UID))))
  })

  it('[AC9] denies a non-participant marking a message as seen', async () => {
    const db = firestoreAs(OUTSIDER_UID)

    await assertFails(updateDoc(messageDoc(db), { seenBy: arrayUnion(OUTSIDER_UID) }))
  })
})

describe('chats/{chatId}/messages: messages created without seenBy', () => {
  beforeEach(async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, { senderId: DRIVER_UID })
  })

  it('[AC9] lets a participant mark seen when the message has no seenBy field', async () => {
    await assertSucceeds(markSeenLikeTheApp(firestoreAs(PASSENGER_UID), PASSENGER_UID))
  })

  it('[AC9] lets a participant mark seen with arrayUnion when seenBy is missing', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertSucceeds(updateDoc(messageDoc(db), { seenBy: arrayUnion(PASSENGER_UID) }))
  })
})

describe('chats/{chatId}/messages: messages stored with seenBy: null', () => {
  beforeEach(async () => {
    await seedMessage(CHAT_ID, MESSAGE_ID, { senderId: DRIVER_UID, seenBy: null })
  })

  it('[AC9] lets a participant mark seen with the app overwrite when seenBy is null', async () => {
    await assertSucceeds(markSeenLikeTheApp(firestoreAs(PASSENGER_UID), PASSENGER_UID))
  })

  it('[AC9] lets a participant mark seen with arrayUnion when seenBy is null', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertSucceeds(updateDoc(messageDoc(db), { seenBy: arrayUnion(PASSENGER_UID) }))
  })

  it('[AC9] denies adding another participant when seenBy is null', async () => {
    const db = firestoreAs(PASSENGER_UID)

    await assertFails(updateDoc(messageDoc(db), { seenBy: [OTHER_PASSENGER_UID] }))
  })
})
