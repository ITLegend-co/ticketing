Create a modern, professional, responsive **IT Helpdesk Ticketing System** web application for an internal company IT department.

The system will be used by employees to submit IT issues, by the IT team to receive, assign, track, troubleshoot, update, resolve, and report on tickets, and by Management to monitor overall IT operations, major incidents, SLA status, recurring issues, workload, and issues requiring management attention.

The final design should look like a real production-ready internal IT Helpdesk system, not a conceptual landing page.

Use a clean enterprise dashboard design that is simple enough for non-technical users while still providing detailed operational tools for IT staff.

---

# USER ROLES

Create 4 user roles with proper role-based access control.

## 1. Employee / Requester

Employees mainly use the system to report problems and follow up on their requests.

Permissions:

* Create new tickets
* View own tickets
* Check ticket status
* Add comments and replies
* Upload screenshots, photos, documents, or logs
* Receive ticket updates
* View technician responses
* Confirm whether an issue has been resolved
* Reopen a recently resolved ticket if the issue persists
* Search Knowledge Base articles

Employees must NOT be able to:

* View private tickets belonging to other employees
* Access internal IT notes
* Assign technicians
* Modify SLA
* Access administration settings
* Modify other users
* View sensitive IT configuration

---

## 2. IT Technician

IT Technicians are responsible for troubleshooting and resolving tickets.

Permissions:

* View tickets assigned to them
* View relevant unassigned tickets
* Accept tickets
* Update ticket status
* Change ticket priority where permitted
* Communicate with requester
* Add troubleshooting information
* Add internal IT notes
* Upload attachments
* Record Findings
* Record Action Taken
* Record Result
* Record Root Cause
* Record Recommendation
* Record Completion Date
* Track time spent on a ticket
* Link IT assets to tickets
* Resolve tickets
* Escalate tickets to IT Admin / Team Lead
* Search Knowledge Base articles
* Create Knowledge Base drafts where permitted

---

## 3. IT Admin / Team Lead

IT Admin / Team Lead has full operational control of the Helpdesk system.

Permissions:

* View all tickets
* Create tickets on behalf of users
* Assign and reassign technicians
* Manage ticket priorities
* Manage ticket categories
* Manage departments
* Manage locations
* Manage SLA rules
* Escalate tickets
* Reopen tickets
* Close tickets
* Manage technicians and users
* Manage IT assets
* Manage Knowledge Base
* Access internal IT notes
* Access audit logs
* View all reports
* Configure ticketing system settings
* Manage notification settings
* View technician workloads
* View management escalations

---

## 4. Management

Management requires high-level visibility of IT operations without needing to manage technical ticket details.

Management should primarily have READ-ONLY access.

Management can:

* View Management Dashboard
* View all active tickets
* View critical and high-priority tickets
* View escalated tickets
* View ticket status
* View ticket priority
* View ticket category
* View affected department
* View affected location
* View assigned technician
* View SLA status
* View overdue tickets
* View resolved tickets
* View major incidents
* View IT workload
* View recurring issues
* View ticket trends
* View operational summaries
* View asset-related incidents
* View reports and analytics
* Export reports

Management must NOT normally be able to:

* Edit troubleshooting information
* Modify internal IT technical notes
* Change ticket status
* Assign technicians
* Change ticket priority
* Modify SLA rules
* Edit system configuration
* Delete tickets

Management may add a special:

**Management Comment**

Management Comments are different from normal comments and Internal IT Notes.

Management Comments should be visible to:

* Management
* IT Admin / Team Lead
* Relevant IT Technician

Management Comments may be used for:

* Follow-up requests
* Priority concerns
* Management instructions
* Requesting additional information
* Requesting progress updates
* Approval comments

---

# LOGIN PAGE

Create a professional Login page.

Include:

* Company Logo
* System Name: IT Helpdesk
* Email / Username
* Password
* Remember Me
* Forgot Password
* Sign In button

After login, automatically display the appropriate interface based on the user's assigned role.

---

# ROLE-BASED NAVIGATION

## Employee Sidebar

