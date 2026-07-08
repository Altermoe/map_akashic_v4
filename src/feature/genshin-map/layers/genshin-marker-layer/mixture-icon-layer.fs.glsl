#version 300 es
#define SHADER_NAME icon-layer-fragment-shader

// MixtureIconLayer 自定义 fragment shader
// 替代 IconLayer 默认 fragment shader,实现:
// 1. 原始纹理经过 vertex shader 计算的 vMixtureTextureCoords 采样
// 2. 按"bottomMask 状态 → 原始纹理 → topMask 状态"的层级混合
// 状态纹理位于 iconAtlas 首行,数量上限为 MIXTURE_MAX_STATE_BITS (8 个,见 getShaders 中的 defines)
//
// 注意: mixture* uniforms 由 mixtureUniforms 模块的 std140 block `mixture` 注入
//       访问方式为 mixture.mixtureXxx(luma.gl 自动将 module props 映射到 block 字段)
//       vMixtureStateCoords 数组大小由 defines: { MIXTURE_MAX_STATE_BITS: 8 } 控制

precision highp float;
// 关键: std140 uniform block 中的 int 成员(mixtureBottomMask / mixtureTopMask)
// 必须在 fragment shader 显式声明 highp,否则 GLSL ES 默认 mediump
// 会与 vertex shader 的 highp 不一致,触发 WebGL link error:
// "Precisions of uniform block 'mixtureUniforms' member ... differ between VERTEX and FRAGMENT shaders."
precision highp int;

uniform sampler2D iconsTexture;

in float vColorMode;
in vec4 vColor;
in vec2 vTextureCoords; // 由 vertex shader 默认声明,此处作为 in 保留(实际未使用)
in vec2 uv;

// 来自 vertex shader 注入的 varying
in vec2 vMixtureTextureCoords; // 缩放+平移后的原始纹理 UV
in vec2 vMixtureUV; // sprite-local 缩放+平移后的 UV,用于越界判断
in vec2 vMixtureStateCoords[MIXTURE_MAX_STATE_BITS]; // 每个状态纹理在当前 fragment 处的 UV

out vec4 fragColor;

void main(void) {
  geometry.uv = uv;

  // 1. 采样经过 scale + translate 的原始图标
  //    当 vMixtureUV 超出 [0, 1] 时(iconScale < 1 导致越界),
  //    跳过采样以避免读到 atlas 中相邻精灵的纹理
  vec4 originalColor;
  if (all(greaterThanEqual(vMixtureUV, vec2(0.0))) && all(lessThanEqual(vMixtureUV, vec2(1.0)))) {
    originalColor = texture(iconsTexture, vMixtureTextureCoords);
  } else {
    originalColor = vec4(0.0);
  }

  // 2. 按 z-order 混合:bottomMask 状态(底) → 原始纹理(中) → topMask 状态(顶)
  vec4 texColor = vec4(0.0);

  // 2a. bottomMask 状态纹理 — 位于最底层
  for (int i = 0; i < MIXTURE_MAX_STATE_BITS; ++i) {
    if ((mixture.mixtureBottomMask >> i & 1) == 1) {
      vec4 stateColor = texture(iconsTexture, vMixtureStateCoords[i]);
      texColor = mix(texColor, stateColor, stateColor.a);
    }
  }

  // 2b. 原始纹理 — 位于中间
  texColor = mix(texColor, originalColor, originalColor.a);

  // 2c. topMask 状态纹理 — 位于最顶层
  for (int i = 0; i < MIXTURE_MAX_STATE_BITS; ++i) {
    if ((mixture.mixtureTopMask >> i & 1) == 1) {
      vec4 stateColor = texture(iconsTexture, vMixtureStateCoords[i]);
      texColor = mix(texColor, stateColor, stateColor.a);
    }
  }

  // 3. 沿用 IconLayer 的颜色模式与 alpha 计算
  // if colorMode == 0, use pixel color from the texture
  // if colorMode == 1 or rendering picking buffer, use texture as transparency mask
  vec3 color = mix(texColor.rgb, vColor.rgb, vColorMode);
  // Take the global opacity and the alpha from vColor into account for the alpha component
  float a = texColor.a * layer.opacity * vColor.a;

  if (a < icon.alphaCutoff) {
    discard;
  }

  fragColor = vec4(color, a);
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
