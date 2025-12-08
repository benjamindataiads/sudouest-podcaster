import { pgTable, serial, text, timestamp, jsonb, integer, boolean, varchar } from 'drizzle-orm/pg-core'

/**
 * Table pour stocker les articles récupérés depuis Sud-Ouest
 */
export const articles = pgTable('articles', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary'), // chapeau
  content: text('content').notNull(),
  url: text('url').notNull().unique(),
  imageUrl: text('image_url'),
  category: varchar('category', { length: 100 }),
  publishedAt: timestamp('published_at').notNull(),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
  metadata: jsonb('metadata'), // données additionnelles
})

export interface AudioChunk {
  url: string
  chunkIndex: number
  duration?: number
  text: string
  section?: 'introduction' | 'article' | 'conclusion'
  articleTitle?: string
}

/**
 * Organization branding settings type
 */
export interface OrganizationBranding {
  logoUrl?: string
  primaryColor: string      // Color 1
  secondaryColor: string    // Color 2
  accentColor: string       // Accent color
  textColor: string         // Text color
  fontFamily: string        // Font family
}

/**
 * Organization video settings type (intro/outro)
 */
export interface OrganizationVideoSettings {
  introVideoUrl?: string       // URL of uploaded or generated intro video
  outroVideoUrl?: string       // URL of uploaded or generated outro video
  introImageUrl?: string       // Image used to generate intro (for regeneration)
  outroImageUrl?: string       // Image used to generate outro (for regeneration)
  introPrompt?: string         // Prompt used to generate intro
  outroPrompt?: string         // Prompt used to generate outro
}

/**
 * Table pour stocker les paramètres des organisations
 * L'orgId vient de Clerk Organizations
 */
