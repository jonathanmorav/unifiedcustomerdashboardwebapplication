# Production Deployment Checklist

This checklist ensures all critical items are addressed before deploying to production.

## Pre-Deployment Requirements

### 1. API Credentials ✓
- [ ] **HubSpot API Key**
  - [ ] Create Private App in HubSpot
  - [ ] Grant required scopes:
    - `crm.objects.companies.read`
    - `crm.objects.custom.read`
    - `crm.schemas.custom.read`
  - [ ] Copy API key to `.env.production.local`
  - [ ] Note any custom object IDs if applicable

- [ ] **Dwolla Credentials**
  - [ ] Create production application at https://accounts.dwolla.com
  - [ ] Copy Client ID and Secret to `.env.production.local`
  - [ ] Configure webhook endpoint if using webhooks
  - [ ] Verify production access is approved

- [ ] **Google OAuth**
  - [ ] Update authorized redirect URIs in Google Cloud Console:
    - `https://your-domain.com/api/auth/callback/google`
    - `https://your-domain.com/api/auth/signin`
  - [ ] Verify domain ownership in Google Console
  - [ ] Copy Client ID and Secret to `.env.production.local`

### 2. Infrastructure ✓
- [ ] **Domain & SSL**
  - [ ] Domain registered and DNS configured
  - [ ] SSL certificate provisioned (auto with Vercel/Netlify)
  - [ ] Verify HTTPS redirect is working

- [ ] **Database**
  - [ ] Production PostgreSQL database provisioned
  - [ ] Connection string added to `.env.production.local`
  - [ ] SSL mode enabled (`?sslmode=require`)
  - [ ] Backup strategy configured
  - [ ] Connection pooling configured if needed

- [ ] **Hosting Platform**
  - [ ] Vercel/AWS/GCP project created
  - [ ] Environment variables configured
  - [ ] Build settings verified
  - [ ] Auto-scaling configured if applicable

### 3. Security Configuration ✓
- [ ] **Authentication**
  - [ ] Generate production `NEXTAUTH_SECRET` (32+ chars)
  - [ ] Set authorized email list
  - [ ] Configure session timeouts
  - [ ] Enable MFA if required

- [ ] **API Security**
  - [ ] Rate limiting configured
  - [ ] CORS origins set correctly
  - [ ] Security headers enabled
  - [ ] CSP policy configured

- [ ] **Data Protection**
  - [ ] Audit logging enabled
  - [ ] PII masking verified
  - [ ] Encryption at rest confirmed
  - [ ] Backup encryption configured

### 4. Environment Configuration ✓
- [ ] Create `.env.production.local` from `.env.production`
- [ ] Fill in all `[REQUIRED]` values
- [ ] Verify no placeholder values remain
- [ ] Test configuration locally:
  ```bash
  NODE_ENV=production npm run check:env
  ```

## Deployment Steps

### 1. Pre-Deployment Testing
```bash
# Build production version locally
npm run build

# Test with production environment
NODE_ENV=production npm start

# Run production checks
npm run test:production
```

### 2. Database Migration
```bash
# Backup existing data (if any)
pg_dump $OLD_DATABASE_URL > backup-$(date +%Y%m%d).sql

# Run migrations on production database
DATABASE_URL=$PRODUCTION_DATABASE_URL npx prisma migrate deploy

# Verify schema
DATABASE_URL=$PRODUCTION_DATABASE_URL npx prisma db pull
```

### 3. Deploy to Hosting Platform

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

#### AWS/Docker
```bash
# Build Docker image
docker build -t unified-dashboard:prod .

# Push to registry
docker push your-registry/unified-dashboard:prod

# Deploy via your CI/CD pipeline
```

### 4. Post-Deployment Verification

#### Functional Tests
- [ ] Application loads without errors
- [ ] Login with authorized Google account works
- [ ] Search returns results from HubSpot
- [ ] Search returns results from Dwolla
- [ ] Theme switching works
- [ ] Export functionality works (if enabled)
- [ ] All navigation links work

#### API Integration Tests
- [ ] HubSpot API connection successful
- [ ] Dwolla API authentication works
- [ ] Rate limiting is active
- [ ] Error handling works correctly

#### Security Tests
- [ ] Unauthorized users cannot access
- [ ] Session timeout works
- [ ] Security headers present
- [ ] HTTPS redirect works
- [ ] No sensitive data in browser console

#### Performance Tests
- [ ] Page load time < 3 seconds
- [ ] Search response time < 5 seconds
- [ ] No memory leaks detected
- [ ] Database queries optimized

## Monitoring Setup

### 1. Application Monitoring
- [ ] Error tracking configured (Sentry/Rollbar)
- [ ] APM configured (New Relic/DataDog)
- [ ] Custom metrics dashboard created
- [ ] Log aggregation configured

### 2. Alerts Configuration
- [ ] Downtime alerts
- [ ] Error rate alerts (>1%)
- [ ] API failure alerts
- [ ] Performance degradation alerts
- [ ] Security incident alerts

### 3. Health Checks
- [ ] `/api/health` endpoint monitoring
- [ ] Database connectivity checks
- [ ] API integration health checks
- [ ] SSL certificate expiry monitoring

## Go-Live Checklist

### Final Checks
- [ ] All environment variables set correctly
- [ ] No debug mode or verbose logging enabled
- [ ] All test accounts removed
- [ ] Documentation updated
- [ ] Team notified of go-live

### Communication
- [ ] Stakeholders notified
- [ ] Support team briefed
- [ ] Monitoring team on standby
- [ ] Rollback plan documented

### Post Go-Live (First 24 Hours)
- [ ] Monitor error logs closely
- [ ] Check API rate limits
- [ ] Verify backup processes
- [ ] Monitor performance metrics
- [ ] Gather user feedback

## Rollback Plan

If critical issues occur:

1. **Immediate Actions**
   - Switch to maintenance mode
   - Notify stakeholders
   - Begin investigation

2. **Rollback Steps**
   ```bash
   # Vercel
   vercel rollback [previous-deployment-url]
   
   # Docker
   kubectl rollout undo deployment/unified-dashboard
   ```

3. **Database Rollback** (if needed)
   ```bash
   # Restore from backup
   psql $DATABASE_URL < backup-file.sql
   ```

## Support Contacts

- **Technical Lead**: [Name] - [Email]
- **DevOps Team**: [Email/Slack]
- **Security Team**: [Email]
- **On-Call Engineer**: [Phone]

## Notes

- Keep this checklist updated with lessons learned
- Review before each major deployment
- Archive completed checklists for audit trail