import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#787774"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(40, 810, "C-rev — Developer Code Reviewer & Execution Engine (Project Report)")
            self.setStrokeColor(colors.HexColor("#E9E9E7"))
            self.setLineWidth(0.5)
            self.line(40, 804, 555, 804)
        
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(555, 30, footer_text)
        self.drawString(40, 30, "Author: Pradeep (@Pradeep8081) | Notion Engineering Handbook")
        self.setStrokeColor(colors.HexColor("#E9E9E7"))
        self.setLineWidth(0.5)
        self.line(40, 42, 555, 42)
        self.restoreState()

def build_pdf():
    pdf_path = r"c:\Users\Nikhil\Downloads\AI CODE REVIEWER-FRONTEND\C-Rev_Project_Report_Hinglish.pdf"
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()
    
    # Custom Notion Styles
    title_style = ParagraphStyle(
        'NotionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#191919'),
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'NotionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=colors.HexColor('#191919'),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'NotionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#222222'),
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'NotionBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14.5,
        textColor=colors.HexColor('#2F3437'),
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'NotionBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#2F3437'),
        leftIndent=15,
        spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'NotionCalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor('#2F3437')
    )

    code_style = ParagraphStyle(
        'NotionCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#EFF1F6')
    )

    speech_style = ParagraphStyle(
        'SpeechStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        leading=14.5,
        textColor=colors.HexColor('#1B3A4B')
    )

    story = []

    # Breadcrumb
    story.append(Paragraph("<font color='#787774' size='8'>Projects / Final Year Engineering / <b>C-rev Code Reviewer</b></font>", body_style))
    story.append(Spacer(1, 6))

    # Notion Page Icon & Title
    story.append(Paragraph("<font size='26'>💻</font>", body_style))
    story.append(Paragraph("C-rev: Intelligent Code Reviewer & Execution Engine", title_style))
    story.append(Paragraph("<font color='#787774'>A Complete Engineering Handbook & Viva Voce Defense Guide (in Hinglish)</font>", body_style))
    story.append(Spacer(1, 10))

    # Notion Properties Table
    props_data = [
        [Paragraph("<b>📌 Project Name</b>", body_style), Paragraph("<b>C-rev (Senior Code Reviewer & Runtime Engine)</b>", body_style)],
        [Paragraph("<b>👤 Developer / Author</b>", body_style), Paragraph("Pradeep (GitHub: @Pradeep8081)", body_style)],
        [Paragraph("<b>🎓 Project Category</b>", body_style), Paragraph("Final Year / Semester Computer Science Engineering Project", body_style)],
        [Paragraph("<b>🛠️ Tech Stack</b>", body_style), Paragraph("React 18, Vite, Node.js, Express, Python 3, Google GenAI SDK", body_style)],
        [Paragraph("<b>🚀 Live Frontend URL</b>", body_style), Paragraph("<font color='#2383E2'><u>https://crev-code-reviewer.vercel.app</u></font>", body_style)],
        [Paragraph("<b>⚡ Live Backend URL</b>", body_style), Paragraph("<font color='#2383E2'><u>https://crev-code-reviewer.onrender.com</u></font>", body_style)],
        [Paragraph("<b>📂 GitHub Repository</b>", body_style), Paragraph("<font color='#2383E2'><u>https://github.com/Pradeep8081/crev-code-reviewer</u></font>", body_style)],
        [Paragraph("<b>📶 Production Status</b>", body_style), Paragraph("<font color='#2CBB5D'><b>● 100% Deployed & Live (Vercel + Render)</b></font>", body_style)]
    ]
    props_table = Table(props_data, colWidths=[130, 385])
    props_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FAFAFA')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E9E9E7')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#EEEEEE')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(props_table)
    story.append(Spacer(1, 14))

    # Notion Callout: Executive Summary
    summary_text = (
        "<b>💡 Executive Summary (Short Overview):</b><br/>"
        "C-rev ek <b>Full-Stack Developer Platform</b> hai jisko maine <b>LeetCode-inspired clean UI</b> ke sath banaya hai. "
        "Yeh generic AI text generator nahi hai — yeh code ko backend ke <b>isolated sandbox me execute</b> karta hai, "
        "Python aur JavaScript ka runtime output, error trace aur execution time (milliseconds me) capture karta hai, "
        "aur error aane par <b>exact line number aur token highlight karke 1-click me fix</b> provide karta hai."
    )
    summary_table = Table([[Paragraph(summary_text, callout_style)]], colWidths=[515])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#E7F3F8')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#D0E7F3')),
        ('LINELEFT', (0,0), (-1,-1), 3, colors.HexColor('#2383E2')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # SECTION 1
    story.append(Paragraph("🎯 1. Yeh Project Kis Kaam Ke Liye Bana Hai? (Purpose)", h1_style))
    story.append(Paragraph(
        "Jab bhi koi student ya junior developer code likhta hai, toh unhe daily teen sabse badi problem aati hain:",
        body_style
    ))
    story.append(Paragraph("<b>1. Cryptic Compiler Errors:</b> Terminal me aise errors aate hain jaise <code>TypeError: Cannot read property 'tier' of undefined</code> ya <code>ZeroDivisionError</code> jo beginner ko samajh nahi aate ki error kyu hua.", bullet_style))
    story.append(Paragraph("<b>2. Senior Code Review ka Na Milna:</b> Har student ke paas senior software engineer nahi hota jo unke code ka score (0-10), time complexity (O(N) vs O(N²)) aur memory usage analyze karke samjhaye.", bullet_style))
    story.append(Paragraph("<b>3. Manual Debugging me Ghanton Barbaad Hona:</b> Bug dhoondne aur fix karne ke chakkar me students doosre naye bugs create kar dete hain.", bullet_style))
    story.append(Spacer(1, 6))

    sol_text = (
        "<b>✅ C-rev Iska Solution Kaise Deta Hai?</b><br/>"
        "• <b>Live Execution:</b> Code ko real environment me run karke terminal output dikhata hai.<br/>"
        "• <b>Automated Line-by-Line Diagnosis:</b> Red marker se dikhata hai ki bug line X ke kis exact word me hai.<br/>"
        "• <b>1-Click Quick Fix:</b> 'Apply Quick Fix' dabate hi editor ke andar corrected code replace ho jata hai.<br/>"
        "• <b>Easy Peer Review:</b> Simple human language me audit report deta hai taaki koi bhi easily samajh sake."
    )
    sol_table = Table([[Paragraph(sol_text, callout_style)]], colWidths=[515])
    sol_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EDF3EC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#D4E7D4')),
        ('LINELEFT', (0,0), (-1,-1), 3, colors.HexColor('#2CBB5D')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(sol_table)
    story.append(Spacer(1, 14))

    # SECTION 2
    story.append(Paragraph("⚙️ 2. Yeh Kisse Aur Kaise Bana Hai? (Tech Stack & Architecture)", h1_style))
    story.append(Paragraph(
        "Is project ko ek modern <b>Decoupled Client-Server Microservices Architecture</b> par design kiya gaya hai:",
        body_style
    ))

    tech_data = [
        [Paragraph("<b>Layer</b>", body_style), Paragraph("<b>Technology</b>", body_style), Paragraph("<b>Kyu Use Kiya? (Exact Role)</b>", body_style)],
        [Paragraph("<b>Frontend UI</b>", body_style), Paragraph("<b>React 18.3 + Vite 5</b>", body_style), Paragraph("Fast single-page application (SPA), sub-second HMR, modular state architecture.", body_style)],
        [Paragraph("<b>Code Editor</b>", body_style), Paragraph("<b>react-simple-code-editor</b>", body_style), Paragraph("Lightweight in-browser code editor jisme exact line number gutter synchronization hai.", body_style)],
        [Paragraph("<b>Syntax Tokenizer</b>", body_style), Paragraph("<b>PrismJS</b>", body_style), Paragraph("Python, JavaScript, TypeScript, C++, Java ke code ko real-time syntax highlight karta hai.", body_style)],
        [Paragraph("<b>Backend API</b>", body_style), Paragraph("<b>Node.js + Express.js</b>", body_style), Paragraph("REST API endpoints banata hai (<code>/ai/run-code</code> aur <code>/ai/get-review</code>) with CORS security.", body_style)],
        [Paragraph("<b>Execution Sandbox</b>", body_style), Paragraph("<b>child_process.exec (Node)</b>", body_style), Paragraph("Server par safe isolated temp file banata hai aur Python/Node command run karke output laata hai.", body_style)],
        [Paragraph("<b>Timeout Guard</b>", body_style), Paragraph("<b>6000ms Sentinel Guard</b>", body_style), Paragraph("Agar user <code>while(True)</code> infinite loop likh de, toh 6 sec me process kill karke server safe rakhta hai.", body_style)],
        [Paragraph("<b>Diagnostics Engine</b>", body_style), Paragraph("<b>Google GenAI SDK (Gemini)</b>", body_style), Paragraph("Buggy error trace ko analyze karke JSON schema me bug location, cause aur fix return karta hai.", body_style)],
        [Paragraph("<b>Cloud Hosting</b>", body_style), Paragraph("<b>Vercel Edge + Render Linux</b>", body_style), Paragraph("Frontend globally Vercel CDN par host hai, backend 24/7 Render Linux Web Service par live hai.", body_style)]
    ]
    tech_table = Table(tech_data, colWidths=[95, 140, 280])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F1EF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E9E9E7')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#EEEEEE')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tech_table)
    story.append(Spacer(1, 14))

    # SECTION 3
    story.append(Paragraph("🔄 3. Under the Hood Kaise Kaam Hota Hai? (Step-by-Step Flow)", h1_style))
    story.append(Paragraph(
        "Jab user website par koi code run ya review karta hai, toh parde ke peeche yeh 5 steps hote hain:",
        body_style
    ))
    story.append(Paragraph("<b>Step 1 (Auto Language Detect):</b> User chahe Python likhe ya JS, regex detector (<code>detectLanguage()</code>) bina user se pooche automatically language pehchan leta hai.", bullet_style))
    story.append(Paragraph("<b>Step 2 (Sandbox Dispatch):</b> 'Run' click karte hi frontend backend ko POST request bhejta hai. Backend OS temp folder me ek random file banata hai (e.g. <code>crev_py_1728_ab1.py</code>).", bullet_style))
    story.append(Paragraph("<b>Step 3 (Process Execution):</b> Backend child process me <code>python crev_py_...py</code> run karta hai. 6 second ka safety timer chalta hai. Output aate hi temp file turant delete (unlink) ho jaati hai.", bullet_style))
    story.append(Paragraph("<b>Step 4 (Error Intercept & Diagnosis):</b> Agar code me crash hua (Exit code != 0), backend error trace ko AI diagnostics engine ko bhejta hai, jo strictly structured JSON schema return karta hai (exact faulty line, cause, solution).", bullet_style))
    story.append(Paragraph("<b>Step 5 (Word-Level Diff & 1-Click Fix):</b> Frontend custom diff algorithm chala kar editor ke us specific word ko red underline karta hai. User jab 'Apply Quick Fix' click karta hai, code automatically correct code se replace ho jaata hai!", bullet_style))
    story.append(Spacer(1, 14))

    # SECTION 4
    story.append(Paragraph("🎨 4. LeetCode Style UI Kyu Banaya? (Kyu yeh AI template nahi lagta)", h1_style))
    ui_explain = (
        "<b>Teacher ko bolne ke liye main point:</b><br/>"
        "Aam taur par jo AI tools hote hain unme chamakne wali neon light, gradient animation aur pulsing buttons hote hain — "
        "jisse teacher turant bol deta hai ki 'Yeh AI generated template lag raha hai'.<br/>"
        "Isliye maine iska UI <b>LeetCode aur VS Code ke developer standards</b> par banaya hai:<br/>"
        "• <b>Matte Charcoal Dark Theme:</b> <code>#1a1a1a</code> app background aur <code>#262626</code> panels with crisp 1px borders.<br/>"
        "• <b>Solid LeetCode Green Submit Button:</b> Clean <code>#2cbb5d</code> solid button bina kisi chamakne wale shimmer effect ke.<br/>"
        "• <b>Developer Split Panel:</b> Left side me Code Editor aur Right side me Console Output & Review tabs.<br/>"
        "• <b>100% Mobile Responsive:</b> Phone par automatic segmented controller (<code>[ Editor ] [ Review & Terminal ]</code>) aa jata hai."
    )
    ui_table = Table([[Paragraph(ui_explain, callout_style)]], colWidths=[515])
    ui_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FBF3DB')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#F2E3B8')),
        ('LINELEFT', (0,0), (-1,-1), 3, colors.HexColor('#FFA116')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(ui_table)
    story.append(Spacer(1, 14))

    # SECTION 5: 1-2 MINUTE VIVA SCRIPT
    story.append(Paragraph("🎙️ 5. Teacher Ko 1-2 Minute Me Kya Bolna Hai? (Short Viva Pitch)", h1_style))
    story.append(Paragraph(
        "Jab teacher bole <b>'Chalo Pradeep, apna project explain karo'</b>, toh aapko bina ruke confidence ke sath exactly yeh bolna hai:",
        body_style
    ))

    script_text = (
        "<b>🗣️ Aapka 1-2 Minute ka Exact Speech (Ratta maar lijiye ya natural boliye):</b><br/><br/>"
        "<i>\"Good morning Sir/Ma'am. Mera project hai <b>C-rev — an Intelligent Developer Code Reviewer and Runtime Engine</b>.<br/><br/>"
        "Sir, jab students programming karte hain, toh unhe cryptic compiler errors samajh nahi aate aur na hi unhe kisi senior programmer ka code review mil pata hai. "
        "Is problem ko solve karne ke liye maine yeh full-stack platform build kiya hai.<br/><br/>"
        "Mera system do main parts me kaam karta hai:<br/>"
        "<b>Pehla — Real Execution Sandbox:</b> User jab code daal kar 'Run' dabata hai, toh mera Node.js backend server background me child process ke through Python ya JavaScript code ko physically execute karta hai. Agar student koi infinite loop likh de, toh mera 6-second timeout sentinel process ko terminate karke server ko crash hone se bacha leta hai.<br/><br/>"
        "<b>Doosra — Intelligent Diagnostics & 1-Click Fix:</b> Agar execution me koi error aata hai, toh mera custom diff algorithm exact line number aur faulty expression ko red highlight karta hai, problem ko simple everyday language me explain karta hai, aur 'Apply Quick Fix' button se single click me code ko editor ke andar hi theek kar deta hai.<br/><br/>"
        "Sir, iska architecture React + Vite frontend aur Node + Express backend par microservices model me built hai. Frontend <b>Vercel Edge Network</b> par hosted hai aur backend <b>Render Linux Cloud</b> par 24/7 live chal raha hai. Iska UI maine LeetCode ke developer pattern par banaya hai taaki yeh fast, clean aur responsive ho.\"</i>"
    )
    script_table = Table([[Paragraph(script_text, speech_style)]], colWidths=[515])
    script_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F7F6F3')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#D3D3D0')),
        ('LINELEFT', (0,0), (-1,-1), 4, colors.HexColor('#191919')),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(script_table)
    story.append(Spacer(1, 14))

    # SECTION 6: VIVA QUESTIONS & DEFENSE ANSWERS
    story.append(Paragraph("❓ 6. Teacher Ke 5 Sabse Common Sawal Aur Unke Perfect Jawab", h1_style))

    qa_list = [
        (
            "Q1: \"Kya tumne bas ek AI API call karke wrapper banaya hai ya khud code kiya hai?\"",
            "<b>Answer:</b> Bilkul nahi Sir. AI sirf structured error JSON parsing ke liye use hota hai. "
            "Poora physical execution engine maine Node.js child processes (`child_process.exec`) ke sath OS temporary file isolation me khud banaya hai. "
            "Client side ka token diffing algorithm, editor line gutter synchronization, state management, aur Vercel/Render CI/CD deployment sab mera custom software architecture hai."
        ),
        (
            "Q2: \"Agar koi student infinite loop likh de jaise while(True), toh kya server hang ho jayega?\"",
            "<b>Answer:</b> Nahi Sir. Maine backend me 6000 millisecond (6 seconds) ka strict timeout guard lagaya hai. "
            "Jaise hi 6 second cross hote hain, Node.js process ko `SIGTERM` signal bhejkar process kill kar deta hai aur temporary file ko disk se delete karke graceful timeout message bhejta hai."
        ),
        (
            "Q3: \"1-Click Quick Fix code me kaise apply hota hai?\"",
            "<b>Answer:</b> Maine ek custom difference extraction function (`getChangedTokenInfo()`) likha hai. "
            "Yeh function original error line aur corrected line ke prefix aur suffix invariants compute karke faulty token ko isolate karta hai aur React workspace ke state me atomic replacement perform karta hai."
        ),
        (
            "Q4: \"Backend aur Frontend alag alag cloud par kyu deploy kiye?\"",
            "<b>Answer:</b> Sir, yeh standard industry Microservices Pattern hai. React frontend static assets Vercel Edge CDN par sub-50ms latency se serve hote hain, "
            "jabki backend ko child process execution ke liye ek persistent Linux environment chahiye jo Render provide karta hai. Dono HTTPS REST API aur CORS security se connected hain."
        ),
        (
            "Q5: \"Iska UI LeetCode jaisa kyu dikhta hai?\"",
            "<b>Answer:</b> Sir, LeetCode competitive programming ka industry standard hai. Developer ko coding karte waqt flashy neon lights ya AI animation se distraction nahi chahiye. "
            "Isliye maine dark graphite theme (`#1a1a1a`), solid green action button, aur split layout use kiya hai jo 100% professional developer tool lagta hai."
        )
    ]

    for q, a in qa_list:
        qa_data = [
            [Paragraph(f"<b>{q}</b>", body_style)],
            [Paragraph(a, body_style)]
        ]
        qa_table = Table(qa_data, colWidths=[515])
        qa_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F1EF')),
            ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#FFFFFF')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E9E9E7')),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(qa_table)
        story.append(Spacer(1, 8))

    # Build PDF with custom canvas for page numbers
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"SUCCESS: Generated {pdf_path}")

if __name__ == '__main__':
    build_pdf()
