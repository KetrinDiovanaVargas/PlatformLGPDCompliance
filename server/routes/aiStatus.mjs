import express from 'express'
import { checkAIStatus } from '../lib/ai-client.mjs'

const router = express.Router()

router.get('/', async (_req, res) => {
  try {
    const status = await checkAIStatus()
    return res.json({
      ...status,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    return res.status(500).json({ available: false, error: err.message })
  }
})

export default router
