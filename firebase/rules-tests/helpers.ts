import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  onSnapshot,
  setDoc,
  setLogLevel,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type EmulatorMockTokenOptions,
  type Firestore,
  type Query,
  type QuerySnapshot
} from 'firebase/firestore'
import { ref, uploadBytes, type FirebaseStorage } from 'firebase/storage'

const PROJECT_ID = 'demo-carpil'
const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url))

export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

const readRules = (overridePath: string | undefined, defaultPath: string): string =>
  readFileSync(resolve(PACKAGE_DIR, overridePath ?? defaultPath), 'utf8')

const parseHostAndPort = (hostAndPort: string): { host: string, port: number } => {
  const separatorIndex = hostAndPort.lastIndexOf(':')
  return {
    host: hostAndPort.slice(0, separatorIndex),
    port: Number(hostAndPort.slice(separatorIndex + 1))
  }
}

const firestoreRules = (): string => readRules(process.env.FIRESTORE_RULES_PATH, '../firestore.rules')

const firestoreEmulator = (): { host: string, port: number } =>
  parseHostAndPort(process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080')

let testEnv: RulesTestEnvironment | undefined

const requireTestEnv = (): RulesTestEnvironment => {
  if (testEnv === undefined) {
    throw new Error('Call useRulesTestEnvironment() at the top of the test file first')
  }
  return testEnv
}

export const useRulesTestEnvironment = (): void => {
  beforeAll(async () => {
    setLogLevel('error')
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: firestoreRules(),
        ...firestoreEmulator()
      },
      storage: {
        rules: readRules(process.env.STORAGE_RULES_PATH, '../storage.rules'),
        ...parseHostAndPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199')
      }
    })
  })

  beforeEach(async () => {
    await requireTestEnv().clearFirestore()
    await requireTestEnv().clearStorage()
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    testEnv = undefined
  })
}

// rules-unit-testing hands out compat instances; the modular API accepts them at runtime.
const modularFirestore = (context: RulesTestContext): Firestore =>
  context.firestore() as unknown as Firestore

const modularStorage = (context: RulesTestContext): FirebaseStorage =>
  context.storage() as unknown as FirebaseStorage

export const firestoreAs = (uid: string): Firestore =>
  modularFirestore(requireTestEnv().authenticatedContext(uid))

export const unauthenticatedFirestore = (): Firestore =>
  modularFirestore(requireTestEnv().unauthenticatedContext())

export const storageAs = (uid: string): FirebaseStorage =>
  modularStorage(requireTestEnv().authenticatedContext(uid))

export const unauthenticatedStorage = (): FirebaseStorage =>
  modularStorage(requireTestEnv().unauthenticatedContext())

// firebase.json deploys the same rules to (default), staging and prod, but initializeTestEnvironment
// only loads them into (default); the other databases stay allow-all unless rules are pushed to them.
export const NAMED_DATABASE_IDS = ['staging', 'prod']

// The emulators treat this token as an admin that bypasses Security Rules.
const RULES_BYPASS_TOKEN = 'owner'

const namedDatabaseClients = new Map<string, { app: FirebaseApp, firestore: Firestore }>()

const callFirestoreEmulator = async (method: string, path: string, body?: unknown): Promise<void> => {
  const { host, port } = firestoreEmulator()
  const response = await fetch(`http://${host}:${port}${path}`, {
    method,
    headers: { Authorization: `Bearer ${RULES_BYPASS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (response.ok) return
  throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`)
}

const namedFirestore = (
  databaseId: string,
  caller: string,
  mockUserToken: EmulatorMockTokenOptions | string
): Firestore => {
  const clientName = `${databaseId}:${caller}`
  const existingClient = namedDatabaseClients.get(clientName)
  if (existingClient !== undefined) return existingClient.firestore

  const app = initializeApp({ projectId: PROJECT_ID }, clientName)
  const firestore = initializeFirestore(app, {}, databaseId)
  const { host, port } = firestoreEmulator()
  connectFirestoreEmulator(firestore, host, port, { mockUserToken })
  namedDatabaseClients.set(clientName, { app, firestore })
  return firestore
}

export const namedFirestoreAs = (databaseId: string, uid: string): Firestore =>
  namedFirestore(databaseId, `user-${uid}`, { sub: uid })

export const useNamedDatabases = (databaseIds: string[]): void => {
  beforeAll(async () => {
    for (const databaseId of databaseIds) {
      await callFirestoreEmulator('PUT', `/emulator/v1/projects/${PROJECT_ID}/databases/${databaseId}:securityRules`, {
        rules: { files: [{ name: 'firestore.rules', content: firestoreRules() }] }
      })
    }
  })

  beforeEach(async () => {
    for (const databaseId of databaseIds) {
      await callFirestoreEmulator('DELETE', `/emulator/v1/projects/${PROJECT_ID}/databases/${databaseId}/documents`)
    }
  })

  afterAll(async () => {
    await Promise.all([...namedDatabaseClients.values()].map(async ({ app }) => await deleteApp(app)))
    namedDatabaseClients.clear()
  })
}

export const seedNamedDatabaseDoc = async (
  databaseId: string,
  path: string,
  data: DocumentData
): Promise<void> => {
  await setDoc(doc(namedFirestore(databaseId, 'rules-bypass', RULES_BYPASS_TOKEN), path), data)
}

export const firstDocSnapshot = async (
  reference: DocumentReference
): Promise<DocumentSnapshot> =>
  await new Promise((resolveSnapshot, rejectSnapshot) => {
    const unsubscribe = onSnapshot(
      reference,
      (snapshot) => {
        unsubscribe()
        resolveSnapshot(snapshot)
      },
      rejectSnapshot
    )
  })

export const firstQuerySnapshot = async (query: Query): Promise<QuerySnapshot> =>
  await new Promise((resolveSnapshot, rejectSnapshot) => {
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        unsubscribe()
        resolveSnapshot(snapshot)
      },
      rejectSnapshot
    )
  })

