import express from 'express'

const router = express.Router()

router.get('/', (_req, res) => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://platformlgpdcompliance.com.br</loc>
    <lastmod>2026-07-05</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://platformlgpdcompliance.com.br/admin</loc>
    <lastmod>2026-07-05</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://platformlgpdcompliance.com.br/assessment</loc>
    <lastmod>2026-07-05</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://platformlgpdcompliance.com.br/login</loc>
    <lastmod>2026-07-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.send(sitemap)
})

export default router
