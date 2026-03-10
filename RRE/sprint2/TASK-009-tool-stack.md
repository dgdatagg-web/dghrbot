# TASK-009 — Tool Stack Map: Kế Toán SME Vertical
## Project: Rat Race Escape — Sprint 2

---

## 1. TOOL STACK OVERVIEW

| Tool | Mục đích | Chi phí/tháng | Vietnam Compatibility |
|------|----------|---------------|----------------------|
| **Google Gemini 1.5 Flash / GPT-4o mini** | OCR hóa đơn, phân loại giao dịch, trả lời tax Q&A | $10-20 (API) | ✅ Tốt — API global |
| **Make.com (Integromat)** | Automation workflow engine, kết nối các tool | $9-29 | ✅ Tốt — dùng được VN |
| **Google Drive / Sheets** | Storage hóa đơn, data staging, template báo cáo | Free / $6 (Workspace) | ✅ Tốt |
| **MISA SME / MISA Accounting** | Core accounting software | Đã có (client trả) | ✅ Native VN |
| **Zalo OA** | Kênh chatbot trả lời tax Q&A cho client | Free (OA) + API cost | ✅ Native VN — critical |
| **Botpress / n8n (self-hosted)** | Chatbot engine + workflow automation | Free / $20 | ✅ Tốt |
| **Docparser / Nanonets** | OCR chuyên biệt cho hóa đơn VAT Việt Nam | $30-49 | ⚠️ Cần test với format VN |
| **Notion / Google Docs** | Knowledge base cho tax chatbot | Free | ✅ Tốt |
| **Lark / Google Meet** | Communication nội bộ + client | Free | ✅ Tốt |
| **Airtable** | Database trung gian, tracking client tasks | $10-20 | ✅ Tốt |

**Lưu ý về MISA:**
- MISA SME và MISA Accounting **không có public API** đầy đủ → workaround chính là **Excel import**
- MISA hỗ trợ import danh sách giao dịch, hóa đơn, và sổ cái qua file `.xlsx` đúng template
- Tất cả workflow dưới đây đều design around MISA Excel import — không cần hack hay third-party connector

---

## 2. USE CASE #1: Auto-Categorize Transactions → P&L Tự Động

### Pain point
Kế toán phải ngồi phân loại từng giao dịch ngân hàng vào đúng tài khoản kế toán (TK 511, 641, 811...) → mất 3-5 giờ/client/tháng, dễ nhầm.

### Tools
- **Google Sheets** — nhận bank statement export (CSV từ ngân hàng)
- **Make.com** — trigger workflow khi có file mới
- **GPT-4o mini API** — phân loại giao dịch theo mô tả
- **Google Sheets** — ghi kết quả phân loại + generate P&L template
- **MISA** — import file đã phân loại

### Workflow Chi Tiết

```
Bước 1: Kế toán download sao kê ngân hàng (CSV/Excel) → upload vào Google Drive folder của client

Bước 2: Make.com detect file mới trong folder → parse dữ liệu giao dịch

Bước 3: Với mỗi dòng giao dịch → gọi GPT-4o mini:
  Prompt: "Phân loại giao dịch sau vào tài khoản kế toán VN (Thông tư 133/TT-BTC):
  Mô tả: [nội dung chuyển khoản]
  Số tiền: [amount]
  → Trả về: Tài khoản nợ, Tài khoản có, Diễn giải ngắn"

Bước 4: Kết quả ghi vào Google Sheets theo template MISA import

Bước 5: Kế toán review nhanh (flag những dòng confidence thấp)
  → Approve → Export file Excel → Import vào MISA

Bước 6: Google Sheets tự động tổng hợp P&L theo tháng từ data đã phân loại
  → Gửi email/Zalo tự động cho owner của client
```

### Thời Gian Tiết Kiệm
| Trước | Sau |
|-------|-----|
| 3-5 giờ/client/tháng phân loại thủ công | 20-30 phút/client/tháng (chỉ review + approve) |
| **Với 25 client → ~100 giờ/tháng** | **→ ~12 giờ/tháng** |
| **Tiết kiệm: ~88 giờ/tháng** | |

