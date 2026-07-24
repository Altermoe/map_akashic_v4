import type { MarkerThin } from '@/stores/marker'
import { filterBasic } from './filter-basic'

/** Filter 运行时上下文，由 store 在 apply/clear 时注入 */
export interface FilterContext {
  /** 取消信号；abort 后 filter 应尽快终止 */
  signal: AbortSignal
  /** 进度上报，0-1，接入全局 asyncStore */
  progress: (value: number, message?: string) => void
  /** 当前 pipeline 已激活的 filter id 序列（含自身） */
  pipeline: readonly string[]
}

/**
 * Filter 策略契约。数据元素类型固定为 MarkerThin。
 * @template TParams apply 所需参数；void 表示无参 filter
 * @template TId id 的字面量类型，用于推导预制注册表的 id 联合
 *
 * filter 本身是无状态策略，参数由调用方通过 applyFilter 传入；
 * 同一 id 可被反复 apply（更新参数）或 clear（停用）。
 */
export interface FilterImpl<TParams = void, TId extends string = string> {
  /** 全局唯一 id，用作注册键与 pipeline 标识 */
  id: TId
  /** 展示名，用于 async 任务标题与调试 */
  name: string
  /**
   * 应用过滤。pipeline 模式下 input 为上一 filter 的输出（首个为数据源）。
   * 可同步或异步；异步时应响应 ctx.signal。
   */
  apply: (
    input: readonly MarkerThin[],
    params: TParams,
    ctx: FilterContext,
  ) => MarkerThin[] | Promise<MarkerThin[]>
  /** 清除副作用（缓存/外部状态），clearFilter 时调用。可选 */
  clear?: (ctx: FilterContext) => void | Promise<void>
}

/**
 * 工厂：为 filter 实现提供字面量级类型校验与推导。
 * 使用 function 声明以在 index <-> filter-basic 循环 import 中避免 TDZ。
 * 调用方可只显式传 TParams，TId 由 id 字面量推导。
 */
export function defineFilter<TParams, TId extends string>(
  impl: FilterImpl<TParams, TId>,
): FilterImpl<TParams, TId> {
  return impl
}

/** 预制 filter 注册表，store 初始化时据此填充内部查找表 */
export const builtinFilters = [filterBasic] as const satisfies readonly FilterImpl<any>[]

/** 预制 filter 元组类型 */
type BuiltinFilter = (typeof builtinFilters)[number]
/** 预制 filter 的 id 联合，用作 applyFilter/clearFilter 的 id 参数 */
export type FilterId = BuiltinFilter['id']
/** 按 id 取对应 filter 的参数类型 */
export type FilterParamsOf<TId extends FilterId> =
  Extract<BuiltinFilter, { id: TId }> extends FilterImpl<infer P, any> ? P : never
