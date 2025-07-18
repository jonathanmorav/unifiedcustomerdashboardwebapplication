# Security Incident Response Runbook

## Emergency Contacts

| Role | Name | Phone | Email | Escalation |
|------|------|-------|-------|------------|
| Security Lead | [Name] | +1-XXX-XXX-XXXX | security-lead@company.com | Primary |
| CISO | [Name] | +1-XXX-XXX-XXXX | ciso@company.com | P1 Incidents |
| DevOps On-Call | [Rotation] | +1-XXX-XXX-XXXX | devops-oncall@company.com | 24/7 |
| Legal Counsel | [Name] | +1-XXX-XXX-XXXX | legal@company.com | Data Breach |
| PR Team | [Name] | +1-XXX-XXX-XXXX | pr@company.com | Public Incidents |

**Security Hotline**: +1-800-XXX-XXXX (24/7)

## Incident Classification

### Priority Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Active breach, data exposure, system compromise | < 15 minutes | Data breach, ransomware, system takeover |
| **P2 - High** | Imminent threat, partial compromise | < 1 hour | Suspicious admin activity, auth bypass found |
| **P3 - Medium** | Security weakness exploited | < 4 hours | Spike in failed logins, unusual API usage |
| **P4 - Low** | Potential security issue | < 24 hours | Policy violation, configuration drift |

## Immediate Response Actions

### 🚨 P1 Critical Incident Response

```bash
# 1. CONTAIN - Stop the bleeding
./scripts/emergency-lockdown.sh

# 2. ASSESS - Understand the scope
./scripts/security-assessment.sh

# 3. COMMUNICATE - Alert stakeholders
./scripts/alert-stakeholders.sh P1

# 4. PRESERVE - Capture evidence
./scripts/capture-evidence.sh
```

### Step-by-Step Response

#### 1. Initial Detection (0-5 minutes)

- [ ] Verify the incident is real (not a false positive)
- [ ] Classify incident severity (P1-P4)
- [ ] Create incident ticket with initial details
- [ ] Alert on-call security engineer
- [ ] Start incident timeline documentation

#### 2. Containment (5-15 minutes)

**For Active Breach:**
```bash
# Block suspicious IPs immediately
sudo iptables -A INPUT -s <suspicious-ip> -j DROP

# Disable compromised accounts
npm run security:disable-accounts <user-ids>

# Enable emergency mode (read-only)
npm run security:emergency-mode on

# Revoke all active sessions if needed
npm run security:revoke-all-sessions
```

**Containment Checklist:**
- [ ] Isolate affected systems
- [ ] Disable compromised accounts
- [ ] Block malicious IPs/domains
- [ ] Revoke suspicious API keys
- [ ] Enable enhanced logging
- [ ] Take affected services offline if necessary

#### 3. Investigation (15-60 minutes)

**Data Collection Commands:**
```bash
# Export recent audit logs
npm run security:export-logs --hours=24 --severity=all

# Check for data exfiltration
npm run security:check-exports --user=<userid> --days=7

# Analyze session anomalies
npm run security:session-analysis --anomaly-level=high

# Review access patterns
npm run security:access-report --suspicious-only
```

**Investigation Questions:**
- What was accessed/modified?
- When did the incident start?
- How did the attacker gain access?
- What is the scope of compromise?
- Is the attack ongoing?
- What data was potentially exposed?

#### 4. Eradication (1-4 hours)

- [ ] Remove attacker access
- [ ] Patch vulnerabilities
- [ ] Reset compromised credentials
- [ ] Clean infected systems
- [ ] Update security rules
- [ ] Deploy security patches

#### 5. Recovery (2-8 hours)

**Recovery Steps:**
```bash
# Restore from clean backups if needed
npm run restore:from-backup --timestamp=<pre-incident>

# Re-enable services gradually
npm run services:enable --staged

# Reset user passwords
npm run security:force-password-reset --scope=affected

# Regenerate API keys
npm run security:rotate-api-keys

# Clear suspicious sessions
npm run security:clear-sessions --suspicious
```

#### 6. Post-Incident (24-48 hours)

- [ ] Complete incident report
- [ ] Conduct post-mortem meeting
- [ ] Implement lessons learned
- [ ] Update security procedures
- [ ] Notify affected users (if required)
- [ ] File regulatory reports (if required)

