import path from 'node:path'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { Logger } from './logger'

export async function convertSvgToPng(sourceDir: string): Promise<void> {
  const files = await readdir(sourceDir)
  const svgFiles = files.filter(file => file.endsWith('.svg'))

  if (svgFiles.length === 0) {
    Logger.info(`SVG 转 PNG: ${sourceDir} 目录下未找到 SVG 文件`)
    return
  }

  for (const svgFile of svgFiles) {
    const svgPath = path.join(sourceDir, svgFile)
    const pngPath = path.join(sourceDir, svgFile.replace('.svg', '.png'))

    try {
      const svgBuffer = await readFile(svgPath)
      const pngBuffer = await sharp(svgBuffer).png().toBuffer()
      await writeFile(pngPath, pngBuffer)
      Logger.success(`SVG 转 PNG: ${svgFile} -> ${svgFile.replace('.svg', '.png')}`)
    } catch (error) {
      Logger.info(`SVG 转 PNG: 转换 ${svgFile} 失败 - ${(error as Error).message}`)
    }
  }
}

export async function convertSingleSvgToPng(svgPath: string): Promise<void> {
  if (!svgPath.endsWith('.svg')) {
    return
  }

  const pngPath = svgPath.replace('.svg', '.png')

  try {
    const svgBuffer = await readFile(svgPath)
    const pngBuffer = await sharp(svgBuffer).png().toBuffer()
    await writeFile(pngPath, pngBuffer)
    Logger.success(`SVG 转 PNG: ${path.basename(svgPath)} -> ${path.basename(pngPath)}`)
  } catch (error) {
    Logger.info(`SVG 转 PNG: 转换 ${path.basename(svgPath)} 失败 - ${(error as Error).message}`)
  }
}
