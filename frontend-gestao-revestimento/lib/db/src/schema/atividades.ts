import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const atividadesTable = pgTable("atividades", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // cadastro | calculo | impressao
  descricao: text("descricao").notNull(),
  pisoNome: text("piso_nome"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAtividadeSchema = createInsertSchema(atividadesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAtividade = z.infer<typeof insertAtividadeSchema>;
export type Atividade = typeof atividadesTable.$inferSelect;
