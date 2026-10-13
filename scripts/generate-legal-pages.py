#!/usr/bin/env python3
"""Render draft native policy source into consistent Markdown and static pages."""
from pathlib import Path
import argparse,json,html
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Check without writing files')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
policies=json.loads((root/'src/content/legal.json').read_text())
css='body{background:#091322;color:#eef5fa;font:17px/1.7 system-ui,sans-serif;margin:0}main{max-width:780px;margin:auto;padding:32px 24px 64px}a{color:#62ccff}h1{line-height:1.2}h2{margin-top:32px}.draft{border:1px solid #62ccff;border-radius:12px;padding:16px}'
outputs={}
for policy in policies:
 title=html.escape(policy['title'])
 body=''.join('<section><h2>'+html.escape(s['heading'])+'</h2><p>'+html.escape(s['body'])+'</p></section>' for s in policy['sections'])
 page=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>{title} | Pulse by SBH</title><style>{css}</style></head><body><main><a href="index.html">All policies</a><h1>{title}</h1><p class="draft">Draft — not yet effective. Public mailing address, verified retention and attorney review remain pending.</p>{body}<p><a href="mailto:legal@sciencebyhugs.com">Privacy and legal requests</a> · <a href="mailto:support@sciencebyhugs.com">Support</a></p></main></body></html>\n'
 outputs[root/'public/legal'/f"{policy['slug']}.html"]=page
 md=f"# {policy['title']}\n\nDraft — not yet effective.\n"+''.join(f"\n## {s['heading']}\n\n{s['body']}\n" for s in policy['sections'])
 outputs[root/'docs/legal'/f"{policy['slug']}.md"]=md
stale=[]
for path, content in outputs.items():
 if args.check:
  if not path.exists() or path.read_text()!=content: stale.append(str(path.relative_to(root)))
 else: path.write_text(content)
if stale: parser.exit(1, 'Policy outputs need regeneration:\n'+'\n'.join(stale)+'\n')
print('Policy outputs are synchronized.' if args.check else 'Rendered six draft policy pages and Markdown documents. Nothing published.')
