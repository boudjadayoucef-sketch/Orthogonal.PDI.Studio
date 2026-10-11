import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

// Define the 'users' table (linked to Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  role: text('role').default('demo').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define the 'projects' table
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull(), // User's Firebase UID
  name: text('name').notNull(),
  description: text('description'),
  module: text('module').notNull().default('isometric'),
  status: text('status').notNull().default('draft'), // draft, in_progress, archived, published
  driveFileId: text('drive_file_id'), // Google Drive file ID if synced
  driveFolderId: text('drive_folder_id'), // Google Drive folder ID
  driveWebViewLink: text('drive_web_view_link'),
  data: jsonb('data'), // Complete serialized project CAD/ISO state
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define the 'drive_files' table for Google Drive file references
export const driveFiles = pgTable('drive_files', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull(),
  driveFileId: text('drive_file_id').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: text('size'),
  webViewLink: text('web_view_link'),
  iconLink: text('icon_link'),
  thumbnailLink: text('thumbnail_link'),
  isPdiProject: boolean('is_pdi_project').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  lastSyncedAt: timestamp('last_synced_at').defaultNow(),
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  driveFiles: many(driveFiles),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  author: one(users, {
    fields: [projects.uid],
    references: [users.uid],
  }),
}));

export const driveFilesRelations = relations(driveFiles, ({ one }) => ({
  user: one(users, {
    fields: [driveFiles.uid],
    references: [users.uid],
  }),
}));