* Dashboard
* Create Ticket
* My Tickets
* Knowledge Base
* Notifications
* My Profile

---

## IT Technician Sidebar

* Dashboard
* My Assigned Tickets
* Unassigned Tickets
* Tickets
* Assets
* Knowledge Base
* Notifications
* My Profile

---

## IT Admin / Team Lead Sidebar

* Dashboard
* Tickets
* Create Ticket
* Assigned Tickets
* Unassigned Tickets
* Assets
* Reports
* Users
* Categories
* Departments
* Locations
* Knowledge Base
* Audit Log
* Settings

---

## Management Sidebar

* Management Dashboard
* Active Issues
* Critical Issues
* Escalated Issues
* Reports
* Locations
* IT Overview
* Recurring Issues

Allow all sidebars to collapse.

At the bottom show:

* User avatar
* User name
* Role
* Profile
* Logout

---

# TOP NAVIGATION

Include:

* Company Logo
* IT Helpdesk system name
* Global Search
* Notification Bell
* User Avatar
* Current User
* User Role
* Profile Menu

---

# STANDARD IT DASHBOARD

Create a clean IT operational dashboard.

Top statistic cards:

* Total Open Tickets
* New Tickets
* Assigned Tickets
* In Progress
* Pending
* Resolved
* Overdue
* SLA Breached

Create sections for:

## Tickets by Priority

* Critical
* High
* Medium
* Low

## Tickets by Category

Examples:

* Hardware
* Software
* Network
* Internet
* Printer
* CCTV
* Email
* Account / Access
* Server
* System
* Other

Create charts showing:

* Tickets Created vs Resolved
* Tickets by Category
* Tickets by Priority
* Technician Workload
* Monthly Ticket Trends
* SLA Performance

---

# RECENT TICKETS

Create a Recent Tickets table.

Columns:

* Ticket ID
* Subject
* Requester
* Department
* Location
* Category
* Priority
* Assigned Technician
* Status
* Created Date
* SLA
* Action

Allow row click to open Ticket Details.

---

# MANAGEMENT DASHBOARD

Create a separate dashboard specifically for Management.

The Management Dashboard should provide a simple executive overview and avoid overwhelming Management with unnecessary technical detail.

Top cards:

* Total Active Tickets
* Critical Tickets
* High Priority Tickets
* Overdue Tickets
* SLA Breached
* Pending Tickets
* Resolved This Month
* Escalated Issues
* Issues Requiring Management Attention

---

# CURRENT IT OPERATIONAL STATUS

Create a section called:

**Current IT Operational Status**

Show important ongoing issues such as:

* Critical incidents
* Major service interruptions
* Internet / Network issues
* Server issues
* System failures
* CCTV issues
* Important hardware failures
* Vendor-related problems
* Issues affecting business operations

Each item should display:

* Ticket ID
* Issue
* Location
* Department
* Priority
* Status
* Assigned Technician
* How long the issue has been open
* SLA status
* Latest Update

---

# MANAGEMENT ATTENTION REQUIRED

Create a prominent section called:

**Management Attention Required**

Only show tickets that need management visibility.

Examples:

* Critical incident
* SLA breach
* Repeated system failure
* Large operational impact
* Important equipment failure
* Vendor delay
* High-cost repair
* Replacement approval required
* Purchase approval required
* Issue affecting several departments
* Long unresolved issue
* External contractor required

Display:

* Ticket ID
* Subject
* Location
* Department
* Business Impact
* Priority
* Status
* Responsible Technician
* Latest Update
* Management Action Required
* Approval Status

Use a clear badge when:

**Approval Required**

---

# LOCATION OVERVIEW

Create location cards.

Example locations:

* KK Office
* Kinabalu Park
* Pendant Hut
* Other Sites

Each location card should display:

* Open Tickets
* Critical Issues
* High Priority Issues
* Pending Issues
* SLA Breaches
* Operational Status

Operational status indicators:

* Normal
* Attention Required
* Major Issue

Allow clicking the location card to see all tickets for that site.

---

# CREATE TICKET

