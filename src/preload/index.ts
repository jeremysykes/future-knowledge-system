import { contextBridge, ipcRenderer } from 'electron'

export interface FileStats {
  size: number
  createdAt: string
  modifiedAt: string
}

export interface FileInfo {
  path: string
  name: string
}

const api = {
  onPrepareToClose: (callback: () => Promise<void>): void => {
    ipcRenderer.once('app:prepare-to-close', async () => {
      try {
        await callback()
      } finally {
        ipcRenderer.send('app:ready-to-close')
      }
    })
  },

  fs: {
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('fs:selectDirectory'),

    selectFiles: (options?: { extensions?: string[] }): Promise<string[]> =>
      ipcRenderer.invoke('fs:selectFiles', options || {}),

    readFile: (path: string): Promise<{ success: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke('fs:readFile', path),

    writeFile: (path: string, content: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:writeFile', path, content),

    listMarkdownFiles: (dir: string): Promise<{ success: boolean; files: FileInfo[]; error?: string }> =>
      ipcRenderer.invoke('fs:listMarkdownFiles', dir),

    ensureDir: (path: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:ensureDir', path),

    getStats: (path: string): Promise<{ success: boolean; stats?: FileStats; error?: string }> =>
      ipcRenderer.invoke('fs:getStats', path)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
