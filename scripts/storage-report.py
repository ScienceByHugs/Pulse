#!/usr/bin/env python3
"""Read-only local development storage report; never deletes files."""
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
free = shutil.disk_usage(root).free / (1024 ** 3)
print(f'Available disk space: {free:.1f} GiB')
if free < 30:
    print('Below the 30 GiB working target: review storage before a native build.')
for path in [root / 'node_modules', root / 'local-builds', root / 'output',
             Path('/Applications/Xcode.app'),
             Path.home() / 'Library/Developer/Xcode/DerivedData',
             Path.home() / 'Library/Developer/CoreSimulator',
             Path.home() / '.npm', Path.home() / 'Library/Caches/Homebrew']:
    if path.exists():
        result = subprocess.run(['du', '-sh', str(path)], capture_output=True, text=True)
        print(result.stdout.strip() or f'Unable to measure: {path}')