Create a professional ticket submission form.

Fields:

## Ticket Information

### Ticket ID

Automatically generated after submission.

Example:

IT-2026-0001

### Subject

Short description of the problem.

### Description

Large rich-text area.

Prompt the user to explain:

* What happened?
* When did it happen?
* What system/device is affected?
* Is work completely stopped or partially affected?

### Category

Dropdown options:

* Hardware
* Software
* Network
* Internet
* Printer
* CCTV
* Email
* User Account
* Server
* System
* Electrical / Technical
* Other

### Subcategory

Dynamic dropdown depending on Category.

### Priority

* Low
* Medium
* High
* Critical

### Department

Dropdown.

### Location

Example:

* KK Office
* Kinabalu Park
* Pendant Hut
* Level 2
* Level 3
* Other

### Affected Device / Asset

Optional asset selector.

### Business Impact

Options:

* Single User
* Multiple Users
* Department
* Location / Site
* Entire Company

### Attachment

Allow:

* Screenshot
* Photo
* PDF
* Word document
* Excel
* Log file

### Preferred Contact Method

* System
* Email
* Phone
* WhatsApp

Buttons:

* Cancel
* Save Draft
* Submit Ticket

---

# TICKET LIST

Create a professional ticket-management table.

Columns:

* Ticket ID
* Subject
* Requester
* Department
* Category
* Location
* Priority
* Assigned Technician
* Status
* Created
* Last Updated
* SLA
* Action

Add filters:

* Search
* Status
* Priority
* Category
* Technician
* Department
* Location
* Date Range
* SLA Status

Include:

* Sorting
* Pagination
* Export
* Column customization

Allow switching between:

* Table View
* Kanban View

---

# KANBAN VIEW

Create columns:

* New
* Assigned
* In Progress
* Pending User
* Pending Vendor
* Resolved
* Closed

Each ticket card displays:

* Ticket ID
* Subject
* Requester
* Priority
* Category
* Location
* Assigned Technician
* Time Open
* SLA Indicator

Allow authorized IT users to drag tickets between statuses.

---

# TICKET DETAILS PAGE

Create a detailed Ticket Workspace.

Header:

* Ticket ID
* Ticket Subject
* Status
* Priority
* SLA Indicator
* Created Date
* Last Updated Date
* Requester
* Assigned Technician

Main ticket information:

* Description
* Category
* Subcategory
* Department
* Location
* Business Impact
* Affected Asset
* Attachments

---

# TICKET ACTIVITY TIMELINE

Create an activity timeline.

Example events:

* Employee submitted ticket
* Ticket automatically created
* Technician assigned
* Priority changed
* Technician changed status to In Progress
* Technician added Findings
* Technician added Action Taken
* Employee replied
* Ticket escalated
* Management comment added
* Technician resolved issue
* User confirmed resolution
* Ticket closed

Show:

* User Avatar
* User Name
* Role
* Activity
* Date
* Time

---

# IT ACTION PANEL

Create a right-side IT Action Panel.

Fields:

* Assigned Technician
* Status
* Priority
* Category
* SLA Due Date
* Time Spent
* Escalation Level

Status options:

* New
* Assigned
* In Progress
* Pending User
* Pending Vendor
* Pending Approval
* Resolved
* Closed
* Cancelled

Buttons:

* Update Ticket
* Resolve Ticket
* Reassign
* Escalate
* Request Approval
* Close Ticket

---

# TROUBLESHOOTING AND IT SUPPORT REPORT

Create dedicated structured fields for IT technicians.

## Issue

Automatically use ticket Subject and Description.

## Findings

What was discovered during troubleshooting.

## Action Taken

What actions were performed.

## Result

Outcome after troubleshooting.

## Root Cause

Cause of issue if known.

## Recommendation

Recommended preventive or future action.

## Completion Date

Date work was completed.

## Status

Current status of work.

Allow this information to automatically generate an:

**IT Support Report**

Report format:

* Ticket ID
* Issue
* Findings
* Action Taken
* Result
* Root Cause
* Recommendation
* Completion Date
* Technician
* Status

