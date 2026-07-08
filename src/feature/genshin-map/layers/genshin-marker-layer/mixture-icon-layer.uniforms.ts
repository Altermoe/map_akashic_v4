// MixtureIconLayer 的自定义 Shader Module
// 用于将 iconScale / iconTranslate / bottomMask / topMask / iconGap 注入到 shader 中
//
// 重要: luma.gl 的 WebGL2 设备通过 shader introspection 解析 uniform BLOCK
// (而非 plain uniform),所以必须将 uniforms 包装到 layout(std140) block 中。
// 模块 name: 'mixture' 必须与 uniform block 的变量名一致,introspection 时
// luma.gl 会通过 getShaderLayoutBindingByName 匹配 'mixture' / 'mixtureUniforms'。
//
// 注意: 不导入 @luma.gl/shadertools 类型(它通过 deck.gl/core 作为 peer 传递依赖,
// TypeScript 在本项目配置下无法直接解析),模块对象的形状按 ShaderModule 契约手写。
// 通过 const 断言保持字面量类型供 setProps 调用处的类型推断。

/**
 * Mixture 模块的 props / uniforms 类型
 *
 * - 通过 model.shaderInputs.setProps({mixture: {...}}) 注入 uniform 值
 * - 在 fragment shader 中按"bottomMask 状态 → 原始纹理 → topMask 状态"的顺序混合
 * - 在 vertex shader 中基于 quadUV 计算缩放+平移后的 UV,以及各状态纹理的 UV
 */
export type MixtureProps = {
  /** 缩放倍率 (0~2) */
  mixtureIconScale: number
  /** 平移偏移 (绝对像素) */
  mixtureIconTranslate: [number, number]
  /** 底部状态纹理位掩码 */
  mixtureBottomMask: number
  /** 顶部状态纹理位掩码 */
  mixtureTopMask: number
  /** 图标间距 (atlas 中的 gap,默认 1) */
  mixtureIconGap: number
}

// std140 布局说明:
// - vec2 起始地址必须是 8 的倍数
// - float/int 起始地址必须是 4 的倍数
// 布局顺序: vec2 (offset 0) → 2*float (offset 8) → 2*int (offset 16)
// 总大小: 24 字节,无尾部 padding
const uniformBlock = /* glsl */ `
layout(std140) uniform mixtureUniforms {
  vec2 mixtureIconTranslate;
  float mixtureIconScale;
  float mixtureIconGap;
  // 显式声明 highp: luma.gl 将 module 的 vs/fs 注入到主 shader 时,
  // uniform block 的声明位置早于主 shader 的 precision 语句,
  // 因此 fragment shader 中 int 成员会使用 GLSL ES 默认的 mediump,
  // 与 vertex shader 的 highp 不一致,触发 WebGL link error。
  highp int mixtureBottomMask;
  highp int mixtureTopMask;
} mixture;
`

/**
 * MixtureIconLayer 的 Shader Module
 *
 * 对象形状与 luma.gl shadertools 的 ShaderModule 契约一致(由 luma.gl 在运行时读取)。
 * 使用 const 断言保留字面量类型,确保 defaultUniforms 不会被推断为宽泛类型。
 */
export const mixtureUniforms = {
  name: 'mixture',
  vs: uniformBlock,
  fs: uniformBlock,
  // 字段顺序必须与上方 uniformBlock 中 GLSL 声明的顺序完全一致,
  // luma.gl 会按 GLSL introspection 的字段顺序与此处逐项校验。
  uniformTypes: {
    mixtureIconTranslate: 'vec2<f32>',
    mixtureIconScale: 'f32',
    mixtureIconGap: 'f32',
    mixtureBottomMask: 'i32',
    mixtureTopMask: 'i32',
  },
  defaultUniforms: {
    mixtureIconTranslate: [0, 0] as [number, number],
    mixtureIconScale: 1,
    mixtureIconGap: 1,
    mixtureBottomMask: 0,
    mixtureTopMask: 0,
  },
} as const
