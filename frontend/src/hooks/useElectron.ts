import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ElectronAPI {
  isElectron: boolean;
  onNavigate: (callback: (route: string) => void) => void;
  onAction: (callback: (action: string) => void) => void;
  onUpdateStatus: (callback: (status: { status: string; version: string }) => void) => void;
}

function getElectronAPI(): ElectronAPI | null {
  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
  return api?.isElectron ? api : null;
}

export function useElectronBridge() {
  const navigate = useNavigate();
  const api = getElectronAPI();
  const isElectron = !!api;

  useEffect(() => {
    if (!api) return;

    // Listen for navigation commands from menu/tray
    api.onNavigate((route: string) => {
      navigate(route);
    });

    // Listen for action commands from menu/tray
    api.onAction((action: string) => {
      switch (action) {
        case 'new-sale':
          document.dispatchEvent(new CustomEvent('open-sale-modal'));
          break;
        case 'export-pdf':
          document.dispatchEvent(new CustomEvent('export-pdf'));
          break;
        case 'export-csv':
          document.dispatchEvent(new CustomEvent('export-csv'));
          break;
        case 'print-receipt':
          document.dispatchEvent(new CustomEvent('print-receipt'));
          break;
        case 'backup-db':
          document.dispatchEvent(new CustomEvent('backup-db'));
          break;
      }
    });

    // Listen for update notifications
    api.onUpdateStatus((status) => {
      if (status.status === 'ready') {
        document.dispatchEvent(
          new CustomEvent('app-update-ready', { detail: status })
        );
      }
    });
  }, [api, navigate]);

  return { isElectron };
}