Provide:

* Export PDF
* Print
* Email Report

---

# INTERNAL IT NOTES

Create Internal Notes.

Internal Notes:

* Visible only to IT personnel
* Not visible to normal employees
* Clearly distinguish them from public replies
* Support attachments
* Display author
* Display date and time

Use a noticeable badge:

**Internal Note**

---

# MANAGEMENT COMMENTS

Create Management Comments separately.

Show badge:

**Management Comment**

Visible only to:

* Management
* IT Admin
* Assigned Technician

Allow Management to request:

* Status Update
* Additional Information
* Follow-Up
* Approval Information

---

# SLA MANAGEMENT

Display SLA indicators.

Use:

Green:
Within SLA

Orange:
Approaching SLA

Red:
SLA Breached

Show:

* First Response Target
* First Response Actual
* Resolution Target
* Resolution Actual
* Time Remaining
* Time Used
* SLA Status

---

# ESCALATION

Create an escalation system.

Escalation levels:

* Level 1 – Technician
* Level 2 – IT Team Lead
* Level 3 – Management
* External – Vendor / Contractor

Display escalation history.

Allow ticket escalation when:

* SLA is near breach
* SLA is breached
* Technician requires assistance
* Approval is required
* Issue impacts multiple users
* Issue impacts business operations
* Vendor intervention is needed

---

# APPROVAL WORKFLOW

Add an Approval feature.

Possible approvals:

* Purchase
* Equipment Replacement
* Vendor Engagement
* Repair Cost
* Subscription Purchase
* Software Purchase
* Project Work
* Other

Approval request should show:

* Ticket ID
* Requested By
* Request Type
* Description
* Reason
* Estimated Cost
* Attachment / Quotation
* Requested Date

Management can:

* Approve
* Reject
* Request More Information
* Add Comment

Keep full approval history.

---

# ASSET MANAGEMENT

Allow tickets to link to IT assets.

Asset information:

* Asset ID
* Device Name
* Asset Type
* Brand
* Model
* Serial Number
* Location
* Assigned User
* Department
* IP Address
* MAC Address
* Purchase Date
* Warranty
* Status

Asset status:

* Active
* Spare
* Under Repair
* Faulty
* Retired

On the Asset Details page show:

* Asset Information
* Current User
* Location
* Previous Tickets
* Repair History
* Maintenance History
* Warranty
* Attachments

---

# REPORTS

Create a comprehensive IT reporting dashboard.

Filters:

* Date Range
* Technician
* Department
* Category
* Priority
* Location
* Status
* SLA Status

Show:

* Total Tickets
* Resolved Tickets
* Open Tickets
* Pending Tickets
* Average Resolution Time
* Average First Response Time
* SLA Compliance
* Tickets per Technician
* Tickets per Department
* Tickets per Location
* Most Common Problems
* Repeat Issues

Charts:

* Tickets Created vs Resolved
* Monthly Ticket Trend
* Category Breakdown
* Location Breakdown
* Priority Breakdown
* SLA Trend
* Resolution Time Trend

Export options:

* PDF
* Excel
* Print

---

# MANAGEMENT REPORT

Create a Management Report generator.

Date options:

* Daily
* Weekly
* Monthly
* Yearly
* Custom Date Range

Report sections:

## Executive Summary

Provide a short overview of IT operations.

## Major Incidents

Highlight significant events.

## Critical Tickets

Show current and resolved critical issues.

## High Priority Tickets

Show high-impact issues.

## Resolved Issues

Show important completed tickets.

## Outstanding Issues

Show unresolved tickets.

## SLA Performance

Show SLA compliance and breaches.

## Recurring Issues

Show repeated technical problems.

## IT Workload

Show technician workloads.

## Location Summary

Show IT health by location.

## Recommendations

Allow IT Admin / Team Lead to enter recommendations.

Provide:

* Export PDF
* Export Excel
* Print Report

---

# TECHNICIAN WORKLOAD

Create technician cards.

Show:

