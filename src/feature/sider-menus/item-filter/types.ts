/** 同名物品合并后的虚拟分组；items 为该组在当前作用域下的实际物品 id 集合 */
export interface VirtualItemGroup {
  id: string
  name: string
  iconId?: number
  items: Set<number | undefined>
}
