import { initializeApp } from 'firebase-admin/app'
import { onRequest } from 'firebase-functions/v2/https'

initializeApp()

export const healthcheck = onRequest({ region: 'us-central1' }, (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'carpil-functions' })
})