* Technician Name
* Assigned Tickets
* Active Tickets
* Pending Tickets
* Resolved This Month
* Overdue Tickets
* Average Resolution Time
* SLA Compliance

Do not rank technicians.

The purpose is workload visibility and resource planning.

---

# RECURRING ISSUES

Create a Recurring Issues page.

Examples:

* Internet connection failures
* Printer issues
* Computer hardware problems
* CCTV issues
* Software errors
* User account issues
* Server issues

Show:

* Issue Category
* Number of Occurrences
* Location
* Department
* Affected Asset
* Last Occurrence
* Current Status

Allow clicking a recurring issue to see all related tickets.

---

# USER MANAGEMENT

Create User Management page.

Columns:

* Name
* Email
* Department
* Position
* Role
* Location
* Status

Available roles:

* Employee
* IT Technician
* IT Admin / Team Lead
* Management

Actions:

* Add User
* Edit User
* Disable User
* Reset Access
* Change Role

---

# CATEGORY MANAGEMENT

Create configurable categories.

Examples:

* Hardware
* Software
* Network
* Internet
* Printer
* CCTV
* Email
* User Account
* Server
* System
* Technical
* Other

Allow IT Admin to create:

* Category
* Subcategory
* Default Technician
* Default SLA
* Default Priority

---

# NOTIFICATION CENTER

Create notification bell in top navigation.

Notification examples:

* New ticket submitted
* Ticket assigned to you
* Ticket reassigned
* Priority changed
* User replied
* Technician replied
* Ticket nearing SLA
* SLA breached
* Ticket escalated
* Approval requested
* Approval approved
* Approval rejected
* Ticket resolved
* Ticket reopened

Notification settings should support:

* In-System Notification
* Email Notification

Design system structure so WhatsApp or other integrations could be added later.

---

# KNOWLEDGE BASE

Create an internal Knowledge Base.

Categories:

* Networking
* Printers
* Windows
* Email
* Account Access
* Hardware
* Software
* CCTV
* Servers
* Common Troubleshooting

Each article includes:

* Title
* Category
* Problem
* Cause
* Solution
* Step-by-Step Instructions
* Attachments
* Related Articles
* Author
* Last Updated

Provide search.

When a user creates a ticket, suggest relevant Knowledge Base articles based on the Subject and Category.

---

# AUDIT LOG

Create Audit Log for IT Admin.

Record:

* User
* Action
* Ticket
* Old Value
* New Value
* Date
* Time
* IP / Device where appropriate

Examples:

* Ticket Created
* Priority Changed
* Technician Assigned
* Status Changed
* Ticket Escalated
* Approval Requested
* Approval Approved
* Ticket Closed
* User Role Changed

Audit records should not be editable.

---

# TICKET NUMBER FORMAT

Automatically generate ticket numbers.

Format:

IT-YYYY-XXXX

Examples:

IT-2026-0001

IT-2026-0002

IT-2026-0003

Automatically reset the running sequence each year.

---

# SEARCH

Create global search.

Allow searching:

* Ticket ID
* Ticket Subject
* User
* Department
* Location
* Technician
* Asset ID
* Serial Number
* Category

Display grouped search results.

---

# RESPONSIVE MOBILE DESIGN

Make the entire system responsive.

For mobile:

* Convert sidebar into hamburger menu
* Convert large tables into ticket cards
* Keep Ticket ID visible
* Keep Priority visible
* Keep Status visible
* Keep Assigned Technician visible
* Keep SLA visible
* Use large touch-friendly buttons

Add a floating:

**+ Create Ticket**

button for employees and authorized users.

---

# TABLET DESIGN

Optimize tablet layout for IT technicians who may be working outside the office.

Ticket Details should be easy to use while:

* Troubleshooting equipment
* Working at another company location
* Taking photos
* Updating Findings
* Updating Action Taken
* Resolving tickets

---

# VISUAL DESIGN

Use a modern enterprise IT dashboard style.

Design should be:

* Professional
* Clean
* Minimal
* Easy to understand
* Suitable for everyday operation
* Desktop-first
* Fully responsive
* Mobile-friendly
* Tablet-friendly

