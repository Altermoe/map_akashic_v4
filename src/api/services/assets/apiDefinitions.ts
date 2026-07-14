/**
 * 考虑到此系列接口会被高频调用，基于极致性能考虑，当前模块不接入到 alova 控制流中。
 */
const BASE_URL = import.meta.env.VITE_SERVICE_RESOURCE_URL

const root = navigator.storage.getDirectory()
const cachedDirHandles = new Map<string, Promise<FileSystemDirectoryHandle>>()

const getUrlMeta = (url: string) => {
  const parts = url.replace(/^[a-z]+:\/\//i, '').split('/')
  if (!parts) {
    throw new Error(`无法匹配缓存目录: "${url}"`)
  }

  return {
    path: parts.slice(0, -1).join('/'), // 除了最后一个都是文件夹
    filename: parts[parts.length - 1], // 最后一个是文件名
  }
}

const openDir = (
  /** @example 'tileset/tile_twt64/10' */
  path: string,
) => {
  const cached = cachedDirHandles.get(path)
  if (cached) return cached
  const segments = path
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')
    .filter(Boolean)
  if (segments.length === 0) return root
  const dirPromise = (async () => {
    let currentHandle = await root
    for (const segment of segments) {
      currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true })
    }
    return currentHandle
  })()
  cachedDirHandles.set(path, dirPromise)
  return dirPromise
}

const getLockName = (dir: FileSystemDirectoryHandle, filename: string) =>
  `asset-cache:${dir.name}/${filename}`

const withCacheLock = <T>(
  dir: FileSystemDirectoryHandle,
  filename: string,
  callback: () => Promise<T>,
) => navigator.locks.request(getLockName(dir, filename), callback)

const writeCache = async (dir: FileSystemDirectoryHandle, filename: string, data: Blob) => {
  await withCacheLock(dir, filename, async () => {
    try {
      const handle = await dir.getFileHandle(filename, { create: true })
      const stream = await handle.createWritable()
      await stream.write(data).catch(() => stream.abort())
      await stream.close()
    } catch (error) {
      console.error('[writeCache] 写入失败:', error)
    }
  })
}

const writeCacheSync = async (dir: FileSystemDirectoryHandle, filename: string, data: Blob) => {
  await withCacheLock(dir, filename, async () => {
    let accessHandle: FileSystemSyncAccessHandle
    try {
      const handle = await dir.getFileHandle(filename, { create: true })
      accessHandle = await handle.createSyncAccessHandle()
    } catch (error) {
      console.error(`[writeCacheSync] 获取句柄失败 ("${dir.name}/${filename}")`, error)
      return
    }

    try {
      const buffer = await data.arrayBuffer()
      accessHandle.write(buffer)
      accessHandle.flush()
    } catch (error) {
      console.error('[writeCacheSync] 写入失败:', error)
    } finally {
      accessHandle.close()
    }
  })
}

/** 获取 tile 图片资源 */
export const getTile = async (
  query: {
    pathId: string
    x: number
    y: number
    z: number
    zMapping?: number
    extension?: string
  },
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted()

  const { pathId, x, y, z, zMapping = 0, extension = 'png' } = query
  const path = `${BASE_URL}/tiles_${pathId}/${z + zMapping}`
  const filename = `${x}_${y}.${extension}`
  const url = `${path}/${filename}`

  const dir = await openDir(path)
  const cache = await dir.getFileHandle(filename).catch(() => null)
  if (cache) {
    try {
      const file = await cache.getFile()
      return await createImageBitmap(file)
    } catch {
      // 缓存文件可能因写入竞态而损坏，删除后回退到网络请求
      await dir.removeEntry(filename).catch(() => {})
    }
  }

  // 缓存 miss 的情况
  const res = await fetch(url, {
    mode: 'cors',
    method: 'GET',
    signal,
  })
  // 请求失败直接不走缓存
  if (!res.ok) throw new Error(res.statusText || '请求失败')

  const blob = await res.blob()

  // 不需要等待缓存写入
  writeCache(dir, filename, blob)

  signal?.throwIfAborted()
  return createImageBitmap(blob)
}

/** 缓存优先的资源请求 */
export const getCacheableAsset = async (
  url: string,
  options?: { signal?: AbortSignal; cacheError?: boolean },
) => {
  const { signal, cacheError = false } = options ?? {}
  signal?.throwIfAborted()

  const { path, filename } = getUrlMeta(url)
  const errorFilename = `${filename}__error__.txt`
  const dir = await openDir(path)
  const cache = await dir.getFileHandle(filename).catch(() => null)
  if (cache) {
    return cache.getFile()
  }

  // 检测错误缓存
  if (cacheError) {
    const errorCache = await dir.getFileHandle(errorFilename).catch(() => null)
    if (errorCache) {
      const file = await errorCache.getFile()
      const message = await file.text()
      throw new Error(message)
    }
  }

  // 缓存 miss 的情况
  let res: Response
  try {
    res = await fetch(url, {
      mode: 'cors',
      method: 'GET',
      signal,
    })
  } catch (error) {
    // 请求失败时缓存错误消息
    if (cacheError && !signal?.aborted) {
      const message = error instanceof Error ? error.message : String(error)
      const errorBlob = new Blob([message], { type: 'text/plain' })
      if (globalThis.document) writeCache(dir, errorFilename, errorBlob)
      else writeCacheSync(dir, errorFilename, errorBlob)
    }
    throw error
  }
  // 请求失败直接不走缓存
  if (!res.ok) {
    const message = res.statusText || '请求失败'
    if (cacheError) {
      const errorBlob = new Blob([message], { type: 'text/plain' })
      if (globalThis.document) writeCache(dir, errorFilename, errorBlob)
      else writeCacheSync(dir, errorFilename, errorBlob)
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  signal?.throwIfAborted()

  // 不需要等待缓存写入
  if (globalThis.document) writeCache(dir, filename, blob)
  else writeCacheSync(dir, filename, blob)

  return blob
}
