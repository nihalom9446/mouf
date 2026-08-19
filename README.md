# Mouf Media - LED Video Wall Solutions & Production

Premium, full-stack website and administrative platform for **Mouf Media**, providing state-of-the-art LED Video Wall rentals, stage production, and sales across Kerala and South India.

---

## 🚀 Features

- **Public Showcase & Gallery**:
  - Full-screen Hero presentations with glassmorphic aesthetics.
  - Interactive Project Showcase with **Click-to-Expand Lightbox** & **Instant WhatsApp Inquiry** pre-fill engine.
  - Dynamic Rental Cost Estimator with real-time square footage & pixel pitch calculator.
  - Lead Generation & Contact form syncing with Google Sheets / Form fallbacks and Meta WhatsApp Cloud API triggers.
  - Fully mobile-responsive bottom sheet modals and glassmorphic drawer navigation.

- **Admin Portal (`/admin.html`)**:
  - Secure PBKDF2 / SHA-512 authentication system.
  - **Leads & Inquiries CRM**: 1-click WhatsApp/Call actions, status workflows (`New`, `Contacted`, `Converted`, `Archived`), search, and CSV export.
  - **Portfolio Manager**: Live project management with direct server photo uploads and public sync.
  - **Site Settings & Security**: Real-time management of contact numbers, WhatsApp numbers, email addresses, and admin credentials.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, Modern CSS3 (Glassmorphism, CSS Grid, Fluid Typography), Vanilla JavaScript (ES6+).
- **Backend**: Node.js HTTP Server (`server.js`) with RESTful API endpoints.
- **Data Persistence**: Atomic JSON Storage Engine (`services/storage.js`).
- **Integrations**: Meta WhatsApp Cloud API service, Google Forms endpoint sync.

---

## 📦 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
# Or: node server.js
```
The server will start at `http://localhost:3000`.
