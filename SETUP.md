# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
\`\`\`bash
npm install
\`\`\`

### Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to SQL Editor and paste the contents of \`supabase-schema.sql\`
4. Click "Run" to create the database schema
5. Go to Database → Replication and enable it for the \`messages\` table
6. Go to Project Settings → API to get your credentials

### Step 3: Configure Environment

Create \`.env.local\` file:
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

Edit \`.env.local\` and add your Supabase credentials:
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

### Step 4: Run Locally
\`\`\`bash
npm run dev
\`\`\`

Visit http://localhost:3000

### Step 5: Deploy to Vercel

**Option A: Vercel CLI**
\`\`\`bash
npm i -g vercel
vercel
\`\`\`

**Option B: GitHub Integration**
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Add environment variables
6. Deploy!

## 📱 Use on Mobile

Once deployed, you can add it to your phone's home screen:

**iOS**: Safari → Share → Add to Home Screen
**Android**: Chrome → Menu → Add to Home Screen

## 🔑 Environment Variables for Vercel

Add these in your Vercel project settings:

- \`NEXT_PUBLIC_SUPABASE_URL\`
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`

## 🎨 Customize

Edit colors in \`tailwind.config.js\`
Edit app name in \`public/manifest.json\`
Modify UI in \`app/page.tsx\`

## ❓ Common Issues

**Build fails**: Check environment variables are set
**No messages**: Enable Realtime in Supabase
**Auth errors**: Enable anonymous auth in Supabase settings

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Signal Protocol](https://signal.org/docs/)

---

Need help? Check the full README.md for detailed instructions!
