// The master stylesheet. All spacing comes from a small scale, all colour from the
// theme tokens, and values inside @page rules are literals because custom
// properties do not reach margin boxes.

export function fontStack(face, lang) {
  const punct = lang === 'zh'
    ? (face.cjk.includes('Sans') ? "'Atelier Punct Sans'," : "'Atelier Punct Serif',")
    : ''
  return `${punct}${face.latin},${face.cjk},${face.generic}`
}

export function buildCss({ t, lang, page, gutter, density, title, chapters, single }) {
  const display = fontStack(t.display, lang)
  const body = fontStack(t.body, lang)
  const label = fontStack(t.label, lang)
  const mono = `'JetBrains Mono Variable',${t.body.cjk},monospace`
  const zh = lang === 'zh'
  const bodySize = zh ? 10.4 : 11
  const lineHeight = (zh ? 1.86 : 1.52) * density
  const track = t.labelCase === 'uppercase' ? '.09em' : '.04em'
  const quoted = s => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`

  const marginBox = `font-family:${label};font-size:7.4pt;color:${t.ink3};letter-spacing:${track};`
  const chapterPages = chapters.map((c, i) => `@page ch${i}{@top-right{content:${quoted(c.plain.slice(0, 44))};${marginBox}padding-right:${gutter}mm;vertical-align:bottom;padding-bottom:5mm}}`).join('\n')

  return `
@page{size:${page.w}mm ${page.h}mm;margin:21mm 0 19mm;background:${t.paper};
  @top-left{content:${quoted(single ? '' : title.slice(0, 40))};${marginBox}padding-left:${gutter}mm;vertical-align:bottom;padding-bottom:5mm}
  @bottom-right{content:counter(page);font-family:${label};font-size:8pt;color:${t.accentText};padding-right:${gutter}mm;vertical-align:top;padding-top:6mm;font-variant-numeric:tabular-nums}
  @bottom-left{content:"";}
}
@page cover{margin:0;background:${t.paper};@top-left{content:none}@top-right{content:none}@bottom-right{content:none}}
@page bare{@top-left{content:none}@top-right{content:none}}
@page tocfull{margin-bottom:0;@top-left{content:none}@top-right{content:none}@bottom-right{content:none}}
${chapterPages}
:root{
  --paper:${t.paper};--ink:${t.ink};--ink2:${t.ink2};--ink3:${t.ink3};--rule:${t.rule};--panel:${t.panel};--panel2:${t.panel2};
  --accent:${t.accent};--accentText:${t.accentText};--accent2:${t.accent2};--accent3:${t.accent3};--accentInk:${t.accentInk};
  --deep:${t.deep};--deepInk:${t.deepInk};--onDeep:${t.onDeepAccent};--codeBg:${t.codeBg};
  --radius:${t.radius};--g:${gutter}mm;--wide:${gutter - 9}mm;
  --lh:${lineHeight};--para:${(zh ? 0.72 : 0.68) * density}em;
  --display:${display};--body:${body};--label:${label};--mono:${mono};
}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html{background:${t.paper}}
body{margin:0;background:${t.paper};color:var(--ink);font-family:var(--body);font-size:${bodySize}pt;line-height:var(--lh);
  font-weight:${t.dark ? 380 : 400};font-kerning:normal;text-autospace:normal;text-spacing-trim:normal;line-break:strict;
  font-feature-settings:"kern","liga";orphans:3;widows:3}
.sheet{padding-inline:var(--g)}
p{margin:0 0 var(--para);text-wrap:pretty;${zh ? 'text-align:justify;text-justify:inter-character;' : 'text-align:left;'}${t.indent ? 'text-indent:2em;margin-bottom:.18em;' : ''}}
${t.indent ? '.callout p,.card p,.col p,li p,.lead p,.pull p,.notes p{text-indent:0;margin-bottom:.5em}' : ''}
a{color:var(--accentText);text-decoration:underline;text-decoration-thickness:.4pt;text-underline-offset:.16em}
strong{font-weight:${t.dark ? 620 : 680}}
em{${zh ? 'font-style:normal;color:var(--accentText)' : 'font-style:italic'}}
sup.fnref{line-height:0;font-size:.72em}sup.fnref a{text-decoration:none;font-family:var(--label);font-weight:600}
.nb{white-space:nowrap}
svg.m{display:inline-block;overflow:visible;fill:currentColor;stroke:currentColor;stroke-width:0;margin-right:-.03em}
ul,ol{margin:0 0 var(--para);padding-left:1.45em}
li{margin:.22em 0;padding-left:.15em}
li>p{margin:0 0 .3em;text-align:left}
ul>li::marker{color:var(--accent);font-size:.92em}
ol>li::marker{color:var(--accentText);font-family:var(--label);font-size:.88em;font-weight:600;font-variant-numeric:tabular-nums}
hr{border:0;margin:8mm 0;text-align:center;line-height:1;height:auto}
hr::after{content:"\\2014\\2003\\2726\\2003\\2014";color:var(--accent);font-size:8pt}

/* headings */
h1,h2,h3,h4,h5,h6{font-family:var(--display);break-after:avoid;text-align:left;text-wrap:balance}
h2{font-size:${zh ? 15.2 : 16}pt;line-height:1.32;font-weight:${t.displayWeight};margin:9.5mm 0 3.2mm;letter-spacing:${zh ? '.01em' : '-.006em'};color:var(--ink)}
h3{font-size:${zh ? 11.4 : 11.8}pt;line-height:1.42;font-weight:${Math.min(t.displayWeight, 700)};margin:6.5mm 0 1.8mm;color:var(--accentText)}
h4,h5,h6{font-family:var(--body);font-size:1em;line-height:1.5;font-weight:680;margin:4.5mm 0 1mm;color:var(--ink)}
h1.plain{font-size:21pt;line-height:1.2;margin:11mm 0 4mm;font-weight:${t.displayWeight};padding-top:4mm;border-top:.7pt solid var(--ink)}
h2+h3{margin-top:2mm}

/* chapter openers */
.chapter{break-before:page}
.chapter.first-in-flow{break-before:auto}
.chap-num{font-family:var(--label);letter-spacing:${track};${t.labelCase === 'uppercase' ? 'text-transform:uppercase;' : ''}}
.chap-title{font-family:var(--display);font-weight:${t.displayWeight};margin:0;letter-spacing:${zh ? '.015em' : '-.012em'};text-wrap:balance}
.opener-band{position:relative;margin:0 calc(var(--g) * -1) 9mm;padding:13mm var(--g) 11mm;background:var(--deep);color:var(--deepInk);overflow:hidden;min-height:58mm;display:flex;flex-direction:column;justify-content:flex-end}
.opener-band .art{position:absolute;inset:0 0 0 auto;width:62%;height:100%;opacity:.9}
.opener-band .scrim{position:absolute;inset:0;background:linear-gradient(90deg,var(--deep) 36%,transparent 86%)}
.opener-band .chap-num{position:relative;font-size:8.4pt;color:var(--onDeep);margin-bottom:3mm}
.opener-band .chap-title{position:relative;font-size:27pt;line-height:1.2;max-width:74%}
.opener-rule{margin:0 0 9mm;padding:8mm 0 5mm;border-bottom:.8pt solid var(--ink);position:relative}
.opener-rule .chap-num{display:block;font-family:var(--display);font-size:46pt;line-height:1;color:var(--accent);font-weight:${t.displayWeight};letter-spacing:-.02em;margin-bottom:5mm;font-variant-numeric:lining-nums}
.opener-rule .chap-title{font-size:27pt;line-height:1.22}
.opener-numeral{position:relative;margin:0 0 11mm;padding:7mm 0 7mm;min-height:50mm;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden}
.op-art{position:absolute;right:0;top:0;width:66mm;height:100%}
.op-art .art{width:100%;height:100%}
.op-art::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,var(--paper) 4%,transparent 70%),linear-gradient(to top,var(--paper),transparent 44%)}
.opener-numeral .chap-num{font-size:10.5pt;color:var(--accentText);margin-bottom:3mm}
.opener-numeral .chap-title{font-size:30pt;line-height:1.2;max-width:78%;position:relative}
.opener-numeral::after{content:"";display:block;width:16mm;height:1.6pt;background:var(--accent);margin-top:6mm}
.lead>p,p.lead{font-size:${zh ? 12 : 12.6}pt;line-height:${zh ? 1.78 : 1.46};color:var(--ink2);margin-bottom:1.1em;text-align:left;text-indent:0;text-wrap:pretty}
${t.dropcap ? `.chapter>p.lead::first-letter{font-family:var(--display);font-size:3.25em;line-height:.84;float:left;padding:.08em .1em 0 0;color:var(--accent);font-weight:${t.displayWeight}}` : ''}

