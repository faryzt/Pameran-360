import { db } from './index.ts';
import { users, artworks, orders } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || email.split('@')[0],
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function listArtworksFromDb() {
  try {
    return await db.select().from(artworks).orderBy(desc(artworks.createdAt));
  } catch (error) {
    console.error('Database artworks select failed:', error);
    throw new Error('Failed to load artworks from database.', { cause: error });
  }
}

export async function upsertArtworkInDb(
  artworkData: typeof artworks.$inferInsert,
) {
  try {
    const result = await db
      .insert(artworks)
      .values(artworkData)
      .onConflictDoUpdate({
        target: artworks.id,
        set: {
          title: artworkData.title,
          creator: artworkData.creator,
          level: artworkData.level,
          school: artworkData.school,
          region: artworkData.region,
          category: artworkData.category,
          price: artworkData.price,
          yaw: artworkData.yaw,
          pitch: artworkData.pitch,
          room: artworkData.room,
          description: artworkData.description,
          whatsapp: artworkData.whatsapp,
          motifType: artworkData.motifType,
          palettePrimary: artworkData.palettePrimary,
          paletteSecondary: artworkData.paletteSecondary,
          imageUrl: artworkData.imageUrl,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database artwork upsert failed:', error);
    throw new Error('Failed to save artwork to database.', { cause: error });
  }
}

export async function deleteArtworkFromDb(id: string) {
  try {
    await db.delete(artworks).where(eq(artworks.id, id));
    return { deletedId: id };
  } catch (error) {
    console.error('Database artwork delete failed:', error);
    throw new Error('Failed to delete artwork from database.', {
      cause: error,
    });
  }
}

export async function createOrderInDb(
  userUid: string,
  buyerName: string,
  itemsJson: string,
  totalPrice: number,
) {
  try {
    const result = await db
      .insert(orders)
      .values({
        userUid,
        buyerName,
        itemsJson,
        totalPrice,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database order creation failed:', error);
    throw new Error('Failed to record order in database.', { cause: error });
  }
}
