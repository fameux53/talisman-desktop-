"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTray = setupTray;
const electron_1 = require("electron");
const path_1 = require("path");
let tray = null;
function setupTray(mainWindow) {
    const iconPath = (0, path_1.join)(__dirname, '../resources/tray-icon.png');
    const icon = electron_1.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(icon);
    tray.setToolTip('MarketMama');
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Open MarketMama',
            click: () => {
                mainWindow.show();
                mainWindow.focus();
            },
        },
        {
            label: 'New Sale',
            click: () => {
                mainWindow.show();
                mainWindow.focus();
                mainWindow.webContents.send('action', 'new-sale');
            },
        },
        { type: 'separator' },
        {
            label: 'Dashboard',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('navigate', '/');
            },
        },
        {
            label: 'Inventory',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('navigate', '/inventory');
            },
        },
        {
            label: 'Reports',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('navigate', '/reports');
            },
        },
        { type: 'separator' },
        {
            label: 'Quit MarketMama',
            click: () => {
                mainWindow.removeAllListeners('close');
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    // Click tray icon to show/hide window
    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        }
        else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
//# sourceMappingURL=tray.js.map