/* part pages */
.part{page:cover;position:relative;width:${page.w}mm;height:${page.h - 0.3}mm;background:var(--deep);color:var(--deepInk);overflow:hidden;break-before:page;break-after:page;margin-inline:calc(var(--g) * -1)}
.part .art{position:absolute;inset:0;width:100%;height:100%;opacity:.9}
.part-inner{position:absolute;left:24mm;right:24mm;bottom:34mm}
.part-num{font-family:var(--label);font-size:9pt;color:var(--onDeep);letter-spacing:${track};margin-bottom:4mm}
.part h1{font-family:var(--display);font-weight:${t.displayWeight};font-size:42pt;line-height:1.14;margin:0}

/* figures */
.fig{margin:7mm 0 7.5mm;break-inside:avoid}
.fig img{display:block;width:100%;border-radius:var(--radius)}
.fig svg.chart{display:block;width:100%;height:auto;overflow:visible}
.fig-svg{margin-inline:auto;width:min(100%,calc(var(--w) * .96px))}
.fig-svg svg{display:block;width:100%;height:auto}
.size-wide{margin-inline:calc(var(--wide) * -1)}
.size-full{margin-inline:calc(var(--g) * -1)}
.size-full img{border-radius:0}
.size-full figcaption{padding-inline:var(--g)}
.size-half{width:62%;margin-inline:auto}
.size-small{width:44%;margin-inline:auto}
.size-side{float:right;width:46%;margin:1mm 0 3mm 6mm}
figcaption,.tbl-cap,.gal-cap{font-family:var(--label);font-size:8pt;line-height:1.55;color:var(--ink3);margin-top:2.4mm;text-align:left}
.fig-n{color:var(--accentText);font-weight:640;margin-right:.75em;letter-spacing:.02em}
.gallery{display:grid;gap:4mm;margin:6mm 0;break-inside:avoid}
.gallery.n2{grid-template-columns:1fr 1fr}.gallery.n3{grid-template-columns:1fr 1fr 1fr}
.gallery img{width:100%;display:block;border-radius:var(--radius)}
img.inline{max-width:100%;height:1.2em;vertical-align:-.2em}
.chart text.ct,.chart .ct{font-family:var(--label);font-size:10.5px;fill:var(--ink2)}
.chart .mu{fill:var(--ink3)}
.chart .nm{font-weight:640;fill:var(--ink)}
.chart .big{font-family:var(--display);font-size:20px;fill:var(--ink);font-weight:${t.displayWeight}}
.eq{margin:4.6mm 0 5mm;text-align:center;font-size:1.06em;break-inside:avoid;line-height:1;text-indent:0}
.eq svg.m{max-width:100%;vertical-align:middle}

