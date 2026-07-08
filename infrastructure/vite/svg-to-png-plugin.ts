import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { convertSvgToPng, convertSingleSvgToPng } from '../svg-renderer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface SvgToPngPluginOptions {
  assetsDir?: string
}

export function svgToPngPlugin(options: SvgToPngPluginOptions = {}): Plugin {
  const assetsDir = options.assetsDir ?? path.join(__dirname, '../../src/assets')

  return {
    name: 'svg-to-png',

    async buildStart() {
      await convertSvgToPng(assetsDir)
    },

    configureServer(server) {
      server.watcher.add(assetsDir)

      server.watcher.on('add', async (filePath) => {
        if (filePath.endsWith('.svg')) {
          await convertSingleSvgToPng(filePath)
        }
      })

      server.watcher.on('change', async (filePath) => {
        if (filePath.endsWith('.svg')) {
          await convertSingleSvgToPng(filePath)
        }
      })

      server.watcher.on('unlink', (filePath) => {
        if (filePath.endsWith('.svg')) {
          const pngPath = filePath.replace('.svg', '.png')
          server.watcher.unwatch(pngPath)
        }
      })
    },
  }
}