---

## 3. USE CASE #2: OCR Hóa Đơn + Tự Động Nhập Vào MISA

### Pain point
Nhân viên nhập từng dòng hóa đơn VAT từ ảnh/PDF vào MISA → sai nhiều, chậm, mất ~2 phút/hóa đơn.

### Tools
- **Zalo / Telegram / Google Drive** — kênh nhận ảnh hóa đơn từ client
- **Make.com** — trigger khi có ảnh/PDF mới
- **Gemini 1.5 Flash API** (Vision) hoặc **Nanonets** — OCR hóa đơn
- **Google Sheets** — staging area + validation
- **MISA** — import qua file Excel template

### Workflow Chi Tiết

```
Bước 1: Client chụp ảnh hóa đơn → gửi vào Zalo OA hoặc Google Drive folder riêng

Bước 2: Make.com detect ảnh mới → gọi Gemini Vision API:
  Prompt: "Trích xuất từ hóa đơn VAT Việt Nam sau:
  - Tên người bán, MST người bán
  - Tên người mua, MST người mua
  - Số hóa đơn, ngày hóa đơn, ký hiệu
  - Mô tả hàng hóa/dịch vụ
  - Đơn giá, số lượng, thành tiền, VAT%, tiền thuế
  - Tổng cộng
  → Trả về JSON"

Bước 3: JSON → validate (check MST hợp lệ, số tiền khớp, format ngày đúng)
  → Flag lỗi nếu có → notify kế toán để check thủ công

Bước 4: Data sạch → ghi vào Google Sheets theo MISA import template
  (Template: Ngày, Số HĐ, Tên NCC, MST, Mô tả, TK Nợ, TK Có, Số tiền, VAT)

Bước 5: Cuối ngày / cuối tuần → kế toán mở Sheets → review batch → export Excel
  → MISA: Mua hàng > Nhập từ Excel

Bước 6: Hóa đơn gốc lưu tự động vào Google Drive theo cấu trúc:
  /[Năm]/[Tháng]/[MST Client]/[Số HĐ].jpg
```

### MISA Integration Approach
```
MISA không có API nhận hóa đơn trực tiếp → dùng Excel Import:
- MISA SME: Danh mục > Hàng tồn kho/Dịch vụ > Import
- MISA Accounting: Nghiệp vụ > Mua hàng > Nhập từ Excel
- Template chuẩn: tải từ MISA, map fields vào Google Sheets

Tần suất import: 1 lần/ngày (cuối ngày) hoặc 1 lần/tuần tùy client
```

### Thời Gian Tiết Kiệm
| Trước | Sau |
|-------|-----|
| ~2 phút/hóa đơn nhập thủ công | ~15 giây/hóa đơn (chỉ review) |
| 25 client × 50 HĐ/tháng = 1,250 HĐ → ~42 giờ/tháng | → ~5 giờ/tháng |
| **Tiết kiệm: ~37 giờ/tháng** | |

---

## 4. USE CASE #3: AI Chatbot Trả Lời Câu Hỏi Thuế Cho Client

### Pain point
Client liên tục hỏi: "Hóa đơn này có được khấu trừ không?", "Tháng này nộp thuế ngày mấy?", "Cách tính thuế TNCN như thế nào?" → kế toán mất 30-60 phút/ngày trả lời WhatsApp/Zalo.

### Tools
- **Zalo OA** (Official Account) — kênh chat với client, miễn phí setup
- **n8n (self-hosted)** hoặc **Botpress** — chatbot engine
- **OpenAI API / Gemini API** — LLM backbone
- **Notion hoặc Google Docs** — knowledge base
- **Make.com** — escalation workflow (bot → người)

### Workflow Chi Tiết

