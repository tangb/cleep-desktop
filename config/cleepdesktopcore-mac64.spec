# -*- mode: python -*-

block_cipher = None

a = Analysis(['cleepdesktopcore.py'],
             pathex=[],
             binaries=[],
             datas=[
                ('core', 'core'),
                ('tools/flash.mac.sh', 'tools/'),
                ('tools/install-etcher.mac.sh', 'tools/'),
                ('tools/cmdlogger-mac64', 'tools/cmdlogger-mac')
             ],
             hiddenimports=[],
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