## Specific Incident Playbooks

### 🔐 Credential Compromise

**Indicators:**
- Unusual login patterns
- Access from new locations
- Privilege escalation attempts
- Mass data downloads

**Response:**
```bash
# 1. Disable affected accounts
UPDATE users SET locked_until = NOW() + INTERVAL '1 year' 
WHERE email IN ('compromised@example.com');

# 2. Revoke all sessions
DELETE FROM sessions WHERE user_id IN (
  SELECT id FROM users WHERE email IN ('compromised@example.com')
);

# 3. Force password reset
UPDATE users SET password_reset_required = true 
WHERE email IN ('compromised@example.com');

# 4. Review audit logs
SELECT * FROM audit_logs 
WHERE user_id = '<compromised-user-id>' 
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### 💉 SQL Injection Attack

**Indicators:**
- Unusual SQL patterns in logs
- Database errors in application logs
- Unexpected data modifications

**Response:**
1. Enable SQL query logging
2. Block attacking IPs
3. Review and sanitize all user inputs
4. Patch vulnerable endpoints
5. Audit database for unauthorized changes

### 🌐 DDoS Attack

**Indicators:**
- Spike in traffic
- High rate limit violations
- Service degradation
- Unusual geographic distribution

**Response:**
```bash
# 1. Enable DDoS protection
npm run cloudflare:enable-under-attack-mode

# 2. Increase rate limits temporarily
npm run security:rate-limit --multiply=0.5

# 3. Block suspicious patterns
npm run security:block-pattern --type=user-agent --pattern="*bot*"

# 4. Scale infrastructure
npm run infra:scale-up --component=api --factor=3
```

### 🔓 Authentication Bypass

**Indicators:**
- Access without valid sessions
- Privilege escalation
- Unauthorized API calls

**Response:**
1. Disable affected endpoints
2. Review authentication middleware
3. Audit all recent access
4. Patch vulnerability
5. Force re-authentication for all users

### 📊 Data Breach

**Indicators:**
- Large data exports
- Unusual API access patterns
- Database dumps detected
- Customer data on dark web

**Response Protocol:**
1. **Immediate** (0-1 hour)
   - Contain the breach
   - Preserve evidence
   - Notify legal counsel
   - Begin investigation

2. **Short-term** (1-24 hours)
   - Determine scope
   - Identify affected users
   - Prepare notifications
   - Engage forensics team

3. **Medium-term** (1-7 days)
   - Notify affected users
   - File regulatory reports
   - Implement additional controls
   - Conduct full audit

## Emergency Scripts

### Emergency Lockdown Script

```bash
#!/bin/bash
# emergency-lockdown.sh

echo "🚨 INITIATING EMERGENCY LOCKDOWN"

# 1. Enable read-only mode
export EMERGENCY_MODE=true
kubectl set env deployment/api READONLY=true

# 2. Increase rate limits
redis-cli SET rate_limit:global 10

# 3. Disable new registrations
redis-cli SET feature:registration:enabled false

# 4. Alert all administrators
npm run notify:admins --message="Emergency lockdown activated" --priority=critical

# 5. Increase logging
kubectl set env deployment/api LOG_LEVEL=debug

echo "✅ Emergency lockdown complete"
```

### Evidence Collection Script

```bash
#!/bin/bash
# capture-evidence.sh

INCIDENT_ID=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="/secure/evidence/$INCIDENT_ID"

echo "📸 Capturing evidence for incident $INCIDENT_ID"

# Create evidence directory
mkdir -p $EVIDENCE_DIR

# Capture system state
ps aux > $EVIDENCE_DIR/processes.txt
netstat -an > $EVIDENCE_DIR/network.txt
w > $EVIDENCE_DIR/users.txt

# Export logs
journalctl --since "1 hour ago" > $EVIDENCE_DIR/system.log
docker logs api --since 1h > $EVIDENCE_DIR/api.log
pg_dump -t audit_logs > $EVIDENCE_DIR/audit_logs.sql

# Capture memory dump (if needed)
# gcore -o $EVIDENCE_DIR/memory <pid>

# Create hash for integrity
find $EVIDENCE_DIR -type f -exec sha256sum {} \; > $EVIDENCE_DIR/checksums.txt

