from pathlib import Path
import csv, re, html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, Preformatted, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
FONT = Path('C:/Windows/Fonts')
for name, filename in [('Body','arial.ttf'),('BodyBold','arialbd.ttf'),('BodyItalic','ariali.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONT/filename)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='BodyItalic',boldItalic='BodyBold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='Text',fontName='Body',fontSize=9,leading=13,spaceAfter=6,textColor=colors.HexColor('#243447')))
styles.add(ParagraphStyle(name='TitleS',parent=styles['Text'],fontName='BodyBold',fontSize=23,leading=28,spaceAfter=16))
styles.add(ParagraphStyle(name='H2S',parent=styles['Text'],fontName='BodyBold',fontSize=14,leading=18,spaceBefore=14,spaceAfter=8,keepWithNext=True,textColor=colors.HexColor('#075E69')))
styles.add(ParagraphStyle(name='H3S',parent=styles['Text'],fontName='BodyBold',fontSize=10.5,leading=14,spaceBefore=10,spaceAfter=5,keepWithNext=True))
styles.add(ParagraphStyle(name='CellS',parent=styles['Text'],fontSize=7.6,leading=10.5,spaceAfter=2))
styles.add(ParagraphStyle(name='BulletS',parent=styles['Text'],leftIndent=10,firstLineIndent=-7))

def inline(s):
    s=html.escape(s)
    def link(m):
        url=m.group(2)
        if not url.startswith(('https://','http://')) and url.endswith('.md'):
            url=url[:-3]+'.pdf'
        return '<a href="'+url+'" color="#075E69">'+m.group(1)+'</a>'
    s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',link,s)
    s=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'`([^`]+)`',r'<font color="#555555">\1</font>',s)
    return s

def architecture():
    d=Drawing(475,185)
    boxes=[(5,133,'Operator / API'),(165,133,'Model proposal'),(325,133,'Policy + approval'),(325,63,'Restricted worker'),(165,63,'Downstream + verify'),(5,63,'Durable ledger')]
    for x,y,label in boxes:
        d.add(Rect(x,y,140,38,rx=5,ry=5,fillColor=colors.HexColor('#EDF6F7'),strokeColor=colors.HexColor('#075E69')))
        d.add(String(x+70,y+15,label,fontName='BodyBold',fontSize=9,textAnchor='middle',fillColor=colors.HexColor('#243447')))
    for x1,y1,x2,y2 in [(145,152,165,152),(305,152,325,152),(395,133,395,101),(325,82,305,82),(165,82,145,82)]:
        d.add(Line(x1,y1,x2,y2,strokeColor=colors.HexColor('#075E69'),strokeWidth=1.3))
    d.add(String(5,30,'Credentials stay with the worker. Every protected action has durable evidence.',fontName='Body',fontSize=9))
    d.add(String(5,14,'Model visibility and tool enforcement are separate boundaries.',fontName='Body',fontSize=9))
    return d

def footer(canvas,doc):
    canvas.saveState()
    w,h=doc.pagesize
    canvas.setStrokeColor(colors.HexColor('#CFDADD'))
    canvas.line(42,39,w-42,39)
    canvas.setFont('Body',8)
    canvas.setFillColor(colors.HexColor('#667788'))
    canvas.drawString(42,26,'SOHKEN  |  Research and planning  |  16 September 2026')
    canvas.drawRightString(w-42,26,str(doc.page))
    canvas.restoreState()

def export(md):
    lines=md.read_text(encoding='utf-8').splitlines(); story=[]; i=0
    while i<len(lines):
        line=lines[i]
        if not line.strip(): i+=1;continue
        if re.match(r'^### P\d+ ',line):
            group=[Paragraph(inline(line[4:]),styles['H3S'])];i+=1
            while i<len(lines) and (not lines[i].strip() or lines[i].startswith('- ')):
                if lines[i].startswith('- '):
                    group.append(Paragraph(inline('• '+lines[i][2:]),styles['BulletS']))
                i+=1
            story.append(KeepTogether(group));continue
        if line.startswith('```'):
            mode=line[3:]; block=[];i+=1
            while i<len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]);i+=1
            story.append(architecture() if mode=='mermaid' else Preformatted('\n'.join(block),styles['Text']))
            i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                if not re.fullmatch(r'[|\s:\-]+',lines[i]):
                    rows.append([Paragraph(inline(v.strip()),styles['CellS']) for v in lines[i].strip('|').split('|')])
                i+=1
            cols=len(rows[0]);width=511.28
            ratios={2:[.32,.68],3:[.23,.39,.38],4:[.1,.35,.08,.47],5:[.16,.09,.30,.28,.17]}.get(cols,[1/cols]*cols)
            table=LongTable(rows,colWidths=[width*x for x in ratios],repeatRows=1,hAlign='LEFT')
            table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DCEFF1')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,0),.8,colors.HexColor('#075E69')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#D8E2E5')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F7FAFB')])]))
            story.extend([table,Spacer(1,9)]);continue
        style='Text';content=line
        if line.startswith('# '):style='TitleS';content=line[2:]
        elif line.startswith('## '):style='H2S';content=line[3:]
        elif line.startswith('### '):style='H3S';content=line[4:]
        elif line.startswith('- '):style='BulletS';content='• '+line[2:]
        elif re.match(r'^\d+\. ',line):style='BulletS'
        else:
            while i+1<len(lines) and lines[i+1].strip() and not re.match(r'^(#|\||-|```|\d+\. )',lines[i+1]):
                i+=1;content+=' '+lines[i]
        story.append(Paragraph(inline(content),styles[style]));i+=1
    out=md.with_suffix('.pdf')
    doc=SimpleDocTemplate(str(out),pagesize=(595.28,841.89),rightMargin=42,leftMargin=42,topMargin=43,bottomMargin=52,title=lines[0][2:],author='Sohken research',pageCompression=1)
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    reader=PdfReader(str(out));text='\n'.join(p.extract_text() or '' for p in reader.pages)
    assert len(text)>len(md.read_text(encoding='utf-8'))*.45, out
    print(out.name, len(reader.pages),'pages',len(text),'extracted characters')

source=(ROOT/'SOHKEN_PROBLEMS_LIST.md').read_text(encoding='utf-8')
rows=[]
for m in re.finditer(r'^### (P\d+) — (.*?)\n(.*?)(?=^### |^## |\Z)',source,re.M|re.S):
    fields={key:val.strip() for key,val in re.findall(r'^- \*\*(.*?):\*\* (.*)$',m[3],re.M)}
    rows.append({'ID':m[1],'Problem':m[2],'Priority and evidence':fields['Priority / evidence'],'Scenario and impact':fields['Scenario / impact'],'Build response':fields['Build response'],'Acceptance test':fields['Acceptance test'],'Status':'Open','Proposed owner':'Solo builder'})
assert len(rows)==32 and len({x['ID'] for x in rows})==32
with (ROOT/'SOHKEN_PROBLEMS_LIST.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
for name in ['SOHKEN_PROBLEMS_LIST.md','SOHKEN_BUILD_AND_DEPLOYMENT_PLAN.md','SOURCES.md']:
    export(ROOT/name)

alltext='\n'.join(p.read_text(encoding='utf-8') for p in ROOT.glob('*.md'))
assert not re.search(r'\[web:\d+\]',alltext)
assert not set(re.findall(r'\bS(\d\d)\b',alltext))-set(f'{n:02}' for n in range(21))
print('Validated: 32 unique problems, source ID range, PDF text extraction, UTF-8 CSV.')
