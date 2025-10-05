# SecureMessenger - End-to-End Encrypted Messaging App

A modern, dark-themed messaging application with Signal Protocol encryption, built with Next.js 14, Supabase, and deployed on Vercel.

## Features

- 🔒 **Signal Protocol Encryption** - Military-grade end-to-end encryption
- 🌙 **Modern Dark Theme** - Beautiful, eye-friendly dark UI
- 📱 **Mobile & Web** - Progressive Web App (PWA) support
- ⚡ **Real-time Messaging** - Instant message delivery with Supabase Realtime
- 🚀 **Fast & Secure** - Built with Next.js 14 and deployed on Vercel
- 🔐 **Row Level Security** - Database security with Supabase RLS

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Encryption**: Signal Protocol (@privacyresearch/libsignal-protocol-typescript)
- **Deployment**: Vercel
- **Styling**: Tailwind CSS with custom dark theme

## Setup Instructions

### 1. Clone the Repository

\`\`\`bash
git clone <your-repo-url>
cd secure-messenger
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. In your Supabase project, go to the SQL Editor
3. Run the SQL commands from \`supabase-schema.sql\`
4. Enable Realtime for the \`messages\` table:
   - Go to Database → Replication
   - Enable replication for the \`messages\` table

### 4. Configure Environment Variables

1. Copy \`.env.local.example\` to \`.env.local\`:
   \`\`\`bash
   cp .env.local.example .env.local
   \`\`\`

2. Fill in your Supabase credentials:
   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   \`\`\`

   Find these values in your Supabase project settings → API

### 5. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### Option 1: Deploy with Vercel CLI

1. Install Vercel CLI:
   \`\`\`bash
   npm i -g vercel
   \`\`\`

2. Deploy:
   \`\`\`bash
   vercel
   \`\`\`

3. Add environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to Environment Variables
   - Add \`NEXT_PUBLIC_SUPABASE_URL\` and \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`

### Option 2: Deploy via GitHub

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Configure environment variables during import
4. Deploy!

## How It Works

### Encryption Flow

1. **Key Generation**: Each user generates:
   - Identity Key Pair (long-term)
   - Signed Pre-Key (medium-term)
   - One-time Pre-Keys (single-use)

2. **Session Establishment**: 
   - When User A wants to message User B, they fetch B's public keys
   - A Signal Protocol session is established
   - A shared secret is derived using the Double Ratchet Algorithm

3. **Message Encryption**:
   - Each message is encrypted with a unique key
   - Forward secrecy ensures past messages remain secure even if keys are compromised
   - Messages are stored encrypted in Supabase

### Architecture

\`\`\`
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Next.js   │ ◄─────► │   Supabase   │ ◄─────► │ PostgreSQL  │
│  Frontend   │         │   Realtime   │         │  Database   │
└─────────────┘         └──────────────┘         └─────────────┘
      │
      │ Signal Protocol
      ▼
┌─────────────┐
│ Encryption  │
│   Layer     │
└─────────────┘
\`\`\`

## Security Features

- **End-to-End Encryption**: Messages encrypted on sender's device, decrypted on recipient's device
- **Forward Secrecy**: Past communications secure even if current keys compromised
- **Authentication**: Supabase Auth with Row Level Security
- **Zero-Knowledge**: Server cannot read message contents
- **Session-based**: Each conversation uses unique encryption keys

## Mobile Support (PWA)

The app is a Progressive Web App that works on mobile devices:

1. **iOS**: Open in Safari → Share → Add to Home Screen
2. **Android**: Open in Chrome → Menu → Add to Home Screen

The app will work offline and provide a native-like experience.

## Development

### Project Structure

\`\`\`
secure-messenger/
├── app/
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main chat page
│   └── globals.css       # Global styles
├── lib/
│   ├── supabase.ts       # Supabase client
│   └── encryption.ts     # Signal Protocol encryption
├── public/
│   └── manifest.json     # PWA manifest
└── supabase-schema.sql   # Database schema
\`\`\`

### Customization

**Change Theme Colors**: Edit \`tailwind.config.js\`
\`\`\`javascript
colors: {
  dark: {
    bg: '#0a0a0a',      // Background
    surface: '#1a1a1a', // Cards/surfaces
    // ... more colors
  }
}
\`\`\`

## Important Notes

### Production Considerations

1. **Key Storage**: The current implementation uses in-memory storage. For production:
   - Implement persistent, secure key storage
   - Use IndexedDB or encrypted local storage
   - Consider hardware security modules for servers

2. **Authentication**: Currently uses anonymous auth for demo purposes. Implement:
   - Email/password authentication
   - Social login (Google, GitHub, etc.)
   - Multi-factor authentication

3. **Message Delivery**: Add:
   - Read receipts
   - Delivery confirmations
   - Offline message queue

4. **Performance**: Optimize for:
   - Message pagination
   - Image/file sharing
   - Large group chats

## Troubleshooting

**Issue**: "No user found" error
- **Solution**: Make sure Supabase Auth is enabled and anonymous sign-in is allowed

**Issue**: Messages not appearing in real-time
- **Solution**: Verify Realtime is enabled for the messages table in Supabase

**Issue**: Build fails on Vercel
- **Solution**: Ensure all environment variables are set correctly

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing style
- Security best practices are maintained
- Tests pass (when implemented)

## License

MIT

## Support

For issues and questions:
- Check the documentation
- Open an issue on GitHub
- Review Supabase docs at [supabase.com/docs](https://supabase.com/docs)

---

Built with ❤️ using Next.js, Supabase, and Signal Protocol
