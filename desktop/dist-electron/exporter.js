"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExportHandlers = registerExportHandlers;
const electron_1 = require("electron");
const fs_1 = require("fs");
const database_1 = require("./database");
function registerExportHandlers() {
    // Export report as PDF
    electron_1.ipcMain.handle('export:save-pdf', async (_event, _data, defaultName) => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return null;
        const { filePath } = await electron_1.dialog.showSaveDialog(win, {
            defaultPath: defaultName || 'marketmama-report.pdf',
            filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
        });
        if (!filePath)
            return null;
        const pdfBuffer = await win.webContents.printToPDF({
            printBackground: true,
            landscape: false,
            pageSize: 'Letter',
            margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
        });
        (0, fs_1.writeFileSync)(filePath, pdfBuffer);
        return filePath;
    });
    // Export data as CSV
    electron_1.ipcMain.handle('export:save-csv', async (_event, csvContent, defaultName) => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return null;
        const { filePath } = await electron_1.dialog.showSaveDialog(win, {
            defaultPath: defaultName || 'marketmama-data.csv',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        });
        if (!filePath)
            return null;
        (0, fs_1.writeFileSync)(filePath, csvContent, 'utf-8');
        return filePath;
    });
    // Backup database
    electron_1.ipcMain.handle('export:backup-db', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return null;
        const timestamp = new Date().toISOString().slice(0, 10);
        const { filePath } = await electron_1.dialog.showSaveDialog(win, {
            defaultPath: `marketmama-backup-${timestamp}.db`,
            filters: [{ name: 'Database Backup', extensions: ['db'] }],
        });
        if (!filePath)
            return null;
        (0, fs_1.copyFileSync)((0, database_1.getDatabasePath)(), filePath);
        return filePath;
    });
    // Restore database
    electron_1.ipcMain.handle('export:restore-db', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return null;
        const { filePaths } = await electron_1.dialog.showOpenDialog(win, {
            filters: [{ name: 'Database Backup', extensions: ['db'] }],
            properties: ['openFile'],
        });
        if (!filePaths || filePaths.length === 0)
            return null;
        (0, fs_1.copyFileSync)(filePaths[0], (0, database_1.getDatabasePath)());
        return filePaths[0];
    });
}
//# sourceMappingURL=exporter.js.map