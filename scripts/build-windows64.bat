@echo off
:: variables
set "CLEEPDESKTOPPATH=build\cleepdesktop_tree"

:: clear previous process files
rmdir /Q /S dist
rmdir /Q /S build

:: create dirs
mkdir %CLEEPDESKTOPPATH%
mkdir dist

:: pyinstaller
echo.
echo.
echo Packaging cleepdesktopcore...
echo ------------------------
pyinstaller --clean --noconfirm --noupx --windowed --debug --log-level INFO cleepdesktopcore-windows64.spec
move dist\cleepdesktopcore %CLEEPDESKTOPPATH%

:: copy files and dirs
echo.
echo.
echo Copying release files...
echo ------------------------
echo html...
mkdir %CLEEPDESKTOPPATH%\html
xcopy /S html %CLEEPDESKTOPPATH%\html
xcopy LICENCE.txt %CLEEPDESKTOPPATH%\
xcopy cleepdesktop.js %CLEEPDESKTOPPATH%\
xcopy package.json %CLEEPDESKTOPPATH%\
xcopy README.md %CLEEPDESKTOPPATH%\
mkdir %CLEEPDESKTOPPATH%\resources
xcopy /S resources %CLEEPDESKTOPPATH%\resources
echo Done

:: electron-builder
echo.
echo.
echo Packaging cleepdesktop...
echo -------------------------
:: electron-builder is launched in other command line because it stop this script at end of process
:: to debug electron-builder uncomment line below
:: set DEBUG=electron-builder,electron-builder:*
set "GH_TOKEN=%GH_TOKEN_CLEEPDESKTOP%"
cmd /C "node_modules\.bin\electron-builder --windows --x64 --projectDir %CLEEPDESKTOPPATH%" --publish always

:: cleaning
echo.
echo.
echo Finalizing...
echo -------------
ping 127.0.0.1 -n 2 > nul
mkdir dist
xcopy /Q /S %CLEEPDESKTOPPATH%\dist dist
rmdir /Q /S build
rmdir /Q /S __pycache__
rmdir /Q /S cleep\__pycache__
rmdir /Q /S cleep\libs\__pycache__
echo Done

