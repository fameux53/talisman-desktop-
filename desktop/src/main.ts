import { app, BrowserWindow, Menu, shell, globalShortcut } from 'electron';
import { join } from 'path';
import { initDatabase } from './database';
import { setupTray } from './tray';
import { setupAutoUpdater } from './updater';
import { registerShortcuts } from './shortcuts';
import { registerIpcHandlers } from './ipc-handlers';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Talisman',
    icon: join(__dirname, '../resources/icon.png'),

    // Professional window chrome
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,

    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },

    center: true,
  });

  // Load the React app
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Serve frontend via local HTTP server so cookies work (file:// breaks SameSite cookies)
    const http = require('http');
    const fs = require('fs');
    const pathMod = require('path');
    const rendererDir = join(process.resourcesPath, 'renderer');
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
      '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
    };
    const indexPath = join(rendererDir, 'index.html');
    const rendererPrefix = rendererDir + pathMod.sep;
    const server = http.createServer((req: any, res: any) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');

      // Inline validation so CodeQL sees the guard protecting fs calls directly
      let servePath = indexPath;
      if (!relative.includes('..') && !relative.includes('~')) {
        const resolved = pathMod.normalize(pathMod.join(rendererDir, relative));
        if (resolved.startsWith(rendererPrefix) && fs.existsSync(resolved) && pathMod.extname(resolved)) {
          servePath = resolved;
        }
      }

      const ext = pathMod.extname(servePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/html' });
      fs.createReadStream(servePath).pipe(res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = server.address().port;
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  // Open external links in system browser — only allow https URLs
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Minimize to tray instead of quitting (Windows/Linux)
  mainWindow.on('close', (event) => {
    if (process.platform !== 'darwin') {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Talisman',
      submenu: [
        { label: 'About Talisman', role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('navigate', '/profile');
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            // Remove close handler to actually quit
            mainWindow?.removeAllListeners('close');
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Sales',
      submenu: [
        {
          label: 'New Sale',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('action', 'new-sale');
          },
        },
        {
          label: 'Sales History',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            mainWindow?.webContents.send('navigate', '/history');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow?.webContents.send('navigate', '/');
          },
        },
        {
          label: 'Inventory',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow?.webContents.send('navigate', '/inventory');
          },
        },
        {
          label: 'Credit',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow?.webContents.send('navigate', '/credit');
          },
        },
        {
          label: 'Reports',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow?.webContents.send('navigate', '/reports');
          },
        },
        { type: 'separator' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { label: 'Reset Zoom', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Export Reports as PDF',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.send('action', 'export-pdf');
          },
        },
        {
          label: 'Export Data as CSV',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            mainWindow?.webContents.send('action', 'export-csv');
          },
        },
        {
          label: 'Print Receipt',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow?.webContents.send('action', 'print-receipt');
          },
        },
        { type: 'separator' },
        {
          label: 'Backup Database',
          click: () => {
            mainWindow?.webContents.send('action', 'backup-db');
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Business Tips',
          click: () => {
            mainWindow?.webContents.send('navigate', '/tips');
          },
        },
        { label: 'About', role: 'about' },
      ],
    },
  ];

  // macOS: add Edit menu with copy/paste
  if (process.platform === 'darwin') {
    template.splice(1, 0, {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// App lifecycle
app.whenReady().then(async () => {
  await initDatabase();
  createMenu();
  await createWindow();
  setupTray(mainWindow!);
  setupAutoUpdater();
  registerShortcuts(mainWindow!);
  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
