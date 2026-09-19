import { describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
  updateMetadata,
  uploadBytes,
  type FirebaseStorage
} from 'firebase/storage'

import {
  JPEG_BYTES,
  seedStorageObject,
  storageAs,
  unauthenticatedStorage,
  useRulesTestEnvironment
} from './helpers'

// V9: SINPE receipts show the payer's name, phone and amount, and any signed-in user could
// read any of them. One bucket serves every environment, so these rules cannot consult
// Firestore to find the ride's driver.

const RIDE_ID = 'ride-heredia-sanpedro'
const PAYER_UID = 'p1'
const OTHER_UID = 'mallory'
const FIVE_MEBIBYTES = 5 * 1024 * 1024
const TEN_MEBIBYTES = 10 * 1024 * 1024

useRulesTestEnvironment()

const receiptPath = (uid: string): string => `rides/${RIDE_ID}/sinpe-payments/${uid}`
const profilePicturePath = (uid: string): string => `users/${uid}/profile.jpg`

const readActions: Array<{ name: string, read: (storage: FirebaseStorage, path: string) => Promise<unknown> }> = [
  { name: 'getMetadata', read: async (storage, path) => await getMetadata(ref(storage, path)) },
  { name: 'getBytes', read: async (storage, path) => await getBytes(ref(storage, path)) },
  { name: 'getDownloadURL', read: async (storage, path) => await getDownloadURL(ref(storage, path)) }
]

describe('rides/{rideId}/sinpe-payments/{uid}: only the uploader reads a receipt (V9)', () => {
  it('[AC11] lets the payer upload their receipt as image/jpeg', async () => {
    const storage = storageAs(PAYER_UID)

    await assertSucceeds(uploadBytes(ref(storage, receiptPath(PAYER_UID)), JPEG_BYTES, { contentType: 'image/jpeg' }))
  })

  it('[AC11] lets the payer upload without a content type, as putFile does on this extension-less path', async () => {
    const storage = storageAs(PAYER_UID)

    await assertSucceeds(uploadBytes(ref(storage, receiptPath(PAYER_UID)), JPEG_BYTES))
  })

  it('[AC11] lets the payer read back the download URL and metadata after uploading', async () => {
    const storage = storageAs(PAYER_UID)
    await uploadBytes(ref(storage, receiptPath(PAYER_UID)), JPEG_BYTES, { contentType: 'image/jpeg' })

    await assertSucceeds(getDownloadURL(ref(storage, receiptPath(PAYER_UID))))
    await assertSucceeds(getMetadata(ref(storage, receiptPath(PAYER_UID))))
  })

  it.each(readActions)("[AC11] denies another signed-in user's $name on the receipt", async ({ read }) => {
    await seedStorageObject(receiptPath(PAYER_UID))

    await assertFails(read(storageAs(OTHER_UID), receiptPath(PAYER_UID)))
  })

  it.each(readActions)('[AC11] denies an unauthenticated $name on the receipt', async ({ read }) => {
    await seedStorageObject(receiptPath(PAYER_UID))

    await assertFails(read(unauthenticatedStorage(), receiptPath(PAYER_UID)))
  })

  it("[AC11] denies another user uploading to the payer's receipt path", async () => {
    const storage = storageAs(OTHER_UID)

    await assertFails(uploadBytes(ref(storage, receiptPath(PAYER_UID)), JPEG_BYTES, { contentType: 'image/jpeg' }))
  })

  it("[AC11] denies another user updating the receipt's metadata", async () => {
    await seedStorageObject(receiptPath(PAYER_UID))

    await assertFails(updateMetadata(ref(storageAs(OTHER_UID), receiptPath(PAYER_UID)), { contentType: 'image/png' }))
  })

  it("[AC11] denies another user listing the ride's receipts", async () => {
    await seedStorageObject(receiptPath(PAYER_UID))

    await assertFails(listAll(ref(storageAs(OTHER_UID), `rides/${RIDE_ID}/sinpe-payments`)))
  })

  it('[AC11] denies another user an object nested under the payer receipt path', async () => {
    const nestedPath = `${receiptPath(PAYER_UID)}/receipt.jpg`
    await seedStorageObject(nestedPath)

    await assertFails(getMetadata(ref(storageAs(OTHER_UID), nestedPath)))
  })

  it('[AC11] denies the payer uploading below their receipt path', async () => {
    const storage = storageAs(PAYER_UID)

    await assertFails(
      uploadBytes(ref(storage, `${receiptPath(PAYER_UID)}/receipt.jpg`), JPEG_BYTES, { contentType: 'image/jpeg' })
    )
  })
})

describe('rides/{rideId}/sinpe-payments/{uid}: the payer replaces, never deletes, a capped receipt (V9)', () => {
  it('[AC11] lets the payer re-upload over an existing receipt', async () => {
    await seedStorageObject(receiptPath(PAYER_UID))

    await assertSucceeds(
      uploadBytes(ref(storageAs(PAYER_UID), receiptPath(PAYER_UID)), JPEG_BYTES, { contentType: 'image/jpeg' })
    )
  })

  it('[AC11] denies the payer deleting their receipt', async () => {
    await seedStorageObject(receiptPath(PAYER_UID))

    await assertFails(deleteObject(ref(storageAs(PAYER_UID), receiptPath(PAYER_UID))))
  })

  it("[AC11] denies another user deleting the payer's receipt", async () => {
    await seedStorageObject(receiptPath(PAYER_UID))

    await assertFails(deleteObject(ref(storageAs(OTHER_UID), receiptPath(PAYER_UID))))
  })

  it('[AC11] lets the payer upload a receipt just under 10 MiB', async () => {
    const storage = storageAs(PAYER_UID)

    await assertSucceeds(
      uploadBytes(ref(storage, receiptPath(PAYER_UID)), new Uint8Array(TEN_MEBIBYTES - 1), { contentType: 'image/jpeg' })
    )
  })

  it('[AC11] denies a receipt of exactly 10 MiB', async () => {
    const storage = storageAs(PAYER_UID)

    await assertFails(
      uploadBytes(ref(storage, receiptPath(PAYER_UID)), new Uint8Array(TEN_MEBIBYTES), { contentType: 'image/jpeg' })
    )
  })
})

