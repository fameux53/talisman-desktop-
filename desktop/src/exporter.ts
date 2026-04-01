import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFileSync, copyFileSync } from 'fs';
import { getDatabasePath } from './database';

export function registerExportHandlers(): void {
  // Export report as PDF
  ipcMain.handle('export:save-pdf', async (_event, _data, defaultName) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName || 'talisman-report.pdf',
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });

    if (!filePath) return null;

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'Letter',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });

    writeFileSync(filePath, pdfBuffer);
    return filePath;
  });

  // Export data as CSV
  ipcMain.handle('export:save-csv', async (_event, csvContent, defaultName) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName || 'talisman-data.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (!filePath) return null;
    writeFileSync(filePath, csvContent, 'utf-8');
    return filePath;
  });

  // Backup database
  ipcMain.handle('export:backup-db', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const timestamp = new Date().toISOString().slice(0, 10);
    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: `talisman-backup-${timestamp}.db`,
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
    });

    if (!filePath) return null;
    copyFileSync(getDatabasePath(), filePath);
    return filePath;
  });

  // Restore database
  ipcMain.handle('export:restore-db', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const { filePaths } = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
      properties: ['openFile'],
    });

    if (!filePaths || filePaths.length === 0) return null;
    copyFileSync(filePaths[0], getDatabasePath());
    return filePaths[0];
  });
}