```
Bước 1: Setup Knowledge Base
  Nội dung cần có:
  - Thông tư 78/2014, Luật Thuế TNDN, Luật Thuế VAT (text extract)
  - FAQ nội bộ: top 50 câu hỏi kế toán SME thường gặp
  - Lịch nộp thuế hằng tháng/quý/năm
  - Quy định hóa đơn điện tử 2024-2025
  
  Format: Google Docs → chunked → embedded vào vector store (có thể dùng OpenAI Assistants API hoặc simple RAG)

Bước 2: Zalo OA Webhook → n8n
  - Client gửi tin nhắn vào Zalo OA của văn phòng kế toán
  - n8n nhận webhook → classify intent:
    a) Câu hỏi thuế/kế toán → gọi LLM + RAG knowledge base
    b) Hỏi về file/hóa đơn cụ thể → escalate sang kế toán
    c) Lịch hẹn / khác → escalate

Bước 3: LLM generate response
  System prompt: "Bạn là trợ lý kế toán thuế cho [Tên văn phòng].
  Trả lời ngắn gọn, chính xác, bằng tiếng Việt. 
  Nếu không chắc chắn 100%, nói rõ và đề nghị hỏi kế toán.
  Luôn cite nguồn (Thông tư/Nghị định) nếu có."
  
  RAG: search knowledge base → đưa context vào prompt

Bước 4: Response gửi về Zalo OA → client nhận
  → Log câu hỏi + câu trả lời vào Google Sheets để kế toán review

Bước 5: Escalation
  - Nếu bot confidence thấp → "Câu hỏi này cần kế toán tư vấn trực tiếp. 
    Mình sẽ chuyển cho [Tên kế toán] và họ sẽ trả lời trong [X giờ]."
  - Notify kế toán qua Zalo nội bộ + ghi ticket vào Airtable
```

### Knowledge Base Setup (Week 1)
```
Phase 1 — Quick win (ngày 1-3):
- 50 câu hỏi FAQ + câu trả lời mẫu (kế toán viết)
- Lịch nộp thuế cả năm
- Danh sách tài liệu cần nộp phổ biến

Phase 2 — Deep knowledge (ngày 4-7):
- Extract text từ các Thông tư chính (78/2014, 96/2015, 45/2021...)
- Chunk + embed vào vector store
- Test với 20 câu hỏi thực tế

Phase 3 — Ongoing:
- Kế toán review log hằng tuần → thêm câu trả lời tốt vào KB
- Update khi có Thông tư/Nghị định mới
```

### Thời Gian Tiết Kiệm
| Trước | Sau |
|-------|-----|
| 30-60 phút/ngày trả lời chat | 5-10 phút/ngày (chỉ review escalated cases) |
| ~15-20 giờ/tháng | ~2-3 giờ/tháng |
| **Tiết kiệm: ~15 giờ/tháng** | |
| **Bonus:** Client happy hơn vì được trả lời 24/7 | |

---

## 5. USE CASE #4: Auto-Generate Báo Cáo Tài Chính Tháng

### Pain point
Làm báo cáo tháng cho 25 client mỗi cuối tháng → không có template chuẩn, mỗi client 1 kiểu, mất 2-4 giờ/client.

### Tools
- **MISA** — nguồn dữ liệu gốc (export Excel)
- **Google Sheets** — template báo cáo chuẩn
- **Make.com** — automation pipeline
- **Google Docs** — output báo cáo đẹp (optional)
- **Gmail / Zalo OA** — gửi báo cáo cho client

### Workflow Chi Tiết

