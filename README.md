# 🚗 Honda WhatsApp Test Drive Booking Bot

A **production-ready AI-powered WhatsApp chatbot** for booking Honda car test drives. Built with Node.js, Groq (Mistral), WhatsApp Cloud API, and MongoDB.

---

## ✨ Features

- 🤖 **AI-powered conversations** via Groq API + Mistral model
- 💬 **Hinglish support** — understands "kal sham mein", "parso", "weekend slot hai?"
- 📅 **Smart date parsing** — natural language → validated booking date
- ⏰ **Slot management** — real-time availability with capacity limits
- 🔄 **Session persistence** — resume conversations if user returns
- 🔒 **Double-booking prevention** — atomic slot checks
- 📊 **Admin dashboard API** — view bookings, stats, manage slots
- 🎫 **Booking IDs** — unique IDs like `HB-A1B2C3D4`
- 🐳 **Docker-ready** — production Dockerfile + Compose included

---

## 🏗️ Architecture

```
WhatsApp Cloud API
      │
      ▼
  POST /webhook ──► conversationController.js
      │                    │
      │              sessionService.js ──► MongoDB (Sessions)
      │              groqService.js    ──► Groq API (Mistral)
      │              bookingService.js ──► MongoDB (Bookings)
      │              whatsappService.js ──► WhatsApp API (send reply)
      │
  GET  /webhook ──► Webhook Verification (Meta)
  GET  /admin/* ──► Admin REST API
  GET  /health  ──► Health Check
```

### Conversation State Machine

```
INIT
  │
  ▼
COLLECTING_NAME
  │
  ▼
COLLECTING_CITY
  │
  ▼
COLLECTING_MODEL
  │
  ▼
COLLECTING_DATE
  │
  ▼
COLLECTING_SLOT
  │
  ▼
CONFIRMING
  │
  ▼
COMPLETED
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd honda-whatsapp-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 3. Run Locally

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

### 4. Run with Docker

```bash
docker-compose up -d
```

---

## ⚙️ Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port (default: 3000) | No |
| `MONGODB_URI` | MongoDB connection string | ✅ Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | From Meta Developer Console | ✅ Yes |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta Business Account ID | ✅ Yes |
| `WHATSAPP_ACCESS_TOKEN` | Permanent WhatsApp access token | ✅ Yes |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Custom string you define for webhook verification | ✅ Yes |
| `WHATSAPP_API_VERSION` | WhatsApp API version (default: v19.0) | No |
| `GROQ_API_KEY` | API key from console.groq.com | ✅ Yes |
| `ADMIN_SECRET_KEY` | Secret key for admin API | ✅ Yes |
| `MAX_BOOKING_DAYS_AHEAD` | Max days ahead for booking (default: 7) | No |
| `SLOT_CAPACITY` | Max bookings per time slot (default: 3) | No |
| `DEALERSHIP_NAME` | Your dealership name | No |

---

## 📡 WhatsApp Webhook Setup

### Step 1: Get your credentials from Meta

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an App → Business → WhatsApp
3. Get your `Phone Number ID` and `Access Token`
4. Set up a permanent token via Meta Business Suite

### Step 2: Expose your server (local dev)

Use [ngrok](https://ngrok.com) to expose your local server:

```bash
ngrok http 3000
# Note the https URL, e.g. https://abc123.ngrok.io
```

### Step 3: Register webhook in Meta Developer Console

- **Callback URL:** `https://your-domain.com/webhook`
- **Verify Token:** Must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env`
- **Subscribed fields:** `messages`

### Step 4: Verify

Meta will send a GET request to your webhook. If the token matches, it returns a 200 with the challenge and verification is complete.

---

## 🤖 Conversation Flow Example

```
User:  Hi
Bot:   🚗 Welcome to Honda India! I'm your Honda Assistant...
       May I know your full name?

User:  Rahul Sharma
Bot:   Nice to meet you, Rahul! 😊
       Which city are you located in?

User:  Mumbai
Bot:   📍 Mumbai — noted!
       Which Honda model would you like to test drive?
       1️⃣ Honda City
       2️⃣ Honda Amaze
       3️⃣ Honda Elevate

