# Builds the two editions of Last Wish from one source:
#   out/LastWish_laptop/Last Wish.html
#   out/LastWish_bigscreen/Last Wish - Big Screen.html
import subprocess, shutil, os, sys
V2 = '/home/claude/v2'
ESB = '/opt/npm-tools/node_modules/.bin/esbuild'
r = subprocess.run([ESB, f'{V2}/src/game.js', '--bundle', '--format=iife', '--target=es2020',
                    '--legal-comments=none', f'--outfile=/tmp/lastwish_bundle.js', '--log-level=warning'], capture_output=True, text=True)
if r.returncode: print(r.stdout, r.stderr); sys.exit(1)
bundle = open('/tmp/lastwish_bundle.js').read()
assert 'var SETTINGS = {' in bundle
bundle = bundle.replace('var SETTINGS = {', '// =================== GAME SETTINGS ===================\n'
    '// Change numbers here (timers, star times, costume prices, duel damage...), save, reopen the game.\n'
    '// =====================================================\nvar SETTINGS = {', 1)
assert '</script' not in bundle.lower(), 'bundle contains </script'
page = open(f'{V2}/src/index.html').read()
assert '<!--GAME-->' in page
editions = {
  'laptop':    ('LastWish_laptop', 'Last Wish.html', ''),
  'bigscreen': ('LastWish_bigscreen', 'Last Wish - Big Screen.html', "<script>window.LASTWISH_EDITION='bigscreen';</script>\n"),
}
only = sys.argv[1:] or list(editions)
for ed in only:
    folder, fname, pre = editions[ed]
    out = f'{V2}/out/{folder}'
    os.makedirs(out, exist_ok=True)
    for sub in ['models', 'images', 'videos']:
        dst = f'{out}/{sub}'
        if os.path.exists(dst): shutil.rmtree(dst)
    shutil.copytree(f'{V2}/models', f'{out}/models')
    shutil.copytree(f'{V2}/images', f'{out}/images')
    shutil.copytree('/home/claude/game/videos', f'{out}/videos', ignore=shutil.ignore_patterns('*.txt'))
    if ed == 'bigscreen':  # the big screen gets the 32:9 (7680x2160) versions of the story videos
        for v in ('intro', 'ending', 'ending_bad'): shutil.copy(f'/home/claude/vproj/out/{v}.mp4', f'{out}/videos/{v}.mp4')
    html = page.replace('<!--GAME-->', pre + '<script>\n' + bundle + '\n</script>')
    if ed == 'bigscreen': html = html.replace('<title>Last Wish</title>', '<title>Last Wish — Big Screen</title>')
    open(f'{out}/{fname}', 'w').write(html)
    print(ed, '->', f'{out}/{fname}', len(html)//1024, 'KB')
