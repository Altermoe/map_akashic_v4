import { describe, expect, it } from 'vitest'
import { loginResponseSchema } from '../services/auth/schema'
import type {
  AreaVo,
  BinaryMD5Vo,
  IconVo,
  ItemTypeVo,
  ItemVo,
  MarkerVo,
  NoticeVo,
} from '../services/main/globals'
import { runtimeApis, tokenManager, unwrap, gunzipText } from './client'
import { runtimeTestEnv } from './env'

/**
 * 运行时接口单测（Phase 1）—— 直连 dev 后端做「运行时数据测试」。
 *
 * 设计要点：
 * - 通过 visitorLogin 以访客身份登录（无需账户/密码），覆盖绝大多数只读接口；
 *   部分查询接口用 POST 实现（如 area.listArea / item.listItemIdByType），请求体按
 *   OpenAPI spec（VITE_SERVICE_MAIN_OPENAPI_URL）与源码调用点确定。
 * - 未配置真实后端（envs 为占位符）时整体 skip，`pnpm test` 保持绿。
 * - 断言贴合「实际 wire format」：marker/item/icon 目录二进制为 gzip JSON
 *   （marker 分页与 `$$userConfigMap` 的 protobuf 注释不符，见 KI-12）。
 * - 跨目录完整性：marker 引用 vs 图标/物品目录，容忍少量历史悬挂引用（阈值见各用例）。
 */

const configured = runtimeTestEnv.configured

