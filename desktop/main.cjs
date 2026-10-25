const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// the desktop app is a window around the website, in "remote" mode (see frontend/src/desktop.ts)
const APP_URL = process.env.APP_URL
  || (app.isPackaged ? 'https://dukz8h8o1lsds.cloudfront.net' : 'http://127.0.0.1:5173');
const appOrigin = new URL(APP_URL).origin;

function createWindow() {
  // a little extra room around the iPod so its shadow isn't cut off
  const win = new BrowserWindow({
    width: 360,
    height: 560,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadURL(APP_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Spotify login gets a normal window, everything else opens in the browser
    if (new URL(url).pathname === '/auth/login') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 480,
          height: 760,
          frame: true,
          transparent: false,
          alwaysOnTop: true,
          backgroundColor: '#ffffff',
          webPreferences: { contextIsolation: true, sandbox: true },
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // once login lands back on the app, the token is saved (localStorage), so close that window
  win.webContents.on('did-create-window', (child) => {
    child.webContents.on('did-finish-load', () => {
      if (new URL(child.webContents.getURL()).origin === appOrigin) child.close();
    });
  });
}

ipcMain.on('desktop:close', () => app.quit());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
