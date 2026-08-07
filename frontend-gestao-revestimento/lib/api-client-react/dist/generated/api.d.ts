import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Atividade, CalculoInput, CalculoResult, DashboardStats, ErrorResponse, GrupoTipo, HealthStatus, ListPisosParams, Piso, PisoInput } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListPisosUrl: (params?: ListPisosParams) => string;
/**
 * @summary Listar todos os pisos
 */
export declare const listPisos: (params?: ListPisosParams, options?: Parameters<typeof customFetch>[1]) => Promise<Piso[]>;
export declare const getListPisosQueryKey: (params?: ListPisosParams) => readonly ["/api/pisos", ...ListPisosParams[]];
export declare const getListPisosQueryOptions: <TData = Awaited<ReturnType<typeof listPisos>>, TError = ErrorType<unknown>>(params?: ListPisosParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPisos>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPisos>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPisosQueryResult = NonNullable<Awaited<ReturnType<typeof listPisos>>>;
export type ListPisosQueryError = ErrorType<unknown>;
/**
 * @summary Listar todos os pisos
 */
export declare function useListPisos<TData = Awaited<ReturnType<typeof listPisos>>, TError = ErrorType<unknown>>(params?: ListPisosParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPisos>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreatePisoUrl: () => string;
/**
 * @summary Cadastrar um novo piso
 */
export declare const createPiso: (pisoInput: PisoInput, options?: Parameters<typeof customFetch>[1]) => Promise<Piso>;
export declare const getCreatePisoMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPiso>>, TError, {
        data: BodyType<PisoInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPiso>>, TError, {
    data: BodyType<PisoInput>;
}, TContext>;
export type CreatePisoMutationResult = NonNullable<Awaited<ReturnType<typeof createPiso>>>;
export type CreatePisoMutationBody = BodyType<PisoInput>;
export type CreatePisoMutationError = ErrorType<ErrorResponse>;
/**
* @summary Cadastrar um novo piso
*/
export declare const useCreatePiso: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPiso>>, TError, {
        data: BodyType<PisoInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPiso>>, TError, {
    data: BodyType<PisoInput>;
}, TContext>;
export declare const getGetPisoUrl: (id: number) => string;
/**
 * @summary Buscar piso por ID
 */
export declare const getPiso: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Piso>;
export declare const getGetPisoQueryKey: (id: number) => readonly [`/api/pisos/${number}`];
export declare const getGetPisoQueryOptions: <TData = Awaited<ReturnType<typeof getPiso>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPiso>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPiso>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPisoQueryResult = NonNullable<Awaited<ReturnType<typeof getPiso>>>;
export type GetPisoQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Buscar piso por ID
 */
export declare function useGetPiso<TData = Awaited<ReturnType<typeof getPiso>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPiso>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdatePisoUrl: (id: number) => string;
/**
 * @summary Atualizar piso
 */
export declare const updatePiso: (id: number, pisoInput: PisoInput, options?: Parameters<typeof customFetch>[1]) => Promise<Piso>;
export declare const getUpdatePisoMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePiso>>, TError, {
        id: number;
        data: BodyType<PisoInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePiso>>, TError, {
    id: number;
    data: BodyType<PisoInput>;
}, TContext>;
export type UpdatePisoMutationResult = NonNullable<Awaited<ReturnType<typeof updatePiso>>>;
export type UpdatePisoMutationBody = BodyType<PisoInput>;
export type UpdatePisoMutationError = ErrorType<ErrorResponse>;
/**
* @summary Atualizar piso
*/
export declare const useUpdatePiso: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePiso>>, TError, {
        id: number;
        data: BodyType<PisoInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePiso>>, TError, {
    id: number;
    data: BodyType<PisoInput>;
}, TContext>;
export declare const getDeletePisoUrl: (id: number) => string;
/**
 * @summary Excluir piso
 */
export declare const deletePiso: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeletePisoMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePiso>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePiso>>, TError, {
    id: number;
}, TContext>;
export type DeletePisoMutationResult = NonNullable<Awaited<ReturnType<typeof deletePiso>>>;
export type DeletePisoMutationError = ErrorType<ErrorResponse>;
/**
* @summary Excluir piso
*/
export declare const useDeletePiso: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePiso>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePiso>>, TError, {
    id: number;
}, TContext>;
export declare const getGetPisoByCodigoUrl: (codigo: string) => string;
/**
 * @summary Buscar piso pelo código (loja ou rede)
 */
export declare const getPisoByCodigo: (codigo: string, options?: Parameters<typeof customFetch>[1]) => Promise<Piso>;
export declare const getGetPisoByCodigoQueryKey: (codigo: string) => readonly [`/api/pisos/codigo/${string}`];
export declare const getGetPisoByCodigoQueryOptions: <TData = Awaited<ReturnType<typeof getPisoByCodigo>>, TError = ErrorType<ErrorResponse>>(codigo: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPisoByCodigo>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPisoByCodigo>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPisoByCodigoQueryResult = NonNullable<Awaited<ReturnType<typeof getPisoByCodigo>>>;
export type GetPisoByCodigoQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Buscar piso pelo código (loja ou rede)
 */
export declare function useGetPisoByCodigo<TData = Awaited<ReturnType<typeof getPisoByCodigo>>, TError = ErrorType<ErrorResponse>>(codigo: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPisoByCodigo>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCalcularPisoUrl: () => string;
/**
 * @summary Calcular quantidade de caixas necessárias
 */
export declare const calcularPiso: (calculoInput: CalculoInput, options?: Parameters<typeof customFetch>[1]) => Promise<CalculoResult>;
export declare const getCalcularPisoMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof calcularPiso>>, TError, {
        data: BodyType<CalculoInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof calcularPiso>>, TError, {
    data: BodyType<CalculoInput>;
}, TContext>;
export type CalcularPisoMutationResult = NonNullable<Awaited<ReturnType<typeof calcularPiso>>>;
export type CalcularPisoMutationBody = BodyType<CalculoInput>;
export type CalcularPisoMutationError = ErrorType<ErrorResponse>;
/**
* @summary Calcular quantidade de caixas necessárias
*/
export declare const useCalcularPiso: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof calcularPiso>>, TError, {
        data: BodyType<CalculoInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof calcularPiso>>, TError, {
    data: BodyType<CalculoInput>;
}, TContext>;
export declare const getGetDashboardStatsUrl: () => string;
/**
 * @summary Métricas do dashboard
 */
export declare const getDashboardStats: (options?: Parameters<typeof customFetch>[1]) => Promise<DashboardStats>;
export declare const getGetDashboardStatsQueryKey: () => readonly ["/api/dashboard/stats"];
export declare const getGetDashboardStatsQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardStats>>>;
export type GetDashboardStatsQueryError = ErrorType<unknown>;
/**
 * @summary Métricas do dashboard
 */
export declare function useGetDashboardStats<TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAtividadeRecenteUrl: () => string;
/**
 * @summary Atividades recentes do sistema
 */
export declare const getAtividadeRecente: (options?: Parameters<typeof customFetch>[1]) => Promise<Atividade[]>;
export declare const getGetAtividadeRecenteQueryKey: () => readonly ["/api/dashboard/atividade-recente"];
export declare const getGetAtividadeRecenteQueryOptions: <TData = Awaited<ReturnType<typeof getAtividadeRecente>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAtividadeRecente>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAtividadeRecente>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAtividadeRecenteQueryResult = NonNullable<Awaited<ReturnType<typeof getAtividadeRecente>>>;
export type GetAtividadeRecenteQueryError = ErrorType<unknown>;
/**
 * @summary Atividades recentes do sistema
 */
export declare function useGetAtividadeRecente<TData = Awaited<ReturnType<typeof getAtividadeRecente>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAtividadeRecente>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPisosPorTipoUrl: () => string;
/**
 * @summary Contagem de pisos agrupados por tipo
 */
export declare const getPisosPorTipo: (options?: Parameters<typeof customFetch>[1]) => Promise<GrupoTipo[]>;
export declare const getGetPisosPorTipoQueryKey: () => readonly ["/api/dashboard/pisos-por-tipo"];
export declare const getGetPisosPorTipoQueryOptions: <TData = Awaited<ReturnType<typeof getPisosPorTipo>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPisosPorTipo>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPisosPorTipo>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPisosPorTipoQueryResult = NonNullable<Awaited<ReturnType<typeof getPisosPorTipo>>>;
export type GetPisosPorTipoQueryError = ErrorType<unknown>;
/**
 * @summary Contagem de pisos agrupados por tipo
 */
export declare function useGetPisosPorTipo<TData = Awaited<ReturnType<typeof getPisosPorTipo>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPisosPorTipo>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map