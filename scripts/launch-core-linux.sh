#!/bin/bash

/usr/bin/pkill -9 -f cleepdesktopcore
python3 cleepdesktopcore.py 5610 ~/config/CleepDesktop/cache_cleepdesktop ~/.config/CleepDesktop Settings debug true
