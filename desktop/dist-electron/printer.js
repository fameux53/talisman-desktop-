"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrintHandlers = registerPrintHandlers;
const electron_1 = require("electron");
function registerPrintHandlers() {
    // Get available printers
    electron_1.ipcMain.handle('print:get-printers', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return [];
        return win.webContents.getPrintersAsync();
    });
    // Print receipt
    electron_1.ipcMain.handle('print:receipt', async (_event, receiptHTML) => {
        const printWin = new electron_1.BrowserWindow({
            show: false,
            width: 300,
            height: 600,
            webPreferences: { contextIsolation: true, nodeIntegration: false },
        });
        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 72mm;
            margin: 0 auto;
            padding: 5mm;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .total { font-size: 16px; font-weight: bold; }
        </style>
      </head>
      <body>${receiptHTML}</body>
      </html>
    `)}`);
        return new Promise((resolve) => {
            printWin.webContents.print({
                silent: false,
                printBackground: true,
                margins: { marginType: 'none' },
            }, (success, failureReason) => {
                if (!success)
                    console.error('Print failed:', failureReason);
                printWin.close();
                resolve(success);
            });
        });
    });
    // Print report (full page)
    electron_1.ipcMain.handle('print:report', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return false;
        return new Promise((resolve) => {
            win.webContents.print({
                silent: false,
                printBackground: true,
                pageSize: 'Letter',
                margins: { marginType: 'default' },
            }, (success) => {
                resolve(success);
            });
        });
    });
}
//# sourceMappingURL=printer.js.map