describe.skipIf(!configured)(
  'runtime: 主服务运行时接口（真实 dev 后端）',
  { timeout: 120_000 },
  () => {
    describe('auth.visitorLogin（访客登录）', () => {
      it('登录响应符合 loginResponseSchema', async () => {
        const token = await tokenManager.get()
        expect(loginResponseSchema.safeParse(token).success).toBe(true)
        expect(token.token_type).toBe('bearer')
        expect(token.scope).toBe('all')
        expect(token.expires_in).toBeGreaterThan(0)
        expect(token.jti).toBeTruthy()
      })

      it('并发登录单飞：多个 get() 共享同一次请求', async () => {
        tokenManager.invalidate()
        const before = tokenManager.loginCount
        const [a, b, c] = await Promise.all([
          tokenManager.get(),
          tokenManager.get(),
          tokenManager.get(),
        ])
        expect(tokenManager.loginCount - before).toBe(1)
        expect(a.access_token).toBe(b.access_token)
        expect(b.access_token).toBe(c.access_token)
      })

      it('有效期内复用 token，不重复登录', async () => {
        tokenManager.invalidate()
        const before = tokenManager.loginCount
        const t1 = await tokenManager.get()
        const t2 = await tokenManager.get()
        expect(tokenManager.loginCount - before).toBe(1)
        expect(t1.access_token).toBe(t2.access_token)
      })
    })

    describe('area.listArea（区域列表，POST 查询）', () => {
      it('全量区域非空且字段完整', async () => {
        const areas = unwrap<AreaVo[]>(
          await runtimeApis.area.listArea({ data: { isTraverse: true } }).send(),
        )
        expect(areas.length).toBeGreaterThan(0)
        const ids = new Set<number>()
        const codes = new Set<string>()
        let noCode = 0
        for (const area of areas) {
          expect(area.id).toBeDefined()
          expect(area.name?.length ?? 0).toBeGreaterThan(0)
          if (area.code?.length) codes.add(area.code)
          else noCode++
          expect(area.parentId).toBeDefined()
          expect(typeof area.isFinal).toBe('boolean')
          ids.add(area.id!)
        }
        expect(ids.size).toBe(areas.length)
        // dev 环境存在少量回归测试区域（regress_*_area）无 code，允许 ≤10
        expect(noCode).toBeLessThanOrEqual(10)
        expect(codes.size).toBeGreaterThan(0)
      })
    })

    describe('marker_doc.listMarkerBinaryMD5（点位分页清单）', () => {
      it('分页清单形状为 BinaryMD5Vo，md5 全局唯一', async () => {
        const pages = unwrap<BinaryMD5Vo[]>(
          await runtimeApis.marker_doc.listMarkerBinaryMD5().send(),
        )
        expect(pages.length).toBeGreaterThan(0)
        const md5s = new Set<string>()
        for (const page of pages) {
          expect(page.md5).toMatch(/^[0-9a-f]{32}$/)
          expect(typeof page.time).toBe('number')
          expect(page.time!).toBeGreaterThan(0)
          md5s.add(page.md5!)
        }
        expect(md5s.size).toBe(pages.length)
      })
    })

    describe('marker_doc.listPageMarkerByBinary（点位分页数据）', () => {
      const fetchAllPages = async (): Promise<MarkerVo[]> => {
        const pages = unwrap<BinaryMD5Vo[]>(
          await runtimeApis.marker_doc.listMarkerBinaryMD5().send(),
        )
        const all: MarkerVo[] = []
        for (const page of pages) {
          const res = (await runtimeApis.marker_doc
            .listPageMarkerByBinary({ pathParams: { md5: page.md5! } })
            .send()) as unknown as Response
          all.push(...(JSON.parse(await gunzipText(res)) as MarkerVo[]))
        }
        return all
      }

      it('wire format 契约：分页为 gzip JSON（与 protobuf 注释不符，见 KI-12）', async () => {
        const pages = unwrap<BinaryMD5Vo[]>(
          await runtimeApis.marker_doc.listMarkerBinaryMD5().send(),
        )
        const res = (await runtimeApis.marker_doc
          .listPageMarkerByBinary({ pathParams: { md5: pages[0].md5! } })
          .send()) as unknown as Response
        const text = await gunzipText(res)
        expect(text.trimStart().startsWith('[')).toBe(true)
        const arr = JSON.parse(text) as MarkerVo[]
        expect(arr.length).toBeGreaterThan(0)
      })

      it('全部页解码：点位 id 全局唯一、标题/坐标必填且坐标可解析', async () => {
        const all = await fetchAllPages()
        expect(all.length).toBeGreaterThan(10_000)
        const ids = new Set<number>()
        let badPos = 0
        for (const marker of all) {
          expect(marker.id).toBeDefined()
          expect(marker.markerTitle?.length ?? 0).toBeGreaterThan(0)
          expect(marker.position?.length ?? 0).toBeGreaterThan(0)
          const comma = marker.position!.indexOf(',')
          const x = parseFloat(marker.position!)
          const y = parseFloat(marker.position!.slice(comma + 1))
          if (comma < 0 || !Number.isFinite(x) || !Number.isFinite(y)) badPos++
          ids.add(marker.id!)
        }
        expect(ids.size).toBe(all.length)
        expect(badPos).toBe(0)
      })
    })

    describe('item_doc（物品目录二进制）', () => {
      it('分页解压为 ItemVo[]，id 唯一且 name 必填', async () => {
        const pages = unwrap<BinaryMD5Vo[]>(await runtimeApis.item_doc.listItemBinaryMD5().send())
        expect(pages.length).toBeGreaterThan(0)
        const all: ItemVo[] = []
        for (const page of pages) {
          const res = (await runtimeApis.item_doc
            .listPageItemByBinary({ pathParams: { md5: page.md5! } })
            .send()) as unknown as Response
          all.push(...(JSON.parse(await gunzipText(res)) as ItemVo[]))
        }
        expect(all.length).toBeGreaterThan(0)
        const ids = new Set<number>()
        for (const item of all) {
          expect(item.id).toBeDefined()
          expect(item.name?.length ?? 0).toBeGreaterThan(0)
          ids.add(item.id!)
        }
        expect(ids.size).toBe(all.length)
      })
    })

    describe('icon_doc（图标目录二进制）', () => {
      it('md5 清单 + 全量图标解压，id 唯一', async () => {
        const meta = unwrap<BinaryMD5Vo>(await runtimeApis.icon_doc.listAllIconBinaryMd5().send())
        expect(meta.md5).toMatch(/^[0-9a-f]{32}$/)
        expect(typeof meta.time).toBe('number')
        const res = (await runtimeApis.icon_doc.listAllIconBinary().send()) as unknown as Response
        const icons = JSON.parse(await gunzipText(res)) as IconVo[]
        expect(icons.length).toBeGreaterThan(100)
        const ids = new Set<number>()
        for (const icon of icons) {
          expect(icon.id).toBeDefined()
          ids.add(icon.id!)
        }
        expect(ids.size).toBe(icons.length)
      })
    })

    describe('item_type.listItemType（物品类型）', () => {
      it('返回类型列表，id/name 必填', async () => {
        const types = unwrap<ItemTypeVo[]>(await runtimeApis.item_type.listItemType().send())
        expect(types.length).toBeGreaterThan(0)
        for (const type of types) {
          expect(type.id).toBeDefined()
          expect(type.name?.length ?? 0).toBeGreaterThan(0)
        }
      })
    })

    describe('icon.listIcon（图标分页查询，POST）', () => {
      it('分页形状 {record,total,size}，total 与 icon_doc 全量一致', async () => {
        const page = unwrap<{ record: IconVo[]; total: number; size: number }>(
          await runtimeApis.icon
            .listIcon({ data: { current: 1, size: 50, typeIdList: [] } })
            .send(),
        )
        expect(page.total).toBeGreaterThan(0)
        expect(page.record.length).toBeGreaterThan(0)
        expect(page.record.length).toBeLessThanOrEqual(page.size)
        for (const icon of page.record) {
          expect(icon.id).toBeDefined()
        }
        // 与 icon_doc 全量目录交叉核对
        const res = (await runtimeApis.icon_doc.listAllIconBinary().send()) as unknown as Response
        const icons = JSON.parse(await gunzipText(res)) as IconVo[]
        expect(page.total).toBe(icons.length)
      })
    })

    describe('item.listItemIdByType（物品分页查询，POST）', () => {
      it('分页累积全量：id 唯一、total 稳定、record ≤ size', async () => {
        const PAGE_SIZE = 300
        const seen = new Set<number>()
        let total: number | undefined
        let current = 1
        let lastRecordLen = 0
        while (current <= 20) {
          const page = unwrap<{ record: ItemVo[]; total: number; size: number }>(
            await runtimeApis.item
              .listItemIdByType({
                data: {
                  typeIdList: [],
                  areaIdList: [],
                  current,
                  size: PAGE_SIZE,
                  sort: ['sortIndex-'],
                },
              })
              .send(),
          )
          expect(page.record.length).toBeLessThanOrEqual(PAGE_SIZE)
          if (total === undefined) total = page.total
          expect(page.total).toBe(total)
          for (const item of page.record) {
            expect(item.id).toBeDefined()
            seen.add(item.id!)
          }
          lastRecordLen = page.record.length
          if (page.record.length < PAGE_SIZE) break
          current++
        }
        expect(total).toBeDefined()
        expect(seen.size).toBeGreaterThan(1000)
        expect(seen.size).toBe(total!)
        expect(lastRecordLen).toBeLessThan(PAGE_SIZE)
      })
    })

    describe('notice.listNotice（公告列表，POST）', () => {
      it('返回有效公告记录', async () => {
        const page = unwrap<{ record: NoticeVo[]; total: number }>(
          await runtimeApis.notice
            .listNotice({ data: { current: 1, size: 10, getValid: true } })
            .send(),
        )
        expect(page.record.length).toBeGreaterThan(0)
      })
    })

    describe('跨目录数据完整性（marker 引用 vs 图标/物品目录）', () => {
      it('marker 引用的 iconId/itemId 基本都解析到目录（容忍少量历史悬挂引用）', async () => {
        const pages = unwrap<BinaryMD5Vo[]>(
          await runtimeApis.marker_doc.listMarkerBinaryMD5().send(),
        )
        const iconRef = new Set<number>()
        const itemRef = new Set<number>()
        for (const page of pages) {
          const res = (await runtimeApis.marker_doc
            .listPageMarkerByBinary({ pathParams: { md5: page.md5! } })
            .send()) as unknown as Response
          const markers = JSON.parse(await gunzipText(res)) as MarkerVo[]
          for (const marker of markers) {
            for (const link of marker.itemList ?? []) {
              iconRef.add(Number(link.iconId))
              itemRef.add(Number(link.itemId))
            }
          }
        }

        // icon 目录
        const iconRes = (await runtimeApis.icon_doc
          .listAllIconBinary()
          .send()) as unknown as Response
        const icons = JSON.parse(await gunzipText(iconRes)) as IconVo[]
        const iconIds = new Set(icons.map((i) => Number(i.id)))
        const missingIcons = [...iconRef].filter((id) => !iconIds.has(id))
        console.log(
          `[runtime] iconRef=${iconRef.size} iconCatalog=${iconIds.size} missing=${missingIcons.length}`,
          missingIcons.slice(0, 10),
        )
        expect(missingIcons.length).toBeLessThanOrEqual(5)

        // item 目录（分页全量）
        const seen = new Set<number>()
        let current = 1
        while (true) {
          const page = unwrap<{ record: ItemVo[] }>(
            await runtimeApis.item
              .listItemIdByType({
                data: {
                  typeIdList: [],
                  areaIdList: [],
                  current,
                  size: 300,
                  sort: ['sortIndex-'],
                },
              })
              .send(),
          )
          for (const item of page.record) seen.add(Number(item.id))
          if (page.record.length < 300) break
          current++
        }
        const missingItems = [...itemRef].filter((id) => !seen.has(id))
        console.log(
          `[runtime] itemRef=${itemRef.size} itemCatalog=${seen.size} missing=${missingItems.length}`,
          missingItems.slice(0, 15),
        )
        expect(missingItems.length).toBeLessThanOrEqual(25)
      }, 180_000)
    })
  },
)
