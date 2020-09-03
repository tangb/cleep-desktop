const fs = require('fs');
const os = require('os');
const { logger } = require('./log');
const { settings } = require('./config');
const { isDev, parseArgs, getChangelog } = require('./utils');
const { autoUpdater } = require('electron-updater');
const { CleepDesktopUpdater } = require('./updater');
const { context } = require('./context');
const electron = require('electron');
const { ipcMain } = electron;
const { dialog } = electron;
const { init: initSentry } = require('@sentry/electron');
const Menu = require('electron').Menu;
const shell = require('electron').shell;
const url = require('url');
const detectPort = require('detect-port');
const { download } = require('electron-dl');

// init application
const app = electron.app;
app.name = 'CleepDesktop';

// crash report


// init libs
const updater = new CleepDesktopUpdater(ipcMain, autoUpdater, logger);
context.version = app.getVersion();
initSentry({
    dsn: 'https://8e703f88899c42c18b8466c44b612472:3dfcd33abfda47c99768d43ce668d258@sentry.io/213385'
});

//create default variables

const BrowserWindow = electron.BrowserWindow;

// variables
var path = require('path');
var corePath = path.join(__dirname, 'cleepdesktopcore.py');

logger.info('Check if ' + corePath + ' exists: ' + isDev());
let coreProcess = null;
let coreDisabled = false;
let allowQuit = true;
let closingApplication = false;
let coreStartupTime = 0;
let downloadItem = null;
let downloadFilename = '';

// logger configuration

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let splashScreen

// Create application menu
function createMenu() {
    const subMenuFile = {
        label: 'File',
        submenu: [
            {
                label: 'Updates',
                click: () => {
                    mainWindow.webContents.send('openpage', 'updates');
                }
            }, {
                label: 'Preferences',
                click: () => {
                    mainWindow.webContents.send('openmodal', 'preferencesController', 'js/preferences/preferences-dialog.html');
                }
            }, {
                type: 'separator'
            }, {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                    app.quit();
                }
            }
        ]
    };

    const subMenuEdit = {
        label: 'Edit',
        submenu: [
            {
                label: "Cut",
                accelerator: "CmdOrCtrl+X",
                selector: "cut:"
            },
            {
                label: "Copy",
                accelerator: "CmdOrCtrl+C",
                selector: "copy:"
            },
            {
                label: "Paste",
                accelerator: "CmdOrCtrl+V",
                selector: "paste:"
            },
            {
                label: "Select All",
                accelerator: "CmdOrCtrl+A",
                selector: "selectAll:"
            }
        ]
    };

    const subMenuDevice = {
        label: 'Device',
        submenu: [
            {
                label: 'Install',
                click: () => {
                    mainWindow.webContents.send('openpage', 'installAuto');
                }
            }, {
                type: 'separator'
            }, {
                label: 'Monitoring',
                click: () => {
                    mainWindow.webContents.send('openpage', 'monitoring');
                }
            }
        ]
    };

    const subMenuHelp = {
        label: 'Help',
        submenu: [
            {
                label: 'Application help',
                click: () => {
                    mainWindow.webContents.send('openpage', 'help');
                }
            }, {
                type: 'separator'
            }, {
                label: 'Get support',
                click: () => {
                    mainWindow.webContents.send('openpage', 'support');
                }
            }, {
                type: 'separator'
            }, {
                label: 'About',
                click: () => {
                    mainWindow.webContents.send('openpage', 'about');
                }
            }
        ]
    };

    if( process.platform==='darwin' ) {
        const menuTemplate = [subMenuFile, subMenuEdit, subMenuHelp];
        const menu = Menu.buildFromTemplate(menuTemplate);
        Menu.setApplicationMenu(menu);
    } else {
        const menuTemplate = [subMenuFile, subMenuHelp];
        const menu = Menu.buildFromTemplate(menuTemplate);
        Menu.setApplicationMenu(menu);
    }
};

// Create splash screen
// Code from https://github.com/buz-zard/random/blob/master/electron-compile-1/src/main.js
function createSplashScreen() {
    // create splashscreen window
    splashScreen = new BrowserWindow({
        width: 250,
        height: 350,
        show: false,
        frame: false,
        parent: mainWindow,
        resizable: false,
        icon:__dirname+'/resources/256x256.png',
        webPreferences: {
            webSecurity: false
        }
    });

    // load splashscreen content
    splashScreen.loadURL(url.format({
        pathname: path.join(__dirname, 'html/loading.html'),
        protocol: 'file:',
        slashes: true
    }), {"extraHeaders" : "pragma: no-cache\n"})

    // handle splashscreen events
    splashScreen.on('closed', () => splashScreen = null);
    splashScreen.webContents.on('did-finish-load', () => {
        splashScreen.show();
    });
};

