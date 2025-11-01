# ToolsZilla One-Click Proxy - Flaticon

Premium access proxy system for Flaticon.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

### 3. Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Add the output to `.env` as `COOKIE_ENCRYPTION_KEY`

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Production Server
```bash
npm start
```

## 📁 Project Structure
```
toolszilla-oneclick/
├── src/
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── routes/           # API routes
│   ├── utils/            # Helpers
│   └── views/            # HTML templates
├── products/             # Product configs
├── storage/              # Cache & logs
├── .env                  # Environment variables
└── server.js             # Entry point
```

## 🔧 Available Scripts

- `npm start` - Run production server
- `npm run dev` - Run development server with auto-reload

## 🌐 Endpoints

- `http://localhost:8224/` - Flaticon proxy
- `http://localhost:8224/check-session` - Validate session
- `http://localhost:8224/expired` - Session expired page
- `http://localhost:8224/admin/cookies-refresh?key=YOUR_KEY` - Clear cache

## 📝 Environment Variables

See `.env.example` for all required variables.

## 🔐 Security

- All user cookies are encrypted using AES-256-CBC
- Sessions expire after 1 hour
- Download limits enforced per user plan
- Banned paths cannot be accessed

## 📊 Download Limits

- Trial: 2 downloads/day
- Default: 20 downloads/day
- Pro: 50 downloads/day
- Premium: 100 downloads/day

## 🐛 Troubleshooting

### Cache Issues
Clear all caches:
```bash
curl "http://localhost:8224/admin/cookies-refresh?key=YOUR_SECRET_KEY"
```

### Session Expired
Sessions expire after 1 hour. Users need to log in again.

### Port Already in Use
Change `PORT` in `.env` file.

## 📄 License

Proprietary - ToolsZilla