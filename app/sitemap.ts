import type { MetadataRoute } from 'next'

const baseUrl = 'https://bilauitmcuti.com'

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
  const lastModified = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
  ]

  const programPages: MetadataRoute.Sitemap = programSlugs.map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...programPages]
}
