import { acceptHMRUpdate, defineStore } from 'pinia'

export type AsyncTaskStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

export interface AsyncTask {
  id: string
  title: string
  description?: string
  status: AsyncTaskStatus
  /** 进度 0-1；undefined 表示不确定进度 */
  progress?: number
  message?: string
  error?: string
  createdAt: number
  updatedAt: number
  /** 用于取消任务的 AbortController，仅内部使用 */
  controller?: AbortController
  /** 是否可取消（提供了 controller 即为 true） */
  cancellable: boolean
}

export interface AsyncCreateInput {
  id?: string
  title: string
  description?: string
  cancellable?: boolean
  controller?: AbortController
}

export interface AsyncUpdatePatch {
  progress?: number
  message?: string
  description?: string
}

export interface AsyncRunOptions {
  title: string
  description?: string
  signal?: AbortSignal
  /** 提供后任务可被 UI 取消 */
  controller?: AbortController
}

export interface AsyncReport {
  progress: (value: number, message?: string) => void
  update: (patch: { description?: string; message?: string }) => void
  readonly signal: AbortSignal
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `async-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const toErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * 全局异步任务 Store，用于统一登记与追踪应用内的异步操作，
 * 并通过 `AsyncTasksPopover` 组件向用户展示当前正在进行的任务列表。
 *
 * 对外提供两层 API：
 * - 高阶包装 `run(task, options)`：自动完成任务的注册、进度上报、
 *   成功 / 失败 / 取消状态流转，是大多数场景的首选。
 * - 底层命令式 API `create / update / finish / fail / cancel / remove / clearFinished`：
 *   用于需要跨函数、跨模块自行控制生命周期的复杂场景。
 *
 * @example 使用高阶包装 `run` 追踪一个带进度的异步任务
 * ```ts
 * import { useAsyncStore } from '@/stores'
 *
 * const asyncStore = useAsyncStore()
 *
 * await asyncStore.run(
 *   async ({ progress }) => {
 *     for (let i = 0; i <= 10; i++) {
 *       progress(i / 10, `step ${i}`)
 *       await new Promise((r) => setTimeout(r, 300))
 *     }
 *   },
 *   { title: '数据加载' },
 * )
 * ```
 *
 * @example 使用高阶包装 `run` 支持用户取消
 * ```ts
 * const controller = new AbortController()
 * asyncStore.run(
 *   async ({ progress, signal }) => {
 *     for (let i = 0; i <= 100; i++) {
 *       signal.throwIfAborted()
 *       progress(i / 100)
 *       await new Promise((r) => setTimeout(r, 50))
 *     }
 *   },
 *   { title: '可取消任务', controller },
 * )
 * // 传入 controller 后，Popover 列表中该项会显示「取消」按钮
 * ```
 *
 * @example 使用底层命令式 API 手动控制生命周期
 * ```ts
 * const id = asyncStore.create({ title: '手动任务' })
 * asyncStore.update(id, { progress: 0.5, message: '半途' })
 * try {
 *   // ... 业务逻辑
 *   asyncStore.finish(id)
 * } catch (err) {
 *   asyncStore.fail(id, err)
 * }
 * ```
 *
 * @example 与 Worker `onProgress` 语义配合
 * ```ts
 * asyncStore.run(
 *   ({ progress }) =>
 *     invokeWorker(worker, payload, {
 *       onProgress: (value, message) => progress(value, message),
 *     }),
 *   { title: '图标渲染' },
 * )
 * ```
 */
export const useAsyncStore = defineStore('async', () => {
  const tasks = ref(new Map<string, AsyncTask>())

  const list = computed<AsyncTask[]>(() =>
    [...tasks.value.values()].sort((a, b) => a.createdAt - b.createdAt),
  )

  const runningCount = computed(() => {
    let count = 0
    for (const task of tasks.value.values()) {
      if (task.status === 'running' || task.status === 'pending') count++
    }
    return count
  })

  const hasRunning = computed(() => runningCount.value > 0)

  const hasError = computed(() => {
    for (const task of tasks.value.values()) {
      if (task.status === 'error') return true
    }
    return false
  })

  const hasVisibleTasks = computed(() => tasks.value.size > 0)

  const create = (input: AsyncCreateInput) => {
    const id = input.id ?? generateId()
    const now = Date.now()
    const controller = input.controller
    const task: AsyncTask = {
      id,
      title: input.title,
      description: input.description,
      status: 'pending',
      progress: undefined,
      message: undefined,
      error: undefined,
      createdAt: now,
      updatedAt: now,
      controller,
      cancellable: input.cancellable ?? controller !== undefined,
    }
    const next = new Map(tasks.value)
    next.set(id, task)
    tasks.value = next
    return id
  }

  const patchTask = (id: string, patch: Partial<AsyncTask>) => {
    const prev = tasks.value.get(id)
    if (!prev) return
    const next = new Map(tasks.value)
    next.set(id, { ...prev, ...patch, updatedAt: Date.now() })
    tasks.value = next
  }

  const update = (id: string, patch: AsyncUpdatePatch) => {
    const prev = tasks.value.get(id)
    if (!prev) return
    const merged: Partial<AsyncTask> = {}
    if (patch.progress !== undefined) merged.progress = patch.progress
    if (patch.message !== undefined) merged.message = patch.message
    if (patch.description !== undefined) merged.description = patch.description
    // 首次 update 时若还处于 pending，则视为 running
    if (prev.status === 'pending') merged.status = 'running'
    patchTask(id, merged)
  }

  const markRunning = (id: string) => {
    const prev = tasks.value.get(id)
    if (!prev || prev.status !== 'pending') return
    patchTask(id, { status: 'running' })
  }

  const finish = (id: string) => {
    const prev = tasks.value.get(id)
    if (!prev) return
    patchTask(id, { status: 'success', progress: 1, error: undefined })
  }

  const fail = (id: string, error: unknown) => {
    const prev = tasks.value.get(id)
    if (!prev) return
    patchTask(id, { status: 'error', error: toErrorMessage(error) })
  }

  const cancel = (id: string) => {
    const prev = tasks.value.get(id)
    if (!prev) return
    prev.controller?.abort()
    patchTask(id, { status: 'cancelled' })
  }

  const remove = (id: string) => {
    if (!tasks.value.has(id)) return
    const next = new Map(tasks.value)
    next.delete(id)
    tasks.value = next
  }

  const clearFinished = () => {
    const next = new Map(tasks.value)
    for (const [id, task] of tasks.value) {
      if (task.status !== 'running' && task.status !== 'pending') {
        next.delete(id)
      }
    }
    tasks.value = next
  }

  const run = async <T>(
    task: (report: AsyncReport) => Promise<T> | T,
    options: AsyncRunOptions,
  ): Promise<T> => {
    // 若调用方未显式传入 controller，则内部创建一个，以便统一 signal 语义
    const controller = options.controller ?? new AbortController()
    // 若外部 signal 已被 abort，则同步 abort 内部 controller
    if (options.signal?.aborted) {
      controller.abort(options.signal.reason)
    } else if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(options.signal!.reason), {
        once: true,
      })
    }

    const cancellable = options.controller !== undefined
    const id = create({
      title: options.title,
      description: options.description,
      cancellable,
      controller,
    })
    markRunning(id)

    const report: AsyncReport = {
      progress: (value, message) => {
        update(id, { progress: value, message })
      },
      update: (patch) => {
        update(id, patch)
      },
      get signal() {
        return controller.signal
      },
    }

    try {
      const result = await Promise.resolve(task(report))
      if (controller.signal.aborted) {
        cancel(id)
      } else {
        finish(id)
      }
      return result
    } catch (err) {
      if (controller.signal.aborted) {
        cancel(id)
      } else {
        fail(id, err)
      }
      throw err
    }
  }

  return {
    list,
    runningCount,
    hasRunning,
    hasError,
    hasVisibleTasks,
    create,
    update,
    finish,
    fail,
    cancel,
    remove,
    clearFinished,
    run,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAsyncStore, import.meta.hot))
}
