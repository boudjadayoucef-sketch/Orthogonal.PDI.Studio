import { db } from './index.ts';
import { projects, driveFiles } from './schema.ts';
import { eq, desc, and } from 'drizzle-orm';

export async function getUserProjects(uid: string) {
  try {
    return await db.select().from(projects).where(eq(projects.uid, uid)).orderBy(desc(projects.updatedAt));
  } catch (error) {
    console.error('Database query failed in getUserProjects:', error);
    throw new Error('Failed to retrieve user projects.', { cause: error });
  }
}

export async function createOrUpdateProject(
  uid: string,
  projectData: {
    id?: number;
    name: string;
    description?: string;
    module?: string;
    status?: string;
    driveFileId?: string;
    driveFolderId?: string;
    driveWebViewLink?: string;
    data?: any;
  }
) {
  try {
    if (projectData.id) {
      const updated = await db.update(projects)
        .set({
          name: projectData.name,
          description: projectData.description || null,
          module: projectData.module || 'isometric',
          status: projectData.status || 'draft',
          driveFileId: projectData.driveFileId || null,
          driveFolderId: projectData.driveFolderId || null,
          driveWebViewLink: projectData.driveWebViewLink || null,
          data: projectData.data || null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectData.id), eq(projects.uid, uid)))
        .returning();
      return updated[0];
    } else {
      const inserted = await db.insert(projects)
        .values({
          uid,
          name: projectData.name,
          description: projectData.description || null,
          module: projectData.module || 'isometric',
          status: projectData.status || 'draft',
          driveFileId: projectData.driveFileId || null,
          driveFolderId: projectData.driveFolderId || null,
          driveWebViewLink: projectData.driveWebViewLink || null,
          data: projectData.data || null,
        })
        .returning();
      return inserted[0];
    }
  } catch (error) {
    console.error('Database query failed in createOrUpdateProject:', error);
    throw new Error('Failed to save project to database.', { cause: error });
  }
}

export async function deleteUserProject(uid: string, projectId: number) {
  try {
    return await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.uid, uid))).returning();
  } catch (error) {
    console.error('Database query failed in deleteUserProject:', error);
    throw new Error('Failed to delete project from database.', { cause: error });
  }
}

export async function getDriveFiles(uid: string) {
  try {
    return await db.select().from(driveFiles).where(eq(driveFiles.uid, uid)).orderBy(desc(driveFiles.lastSyncedAt));
  } catch (error) {
    console.error('Database query failed in getDriveFiles:', error);
    throw new Error('Failed to retrieve drive files.', { cause: error });
  }
}

export async function saveDriveFileRecord(
  uid: string,
  file: {
    driveFileId: string;
    name: string;
    mimeType: string;
    size?: string;
    webViewLink?: string;
    iconLink?: string;
    thumbnailLink?: string;
    isPdiProject?: boolean;
  }
) {
  try {
    const inserted = await db.insert(driveFiles)
      .values({
        uid,
        driveFileId: file.driveFileId,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size || null,
        webViewLink: file.webViewLink || null,
        iconLink: file.iconLink || null,
        thumbnailLink: file.thumbnailLink || null,
        isPdiProject: file.isPdiProject ?? false,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in saveDriveFileRecord:', error);
    throw new Error('Failed to record drive file.', { cause: error });
  }
}
