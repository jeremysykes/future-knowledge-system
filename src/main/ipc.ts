import { ipcMain, dialog } from 'electron'
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises'
import { join, basename, extname } from 'path'

export function setupIPC(): void {
  ipcMain.handle('fs:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('fs:selectFiles', async (_, options: { extensions?: string[] }) => {
    const filters = options.extensions
      ? [{ name: 'Files', extensions: options.extensions }]
      : []

    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const content = await readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      await writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:listMarkdownFiles', async (_, dirPath: string) => {
    const files: Array<{ path: string; name: string }> = []

    async function walk(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walk(fullPath)
        } else if (entry.isFile() && extname(entry.name) === '.md') {
          files.push({
            path: fullPath,
            name: basename(entry.name, '.md')
          })
        }
      }
    }

    try {
      await walk(dirPath)
      return { success: true, files }
    } catch (error) {
      return { success: false, error: String(error), files: [] }
    }
  })

  ipcMain.handle('fs:ensureDir', async (_, dirPath: string) => {
    try {
      await mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:getStats', async (_, filePath: string) => {
    try {
      const stats = await stat(filePath)
      return {
        success: true,
        stats: {
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString()
        }
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
