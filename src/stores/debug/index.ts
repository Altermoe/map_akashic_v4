import { acceptHMRUpdate, defineStore } from 'pinia'
import { Subject } from 'rxjs'

// ─── 类型定义 ────────────────────────────────────────────────

/**
 * 日志级别，按严重程度升序排列。
 * - `debug`：开发调试信息，生产环境默认不输出
 * - `info`：常规运行信息
 * - `warn`：警告，不影响核心功能但值得关注
 * - `error`：错误，影响部分功能但应用仍可运行
 * - `fatal`：致命错误，应用无法继续运行
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/** 日志级别权重，用于级别比较 */
const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

/**
 * 单条日志记录
 */
export interface LogEntry {
  /** 唯一标识 */
  id: string
  /** 日志级别 */
  level: LogLevel
  /** 日志消息 */
  message: string
  /** 标签数组，用于分类、过滤与分组 */
  tags: string[]
  /** 时间戳（毫秒） */
  timestamp: number
  /** 附加的任意数据 */
  payload?: unknown
  /** 关联的错误对象（error / fatal 级别通常会有） */
  error?: Error
}

/**
 * 计时器记录
 */
export interface TimerEntry {
  /** 计时器名称（唯一） */
  name: string
  /** 标签，用于与日志体系关联 */
  tags: string[]
  /** 开始时间戳（毫秒） */
  startTime: number
  /** 结束时间戳（毫秒），未结束时为 undefined */
  endTime?: number
  /** 耗时（毫秒），未结束时为 undefined */
  duration?: number
}

/**
 * 致命错误详情。
 * 出现该错误时应用将转入蓝屏状态，必须由开发者修复后才能恢复。
 */
export interface FatalError {
  /** 唯一标识 */
  id: string
  /** 面向用户的简短标题 */
  title: string
  /** 详细描述 */
  message: string
  /** 原始错误对象 */
  error?: Error
  /** 错误分类，便于蓝屏页定位与排查 */
  category: string
  /** 发生时间戳（毫秒） */
  timestamp: number
}

/**
 * 非致命错误详情。
 * 该级别错误会以应用内提示（如 Toast / Notification）形式通知用户，
 * 但不影响应用整体运行。
 */
export interface NoticeableError {
  /** 唯一标识 */
  id: string
  /** 错误消息 */
  message: string
  /** 原始错误对象 */
  error?: Error
  /** 错误分类 */
  category: string
  /** 发生时间戳（毫秒） */
  timestamp: number
  /** 是否支持重试操作 */
  retryable?: boolean
}

/** `reportFatal` 的选项 */
export interface ReportFatalOptions {
  /** 面向用户的简短标题 */
  title: string
  /** 错误分类 */
  category: string
}

/** `reportError` 的选项 */
export interface ReportErrorOptions {
  /** 错误分类 */
  category: string
  /** 是否支持重试 */
  retryable?: boolean
}

/** 通用日志选项 */
export interface LogOptions {
  /** 标签数组 */
  tags?: string[]
  /** 附加数据 */
  payload?: unknown
  /** 关联的错误对象 */
  error?: Error
}

/** 计时器选项 */
export interface TimerOptions {
  /** 标签数组 */
  tags?: string[]
}

/** `getLogs` 过滤条件 */
export interface LogFilter {
  /** 按级别过滤 */
  level?: LogLevel
  /** 按标签过滤（需全部包含） */
  tags?: string[]
}

/** 各级别日志计数 */
export interface LogLevelCount {
  debug: number
  info: number
  warn: number
  error: number
  fatal: number
}

// ─── 常量与工具函数 ──────────────────────────────────────────

/** 日志环形缓冲区默认最大容量 */
const DEFAULT_MAX_LOG_ENTRIES = 500

