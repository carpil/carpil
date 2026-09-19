import { beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Firestore
} from 'firebase/firestore'

import {
  buildChat,
  buildMessage,
  buildUser,
  firstQuerySnapshot,
  NAMED_DATABASE_IDS,
  namedFirestoreAs,
  seedChat,
  seedNamedDatabaseDoc,
  useNamedDatabases,
  useRulesTestEnvironment
} from './helpers'

// Staging and prod live in named databases of the same project, so a rule whose get() path
// hardcodes (default) instead of $(database) passes every other file and breaks chat in prod.

const OWNER_UID = 'alice'
const CHAT_ID = 'chat-heredia-sanpedro'
const MESSAGE_ID = 'message-1'
const DRIVER_UID = 'driver1'
const PASSENGER_UID = 'p1'
const OUTSIDER_UID = 'mallory'

useRulesTestEnvironment()
useNamedDatabases(NAMED_DATABASE_IDS)

const messagesQuery = (db: Firestore) =>
  query(collection(doc(db, 'chats', CHAT_ID), 'messages'), orderBy('createdAt', 'asc'))

describe.each(NAMED_DATABASE_IDS)('the %s database enforces the same rules', (databaseId) => {
  beforeEach(async () => {
    await seedNamedDatabaseDoc(databaseId, `users/${OWNER_UID}`, buildUser(OWNER_UID))
    await seedNamedDatabaseDoc(
      databaseId,
      `chats/${CHAT_ID}`,
      buildChat(CHAT_ID, { ownerId: DRIVER_UID, participants: [DRIVER_UID, PASSENGER_UID] })
    )
    await seedNamedDatabaseDoc(
      databaseId,
      `chats/${CHAT_ID}/messages/${MESSAGE_ID}`,
      buildMessage(MESSAGE_ID, { senderId: DRIVER_UID, seenBy: [DRIVER_UID] })
    )
    await seedChat(CHAT_ID, { ownerId: OUTSIDER_UID, participants: [OUTSIDER_UID] })
  })

  it('[AC1] denies the owner self-approving KYC', async () => {
    const db = namedFirestoreAs(databaseId, OWNER_UID)

    await assertFails(
      setDoc(doc(db, 'users', OWNER_UID), { verification: { kyc: { status: 'approved' } } }, { merge: true })
    )
  })

  it('[AC8] lets a participant run the messages listener, checked against this database', async () => {
    await assertSucceeds(firstQuerySnapshot(messagesQuery(namedFirestoreAs(databaseId, PASSENGER_UID))))
  })

  it("[AC8] denies a user outside this database's chat, even though they are a participant in (default)", async () => {
    await assertFails(getDocs(messagesQuery(namedFirestoreAs(databaseId, OUTSIDER_UID))))
  })

  it('[AC9] lets a participant mark a message as seen', async () => {
    const db = namedFirestoreAs(databaseId, PASSENGER_UID)

    await assertSucceeds(
      updateDoc(doc(db, 'chats', CHAT_ID, 'messages', MESSAGE_ID), { seenBy: arrayUnion(PASSENGER_UID) })
    )
  })
})
