import { z } from "zod/v4";
export declare const atividadesTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "atividades";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "atividades";
            dataType: "number";
            columnType: "PgSerial";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        tipo: import("drizzle-orm/pg-core").PgColumn<{
            name: "tipo";
            tableName: "atividades";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        descricao: import("drizzle-orm/pg-core").PgColumn<{
            name: "descricao";
            tableName: "atividades";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        pisoNome: import("drizzle-orm/pg-core").PgColumn<{
            name: "piso_nome";
            tableName: "atividades";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "atividades";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const insertAtividadeSchema: z.ZodObject<{
    tipo: z.ZodString;
    descricao: z.ZodString;
    pisoNome: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, {
    out: {};
    in: {};
}>;
export type InsertAtividade = z.infer<typeof insertAtividadeSchema>;
export type Atividade = typeof atividadesTable.$inferSelect;
//# sourceMappingURL=atividades.d.ts.map