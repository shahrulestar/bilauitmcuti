import type { MetadataRoute } from 'next'

const baseUrl = 'https://bilauitmcuti.com'

const programSlugs = [
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
    { url: baseUrl, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/about`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/list`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/internship`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
  ]

  const programPages: MetadataRoute.Sitemap = programSlugs.flatMap((slug) => [
    {
      url: `${baseUrl}/${slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/${slug}/list`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ])

  return [...staticPages, ...programPages]
}
