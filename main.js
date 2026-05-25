const { app, BrowserWindow } = require('electron');
const path = require('path');
// Disable hardware acceleration to anpm startvoid GPU disk cache usage on restricted Windows accounts
try {
  app.disableHardwareAcceleration();
} catch (e) {
  console.warn('Could not disable hardware acceleration', e);
}

const fs = require('fs');

// Prefer a local writable userData path to avoid system AppData permission issues
try {
  const defaultUserData = app.getPath('userData');
  let localUserData = path.join(__dirname, 'user-data');
  try {
    if (!fs.existsSync(localUserData)) fs.mkdirSync(localUserData, { recursive: true });
    app.setPath('userData', localUserData);
  } catch (pathErr) {
    console.warn('Could not use local user-data path, falling back to default:', pathErr.message);
    localUserData = defaultUserData;
    app.setPath('userData', localUserData);
  }

  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('disable-accelerated-video-decode');
  app.commandLine.appendSwitch('disable-accelerated-video-encode');

  console.log('Using userData path:', localUserData);
} catch (e) {
  console.error('Failed to set or create userData path early', e);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Police Wireless Leave System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: false,
      nativeWindowOpen: true
    }
  });

  win.loadFile('index.html');
  // DevTools opening removed for production-ready packaging
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