Use:

* Rounded cards
* Soft shadows
* Clear spacing
* Modern data tables
* Simple icons
* Consistent typography
* Status badges
* Priority badges
* Accessible contrast

Use a professional blue and neutral color palette.

---

# PRIORITY COLORS

Critical:
Red

High:
Orange

Medium:
Yellow

Low:
Blue / Gray

---

# STATUS COLORS

New:
Blue

Assigned:
Purple

In Progress:
Orange

Pending:
Yellow

Resolved:
Green

Closed:
Gray

Cancelled:
Dark Gray

SLA Breached:
Red

---

# COMPONENT SYSTEM

Create reusable Figma components using Auto Layout.

Components:

* Primary Button
* Secondary Button
* Danger Button
* Icon Button
* Input Field
* Text Area
* Dropdown
* Search Bar
* Date Picker
* Ticket Card
* Statistics Card
* Location Card
* Management Attention Card
* Asset Card
* Status Badge
* Priority Badge
* SLA Badge
* User Avatar
* Modal
* Confirmation Dialog
* Sidebar
* Top Navigation
* Tables
* Charts
* Notification Item
* Pagination
* Tabs
* Activity Timeline
* Comments
* Internal Notes
* Management Comments

Create component variants for:

* Default
* Hover
* Active
* Disabled
* Error
* Selected

---

# PROTOTYPE INTERACTIONS

Create clickable prototype flows.

## Employee Flow

Login

→ Employee Dashboard

→ Create Ticket

→ Fill Form

→ Submit

→ Ticket Created Confirmation

→ Ticket Details

→ Add Reply

→ Confirm Resolution

---

## Technician Flow

Login

→ Technician Dashboard

→ Assigned Ticket

→ Ticket Details

→ Start Work

→ Add Findings

→ Add Action Taken

→ Add Result

→ Update Status

→ Resolve Ticket

---

## IT Admin Flow

Login

→ Admin Dashboard

→ Unassigned Ticket

→ Assign Technician

→ Monitor SLA

→ Escalate Ticket

→ Review IT Report

→ Close Ticket

---

## Management Flow

Login

→ Management Dashboard

→ Management Attention Required

→ Open Critical Ticket

→ View Latest Update

→ Add Management Comment

→ Review Approval Request

→ Approve / Reject

→ Return to Dashboard

---

# MANAGEMENT TICKET VIEW

When Management opens a ticket, create a simplified read-only interface.

Show:

* Ticket ID
* Subject
* Description
* Requester
* Department
* Location
* Category
* Priority
* Business Impact
* Status
* Assigned Technician
* Created Date
* Ticket Age
* SLA Status
* Latest Update
* Findings
* Action Taken
* Current Result
* Recommendation
* Approval Information
* Management Comments

Do not show unnecessary technical administration controls.

---

# DASHBOARD DESIGN PRINCIPLE

Different users should see different information.

Employee:
"What is happening with my ticket?"

Technician:
"What do I need to work on?"

IT Admin / Team Lead:
"What is happening across the entire IT operation?"

Management:
"Is there anything affecting operations, overdue, critical, requiring approval, or requiring my attention?"

Design each dashboard around these questions.

---

# FINAL DESIGN REQUIREMENTS

Do not create only a homepage or mock dashboard.

Create a complete application design covering:

1. Login
2. Employee Dashboard
3. Technician Dashboard
4. IT Admin Dashboard
5. Management Dashboard
6. Create Ticket
7. Ticket List
8. Kanban Board
9. Ticket Details
10. IT Troubleshooting Workspace
11. Management Ticket View
12. Asset Management
13. Asset Details
14. Reports
15. Management Reports
16. User Management
17. Category Management
18. Location Overview
19. Knowledge Base
20. Notifications
21. Audit Log
22. Approval Workflow
23. Settings

Use consistent components, Auto Layout, design tokens, responsive layouts, and reusable variants throughout the entire project.

Make the UI look like a real internal enterprise IT Helpdesk application that could later be developed into a functional web application.
