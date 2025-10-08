# Sun Life Carrier Reconciliation — Policy Data Requirements

This document defines the new HubSpot Policy object fields needed to produce Sun Life’s carrier reconciliation reports for:
- Critical Illness
- Accident
- Dental
- Short-Term Disability (STD)
- Long-Term Disability (LTD)
- Voluntary Life & AD&D (Employee)
- Dependent Life — Spouse
- Dependent Life — Children

Notes
- All fields below are new properties on the HubSpot custom object Policies (internal snake_case names shown).
- “Type” refers to the HubSpot property type category; enumerations list allowed values.
- Existing fields we already capture are referenced under each policy for completeness.

## Critical Illness

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `employee_dob` | Employee Date of Birth | date | — | Yes | Derive employee age band (18–29, 30–39, 40–49, 50–59, 60–69, 60+) | Use with SOB coverage month for banding |
| `employee_tobacco_status` | Employee Tobacco Status | enumeration | Non-Tobacco, Tobacco | Yes | Split employee rows by tobacco | — |
| `spouse_dob` | Spouse Date of Birth | date | — | If spouse covered | Derive spouse age band (same bands as employee) | — |
| `spouse_tobacco_status` | Spouse Tobacco Status | enumeration | Non-Tobacco, Tobacco | If spouse covered | Split spouse rows by tobacco | — |
| `dependent_children_count` | Covered Children Count | number | — | If children covered | Drive “# of lives” for dependent CI row | Carrier-specific counting |
| `coverage_level_normalized` | Coverage Level (Normalized) | enumeration | Employee, Spouse, Children, Employee + Spouse, Employee + Children, Family | Yes | Canonical segmentation for CI | See Cross‑Cutting |

Reused existing
- `coverage_amount`, `coverage_amount_spouse`, `coverage_amount_children` → Volume per band/relationship
- `product_name` normalized to “Critical Illness”

## Accident

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `coverage_level_normalized` | Coverage Level (Normalized) | enumeration | Employee, Employee + Spouse, Employee + Children, Family | Yes | Group “# of lives” by level; apply flat rate per level | Canonical levels across products |

Reused existing
- `product_name` normalized to “Accident”

## Dental

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `dental_plan_tier` | Dental Plan Tier | enumeration | Basic, Preferred | Yes (if `plan_name` is not consistently Basic/Preferred) | Split tables by tier (Basic vs Preferred) | Use `plan_name` if clean; else this field |
| `coverage_level_normalized` | Coverage Level (Normalized) | enumeration | Employee, Employee + Spouse, Employee + Children, Family | Yes | Group “# of lives” and apply rate by tier+level | — |

Reused existing
- `plan_name` (if reliably “Basic/Preferred”), `product_name` normalized to “Dental”

## Short-Term Disability (STD)

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `employee_class` | Employee Class | enumeration | Agents, Staff | Yes | Split STD tables by class (Agents vs Staff) | Must come from HR/Payroll mapping |
| `std_weekly_benefit_amount` | Weekly Benefit Amount | number | — | Yes | Volume basis; applied with “Rate per 10” | Ensure correct $/10 units math |

Reused existing
- `product_name` normalized to “Short Term Disability”

## Long-Term Disability (LTD)

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `employee_class` | Employee Class | enumeration | Agents, Staff | Yes | Split LTD tables by class (Agents vs Staff) | Same as STD |
| `ltd_monthly_benefit_amount` | Monthly Benefit Amount | number | — | Yes | Volume basis; applied with “Rate per 100” | Ensure correct $/100 units math |

Reused existing
- `product_name` normalized to “Long Term Disability”

## Voluntary Life & AD&D (Employee)

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `employee_dob` | Employee Date of Birth | date | — | Yes | Derive Life age band (0–24, 25–29, 30–34, …, 75+) | Use with SOB coverage month |
| `has_ad_and_d` | Includes AD&D | bool | — | Yes | Confirm AD&D inclusion for combined lines | Drives optional separate AD&D line at flat 0.020/1000 |