```
Bước 1: Template Setup (1 lần)
  Tạo Google Sheets Master Template với:
  - Sheet 1: P&L (Kết quả kinh doanh)
  - Sheet 2: Bảng cân đối kế toán
  - Sheet 3: Lưu chuyển tiền tệ (đơn giản)
  - Sheet 4: KPIs tháng (doanh thu, chi phí, lợi nhuận gộp, % margin)
  - Sheet 5: Chart tự động (doanh thu theo tháng, top 5 chi phí)

Bước 2: MISA Export (cuối tháng)
  Kế toán export từ MISA:
  - Sổ cái tháng → Excel
  - Bảng cân đối phát sinh → Excel
  
  Upload vào Google Drive /[Client]/[Năm]/[Tháng]/raw/

Bước 3: Make.com detect file mới → trigger pipeline:
  - Parse dữ liệu từ MISA export
  - Map vào template Google Sheets của client
  - Tính toán KPIs tự động (margin, MoM growth, top chi phí)
  - Generate chart

Bước 4: Auto-send draft report
  → Kế toán nhận notification: "Báo cáo [Client X] tháng [X] đã sẵn sàng để review"
  → Link trực tiếp đến Google Sheets

Bước 5: Kế toán review 5-10 phút → approve
  → Make.com gửi báo cáo cho client qua Zalo OA hoặc email
  → PDF version đính kèm (Google Docs → PDF auto-export)

Bước 6: Dashboard tổng hợp (optional — tháng 2 trở đi)
  - Google Sheets master dashboard: xem all clients cùng lúc
  - Flag client có margin âm, doanh thu giảm >20% MoM
```

### Template Approach
```
Cấu trúc template cho mỗi client:
/[ClientID]/
  template.gsheet  ← master template (copy cho client mới)
  2025/
    01/ ← tháng 1
      raw/        ← MISA export
      processed/  ← data đã map
      report/     ← báo cáo final
```

### Thời Gian Tiết Kiệm
| Trước | Sau |
|-------|-----|
| 2-4 giờ/client/tháng làm báo cáo | 10-15 phút/client/tháng (review + approve) |
| 25 client → ~75 giờ/tháng | → ~4-6 giờ/tháng |
| **Tiết kiệm: ~70 giờ/tháng** | |

---

## 6. IMPLEMENTATION TIMELINE — 4 Tuần Từ Audit Đến Go-Live

### Tuần 1: Setup Foundation
```
Ngày 1-2: Kickoff + Environment Setup
  - Setup Google Drive folder structure cho all clients
  - Setup Make.com account + basic workflows
  - Setup API keys (OpenAI / Gemini)
  - Install n8n (self-hosted trên VPS $5/tháng) hoặc dùng n8n cloud

Ngày 3-4: MISA Integration Templates
  - Download MISA import templates cho từng loại nghiệp vụ
  - Build Google Sheets templates với đúng column mapping
  - Test import thủ công với 10 hóa đơn test

Ngày 5-7: OCR Pipeline (Use Case #2)
  - Setup Gemini Vision API
  - Build Make.com workflow: Drive → OCR → Sheets → validate
  - Test với 50 hóa đơn thực tế của client
  - Tune prompt để đạt >90% accuracy
```

### Tuần 2: Core Automation
```
Ngày 8-10: Transaction Categorization (Use Case #1)
  - Build categorization prompt với danh sách tài khoản kế toán của client
  - Test với 2-3 tháng bank statement
  - Setup review/approval workflow trong Sheets
  - Kết nối output vào MISA template

Ngày 11-14: Báo Cáo Tự Động (Use Case #4)
  - Build master report template (P&L, CĐKT, KPIs)
  - Build Make.com pipeline: MISA export → Sheets → report
  - Test với 3 client pilot
  - Setup auto-send via email
```

### Tuần 3: Chatbot + Knowledge Base
```
Ngày 15-17: Knowledge Base
  - Thu thập 50 FAQ từ kế toán
  - Extract và chunk 5 Thông tư quan trọng nhất
  - Setup vector store (OpenAI Assistants API hoặc simple)

Ngày 18-21: Zalo OA Chatbot (Use Case #3)
  - Setup Zalo OA cho văn phòng kế toán
  - Connect webhook → n8n → LLM
  - Build intent classification
  - Test với kế toán nội bộ trước
  - Setup escalation flow
```