/* tables */
.table-wrap{margin:6mm 0 7mm}
.table-wrap.keep{break-inside:avoid}
.tbl-cap{margin:0 0 2.6mm}
table{width:100%;border-collapse:collapse;font-family:var(--label);font-size:${zh ? 8.7 : 8.6}pt;line-height:1.5}
thead{display:table-header-group}
tr{break-inside:avoid}
th{text-align:left;font-size:7.5pt;font-weight:640;color:var(--accentText);letter-spacing:.02em;padding:0 3mm 2mm 0;border-bottom:.9pt solid var(--ink);vertical-align:bottom}
td{padding:2mm 3mm 2mm 0;border-bottom:.4pt solid var(--rule);vertical-align:top;color:var(--ink)}
tbody tr:last-child td{border-bottom:.9pt solid var(--ink)}
td:last-child,th:last-child{padding-right:0}
td:first-child{font-weight:560}
.num{text-align:right;font-variant-numeric:tabular-nums lining-nums}
.ctr{text-align:center}
td p{margin:0;text-align:left;text-indent:0}

/* code */
pre.code{position:relative;margin:5mm 0 6mm;padding:4.6mm 5.4mm;background:var(--codeBg);border-radius:var(--radius);font-family:var(--mono);font-size:8.3pt;line-height:1.62;white-space:pre-wrap;word-break:break-word;color:var(--ink);break-inside:avoid-page}
pre.code code{font:inherit;background:none;padding:0;color:inherit}
.code-lang{float:right;font-size:6.8pt;color:var(--ink3);letter-spacing:.06em;margin:-1mm -1.6mm 0 2mm}
code{font-family:var(--mono);font-size:.84em;padding:.08em .32em;border-radius:.22em;background:var(--panel2)}
.hljs-comment,.hljs-quote{color:var(--ink3);font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-built_in,.hljs-type{color:var(--accentText);font-weight:560}
.hljs-string,.hljs-regexp,.hljs-attr,.hljs-symbol{color:var(--accent2)}
.hljs-number,.hljs-meta{color:var(--accent3)}
.hljs-title,.hljs-section,.hljs-name{font-weight:640}

/* quiet components */
blockquote{margin:5mm 0;padding:0 0 0 7mm;color:var(--ink2);position:relative}
blockquote::before{content:"\\201C";position:absolute;left:0;top:-1.6mm;font-family:${t.display.latin},Georgia,serif;font-size:22pt;color:var(--accent);line-height:1}
blockquote p{text-indent:0}
blockquote.pull{margin:9mm 0;padding:0;break-inside:avoid;text-align:left}
blockquote.pull::before{position:static;display:block;font-size:40pt;line-height:.72;margin-bottom:-1mm}
.pull-text p{font-family:var(--display);font-size:${zh ? 14.6 : 16}pt;line-height:1.56;color:var(--ink);text-align:left;font-weight:${Math.min(t.displayWeight, 560)};${zh ? '' : 'font-style:italic;'}text-indent:0;margin:0 0 .4em}
.pull-by{font-family:var(--label);font-size:8.2pt;color:var(--ink3);margin-top:2mm;letter-spacing:.03em}
.pull-by::before{content:"\\2014\\2009"}
.callout{margin:6mm 0;padding:4.8mm 5.6mm 3.4mm;background:var(--panel);border-radius:var(--radius);break-inside:avoid}
.callout p:last-child,.card p:last-child,.col p:last-child{margin-bottom:.3em}
.callout p{text-align:left;font-size:.975em}
.c-label{font-family:var(--label);font-size:7.6pt;font-weight:640;letter-spacing:${track};color:var(--accentText);margin-bottom:1.6mm;${t.labelCase === 'uppercase' ? 'text-transform:uppercase;' : ''}}
.k-key{background:var(--deep);color:var(--deepInk)}
.k-key .c-label{color:var(--onDeep)}
.k-key em,.k-key a{color:var(--onDeep)}
.k-key code{background:rgba(255,255,255,.14);color:inherit}
.k-warn{background:color-mix(in oklab,var(--paper) 87%,var(--accent2))}
.k-warn .c-label{color:color-mix(in oklab,var(--accent2) 86%,var(--ink))}
.k-example,.k-note{background:var(--panel2)}
.k-theorem,.k-definition,.k-lemma,.k-proof{background:none;border-radius:0;padding:3.6mm 0 2.4mm;border-block:.7pt solid var(--ink)}
.k-proof{border-block:.4pt solid var(--rule)}
.stats{display:grid;gap:0;margin:7mm 0 8mm;break-inside:avoid;border-block:.7pt solid var(--ink)}
.stats.n1{grid-template-columns:1fr}.stats.n2{grid-template-columns:1fr 1fr}.stats.n3{grid-template-columns:repeat(3,1fr)}.stats.n4{grid-template-columns:repeat(4,1fr)}
.stat{padding:4.4mm 4mm 4mm 0}
.stat+.stat{padding-left:4mm;border-left:.4pt solid var(--rule)}
.stats.n4 .stat:nth-child(4n+1){padding-left:0;border-left:0}
.stat-v{font-family:var(--display);font-weight:${t.displayWeight};font-size:var(--stat,25pt);line-height:1.08;white-space:nowrap;color:var(--accentText);letter-spacing:-.01em;font-variant-numeric:lining-nums}
.stat-l{font-family:var(--label);font-size:8.2pt;line-height:1.45;margin-top:1.8mm;color:var(--ink);font-weight:560}
.stat-n{font-family:var(--label);font-size:7.5pt;line-height:1.45;margin-top:.6mm;color:var(--ink3)}
.cards{display:grid;gap:4mm;margin:6mm 0 7mm}
.cards.n1{grid-template-columns:1fr}.cards.n2{grid-template-columns:1fr 1fr}.cards.n3{grid-template-columns:repeat(3,1fr)}
.card{background:var(--panel2);border-radius:var(--radius);padding:4.6mm 5mm 3.4mm;break-inside:avoid}
.card p{text-align:left;font-size:.94em;line-height:${(zh ? 1.72 : 1.5)};text-indent:0;hyphens:manual}
.card ul,.card ol{font-size:.94em}
.card-h{font-family:var(--display);font-weight:${Math.min(t.displayWeight, 700)};font-size:11pt;line-height:1.35;color:var(--accentText);margin-bottom:1.7mm}
.columns,.compare{display:grid;gap:7mm;margin:5mm 0 6mm}
.columns.n2,.compare.n2{grid-template-columns:1fr 1fr}.columns.n3,.compare.n3{grid-template-columns:repeat(3,1fr)}
.columns p,.compare p{text-align:left;hyphens:manual;text-indent:0}
.compare{gap:0;border-block:.7pt solid var(--ink);break-inside:avoid}
.compare .col{padding:4mm 5mm 2mm}
.compare .col:first-child{padding-left:0}
.compare .col+.col{border-left:.4pt solid var(--rule)}
.compare .col:last-child{padding-right:0}
.compare h5,.compare h6,.compare h4{margin-top:0;color:var(--accentText);font-family:var(--display)}
.timeline,.steps{list-style:none;margin:6mm 0 7mm;padding:0}
.timeline li{display:grid;grid-template-columns:27mm 1fr;margin:0;padding:0;break-inside:avoid}
.tl-t{font-family:var(--label);font-size:8.6pt;font-weight:640;color:var(--accentText);padding:.45mm 4mm 0 0;font-variant-numeric:tabular-nums;line-height:1.5}
.tl-b{position:relative;border-left:.7pt solid var(--rule);padding:0 0 4.4mm 5.6mm}
.tl-b::before{content:"";position:absolute;left:-1.25mm;top:1.25mm;width:2.2mm;height:2.2mm;border-radius:50%;background:var(--accent);box-shadow:0 0 0 .8mm var(--paper)}
.timeline li:last-child .tl-b{border-left-color:transparent;padding-bottom:0}
.tl-h{font-family:var(--display);font-weight:640;line-height:1.5}
.tl-d{color:var(--ink2);font-size:.95em;line-height:${zh ? 1.72 : 1.5};margin-top:.5mm}
.steps li{display:grid;grid-template-columns:15mm 1fr;margin:0;padding:3.4mm 0;border-top:.4pt solid var(--rule);break-inside:avoid}
.steps li:first-child{border-top:.7pt solid var(--ink)}
.steps li:last-child{border-bottom:.7pt solid var(--ink)}
.st-n{font-family:var(--display);font-size:17pt;line-height:1.1;color:var(--accent);font-weight:${t.displayWeight};font-variant-numeric:lining-nums}
.st-h{font-family:var(--display);font-weight:640;line-height:1.5}
.st-d{color:var(--ink2);font-size:.95em;line-height:${zh ? 1.72 : 1.5};margin-top:.4mm}
.glossary{margin:5mm 0 6mm}
.glossary>div{display:grid;grid-template-columns:34mm 1fr;gap:4mm;padding:2.2mm 0;border-bottom:.4pt solid var(--rule);break-inside:avoid}
.glossary>div:first-child{border-top:.7pt solid var(--ink)}
.glossary>div:last-child{border-bottom:.7pt solid var(--ink)}
dt{font-weight:660;color:var(--accentText);font-size:.96em}
dd{margin:0;font-size:.95em;line-height:${zh ? 1.72 : 1.5}}
aside.margin{float:right;width:47mm;margin:1mm calc(var(--wide) * -1) 3mm 6mm;font-family:var(--label);font-size:8pt;line-height:1.6;color:var(--ink2)}
aside.margin p{text-align:left;text-indent:0;hyphens:manual}
.pagebreak{break-after:page}
.notes{margin-top:10mm;padding-top:3mm;border-top:.7pt solid var(--ink);font-size:8.6pt;line-height:1.6;color:var(--ink2);break-inside:avoid-page}
.notes-h{font-family:var(--label);font-weight:640;color:var(--accentText);letter-spacing:${track};margin-bottom:2mm}
.notes ol{margin:0}

/* cover */
.cover{page:cover;position:relative;width:${page.w}mm;height:${page.h - 0.3}mm;overflow:hidden;break-after:page;color:var(--ink)}
.cover .art,.cover .hero{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover-kicker{font-family:var(--label);font-size:9pt;letter-spacing:${t.labelCase === 'uppercase' ? '.14em' : '.08em'};${t.labelCase === 'uppercase' ? 'text-transform:uppercase;' : ''}}
.cover-title{font-family:var(--display);font-weight:${t.displayWeight};margin:0;letter-spacing:${zh ? '.015em' : '-.02em'};text-wrap:balance}
.cover-sub{font-family:var(--body);font-size:13pt;line-height:1.55;margin-top:6mm;max-width:132mm;font-weight:${t.dark ? 340 : 400}}
.cover-meta{position:absolute;left:22mm;right:22mm;bottom:18mm;display:flex;justify-content:space-between;gap:10mm;font-family:var(--label);font-size:8.6pt;letter-spacing:.03em;padding-top:3mm;border-top:.5pt solid currentColor}
.cover-field{background:var(--deep);color:var(--deepInk)}
.cover-field .scrim{position:absolute;inset:0;background:linear-gradient(to top,var(--deep) 26%,color-mix(in srgb,var(--deep) 62%,transparent) 50%,transparent 74%)}
.cover-field .cover-text{position:absolute;left:22mm;right:22mm;bottom:40mm}
.cover-field .cover-kicker{color:var(--onDeep);margin-bottom:6mm}
.cover-split{background:var(--paper)}
.cover-split .top{position:absolute;left:0;right:0;top:0;height:56%;background:var(--deep);overflow:hidden}
.cover-split .cover-text{position:absolute;left:22mm;right:22mm;top:calc(56% + 11mm)}
.cover-split .cover-kicker{color:var(--accentText);margin-bottom:5mm}
.cover-split .cover-meta{color:var(--ink2)}
.cover-paper{background:var(--paper)}
.cover-paper .plate{position:absolute;right:0;top:0;width:100%;height:58%;overflow:hidden}
.cover-paper .cover-text{position:absolute;left:22mm;right:22mm;bottom:42mm}
.cover-paper .cover-kicker{color:var(--accentText);margin-bottom:5mm}
.cover-paper .cover-meta{color:var(--ink2)}
.cover-scroll{background:var(--paper)}
.cover-scroll .plate{position:absolute;left:0;right:0;bottom:0;height:58%}
.cover-scroll .v-title{position:absolute;right:30mm;top:26mm;writing-mode:vertical-rl;font-family:var(--display);font-weight:${t.displayWeight};letter-spacing:.2em;line-height:1.3;color:var(--ink);max-height:188mm}
.cover-scroll .v-sub{position:absolute;right:62mm;top:30mm;writing-mode:vertical-rl;font-family:${label};font-size:12pt;letter-spacing:.14em;color:var(--ink2);max-height:150mm;line-height:1.7}
.cover-scroll .cover-meta{left:22mm;right:auto;top:30mm;bottom:auto;display:block;writing-mode:vertical-rl;border:0;padding:0;color:var(--ink2);letter-spacing:.12em;line-height:1.9}
.cover-scroll .cover-meta span{margin-left:3mm}
.seal{display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--paper);font-family:var(--display);font-weight:800;border-radius:.7mm;writing-mode:vertical-rl;line-height:1.05;letter-spacing:.04em}
.cover-scroll .seal{position:absolute;right:22mm;width:13mm;height:13mm;font-size:12pt;top:214mm}

/* table of contents */
.toc{page:bare;break-after:page;position:relative}
.toc.single{page:tocfull;height:${page.h - 21.3}mm;overflow:hidden;break-after:auto}
.toc-title{font-family:var(--display);font-weight:${t.displayWeight};font-size:31pt;line-height:1.1;margin:5mm 0 13mm;letter-spacing:${zh ? '.08em' : '-.015em'}}
.toc-art{position:absolute;left:0;right:0;bottom:0;height:92mm;overflow:hidden}
.toc-art::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,var(--paper),transparent 62%)}
.toc-art .art{width:100%;height:100%}
.toc ol{list-style:none;margin:0;padding:0}
.toc li{margin:0;padding:0}
.toc a{color:inherit;text-decoration:none;display:grid;align-items:baseline}
.toc .l1>a{grid-template-columns:12mm 1fr auto;font-family:var(--display);font-size:12.2pt;font-weight:${Math.min(t.displayWeight, 680)};line-height:1.4;padding:3mm 0 2.4mm;border-top:.5pt solid var(--rule)}
.toc .l1:first-child>a{border-top:.8pt solid var(--ink)}
.toc .t-n{font-family:var(--label);font-size:8.6pt;color:var(--accentText);font-weight:600;font-variant-numeric:tabular-nums}
.toc .t-p{font-family:var(--label);font-size:9pt;color:var(--accentText);font-variant-numeric:tabular-nums;padding-left:6mm;font-weight:560}
.toc .l2>a{grid-template-columns:12mm 1fr auto;font-size:9.4pt;line-height:1.5;color:var(--ink2);padding:.5mm 0}
.toc .l2 .t-p{color:var(--ink3);font-weight:400;font-size:8.2pt}
.toc .l2:last-child>a{padding-bottom:2.6mm}
.toc.flat .l1>a{grid-template-columns:1fr auto}
.toc.flat .l2>a{grid-template-columns:5mm 1fr auto}
.toc .l0>a{grid-template-columns:1fr auto;font-family:var(--label);font-size:8pt;color:var(--accentText);padding:6mm 0 1.6mm;font-weight:640;letter-spacing:${track};${t.labelCase === 'uppercase' ? 'text-transform:uppercase;' : ''}}