echo "✅ Evidence captured at $EVIDENCE_DIR"
```

## Communication Templates

### Internal Alert Template

```
Subject: [SECURITY INCIDENT P{X}] {Brief Description}

Team,

We are currently responding to a P{X} security incident.

INCIDENT DETAILS:
- Time Detected: {timestamp}
- Type: {incident type}
- Affected Systems: {systems}
- Current Status: {status}

ACTIONS TAKEN:
- {action 1}
- {action 2}

NEXT STEPS:
- {next step 1}
- {next step 2}

Please standby for updates. Do not discuss this incident outside of secure channels.

Incident Commander: {name}
```

### Customer Notification Template

```
Subject: Important Security Update

Dear Customer,

We are writing to inform you of a security incident that may have affected your account.

WHAT HAPPENED:
{Brief, clear description without technical details}

WHEN IT HAPPENED:
{Date range}

WHAT INFORMATION WAS INVOLVED:
{Specific data types potentially affected}

WHAT WE ARE DOING:
{Actions taken to address the issue}

WHAT YOU SHOULD DO:
1. Change your password immediately
2. Review your recent account activity
3. Enable two-factor authentication
4. Monitor your accounts for suspicious activity

We take the security of your information seriously and apologize for any inconvenience.

For questions, please contact: security@company.com

Sincerely,
{Company} Security Team
```

### Regulatory Notification Template

```
[CONFIDENTIAL - ATTORNEY-CLIENT PRIVILEGED]

Date: {date}
To: {Regulatory Body}
Re: Security Incident Notification

This notice is provided pursuant to {applicable law/regulation}.

1. Nature of Incident: {description}
2. Date of Incident: {date discovered}
3. Date of Discovery: {date discovered}
4. Number of Affected Individuals: {number}
5. Types of Information: {data types}
6. Remedial Actions: {actions taken}
7. Contact Information: {security contact}

Supporting documentation is attached.

Respectfully submitted,
{Legal Counsel}
```

## Lessons Learned Template

```markdown
# Post-Incident Review: {Incident ID}

## Incident Summary
- **Date**: {date}
- **Duration**: {duration}
- **Severity**: P{X}
- **Impact**: {impact description}

## Timeline
- {time}: Initial detection
- {time}: Incident confirmed
- {time}: Containment started
- {time}: Incident resolved

## What Went Well
1. {positive point}
2. {positive point}

## What Could Be Improved
1. {improvement area}
2. {improvement area}

## Root Cause
{Detailed root cause analysis}

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| {action} | {name} | {date} | {status} |

## Metrics
- Time to Detection: {time}
- Time to Containment: {time}
- Time to Resolution: {time}
- Data Affected: {amount}
- Users Affected: {number}

## Recommendations
1. {recommendation}
2. {recommendation}

## Approval
- Security Lead: {signature}
- Engineering Lead: {signature}
- Management: {signature}
```

## Regular Drills

### Monthly Security Drills

1. **Tabletop Exercise** (1st Monday)
   - Scenario-based discussion
   - No actual system changes
   - Focus on process and communication

2. **Technical Drill** (3rd Wednesday)
   - Actual response actions
   - Limited scope (staging environment)
   - Focus on technical capabilities

### Drill Scenarios

1. **Credential Stuffing Attack**
   - Mass login attempts detected
   - Multiple accounts compromised
   - Practice account lockout procedures

2. **Data Exfiltration**
   - Unusual API usage patterns
   - Large data exports detected
   - Practice investigation and containment

3. **Insider Threat**
   - Privileged account abuse
   - Data theft attempt
   - Practice access revocation and audit

## Compliance Requirements

### Notification Timelines

| Regulation | Notification Requirement | Who to Notify |
|------------|-------------------------|---------------|
| GDPR | 72 hours to authorities, without undue delay to individuals | DPA, affected users |
| CCPA | Without unreasonable delay | CA Attorney General, affected residents |
| HIPAA | 60 days to individuals, HHS | HHS, affected individuals, media (if >500) |
| PCI DSS | Immediately | Card brands, acquiring bank |

### Evidence Retention

- Security logs: 2 years minimum
- Incident reports: 5 years
- Forensic evidence: Until case closed + 1 year
- Communication records: 3 years

---

**Remember**: In a security incident, speed is important but accuracy is critical. When in doubt, escalate to the security team.