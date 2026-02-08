const {app, BrowserWindow, shell, screen} = require("electron");
const path = require("path");
const fs = require("fs");
const contextMenu = require("electron-context-menu").default;

const LABELS = {
    en: {
        cut: "Cut",
        copy: "Copy",
        paste: "Paste",
        selectAll: "Select All",
        save: "Save",
        saveImageAs: "Save Image As…",
        saveVideoAs: "Save Video As…",
        copyLink: "Copy Link",
        copyImage: "Copy Image",
        copyImageAddress: "Copy Image Address",
        copyVideoAddress: "Copy Video Address",
        inspect: "Inspect Element",
        searchWithGoogle: "Search with Google",
        lookUpSelection: "Look Up Selection",
        openImage: "Open image in browser",
        openVideo: "Open video in browser",
        openLink: "Open link in browser"
    },
    pl: {
        cut: "Wytnij",
        copy: "Kopiuj",
        paste: "Wklej",
        selectAll: "Zaznacz wszystko",
        save: "Zapisz",
        saveImageAs: "Zapisz obraz jako…",
        saveVideoAs: "Zapisz wideo jako…",
        copyLink: "Kopiuj adres linku",
        copyImage: "Kopiuj obraz",
        copyImageAddress: "Kopiuj adres obrazu",
        copyVideoAddress: "Kopiuj adres wideo",
        inspect: "Zbadaj element",
        searchWithGoogle: "Szukaj w Google",
        lookUpSelection: "Sprawdź zaznaczenie",
        openImage: "Otwórz obraz w przeglądarce",
        openVideo: "Otwórz wideo w przeglądarce",
        openLink: "Otwórz link w przeglądarce"
    }
};

let mainWindow;

const STATE_FILE = path.join(app.getPath("userData"), "state.json");
const DEFAULT_STATE = {
    width: 1100,
    height: 800,
    zoomFactor: 1
};

function loadState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    } catch {
        return DEFAULT_STATE;
    }
}

function saveWindowState(window) {
    if (window && window.isMaximized()) {
        const previous = loadState();
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify({
                ...previous,
                zoomFactor: window.webContents.getZoomFactor(),
                ...window.getNormalBounds()
            })
        );
    }
}

function normalizeBounds(bounds) {
    const display = screen.getDisplayMatching(bounds);
    const area = display.workArea;
    const width = Math.min(bounds.width, area.width);
    const height = Math.min(bounds.height, area.height);
    const x = Math.max(
        area.x,
        Math.min(bounds.x ?? area.x, area.x + area.width - width)
    );
    const y = Math.max(
        area.y,
        Math.min(bounds.y ?? area.y, area.y + area.height - height)
    );

    return {x, y, width, height};
}

function getAppLocale() {
    return (
        app.getLocale?.() ||
        app.getSystemLocale?.() ||
        process.env.LANG ||
        "en"
    )
        .toLowerCase()
        .replace("_", "-")
        .split("-")[0];
}

function registerContextMenu() {
    const locale = getAppLocale();
    const translations = LABELS[locale] || LABELS.en;

    contextMenu({
        labels: {
            cut: translations.cut,
            copy: translations.copy,
            paste: translations.paste,
            selectAll: translations.selectAll,
            save: translations.save,
            saveImageAs: translations.saveImageAs,
            saveVideoAs: translations.saveVideoAs,
            copyLink: translations.copyLink,
            copyImage: translations.copyImage,
            copyImageAddress: translations.copyImageAddress,
            copyVideoAddress: translations.copyVideoAddress,
            inspect: translations.inspect,
            searchWithGoogle: translations.searchWithGoogle,
            lookUpSelection: translations.lookUpSelection
        },
        prepend: (defaultActions, params) => {
            const items = [];

            if (params.linkURL) {
                items.push({
                    label: translations.openLink,
                    click: () => shell.openExternal(params.linkURL)
                });
            }

            if (params.mediaType === "image" && params.srcURL) {
                items.push({
                    label: translations.openImage,
                    click: () => shell.openExternal(params.srcURL)
                });
            }

            if (params.mediaType === "video" && params.srcURL) {
                items.push({
                    label: translations.openVideo,
                    click: () => shell.openExternal(params.srcURL)
                });
            }

            return items;
        },
        showSaveImageAs: true,
        showCopyImage: true,
        showInspectElement: true,
        showCopyVideoAddress: true,
        showSaveVideo: true,
        showSaveVideoAs: true,
        showSaveLinkAs: true,
        showLookUpSelection: true,
        showSearchWithGoogle: true
    });
}

function registerWindowEvents(window) {
    const persist = () => saveWindowState(window);
    window.on("resize", persist);
    window.on("move", persist);
    window.on("close", persist);
    window.webContents.on('zoom-changed', (event, zoomDirection) => {
        const current = window.webContents.getZoomFactor();
        const next = zoomDirection === 'in' ? current + 0.1 : current - 0.1;
        window.webContents.setZoomFactor(next);
        event.preventDefault();
        persist();
    });
}

function registerNavigationGuards(window) {
    window.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: "deny"};
    });

    window.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith("https://www.messenger.com")) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
}

function createMainWindow() {
    const state = loadState();
    const bounds = normalizeBounds({
        x: state.x,
        y: state.y,
        width: state.width || DEFAULT_STATE.width,
        height: state.height || DEFAULT_STATE.height
    });
    mainWindow = new BrowserWindow({
        show: false,
        useContentSize: false,
        width: DEFAULT_STATE.width,
        height: DEFAULT_STATE.height,
        icon: path.join(__dirname, "icon.ico"),
        title: "Messenger",
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            zoomFactor: state.zoomFactor ?? DEFAULT_STATE.zoomFactor
        }
    });
    mainWindow.setBounds(bounds, false);
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        registerContextMenu();
    });
    mainWindow.webContents.once("did-finish-load", () => {
        const zoom = state.zoomFactor ?? DEFAULT_STATE.zoomFactor;
        mainWindow.webContents.setZoomFactor(zoom);
    });
    mainWindow.loadURL("https://www.messenger.com").catch(() => {
    });

    registerWindowEvents(mainWindow);
    registerNavigationGuards(mainWindow);
}

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});