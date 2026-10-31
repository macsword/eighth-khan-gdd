#!/usr/bin/env python3
"""Build the static GDD site: gdd_fa.md + template.html -> index.html (style.css, app.js, favicon.svg are hand-written).
Usage: python3 build.py [--date "۹ آبان ۱۴۰۵"]
"""
import re, sys, html, shutil, os, argparse, datetime
import markdown

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'gdd_fa.md')
OUT = ROOT  # site is built in place: index.html next to style.css/app.js (GitHub Pages serves repo root)
FA = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')
EN = str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')

def jalali_today():
    # Gregorian -> Jalali (standard algorithm)
    d = datetime.date.today(); gy, gm, gd = d.year, d.month, d.day
    g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + 365*gy + (gy2+3)//4 - (gy2+99)//100 + (gy2+399)//400 + gd + g_d_m[gm-1]
    jy = -1595 + 33*(days//12053); days %= 12053
    jy += 4*(days//1461); days %= 1461
    if days > 365: jy += (days-1)//365; days = (days-1) % 365
    jm = 1 + days//31 if days < 186 else 7 + (days-186)//30
    jd = 1 + (days % 31 if days < 186 else (days-186) % 30)
    months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند']
    return f'{jd} {months[jm-1]} {jy}'.translate(FA)

ap = argparse.ArgumentParser()
ap.add_argument('--date', help='last-updated date in Persian (default: today, Jalali)')
args = ap.parse_args()
updated = args.date or jalali_today()

src = open(SRC, encoding='utf-8').read().replace('\r\n', '\n')
lines = src.split('\n')

# ---- title & subtitle ----
title = 'خان هشتم — سند طراحی بازی'
if lines and lines[0].startswith('# '):
    title = lines[0][2:].strip(); lines = lines[1:]

# ---- normalise markdown for python-markdown ----
fixed = []; in_code = False
for i, l in enumerate(lines):
    if l.startswith('```'): in_code = not in_code
    if not in_code:
        if re.match(r'^  - ', l): l = '    ' + l[2:]          # nested bullets: 2 -> 4 spaces
        is_list = bool(re.match(r'^(\d+\. |- |\s+- )', l))
        prev = fixed[-1] if fixed else ''
        prev_list = bool(re.match(r'^(\d+\. |- |\s+- )', prev))
        if is_list and prev.strip() and not prev_list:   # list right after a paragraph
            fixed.append('')
        if l.startswith('|') and prev.strip() and not prev.startswith('|'):
            fixed.append('')
    fixed.append(l)
body_md = '\n'.join(fixed)

html_body = markdown.markdown(body_md, extensions=['tables', 'fenced_code', 'sane_lists'], output_format='html5')

# ---- headings: ids + collect TOC ----
toc = []; counters = {'h': 0}
def slug_for(level, text):
    plain = re.sub('<[^>]+>', '', text)
    m = re.match(r'^([۰-۹0-9]+)(?:[٫.]([۰-۹0-9]+))?[.\s]', plain)
    if level == 2 and m and not m.group(2):
        return 's' + m.group(1).translate(EN)
    counters['h'] += 1
    return f'h{counters["h"]}'
def head_sub(m):
    lvl, inner = int(m.group(1)), m.group(2)
    hid = slug_for(lvl, inner)
    toc.append((lvl, hid, re.sub('<[^>]+>', '', inner)))
    return (f'<h{lvl} id="{hid}">{inner}'
            f'<a class="anchor" href="#{hid}" aria-label="پیوند به این بخش">#</a></h{lvl}>')
html_body = re.sub(r'<h([23])>(.*?)</h\1>', head_sub, html_body)

# ---- in-document «فهرست»: link its items to the numbered sections ----
sec = [t for t in toc if t[0] == 2 and t[1].startswith('s')]
def link_toc(m):
    items = re.findall(r'<li>(.*?)</li>', m.group(2), re.S)
    out = []
    for n, it in enumerate(items):
        hid = sec[n][1] if n < len(sec) else ''
        out.append(f'<li><a href="#{hid}">{it}</a></li>' if hid else f'<li>{it}</li>')
    return m.group(1) + '<ol class="doc-toc">' + ''.join(out) + '</ol>'
html_body = re.sub(r'(<h2 id="h\d+">فهرست.*?</h2>\s*)<ol>(.*?)</ol>', link_toc, html_body, count=1, flags=re.S)

# ---- wrap tables, wide tables get a class ----
tcount = [0]
def wrap(m):
    t = m.group(0); tcount[0] += 1
    cols = len(re.findall(r'<th[ >]', t.split('</tr>')[0]))
    cls = 'tbl wide' if cols >= 5 else 'tbl'
    return f'<div class="table-wrap" tabindex="0" role="region" aria-label="جدول {str(tcount[0]).translate(FA)}"><table class="{cls}">' + t[len('<table>'):] + '</div>'
html_body = re.sub(r'<table>.*?</table>', wrap, html_body, flags=re.S)
html_body = re.sub(r'<th style="text-align: ?\w+;?">', '<th>', html_body)
html_body = re.sub(r'<td style="text-align: ?\w+;?">', '<td>', html_body)
html_body = html_body.replace('<pre><code>', '<pre dir="rtl"><code>')
html_body = html_body.replace('<blockquote>', '<blockquote class="quote">')

# ---- wrap content into <section>s per h2 ----
parts = re.split(r'(?=<h2 id=")', html_body)
html_body = ''.join(
    (f'<section class="sec" aria-labelledby="{re.match(r"<h2 id=\"([^\"]+)\"", p).group(1)}">{p}</section>' if p.startswith('<h2') else f'<div class="intro">{p}</div>')
    for p in parts if p.strip())

# ---- side TOC ----
nav = []; open_sub = False
for lvl, hid, text in toc:
    if lvl == 2:
        if open_sub: nav.append('</ul></details></li>'); open_sub = False
        nav.append(f'<li class="l2" data-id="{hid}"><a href="#{hid}">{html.escape(text)}</a>')
        subs = []
        idx = toc.index((lvl, hid, text))
        for l2, h2, t2 in toc[idx+1:]:
            if l2 == 2: break
            subs.append((h2, t2))
        if subs:
            nav.append('<details><summary aria-label="زیربخش‌ها"></summary><ul>')
            open_sub = True
        else:
            nav.append('</li>')
    else:
        nav.append(f'<li class="l3" data-id="{hid}"><a href="#{hid}">{html.escape(text)}</a></li>')
if open_sub: nav.append('</ul></details></li>')
nav_html = '<ul>' + ''.join(nav) + '</ul>'

n_sections = len(sec); n_tables = tcount[0]
tpl = open(os.path.join(ROOT, 'template.html'), encoding='utf-8').read()
page = (tpl.replace('{{TITLE}}', html.escape(title))
           .replace('{{NAV}}', nav_html)
           .replace('{{BODY}}', html_body)
           .replace('{{UPDATED}}', updated)
           .replace('{{NSEC}}', str(n_sections).translate(FA))
           .replace('{{NTAB}}', str(n_tables).translate(FA)))
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page)
open(os.path.join(OUT, '.nojekyll'), 'w').close()
print(f'built {OUT}/index.html: {n_sections} numbered sections, {n_tables} tables, updated={updated}')
