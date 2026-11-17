# 🃏 Card War — เกมการ์ดผจญภัย Turn-based (Web PC + Android PWA)

## ลิขสิทธิ์และข้อจำกัด

สงวนสิทธิ์ทั้งหมด — ห้ามนำไปหารายได้ คัดลอก ทำซ้ำ แจกจ่าย แก้ไข ดัดแปลง
หรือสร้างผลงานต่อยอด โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษรจากเจ้าของลิขสิทธิ์
ดูข้อกำหนดฉบับเต็มใน [LICENSE](LICENSE)
ส่วนประกอบของบุคคลที่สามใช้สัญญาอนุญาตของตนเองตาม [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

เกมการ์ดสาย RPG ที่ทุกอย่างเป็น "การ์ด" — ได้การ์ดจากการขุดเหมือง เก็บของป่า ตีดันเจี้ยน กาชา และคราฟต์
ต่อสู้แบบ Turn-based โดยใช้ **ชาร์ด (Shard)** อัญเชิญการ์ด — เทิร์นละ 2 ชาร์ด
สกิลเวทใช้ **มานา** สกิลกายภาพใช้ **กำลัง** ซึ่งฟื้นต่อเทิร์นตามสเตตัสตัวละคร

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Monorepo | npm workspaces (TypeScript ทั้งหมด) |
| Frontend | React 18 + Vite + Zustand + Socket.io-client + PWA (vite-plugin-pwa) |
| Backend | Node.js + Fastify + Socket.io (real-time PvP) + Prisma ORM |
| Database | SQLite (พัฒนาบนเครื่องได้ทันที — schema ย้ายไป PostgreSQL ได้) |
| Login | Google Sign-In (Google ID Token) — มี dev-login สำหรับตอนพัฒนา |

```
card-war/
├─ packages/shared   โค้ดกลาง: ประเภทการ์ด แค็ตตาล็อก 128 การ์ด มอนสเตอร์ + combat engine + AI
├─ apps/server       REST API + real-time battle manager + ledger เศรษฐกิจปิดวงจร
└─ apps/client       เว็บแอป responsive (desktop / mobile) + PWA ติดตั้งบน Android ได้
```

## เริ่มต้นใช้งาน (Development)

ต้องมี **Node.js 18+**

```bash
npm install            # ติดตั้งทั้ง monorepo
npm run db:push        # สร้างฐานข้อมูล SQLite (apps/server/prisma/dev.db)
npm run db:seed        # ยัดข้อมูลการ์ด 130+ แบบลง DB
npm run icons          # (ทำครั้งเดียวก็พอ) สร้างไอคอน PWA
npm run dev            # รัน server :4000 + client :5173 พร้อมกัน
```

เปิด **http://localhost:5173** — ถ้ายังไม่ตั้ง `GOOGLE_CLIENT_ID` จะเป็น "โหมดพัฒนา"
สามารถกรอกชื่อเข้าเล่นได้เลย (ทดสอบ PvP เปิดแท็บใหม่/หน้าต่างไม่ระบุตัวตน แล้ว login ชื่ออื่น)

### ตัวแปรสภาพแวดล้อม (apps/server/.env)

```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com   # ไม่ตั้ง = dev-login
JWT_SECRET=เปลี่ยนเป็นค่าที่ปลอดภัยใน production
PORT=4000
HOST=0.0.0.0
```

### เปิดใช้ Google Login (production)

1. ไป [Google Cloud Console](https://console.cloud.google.com/) → สร้างโปรเจกต์
2. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins: เพิ่ม `http://localhost:5173` และโดเมน production
5. คัดลอก Client ID ใส่ `GOOGLE_CLIENT_ID` ใน `.env` ของ server แล้ว restart

เมื่อตั้งค่าแล้ว หน้า login จะแสดงปุ่ม "เข้าสู่ระบบด้วย Google" เท่านั้น

### ทดสอบบนมือถือ (Android) ผ่าน WiFi เครื่องพัฒนา

```bash
# client (vite) รันด้วย host อยู่แล้ว — สร้าง .env ใน apps/client:
# VITE_API_URL=http://<IP-เครื่องคุณ>:4000
```

แล้วเปิด `http://<IP-เครื่องคุณ>:5173` จากมือถือ

### Build production (เสิร์ฟจาก server ตัวเดียว)

```bash
npm run build          # build client → apps/client/dist
npm run dev -w apps/server   # หรือ npm start -w apps/server → ให้บริการที่ :4000 รวม PWA
```

## ระบบในเกม (เฟส 1 — ใช้งานได้จริง)

- **เลเวล/สเตตัส/แต้มสเตตัส** — XP จากต่อสู้ เก็บของ คราฟต์ เควสต์ (ไม่มีระบบอาชีพ — ทุกคนเริ่มสเตตัสเท่ากัน สไตล์การเล่นขึ้นกับเดค อุปกรณ์ และการลงแต้มเอง)
- **การ์ด 130+ แบบ 8 กลุ่ม**: อุปกรณ์สวมใส่ 9 ช่อง (อาวุธ ดาบ/คาทา/ธนู + หมวก เกราะ กางเกง รองเท้า ถุงมือ แหวน กำไร ต่างหู), ยา, อาหาร, วัตถุดิบ (แร่ อัญมณี สมุนไพร ไม้ ชิ้นส่วนมอนสเตอร์ วัตถุดิบอาหาร), เครื่องมือ (จอบ/ขวาน), สกิล (เวท/กายภาพ), สัตว์เลี้ยง
- **Real-time PvP** ผ่าน Socket.io — คิวจับคู่ใกล้เรตติ้ง, จับเวลาเทิร์น 60 วิ, Elo rating + ตารางอันดับ, หลุดการเชื่อมต่อมี AI รุดต่อ/ยกให้ชนะใน 30 วิ
- **ดันเจี้ยน 5 ชั้น** มอนสเตอร์ AI + drop การ์ดตามอัตรา
- **เหมือง/ป่า** — ใช้พลังงาน (ฟื้นตามเวลาจริง) ต้องมีเครื่องมือ เครื่องมือเกรดสูง = ของดีขึ้น
- **ร้านกลาง 2 แบบ**: กาชา (สุ่ม mint ใหม่) + ร้านมือสอง (การ์ดที่ผู้เล่นขายคืน ระบบขายต่อ +25%)
- **คราฟต์ 4 สถานี**: อุปกรณ์ (เลือกประเภท + ไม้/แร่กี่ชิ้นก็ได้ สุ่มเกรดตามวัตถุดิบ), แร่แปรธาตุ, ปรุงยา, ทำอาหาร
- **เดคไม่จำกัด** — ใส่กี่ใบก็ได้ การ์ดชนิดเดียวกันซ้ำกี่ใบก็ได้ (มีขั้นต่ำ 10 ใบเพื่อกันเดคเปล่าแพ้ fatigue ทันที)
- **เควสต์รายชั่วโมง** — ทำเสร็จรับรางวัลทันที คูลดาวน์ 1 ชม. แล้วสุ่มใหม่
- **Ledger เศรษฐกิจปิดวงจร** — การ์ดทุกใบมี serial, ทุกการไหลของทอง/การ์ดบันทึกในตาราง Ledger, การ์ดที่ถูกใช้/ทำลาย/ขายกลับ pool ระบบเพื่อ drop/กาชาใหม่ (reuse)

## ระบบเฟส 2 (ใช้งานได้จริงเช่นกัน)

- **🔨 ตลาดประมูลการ์ด** — ตั้งประมูล 6/12/24 ชม., ราคาเริ่ม ≥ ราคาฐานของระบบ, เสนอราคา +10% ต่อครั้ง (เงินวางประกัน ถูกแซงได้เงินคืนอัตโนมัติ), ซื้อทันที, หมดเวลาจัดการอัตโนมัติโดย sweeper ทุก 30 วิ
- **🎯 ขายตรงแบบระบุผู้เล่น** — ผู้รับเท่านั้นเห็นและซื้อได้ (48 ชม.), ราคา ≥ ราคาฐาน
- **ค่าธรรมเนียมตลาด 5% (ขั้นต่ำ 5 ทอง)** ทั้งตอนตั้งขายและตอนขายสำเร็จ — เข้าเป็นภาษี (sink) ของระบบ
- **👥 เพื่อน + ข้อความส่วนตัว** — ส่งคำขอด้วยชื่อตัวละคร (ชื่อห้ามซ้ำ), ตอบรับ/ปฏิเสธ, แชทสองต่อสองอัปเดตอัตโนมัติ (ส่งได้เฉพาะเพื่อน)
- **⚜️ กิลด์** — ตั้งกิลด์ (ค่าธรรมเนียม 1,000 ทอง), เข้าร่วม/ออก/ไล่สมาชิก (หัวกิลด์), แชทกิลด์ สูงสุด 30 คน
- **📌 เควสต์ที่ผู้เล่นสร้างเอง** — ระบุการ์ดที่ต้องการ + จำนวน + รางวัลทอง/ใบ, เงินรางวัลฝากไว้กับระบบ (escrow), ค่าธรรมเนียม 10%, ผู้อื่นส่งมอบการ์ดรับทองทันที การ์ดโอนตรงถึงผู้ตั้ง, ยกเลิกได้คืนเงินคงเหลือ
- **🛠️ แอดมิน** — ตั้ง `ADMIN_EMAILS` ที่ server (อีเมล Google หรือ `dev:ชื่อ`), หน้า /admin ดูสถิติเศรษฐกิจ (mint/burn/ทองหมุนเวียน/ทองเข้า-ออกระบบ), สมุดบัญชี ledger ล่าสุด, ค้นหาผู้เล่น

## ทดสอบอัตโนมัติ

```bash
node scripts/test-battle.mjs   # PvP 2 บอทจบจริง + PvE + รางวัล/Elo (server ต้องรันอยู่)
node scripts/test-phase2.mjs   # ตลาดประมูล/ขายตรง + เพื่อน/แชท + กิลด์ + เควสต์ผู้เล่น + สิทธิ์แอดมิน
```

## ย้ายไป PostgreSQL (production)

โครงสร้าง schema ใช้แบบ field ธรรมดา (JSON เก็บใน String) จึงย้ายได้ทันที
มีสคริปต์สลับให้แล้ว — **ไม่ต้องแก้ schema มือ**:

```bash
# 1) เปิด PostgreSQL (host พอร์ต 5433 กันชนกับ postgres ตัวอื่น)
docker compose up -d

# 2) สลับ prisma เป็น postgres + generate client
node scripts/use-db.mjs postgres

# 3) สร้างตาราง + seed (ทำใน apps/server)
cd apps/server
DATABASE_URL="postgresql://cardwar:cardwar_secret_change_me@localhost:5433/cardwar?schema=public" npx prisma db push
DATABASE_URL="postgresql://cardwar:cardwar_secret_change_me@localhost:5433/cardwar?schema=public" npm run db:seed

# 4) รัน production
DATABASE_URL="postgresql://cardwar:cardwar_secret_change_me@localhost:5433/cardwar?schema=public" npm run start

# กลับไปพัฒนาบน SQLite
node scripts/use-db.mjs sqlite
```

ตัวอย่าง env ทั้งหมดอยู่ใน `apps/server/.env.example`
ทดสอบจริงแล้ว: E2E ทั้งชุด (ประมูล/ขายตรง/เพื่อน+DM/กิลด์/เควสต์ผู้เล่น) ผ่านบนทั้ง SQLite และ PostgreSQL

## ทดสอบ E2E อัตโนมัติ

```bash
node scripts/e2e-phase2.mjs        # 40 checks ครอบคลุมโฟลว์เฟส 2 (ต้องรัน dev server ไว้)
BASE_URL=http://localhost:4100 DATABASE_URL="postgresql://..." node scripts/e2e-phase2.mjs  # กับ PostgreSQL
```

## เฟสที่เห็นว่าน่าทำต่อ (แนวคิด)

- ประมูลแบบ socket เรียลไทม์ (ตอนนี้ polling 10 วิ), presence ออนไลน์, การแจ้งเตือน
- สกิลกิลด์/สงครามกิลด์, อันดับกิลด์, เควสต์กิลด์
- Trading แลกเปลี่ยนการ์ดตรง ๆ 1:1, battle spectator/replay จาก seed ของเอนจิ้น

## โครงสร้าง combat engine

กติกาอยู่ใน `packages/shared/src/engine/battle.ts` (pure functions ใช้ร่วมกันทั้ง client และ server —
server เป็นผู้ตัดสิน, client ใช้ตรวจ "เล่นได้ไหม" ล่วงหน้า):

- เปิดมือ 6 ใบ → จั่ว 1 ใบ/เทิร์น (มือไม่จำกัดจำนวนใบ)
- เทิร์นละ 3 ชาร์ด + ฟื้นมานา/กำลังตามสเตตัส
- **การ์ดโจมตี (กายภาพ/เวท) ใช้ได้ 1 ใบต่อเทิร์น** — การ์ดโล่/รักษา/บัฟ/พิษ/สัตว์เลี้ยง/ยา ไม่จำกัดจำนวน
- **สกิลป้องกัน (โล่) เล่นได้ทั้งเทิร์นตัวเอง และ "ตั้งรับ" ระหว่างเทิร์นศัตรู** (ใช้ชาร์ด/กำลังคงเหลือจากเทิร์นก่อน) — สกิลชนิดอื่นใช้ได้เฉพาะเทิร์นตัวเอง
- ดาเมจ = (พลังการ์ด + โจมตี/เวทตัวละคร) − ป้องกัน×0.6 (สุ่มแกว่ง ±10%)
- มี Heal / Shield / Poison / Buff / สัตว์เลี้ยงโจมตีทุกเทิร์น
- เดคหมด = บาดเจ็บสะสมจาก fatigue ที่หนักขึ้นเรื่อย ๆ / ไม่จำกัดจำนวนเทิร์น
- เดคไม่จำกัดจำนวนใบ และซ้ำได้ไม่จำกัด (ขั้นต่ำ 10 ใบเพื่อเข้าต่อสู้)