User:  City
Bot:   🚗 Honda City — excellent choice!
       Which date would you prefer?

User:  kal sham mein available hai?
Bot:   📅 Available slots for Tomorrow, 27 March 2026:
       1. ⏰ 04:00 PM - 05:00 PM (3 spots left)
       2. ⏰ 05:00 PM - 06:00 PM (2 spots left)

User:  4 baje
Bot:   ✅ Please confirm your booking:
       👤 Name: Rahul Sharma
       🏙️ City: Mumbai
       🚗 Model: Honda City
       📅 Date: Friday, 27 March 2026
       ⏰ Time: 04:00 PM - 05:00 PM
       [✅ Confirm] [❌ Cancel]

User:  [Confirm]
Bot:   🎉 Test Drive Booked Successfully!
       🔖 Booking ID: HB-3F7A9C12
       ...
```

---

## 🌐 API Reference

### Webhook Endpoints

#### `GET /webhook`
WhatsApp verification challenge.

**Query params:**
- `hub.mode` — must be `subscribe`
- `hub.verify_token` — must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `hub.challenge` — returned as-is on success

**Response:** `200 OK` with challenge string

---

#### `POST /webhook`
Receives incoming WhatsApp messages.

**Headers:** `Content-Type: application/json`

**Response:** `200 OK` with `EVENT_RECEIVED` (always fast — processing is async)

**Example payload:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "919876543210",
          "id": "wamid.xxxx",
          "timestamp": "1710000000",
          "type": "text",
          "text": { "body": "Hello" }
        }],
        "contacts": [{ "profile": { "name": "Rahul Sharma" } }]
      }
    }]
  }]
}
```

---

### Admin API Endpoints

All admin endpoints require the header: `x-admin-key: <ADMIN_SECRET_KEY>`

#### `GET /admin/bookings`
List all bookings.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `date` | string | Filter by date (YYYY-MM-DD) |
| `status` | string | `confirmed`, `cancelled`, `completed` |
| `city` | string | Filter by city (partial match) |
| `model` | string | Filter by car model |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response:**
```json
{
  "success": true,
  "bookings": [
    {
      "bookingId": "HB-3F7A9C12",
      "customerName": "Rahul Sharma",
      "customerPhone": "919876543210",
      "city": "Mumbai",
      "carModel": "Honda City",
      "testDriveDate": "2026-03-27",
      "timeSlot": "16:00",
      "status": "confirmed",
      "createdAt": "2026-03-26T10:30:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "totalPages": 3
}
```

---

#### `GET /admin/bookings/:bookingId`
Get single booking details.

**Response:**
```json
{
  "success": true,
  "booking": {
    "bookingId": "HB-3F7A9C12",
    "customerName": "Rahul Sharma",
    "slotLabel": "04:00 PM - 05:00 PM",
    ...
  }
}
```

---

#### `PATCH /admin/bookings/:bookingId`
Update booking status or notes.

**Body:**
```json
{
  "status": "completed",
  "notes": "Customer arrived, test drive completed"
}
```

---

#### `DELETE /admin/bookings/:bookingId`
Cancel a booking.

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled"
}
```

---

#### `GET /admin/stats`
Dashboard statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 120,
    "todayCount": 8,
    "confirmed": 95,
    "cancelled": 25,
    "modelStats": [
      { "_id": "Honda City", "count": 52 },
      { "_id": "Honda Elevate", "count": 41 },
      { "_id": "Honda Amaze", "count": 27 }
    ]
  }
}
```

---

#### `GET /admin/slots?date=YYYY-MM-DD`
View slot availability for a date.

**Response:**
```json
{
  "success": true,
  "date": "2026-03-27",
  "slots": [
    {
      "id": "10:00",
      "display": "10:00 AM - 11:00 AM",
      "booked": 2,
      "capacity": 3,
      "available": true,
      "spotsLeft": 1
    },
    {
      "id": "11:00",
      "display": "11:00 AM - 12:00 PM",
      "booked": 3,
      "capacity": 3,
      "available": false,
      "spotsLeft": 0
    }
  ]
}
```

---

#### `GET /health`
Health check.

