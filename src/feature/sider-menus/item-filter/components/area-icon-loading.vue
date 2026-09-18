<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <defs>
      <!-- 四角装饰小方块 -->
      <rect
        id="area-rect"
        x="0.5"
        y="0.5"
        width="3"
        height="3"
        fill="#FFF"
        fill-opacity="0.9"
        transform="rotate(45)"
      />

      <!--
        波浪渐变说明：
        - gradientUnits="userSpaceOnUse"，坐标基于根坐标系（viewBox 0 0 100 100）
        - 渐变窗口宽度固定 60，高光位于窗口正中（offset 0.5）
        - 因此高光位置 = (x1 + x2) / 2
        - 起始：高光在 x = -40（菱形左侧之外，看不见）
        - 结束：高光在 x = 140（菱形右侧之外，已扫完）
        - 菱形横向范围 x ∈ [20, 80]，所以扫光全程完整穿过
      -->
      <linearGradient
        id="area-skeleton-grad"
        gradientUnits="userSpaceOnUse"
        x1="-70"
        y1="0"
        x2="-10"
        y2="0"
      >
        <stop offset="0" stop-color="#FFF" stop-opacity="0.06" />
        <stop offset="0.45" stop-color="#FFF" stop-opacity="0.15" />
        <stop offset="0.5" stop-color="#FFF" stop-opacity="0.5" />
        <stop offset="0.55" stop-color="#FFF" stop-opacity="0.15" />
        <stop offset="1" stop-color="#FFF" stop-opacity="0.06" />

        <!-- 让波浪从左侧远处进入，扫到右侧远处出去 -->
        <animate attributeName="x1" values="-70;110" dur="2s" repeatCount="indefinite" />
        <animate attributeName="x2" values="-10;170" dur="2s" repeatCount="indefinite" />
      </linearGradient>
    </defs>

    <!-- 四角装饰 -->
    <g transform="translate(50, 50)">
      <use href="#area-rect" transform="translate(0, -50)" />
      <use href="#area-rect" transform="rotate(90) translate(0, -50)" />
      <use href="#area-rect" transform="rotate(180) translate(0, -50)" />
      <use href="#area-rect" transform="rotate(270) translate(0, -50)" />
    </g>

    <!-- 方框区域 -->
    <g>
      <!-- 波浪渐变菱形 -->
      <polygon points="20,50 50,80 80,50 50,20 20,50" fill="url(#area-skeleton-grad)" />
      <!-- 外框菱形 -->
      <polygon
        points="7,50 50,93 93,50 50,7 7,50"
        fill="none"
        stroke="#FFF"
        stroke-opacity="0.4"
        stroke-width="1.5"
      />
    </g>
  </svg>
</template>
