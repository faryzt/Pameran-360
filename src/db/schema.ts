import { relations } from 'drizzle-orm';
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  doublePrecision,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const artworks = pgTable('artworks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  creator: text('creator').notNull(),
  level: text('level').notNull(), // 'SD' | 'SMP' | 'SMA'
  school: text('school').notNull(),
  region: text('region').notNull(),
  category: text('category').notNull(), // 'Dinding' | 'Rak Display'
  price: integer('price').notNull(),
  yaw: doublePrecision('yaw').notNull(),
  pitch: doublePrecision('pitch').notNull(),
  room: text('room').notNull().default('interior'),
  description: text('description').notNull(),
  whatsapp: text('whatsapp').notNull(),
  motifType: text('motif_type').notNull().default('batik'),
  palettePrimary: text('palette_primary').notNull().default('#d97706'),
  paletteSecondary: text('palette_secondary').notNull().default('#78350f'),
  imageUrl: text('image_url'),
  userUid: text('user_uid').references(() => users.uid),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  buyerName: text('buyer_name').notNull(),
  itemsJson: text('items_json').notNull(),
  totalPrice: integer('total_price').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  artworks: many(artworks),
  orders: many(orders),
}));

export const artworksRelations = relations(artworks, ({ one }) => ({
  owner: one(users, {
    fields: [artworks.userUid],
    references: [users.uid],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  buyer: one(users, {
    fields: [orders.userUid],
    references: [users.uid],
  }),
}));