**Response:**
```json
{
  "status": "ok",
  "service": "Honda WhatsApp Booking Bot",
  "timestamp": "2026-03-26T10:00:00.000Z",
  "uptime": 3600.5
}
```

---

## 🗄️ Database Schema

### Booking Collection

```js
{
  bookingId: "HB-3F7A9C12",          // Unique booking reference
  customerPhone: "919876543210",      // WhatsApp number
  customerName: "Rahul Sharma",
  city: "Mumbai",
  carModel: "Honda City",             // Enum: Honda City, Amaze, Elevate
  testDriveDate: "2026-03-27",        // ISO date string
  timeSlot: "16:00",                  // Slot ID
  status: "confirmed",                // confirmed | cancelled | completed
  notes: "",
  createdAt: "2026-03-26T10:30:00Z",
  updatedAt: "2026-03-26T10:30:00Z"
}
```

### Session Collection (auto-expires in 24h)

```js
{
  phoneNumber: "919876543210",
  state: "COLLECTING_SLOT",           // Current conversation state
  data: {
    name: "Rahul Sharma",
    city: "Mumbai",
    carModel: "Honda City",
    testDriveDate: "2026-03-27",
    testDriveDateDisplay: "Friday, 27 March 2026",
    timeSlot: null,
    timeSlotDisplay: null
  },
  conversationHistory: [              // Last 20 messages for AI context
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Welcome to Honda..." }
  ],
  completedBookingId: null,
  lastMessageAt: "2026-03-26T10:30:00Z"
}
```

---

## 🛡️ Security

- **Helmet.js** — sets secure HTTP headers
- **Rate limiting** — 500 req/15min globally, 100 req/15min for admin
- **Admin auth** — `x-admin-key` header required on all admin routes
- **Non-root Docker** — container runs as `nodeapp` user
- **Env validation** — server won't start if required vars are missing
- **Graceful shutdown** — handles SIGTERM/SIGINT cleanly

---

## 📦 Project Structure

```
honda-whatsapp-bot/
├── src/
│   ├── server.js                  # Entry point
│   ├── app.js                     # Express setup
│   ├── config/
│   │   ├── constants.js           # Honda models, time slots, states
│   │   └── database.js            # MongoDB connection
│   ├── controllers/
│   │   └── conversationController.js  # Main chatbot logic + state machine
│   ├── models/
│   │   ├── Booking.js             # Booking schema
│   │   └── Session.js             # Session schema
│   ├── routes/
│   │   ├── webhook.js             # WhatsApp webhook endpoints
│   │   └── admin.js               # Admin REST API
│   ├── services/
│   │   ├── groqService.js         # Groq + Mistral AI
│   │   ├── whatsappService.js     # WhatsApp Cloud API
│   │   ├── bookingService.js      # Booking CRUD + slot logic
│   │   └── sessionService.js      # Session state management
│   ├── middleware/
│   │   └── errorHandler.js        # Global error + 404 handler
│   ├── utils/
│   │   ├── logger.js              # Winston logger
│   │   ├── dateUtils.js           # Natural language date parsing
│   │   └── messageTemplates.js    # WhatsApp message strings
│   └── __tests__/
│       ├── dateUtils.test.js
│       └── messageTemplates.test.js
├── Dockerfile
├── docker-compose.yml
├── jest.config.js
├── package.json
├── .env.example
└── .gitignore
```

---

## 🧪 Running Tests

```bash
npm test
npm test -- --coverage
```

---

## 🚢 Production Deployment

### On a VPS / EC2

```bash
# Install PM2
npm install -g pm2

# Start
pm2 start src/server.js --name honda-bot

# Auto-restart on reboot
pm2 startup
pm2 save
```

### On Railway / Render / Fly.io

1. Push code to GitHub
2. Connect repo to platform
3. Set all environment variables from `.env.example`
4. Deploy — the platform auto-detects `npm start`

### On Docker

```bash
docker build -t honda-bot .
docker run -d \
  --env-file .env \
  -p 3000:3000 \
  --name honda-bot \
  honda-bot
```

---

## 📝 License

MIT — free to use and modify for commercial projects.
