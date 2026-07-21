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
flat in float vBottomMask;
flat in float vTopMask;

out vec4 fragColor;

void main(void) {
  geometry.uv = uv;

  // ==========================================
  // 1. 消除 originalColor 的 UV 越界判断 if
  // ==========================================
  // step(edge, x): x >= edge ? 1.0 : 0.0
  // 结合 4 个边界的 step 结果，如果都在 [0, 1] 范围内，乘积为 1.0，否则为 0.0
  vec4 inBounds = step(vec4(0.0, 0.0, vMixtureUV), vec4(vMixtureUV, 1.0, 1.0));
  float isSafe = inBounds.x * inBounds.y * inBounds.z * inBounds.w;

  // 始终进行采样（避免分支），通过乘法将越界像素直接抹成透明 vec4(0.0)
  vec4 originalColor = texture(iconsTexture, vMixtureTextureCoords) * isSafe;

  // 2. 按 z-order 混合: bottomMask → 原始纹理 → topMask
  vec4 texColor = vec4(0.0);

  // ==========================================
  // 2a. 消除 bottomMask 循环体内的 if
  // ==========================================
  for (int i = 0; i < MIXTURE_MAX_STATE_BITS; ++i) {
    // 提取位掩码状态：通过乘法或位移转为 float (0.0 或 1.0)
    float maskActive = float((int(vBottomMask) >> i) & 1);

    // 始终执行采样，通过 maskActive 控制该状态的有效性
    vec4 stateColor = texture(iconsTexture, vMixtureStateCoords[i]);

    // 如果 maskActive 为 0，混合系数变为 0，即不产生任何混合效果（保持 texColor）
    texColor = mix(texColor, stateColor, stateColor.a * maskActive);
  }

  // 2b. 原始纹理混合
  texColor = mix(texColor, originalColor, originalColor.a);

  // ==========================================
  // 2c. 消除 topMask 循环体内的 if
  // ==========================================
  for (int i = 0; i < MIXTURE_MAX_STATE_BITS; ++i) {
    float maskActive = float((int(vTopMask) >> i) & 1);
    vec4 stateColor = texture(iconsTexture, vMixtureStateCoords[i]);
    texColor = mix(texColor, stateColor, stateColor.a * maskActive);
  }

  // 3. 颜色与 Alpha 计算
  vec3 color = mix(texColor.rgb, vColor.rgb, vColorMode);
  float a = texColor.a * layer.opacity * vColor.a;

  // ==========================================
  // 注：这里的 alphaCutoff discard 建议保留
  // ==========================================
  // 虽然可以用类似 alpha 覆盖的方式规避，但对于混合/透明度图层，
  // 显式 discard 可以让 GPU 尽早结束当前像素流，提升早阶深度测试（Early-Z）效率。
  if (a < icon.alphaCutoff) {
    discard;
  }

  fragColor = vec4(color, a);
  DECKGL_FILTER_COLOR(fragColor, geometry);
}