#!/bin/bash

#env
CURRENTPATH=`pwd`
CLEEPDESKTOPPATH=build/cleepdesktop_tree

#clear previous process
/bin/rm -rf dist/
/bin/rm -rf build/

#create dirs
/bin/mkdir -p "$CLEEPDESKTOPPATH"
/bin/mkdir dist

# check tools
echo
echo
echo "Installing tools..."
echo "-------------------"
echo
echo " -> python 3"
sudo apt-get update
sudo apt-get install python3 python3-distutils python3-dev gcc g++ make
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3 get-pip.py
echo
echo " -> tools versions:"
python3 --version
pip3 --version
echo "Node" `node --version`
echo "Npm" `npm --version`

#update python libs
echo
echo
echo "Installing python libs..."
echo "-------------------------"
pip3 install -r requirements.txt

#pyinstaller
echo
echo
echo "Packaging cleepdesktopcore..."
echo "-----------------------------"
/bin/cp config/cleepdesktopcore-linux64.spec cleepdesktopcore-linux64.spec
pyinstaller --clean --noconfirm --noupx --debug all --log-level INFO cleepdesktopcore-linux64.spec
/bin/rm cleepdesktopcore-linux64.spec
/bin/mv dist/cleepdesktopcore "$CLEEPDESKTOPPATH"

#copy files and dirs
echo
echo
echo "Copying release files..."
echo "------------------------"
/bin/cp -a html "$CLEEPDESKTOPPATH"
/bin/cp -a LICENSE.txt "$CLEEPDESKTOPPATH"
/bin/cp -a cleepdesktop.js "$CLEEPDESKTOPPATH"
/bin/cp -a package.json "$CLEEPDESKTOPPATH"
/bin/cp -a README.md "$CLEEPDESKTOPPATH"
/bin/cp -a resources "$CLEEPDESKTOPPATH"
echo "Done"

#update npm
echo
echo
echo "Installing node libs..."
echo "-----------------------"
/usr/bin/npm install
echo "Done"

#electron-builder
echo
echo
if [ "$1" == "publish" ]
then
    echo "Publishing cleepdesktop..."
    echo "--------------------------"
    GH_TOKEN=$GH_TOKEN_CLEEPDESKTOP node_modules/.bin/electron-builder --linux --x64 --projectDir "$CLEEPDESKTOPPATH" --publish always
else
    echo "Packaging cleepdesktop..."
    echo "-------------------------"
    node_modules/.bin/electron-builder --linux --x64 --projectDir "$CLEEPDESKTOPPATH"
fi

#cleaning
echo
echo
echo "Finalizing..."
echo "-------------"
/bin/sleep 1
/bin/mv "./$CLEEPDESKTOPPATH/dist" .
if [ "$1" == "publish" ]
then
    /bin/rm -rf build
    /bin/rm -rf __pycache__
    /bin/rm -rf cleep/__pycache__
    /bin/rm -rf cleep/libs/__pycache__
fi
echo "Done"

echo
echo "Build result in dist/ folder"
