"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const database_1 = require("./database");
const tray_1 = require("./tray");
const updater_1 = require("./updater");
const shortcuts_1 = require("./shortcuts");
const ipc_handlers_1 = require("./ipc-handlers");
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Talisman',
        icon: (0, path_1.join)(__dirname, '../resources/icon.png'),
        // Professional window chrome
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        frame: true,
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload.js'),
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
    }
    else {
        // Serve frontend via local HTTP server so cookies work (file:// breaks SameSite cookies)
        const http = require('http');
        const fs = require('fs');
        const pathMod = require('path');
        const rendererDir = (0, path_1.join)(process.resourcesPath, 'renderer');
        const mimeTypes = {
            '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
            '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
            '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
        };
        const server = http.createServer((req, res) => {
            let filePath = (0, path_1.join)(rendererDir, req.url === '/' ? 'index.html' : req.url);
            if (!fs.existsSync(filePath))
                filePath = (0, path_1.join)(rendererDir, 'index.html'); // SPA fallback
            const ext = pathMod.extname(filePath);
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            fs.createReadStream(filePath).pipe(res);
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        const port = server.address().port;
        await mainWindow.loadURL(`http://127.0.0.1:${port}`);
    }
    // Open external links in system browser — only allow https URLs
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) {
            electron_1.shell.openExternal(url);
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
    const template = [
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
                        electron_1.app.quit();
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
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
// App lifecycle
electron_1.app.whenReady().then(async () => {
    await (0, database_1.initDatabase)();
    createMenu();
    await createWindow();
    (0, tray_1.setupTray)(mainWindow);
    (0, updater_1.setupAutoUpdater)();
    (0, shortcuts_1.registerShortcuts)(mainWindow);
    (0, ipc_handlers_1.registerIpcHandlers)();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
        else {
            mainWindow?.show();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('will-quit', () => {
    electron_1.globalShortcut.unregisterAll();
});
//# sourceMappingURL=main.js.map