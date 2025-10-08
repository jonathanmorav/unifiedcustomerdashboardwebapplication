# Unified Customer Dashboard - Database Schema Documentation

## Overview

This document provides a comprehensive overview of the database schema for the Unified Customer Dashboard project. The database uses PostgreSQL with Prisma ORM and includes models for authentication, transaction processing, webhook management, reconciliation, and monitoring.

## Database Configuration

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Core Models

### Authentication & User Management

#### User Model
```prisma
model User {
  id                  String          @id @default(cuid())
  name                String?
  email               String?         @unique
  emailVerified       DateTime?
  image               String?
  role                UserRole        @default(USER)
  isActive            Boolean         @default(true)
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  mfaEnabled          Boolean         @default(false)
  mfaSecret           String?
  mfaBackupCodes      String[]
  mfaEnforcedAt       DateTime?
  failedLoginAttempts Int             @default(0)
  lockedUntil         DateTime?
  lastLoginAt         DateTime?
  lastLoginIp         String?
  passwordChangedAt   DateTime?
  passwordHash        String?
  accounts            Account[]
  auditLogs           AuditLog[]
  loginAttempts       LoginAttempt[]
  mfaRecovery         MFARecovery[]
  savedSearches       SavedSearch[]
  searchHistory       SearchHistory[]
  sessions            Session[]
}
```

#### Account Model
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

#### Session Model
```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

#### VerificationToken Model
```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### Security & Audit