Reused existing
- `coverage_amount` → Volume per $1,000
- `product_name` normalized to “Voluntary Life & AD&D”

## Dependent Life — Spouse

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `spouse_dob` | Spouse Date of Birth | date | — | Yes (if spouse covered) | Derive Life spouse age band (0–24, 25–29, …, 75+) | Use with SOB coverage month |
| `coverage_level_normalized` | Coverage Level (Normalized) | enumeration | Spouse | Yes (if spouse covered) | Consistent segmentation | Canonical |

Reused existing
- `coverage_amount_spouse` → Volume per $1,000
- `product_name` normalized to “Life - Dependent”

## Dependent Life — Children

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `dependent_children_count` | Covered Children Count | number | — | Yes (if children covered) | Accurate “# of lives” / per-family vs per-child | Carrier counting varies |
| `coverage_level_normalized` | Coverage Level (Normalized) | enumeration | Children | Yes (if children covered) | Consistent segmentation | Canonical |

Reused existing
- `coverage_amount_children` → Volume per $1,000 (or plan’s flat basis)
- `product_name` normalized to “Life - Dependent”

## Cross‑Cutting (All Sun Life Policies)

| Field (internal) | Label | Type | Values | Required | Purpose / Report Usage | Notes |
|---|---|---|---|---|---|---|
| `coverage_level_normalized` | Coverage Level (Normalized) | enumeration | Employee, Spouse, Children, Employee + Spouse, Employee + Children, Family | Yes | Single source of truth for relationship segmentation | Populate from coverage_level/display |
| `carrier_name` | Carrier Name | enumeration | Sun Life, Guardian, Sedera, Recuro, Transunion, Unum, Hanleigh, … | Recommended | Easy carrier filtering for reconciliation | Mirrors DB carrier mapping |
| `carrier_code` | Carrier Code | string | — | Optional | Integration code if needed | — |
| `commission_rate_override` | Commission Rate Override (%) | number | — | Optional | Override default 25% | Store only if policy-level override required |
| `tech_credit_rate_override` | Tech Credit Rate Override (%) | number | — | Optional | Override default 2% | Store only if policy-level override required |

## HubSpot MCP Property Type Hints

Use these when creating properties via the HubSpot MCP:
- date → `{ type: "date", fieldType: "date" }`
- number → `{ type: "number", fieldType: "number" }`
- enumeration → `{ type: "enumeration", fieldType: "select", options: [...] }`
- bool → `{ type: "bool", fieldType: "booleancheckbox" }`
- string → `{ type: "string", fieldType: "text" }`

Example (enumeration) options (value/label identical unless noted):
- `employee_tobacco_status`, `spouse_tobacco_status`: Non-Tobacco, Tobacco
- CI age bands (derived/stored only if you prefer caching, otherwise compute at run time): 18–29, 30–39, 40–49, 50–59, 60–69, 60+
- Life age bands (derived/stored only if preferred): 0–24, 25–29, 30–34, 35–39, 40–44, 45–49, 50–54, 55–59, 60–64, 65–69, 70–74, 75+
- `coverage_level_normalized`: Employee, Spouse, Children, Employee + Spouse, Employee + Children, Family
- `employee_class`: Agents, Staff
- `dental_plan_tier`: Basic, Preferred

## Minimal Code Touch Points After Property Creation

- Update HubSpot read list to include new fields: `lib/api/hubspot/client.ts` (batchRead for "2-45586773")
- Extend `HubSpotPolicyProperties`: `lib/types/hubspot.ts`
- Normalize/populate `coverage_level_normalized` and `product_name` consistently at ingestion or via workflow
- Aggregator can then bucket policies into the Sun Life report sections deterministically

---

This is scoped to Sun Life’s current report format found in:
- `Copy of Sun Life Carrier Report - July 2025.xlsx - CI - Accident - Dental.csv`
- `Copy of Sun Life Carrier Report - July 2025.xlsx - Disabiity + Life.csv`

