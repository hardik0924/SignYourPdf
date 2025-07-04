
# 📄 SignBuddy — Frontend

A modern, responsive web app to securely sign PDF documents online. Inspired by iLovePDF’s Sign PDF tool — built with **React**, **Vite**, and **Supabase**.

## 📸 Features

- 📄 Upload PDF documents
- ✍️ Create signatures (typed/drawn)
- 🖱️ Drag and drop signatures onto PDF
- 📥 Download signed PDFs
- 🔐 JWT-based user authentication
- ⚡ Fast PDF rendering using `react-pdf`
- 💾 Files stored securely with Supabase Storage

## 🚀 Tech Stack

- **React** + **Vite**
- **react-router-dom** for routing
- **react-pdf** for PDF rendering
- **react-draggable** for signature positioning
- **Tailwind CSS** for modern styling
- **Supabase** for auth, database, and storage
- **pdf-lib** via Supabase Edge Functions

## 📦 Installation

1️⃣ Clone the repo:
```bash
git clone https://github.com/hardik0924/SignBuddy
cd frontend
```

2️⃣ Install dependencies:
```bash
npm install
```

3️⃣ Create `.env` file:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4️⃣ Run development server:
```bash
npm run dev
```

## 🌐 Deployment

Deploy easily to **Vercel**:
- Push frontend folder to a new GitHub repo.
- Connect repo on vercel.com
- Set environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Deploy 🎉

## 📑 License

MIT
