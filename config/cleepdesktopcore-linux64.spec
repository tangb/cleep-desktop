# -*- mode: python -*-

from PyInstaller.utils.hooks import collect_submodules

block_cipher = None
sentry_sdk_submodules = collect_submodules('sentry_sdk')

a = Analysis(['cleepdesktopcore.py'],
             pathex=[],
             binaries=[],
             datas=[
                ('core', 'core'),
                ('tools/flash.linux.sh', 'tools/'),
                ('tools/install-etcher.linux.sh', 'tools/'),
                ('tools/cmdlogger-linux64', 'tools/cmdlogger-linux')
             ],
             hiddenimports=sentry_sdk_submodules,
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          exclude_binaries=True,
          name='cleepdesktopcore',
          debug=False,
          strip=False,
          upx=False,
          console=True )
coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=False,
               name='cleepdesktopcore')