// create application main window
function createWindow () {
    // create the browser window.
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            webviewTag: true
        },
        width:1024,
        height:600,
        minHeight: 640,
        minWidth: 375,
        show: false,
        icon:__dirname+'/resources/256x256.png',
        title:'CleepDesktop'
    });

    // handle external url
    mainWindow.webContents.on('new-window', function(e, url) {
        e.preventDefault()
        shell.openExternal(url)
    });

    // close splashscreen when loaded
    mainWindow.once('ready-to-show', function(e) {
        if( splashScreen ) {
            setTimeout( function() {
                if (splashScreen) {
                    splashScreen.close();
                }
            }, 1500 );
        }

        setTimeout( function() {
            if(!mainWindow) {
                return;
            }
            mainWindow.maximize();
            mainWindow.show();
            mainWindow.focus();
        }, 1250 );
    });

    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'html/index.html'),
        protocol: 'file:',
        slashes: true
    }), {
        'extraHeaders': 'pragma: no-cache\n'
    });

    // open the DevTools in dev mode only
    if( isDev() || process.env.CLEEPDESKTOP_DEBUG ) {
        //open devtool in dev mode
        mainWindow.webContents.openDevTools();

        //log electron and chrome versions
        logger.debug('Electron version: ' + process.versions.electron);
        logger.debug('Chrome version: ' + process.versions.chrome);
    }

    // give a chance to user to not stop current running action
    mainWindow.on('close', function(e) {
        //set closing flag (to avoid catching core process error)
        closingApplication = true;

        if( !allowQuit ) {
            //something does not allow application to quit. Request user to quit or not
            var btnIndex = dialog.showMessageBoxSync(mainWindow, {
                type: 'question',
                buttons: ['Confirm quit', 'Cancel'],
                defaultId: 1,
                title: 'Quit application ?',
                message: 'A process is running. Quit application now can let inconsistent data. Quit anyway?'
            });

            if( btnIndex!=0 ) {
                //user do not quit
                logger.debug('User cancels application closing');
                e.preventDefault();
            }
        }
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

};

// Launch core python application
function launchCore(rpcport) {
    if( coreDisabled ) {
        logger.debug('Core disabled');
        return;
    }

    // get config file path
    var configFile = settings.getFilePath();
    logger.debug('Config file:', configFile);
    var cachePath = path.join(app.getPath('userData'), 'cache_cleepdesktop');
    logger.debug('Cache path:', cachePath);
    var configPath = path.dirname(configFile);
    logger.debug('Config path:', configPath);
    var configFilename = path.basename(configFile);
    logger.debug('Config filename:', configFilename);
    var startupError = '';

    //check whether cache dir exists or not
    if( !fs.existsSync(cachePath) ) {
        logger.debug('Create cache dir' + cachePath);
        fs.mkdirSync(cachePath);
    }

    if( !isDev() ) {
        //launch release mode
        logger.debug('Launch release mode');

        //prepare command line
        let commandline = path.join(__dirname + '.unpacked/', 'cleepdesktopcore/');
        logger.debug('cmdline with asar: ' + commandline);
        if( !fs.existsSync(commandline) ) {
            commandline = path.join(__dirname, 'cleepdesktopcore/');
            logger.info('cmdline without asar: ' + commandline);
        }

        //append bin name
        if( process.platform=='win32' ) {
            commandline = path.join(commandline, 'cleepdesktopcore.exe');
        } else {
            commandline = path.join(commandline, 'cleepdesktopcore');
        }

        //launch command line
        let debug = settings.has('cleep.debug') && settings.get('cleep.debug') ? 'debug' : 'release';
        logger.debug('Core commandline: '+commandline+' ' + rpcport + ' ' + cachePath + ' ' + configPath + ' ' + configFilename + ' ' + debug);
        coreStartupTime = Math.round(Date.now()/1000);
        coreProcess = require('child_process').spawn(commandline, [rpcport, cachePath, configPath, configFilename, 'release', 'false']);

    } else {
        //launch dev
        logger.debug('Launch development mode');
        logger.debug('Core commandline: python3 cleepdesktopcore.py ' + rpcport + ' ' + cachePath + ' ' + configPath + ' ' + configFilename + ' debug');
		var python_bin = 'python3'
        var python_args = ['cleepdesktopcore.py', rpcport, cachePath, configPath, configFilename, 'debug', 'true']
		if( process.platform=='win32' )
		{
			python_bin = 'py';
			python_args.unshift('-3');
        }
        coreStartupTime = Math.round(Date.now()/1000);
        coreProcess = require('child_process').spawn(python_bin, python_args);
    }

    //handle core stdout
    coreProcess.stdout.on('data', (data) => {
        if( isDev() ) {
            //only log message in developer mode
            var message = data.toString('utf8');
            logger.debug(message);
        }
    });

    //handle core stderr
    coreProcess.stderr.on('data', (data) => {
        //do not send user warnings
        var message = data.toString('utf8');
        if( message.search('UserWarning:')!=-1 ) {
            logger.debug('Drop UserWarning message');
            return;
        }

        //handle ASCII error
        if( message.search('hostname seems to have unsupported characters')!=-1 ) {
            startupError = 'Your computer hostname "'+os.hostname()+'" contains invalid characters. Please update it using only ASCII chars.'
        }

        //only handle startup crash (5 first seconds), after core will handle it
        var now = Math.round(Date.now()/1000);
        if( now<=coreStartupTime+5 ) {
            logger.error(message);
            throw new Error(message);
        }
    });

    //handle end of process
    coreProcess.on('close', (code) => {
        if( !closingApplication ) {
            logger.error('Core process exited with code "' + code + '"');
            if( code!==0 ) {
                //error occured, display error to user before terminates application
                dialog.showErrorBox('Fatal error', 'Unable to properly start application.\n' +startupError+'\nCleepDesktop will stop now.');

                //stop application
                app.quit();
            }
        }
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    logger.info('===== CleepDesktop started =====');
    logger.info('Platform: ' + process.platform);
    var display = electron.screen.getPrimaryDisplay();
    logger.info('Display: ' + display.size.width + 'x' + display.size.height);
    logger.info('Version: ' + app.getVersion());

    // spashscreen asap
    createSplashScreen();

    // parse command line arguments
    appParams = parseArgs(process.argv.slice(1));
    logger.debug('Application parameters:', appParams);
    coreDisabled = appParams.coreDisabled;
    logger.setTransportsLevel(
        appParams.loggerTransportsFileLevel,
        appParams.loggerTransportsConsoleLevel
    );

    // fill configuration file
    settings.checkConfig(app.getVersion());

    // fill changelog
    // TODO getChangelog();

    if( isDev() ) {
        // use static rpc port in development mode (default one)
        
        // save rpcport to config to be used in js app
        settings.set('remote.rpcport', settings.DEFAULT_RPCPORT);

        //launch application
        createWindow();
        createMenu();
        // launchCore(settings.DEFAULT_RPCPORT);
    } else {
        console.log('===> is NOT dev')
        //detect available port
        detectPort(null, (err, rpcport) => {
            if( err )
            {
                logger.error('Error detecting available port:', err);
            }

            //save rpcport to config to be used in js app
            settings.set('remote.rpcport', rpcport);

            //launch application
            createWindow();
            createMenu();
            launchCore(rpcport);
        });
    }
});

// Handle event to allow to quit application (or not)
ipcMain.on('allow-quit', (event, arg) => {
    logger.debug('allow-quit=' + arg);
    allowQuit = arg;
});

// Handle event to save changelog
ipcMain.on('save-changelog', (event, arg) => {
    logger.debug('Saving changelog...');
    var changelogPath = path.join(app.getPath('userData'), 'changelog.txt');
    fs.writeFile(changelogPath, arg, (err) => {
        if( err )
        {
            //error occured during changelog saving
            logger.error('Unable to save changelog: ' + err);
        }
    });
});

// Handle file download
ipcMain.on('download-file-cancel', (event, args) => {
    if( downloadItem!==null ) {
        //cancel running download
        downloadItem.cancel();
    }
});
ipcMain.on('download-file', (event, args) => {
    if( downloadItem!==null ) {
        //download already running, do not launch this one
        mainWindow.webContents.send('download-file-status', {
            status: 'alreadyrunning',
            percent: 0
        });
        return;
    }
    //make sure downloadItem is different from null asap
    downloadItem = undefined;

    //launch download
    download(BrowserWindow.getFocusedWindow(), args.url, {
        saveAs: true,
        onStarted: function(item) {
            downloadItem = item;
            downloadFilename = item.getFilename();
        },
        onProgress: function(percent) {
            if( typeof percent == 'number' ) {
                mainWindow.webContents.send('download-file-status', {
                    filename: downloadFilename,
                    status: 'downloading',
                    percent: Math.round(percent*100)
                });
            }
        },
        onCancel: function(item) {
            mainWindow.webContents.send('download-file-status', {
                filename: downloadFilename,
                status: 'canceled',
                percent: 0
            });
            downloadItem = null;
            downloadFilename = '';
        }
    })
        .then(function() {
            mainWindow.webContents.send('download-file-status', {
                filename: downloadFilename,
                status: 'success',
                percent: 100
            });
            downloadItem = null;
            downloadFilename = '';
        })
        .catch(function() {
            mainWindow.webContents.send('download-file-status', {
                filename: downloadFilename,
                status: 'failed',
                percent: 100
            });
            downloadItem = null;
            downloadFilename = '';
        });
});

// Application will quit, kill python process
app.on('will-quit', function(e) {
    if( coreProcess )
    {
        logger.debug('Kill core');
        coreProcess.kill('SIGTERM');
    }
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if( process.platform!=='darwin' ) {
        app.quit()
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
});
