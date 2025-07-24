/**
 * ACH Return Codes Reference
 * Based on NACHA Operating Rules and Guidelines
 * https://www.nacha.org/rules
 * 
 * This comprehensive reference includes detailed explanations, scenarios,
 * and actionable guidance for each ACH return code.
 */

export interface ACHReturnCode {
  code: string;
  title: string;
  description: string;
  detailedExplanation: string;
  commonScenarios: string[];
  category: 'account' | 'authorization' | 'funding' | 'data' | 'compliance' | 'other';
  retryable: boolean;
  retryGuidance?: string;
  timeframe: string;
  userAction: string;
  internalAction: string;
  preventionTips: string[];
  relatedCodes?: string[];
  nachaReference?: string;
}

/**
 * Complete mapping of ACH return codes with granular details
 */
export const ACH_RETURN_CODES: Record<string, ACHReturnCode> = {
  // ===== FUNDING ISSUES =====
  'R01': {
    code: 'R01',
    title: 'Insufficient Funds',
    description: 'Available balance is not sufficient to cover the debit entry',
    detailedExplanation: 'The account had insufficient available balance at the time the ACH debit was presented. This includes considering any holds, pending transactions, or minimum balance requirements. The total ledger balance might appear sufficient, but the available balance (ledger minus holds/pending) was not.',
    commonScenarios: [
      'Customer made a large purchase or withdrawal after authorizing the ACH',
      'Other scheduled payments processed before this ACH debit',
      'Bank placed a hold on deposited funds that haven\'t cleared',
      'Account has minimum balance requirements that would be violated',
      'Multiple ACH debits hit the account on the same day'
    ],
    category: 'funding',
    retryable: true,
    retryGuidance: 'Can retry after 2-3 business days. Consider smaller amount or contact customer first. Maximum 2 retries recommended to avoid R10 return.',
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Check account balance and retry when funds are available. Consider setting up balance alerts.',
    internalAction: 'Flag for retry queue. Consider sending low balance notification to customer before retry. Check retry history to avoid excessive attempts.',
    preventionTips: [
      'Implement account balance verification before initiating debits',
      'Offer customers balance alerts before scheduled debits',
      'Consider allowing customers to choose their debit dates',
      'Implement smart retry logic with decreasing amounts'
    ],
    relatedCodes: ['R09'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R02': {
    code: 'R02',
    title: 'Account Closed',
    description: 'Previously active account has been closed by customer or RDFI',
    detailedExplanation: 'The account number was valid and was once open, but has since been closed. This could be voluntary (customer closed) or involuntary (bank closed for cause). The account cannot be reopened and no transactions will be accepted.',
    commonScenarios: [
      'Customer switched banks and closed old account',
      'Bank closed account due to overdrafts or policy violations',
      'Account was closed as part of fraud prevention',
      'Business account closed due to business dissolution',
      'Joint account closed due to death or divorce'
    ],
    category: 'account',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Obtain new account information from customer immediately',
    internalAction: 'Permanently flag this account as invalid. Suspend all future transactions. Initiate customer outreach for updated banking information.',
    preventionTips: [
      'Send periodic account verification requests to customers',
      'Monitor for patterns of failed transactions',
      'Implement automated outreach for payment method updates',
      'Allow customers to update banking info before scheduled debits'
    ],
    relatedCodes: ['R03', 'R04'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R03': {
    code: 'R03',
    title: 'No Account/Unable to Locate Account',
    description: 'Account number structure is valid but does not pass validation or cannot be found',
    detailedExplanation: 'The routing number is valid and the account number format appears correct, but no such account exists at the RDFI. This differs from R04 where the account number format itself is invalid. The account may have never existed or the number may contain a typo.',
    commonScenarios: [
      'Typo in account number during data entry',
      'Customer provided checking number instead of account number',
      'Account number is missing leading zeros',
      'Test account numbers used in production',
      'Account exists at different bank than routing number indicates'
    ],
    category: 'account',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Verify complete account and routing numbers with customer',
    internalAction: 'Flag account for verification. Do not retry. Require manual verification or micro-deposit validation before processing.',
    preventionTips: [
      'Implement account validation/verification before first use',
      'Use micro-deposits or instant verification services',
      'Provide clear instructions on where to find account numbers',
      'Implement check digit validation where possible'
    ],
    relatedCodes: ['R02', 'R04', 'R13'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R04': {
    code: 'R04',
    title: 'Invalid Account Number',
    description: 'Account number structure is not valid or is incomplete',
    detailedExplanation: 'The account number fails basic format validation - it may be too short, too long, contain invalid characters, or not match the RDFI\'s account numbering scheme. This is a data quality issue rather than a non-existent account issue.',
    commonScenarios: [
      'Account number contains spaces or special characters',
      'Number is too short (missing digits)',
      'Number is too long (extra digits added)',
      'Alpha characters in numeric-only field',
      'Account number from foreign bank used for US ACH'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Correct the account number format and reverify with customer',
    internalAction: 'Reject future transactions until account is corrected. Implement format validation. Log data quality issue.',
    preventionTips: [
      'Implement strict format validation on data entry',
      'Strip non-numeric characters before submission',
      'Validate account number length by bank',
      'Provide real-time validation feedback to users'
    ],
    relatedCodes: ['R03', 'R13'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  // ===== AUTHORIZATION ISSUES =====
  'R05': {
    code: 'R05',
    title: 'Unauthorized Debit to Consumer Account',
    description: 'CCD or CTX debit entry to consumer account not authorized',
    detailedExplanation: 'A corporate debit entry (CCD/CTX) was sent to a consumer account. Consumer accounts can only receive debits with proper consumer authorization (PPD/WEB). This is a SEC code mismatch and indicates improper transaction coding.',
    commonScenarios: [
      'Business account was converted to personal account',
      'Wrong SEC code selected for transaction type',
      'Consumer signed up for service meant for businesses',
      'Account ownership changed from business to individual',
      'Incorrect account type classification in system'
    ],
    category: 'authorization',
    retryable: false,
    timeframe: 'Must be returned within 60 calendar days of settlement date',
    userAction: 'Obtain proper authorization for consumer debits using appropriate SEC codes',
    internalAction: 'Review account classification. Change transaction type to PPD/WEB for consumer accounts. May need to re-obtain authorization.',
    preventionTips: [
      'Properly classify accounts as business or consumer',
      'Use correct SEC codes based on account type',
      'Implement account type verification',
      'Train staff on proper authorization requirements'
    ],
    relatedCodes: ['R07', 'R10', 'R29'],
    nachaReference: 'NACHA Rules 2.5.14, 3.5'
  },

  'R06': {
    code: 'R06',
    title: 'Returned per ODFI Request',
    description: 'ODFI requested RDFI to return the entry',
    detailedExplanation: 'The originating bank (ODFI) requested the receiving bank return this entry. This typically happens when the originator realizes an error after transmission but before settlement. This is initiated by the sender, not the receiver.',
    commonScenarios: [
      'Duplicate transaction detected after submission',
      'Wrong amount entered and caught before settlement',
      'Transaction sent to wrong customer',
      'Batch processing error discovered',
      'Compliance issue identified post-submission'
    ],
    category: 'other',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of request',
    userAction: 'Contact originating institution for details on why return was requested',
    internalAction: 'Investigation required. Check for duplicate processing or errors. Document reason for return request.',
    preventionTips: [
      'Implement duplicate detection before submission',
      'Add confirmation step for large transactions',
      'Validate batch totals before transmission',
      'Enable real-time transaction monitoring'
    ],
    nachaReference: 'NACHA Rules 3.6'
  },

  'R07': {
    code: 'R07',
    title: 'Authorization Revoked by Customer',
    description: 'Customer revoked authorization previously provided',
    detailedExplanation: 'The customer had previously authorized debits but has since revoked that authorization. This revocation must be in writing for consumer accounts. The revocation may apply to all future debits or just specific ones.',
    commonScenarios: [
      'Customer cancelled subscription or membership',
      'Divorce/separation affecting joint account authorization',
      'Customer disputed terms and revoked authorization',
      'Service cancellation not properly processed',
      'Customer sent written revocation to their bank'
    ],
    category: 'authorization',
    retryable: false,
    timeframe: 'Must be returned within 60 calendar days of settlement date',
    userAction: 'Stop debiting this account immediately. Update customer status.',
    internalAction: 'Immediately flag account as do-not-debit. Update customer status to cancelled. Ensure no future debits are attempted.',
    preventionTips: [
      'Process cancellations promptly',
      'Maintain accurate authorization records',
      'Implement real-time cancellation processing',
      'Send confirmation when authorization is revoked'
    ],
    relatedCodes: ['R08', 'R10'],
    nachaReference: 'NACHA Rules 2.5.14, 3.7'
  },

  'R08': {
    code: 'R08',
    title: 'Payment Stopped',
    description: 'Customer has placed a stop payment on this specific entry',
    detailedExplanation: 'The customer contacted their bank and placed a stop payment order on this specific debit. Unlike R07 (revocation), this typically applies to a single transaction rather than ongoing authorization. Banks charge fees for stop payments.',
    commonScenarios: [
      'Dispute over product/service quality',
      'Customer claims transaction is unauthorized',
      'Duplicate charge customer wants to stop',
      'Customer cancelled but debit still processed',
      'Timing issue with cancellation request'
    ],
    category: 'authorization',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Contact customer regarding payment issue. Do not retry.',
    internalAction: 'Mark transaction as disputed. Initiate customer service outreach. Review if this indicates broader issues.',
    preventionTips: [
      'Provide clear cancellation procedures',
      'Process refunds promptly when warranted',
      'Maintain good customer communication',
      'Resolve disputes before customer contacts bank'
    ],
    relatedCodes: ['R07', 'R10'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R09': {
    code: 'R09',
    title: 'Uncollected Funds',
    description: 'Sufficient balance exists but funds are not yet collected',
    detailedExplanation: 'The account shows sufficient ledger balance, but the funds are still in collection (not yet available). This happens with recent deposits that haven\'t cleared. The bank\'s funds availability policy determines when deposited funds become available.',
    commonScenarios: [
      'Large check deposit still being held',
      'ACH credit received same day as debit attempt',
      'International wire still being processed',
      'Mobile deposit hold period not expired',
      'Bank\'s extended hold on suspicious deposits'
    ],
    category: 'funding',
    retryable: true,
    retryGuidance: 'Retry in 3-5 business days after funds clear. Consider time of day for retry.',
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Wait for funds to clear (typically 2-5 business days) then retry',
    internalAction: 'Add to retry queue with 3-5 day delay. Consider retry at different time of day. May succeed without customer action.',
    preventionTips: [
      'Time debits several days after expected deposits',
      'Educate customers about fund availability',
      'Consider offering debit date flexibility',
      'Monitor patterns of R09 returns by customer'
    ],
    relatedCodes: ['R01'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R10': {
    code: 'R10',
    title: 'Customer Advises Not Authorized',
    description: 'Customer claims the debit was not authorized or the authorization is improper',
    detailedExplanation: 'The customer contacted their bank claiming they did not authorize this debit or that the debit doesn\'t match their authorization (wrong amount, date, or frequency). Banks must accept customer\'s claim and return the transaction.',
    commonScenarios: [
      'Customer doesn\'t recognize company name on statement',
      'Amount differs from what customer authorized',
      'Debit occurred after cancellation',
      'Frequency differs from agreement (weekly vs monthly)',
      'Customer forgot about authorization (subscription)'
    ],
    category: 'authorization',
    retryable: false,
    timeframe: 'Must be returned within 60 calendar days of settlement date',
    userAction: 'Provide proof of authorization or cease debits. Contact customer immediately.',
    internalAction: 'Stop all debits immediately. Gather authorization documentation. Prepare for possible dispute. Consider preemptive refund.',
    preventionTips: [
      'Use clear, recognizable statement descriptors',
      'Send payment reminders before debiting',
      'Maintain detailed authorization records',
      'Confirm authorization for amount changes',
      'Send receipts after successful debits'
    ],
    relatedCodes: ['R07', 'R29'],
    nachaReference: 'NACHA Rules 2.5.14, 3.7'
  },

  // ===== TECHNICAL/SYSTEM ISSUES =====
  'R11': {
    code: 'R11',
    title: 'Check Truncation Entry Returned',
    description: 'Used when returning a check truncation entry',
    detailedExplanation: 'This code is used specifically for returning electronic check (RCK/ARC) entries. The physical check that was converted to ACH had issues that require it to be returned. This preserves the original check return reason.',
    commonScenarios: [
      'NSF on converted check',
      'Stop payment on original check number',
      'Account closed after check was written',
      'Check conversion error detected',
      'Original check had endorsement issues'
    ],
    category: 'other',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Process as paper check return. Follow check return procedures.',
    internalAction: 'Handle as check return, not ACH return. May need different collection procedures.',
    preventionTips: [
      'Verify check eligibility before conversion',
      'Validate account status before conversion',
      'Maintain check images for reference',
      'Follow proper check conversion procedures'
    ],
    relatedCodes: ['R31'],
    nachaReference: 'NACHA Rules 2.5.14, 4.3'
  },

  'R12': {
    code: 'R12',
    title: 'Account Sold to Another DFI',
    description: 'Financial institution no longer maintains this account',
    detailedExplanation: 'The account has been transferred to another financial institution, typically due to bank merger, acquisition, or branch sale. The routing number is now invalid for this account. New routing information is needed.',
    commonScenarios: [
      'Bank merger or acquisition',
      'Branch location sold to another bank',
      'Account portfolio transferred',
      'Credit union merger',
      'Failed bank assets assumed by another institution'
    ],
    category: 'account',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Obtain new routing and account numbers from customer',
    internalAction: 'Update bank routing information. Check if other customers affected by same bank change. Request updated information.',
    preventionTips: [
      'Monitor bank merger announcements',
      'Maintain awareness of routing number changes',
      'Batch update affected customers when known',
      'Proactively request updated info during mergers'
    ],
    relatedCodes: ['R02', 'R13'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R13': {
    code: 'R13',
    title: 'Invalid ACH Routing Number',
    description: 'Routing number is not valid',
    detailedExplanation: 'The routing transit number (RTN) is not a valid ACH participant. This could be a non-existent number, a wire-only routing number, or a routing number that doesn\'t accept ACH transactions. Check digit validation would catch most of these.',
    commonScenarios: [
      'Wire routing number used instead of ACH routing',
      'Routing number check digit failure',
      'International routing number used',
      'Old routing number no longer valid',
      'Typo in routing number entry'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Verify and correct routing number with customer',
    internalAction: 'Validate routing numbers against ACH participant database. Implement check digit validation. Verify ACH vs wire routing.',
    preventionTips: [
      'Use routing number validation service',
      'Implement check digit verification',
      'Maintain current routing number database',
      'Clearly distinguish ACH vs wire routing'
    ],
    relatedCodes: ['R03', 'R04', 'R28'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R14': {
    code: 'R14',
    title: 'Representative Payee Deceased',
    description: 'Representative payee is deceased or unable to continue',
    detailedExplanation: 'The person authorized to receive payments on behalf of the beneficiary (representative payee) has died or can no longer act in that capacity. Common with government benefits or legal guardianship situations.',
    commonScenarios: [
      'Guardian of minor has passed away',
      'Power of attorney holder deceased',
      'Social Security representative payee died',
      'Trustee of trust account deceased',
      'Conservator no longer able to serve'
    ],
    category: 'account',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Stop payments and await new representative payee information',
    internalAction: 'Cease all payments immediately. Flag account for special handling. May require legal documentation for reactivation.',
    preventionTips: [
      'Maintain emergency contact information',
      'Regular verification of representative status',
      'Document succession plans where applicable',
      'Monitor for returned mail or communications'
    ],
    relatedCodes: ['R15'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R15': {
    code: 'R15',
    title: 'Beneficiary or Account Holder Deceased',
    description: 'Beneficiary or account holder is deceased',
    detailedExplanation: 'The named account holder or beneficiary has died. The bank has been notified of the death and must return all transactions. No transactions can be processed until estate matters are resolved.',
    commonScenarios: [
      'Individual account holder passed away',
      'Joint account holder died (depending on account type)',
      'Beneficiary of payment deceased',
      'Business owner died (sole proprietorship)',
      'Trust beneficiary deceased'
    ],
    category: 'account',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Cease all activity on this account permanently',
    internalAction: 'Immediately stop all current and future transactions. Flag account as deceased. Follow company procedures for deceased accounts.',
    preventionTips: [
      'Monitor for death notifications',
      'Establish procedures for deceased accounts',
      'Maintain beneficiary information where applicable',
      'Consider account ownership structures'
    ],
    relatedCodes: ['R14'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R16': {
    code: 'R16',
    title: 'Account Frozen',
    description: 'Account is frozen due to legal action or OFAC match',
    detailedExplanation: 'The account has been frozen by legal order (levy, garnishment, court order) or due to OFAC (Office of Foreign Assets Control) compliance. No debits or credits are allowed until the freeze is lifted. This is serious and requires compliance attention.',
    commonScenarios: [
      'Court-ordered freeze or garnishment',
      'IRS or state tax levy',
      'OFAC sanctions match',
      'Suspicious activity investigation',
      'Divorce or legal dispute freeze'
    ],
    category: 'compliance',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Do not retry - account is under legal restriction. Consult legal/compliance.',
    internalAction: 'Flag for compliance review. Do not attempt any transactions. May need to report to authorities. Consult legal counsel.',
    preventionTips: [
      'Implement OFAC screening before transactions',
      'Monitor for legal notices',
      'Maintain compliance procedures',
      'Train staff on frozen account handling'
    ],
    relatedCodes: ['R20'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R17': {
    code: 'R17',
    title: 'File Record Edit Criteria',
    description: 'Entry does not meet ACH file format specifications',
    detailedExplanation: 'The ACH entry failed critical edit checks at the RDFI. This indicates the transaction doesn\'t conform to NACHA file format specifications. This is typically a technical/formatting issue rather than an account issue.',
    commonScenarios: [
      'Invalid characters in required fields',
      'Improper field alignment or padding',
      'Missing required fields',
      'Invalid transaction or batch codes',
      'Addenda record count mismatch'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Review and correct file format errors with technical team',
    internalAction: 'Technical review required. Check ACH file generation process. Validate against NACHA specifications. May affect entire batch.',
    preventionTips: [
      'Use NACHA-compliant ACH software',
      'Implement file validation before submission',
      'Regular testing of file formats',
      'Stay updated on NACHA format changes'
    ],
    relatedCodes: ['R19', 'R25', 'R26'],
    nachaReference: 'NACHA Rules Appendix 1-2'
  },

  // ===== DATA/FORMATTING ISSUES =====
  'R18': {
    code: 'R18',
    title: 'Improper Effective Entry Date',
    description: 'Effective entry date is more than two days in past or future',
    detailedExplanation: 'The effective entry date on the transaction is outside the acceptable window. For most transactions, this date cannot be more than one banking day in the future or in the past. This often indicates a processing delay or incorrect date calculation.',
    commonScenarios: [
      'Weekend/holiday date calculation errors',
      'Batch held and submitted late',
      'Time zone confusion',
      'Incorrect business day calculation',
      'System date configuration error'
    ],
    category: 'data',
    retryable: true,
    retryGuidance: 'Recalculate effective date and resubmit with correct date',
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Resubmit with correct effective date',
    internalAction: 'Fix date calculation logic. Check for weekend/holiday handling. Verify system date settings. May affect multiple transactions.',
    preventionTips: [
      'Implement proper banking day calculations',
      'Account for Federal Reserve holidays',
      'Validate effective dates before submission',
      'Monitor batch processing delays'
    ],
    relatedCodes: ['R17'],
    nachaReference: 'NACHA Rules 1.2, 8.3'
  },

  'R19': {
    code: 'R19',
    title: 'Amount Field Error',
    description: 'Amount field is improperly formatted',
    detailedExplanation: 'The dollar amount field contains invalid data or formatting. ACH amounts must be numeric, right-justified, with implied decimal (e.g., 0000001000 for $10.00). No decimal points, commas, or currency symbols are allowed.',
    commonScenarios: [
      'Decimal point included in amount field',
      'Comma separators in amount',
      'Currency symbol included',
      'Negative sign in wrong position',
      'Alpha characters in amount field'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Correct amount field formatting and resubmit',
    internalAction: 'Review amount formatting logic. Ensure proper numeric conversion. Check for data type issues in amount handling.',
    preventionTips: [
      'Validate amount format before submission',
      'Convert amounts to proper ACH format',
      'Remove all formatting from amounts',
      'Test edge cases (zero, max amounts)'
    ],
    relatedCodes: ['R17', 'R26'],
    nachaReference: 'NACHA Rules Appendix 1'
  },

  'R20': {
    code: 'R20',
    title: 'Non-Transaction Account',
    description: 'ACH entry to non-transaction account',
    detailedExplanation: 'The account exists but is not allowed to accept ACH transactions. This could be a savings account with transaction limits exceeded, a time deposit (CD), or a loan account that only accepts specific payment types.',
    commonScenarios: [
      'Savings account exceeded monthly transaction limit',
      'Certificate of Deposit (CD) account',
      'Loan account that only accepts direct payments',
      'Investment account not enabled for ACH',
      'Minor\'s account with restrictions'
    ],
    category: 'account',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Obtain transaction-enabled account from customer',
    internalAction: 'Flag account type as non-transaction. Request checking account information. May need different payment method.',
    preventionTips: [
      'Verify account accepts ACH during setup',
      'Educate customers on account requirements',
      'Default to checking accounts for ACH',
      'Implement account type verification'
    ],
    relatedCodes: ['R16', 'R35'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R21': {
    code: 'R21',
    title: 'Invalid Company Identification',
    description: 'Company ID is not valid',
    detailedExplanation: 'The Company Identification field in the batch header doesn\'t match what the RDFI has on file for authorized originators. This field must match exactly what was provided during originator setup.',
    commonScenarios: [
      'Company ID changed without updating bank',
      'Wrong company ID used for division/subsidiary',
      'Test vs production company ID mismatch',
      'Typo in company ID field',
      'Using tax ID instead of assigned company ID'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Verify correct company ID with your bank',
    internalAction: 'Verify company ID configuration. Check if different IDs needed for different banks or products. Update ODFI records if needed.',
    preventionTips: [
      'Document all company IDs by bank and product',
      'Verify company ID during setup',
      'Use consistent company ID across systems',
      'Regular audit of originator information'
    ],
    relatedCodes: ['R22'],
    nachaReference: 'NACHA Rules 2.2.1'
  },

  'R22': {
    code: 'R22',
    title: 'Invalid Individual ID Number',
    description: 'Individual ID number is not valid',
    detailedExplanation: 'The Individual ID field contains invalid data. This field is used to identify the receiver and must follow specific formatting based on the SEC code (e.g., SSN for certain types, customer number for others).',
    commonScenarios: [
      'SSN format incorrect or invalid',
      'Customer ID doesn\'t match bank records',
      'Wrong ID type for SEC code',
      'Special characters in ID field',
      'ID field left blank when required'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Correct individual identification number format',
    internalAction: 'Review ID requirements for SEC code used. Verify ID format and content. May need to update customer records.',
    preventionTips: [
      'Understand ID requirements by SEC code',
      'Validate ID format before submission',
      'Use consistent ID schemes',
      'Document ID requirements clearly'
    ],
    relatedCodes: ['R21'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R23': {
    code: 'R23',
    title: 'Credit Entry Refused by Receiver',
    description: 'Receiver refused the credit entry',
    detailedExplanation: 'The account holder has instructed their bank to return this credit. Unlike debits, receivers have the right to refuse credit entries. This might be due to tax implications, legal issues, or simply not wanting the funds.',
    commonScenarios: [
      'Customer refusing refund for tax reasons',
      'Incorrect payment amount receiver won\'t accept',
      'Legal restriction on receiving funds',
      'Business policy to refuse certain credits',
      'Accidental payment receiver wants to return'
    ],
    category: 'authorization',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Contact receiver about credit refusal. Do not retry.',
    internalAction: 'Document refusal reason. Update customer preferences. May need alternative payment method. Consider escheatment requirements.',
    preventionTips: [
      'Verify receiver wants credit before sending',
      'Confirm payment amounts before processing',
      'Understand receiver\'s credit policies',
      'Provide advance notice of credits'
    ],
    relatedCodes: ['R31'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R24': {
    code: 'R24',
    title: 'Duplicate Entry',
    description: 'Duplicate of an entry previously received',
    detailedExplanation: 'The RDFI detected this as a duplicate transaction. Banks check various fields (amount, date, trace number) to identify duplicates. This protection prevents double-charging but can sometimes flag legitimate repeated transactions.',
    commonScenarios: [
      'Same file submitted twice',
      'Retry attempted too quickly',
      'Recurring payment flagged as duplicate',
      'System error causing double submission',
      'Manual entry duplicating automated entry'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Verify if truly duplicate. Use unique trace numbers.',
    internalAction: 'Investigate duplicate detection. Verify transaction wasn\'t already processed. Implement better duplicate prevention.',
    preventionTips: [
      'Use unique trace numbers for each transaction',
      'Implement duplicate detection before submission',
      'Track submission status carefully',
      'Allow sufficient time between retries'
    ],
    relatedCodes: ['R06'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  // ===== ADDENDA AND SPECIAL ENTRY ISSUES =====
  'R25': {
    code: 'R25',
    title: 'Addenda Error',
    description: 'Addenda record indicator is incorrect',
    detailedExplanation: 'The addenda record indicator in the entry detail record doesn\'t match the actual presence or absence of addenda records. If indicator says addenda exists, addenda records must follow. This is a file structure error.',
    commonScenarios: [
      'Indicator shows addenda but none included',
      'Addenda present but indicator shows none',
      'Wrong number of addenda records',
      'Addenda record type mismatch',
      'Missing required addenda for SEC code'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Correct addenda record indicator and structure',
    internalAction: 'Review file generation logic for addenda handling. Ensure indicator matches actual addenda presence. Check requirements by SEC code.',
    preventionTips: [
      'Validate addenda indicator logic',
      'Test with and without addenda records',
      'Understand addenda requirements by type',
      'Implement file structure validation'
    ],
    relatedCodes: ['R17', 'R26'],
    nachaReference: 'NACHA Rules Appendix 1-2'
  },

  'R26': {
    code: 'R26',
    title: 'Mandatory Field Error',
    description: 'Required field contains invalid or missing data',
    detailedExplanation: 'A mandatory field required by NACHA rules is missing, blank, or contains invalid data. Different SEC codes have different mandatory fields. This validation happens at the RDFI level.',
    commonScenarios: [
      'Required field left blank',
      'Spaces in numeric-only field',
      'Invalid code in mandatory field',
      'Wrong field length for fixed-width field',
      'Required addenda information missing'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Identify and correct mandatory field data',
    internalAction: 'Review NACHA requirements for SEC code. Audit all mandatory fields. Implement validation for required fields.',
    preventionTips: [
      'Document mandatory fields by SEC code',
      'Implement pre-submission validation',
      'Regular NACHA compliance reviews',
      'Automated field validation rules'
    ],
    relatedCodes: ['R17', 'R19'],
    nachaReference: 'NACHA Rules Appendix 1-2'
  },

  'R27': {
    code: 'R27',
    title: 'Trace Number Error',
    description: 'Trace number is missing or invalid',
    detailedExplanation: 'The trace number must be unique and follow specific formatting (routing number + sequence). This field is critical for tracking and research. Duplicates or invalid formats will be rejected.',
    commonScenarios: [
      'Duplicate trace number used',
      'Trace number doesn\'t match routing number',
      'Sequence number portion invalid',
      'Trace number all zeros',
      'Wrong length or format'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Correct trace number generation logic',
    internalAction: 'Review trace number generation. Ensure uniqueness and proper format. Verify routing number portion matches.',
    preventionTips: [
      'Implement proper trace number generation',
      'Ensure trace numbers are unique',
      'Include date in sequence for uniqueness',
      'Validate trace number format'
    ],
    relatedCodes: ['R17'],
    nachaReference: 'NACHA Rules 8.3'
  },

  'R28': {
    code: 'R28',
    title: 'Routing Number Check Digit Error',
    description: 'Routing number check digit is incorrect',
    detailedExplanation: 'The routing number fails check digit validation. The last digit of a routing number is calculated from the first eight digits using a specific algorithm. This catches most typos in routing numbers.',
    commonScenarios: [
      'Typo in routing number entry',
      'Transcription error from paper',
      'Wrong routing number format used',
      'Corrupted data transmission',
      'Manual entry error'
    ],
    category: 'data',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Verify and correct routing number with customer',
    internalAction: 'Implement check digit validation. Verify routing number with customer. Check for common transposition errors.',
    preventionTips: [
      'Always validate check digits',
      'Implement real-time routing validation',
      'Double-entry verification for manual input',
      'Use routing number lookup services'
    ],
    relatedCodes: ['R13'],
    nachaReference: 'NACHA Rules Appendix 1'
  },

  'R29': {
    code: 'R29',
    title: 'Corporate Customer Advises Not Authorized',
    description: 'Corporate customer has not authorized this debit',
    detailedExplanation: 'Similar to R10 but specifically for corporate accounts. The business has notified their bank that this debit was not authorized. Corporate accounts have different authorization requirements and dispute rights than consumer accounts.',
    commonScenarios: [
      'Business cancelled service but debit continued',
      'Debit amount exceeds authorized limit',
      'Authorization expired',
      'Wrong business account debited',
      'Unauthorized employee signed agreement'
    ],
    category: 'authorization',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of notification',
    userAction: 'Provide proof of authorization or cease debits immediately',
    internalAction: 'Stop all debits. Gather corporate authorization documents. Verify signatory authority. Review business authorization procedures.',
    preventionTips: [
      'Verify corporate signatory authority',
      'Maintain detailed authorization records',
      'Implement authorization limits and controls',
      'Regular reauthorization for corporate accounts'
    ],
    relatedCodes: ['R05', 'R10'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  // ===== SPECIAL TRANSACTION TYPES =====
  'R30': {
    code: 'R30',
    title: 'RDFI Not Participant in Check Truncation',
    description: 'Financial institution does not accept truncated checks',
    detailedExplanation: 'The receiving bank doesn\'t participate in check truncation programs (ARC/BOC/POP). Not all banks accept electronic check conversions. You must use traditional paper check processing for this bank.',
    commonScenarios: [
      'Small bank not setup for check truncation',
      'Credit union without check conversion capability',
      'International bank with US presence',
      'Bank opted out of check programs',
      'Temporary suspension of check truncation'
    ],
    category: 'other',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Use alternative payment method (paper check or standard ACH)',
    internalAction: 'Flag bank as non-participating. Route to paper check processing. Update bank participation database.',
    preventionTips: [
      'Maintain list of participating banks',
      'Check participation before conversion',
      'Have fallback to paper processing',
      'Regular updates of bank capabilities'
    ],
    relatedCodes: ['R31'],
    nachaReference: 'NACHA Rules Section 4'
  },

  'R31': {
    code: 'R31',
    title: 'Permissible Return Entry',
    description: 'RDFI may return CCD or CTX entry',
    detailedExplanation: 'The receiving bank is exercising its right to return a corporate credit entry. Banks can refuse corporate credits for various reasons including risk management, compliance concerns, or business policies.',
    commonScenarios: [
      'Bank\'s risk assessment flags transaction',
      'Compliance concerns with transaction',
      'Bank policy against certain credit types',
      'Account restrictions for credits',
      'AML/KYC requirements not met'
    ],
    category: 'other',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Contact RDFI for specific return reason and alternatives',
    internalAction: 'Document return. May need alternative payment method. Review if pattern exists with specific banks.',
    preventionTips: [
      'Understand bank-specific policies',
      'Pre-notify large corporate credits',
      'Maintain good bank relationships',
      'Have alternative payment methods ready'
    ],
    relatedCodes: ['R23'],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R32': {
    code: 'R32',
    title: 'RDFI Non-Settlement',
    description: 'RDFI is not able to settle entry',
    detailedExplanation: 'The receiving bank cannot settle this entry due to technical or operational issues. This is typically temporary and might be due to system issues, maintenance, or settlement problems between banks.',
    commonScenarios: [
      'Bank system maintenance or outage',
      'Settlement system technical issues',
      'Federal Reserve connection problems',
      'Bank holiday in receiving bank\'s region',
      'Temporary suspension of operations'
    ],
    category: 'other',
    retryable: true,
    retryGuidance: 'May retry after bank resolves settlement issues. Contact RDFI for timeline.',
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Contact RDFI for settlement issue timeline',
    internalAction: 'Monitor for resolution. May affect multiple transactions to same bank. Consider temporary routing to different bank if available.',
    preventionTips: [
      'Monitor bank operational statuses',
      'Have contingency for bank outages',
      'Diversify banking relationships',
      'Build retry logic for temporary issues'
    ],
    nachaReference: 'NACHA Rules 2.5.14'
  },

  'R33': {
    code: 'R33',
    title: 'Return of XCK Entry',
    description: 'RDFI determines XCK entry is ineligible',
    detailedExplanation: 'The destroyed check entry (XCK) doesn\'t meet eligibility requirements. XCK entries have specific rules about check destruction timing and notification requirements.',
    commonScenarios: [
      'Check not properly destroyed per requirements',
      'Notification timing requirements not met',
      'Check already processed differently',
      'Ineligible check type for XCK',
      'Documentation requirements not satisfied'
    ],
    category: 'other',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Review XCK eligibility requirements and documentation',
    internalAction: 'Audit XCK procedures. Ensure compliance with all XCK requirements. May need different processing method.',
    preventionTips: [
      'Strict adherence to XCK requirements',
      'Proper documentation of check destruction',
      'Timely notifications as required',
      'Regular XCK compliance audits'
    ],
    relatedCodes: ['R11'],
    nachaReference: 'NACHA Rules Section 4.4'
  },

  'R34': {
    code: 'R34',
    title: 'Limited Participation DFI',
    description: 'RDFI participation limited by agreement',
    detailedExplanation: 'The receiving bank has limited participation in ACH networks, possibly only receiving government payments or having restrictions on commercial transactions. Their ACH agreement limits what they can process.',
    commonScenarios: [
      'Bank only accepts federal payments',
      'Limited to specific SEC codes',
      'Restricted to certain originators',
      'International bank with restrictions',
      'Special purpose financial institution'
    ],
    category: 'other',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Use alternative payment method for this institution',
    internalAction: 'Flag institution as limited participation. Identify what transactions they do accept. Route appropriately.',
    preventionTips: [
      'Maintain database of bank limitations',
      'Check participation before processing',
      'Have alternative payment methods',
      'Educate customers on limitations'
    ],
    relatedCodes: ['R30'],
    nachaReference: 'NACHA Rules 2.2'
  },

  'R35': {
    code: 'R35',
    title: 'Return of Improper Debit Entry',
    description: 'Debit entry not permitted for this account type',
    detailedExplanation: 'The account type doesn\'t permit ACH debits. This is different from R20 (transaction limits) - this account type fundamentally doesn\'t allow ACH debits per bank policy or regulations.',
    commonScenarios: [
      'HSA account without debit authorization',
      'Trust account with debit restrictions',
      'Minor account with parental controls',
      'Investment account (ACH credit only)',
      'Special purpose government account'
    ],
    category: 'account',
    retryable: false,
    timeframe: 'Must be returned within 2 banking days of settlement date',
    userAction: 'Obtain authorization for different account or payment method',
    internalAction: 'Flag account as no-debit. Request alternative account for debits. May need different payment arrangement.',
    preventionTips: [
      'Verify account capabilities during setup',
      'Understand account type restrictions',
      'Default to standard checking for debits',
      'Clear communication about requirements'
    ],
    relatedCodes: ['R20'],
    nachaReference: 'NACHA Rules 2.5.14'
  }
};

/**
 * Get detailed information about a specific return code
 */
export function getReturnCodeInfo(code: string): ACHReturnCode {
  const upperCode = code?.toUpperCase();
  return ACH_RETURN_CODES[upperCode] || {
    code: upperCode || 'UNKNOWN',
    title: 'Unknown Return Code',
    description: 'Return code not found in standard ACH return codes',
    detailedExplanation: 'This return code is not recognized as a standard NACHA return code. It may be a bank-specific code or an error. Contact your bank or Dwolla support for clarification.',
    commonScenarios: ['Non-standard bank return code', 'Data transmission error', 'New return code not yet added to system'],
    category: 'other',
    retryable: false,
    timeframe: 'Unknown',
    userAction: 'Contact support for assistance with this return code',
    internalAction: 'Log unknown return code. Contact bank or processor for clarification. Update return code database if legitimate.',
    preventionTips: ['Keep return code database updated', 'Monitor for new NACHA rules']
  };
}

/**
 * Check if a return code indicates the transaction can be retried
 */
export function isRetryable(code: string): boolean {
  return getReturnCodeInfo(code).retryable;
}

/**
 * Get retry guidance for a specific return code
 */
export function getRetryGuidance(code: string): string | null {
  const info = getReturnCodeInfo(code);
  return info.retryable ? (info.retryGuidance || 'Transaction can be retried') : null;
}

/**
 * Get all return codes by category
 */
export function getReturnCodesByCategory(category: ACHReturnCode['category']): ACHReturnCode[] {
  return Object.values(ACH_RETURN_CODES).filter(rc => rc.category === category);
}

/**
 * Get return codes that commonly occur together
 */
export function getRelatedReturnCodes(code: string): ACHReturnCode[] {
  const info = getReturnCodeInfo(code);
  if (!info.relatedCodes || info.relatedCodes.length === 0) return [];
  
  return info.relatedCodes
    .map(relatedCode => getReturnCodeInfo(relatedCode))
    .filter(rc => rc.code !== 'UNKNOWN');
}

/**
 * Search return codes by keyword
 */
export function searchReturnCodes(keyword: string): ACHReturnCode[] {
  const lowerKeyword = keyword.toLowerCase();
  return Object.values(ACH_RETURN_CODES).filter(rc => 
    rc.code.toLowerCase().includes(lowerKeyword) ||
    rc.title.toLowerCase().includes(lowerKeyword) ||
    rc.description.toLowerCase().includes(lowerKeyword) ||
    rc.detailedExplanation.toLowerCase().includes(lowerKeyword) ||
    rc.commonScenarios.some(scenario => scenario.toLowerCase().includes(lowerKeyword))
  );
}

/**
 * Get statistics about return codes
 */
export function getReturnCodeStats() {
  const codes = Object.values(ACH_RETURN_CODES);
  return {
    total: codes.length,
    byCategory: {
      account: codes.filter(rc => rc.category === 'account').length,
      authorization: codes.filter(rc => rc.category === 'authorization').length,
      funding: codes.filter(rc => rc.category === 'funding').length,
      data: codes.filter(rc => rc.category === 'data').length,
      compliance: codes.filter(rc => rc.category === 'compliance').length,
      other: codes.filter(rc => rc.category === 'other').length
    },
    retryable: codes.filter(rc => rc.retryable).length,
    nonRetryable: codes.filter(rc => !rc.retryable).length
  };
}

/**
 * Common return code groupings for UI display
 */
export const RETURN_CODE_GROUPS = {
  'Insufficient Funds': ['R01', 'R09'],
  'Account Issues': ['R02', 'R03', 'R04', 'R12', 'R14', 'R15', 'R16', 'R20', 'R35'],
  'Authorization Issues': ['R05', 'R07', 'R08', 'R10', 'R23', 'R29'],
  'Data/Format Errors': ['R13', 'R17', 'R18', 'R19', 'R21', 'R22', 'R24', 'R25', 'R26', 'R27', 'R28'],
  'Compliance/Legal': ['R16'],
  'Technical/System': ['R06', 'R11', 'R30', 'R31', 'R32', 'R33', 'R34']
};

/**
 * Get human-readable category name
 */
export function getCategoryDisplayName(category: ACHReturnCode['category']): string {
  const displayNames = {
    account: 'Account Issues',
    authorization: 'Authorization Issues',
    funding: 'Funding Issues',
    data: 'Data/Format Errors',
    compliance: 'Compliance/Legal',
    other: 'Other/Technical'
  };
  return displayNames[category] || category;
}