#version 300 es
#define SHADER_NAME icon-layer-fragment-shader

precision highp float;
precision highp int;

uniform sampler2D iconsTexture;

in float vColorMode;
in vec4 vColor;
in vec2 vTextureCoords;
in vec2 uv;

in vec2 vMixtureTextureCoords;
in vec2 vMixtureUV;
in vec2 vMixtureStateCoords[MIXTURE_MAX_STATE_BITS];

// per-instance 掩码 (来自 vertex shader 的 flat varying,值为 0~255)
// flat 限定符确保同一实例内所有 fragment 的掩码值一致,因此 if 分支不会产生 warp 发散
flat in float vBottomMask;
flat in float vTopMask;

out vec4 fragColor;

void main(void) {
  geometry.uv = uv;

  // ==========================================
  // 1. 原始纹理采样 (UV 越界时抹零)
  // ==========================================
  // step(edge, x): x >= edge ? 1.0 : 0.0
  // 结合 4 个边界的 step 结果，如果都在 [0, 1] 范围内，乘积为 1.0，否则为 0.0
  vec4 inBounds = step(vec4(0.0, 0.0, vMixtureUV), vec4(vMixtureUV, 1.0, 1.0));
  float isSafe = inBounds.x * inBounds.y * inBounds.z * inBounds.w;
  vec4 originalColor = texture(iconsTexture, vMixtureTextureCoords) * isSafe;

  // 2. 按 z-order 混合: bottomMask -> 原始纹理 -> topMask
  vec4 texColor = vec4(0.0);

  // ==========================================
  // 2a. bottomMask 状态混合
  // ==========================================
  // vBottomMask 为 flat varying,同一实例内所有 fragment 一致,if 分支无 warp 发散。
  // 外层 if 跳过 mask 为 0 的整个循环;内层 if 跳过未激活 bit 的纹理采样。
  if (vBottomMask > 0.0) {
    int mask = int(vBottomMask);
    for (int i = 0; i < MIXTURE_MAX_STATE_BITS; ++i) {
      if ((mask >> i & 1) == 1) {
        vec4 stateColor = texture(iconsTexture, vMixtureStateCoords[i]);
        texColor = mix(texColor, stateColor, stateColor.a);
      }
    }
  }

  // 2b. 原始纹理混合
  texColor = mix(texColor, originalColor, originalColor.a);

  // ==========================================
  // 2c. topMask 状态混合 (同 2a)
  // ==========================================
  if (vTopMask > 0.0) {
    int mask = int(vTopMask);
    for (int i = 0; i < MIXTURE_MAX_STATE_BITS; ++i) {
      if ((mask >> i & 1) == 1) {
        vec4 stateColor = texture(iconsTexture, vMixtureStateCoords[i]);
        texColor = mix(texColor, stateColor, stateColor.a);
      }
    }
  }

  // 3. 颜色与 Alpha 计算
  vec3 color = mix(texColor.rgb, vColor.rgb, vColorMode);
  float a = texColor.a * layer.opacity * vColor.a;

  // alphaCutoff discard: 让 GPU 尽早结束当前像素流,提升 Early-Z 效率
  if (a < icon.alphaCutoff) {
    discard;
  }

  fragColor = vec4(color, a);
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
