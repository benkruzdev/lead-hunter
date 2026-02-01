# LeadHunter Product Specification – V2 (Value Expansion)

> This document extends **PRODUCT_SPEC.md (V1)**.
> It does **not replace** existing specs; it **builds on top of them**.
>
> Focus: legal safety, trust, retention, power-user workflows, and long-term scalability.

---

## 0. Scope & Principles

### 0.1 What V2 Is

* A **value-expansion layer** on top of completed V1 (Sections 5.x & 6.x)
* UI-first, backend-agnostic where possible
* Designed to:

  * Increase trust
  * Improve retention
  * Strengthen sales workflows
  * Clearly differentiate from scraping-based tools

### 0.2 Hard Rules

* Existing UI / component patterns are the **single source of truth**
* No new visual design language
* All text must support **i18n (TR / EN)**
* Backend dependencies must be **explicitly marked**
* Empty states are valid and intentional

---

## 1. Legal Safety & Transparency Layer

### 1.1 Data Source Transparency Indicators

**Description**
Visual indicators that clearly communicate data origin and legal safety.

**UI Locations**

* Search Results Header
* Pricing / Credits pages
* Onboarding highlights

**Indicators**

* Google Official APIs
* No scraping
* GDPR / KVKK safe

**User Value**

* Reduces trust friction
* Creates "platform that won’t get shut down" perception

**Backend Dependency**: ❌ No

---

### 1.2 Compliance & Legal Center Page

**Description**
A static informational page explaining what LeadHunter does and does not do.

**Content Sections**

* What data sources are used
* What is explicitly NOT done
* Data usage principles (not legal promises)

**User Value**

* Strong differentiation vs grey-area tools
* Improves enterprise / agency trust

**Backend Dependency**: ❌ No

---

## 2. Search Intelligence & Retention

### 2.1 Search Presets (Saved Filters)

**Description**
Users can save frequently used search configurations.

**Features**

* Save current filter set
* Rename / delete presets
* Show recent presets

**Storage (Phase-1)**

* localStorage

**User Value**

* Faster workflows
* Power-user retention

**Backend Dependency**: ❌ No (Phase-1)

---

### 2.2 Search Intelligence Bar

**Description**
Contextual metadata about the current search.

**Displayed Info**

* Cache status (Hit / Fresh)
* Estimated credit cost
* Data freshness

**Phase-1**

* UI placeholders + tooltips

**Backend Dependency**: ⚠️ Yes (for real data)

---

## 3. Lead Quality Signals

### 3.1 Lead Quality Badges

**Description**
Visual badges indicating lead freshness and activity.

**Badge Types**

* New Business
* Active Business
* High Engagement

**Explanation**
Each badge includes tooltip describing signal logic.

**Backend Dependency**: ⚠️ Yes (signal calculation)

---

### 3.2 Enrichment Result Report

**Description**
Clear feedback after enrichment actions.

**Displayed Results**

* Found email
* Found social links
* Missing data

**Credit Transparency**

* Credits consumed only on successful enrichment

**Backend Dependency**: ⚠️ Yes

---

## 4. Lists, Exports & Sales Workflow

### 4.1 Export Templates

**Description**
Predefined export formats for different use cases.

**Templates**

* Sales CRM
* Agency Outreach
* Simple List

**User Value**

* Reduces post-export cleanup work

**Backend Dependency**: ⚠️ Depends on export implementation

---

### 4.2 List Notes & Tags (Local)

**Description**
Lightweight CRM-style annotations.

**Features**

* Notes per list
* Tags (Hot / Cold / Follow-up)

**Storage**

* localStorage

**Backend Dependency**: ❌ No

---

## 5. Community-Driven Product Evolution

### 5.1 Feature Request Board

**Description**
Users can suggest and vote on new features.

**Phase-1**

* localStorage-based
* No authentication dependency

**Sections**

* Suggestions
* Votes
* Status labels

**Backend Dependency**: ❌ No (Phase-1)

---

### 5.2 Public Roadmap & Changelog

**Description**
Transparent communication of product evolution.

**Roadmap States**

* Done
* In Progress
* Planned

**User Value**

* Builds community trust
* Reduces feature uncertainty

**Backend Dependency**: ❌ No

---

## 6. Phase-2 Readiness (International Expansion)

### 6.1 Country Selector (Disabled)

**Description**
UI preparation for multi-country search.

**Phase-1 Behavior**

* Only TR enabled
* Other countries marked "Coming Soon"

**User Value**

* Signals long-term vision

**Backend Dependency**: ❌ No (Phase-1)

---

## 7. Non-Goals (Explicitly Excluded)

* WhatsApp automation
* Bulk messaging
* Website scraping
* Browser-based phone extraction

**Reason**

* Legal risk
* Platform instability
* Short-term hacks vs long-term value

---

## 8. Implementation Strategy

**Execution Rules**

* One feature group per iteration
* Unified diff per change
* i18n included by default
* Empty states preferred over mock data

---

## 9. Summary

LeadHunter V2 is not about adding "more features".

It is about:

* Being legally safe
* Being trusted
* Being sticky
* Being sales-ready

This layer turns LeadHunter from a tool into a platform.
