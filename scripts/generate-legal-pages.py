#!/usr/bin/env python3
"""Render the shared effective policy source into Markdown and static pages."""
from pathlib import Path
import argparse
import html
import json
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Check without writing files')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
policies = json.loads((root / 'src/content/legal.json').read_text())
meta = json.loads((root / 'src/content/legal-meta.json').read_text())
assert meta['status'] == 'effective'
assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', meta['effectiveDate'])
assert meta['version'] == meta['effectiveDate']
notice = f"Effective {meta['effectiveDateLabel']} · Version {meta['version']}"
css = ('body{background:#091322;color:#eef5fa;font:17px/1.7 system-ui,sans-serif;margin:0}'
       'main{max-width:780px;margin:auto;padding:32px 24px 64px}a{color:#62ccff;overflow-wrap:anywhere}'
       'h1{line-height:1.2}h2{margin-top:32px}.notice{border:1px solid #62ccff;border-radius:12px;padding:16px}'
       'li{margin:12px 0}footer{border-top:1px solid #33465c;margin-top:40px;padding-top:20px}')


def html_body(text):
    return html.escape(text).replace('\n', '<br>')


def markdown_body(text):
    lines = text.split('\n')
    return '\n'.join(line + ('\\' if line and i + 1 < len(lines) and lines[i + 1] else '')
                     for i, line in enumerate(lines))


def document(title, body):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<meta name="robots" content="noindex"><title>{html.escape(title)} | Pulse by SBH</title>'
            f'<style>{css}</style></head><body><main>{body}'
            '<footer><a href="privacy.html">Privacy Policy</a> · '
            '<a href="health-privacy.html">Consumer Health Data Privacy Policy</a> · '
            '<a href="delete-account.html">Request account deletion</a><br>'
            '<a href="mailto:legal@sciencebyhugs.com">Privacy and legal requests</a> · '
            '<a href="mailto:support@sciencebyhugs.com">Support</a></footer></main></body></html>\n')


outputs = {}
for policy in policies:
    title = html.escape(policy['title'])
    body = ''.join('<section><h2>' + html.escape(s['heading']) + '</h2><p>' +
                   html_body(s['body']) + '</p></section>' for s in policy['sections'])
    page = document(policy['title'], '<a href="index.html">All policies</a><h1>' + title +
                    '</h1><p class="notice">' + html.escape(notice) + '</p>' + body)
    outputs[root / 'public/legal' / f"{policy['slug']}.html"] = page
    md = f"# {policy['title']}\n\n{notice}\n" + ''.join(
        f"\n## {s['heading']}\n\n{markdown_body(s['body'])}\n" for s in policy['sections'])
    outputs[root / 'docs/legal' / f"{policy['slug']}.md"] = md
links = ''.join(f'<li><a href="{p["slug"]}.html">{html.escape(p["title"])}</a></li>' for p in policies)
outputs[root / 'public/legal/index.html'] = document('Legal & Privacy',
    '<h1>Pulse by SBH — Legal & Privacy</h1><p class="notice">' + html.escape(notice) + '</p>'
    '<p>Science By Hugs provides Pulse for United States residents aged 18 or older. '
    'Read the current service policies below. Privacy requests and account deletion '
    'can be initiated without installing or signing in to Pulse.</p><nav aria-label="Policies"><ul>' +
    links + '</ul></nav>')
stale = []
for path, content in outputs.items():
    if args.check:
        if not path.exists() or path.read_text() != content:
            stale.append(str(path.relative_to(root)))
    else:
        path.write_text(content)
if stale:
    parser.exit(1, 'Policy outputs need regeneration:\n' + '\n'.join(stale) + '\n')
print('Policy outputs are synchronized.' if args.check else
      'Rendered six effective policies, Markdown copies and public index. Hosting is a separate step.')
