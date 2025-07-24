# Deployment Guide

This guide covers deploying the Unified Customer Dashboard to various platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Traditional Server Deployment](#traditional-server-deployment)
6. [Database Setup](#database-setup)
7. [Post-Deployment](#post-deployment)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

1. ✅ All environment variables configured
2. ✅ Database provisioned and accessible
3. ✅ Google OAuth configured for production domain
4. ✅ API keys for HubSpot and Dwolla
5. ✅ SSL certificates (for non-Vercel deployments)

Run the environment check:

```bash
npm run check:env
```

## Environment Setup

### 1. Create Production Environment File

```bash
cp .env.production .env.production.local
# Fill in all values in .env.production.local
```

### 2. Validate Configuration

```bash
NODE_ENV=production npm run check:env
```

### 3. Build and Test Locally

```bash
# Build production version
npm run build

# Test production build
npm run start
```

## Vercel Deployment

### Initial Setup

1. **Install Vercel CLI**:

```bash
npm i -g vercel
```

2. **Login to Vercel**:

```bash
vercel login
```

3. **Link Project**:

```bash
vercel link
```

### Configure Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add all variables from `.env.production`

**Important Variables**:

- Set different values for Production, Preview, and Development
- Sensitive values should only be in Production

### Deploy

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

### Custom Domain

1. Go to Settings → Domains
2. Add your domain
3. Configure DNS:
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or use Vercel nameservers

## Docker Deployment

### Build and Run Locally

```bash
# Build image
docker build -t unified-customer-dashboard .

# Run with env file
docker run -p 3000:3000 --env-file .env.production.local unified-customer-dashboard
```

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Deploy to Cloud Providers

#### AWS ECS

1. **Build and Push to ECR**:

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [your-ecr-uri]

# Build and tag
docker build -t unified-customer-dashboard .
docker tag unified-customer-dashboard:latest [your-ecr-uri]/unified-customer-dashboard:latest

# Push
docker push [your-ecr-uri]/unified-customer-dashboard:latest
```

2. **Create ECS Task Definition** with environment variables
3. **Create ECS Service** with load balancer

#### Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/[PROJECT-ID]/unified-customer-dashboard

# Deploy
gcloud run deploy unified-customer-dashboard \
  --image gcr.io/[PROJECT-ID]/unified-customer-dashboard \
  --platform managed \
  --region us-central1 \
  --env-vars-file .env.production.yaml
```

#### Azure Container Instances

```bash
# Create container registry
az acr create --resource-group myResourceGroup --name myregistry --sku Basic

# Build and push
az acr build --registry myregistry --image unified-customer-dashboard .

# Deploy
az container create \
  --resource-group myResourceGroup \
  --name unified-customer-dashboard \
  --image myregistry.azurecr.io/unified-customer-dashboard:latest \
  --dns-name-label unified-dashboard \
  --ports 3000 \
  --environment-variables-file env.yaml
```

## Traditional Server Deployment

### Using PM2

1. **Install dependencies**:

```bash
npm ci --production
npx prisma generate
```

2. **Build application**:

```bash
npm run build
```

3. **Create PM2 ecosystem file**:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "unified-customer-dashboard",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
}
```

4. **Start with PM2**:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database Setup

### Production Database Checklist

1. **Create Production Database**:

```sql
CREATE DATABASE unified_customer_dashboard_prod;
```

2. **Run Migrations**:

```bash
DATABASE_URL=your-production-db-url npx prisma migrate deploy
```

3. **Verify Schema**:

```bash
DATABASE_URL=your-production-db-url npx prisma db pull
```

4. **Set up Backups**:
   - Configure automated daily backups
   - Test restore procedure
   - Set retention policy

5. **Configure Connection Pooling**:
   - Use PgBouncer or similar
   - Set appropriate pool size
   - Monitor connection usage

## Post-Deployment

### 1. Verify Deployment

Run through this checklist:

- [ ] Application loads without errors
- [ ] Google OAuth works
- [ ] Can perform searches
- [ ] Health check endpoint responds: `/api/health`
- [ ] Metrics endpoint works (admin only): `/api/metrics`
- [ ] All environment variables loaded correctly

### 2. Configure Monitoring

#### Uptime Monitoring

- Set up monitoring for `/api/health/live`
- Alert on downtime
- Check every 1-5 minutes

#### Error Tracking (Sentry)

```bash
# Install Sentry
npm install @sentry/nextjs

# Configure in next.config.js and sentry.client.config.js
```

#### Application Monitoring

- New Relic
- DataDog
- Or similar APM tool

### 3. Set up Logging

Configure centralized logging:

- AWS CloudWatch
- Google Cloud Logging
- LogDNA
- Papertrail

### 4. Security Hardening

1. **Enable Web Application Firewall (WAF)**
2. **Set up DDoS protection**
3. **Configure rate limiting at edge**
4. **Enable bot protection**
5. **Set up SSL/TLS with A+ rating**

## Monitoring

### Key Metrics to Monitor

1. **Application Metrics**:
   - Response time (p50, p95, p99)
   - Error rate
   - Request rate
   - Active users

2. **Infrastructure Metrics**:
   - CPU usage
   - Memory usage
   - Disk space
   - Network I/O

3. **Business Metrics**:
   - Search queries per minute
   - API call success rate
   - User sessions
   - Feature usage

### Alerts to Configure

1. **Critical**:
   - Application down
   - Database connection failed
   - Error rate > 5%
   - Response time > 5s

2. **Warning**:
   - CPU > 80%
   - Memory > 85%
   - Disk space < 20%
   - Failed login attempts spike

## Troubleshooting

### Application Won't Start

1. **Check logs**:

```bash
# Vercel
vercel logs

# Docker
docker logs container-name

# PM2
pm2 logs
```

2. **Verify environment variables**:

```bash
npm run check:env
```

3. **Test database connection**:

```bash
npx prisma db pull
```

### OAuth Not Working

1. Verify redirect URIs match production domain
2. Check NEXTAUTH_URL is set correctly
3. Ensure NEXTAUTH_SECRET is set
4. Check domain is verified in Google Console

### Performance Issues

1. **Enable caching**:
   - Set up Redis
   - Configure cache headers
   - Use CDN for static assets

2. **Optimize database**:
   - Add missing indexes
   - Enable query logging
   - Use connection pooling

3. **Scale horizontally**:
   - Add more instances
   - Use load balancer
   - Configure session persistence

### Database Connection Issues

1. **Check connection string format**
2. **Verify network connectivity**
3. **Check SSL requirements**:

```
?sslmode=require
```

4. **Verify connection limits not exceeded**

## Rollback Procedure

### Vercel

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

### Docker

```bash
# Tag current version before deploying
docker tag app:latest app:rollback

# Rollback
docker tag app:rollback app:latest
docker-compose up -d
```

### Database

Always backup before migrations:

```bash
# Backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore if needed
psql $DATABASE_URL < backup-file.sql
```

## Support

For deployment issues:

1. Check application logs
2. Review this guide's troubleshooting section
3. Check [Next.js deployment docs](https://nextjs.org/docs/deployment)
4. Contact your DevOps team
