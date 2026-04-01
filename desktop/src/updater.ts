import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

export function setupAutoUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);

  // Check immediately on startup
  autoUpdater.checkForUpdates().catch(() => {});

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('update-status', {
        status: 'available',
        version: info.version,
      });
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('update-status', {
        status: 'ready',
        version: info.version,
      });
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-update error:', err);
  });
}