/** 生成唯一 ID */
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `debug-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** 将任意错误标准化为字符串消息 */
const toErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/** 将未知错误标准化为 Error 对象 */
const toError = (err: unknown): Error | undefined => {
  if (err instanceof Error) return err
  if (typeof err === 'string') return new Error(err)
  return undefined
}

/** 比较日志级别：`a >= b` 是否成立 */
const levelGte = (a: LogLevel, b: LogLevel): boolean => {
  return LOG_LEVEL_ORDER[a] >= LOG_LEVEL_ORDER[b]
}

// ─── Store ──────────────────────────────────────────────────

/**
 * 全局调试 Store，提供分级错误报告与结构化日志记录能力。
 *
 * 本 Store 只负责**记录与发布**，不直接操作 UI。UI 层（蓝屏、Toast、
 * 调试面板等）通过订阅 RxJS Subject 来响应事件，实现逻辑与展示的解耦。
 *
 * 错误级别概览：
 * - **Fatal**（致命错误）：应用无法继续运行，触发蓝屏。例如前置配置加载失败、
 *   核心依赖初始化失败等。使用 {@link useDebugStore.reportFatal | reportFatal}。
 * - **Error**（非致命错误）：影响部分功能但应用仍可运行，弹出应用内提示。
 *   例如远程点位数据请求失败。使用 {@link useDebugStore.reportError | reportError}。
 * - **Warn**（警告）：不影响功能、但值得关注的异常。例如瓦片请求因移出视口
 *   而取消导致的 AbortError。使用 {@link useDebugStore.warn | warn}。
 * - **Info / Debug**（常规日志）：用于记录运行信息与调试细节。
 *   使用 {@link useDebugStore.info | info} / {@link useDebugStore.debug | debug}。
 *
 * 日志采用**标签式分类**（而非嵌套 group），每条日志可携带多个 `tags`，
 * 便于按维度过滤、统计与分组展示。
 *
 * 与 UI 层集成：
 * - `fatalError$` — 订阅以渲染蓝屏组件
 * - `noticeableError$` — 订阅以渲染 Toast / Notification
 * - `log$` — 订阅以实现调试日志面板、外部错误上报等
 *
 * @example 报告致命错误（触发蓝屏）
 * ```ts
 * import { useDebugStore } from '@/stores'
 *
 * const debugStore = useDebugStore()
 *
 * try {
 *   await loadCriticalConfig()
 * } catch (err) {
 *   debugStore.reportFatal(err, {
 *     title: '配置加载失败',
 *     category: 'config',
 *   })
 * }
 * ```
 *
 * @example 报告非致命错误（弹出提示）
 * ```ts
 * try {
 *   await fetchMarkerData()
 * } catch (err) {
 *   debugStore.reportError(err, {
 *     category: 'marker',
 *     retryable: true,
 *   })
 * }
 * ```
 *
 * @example 使用标签记录结构化日志
 * ```ts
 * debugStore.info('瓦片加载完成', {
 *   tags: ['tile', 'performance'],
 *   payload: { count: 128, duration: 320 },
 * })
 * ```
 *
 * @example 使用计时器测量耗时
 * ```ts
 * debugStore.time('render-frame', { tags: ['performance'] })
 * // ... 执行渲染
 * const duration = debugStore.timeEnd('render-frame')
 * ```
 *
 * @example UI 层订阅致命错误流
 * ```ts
 * import { useDebugStore } from '@/stores'
 *
 * const debugStore = useDebugStore()
 * debugStore.fatalError$.subscribe((fatal) => {
 *   // 渲染蓝屏组件
 *   showBlueScreen(fatal)
 * })
 * ```
 *
 * 该 Store 不考虑 App 初始化之前产生的错误（如 JS 模块加载失败、
 * 非安全上下文等问题），这些问题需要在入口 HTML / 全局脚本中单独处理。
 */
export const useDebugStore = defineStore('debug', () => {
  /** 日志环形缓冲区（最新在前） */
  const logs = shallowRef<LogEntry[]>([])

  /** 当前致命错误，非 null 时应用应展示蓝屏 */
  const fatalError = shallowRef<FatalError | null>(null)

  /** 待展示的非致命错误队列 */
  const noticeableErrors = shallowRef<NoticeableError[]>([])

  /** 环形缓冲区最大容量 */
  const maxLogEntries = ref<number>(DEFAULT_MAX_LOG_ENTRIES)

  /** 当前日志级别，低于此级别的日志不写入缓冲区（仍会发布事件） */
  const logLevel = ref<LogLevel>('debug')

  /** 活跃计时器 Map */
  const timers = shallowRef(new Map<string, TimerEntry>())

  /** 当前是否处于调试模式 */
  const isDebugMode = computed(() => import.meta.env.DEV)

  /** 各级别日志数量统计 */
  const countByLevel = computed<LogLevelCount>(() => {
    const count: LogLevelCount = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 }
    for (const entry of logs.value) {
      count[entry.level]++
    }
    return count
  })

  /** 是否存在 error 及以上级别的日志 */
  const hasErrors = computed(() => {
    for (const entry of logs.value) {
      if (entry.level === 'error' || entry.level === 'fatal') return true
    }
    return false
  })

  /** 日志总条数 */
  const logCount = computed(() => logs.value.length)

  /** 致命错误流，蓝屏组件订阅 */
  const fatalError$ = new Subject<FatalError>()

  /** 非致命错误流，Toast / Notification 组件订阅 */
  const noticeableError$ = new Subject<NoticeableError>()

  /** 所有日志流，调试面板 / 外部上报订阅 */
  const log$ = new Subject<LogEntry>()

  /**
   * 报告系统级致命错误。
   * 该错误会将应用转入蓝屏状态，必须由开发者进行修复。
   *
   * @param error - 错误对象或错误消息
   * @param options - 选项（标题、分类）
   * @returns 致命错误详情对象
   *
   * @example
   * ```ts
   * debugStore.reportFatal(err, {
   *   title: '配置加载失败',
   *   category: 'config',
   * })
   * ```
   */
  const reportFatal = (error: unknown, options: ReportFatalOptions): FatalError => {
    const entry: FatalError = {
      id: generateId(),
      title: options.title,
      message: toErrorMessage(error),
      error: toError(error),
      category: options.category,
      timestamp: Date.now(),
    }
    // 设置致命错误状态（触发蓝屏）
    fatalError.value = entry
    // 发布致命错误事件
    fatalError$.next(entry)
    // 写入 fatal 级日志
    log('fatal', `[${options.category}] ${options.title}: ${entry.message}`, {
      tags: [options.category, 'fatal'],
      error: entry.error,
    })
    return entry
  }

  /**
   * 报告系统级非致命错误。
   * 该错误会弹出明显的应用内提示（如 Toast），但不影响应用整体运行。
   *
   * @param error - 错误对象或错误消息
   * @param options - 选项（分类、是否可重试）
   * @returns 非致命错误详情对象
   *
   * @example
   * ```ts
   * debugStore.reportError(err, {
   *   category: 'marker',
   *   retryable: true,
   * })
   * ```
   */
  const reportError = (error: unknown, options: ReportErrorOptions): NoticeableError => {
    const entry: NoticeableError = {
      id: generateId(),
      message: toErrorMessage(error),
      error: toError(error),
      category: options.category,
      timestamp: Date.now(),
      retryable: options.retryable,
    }
    // 推入非致命错误队列
    noticeableErrors.value = [...noticeableErrors.value, entry]
    // 发布非致命错误事件
    noticeableError$.next(entry)
    // 写入 error 级日志
    log('error', `[${options.category}] ${entry.message}`, {
      tags: [options.category, 'error'],
      error: entry.error,
    })
    return entry
  }

  /**
   * 关闭（移除）一条非致命错误提示。
   *
   * @param id - 错误 ID
   */
  const dismissError = (id: string): void => {
    noticeableErrors.value = noticeableErrors.value.filter((e) => e.id !== id)
  }

  /**
   * 清空所有非致命错误。
   */
  const clearNoticeableErrors = (): void => {
    noticeableErrors.value = []
  }

  /**
   * 报告警告级错误。
   * 警告不影响核心功能，但值得关注（如瓦片请求因移出视口而取消的 AbortError 等）。
   *
   * @param message - 警告消息
   * @param options - 选项（标签、附加数据、错误对象）
   *
   * @example
   * ```ts
   * debugStore.warn('瓦片请求已取消', {
   *   tags: ['tile', 'abort'],
   *   payload: { tileCoord: '12/345/678' },
   *   error: abortError,
   * })
   * ```
   */
  const warn = (message: string, options?: LogOptions): void => {
    log('warn', message, options)
  }

  /**
   * 记录 info 级常规日志。
   *
   * @param message - 日志消息
   * @param options - 选项（标签、附加数据、错误对象）
   */
  const info = (message: string, options?: LogOptions): void => {
    log('info', message, options)
  }

  /**
   * 记录 debug 级日志。
   * 仅在调试模式或 logLevel 设为 debug 时推荐使用。
   *
   * @param message - 日志消息
   * @param options - 选项（标签、附加数据）
   */
  const debug = (message: string, options?: LogOptions): void => {
    log('debug', message, options)
  }

  /**
   * 通用日志记录方法（底层实现）。
   * info / warn / debug 等便捷方法最终都会调用此方法。
   *
   * @param level - 日志级别
   * @param message - 日志消息
   * @param options - 选项（标签、附加数据、错误对象）
   * @returns 创建的日志条目
   */
  const log = (level: LogLevel, message: string, options?: LogOptions): LogEntry => {
    const entry: LogEntry = {
      id: generateId(),
      level,
      message,
      tags: options?.tags ?? [],
      timestamp: Date.now(),
      payload: options?.payload,
      error: options?.error,
    }
    // 发布日志事件（无论级别都发布，便于外部订阅者决策）
    log$.next(entry)
    // 若级别 >= 当前 logLevel，则写入环形缓冲区
    if (levelGte(level, logLevel.value)) {
      const next = [entry, ...logs.value]
      // 超出上限时截断（丢弃最旧条目）
      if (next.length > maxLogEntries.value) {
        next.length = maxLogEntries.value
      }
      logs.value = next
    }
    return entry
  }

  /**
   * 启动一个计时器，用于测量代码执行耗时。
   * 配合 {@link useDebugStore.timeEnd | timeEnd} 使用。
   *
   * @param label - 计时器名称（唯一标识）
   * @param options - 选项（标签）
   *
   * @example
   * ```ts
   * debugStore.time('render', { tags: ['performance'] })
   * // ... 执行代码
   * debugStore.timeEnd('render')
   * ```
   */
  const time = (label: string, options?: TimerOptions): void => {
    // TODO: 创建 TimerEntry 并加入 timers Map
  }

  /**
   * 结束计时器，记录耗时日志并返回耗时。
   * 若指定名称的计时器不存在，则返回 undefined。
   *
   * @param label - 计时器名称
   * @returns 耗时（毫秒），若计时器不存在则为 undefined
   */
  const timeEnd = (label: string): number | undefined => {
    // TODO: 结束计时器
    // 1. 从 timers 中查找并移除
    // 2. 计算 duration
    // 3. 写入一条 info 级日志（携带 duration 信息）
    // 4. 返回耗时
    return undefined
  }

  /**
   * 动态设置日志级别。
   * 低于该级别的日志将不会写入内存缓冲区（但仍会发布 log$ 事件）。
   *
   * @param level - 目标日志级别
   */
  const setLogLevel = (level: LogLevel): void => {
    logLevel.value = level
  }

  /**
   * 设置日志缓冲区最大容量。
   *
   * @param max - 最大条数
   */
  const setMaxLogEntries = (max: number): void => {
    maxLogEntries.value = max
    // 若当前日志数超过新上限则截断
    if (logs.value.length > max) {
      logs.value = logs.value.slice(0, max)
    }
  }

  /**
   * 按条件过滤获取日志。
   *
   * @param filter - 过滤条件
   * @returns 符合条件的日志条目数组
   *
   * @example
   * ```ts
   * const errors = debugStore.getLogs({ level: 'error' })
   * const tileLogs = debugStore.getLogs({ tags: ['tile'] })
   * ```
   */
  const getLogs = (filter?: LogFilter): LogEntry[] => {
    if (!filter) return logs.value
    return logs.value.filter((entry) => {
      if (filter.level && entry.level !== filter.level) return false
      if (filter.tags && filter.tags.length > 0) {
        return filter.tags.every((tag) => entry.tags.includes(tag))
      }
      return true
    })
  }

  /**
   * 清空日志缓冲区。
   */
  const clearLogs = (): void => {
    logs.value = []
  }

  /**
   * 导出当前日志缓冲区为 JSON 字符串。
   * 便于用户在报告问题时复制粘贴，或持久化到外部存储。
   *
   * @returns JSON 格式的日志字符串
   */
  const exportLogs = (): string => {
    // 将 Error 对象序列化为普通对象，避免 JSON.stringify 丢失堆栈信息
    const serializeError = (err: Error | undefined) => {
      if (!err) return undefined
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
      }
    }
    const data = logs.value.map((entry) => ({
      ...entry,
      error: serializeError(entry.error),
    }))
    return JSON.stringify(data, null, 2)
  }

  /**
   * 切换调试模式开关。
   * 调试模式下会输出更详细的日志信息。
   *
   * 生产环境中此方法可能受限，需通过特殊入口（如 URL 参数）启用。
   */
  const toggleDebugMode = (): void => {
    // TODO: 切换调试模式（生产环境需额外校验）
  }

  // ── 返回 ────────────────────────────────────────────────

  return {
    // 状态
    logs,
    fatalError,
    noticeableErrors,
    maxLogEntries,
    logLevel,
    timers,
    // 计算属性
    isDebugMode,
    countByLevel,
    hasErrors,
    logCount,
    // 事件流
    fatalError$,
    noticeableError$,
    log$,
    // 方法：致命错误
    reportFatal,
    // 方法：非致命错误
    reportError,
    dismissError,
    clearNoticeableErrors,
    // 方法：警告
    warn,
    // 方法：日志
    info,
    debug,
    log,
    // 方法：计时
    time,
    timeEnd,
    // 方法：辅助
    setLogLevel,
    setMaxLogEntries,
    getLogs,
    clearLogs,
    exportLogs,
    toggleDebugMode,
  }
})

// ─── HMR ────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDebugStore, import.meta.hot))
}
