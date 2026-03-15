import { app, shell, BrowserWindow, ipcMain, desktopCapturer, session } from 'electron'
import { join } from 'path'
// @ts-ignore
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false
  })

  // マウスイベントを透過させる設定（キャラクター部分以外）
  // レンダラーから制御するためにIPCを追加すること
  mainWindow.setIgnoreMouseEvents(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 画面キャプチャ用のソースを取得するIPC
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 720 } })
  return sources.map(source => ({
    id: source.id,
    name: source.name
  }))
})

// マウスイベント透過切り替え用のIPC
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.setIgnoreMouseEvents(ignore, options)
})

// ずんだもんウィンドウをドラッグで移動する用のIPC
ipcMain.on('window-move', (_event, offset: { x: number; y: number }) => {
  const win = BrowserWindow.fromWebContents(_event.sender)
  if (win) {
    const [cx, cy] = win.getPosition()
    win.setPosition(cx + offset.x, cy + offset.y)
  }
})

app.whenReady().then(() => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron')
  }

  // 権限ハンドラーの設定
  const ses = session.defaultSession
  ses.setPermissionCheckHandler((_webContents: any, permission: string) => {
    return ['media', 'audioCapture', 'screen', 'display-capture'].includes(permission)
  })
  ses.setPermissionRequestHandler((_webContents: any, permission: string, callback: (allow: boolean) => void) => {
    callback(['media', 'audioCapture', 'screen', 'display-capture'].includes(permission))
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
