import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = join(__dirname, '../resources/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Talisman');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Talisman',
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
      label: 'Quit Talisman',
      click: () => {
        mainWindow.removeAllListeners('close');
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Click tray icon to show/hide window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
