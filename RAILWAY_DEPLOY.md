# Railway Deployment Guide for HealthConnect

## Prerequisites
1. Railway account (sign up at railway.app)
2. MySQL database provisioned on Railway
3. Your environment variables ready

## Quick Deploy Steps

### 1. Create New Project on Railway
```bash
# Install Railway CLI (optional)
npm install -g @railway/cli

# Login
railway login
```

### 2. Set Up MySQL Database
- In Railway dashboard, click "New" → "Database" → "MySQL"
- Railway will automatically provide connection details

### 3. Configure Environment Variables

In Railway dashboard, go to your project → Variables, and add:

**Required Variables:**
```
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-app.railway.app

# Database (provided by Railway MySQL)
DB_HOST=<from Railway MySQL>
DB_PORT=3306
DB_USER=<from Railway MySQL>
DB_PASSWORD=<from Railway MySQL>
DB_NAME=<from Railway MySQL>
DB_CONNECTION_LIMIT=10

# JWT Secrets (generate strong random strings)
JWT_SECRET=<generate-64-char-random-string>
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=<generate-64-char-random-string>
JWT_REFRESH_EXPIRES_IN=7d

# AI Provider
AI_PROVIDER=huggingface
HF_TOKEN=<your-huggingface-token>
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct

# Email (SendGrid recommended)
EMAIL_SERVICE=sendgrid
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=<your-sendgrid-api-key>
EMAIL_FROM=noreply@healthconnect.health
EMAIL_FROM_NAME=HealthConnect

# SMS (optional - Africa's Talking)
AT_API_KEY=<your-at-api-key>
AT_USERNAME=<your-at-username>
AT_SENDER_ID=HealthConnect

# Payments (optional - Stripe)
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
```

### 4. Initialize Database

After deploying, run migrations:

```bash
# Connect to Railway shell
railway run bash

# Run database initialization
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backend/database/schema.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backend/database/seeds.sql
```

Or use the Railway MySQL plugin web interface to execute the SQL files.

### 5. Deploy

Push to GitHub and connect Railway to your repository:

1. Push code to GitHub
2. In Railway dashboard: New → GitHub Repo
3. Select your repository
4. Railway will auto-deploy on every push to main

### 6. Custom Domain (Optional)

1. In Railway dashboard, go to Settings → Domains
2. Click "Generate Domain" for a railway.app subdomain
3. Or add your custom domain

## Health Check Endpoints

Railway will use these to monitor your app:

- **Liveness**: `https://your-app.railway.app/api/health/live`
- **Readiness**: `https://your-app.railway.app/api/health/ready`
- **Detailed**: `https://your-app.railway.app/api/health/detailed`

## Troubleshooting

### Database Connection Issues
- Ensure Railway MySQL is in the same project
- Check that all DB_* environment variables are correctly set
- Verify connection limits (Railway free tier has limits)

### Build Failures
- Check logs in Railway dashboard
- Ensure all dependencies are in package.json
- Verify Node version (18+ required)

### Memory Issues
- Railway free tier: 512MB RAM
- Upgrade plan if needed for production
- Monitor at `/api/metrics`

### Socket.IO Issues
- Ensure FRONTEND_URL is set correctly
- Railway supports WebSocket connections
- Check CORS settings match your domain

## Monitoring

View logs in Railway dashboard:
```bash
# Or via CLI
railway logs
```

## Scaling

- Railway auto-scales based on traffic
- Upgrade to Pro for better performance
- Consider using Railway's Redis for caching

## Security Checklist

- [ ] All JWT secrets are strong random strings
- [ ] Database credentials are secure
- [ ] FRONTEND_URL is set to your actual domain
- [ ] NODE_ENV is set to 'production'
- [ ] All sensitive .env variables are set in Railway
- [ ] .env file is NOT committed to Git

## Cost Optimization

**Free Tier:**
- $5 credit per month
- 512MB RAM
- 1GB disk
- 100GB bandwidth

**Tips:**
- Monitor usage in Railway dashboard
- Use environment-based feature flags
- Optimize database queries
- Enable compression (already configured)

## Support

- Railway Docs: https://docs.railway.app
- HealthConnect Issues: [Your GitHub repo]
- Railway Community: https://discord.gg/railway
