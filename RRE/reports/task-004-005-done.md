# TASK-004 — F&B Pain Points Thực Tế (Kansai Osaka)
> Owner: Nova + Kai | Status: ✅ DONE | Date: 2026-03-01

## Source Data
- 90 ngày Grab data (28/11/2025 → 25/02/2026)
- 4,257 đơn | 646M gross | 71 SKUs

## Top 5 Pain Points

### 1. Doanh thu chết vào thứ 2 (-80%)
- Root cause: Không có promotion targeting, không có demand forecasting
- AI fix: Predictive scheduling + auto-push offer thứ 2 sáng qua GrabFood/Zalo

### 2. Không biết món nào đang nuôi sống bếp (real-time)
- Data: Kare Tonkatsu = 21.8% tổng đơn — bếp không biết theo real-time
- AI fix: Auto-generate daily SKU performance report mỗi sáng

### 3. GrabFood fee 14.4% không có chiến lược đối phó
- Data: Gross 646M → Net 554M sau fee
- AI fix: Real-time net margin per SKU → biết push món nào

### 4. Peak 18h-22h nhưng không optimize được
- AI fix: Demand forecast → staffing recommendation

### 5. Không có feedback loop từ order data về menu
- 71 SKUs nhưng chỉ top 5-10 chiếm phần lớn revenue
- AI fix: Monthly SKU health report → kill underperformers

---

# TASK-005 — Niche Scoring Matrix
> Owner: Nova | Status: ✅ DONE | Date: 2026-03-01

## 3 Niche × WTP Matrix

| Criteria | Kế toán/Thuế | Giáo dục | Y tế/Nha khoa |
|----------|:------------:|:--------:|:-------------:|
| Hiểu ROI của AI? | ✅ Cao | 🟡 Trung bình | ✅ Cao |
| Đã quen trả retainer? | ✅ Có | 🟡 Có | ✅ Có |
| Budget | 5-15M/tháng | 3-8M/tháng | 8-15M/tháng |
| Decision maker | Owner trực tiếp | Owner = giáo viên | Bác sĩ = owner |
| Sales cycle | 1-2 tuần | 2-3 tuần | 2-4 tuần |
| Churn risk | Thấp | Trung bình | Thấp |
| Payback period | <30 ngày | 30-60 ngày | <30 ngày |
| WTP Score | **9/10** | **6.5/10** | **8.5/10** |

## Verdict
1. 🥇 Kế toán/Thuế SME — WTP cao nhất, retainer model tự nhiên
2. 🥈 Y tế/Nha khoa — Ticket size lớn nhất
3. 🥉 Giáo dục — Volume lớn, bù bằng số lượng

## GTM
Kế toán/Thuế trước → 3 case studies → close Y tế + Giáo dục song song
