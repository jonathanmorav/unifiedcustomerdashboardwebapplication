import { PremiumReconciliationEngine } from '@/lib/reconciliation/premium-reconciliation-engine'
import { prisma } from '@/lib/db'
import { HubSpotService } from '@/lib/api/hubspot/service'
import { getCarrierByPolicyType } from '@/lib/reconciliation/policy-carrier-mapping'
import { log } from '@/lib/logger'
import type {
  SummaryOfBenefitsReconciliation,
  CarrierPremiumBreakdown,
  ReconciliationReport,
  ValidationResult,
  CarrierRemittanceFile
} from '@/lib/types/reconciliation'

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    aCHTransaction: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/api/hubspot/service')
jest.mock('@/lib/reconciliation/policy-carrier-mapping')
jest.mock('@/lib/logger')

describe('PremiumReconciliationEngine', () => {
  let engine: PremiumReconciliationEngine
  let mockHubSpotService: jest.Mocked<HubSpotService>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create mock HubSpotService instance
    mockHubSpotService = {
      searchCustomer: jest.fn(),
      formatCustomerData: jest.fn(),
    } as any
    
    // Mock the HubSpotService constructor to return our mock
    ;(HubSpotService as jest.MockedClass<typeof HubSpotService>).mockImplementation(() => mockHubSpotService)
    
    engine = new PremiumReconciliationEngine()
    
    // Setup default mocks
    ;(getCarrierByPolicyType as jest.Mock).mockImplementation(
      (policyType: string) => {
        const mapping: Record<string, string> = {
          'Life Insurance': 'MetLife',
          'Disability': 'Prudential',
          'Health': 'Blue Cross',
        }
        return mapping[policyType] || 'Unknown'
      }
    )
  })

  describe('runPremiumReconciliation', () => {
    it('should successfully reconcile payments with policies', async () => {
      const billingPeriod = '2024-01'
      
      // Mock transactions
      const mockTransactions = [
        {
          id: 'txn-1',
          dwollaId: 'dwolla-txn-1',
          amount: 5000,
          currency: 'USD',
          processedAt: new Date('2024-01-15'),
          customerName: 'Acme Corp',
          companyName: 'Acme Corp',
          customerId: 'dwolla-customer-1',
          customerEmail: 'billing@acme.com',
          correlationId: 'corr-1',
          invoiceNumber: 'INV-001',
          metadata: {},
        },
        {
          id: 'txn-2',
          dwollaId: 'dwolla-txn-2',
          amount: 3000,
          currency: 'USD',
          processedAt: new Date('2024-01-16'),
          customerName: 'Tech Co',
          companyName: 'Tech Co',
          customerId: 'dwolla-customer-2',
          customerEmail: 'finance@techco.com',
          correlationId: 'corr-2',
          invoiceNumber: 'INV-002',
          metadata: {},
        },
      ]

      ;(prisma.aCHTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)

      // Mock HubSpot customer data
      const mockCustomerData1 = {
        id: 'hs-123',
        name: 'Acme Corp',
        email: 'billing@acme.com',
        dwollaId: 'dwolla-customer-1',
      }

      const mockCustomerData2 = {
        id: 'hs-456',
        name: 'Tech Co',
        email: 'finance@techco.com',
        dwollaId: 'dwolla-customer-2',
      }

      mockHubSpotService.searchCustomer = jest.fn()
        .mockResolvedValueOnce(mockCustomerData1)
        .mockResolvedValueOnce(mockCustomerData2)

      // Mock formatted customer data with policies
      mockHubSpotService.formatCustomerData = jest.fn()
        .mockReturnValueOnce({
          company: {
            id: 'hs-123',
            name: 'Acme Corp',
            dwollaId: 'dwolla-customer-1',
          },
          summaryOfBenefits: [{
            policies: [
              {
                id: 'policy-1',
                productName: 'Life Insurance',
                policyNumber: 'LI-001',
                policyHolderName: 'John Doe',
                coverageAmount: 100000,
                coverageLevel: 'Basic',
                costPerMonth: 2500,
                planName: 'Term Life',
              },
              {
                id: 'policy-2',
                productName: 'Disability',
                policyNumber: 'DI-001',
                policyHolderName: 'John Doe',
                coverageAmount: 50000,
                coverageLevel: 'Standard',
                costPerMonth: 1500,
                planName: 'Long Term Disability',
              },
              {
                id: 'policy-3',
                productName: 'Life Insurance',
                policyNumber: 'LI-002',
                policyHolderName: 'Jane Smith',
                coverageAmount: 150000,
                coverageLevel: 'Premium',
                costPerMonth: 1000,
                planName: 'Whole Life',
              },
            ],
          }],
        })
        .mockReturnValueOnce({
          company: {
            id: 'hs-456',
            name: 'Tech Co',
            dwollaId: 'dwolla-customer-2',
          },
          summaryOfBenefits: [{
            policies: [
              {
                id: 'policy-4',
                productName: 'Health',
                policyNumber: 'HI-001',
                policyHolderName: 'Bob Johnson',
                coverageAmount: 200000,
                coverageLevel: 'Premium',
                costPerMonth: 3000,
                planName: 'PPO Gold',
              },
            ],
          }],
        })

      // Run reconciliation
      const result = await engine.runPremiumReconciliation(billingPeriod)

      // Verify result structure
      expect(result).toHaveProperty('report')
      expect(result).toHaveProperty('validation')
      expect(result).toHaveProperty('carrierFiles')

      // Verify report details
      expect(result.report.billingPeriod).toBe(billingPeriod)
      expect(result.report.totalCollected).toBe(8000) // 5000 + 3000
      expect(result.report.totalAccountsProcessed).toBe(2)
      expect(result.report.reconciliationSummary.totalEmployeesCovered).toBe(3) // John, Jane, Bob
      expect(result.report.reconciliationSummary.totalPolicies).toBe(4)

      // Verify carrier breakdown
      expect(result.report.carrierRemittances).toHaveLength(3) // MetLife, Prudential, Blue Cross
      
      const metLifeRemittance = result.report.carrierRemittances.find(c => c.carrier === 'MetLife')
      expect(metLifeRemittance).toBeDefined()
      expect(metLifeRemittance!.totalDue).toBe(3500) // 2500 + 1000

      const prudentialRemittance = result.report.carrierRemittances.find(c => c.carrier === 'Prudential')
      expect(prudentialRemittance).toBeDefined()
      expect(prudentialRemittance!.totalDue).toBe(1500)

      const blueCrossRemittance = result.report.carrierRemittances.find(c => c.carrier === 'Blue Cross')
      expect(blueCrossRemittance).toBeDefined()
      expect(blueCrossRemittance!.totalDue).toBe(3000)

      // Verify validation passes
      expect(result.validation.isValid).toBe(true)
      expect(result.validation.errors).toHaveLength(0)

      // Verify carrier files
      expect(result.carrierFiles).toHaveLength(3)
      expect(result.carrierFiles[0].fileFormat).toBe('csv')
    })

    it('should handle missing HubSpot customer data', async () => {
      const billingPeriod = '2024-01'
      
      const mockTransactions = [{
        id: 'txn-1',
        dwollaId: 'dwolla-txn-1',
        amount: 1000,
        currency: 'USD',
        processedAt: new Date('2024-01-15'),
        customerName: 'Unknown Corp',
        companyName: 'Unknown Corp',
        customerId: 'dwolla-unknown',
        customerEmail: 'unknown@example.com',
        correlationId: 'corr-1',
        invoiceNumber: 'INV-001',
        metadata: {},
      }]

      ;(prisma.aCHTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)
      
      // Mock no HubSpot data found
      mockHubSpotService.searchCustomer = jest.fn().mockResolvedValue(null)

      const result = await engine.runPremiumReconciliation(billingPeriod)

      // Should complete but with no accounts processed
      expect(result.report.totalAccountsProcessed).toBe(0)
      expect(result.report.totalCollected).toBe(0)
      
      // Should have validation error about missing transaction
      expect(result.validation.errors).toHaveLength(1)
      expect(result.validation.errors[0].type).toBe('data_inconsistency')
    })

    it('should detect amount mismatches in validation', async () => {
      const billingPeriod = '2024-01'
      
      const mockTransactions = [{
        id: 'txn-1',
        dwollaId: 'dwolla-txn-1',
        amount: 1000,
        currency: 'USD',
        processedAt: new Date('2024-01-15'),
        customerName: 'Test Corp',
        companyName: 'Test Corp',
        customerId: 'dwolla-test',
        customerEmail: 'test@example.com',
        correlationId: 'corr-1',
        invoiceNumber: 'INV-001',
        metadata: {},
      }]

      ;(prisma.aCHTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)

      // Mock customer with mismatched premium amounts
      mockHubSpotService.searchCustomer = jest.fn().mockResolvedValue({ id: 'hs-789' })
      mockHubSpotService.formatCustomerData = jest.fn().mockReturnValue({
        company: {
          id: 'hs-789',
          name: 'Test Corp',
          dwollaId: 'dwolla-test',
        },
        summaryOfBenefits: [{
          policies: [{
            id: 'policy-1',
            productName: 'Life Insurance',
            policyNumber: 'LI-001',
            policyHolderName: 'Test User',
            coverageAmount: 100000,
            coverageLevel: 'Basic',
            costPerMonth: 1500, // Total premium exceeds payment
            planName: 'Term Life',
          }],
        }],
      })

      const result = await engine.runPremiumReconciliation(billingPeriod)

      // Should detect amount mismatch
      expect(result.validation.isValid).toBe(false)
      expect(result.validation.errors).toHaveLength(1)
      expect(result.validation.errors[0].type).toBe('amount_mismatch')
      expect(result.validation.errors[0].message).toContain('does not match carrier remittances')
    })

    it('should warn about unmapped carriers', async () => {
      const billingPeriod = '2024-01'
      
      const mockTransactions = [{
        id: 'txn-1',
        dwollaId: 'dwolla-txn-1',
        amount: 1000,
        currency: 'USD',
        processedAt: new Date('2024-01-15'),
        customerName: 'Test Corp',
        companyName: 'Test Corp',
        customerId: 'dwolla-test',
        customerEmail: 'test@example.com',
        correlationId: 'corr-1',
        invoiceNumber: 'INV-001',
        metadata: {},
      }]

      ;(prisma.aCHTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)

      // Mock carrier mapping to return Unknown
      ;(getCarrierByPolicyType as jest.Mock).mockReturnValue('Unknown')

      mockHubSpotService.searchCustomer = jest.fn().mockResolvedValue({ id: 'hs-789' })
      mockHubSpotService.formatCustomerData = jest.fn().mockReturnValue({
        company: {
          id: 'hs-789',
          name: 'Test Corp',
          dwollaId: 'dwolla-test',
        },
        summaryOfBenefits: [{
          policies: [{
            id: 'policy-1',
            productName: 'New Insurance Type',
            policyNumber: 'NEW-001',
            policyHolderName: 'Test User',
            coverageAmount: 100000,
            coverageLevel: 'Basic',
            costPerMonth: 1000,
            planName: 'New Plan',
          }],
        }],
      })

      const result = await engine.runPremiumReconciliation(billingPeriod)

      // Should have warning about unmapped carrier
      expect(result.validation.warnings).toHaveLength(1)
      expect(result.validation.warnings[0].type).toBe('missing_mapping')
      expect(result.validation.warnings[0].message).toContain('unmapped carrier')
    })

    it('should handle date range filtering', async () => {
      const billingPeriod = '2024-01'
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      }

      await engine.runPremiumReconciliation(billingPeriod, { dateRange })

      // Verify date filtering was applied
      expect(prisma.aCHTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            processedAt: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          }),
        })
      )
    })

    it('should handle errors gracefully', async () => {
      const billingPeriod = '2024-01'
      
      // Mock database error
      ;(prisma.aCHTransaction.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(engine.runPremiumReconciliation(billingPeriod)).rejects.toThrow(
        'Database connection failed'
      )

      // Verify error was logged
      expect(log.error).toHaveBeenCalledWith(
        'Premium reconciliation failed',
        expect.any(Error),
        expect.objectContaining({ billingPeriod })
      )
    })
  })

  describe('carrier breakdown generation', () => {
    it('should correctly group policies by carrier and type', async () => {
      const billingPeriod = '2024-01'
      
      const mockTransactions = [{
        id: 'txn-1',
        dwollaId: 'dwolla-txn-1',
        amount: 10000,
        currency: 'USD',
        processedAt: new Date('2024-01-15'),
        customerName: 'Multi Policy Corp',
        companyName: 'Multi Policy Corp',
        customerId: 'dwolla-multi',
        customerEmail: 'multi@example.com',
        correlationId: 'corr-1',
        invoiceNumber: 'INV-001',
        metadata: {},
      }]

      ;(prisma.aCHTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)

      mockHubSpotService.searchCustomer = jest.fn().mockResolvedValue({ id: 'hs-multi' })
      mockHubSpotService.formatCustomerData = jest.fn().mockReturnValue({
        company: {
          id: 'hs-multi',
          name: 'Multi Policy Corp',
          dwollaId: 'dwolla-multi',
        },
        summaryOfBenefits: [{
          policies: [
            // Multiple Life Insurance policies (same carrier)
            {
              id: 'policy-1',
              productName: 'Life Insurance',
              policyNumber: 'LI-001',
              policyHolderName: 'Employee 1',
              coverageAmount: 100000,
              coverageLevel: 'Basic',
              costPerMonth: 2000,
              planName: 'Term Life',
            },
            {
              id: 'policy-2',
              productName: 'Life Insurance',
              policyNumber: 'LI-002',
              policyHolderName: 'Employee 2',
              coverageAmount: 200000,
              coverageLevel: 'Premium',
              costPerMonth: 3000,
              planName: 'Whole Life',
            },
            // Different carrier
            {
              id: 'policy-3',
              productName: 'Disability',
              policyNumber: 'DI-001',
              policyHolderName: 'Employee 1',
              coverageAmount: 50000,
              coverageLevel: 'Standard',
              costPerMonth: 1500,
              planName: 'LTD',
            },
            // Another policy type for same carrier as Life
            {
              id: 'policy-4',
              productName: 'Life Insurance',
              policyNumber: 'LI-003',
              policyHolderName: 'Employee 3',
              coverageAmount: 150000,
              coverageLevel: 'Standard',
              costPerMonth: 3500,
              planName: 'Term Life',
            },
          ],
        }],
      })

      const result = await engine.runPremiumReconciliation(billingPeriod)

      // Verify MetLife breakdown
      const metLifeRemittance = result.report.carrierRemittances.find(c => c.carrier === 'MetLife')
      expect(metLifeRemittance).toBeDefined()
      expect(metLifeRemittance!.totalDue).toBe(8500) // 2000 + 3000 + 3500
      
      const lifePolicyDetails = metLifeRemittance!.policyDetails.find(p => p.policyType === 'Life Insurance')
      expect(lifePolicyDetails).toBeDefined()
      expect(lifePolicyDetails!.count).toBe(3)
      expect(lifePolicyDetails!.totalPremium).toBe(8500)

      // Verify Prudential breakdown
      const prudentialRemittance = result.report.carrierRemittances.find(c => c.carrier === 'Prudential')
      expect(prudentialRemittance).toBeDefined()
      expect(prudentialRemittance!.totalDue).toBe(1500)
    })
  })

  describe('carrier remittance file generation', () => {
    it('should generate detailed CSV-ready data structures', async () => {
      const billingPeriod = '2024-01'
      
      const mockTransactions = [{
        id: 'txn-1',
        dwollaId: 'dwolla-txn-1',
        amount: 5000,
        currency: 'USD',
        processedAt: new Date('2024-01-15'),
        customerName: 'Test Corp',
        companyName: 'Test Corp',
        customerId: 'dwolla-test',
        customerEmail: 'test@example.com',
        correlationId: 'corr-1',
        invoiceNumber: 'INV-001',
        metadata: {},
      }]

      ;(prisma.aCHTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)

      mockHubSpotService.searchCustomer = jest.fn().mockResolvedValue({ id: 'hs-test' })
      mockHubSpotService.formatCustomerData = jest.fn().mockReturnValue({
        company: {
          id: 'hs-test',
          name: 'Test Corp',
          dwollaId: 'dwolla-test',
        },
        summaryOfBenefits: [{
          policies: [{
            id: 'policy-1',
            productName: 'Life Insurance',
            policyNumber: 'LI-TEST-001',
            policyHolderName: 'John Test',
            coverageAmount: 250000,
            coverageLevel: 'Premium',
            costPerMonth: 5000,
            planName: 'Executive Term Life',
          }],
        }],
      })

      const result = await engine.runPremiumReconciliation(billingPeriod)

      // Verify carrier file structure
      expect(result.carrierFiles).toHaveLength(1)
      const metLifeFile = result.carrierFiles[0]
      
      expect(metLifeFile.carrier).toBe('MetLife')
      expect(metLifeFile.billingPeriod).toBe(billingPeriod)
      expect(metLifeFile.totalAmount).toBe(5000)
      expect(metLifeFile.fileFormat).toBe('csv')
      
      // Verify detailed policy information
      expect(metLifeFile.policies).toHaveLength(1)
      expect(metLifeFile.policies[0].policyType).toBe('Life Insurance')
      expect(metLifeFile.policies[0].details).toHaveLength(1)
      
      const policyDetail = metLifeFile.policies[0].details[0]
      expect(policyDetail).toEqual({
        clientId: 'hs-test',
        clientName: 'Test Corp',
        employeeId: 'hs-test-John Test',
        employeeName: 'John Test',
        policyNumber: 'LI-TEST-001',
        premium: 5000,
        coverageLevel: 'Premium',
        coverageAmount: 250000,
      })
    })
  })
})