### Tuần 4: Training + Go-Live
```
Ngày 22-24: Training Team
  - Buổi 1: OCR workflow + MISA import (2 giờ)
  - Buổi 2: Báo cáo tự động + review process (2 giờ)
  - Buổi 3: Chatbot management + KB update (1.5 giờ)
  - Tài liệu SOP ngắn cho từng workflow (1-2 trang/workflow)

Ngày 25-28: Parallel Run
  - Team chạy song song: vừa làm thủ công, vừa chạy automation
  - Track errors, mismatch, edge cases
  - Fix bugs và tune prompts

Ngày 29-30: Cutover
  - Stop manual processes
  - Monitor chặt tuần đầu
  - Daily check-in với team
```

---

## 7. TOTAL COST ESTIMATE

### Chi Phí Tool/Tháng Cho RRE Operate (Per Client)

| Tool | Cost/tháng | Ghi chú |
|------|-----------|---------|
| OpenAI / Gemini API | $15-25 | OCR + categorization + chatbot (25 client) |
| Make.com | $29 | Core tier — 10,000 ops/tháng |
| n8n Cloud | $20 | Hoặc self-hosted VPS ~$5 |
| Google Workspace | $6 | Drive + Sheets + Docs |
| Nanonets (optional) | $49 | Nếu cần OCR chuyên biệt VN invoice |
| Zalo OA | Free | OA miễn phí, chỉ trả API fee |
| VPS (n8n self-hosted) | $5-10 | DigitalOcean / Vultr |
| **TỔNG** | **~$80-139/tháng** | **~2-3.5 triệu VND/tháng** |

### Pricing Cho Client (RRE Charge)

```
Setup Fee (1 lần): 25 triệu VND
  → Bao gồm: setup 4 use cases + training + SOP + 1 tháng support

Retainer (hàng tháng): 6 triệu VND
  → Bao gồm: tool costs (~3M) + labor support (~2M) + margin (~1M)
  → Gross margin retainer: ~50%

ROI cho client (ví dụ 25-client office):
  - Tiết kiệm: ~210 giờ/tháng (tổng 4 use cases)
  - Quy ra lương: ~210 giờ × 80k/giờ = ~16.8 triệu/tháng
  - Chi phí retainer: 6 triệu/tháng
  - Net savings: ~10.8 triệu/tháng
  - Payback setup fee: ~2.3 tháng
```

### Unit Economics Cho RRE (Per Client)

| | Số tiền |
|--|--------|
| Setup fee (1 lần) | 25,000,000 VND |
| Monthly retainer | 6,000,000 VND |
| Tool cost/tháng | ~3,000,000 VND |
| **Gross margin/tháng** | **~3,000,000 VND (50%)** |
| **LTV (12 tháng)** | **~61,000,000 VND** |

**Mục tiêu Sprint 2:** 5 clients onboarded
→ MRR: 30 triệu/tháng + setup fees 125 triệu one-time

---

## PHỤ LỤC: Tech Notes

### Về MISA Compatibility
- MISA SME 2024: hỗ trợ import Excel cho hóa đơn mua vào, bán ra, sổ cái
- MISA Accounting: tương tự, có thêm module chi phí nâng cao
- **Không dùng**: MISA web-scraping hoặc automating MISA UI (fragile, vi phạm ToS)
- **Recommend**: Luôn dùng Excel import → stable, được MISA hỗ trợ chính thức

### Về Gemini vs GPT-4o cho OCR hóa đơn VN
- Gemini 1.5 Flash: tốt hơn với tiếng Việt có dấu, rẻ hơn ($0.075/1M tokens)
- GPT-4o: accuracy cao hơn một chút nhưng đắt hơn 3-4x
- **Recommendation**: Dùng Gemini Flash cho volume cao, GPT-4o cho edge cases

### Về Zalo OA
- Đăng ký OA miễn phí tại https://oa.zalo.me
- Webhook API miễn phí — chỉ trả khi gửi ZNS (Zalo Notification Service)
- Limit: 150 tin nhắn/ngày miễn phí per OA (đủ cho most cases)
- Nếu cần nhiều hơn: ZNS tier 1 = 500 VND/tin

---

*TASK-009 complete. Tool stack design cho Vietnamese kế toán SME — MISA-first, no-API-hack, practical và deployable trong 4 tuần.*
