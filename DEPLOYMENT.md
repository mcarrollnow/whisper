# Vercel Deployment Guide

## Method 1: Deploy via Vercel CLI (Recommended)

### Install Vercel CLI
\`\`\`bash
npm install -g vercel
\`\`\`

### Login to Vercel
\`\`\`bash
vercel login
\`\`\`

### Deploy
From your project directory:
\`\`\`bash
vercel
\`\`\`

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **secure-messenger** (or your choice)
- Directory? **./secure-messenger**
- Override settings? **N**

### Set Environment Variables
\`\`\`bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
\`\`\`

Select "Production" for each when prompted.

### Deploy to Production
\`\`\`bash
vercel --prod
\`\`\`

## Method 2: Deploy via GitHub

### 1. Push to GitHub
\`\`\`bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
\`\`\`

### 2. Import in Vercel

1. Go to [vercel.com](https://vercel.com/new)
2. Click "Import Project"
3. Select "Import Git Repository"
4. Choose your GitHub repository
5. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./secure-messenger (or ./ if in root)
   - **Build Command**: npm run build
   - **Output Directory**: .next

### 3. Add Environment Variables

In the Vercel import screen, add:

| Name | Value |
|------|-------|
| NEXT_PUBLIC_SUPABASE_URL | your-project.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | your-anon-key |

### 4. Deploy!

Click "Deploy" and wait for the build to complete.

## Post-Deployment

### Custom Domain (Optional)

1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as shown

### Enable Analytics

1. In Vercel Dashboard, go to your project
2. Click "Analytics" tab
3. Enable Web Analytics

### Set Up Continuous Deployment

With GitHub integration:
- Push to \`main\` branch → Auto-deploy to production
- Push to other branches → Auto-deploy to preview URLs

## Monitoring Your Deployment

### View Logs
\`\`\`bash
vercel logs
\`\`\`

### Check Build Status
Visit: https://vercel.com/YOUR_USERNAME/YOUR_PROJECT

### Test Your Deployment
Visit your deployment URL (shown after deployment)

## Troubleshooting

### Build Fails

**Check build logs**:
\`\`\`bash
vercel logs --since 1h
\`\`\`

**Common issues**:
- Missing environment variables
- TypeScript errors
- Dependency issues

**Solutions**:
1. Verify all env vars are set in Vercel dashboard
2. Run \`npm run build\` locally to catch errors
3. Check \`vercel.json\` configuration

### Environment Variables Not Working

1. Make sure variables start with \`NEXT_PUBLIC_\`
2. Redeploy after adding variables:
   \`\`\`bash
   vercel --prod
   \`\`\`

### App Not Loading

1. Check browser console for errors
2. Verify Supabase URL is correct
3. Check Supabase project is active

## Updating Your Deployment

### After Code Changes

**CLI**:
\`\`\`bash
vercel --prod
\`\`\`

**GitHub**:
Just push to main:
\`\`\`bash
git add .
git commit -m "Update feature"
git push
\`\`\`

### Rollback Deployment

1. Go to Vercel Dashboard
2. Select your project
3. Click "Deployments"
4. Find previous deployment
5. Click "..." → "Promote to Production"

## Performance Tips

1. **Enable Edge Functions**: In vercel.json, add edge runtime
2. **Image Optimization**: Use Next.js Image component
3. **Caching**: Vercel automatically caches static assets
4. **Analytics**: Monitor performance with Vercel Analytics

## Security

Vercel automatically provides:
- ✅ SSL/TLS certificates
- ✅ DDoS protection
- ✅ Web Application Firewall
- ✅ Edge Network CDN

## Cost

Vercel Free Tier includes:
- Unlimited deployments
- 100GB bandwidth/month
- Automatic HTTPS
- Preview deployments

## Next Steps

1. ✅ Set up custom domain
2. ✅ Enable analytics
3. ✅ Add monitoring
4. ✅ Set up alerts
5. ✅ Configure CI/CD

---

Your app is now live! Share the URL with your users. 🎉
