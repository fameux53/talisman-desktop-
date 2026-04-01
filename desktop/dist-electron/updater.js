"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAutoUpdater = setupAutoUpdater;
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
function setupAutoUpdater() {
    electron_updater_1.autoUpdater.logger = electron_log_1.default;
    electron_updater_1.autoUpdater.autoDownload = true;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
    // Check for updates every 4 hours
    setInterval(() => {
        electron_updater_1.autoUpdater.checkForUpdates().catch(() => { });
    }, 4 * 60 * 60 * 1000);
    // Check immediately on startup
    electron_updater_1.autoUpdater.checkForUpdates().catch(() => { });
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        electron_log_1.default.info('Update available:', info.version);
        electron_1.BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('update-status', {
                status: 'available',
                version: info.version,
            });
        });
    });
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        electron_log_1.default.info('Update downloaded:', info.version);
        electron_1.BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('update-status', {
                status: 'ready',
                version: info.version,
            });
        });
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        electron_log_1.default.error('Auto-update error:', err);
    });
}
//# sourceMappingURL=updater.js.map