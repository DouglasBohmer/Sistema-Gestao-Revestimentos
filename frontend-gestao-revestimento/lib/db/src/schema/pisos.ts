import { pgTable, serial, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pisosTable = pgTable("pisos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  codigoRede: text("codigo_rede"),
  codigoLoja: text("codigo_loja").notNull(),
  largura: real("largura"),
  altura: real("altura"),
  rejunte: real("rejunte"),
  pecasPorCaixa: real("pecas_por_caixa"),
  m2PorCaixa: real("m2_por_caixa").notNull(),
  localDeUso: text("local_de_uso"),
  tipoPiso: text("tipo_piso"),
  pei: real("pei"),
  retificado: boolean("retificado"),
  linkSite: text("link_site"),
  linkFoto: text("link_foto"),
  valor: real("valor"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertPisoSchema = createInsertSchema(pisosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPiso = z.infer<typeof insertPisoSchema>;
export type Piso = typeof pisosTable.$inferSelect;