export const seedDoc = async (path: string, data: DocumentData): Promise<void> => {
  await requireTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(modularFirestore(context), path), data)
  })
}

export const seedStorageObject = async (
  path: string,
  contentType = 'image/jpeg',
  bytes: Uint8Array = JPEG_BYTES
): Promise<void> => {
  await requireTestEnv().withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(modularStorage(context), path), bytes, { contentType })
  })
}

const SEEDED_AT = Timestamp.fromDate(new Date('2026-09-01T12:00:00Z'))
const DEPARTURE_AT = Timestamp.fromDate(new Date('2026-09-02T12:00:00Z'))

const profilePictureUrl = (uid: string): string =>
  `https://firebasestorage.googleapis.com/v0/b/demo-carpil.appspot.com/o/users%2F${uid}%2Fprofile.jpg?alt=media`

const buildLocation = (id: string, primary: string, lat: number, lng: number): DocumentData => ({
  id,
  name: { primary, secondary: 'San José, Costa Rica' },
  location: { lat, lng }
})

export const buildUserInfo = (uid: string): DocumentData => ({
  id: uid,
  name: `User ${uid}`,
  profilePicture: profilePictureUrl(uid)
})

export const buildUser = (uid: string, overrides: DocumentData = {}): DocumentData => ({
  name: `User ${uid}`,
  firstName: 'User',
  lastName: uid,
  email: `${uid}@example.com`,
  phoneNumber: '+50688887777',
  profilePicture: profilePictureUrl(uid),
  role: 'user',
  activeMode: 'passenger',
  profileCompleted: true,
  verification: {
    email: { verified: true },
    phone: { verified: false },
    kyc: { status: 'pending', grandfathered: false }
  },
  isDriver: false,
  driverStatus: null,
  vehicleId: null,
  driverApplicationId: null,
  currentRideId: null,
  inRide: false,
  pendingReviewRideIds: [],
  pendingPaymentRideIds: [],
  pushToken: [],
  averageRating: 5,
  stats: { ridesAsPassenger: 0, ridesAsDriver: 0 },
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
  ...overrides
})

export const seedUser = async (uid: string, overrides: DocumentData = {}): Promise<void> => {
  await seedDoc(`users/${uid}`, buildUser(uid, overrides))
}

export const seedRide = async (
  rideId: string,
  { driverId, passengerIds }: { driverId: string, passengerIds: string[] }
): Promise<void> => {
  await seedDoc(`rides/${rideId}`, {
    id: rideId,
    driver: { ...buildUserInfo(driverId), averageRating: 4.9 },
    passengers: passengerIds.map(buildUserInfo),
    passengerIds,
    availableSeats: 3 - passengerIds.length,
    price: 2500,
    origin: buildLocation('origin-place', 'Heredia Centro', 9.998, -84.117),
    destination: buildLocation('destination-place', 'San Pedro', 9.933, -84.051),
    meetingPoint: buildLocation('meeting-place', 'Parque de Heredia', 9.999, -84.116),
    departureDate: DEPARTURE_AT,
    status: 'active',
    chatId: `chat-${rideId}`,
    tripRequestId: null,
    deletedAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT
  })
}

interface ChatSeed { ownerId: string, participants: string[] }

export const buildChat = (chatId: string, { ownerId, participants }: ChatSeed): DocumentData => ({
  id: chatId,
  participants,
  owner: ownerId,
  rideId: `ride-for-${chatId}`,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT
})

export const seedChat = async (chatId: string, chat: ChatSeed): Promise<void> => {
  await seedDoc(`chats/${chatId}`, buildChat(chatId, chat))
}

interface MessageSeed { senderId: string, seenBy?: string[] | null }

export const buildMessage = (messageId: string, { senderId, seenBy }: MessageSeed): DocumentData => ({
  id: messageId,
  content: 'U2FsdGVkX1+0fYBqvLkQyKc3Q1Sxw8ZlqCEoUpg1xEY=',
  userId: senderId,
  createdAt: SEEDED_AT,
  ...(seenBy === undefined ? {} : { seenBy })
})

export const seedMessage = async (chatId: string, messageId: string, message: MessageSeed): Promise<void> => {
  await seedDoc(`chats/${chatId}/messages/${messageId}`, buildMessage(messageId, message))
}

export const seedDriverApplication = async (
  applicationId: string,
  userId: string
): Promise<void> => {
  await seedDoc(`driver_applications/${applicationId}`, {
    userId,
    fullName: `User ${userId}`,
    cedula: '112345678',
    address: 'Heredia, Costa Rica',
    whatsapp: '+50688887777',
    vehicle: {
      brand: 'Toyota',
      model: 'Yaris',
      year: 2018,
      color: 'Gris',
      plate: 'BCD123',
      availableSeats: 3
    },
    documents: { cedulaFront: '', cedulaBack: '', vehicleRegistration: '' },
    status: 'pending',
    currentStep: 3,
    reviewedBy: null,
    reviewNote: null,
    statusHistory: [{ status: 'draft', changedAt: SEEDED_AT, changedBy: 'system' }],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT
  })
}
