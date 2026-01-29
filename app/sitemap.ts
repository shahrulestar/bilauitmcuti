import type { MetadataRoute } from 'next'

const baseUrl = 'https://cutiuitm.xyz'

const programSlugs = [
  'foundation-professional',
  'pre-diploma',
  'diploma',
  'diploma-part-time',
  'bachelor',
  'bachelor-part-time',
  'master',
  'phd',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/list`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/pwa`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const programPages: MetadataRoute.Sitemap = programSlugs.flatMap((slug) => [
    { url: `${baseUrl}/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/${slug}/list`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 },
  ])

  return [...staticPages, ...programPages]
}
