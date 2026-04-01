"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHORTCUTS = void 0;
exports.registerShortcuts = registerShortcuts;
const electron_1 = require("electron");
function registerShortcuts(mainWindow) {
    // Global shortcut to show/focus the app (works even when app is unfocused)
    electron_1.globalShortcut.register('CmdOrCtrl+Shift+M', () => {
        if (mainWindow.isVisible()) {
            mainWindow.focus();
        }
        else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
// Summary of all keyboard shortcuts for reference
exports.SHORTCUTS = {
    new_sale: 'Ctrl+N / Cmd+N',
    dashboard: 'Ctrl+1 / Cmd+1',
    inventory: 'Ctrl+2 / Cmd+2',
    credit: 'Ctrl+3 / Cmd+3',
    reports: 'Ctrl+4 / Cmd+4',
    history: 'Ctrl+H / Cmd+H',
    export_pdf: 'Ctrl+E / Cmd+E',
    export_csv: 'Ctrl+Shift+E / Cmd+Shift+E',
    print: 'Ctrl+P / Cmd+P',
    settings: 'Ctrl+, / Cmd+,',
    quit: 'Ctrl+Q / Cmd+Q',
    show_app: 'Ctrl+Shift+M / Cmd+Shift+M (global)',
    zoom_in: 'Ctrl++ / Cmd++',
    zoom_out: 'Ctrl+- / Cmd+-',
    fullscreen: 'F11 / Ctrl+Cmd+F',
};
//# sourceMappingURL=shortcuts.js.map