export const organizationSettings = pgTable('organization_settings', {
  id: serial('id').primaryKey(),
  orgId: varchar('org_id', { length: 255 }).notNull().unique(), // Clerk Organization ID
  name: varchar('name', { length: 255 }).notNull(), // Organization display name
  branding: jsonb('branding').$type<OrganizationBranding>(),
  videoSettings: jsonb('video_settings').$type<OrganizationVideoSettings>(), // Intro/outro video settings
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Table pour stocker les flux RSS par organisation
 */
export const rssFeeds = pgTable('rss_feeds', {
  id: serial('id').primaryKey(),
  orgId: varchar('org_id', { length: 255 }).notNull(), // Clerk Organization ID
  name: varchar('name', { length: 255 }).notNull(), // Feed display name
  url: text('url').notNull(), // RSS feed URL
  isActive: boolean('is_active').default(true),
  lastFetchedAt: timestamp('last_fetched_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Table pour stocker les projets de podcast
 */
export const podcasts = pgTable('podcasts', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }), // Clerk user ID for ownership
  orgId: varchar('org_id', { length: 255 }), // Clerk Organization ID
  title: text('title').notNull(),
  date: timestamp('date').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, articles_selected, script_ready, audio_generated, video_generating, video_generated, completed
  currentStep: integer('current_step').default(1), // 1: articles, 2: script, 3: audio, 4: video
  avatarId: integer('avatar_id'), // ID de l'avatar sélectionné pour ce podcast
  selectedArticles: jsonb('selected_articles').$type<Array<{
    id: number
    title: string
    summary: string
    content: string
    url: string
    imageUrl?: string
    category?: string
    publishedAt: string
    score: number
    selected: boolean
  }>>(), // Articles complets avec scores
  script: jsonb('script').$type<{
    introduction: string
    articles: Array<{
      articleId: number
      title: string
      content: string
    }>
    conclusion: string
    estimatedDuration: number
    chunks?: Array<{
      text: string
      index: number
      section: 'introduction' | 'article' | 'conclusion'
      articleTitle?: string
    }>
  }>(), // Script complet avec chunks
  scriptEditedAt: timestamp('script_edited_at'),
  audioChunks: jsonb('audio_chunks').$type<AudioChunk[]>(), // URLs et métadonnées audio
  videoUrls: jsonb('video_urls').$type<string[]>(), // URLs des vidéos générées
  finalVideoUrl: text('final_video_url'), // URL de la vidéo finale assemblée
  thumbnailUrl: text('thumbnail_url'), // Miniature du podcast
  estimatedDuration: integer('estimated_duration'), // Durée estimée en secondes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

/**
 * Table pour stocker les fichiers audio générés
 */
export const audioFiles = pgTable('audio_files', {
  id: serial('id').primaryKey(),
  podcastId: integer('podcast_id').references(() => podcasts.id).notNull(),
  voiceId: varchar('voice_id', { length: 100 }).notNull(), // ID de la voix utilisée (fal.ai)
  fileUrl: text('file_url').notNull(), // URL du fichier audio
  duration: integer('duration'), // durée en secondes
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'), // données additionnelles (params fal.ai, etc.)
})

/**
 * Table pour stocker les fichiers vidéo générés
 */
export const videoFiles = pgTable('video_files', {
  id: serial('id').primaryKey(),
  podcastId: integer('podcast_id').references(() => podcasts.id).notNull(),
  audioFileId: integer('audio_file_id').references(() => audioFiles.id).notNull(),
  avatarId: varchar('avatar_id', { length: 100 }).notNull(), // ID de l'avatar utilisé
  fileUrl: text('file_url').notNull(), // URL du fichier vidéo
  hasCaptions: boolean('has_captions').default(false),
  duration: integer('duration'), // durée en secondes
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'), // données additionnelles
})

/**
 * Table pour stocker les jobs de génération audio
 * Permet de persister l'état des générations audio en cours
 */
export const audioJobs = pgTable('audio_jobs', {
  id: varchar('id', { length: 100 }).primaryKey(), // audio-job-timestamp-random
  podcastId: integer('podcast_id').references(() => podcasts.id),
  scriptChunks: jsonb('script_chunks').$type<Array<{
    text: string
    index: number
    section: 'introduction' | 'article' | 'conclusion'
    articleTitle?: string
  }>>(),
  voiceId: text('voice_id').notNull(), // Changed to text to support full URLs
  status: varchar('status', { length: 50 }).notNull().default('queued'), // queued, generating, completed, failed
  audioUrl: text('audio_url'),
  audioChunks: jsonb('audio_chunks').$type<Array<{
    url: string
    chunkIndex: number
    duration?: number
    text: string
  }>>(),
  falRequestIds: jsonb('fal_request_ids').$type<string[]>(), // Liste des request_id fal.ai pour chaque chunk
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

/**
 * Table pour stocker les jobs de génération vidéo
 * Permet de persister l'état des générations en cours et d'afficher les placeholders
 */
export const videoJobs = pgTable('video_jobs', {
  id: varchar('id', { length: 100 }).primaryKey(), // job-timestamp-random
  podcastId: integer('podcast_id').references(() => podcasts.id),
  audioChunkIndex: integer('audio_chunk_index').notNull(),
  audioUrl: text('audio_url').notNull(),
  text: text('text'),
  section: varchar('section', { length: 50 }),
  avatarImageUrl: text('avatar_image_url'), // Image variant to use for this segment
  status: varchar('status', { length: 50 }).notNull().default('queued'), // queued, generating, completed, failed
  videoUrl: text('video_url'),
  error: text('error'),
  falRequestId: varchar('fal_request_id', { length: 200 }), // ID de la requête fal.ai pour récupération
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

/**
 * Table pour stocker les thèmes/catégories détectés
 */
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // code couleur hex
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Avatar image variant type
 */
export interface AvatarImageVariant {
  url: string
  label: string // 'original', 'variation-1', 'variation-2', 'variation-3'
  description?: string // e.g. "Légère rotation tête gauche"
}

/**
 * Table pour stocker les avatars (personnages pour les podcasts)
 */
export const avatars = pgTable('avatars', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }), // Clerk user ID for ownership (null for default avatars)
  orgId: varchar('org_id', { length: 255 }), // Clerk Organization ID (null for global default avatars)
  name: varchar('name', { length: 100 }).notNull(),
  voiceUrl: text('voice_url').notNull(), // URL du fichier MP3 de référence pour le clonage vocal
  imageUrl: text('image_url').notNull(), // URL de l'image principale de l'avatar
  imageVariations: jsonb('image_variations').$type<AvatarImageVariant[]>(), // 4 variations de pose
  isDefault: boolean('is_default').default(false), // Avatar par défaut (Benoit Lasserre)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert
export type Podcast = typeof podcasts.$inferSelect
export type NewPodcast = typeof podcasts.$inferInsert
export type AudioFile = typeof audioFiles.$inferSelect
export type NewAudioFile = typeof audioFiles.$inferInsert
export type VideoFile = typeof videoFiles.$inferSelect
export type NewVideoFile = typeof videoFiles.$inferInsert
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type AudioJob = typeof audioJobs.$inferSelect
export type NewAudioJob = typeof audioJobs.$inferInsert
export type VideoJob = typeof videoJobs.$inferSelect
export type NewVideoJob = typeof videoJobs.$inferInsert
export type Avatar = typeof avatars.$inferSelect
export type NewAvatar = typeof avatars.$inferInsert
export type OrganizationSetting = typeof organizationSettings.$inferSelect
export type NewOrganizationSetting = typeof organizationSettings.$inferInsert
export type RssFeed = typeof rssFeeds.$inferSelect
export type NewRssFeed = typeof rssFeeds.$inferInsert

/**
 * Table pour stocker les Audio Articles (résumés audio d'articles)
 */
export const audioArticles = pgTable('audio_articles', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }), // Clerk user ID
  orgId: varchar('org_id', { length: 255 }), // Clerk Organization ID
  title: varchar('title', { length: 255 }).notNull(),
  originalText: text('original_text').notNull(), // Texte original de l'article
  summary: text('summary').notNull(), // Résumé généré
  summaryDuration: varchar('summary_duration', { length: 10 }), // Durée cible du résumé (en secondes)
  audioUrl: text('audio_url'), // URL du fichier audio généré
  voice: varchar('voice', { length: 50 }).default('french'), // Langue de la voix
  status: varchar('status', { length: 50 }).default('draft'), // draft, completed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type AudioArticle = typeof audioArticles.$inferSelect
export type NewAudioArticle = typeof audioArticles.$inferInsert