/* masthead (article, brief) */
.masthead{position:relative;margin:0 calc(var(--g) * -1) 9mm;padding:15mm var(--g) 10mm;background:var(--deep);color:var(--deepInk);overflow:hidden}
.masthead .art{position:absolute;inset:0;width:100%;height:100%;opacity:.5}
.masthead .scrim{position:absolute;inset:0;background:linear-gradient(90deg,var(--deep) 30%,transparent 92%)}
.masthead>div{position:relative}
.mast-kicker{font-family:var(--label);font-size:8.2pt;color:var(--onDeep);letter-spacing:${track};margin-bottom:3.4mm;${t.labelCase === 'uppercase' ? 'text-transform:uppercase;' : ''}}
.mast-title{font-family:var(--display);font-weight:${t.displayWeight};font-size:28pt;line-height:1.18;margin:0;max-width:86%;letter-spacing:${zh ? '.012em' : '-.016em'};text-wrap:balance}
.mast-sub{font-size:11.6pt;line-height:1.55;margin-top:3.4mm;max-width:80%;opacity:.92}
.mast-meta{font-family:var(--label);font-size:8pt;margin-top:6mm;opacity:.86;letter-spacing:.03em}
.backcover{page:cover;position:relative;width:${page.w}mm;height:${page.h - 0.3}mm;overflow:hidden;break-before:page;margin-inline:calc(var(--g) * -1);background:var(--deep);color:var(--deepInk)}
.backcover .art{position:absolute;inset:0;width:100%;height:100%;opacity:.55}
.backcover .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,var(--deep) 20%,transparent 78%)}
.colophon{position:absolute;left:24mm;top:30mm;right:40mm;font-family:var(--label);font-size:8.6pt;line-height:1.7}
.colophon b{display:block;font-family:var(--display);font-weight:${t.displayWeight};font-size:14pt;margin-bottom:2mm}
`
}
