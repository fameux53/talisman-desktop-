import { ipcMain, BrowserWindow } from 'electron';

export function registerPrintHandlers(): void {
  // Get available printers
  ipcMain.handle('print:get-printers', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return [];
    return win.webContents.getPrintersAsync();
  });

  // Print receipt
  ipcMain.handle('print:receipt', async (_event, receiptHTML: string) => {
    const printWin = new BrowserWindow({
      show: false,
      width: 300,
      height: 600,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });

    await printWin.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
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
    `)}`
    );

    return new Promise<boolean>((resolve) => {
      printWin.webContents.print(
        {
          silent: false,
          printBackground: true,
          margins: { marginType: 'none' },
        },
        (success, failureReason) => {
          if (!success) console.error('Print failed:', failureReason);
          printWin.close();
          resolve(success);
        }
      );
    });
  });

  // Print report (full page)
  ipcMain.handle('print:report', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;

    return new Promise<boolean>((resolve) => {
      win.webContents.print(
        {
          silent: false,
          printBackground: true,
          pageSize: 'Letter',
          margins: { marginType: 'default' },
        },
        (success) => {
          resolve(success);
        }
      );
    });
  });
}
