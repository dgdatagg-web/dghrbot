#!/bin/bash
# standup.sh <morning|afternoon|eod>
# Nova auto standup — pulls real data from WillOS DB, posts via openclaw CLI

DB="/Users/dongocminh/.openclaw/workspace/willos/data/willos.db"
MODE=${1:-morning}
TODAY=$(TZ=Asia/Saigon date +%Y-%m-%d)
DATE_DISPLAY=$(TZ=Asia/Saigon date '+%d/%m/%Y')
TIME_DISPLAY=$(TZ=Asia/Saigon date '+%H:%M')

# Query DB — dùng đúng column names từ grab_sales_daily
LATEST_DATE=$(sqlite3 "$DB" "SELECT date FROM grab_sales_daily ORDER BY date DESC LIMIT 1;" 2>/dev/null || echo "N/A")
LATEST_GROSS=$(sqlite3 "$DB" "SELECT CAST(gross_sales AS INTEGER) FROM grab_sales_daily ORDER BY date DESC LIMIT 1;" 2>/dev/null || echo "0")
LATEST_TXN=$(sqlite3 "$DB" "SELECT num_transactions FROM grab_sales_daily ORDER BY date DESC LIMIT 1;" 2>/dev/null || echo "0")
PENDING_ALERTS=$(sqlite3 "$DB" "SELECT count(*) FROM exp_alerts WHERE resolved=0;" 2>/dev/null || echo "0")
SHIFT_TODAY=$(sqlite3 "$DB" "SELECT count(*) FROM shift_report WHERE date='$TODAY';" 2>/dev/null || echo "0")

# EXP Top 3 — join staff + staff_exp
WEEKLY_TOP=$(sqlite3 "$DB" "SELECT s.name || ' +' || se.weekly_xp || ' XP' FROM staff_exp se JOIN staff s ON s.id=se.staff_id ORDER BY se.weekly_xp DESC LIMIT 1;" 2>/dev/null || echo "N/A")
WEEKLY_2=$(sqlite3 "$DB" "SELECT s.name || ' +' || se.weekly_xp || ' XP' FROM staff_exp se JOIN staff s ON s.id=se.staff_id ORDER BY se.weekly_xp DESC LIMIT 1 OFFSET 1;" 2>/dev/null || echo "N/A")
WEEKLY_3=$(sqlite3 "$DB" "SELECT s.name || ' +' || se.weekly_xp || ' XP' FROM staff_exp se JOIN staff s ON s.id=se.staff_id ORDER BY se.weekly_xp DESC LIMIT 1 OFFSET 2;" 2>/dev/null || echo "N/A")

# Format revenue
GROSS_FMT=$(python3 -c "
n=int('${LATEST_GROSS:-0}')
if n >= 1000000:
    print(f'{n/1000000:.1f}M₫')
else:
    s = f'{n:,}'.replace(',','.')
    print(f'{s}đ')
" 2>/dev/null || echo "${LATEST_GROSS}đ")

if [ "$MODE" = "morning" ]; then
MSG="🌅 MORNING STANDUP — $DATE_DISPLAY

📊 Grab gần nhất: $LATEST_DATE
💰 Revenue: $GROSS_FMT ($LATEST_TXN đơn)

🏆 Weekly EXP Top 3:
  1. $WEEKLY_TOP 👑
  2. $WEEKLY_2
  3. $WEEKLY_3

📋 Checklist hôm nay:
• 🍱 Bếp: Hiếu/Tân báo ca theo template
• 📦 Kho: Chi check đơn nhập nếu có
• 🍹 Bar & 🎱 Bida: Bety/Thư log ca qua HR Bot

⚠️ Alerts pending: $PENDING_ALERTS
📱 Dashboard: localhost:3333"

elif [ "$MODE" = "afternoon" ]; then
MSG="☀️ AFTERNOON CHECK — $TIME_DISPLAY $DATE_DISPLAY

🍱 Bếp: $SHIFT_TODAY ca báo hôm nay
💰 Grab ($LATEST_DATE): $GROSS_FMT — $LATEST_TXN đơn
⚠️ Alerts pending: $PENDING_ALERTS

→ Ca chiều đang chạy. Nova monitoring."

else
MSG="🌙 EOD SUMMARY — $DATE_DISPLAY

🍱 Kansai Osaka: $SHIFT_TODAY ca báo hôm nay
💰 Grab ($LATEST_DATE): $GROSS_FMT — $LATEST_TXN đơn
🍹 Bar + 🎱 Bida: theo dõi qua HR Bot

🏆 Weekly leader: $WEEKLY_TOP
⚠️ Alerts tồn đọng: $PENDING_ALERTS

→ Dashboard: localhost:3333
Nova out 🌙"
fi

# Post vào topic 172 (Kansai Osaka + Daily Standup — merged)
/opt/homebrew/bin/openclaw message send \
  --channel telegram \
  --target "-1003827938422" \
  --thread-id "172" \
  --message "$MSG"

echo "Standup [$MODE] posted to #172: $DATE_DISPLAY $TIME_DISPLAY"