#### AuditLog Model
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String
  resource   String
  resourceId String?
  metadata   Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
  user       User?    @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@index([resource, resourceId])
}
```

#### LoginAttempt Model
```prisma
model LoginAttempt {
  id        String   @id @default(cuid())
  userId    String?
  email     String
  success   Boolean
  ipAddress String?
  userAgent String?
  reason    String?
  createdAt DateTime @default(now())
  user      User?    @relation(fields: [userId], references: [id])

  @@index([email, createdAt])
  @@index([userId, createdAt])
}
```

#### MFARecovery Model
```prisma
model MFARecovery {
  id        String   @id @default(cuid())
  userId    String
  code      String
  usedAt    DateTime @default(now())
  ipAddress String?
  userAgent String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### Search & Saved Searches

#### SearchHistory Model
```prisma
model SearchHistory {
  id         String     @id @default(cuid())
  userId     String
  searchType SearchType
  query      Json
  results    Json?
  createdAt  DateTime   @default(now())
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

#### SavedSearch Model
```prisma
model SavedSearch {
  id           String    @id @default(cuid())
  userId       String
  name         String
  description  String?
  searchParams Json
  useCount     Int       @default(0)
  lastUsed     DateTime?
  isTemplate   Boolean   @default(false)
  isPublic     Boolean   @default(false)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])
  @@index([userId, createdAt])
  @@index([isTemplate, isPublic])
}
```

---

## Transaction Processing

### ACHTransaction Model
```prisma
model ACHTransaction {
  id                  String    @id @default(cuid())
  dwollaId            String    @unique
  status              String
  amount              Decimal   @db.Decimal(15, 2)
  currency            String    @default("USD")
  direction           String
  created             DateTime
  lastUpdated         DateTime  @updatedAt
  sourceId            String?
  sourceName          String?
  sourceBankName      String?
  destinationId       String?
  destinationName     String?
  destinationBankName String?
  bankLastFour        String?
  correlationId       String?
  individualAchId      String?
  customerId          String?
  customerName        String?
  customerEmail       String?
  companyName         String?
  invoiceNumber       String?
  transactionType     String?
  description         String?
  fees                Decimal?  @db.Decimal(15, 2)
  netAmount           Decimal?  @db.Decimal(15, 2)
  clearingDate        DateTime?
  processedAt         DateTime?
  failureReason       String?
  failureCode         String?
  returnCode          String?
  metadata            Json?
  createdAt           DateTime  @default(now())
  failureDetails      Json?     @default("{}")
  lastWebhookAt       DateTime?
  webhookEvents       Json?     @default("[]")

  @@index([status])
  @@index([created])
  @@index([customerName])
  @@index([dwollaId])
  @@index([correlationId])
  @@index([customerEmail])
  @@index([companyName])
  @@index([direction])
  @@index([amount])
  @@index([failureCode])
  @@index([returnCode])
  @@index([lastWebhookAt])
}
```

---

## Webhook Management

### WebhookEvent Model
```prisma
model WebhookEvent {
  id                   String                 @id @default(cuid())
  provider             String                 @default("dwolla")
  eventId              String                 @unique
  eventType            String
  resourceId           String?
  resourceType         String?
  resourceUri          String?
  topic                String
  eventTimestamp       DateTime
  receivedAt           DateTime               @default(now())
  processedAt          DateTime?
  headers              Json                   @default("{}")
  payload              Json
  payloadSize          Int                    @default(0)
  signature            String?
  signatureValid       Boolean                @default(false)
  verificationMethod   String?
  sourceIp             String?
  processingState      WebhookEventState      @default(received)
  processingAttempts   Int                    @default(0)
  lastProcessingError  String?
  processingDurationMs Int?
  isDuplicate          Boolean                @default(false)
  originalEventId      String?
  duplicateCount       Int                    @default(0)
  eventSequence        BigInt?
  isOutOfOrder         Boolean                @default(false)
  expectedSequence     BigInt?
  source               String                 @default("webhook")
  recoveryMetadata     Json?
  schemaVersion        String?
  validationStatus     ValidationStatus       @default(valid)
  validationErrors     Json?
  quarantined          Boolean                @default(false)
  quarantineReason     String?
  quarantinedAt        DateTime?
  quarantineReviewedAt DateTime?
  quarantineReviewedBy String?
  partitionKey         String
  ttl                  Int?
  archived             Boolean                @default(false)
  archivedAt           DateTime?
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  journeyStarts        JourneyInstance[]      @relation("StartEvent")
  journeySteps         JourneyStep[]
  relations            WebhookEventRelation[]
  anomalies            WebhookAnomaly[]       @relation("AnomalyToEvents")

  @@index([eventType])
  @@index([resourceId])
  @@index([resourceType])
  @@index([eventTimestamp])
  @@index([processingState])
  @@index([partitionKey])
  @@index([createdAt])
}
```

### WebhookEventRelation Model
```prisma
model WebhookEventRelation {
  id             String       @id @default(cuid())
  webhookEventId String
  relationType   String
  relationId     String
  relationTable  String
  metadata       Json?
  createdAt      DateTime     @default(now())
  webhookEvent   WebhookEvent @relation(fields: [webhookEventId], references: [id], onDelete: Cascade)

  @@index([webhookEventId])
  @@index([relationId])
  @@index([relationType])
}
```

---

## Event Journey Management

### EventJourneyDefinition Model
```prisma
model EventJourneyDefinition {
  id          String             @id @default(cuid())
  name        String
  description String?
  category    String
  config      Json
  thresholds  Json?
  version     Int                @default(1)
  active      Boolean            @default(true)
  tags        String[]
  createdBy   String
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  analytics   JourneyAnalytics[]
  instances   JourneyInstance[]

  @@index([category])
  @@index([active])
}
```

### JourneyInstance Model
```prisma
model JourneyInstance {
  id                      String                 @id @default(cuid())
  definitionId            String
  definitionVersion       Int
  resourceId              String
  resourceType            String
  resourceMetadata        Json?
  status                  JourneyStatus          @default(active)
  currentStepIndex        Int                    @default(0)
  completedSteps          String[]
  skippedSteps            String[]
  startEventId            String
  startTime               DateTime
  endEventId              String?
  endTime                 DateTime?
  lastEventTime           DateTime
  totalDurationMs         BigInt?
  businessDurationMs      BigInt?
  progressPercentage      Int                    @default(0)
  estimatedCompletionTime DateTime?
  confidenceScore         Int?
  riskScore               Int?
  riskFactors             String[]
  isOutlier               Boolean                @default(false)
  outlierReasons          String[]
  context                 Json?
  tags                    String[]
  notes                   String?
  partitionKey            String
  version                 Int                    @default(1)
  createdAt               DateTime               @default(now())
  updatedAt               DateTime               @updatedAt
  definition              EventJourneyDefinition @relation(fields: [definitionId], references: [id])
  startEvent              WebhookEvent           @relation("StartEvent", fields: [startEventId], references: [id])
  steps                   JourneyStep[]

  @@index([definitionId])
  @@index([resourceId])
  @@index([status])
  @@index([startTime])
  @@index([partitionKey])
}
```

### JourneyStep Model
```prisma
model JourneyStep {
  id                     String          @id @default(cuid())
  journeyInstanceId      String
  sequence               Int
  stepName               String
  eventId                String
  eventType              String
  timestamp              DateTime
  durationFromStartMs    BigInt
  durationFromPreviousMs BigInt?
  expected               Boolean         @default(true)
  onTime                 Boolean         @default(true)
  retryCount             Int             @default(0)
  eventMetadata          Json?
  createdAt              DateTime        @default(now())
  event                  WebhookEvent    @relation(fields: [eventId], references: [id])
  journeyInstance        JourneyInstance @relation(fields: [journeyInstanceId], references: [id], onDelete: Cascade)

  @@index([journeyInstanceId])
  @@index([eventId])
}
```

### JourneyAnalytics Model
```prisma
model JourneyAnalytics {
  id           String                 @id @default(cuid())
  definitionId String
  period       DateTime
  periodType   String
  metrics      Json
  segments     Json?
  outliers     Json?
  predictions  Json?
  createdAt    DateTime               @default(now())
  definition   EventJourneyDefinition @relation(fields: [definitionId], references: [id])

  @@index([definitionId])
  @@index([period])
  @@index([periodType])
}
```

---

## Monitoring & Analytics

### RealTimeMetrics Model
```prisma
model RealTimeMetrics {
  id          String   @id @default(cuid())
  timestamp   DateTime
  window      String
  volume      Json
  performance Json
  journeys    Json
  health      Json
  resources   Json
  createdAt   DateTime @default(now())

  @@index([timestamp])
  @@index([window])
}
```

### EventMetric Model
```prisma
model EventMetric {
  id            String   @id @default(cuid())
  metricName    String
  eventType     String?
  resourceType  String?
  value         Float
  timestamp     DateTime
  aggregation   String   // 'sum', 'avg', 'count', 'max', 'min'
  metadata      Json?
  createdAt     DateTime @default(now())
  
  @@index([metricName, timestamp])
  @@index([eventType])
  @@index([timestamp])
}
```

### SystemHealth Model
```prisma
model SystemHealth {
  id            String   @id @default(cuid())
  timestamp     DateTime
  components    Json
  overallStatus String
  activeIssues  Json?
  metrics       Json
  capacity      Json
  createdAt     DateTime @default(now())

  @@index([timestamp])
  @@index([overallStatus])
}
```

---

## Alerting System

### AlertRule Model
```prisma
model AlertRule {
  id              String          @id @default(cuid())
  name            String
  description     String?
  category        String
  enabled         Boolean         @default(true)
  priority        String
  condition       Json
  actions         Json
  suppression     Json
  tags            String[]
  owner           String
  runbook         String?
  documentation  String?
  createdBy       String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  lastTriggeredAt DateTime?
  triggerCount    Int             @default(0)
  instances       AlertInstance[]

  @@index([category])
  @@index([enabled])
}
```

### AlertInstance Model
```prisma
model AlertInstance {
  id                String      @id @default(cuid())
  ruleId            String
  ruleName          String
  status            AlertStatus @default(active)
  severity          String
  triggeredAt       DateTime
  acknowledgedAt    DateTime?
  investigatingAt  DateTime?
  resolvedAt        DateTime?
  duration          BigInt?
  triggerContext    Json
  actionsTaken      Json?
  escalationLevel   Int         @default(0)
  resolution        Json?
  parentAlertId     String?
  childAlertIds     String[]
  relatedIncidentId String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  rule              AlertRule   @relation(fields: [ruleId], references: [id])

  @@index([ruleId])
  @@index([status])
  @@index([triggeredAt])
}
```

---

## Anomaly Detection

### WebhookAnomaly Model
```prisma
model WebhookAnomaly {
  id                  String              @id @default(cuid())
  anomalyType         String
  severity            AnomalySeverity
  status              AnomalyStatus       @default(active)
  description         String
  detectedAt          DateTime            @default(now())
  resolvedAt          DateTime?
  confidence          Float               @default(0.5)
  affectedEventCount  Int                 @default(0)
  metadata            Json?
  
  affectedEvents      WebhookEvent[]      @relation("AnomalyToEvents")
  
  @@index([status])
  @@index([severity])
  @@index([detectedAt])
}
```

### EventAnomaly Model
```prisma
model EventAnomaly {
  id            String   @id @default(cuid())
  eventId       String
  anomalyType   String
  severity      String
  confidence    Float
  detectedAt    DateTime @default(now())
  resolved      Boolean  @default(false)
  resolvedAt    DateTime?
  metadata      Json?
  
  @@index([eventId])
  @@index([resolved])
  @@index([detectedAt])
}
```

---

## Reconciliation System

### ReconciliationSession Model
```prisma
model ReconciliationSession {
  id            String                  @id @default(cuid())
  sessionNumber String                  @unique
  transferIds   String[]
  dateRangeStart DateTime?
  dateRangeEnd  DateTime?
  status        ReconciliationSessionStatus @default(draft)
  transferCount Int                     @default(0)
  policyCount   Int                     @default(0)
  totalAmount   Decimal                 @db.Decimal(15, 2)
  carrierTotals Json                    // {carrierName: amount, ...}
  policyDetails Json                    // Detailed policy breakdown
  notes         String?
  createdBy     String
  reviewedBy    String?
  reviewedAt    DateTime?
  finalizedBy   String?
  finalizedAt   DateTime?
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt
  
  @@index([status])
  @@index([createdAt])
  @@index([sessionNumber])
}
```

### ReconciliationExport Model
```prisma
model ReconciliationExport {
  id             String                     @id @default(cuid())
  format         String
  status         ReconciliationExportStatus @default(pending)
  transferIds    String[]                   @default([])
  sobIds         String[]                   @default([])
  coverageMonths String[]                   @default([])
  totalTransfers Int                        @default(0)
  totalPolicies  Int                        @default(0)
  carrierTotals  Json                       @default("{}")
  csvData        String?                    @db.Text
  snapshot       Json?
  fileSize       Int                        @default(0)
  fileHash       String?
  chunkCount     Int                        @default(0)
  exportedBy     String
  exportedAt     DateTime                   @default(now())
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt

  @@index([status])
  @@index([exportedAt])
}
```

### ReconciliationCheck Model
```prisma
model ReconciliationCheck {
  id                String              @id @default(cuid())
  checkType         String
  status            ReconciliationStatus @default(pending)
  recordCount       Int
  discrepancyCount  Int                 @default(0)
  startTime         DateTime            @default(now())
  endTime           DateTime?
  metadata          Json?
  resolvedBy        String?             // 'system' or user ID
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  discrepancies     ReconciliationDiscrepancy[]
  
  @@index([status])
  @@index([checkType])
  @@index([createdAt])
}
```

### ReconciliationDiscrepancy Model
```prisma
model ReconciliationDiscrepancy {
  id            String   @id @default(cuid())
  checkId       String
  resourceId    String
  resourceType  String
  field         String
  dwollaValue   String?
  localValue    String?
  resolved      Boolean  @default(false)
  resolvedAt    DateTime?
  resolvedBy    String?
  notes         String?
  createdAt     DateTime @default(now())
  
  check         ReconciliationCheck @relation(fields: [checkId], references: [id])
  
  @@index([checkId])
  @@index([resolved])
}
```

### ReconciliationJob Model
```prisma
model ReconciliationJob {
  id          String    @id @default(cuid())
  type        String
  config      Json
  status      String    @default("pending")
  startedAt   DateTime?
  completedAt DateTime?
  results     Json?
  errors      Json?
  createdBy   String
  createdAt   DateTime  @default(now())

  @@index([type])
  @@index([status])
  @@index([createdAt])
}
```

---

## Carrier & Policy Management

### CarrierMapping Model
```prisma
model CarrierMapping {
  id          String   @id @default(cuid())
  productName String   @unique
  productCode String?
  carrierName String
  carrierCode String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([productName])
  @@index([carrierName])
}
```

### Carrier Model
```prisma
model Carrier {
  id          String   @id @default(cuid())
  name        String   @unique
  code        String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  policies    Policy[]
}
```

### Transaction Model
```prisma
model Transaction {
  id         String   @id @default(cuid())
  customerId String
  amount     Decimal  @db.Decimal(10, 2)
  status     String
  date       DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  policies   Policy[]
  
  @@index([status])
  @@index([date])
}
```

### Policy Model
```prisma
model Policy {
  id            String      @id @default(cuid())
  policyNumber  String      @unique
  transactionId String
  premiumAmount Decimal     @db.Decimal(10, 2)
  carrierId     String?
  effectiveDate DateTime
  status        String
  productName   String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  carrier       Carrier?    @relation(fields: [carrierId], references: [id])
  
  @@index([transactionId])
  @@index([carrierId])
}
```

---

## HubSpot Integration Cache

### HubSpotCompanyCache Model
```prisma
model HubSpotCompanyCache {
  id              String   @id @default(cuid())
  companyId       String   @unique
  dwollaCustomerId String?
  companyName     String
  data            Json     // Full company data from HubSpot
  lastFetchedAt   DateTime
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([dwollaCustomerId])
  @@index([companyName])
  @@index([expiresAt])
}
```

### HubSpotSOBCache Model
```prisma
model HubSpotSOBCache {
  id              String   @id @default(cuid())
  sobId           String   @unique
  companyId       String
  coverageMonth   String
  amountToDraft   Decimal  @db.Decimal(15, 2)
  feeAmount       Decimal  @db.Decimal(15, 2)
  doubleBill      String?  // "Yes" or "No" for double bill flag
  data            Json     // Full SOB data from HubSpot
  lastFetchedAt   DateTime
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([companyId])
  @@index([coverageMonth])
  @@index([expiresAt])
  @@index([doubleBill])
}
```

### HubSpotPolicyCache Model
```prisma
model HubSpotPolicyCache {
  id              String   @id @default(cuid())
  policyId        String   @unique
  sobId           String
  companyId       String
  policyHolderName String
  productName     String
  monthlyCost     Decimal  @db.Decimal(15, 2)
  coverageLevel   String
  data            Json     // Full policy data from HubSpot
  lastFetchedAt   DateTime
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([sobId])
  @@index([companyId])
  @@index([productName])
  @@index([expiresAt])
}
```

---

## List Management

### ListSnapshot Model
```prisma
model ListSnapshot {
  id           String   @id @default(cuid())
  listId       Int
  listName     String
  listType     String
  memberCount  Int
  snapshotDate DateTime @default(now())
  createdAt    DateTime @default(now())

  @@unique([listId, snapshotDate])
  @@index([listId])
  @@index([snapshotDate])
}
```

### ListMetadata Model
```prisma
model ListMetadata {
  id               String    @id @default(cuid())
  listId           Int       @unique
  listName         String
  listType         String
  internalName     String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  lastSnapshotDate DateTime?
  isActive         Boolean   @default(true)

  @@index([listId])
}
```

---

## Enums

### UserRole
```prisma
enum UserRole {
  USER
  ADMIN
  SUPPORT
  TECHNICAL_SUPPORT
}
```

### SearchType
```prisma
enum SearchType {
  EMAIL
  NAME
  BUSINESS_NAME
  DWOLLA_ID
  COMBINED
}
```

### WebhookEventState
```prisma
enum WebhookEventState {
  received
  queued
  processing
  completed
  failed
  quarantined
}
```

### ValidationStatus
```prisma
enum ValidationStatus {
  valid
  invalid
  warning
}
```

### JourneyStatus
```prisma
enum JourneyStatus {
  active
  completed
  failed
  abandoned
  stuck
  rolled_back
}
```

### AlertStatus
```prisma
enum AlertStatus {
  active
  acknowledged
  investigating
  resolved
  suppressed
}
```

### ReconciliationSessionStatus
```prisma
enum ReconciliationSessionStatus {
  draft
  in_review
  finalized
  exported
  cancelled
}
```

### ReconciliationExportStatus
```prisma
enum ReconciliationExportStatus {
  pending
  in_progress
  completed
  failed
}
```

### ReconciliationStatus
```prisma
enum ReconciliationStatus {
  pending
  in_progress
  completed
  failed
  resolved
}
```

### AnomalySeverity
```prisma
enum AnomalySeverity {
  low
  medium
  high
  critical
}
```

### AnomalyStatus
```prisma
enum AnomalyStatus {
  active
  investigating
  resolved
  false_positive
}
```

---

## Key Relationships

### User Relationships
- **User** → **Account** (One-to-Many)
- **User** → **Session** (One-to-Many)
- **User** → **AuditLog** (One-to-Many)
- **User** → **LoginAttempt** (One-to-Many)
- **User** → **MFARecovery** (One-to-Many)
- **User** → **SavedSearch** (One-to-Many)
- **User** → **SearchHistory** (One-to-Many)

### Transaction Relationships
- **ACHTransaction** → **WebhookEvent** (via resourceId)
- **Transaction** → **Policy** (One-to-Many)
- **Carrier** → **Policy** (One-to-Many)

### Webhook Relationships
- **WebhookEvent** → **JourneyInstance** (One-to-Many, as start event)
- **WebhookEvent** → **JourneyStep** (One-to-Many)
- **WebhookEvent** → **WebhookEventRelation** (One-to-Many)
- **WebhookEvent** → **WebhookAnomaly** (Many-to-Many)

### Journey Relationships
- **EventJourneyDefinition** → **JourneyInstance** (One-to-Many)
- **EventJourneyDefinition** → **JourneyAnalytics** (One-to-Many)
- **JourneyInstance** → **JourneyStep** (One-to-Many)

### Reconciliation Relationships
- **ReconciliationSession** → **ReconciliationCheck** (via session tracking)
- **ReconciliationCheck** → **ReconciliationDiscrepancy** (One-to-Many)

### HubSpot Cache Relationships
- **HubSpotCompanyCache** → **HubSpotSOBCache** (via companyId)
- **HubSpotSOBCache** → **HubSpotPolicyCache** (via sobId)

---

## Indexes Summary

The schema includes comprehensive indexing for performance optimization:

### Primary Indexes
- All models have primary key indexes on `id` field
- Unique constraints on critical fields (email, dwollaId, sessionToken, etc.)

### Foreign Key Indexes
- User relationships (userId fields)
- Transaction relationships (transactionId, carrierId)
- Journey relationships (definitionId, journeyInstanceId)
- Reconciliation relationships (checkId)

### Query Optimization Indexes
- Date/time fields (createdAt, updatedAt, timestamp)
- Status fields (status, processingState, reconciliationStatus)
- Search fields (customerName, companyName, email)
- Business logic fields (amount, direction, eventType)

### Composite Indexes
- User activity tracking (userId + createdAt)
- Event processing (eventType + timestamp)
- Reconciliation tracking (status + createdAt)

---

## Data Types

### Decimal Precision
- **ACHTransaction**: `@db.Decimal(15, 2)` for amounts
- **ReconciliationSession**: `@db.Decimal(15, 2)` for totalAmount
- **HubSpotSOBCache**: `@db.Decimal(15, 2)` for amounts
- **HubSpotPolicyCache**: `@db.Decimal(15, 2)` for monthlyCost
- **Transaction**: `@db.Decimal(10, 2)` for amount
- **Policy**: `@db.Decimal(10, 2)` for premiumAmount

### JSON Fields
- **metadata**: Flexible storage for additional data
- **payload**: Webhook event payloads
- **config**: Journey and alert configurations
- **results**: Job execution results
- **carrierTotals**: Hierarchical carrier aggregation data
- **policyDetails**: Detailed policy breakdown data

### Array Fields
- **transferIds**: String array for reconciliation sessions
- **completedSteps**: String array for journey tracking
- **skippedSteps**: String array for journey tracking
- **tags**: String array for categorization
- **mfaBackupCodes**: String array for MFA recovery

---

## Schema Version History

This schema represents the current state of the Unified Customer Dashboard database. Key features include:

1. **Authentication & Authorization**: Complete user management with MFA support
2. **Transaction Processing**: Comprehensive ACH transaction tracking
3. **Webhook Management**: Robust event processing with anomaly detection
4. **Journey Tracking**: Event journey monitoring and analytics
5. **Reconciliation System**: Financial reconciliation with carrier mapping
6. **Monitoring & Alerting**: Real-time metrics and alert management
7. **HubSpot Integration**: Cached data for performance optimization
8. **Audit & Security**: Complete audit trail and security logging

The schema is designed to support high-volume transaction processing, real-time monitoring, and comprehensive reconciliation capabilities for the insurance benefits platform.