describe('users/{uid}/profile.jpg: owner-only image upload, public read (as deployed)', () => {
  it('[AC12] lets the owner upload an image/jpeg under 5MB', async () => {
    const storage = storageAs(PAYER_UID)

    await assertSucceeds(
      uploadBytes(ref(storage, profilePicturePath(PAYER_UID)), JPEG_BYTES, { contentType: 'image/jpeg' })
    )
  })

  it("[AC12] denies another user uploading someone else's profile picture", async () => {
    const storage = storageAs(OTHER_UID)

    await assertFails(
      uploadBytes(ref(storage, profilePicturePath(PAYER_UID)), JPEG_BYTES, { contentType: 'image/jpeg' })
    )
  })

  it('[AC12] denies a non-image content type', async () => {
    const storage = storageAs(PAYER_UID)

    await assertFails(
      uploadBytes(ref(storage, profilePicturePath(PAYER_UID)), JPEG_BYTES, { contentType: 'application/pdf' })
    )
  })

  it('[AC12] denies an upload of 5MB or more', async () => {
    const storage = storageAs(PAYER_UID)

    await assertFails(
      uploadBytes(ref(storage, profilePicturePath(PAYER_UID)), new Uint8Array(FIVE_MEBIBYTES), {
        contentType: 'image/jpeg'
      })
    )
  })

  it.each(readActions)('[AC12] lets an unauthenticated client $name a profile picture', async ({ read }) => {
    await seedStorageObject(profilePicturePath(PAYER_UID))

    await assertSucceeds(read(unauthenticatedStorage(), profilePicturePath(PAYER_UID)))
  })

  it('[AC12] denies an unauthenticated profile picture upload', async () => {
    await assertFails(
      uploadBytes(ref(unauthenticatedStorage(), profilePicturePath(PAYER_UID)), JPEG_BYTES, { contentType: 'image/jpeg' })
    )
  })

  it('[AC12] denies the owner deleting their profile picture', async () => {
    await seedStorageObject(profilePicturePath(PAYER_UID))

    await assertFails(deleteObject(ref(storageAs(PAYER_UID), profilePicturePath(PAYER_UID))))
  })

  it("[AC12] denies another user deleting or re-typing someone else's profile picture", async () => {
    await seedStorageObject(profilePicturePath(PAYER_UID))
    const storage = storageAs(OTHER_UID)

    await assertFails(deleteObject(ref(storage, profilePicturePath(PAYER_UID))))
    await assertFails(updateMetadata(ref(storage, profilePicturePath(PAYER_UID)), { contentType: 'text/html' }))
  })

  it('[AC12] denies the owner uploading any file other than profile.jpg in their folder', async () => {
    const storage = storageAs(PAYER_UID)

    await assertFails(uploadBytes(ref(storage, `users/${PAYER_UID}/other.jpg`), JPEG_BYTES, { contentType: 'image/jpeg' }))
  })

  it('[AC12] denies reading any file other than profile.jpg in a users folder', async () => {
    await seedStorageObject(`users/${PAYER_UID}/other.jpg`)

    await assertFails(getMetadata(ref(unauthenticatedStorage(), `users/${PAYER_UID}/other.jpg`)))
  })
})

describe('every other path is closed', () => {
  const driverDocumentPath = `driver-documents/${PAYER_UID}/application-1/cedula-front.jpg`

  it('[AC13] denies the owner uploading a driver document', async () => {
    const storage = storageAs(PAYER_UID)

    await assertFails(uploadBytes(ref(storage, driverDocumentPath), JPEG_BYTES, { contentType: 'image/jpeg' }))
  })

  it('[AC13] denies the owner reading their driver document', async () => {
    await seedStorageObject(driverDocumentPath)
    const storage = storageAs(PAYER_UID)

    await assertFails(getMetadata(ref(storage, driverDocumentPath)))
    await assertFails(getBytes(ref(storage, driverDocumentPath)))
  })

  it('[AC13] denies the legacy profile_pictures path', async () => {
    const legacyPath = `profile_pictures/${PAYER_UID}/x.jpg`
    await seedStorageObject(legacyPath)
    const storage = storageAs(PAYER_UID)

    await assertFails(uploadBytes(ref(storage, legacyPath), JPEG_BYTES, { contentType: 'image/jpeg' }))
    await assertFails(getMetadata(ref(storage, legacyPath)))
  })

  it('[AC13] denies an arbitrary path', async () => {
    const arbitraryPath = `uploads/${PAYER_UID}/anything.bin`
    await seedStorageObject(arbitraryPath, 'application/octet-stream')
    const storage = storageAs(PAYER_UID)

    await assertFails(
      uploadBytes(ref(storage, arbitraryPath), JPEG_BYTES, { contentType: 'application/octet-stream' })
    )
    await assertFails(getMetadata(ref(storage, arbitraryPath)))
  })
})
