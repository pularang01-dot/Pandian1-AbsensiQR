# MASTER PROMPT — PANDIAN SMART ATTENDANCE
## Full-Stack School Attendance, Permission & Student Administration System

---

# 1. YOUR ROLE AND RESPONSIBILITIES

You are acting as a senior multidisciplinary software development team consisting of:

1. Senior Full-Stack Developer.
2. Senior UI/UX Designer.
3. Software Architect.
4. Database Architect.
5. Cybersecurity Engineer.
6. Quality Assurance Engineer.
7. Technical Documentation Specialist.

Your task is to design, develop, implement, test, and prepare a complete, professional, production-oriented school attendance and permission management web application.

You must work directly inside the current Visual Studio Code project workspace.

Do not merely provide recommendations, snippets, or theoretical implementation instructions. You must create and modify the actual project files.

Your output must be a functional application, not a static UI prototype.

**Project name:** PANDIAN SMART ATTENDANCE  
**Institution:** SDN Pandian 1 Sumenep  
**Application type:** School Attendance and Student Administration Platform  
**Primary language:** Indonesian  
**Target devices:** Desktop, laptop, Android smartphone, and tablet.

The application must be designed for actual school operations, with an architecture that can be maintained by school administrators after the development period ends.

---

# 2. CORE PRODUCT VISION

Build a centralized digital platform for managing student attendance, absence permissions, official school dispensations, early student dismissal, and attendance reporting.

The system must replace fragmented manual attendance records with a structured, traceable, and secure digital workflow.

The application must prioritize:

- Accuracy of attendance records.
- Child safety.
- Student and parent data protection.
- Simple daily operation.
- Clear authorization and approval processes.
- Reliable reporting.
- Maintainability and long-term school ownership.

This is not merely a QR scanner application.

It is an integrated school attendance management system.

---

# 3. TECHNOLOGY STACK

Use the following technology stack unless the existing project structure requires a compatible adjustment.

### Frontend

- Next.js with App Router.
- React.
- TypeScript.
- Tailwind CSS.
- Lucide React for interface icons.
- Reusable component architecture.
- Responsive layouts.

### Backend and Database

- Supabase.
- PostgreSQL.
- Supabase Authentication.
- Supabase Row Level Security.
- Supabase Storage for private documents when required.

### Main Libraries

Select stable and compatible libraries for:

- QR Code generation.
- QR Code scanning through device cameras.
- Form validation.
- Date formatting.
- Data visualization.
- PDF generation.
- Excel export.
- Notifications and toast messages.

Use Zod for validation and React Hook Form where appropriate.

Use a maintained QR scanning library such as `@zxing/browser` or another suitable library.

### Development Rules

IMPORTANT:

1. Do not execute `npm install`.
2. Do not execute `npm update`.
3. Do not install dependencies automatically.
4. You may inspect the existing `package.json` and prepare the required dependency list.
5. Update `package.json` with all required dependencies and compatible versions.
6. Prepare the complete project so the developer can install dependencies manually.
7. Do not delete existing files without inspecting their purpose.
8. Do not overwrite existing project configuration unnecessarily.
9. Never expose Supabase service role keys in client-side code.
10. All privileged operations must be executed securely on the server.

At the end, provide the exact commands that I must execute manually.

---

# 4. DESIGN SYSTEM AND VISUAL IDENTITY

The interface must look like a premium, modern education technology SaaS product.

Avoid generic admin templates.

Do not use emojis anywhere in the interface.

Use professional typography, balanced spacing, subtle shadows, carefully controlled colors, and consistent visual hierarchy.

## 4.1 Visual Direction

Design concept:

**Modern Institutional Education Technology**

The interface should communicate:

- Professionalism.
- Reliability.
- Simplicity.
- Order.
- Trust.
- Modern school administration.

## 4.2 Color Palette

Use the following design tokens:

| Token | Color |
|---|---|
| Primary Navy | `#142B4A` |
| Secondary Navy | `#203E63` |
| Primary Blue | `#3478D4` |
| Light Blue | `#EAF2FC` |
| Background | `#F5F7FA` |
| Surface | `#FFFFFF` |
| Primary Text | `#182230` |
| Secondary Text | `#64748B` |
| Border | `#E5EAF0` |
| Success | `#16865B` |
| Warning | `#D99124` |
| Danger | `#D64B4B` |
| Info | `#3985C8` |

Use colors consistently. Avoid excessive gradients, saturated backgrounds, and decorative elements.

## 4.3 Typography

Use a modern sans-serif font such as Inter or Geist.

Typography must have clear hierarchy:

- Large page headings.
- Medium section headings.
- Readable body text.
- Small supporting labels.
- Tabular numbers for statistics and reports.

## 4.4 Layout

**Desktop:**

- Fixed or collapsible left sidebar.
- Top navigation bar.
- Main content area.
- Responsive content grid.
- Consistent card spacing.

**Mobile:**

- Compact navigation.
- Mobile-friendly sidebar or navigation drawer.
- Large touch targets.
- Responsive data tables.
- Easy-to-use forms.
- QR scanner optimized for mobile camera dimensions.

## 4.5 Component Design

Create reusable components for:

- Buttons.
- Input fields.
- Select menus.
- Date pickers.
- Status badges.
- Data tables.
- Confirmation dialogs.
- Modals.
- Dropdown menus.
- Pagination.
- Search fields.
- Empty states.
- Loading skeletons.
- Error states.
- Toast notifications.
- Statistic cards.
- Charts.

All pages must use the same design system.

Do not create inconsistent styles between modules.

---

# 5. APPLICATION STRUCTURE

Create the following main application modules.

## A. Authentication

Create secure login functionality.

Support these roles:

1. Super Admin.
2. School Administrator.
3. Principal / Authorized Approver.
4. Teacher / Homeroom Teacher.
5. Attendance Operator.
6. Parent / Guardian.

Each role must have clearly defined permissions.

Users must only access the pages and data permitted by their roles.

Authentication requirements:

- Secure login.
- Logout.
- Session management.
- Protected routes.
- Role-based authorization.
- Password recovery where supported.
- User activation and deactivation.
- Account management.

Never rely only on hiding buttons in the frontend for security.

All important authorization checks must also be performed on the server and enforced through database policies.

---

# 6. DASHBOARD

Build a professional dashboard for school administrators.

The dashboard must display:

### Attendance Statistics

- Total active students.
- Students present today.
- Students absent due to illness.
- Students with approved permission.
- Students participating in official school activities.
- Late arrivals.
- Unverified attendance records.

### Dashboard Components

1. Attendance overview.
2. Attendance percentage.
3. Attendance distribution chart.
4. Daily attendance trend.
5. Class attendance summary.
6. Pending permission requests.
7. Recent attendance activity.
8. Recent administrative activities.
9. Important notifications.

Allow filtering by:

- Date.
- Class.
- Academic year.
- Attendance status.

Use real database data.

Do not use hardcoded numbers as actual statistics.

If the database is empty, display a professional empty state.

---

# 7. STUDENT MANAGEMENT

Create a complete student management module.

### Student Information

- Student ID.
- NIS.
- NISN, if available.
- Full name.
- Gender, if needed for school administration.
- Class.
- Academic year.
- Parent or guardian relationship.
- Contact information through authorized records.
- QR Code identifier.
- Student status: active, transferred, graduated, inactive.

### Functions

- Add student.
- Edit student.
- View student details.
- Delete or deactivate student according to administrative policy.
- Search students.
- Filter by class.
- Import students from Excel or CSV.
- Export student data.
- Generate individual QR Codes.
- Generate printable QR Code cards.

### Important Rules

Each student must have a unique internal identifier.

Do not use a student's name as the database primary key.

Do not place personal information directly inside the QR Code.

The QR Code must contain only an opaque, random, revocable identifier.

Provide QR Code regeneration functionality.

When a QR Code is regenerated, deactivate the old identifier.

---

# 8. CLASS MANAGEMENT

Create a class management module.

Features:

- Create classes.
- Edit classes.
- Assign homeroom teachers.
- Assign students.
- View class lists.
- Transfer students between classes.
- Manage academic years.
- Archive old academic-year records.

The application must support multiple classes and academic years.

---

# 9. QR CODE ATTENDANCE MODULE

This is one of the primary features.

Build a fast and reliable QR Code attendance interface.

## 9.1 Attendance Process

The workflow must be:

1. Attendance operator logs in.
2. Operator opens the attendance scanner.
3. Operator selects the relevant attendance session or date.
4. Student presents their QR Code card.
5. System scans the QR Code.
6. System validates the QR identifier.
7. System retrieves student identity.
8. System displays student name and class.
9. Operator visually confirms the student.
10. System checks whether the student already has an attendance record.
11. System checks the school's attendance schedule.
12. System records the attendance status.
13. System stores timestamp and operator identity.
14. System displays a successful confirmation.

## 9.2 Attendance Status

Use these statuses:

- Present.
- Late.
- Sick.
- Permission.
- Official School Activity.
- Unexcused Absence.
- Not Yet Verified.

Do not automatically mark every student absent before the school's attendance reconciliation procedure has been completed.

## 9.3 QR Code Validation

Implement:

- Invalid QR rejection.
- Duplicate scan prevention.
- Revoked QR rejection.
- Student identity confirmation.
- Database-level uniqueness constraints.
- Clear error messages.
- Manual student lookup.
- Manual attendance entry for exceptional cases.

A QR scan does not prove physical presence by itself.

Attendance must be supervised by an authorized school operator.

Do not allow parents or students to submit their own QR scan from an arbitrary location as proof of attendance.

## 9.4 Attendance Scanner Interface

The scanner page must include:

- Large camera preview.
- Camera selection where supported.
- Start and stop scanner controls.
- Manual student search.
- Latest scanned student information.
- Current attendance count.
- Today's attendance summary.
- Clear duplicate scan notification.

Make the scanner optimized for Android smartphones and tablets.

Handle camera permission denial and unsupported devices gracefully.

---

# 10. ATTENDANCE MANAGEMENT

Create an attendance management page.

Features:

- Daily attendance records.
- Search by student.
- Filter by class.
- Filter by date.
- Filter by status.
- View attendance details.
- Correct attendance records with authorization.
- Record correction reasons.
- View change history.

Attendance corrections must never silently overwrite previous information.

Every correction must create an audit record containing:

- Previous value.
- New value.
- User making the correction.
- Timestamp.
- Reason.

---

# 11. PARENT AND GUARDIAN PORTAL

Build a responsive parent portal.

Parents must be able to:

- Log in securely.
- View their linked children.
- Submit sickness notifications.
- Submit ordinary permission requests.
- Select absence dates.
- Enter a short reason.
- Upload supporting documents when required by school policy.
- View request status.
- Read school responses.
- View their child's relevant attendance history.

Parents must only see children explicitly linked to their accounts.

Never allow a parent to access another student's information.

### Permission Submission

Form fields:

- Student.
- Permission category.
- Start date.
- End date.
- Reason.
- Supporting document, if required.

Permission categories:

1. Sick.
2. Ordinary Permission.

Use these request statuses:

- Pending.
- Under Review.
- Needs Clarification.
- Approved.
- Rejected.
- Cancelled.

Only approved requests may update the relevant attendance record.

Requests submitted after the relevant absence date must be marked as retrospective and require additional review.

Do not automatically approve retrospective requests.

Do not require detailed medical diagnoses.

Store only the minimum health-related information necessary for school administration.

If parents do not have internet access or cannot use the portal, the school must still be able to record permission manually.

---

# 12. PERMISSION APPROVAL MANAGEMENT

Create an administrative permission management page.

Display:

- Pending requests.
- Requests under review.
- Requests requiring clarification.
- Approved requests.
- Rejected requests.

Each request must show:

- Student name.
- Class.
- Parent or guardian identity.
- Permission category.
- Relevant dates.
- Submission date.
- Short reason.
- Document availability, if applicable.

Administrative actions:

- Review.
- Approve.
- Reject.
- Request clarification.
- Cancel approval, if authorized.
- View history.

Before approval, validate:

- Student is active.
- Parent is linked to the student.
- Dates are valid.
- Request does not conflict with an existing approved request.
- Approver has the required authority.

Use confirmation dialogs for important actions.

Approval must be transactional and auditable.

If a request affects multiple dates, process each date consistently.

---

# 13. OFFICIAL SCHOOL DISPENSATION MODULE

Build a separate module for official school activities.

Examples:

- Academic competitions.
- Sports competitions.
- Cultural events.
- Official school delegations.
- Other school-authorized activities.

### Workflow

1. Teacher or activity supervisor creates a dispensation request.
2. Teacher selects participating students.
3. Teacher enters activity information.
4. Teacher enters dates and schedule.
5. Authorized person reviews the request.
6. Request is approved or rejected.
7. Approved activity is recorded.
8. Activity supervisor confirms actual student participation.
9. Attendance records are reconciled accordingly.

### Data Fields

- Activity name.
- Activity category.
- Activity location.
- Description.
- Participating students.
- Start date and time.
- End date and time.
- Supervising teacher.
- Approval status.
- Actual participation confirmation.

Important:

An approved dispensation does not automatically prove that a student participated.

The supervising teacher must confirm participation.

Students who are approved but do not participate must be flagged for review.

Do not classify official school activity as ordinary sickness or permission.

---

# 14. EARLY DISMISSAL MODULE

This module is safety-critical.

Build a controlled early-dismissal workflow.

### Process

1. Parent or authorized school representative submits a dismissal request.
2. Request is received by the school.
3. School verifies the requester's identity.
4. Authorized school staff reviews the request.
5. School approves or rejects it.
6. The designated pickup person is verified.
7. School staff physically supervises the handover.
8. Actual exit time is recorded.
9. Responsible staff identity is recorded.
10. The event is stored in the database.

### Required Data

- Student.
- Requester.
- Reason.
- Requested dismissal time.
- Approval status.
- Authorized pickup person.
- Actual pickup person.
- Verification details.
- Actual exit time.
- Responsible staff member.

### Safety Rules

- QR Code alone must never authorize student dismissal.
- Approval must not automatically mean the student has left school.
- Student handover must be supervised by authorized staff.
- Unknown pickup persons must not be accepted without additional verification.
- If verification fails, the student must remain under school supervision.
- Record actual handover, not merely requested dismissal time.

---

# 15. SCHOOL CALENDAR AND ATTENDANCE SETTINGS

Create an administration module for:

- Academic year.
- School holidays.
- School operating days.
- Attendance start time.
- Late arrival threshold.
- Attendance closing time.
- Class schedules, if needed.
- Special school activity dates.

Attendance calculations must respect the official school calendar.

Do not count holidays as student absences.

Allow authorized administrators to update attendance policies.

Store relevant policy changes in the audit log.

---

# 16. REPORTING AND ANALYTICS

Create a professional reporting module.

Reports must include:

### Daily Report

- Total active students.
- Present students.
- Late students.
- Sick students.
- Permission students.
- Official activity participants.
- Unexcused absences.
- Unverified records.

### Monthly Report

- Attendance summary per student.
- Attendance percentage.
- Attendance summary per class.
- Absence distribution.
- Late arrival statistics.

### Student Report

- Student attendance history.
- Absence history.
- Permission history.
- Dispensations.
- Attendance corrections.

### Export

Support:

- Excel export.
- PDF export.
- Print-friendly reports.

Use Indonesian date formats.

Ensure the calculation logic is consistent.

Do not treat an approved absence as physical attendance.

Display official school activity separately from ordinary absence categories.

---

# 17. NOTIFICATION SYSTEM

Create an internal notification system.

Examples:

- New permission request.
- Request approved.
- Request rejected.
- Clarification requested.
- New dispensation request.
- Attendance correction.
- Important administrative announcement.

Notifications must respect user permissions.

Do not require paid external messaging services for the initial version.

WhatsApp integration, SMS, and email notifications may be prepared as optional future extensions, but the core application must work without them.

---

# 18. DATABASE ARCHITECTURE

Design a normalized PostgreSQL database using Supabase.

Prepare complete SQL migration files.

The database should include appropriately structured tables for:

- `profiles`
- `user_roles`
- `students`
- `parents`
- `parent_student_links`
- `classes`
- `academic_years`
- `student_class_assignments`
- `school_calendar`
- `attendance_sessions`
- `attendance_records`
- `student_qr_tokens`
- `permission_requests`
- `permission_documents`
- `dispensations`
- `dispensation_students`
- `early_dismissal_requests`
- `early_dismissal_handover_logs`
- `notifications`
- `audit_logs`
- `system_settings`

You may add additional tables if required by the architecture.

### Database Requirements

1. Use UUID primary keys where appropriate.
2. Add foreign key constraints.
3. Add indexes for frequently queried columns.
4. Add uniqueness constraints to prevent duplicate attendance.
5. Add `created_at` and `updated_at` timestamps.
6. Use appropriate enum or constrained status values.
7. Use soft deactivation where historical records must be preserved.
8. Use database transactions for multi-step approval operations.
9. Prevent unauthorized data modification.
10. Ensure that attendance records remain historically consistent.

### Row Level Security

Enable RLS on all tables containing private or school-related information.

Implement role-specific policies.

Examples:

- Parents can only read data related to linked children.
- Teachers can only access assigned classes and authorized records.
- Attendance operators can create attendance records but cannot arbitrarily modify student profiles.
- Administrators have broader access according to their role.
- Only authorized approvers can approve specific request types.

Do not create permissive policies such as unrestricted public access.

Do not expose service role keys.

Provide SQL migration files and a clear explanation of how to execute them in Supabase SQL Editor.

---

# 19. SECURITY AND DATA PROTECTION

Security is mandatory, not optional.

Implement:

- Secure authentication.
- Server-side role verification.
- Supabase RLS.
- Input validation.
- File upload validation.
- Secure private document storage.
- Protected routes.
- Session validation.
- Rate limiting for sensitive operations where appropriate.
- Audit logs.
- Database constraints.
- Safe error handling.
- Environment variable protection.

### Student Privacy

Do not collect unnecessary personal information.

Do not store detailed medical diagnoses.

Do not expose student information through public URLs.

Do not make permission documents publicly accessible.

Do not place private student data inside QR Codes.

Implement data retention and deletion procedures according to school policy and applicable personal data protection regulations.

Prepare a backup and recovery strategy.

---

# 20. OFFLINE AND FAILURE HANDLING

The system must not assume that internet connectivity is always available.

Implement clear failure handling for:

- Internet disconnection.
- Supabase downtime.
- Camera permission denial.
- Invalid QR Code.
- Duplicate scan.
- Session expiration.
- Unauthorized access.
- Failed file upload.
- Database errors.

For the initial version, provide an offline contingency procedure rather than pretending that an offline scan has already been securely synchronized.

The interface must clearly communicate when data has not been saved.

Never display a successful attendance confirmation if the database write has failed.

Provide a manual attendance procedure as an operational fallback.

---

# 21. ADMINISTRATIVE SETTINGS

Create a dedicated system settings page.

Settings include:

- School name.
- School logo.
- School address.
- School contact details.
- Attendance rules.
- Academic year.
- Attendance schedule.
- Late arrival threshold.
- User roles.
- Class settings.
- QR Code configuration.
- Report configuration.

Use the default institution name:

**SDN PANDIAN 1 SUMENEP**

Do not invent official school contact information, principal names, or institutional identifiers.

Allow authorized administrators to configure these later.

---

# 22. USER EXPERIENCE REQUIREMENTS

The application must be easy to understand for school staff who are not technically experienced.

Important UX rules:

1. Avoid unnecessarily complicated forms.
2. Use clear Indonesian language.
3. Provide helpful validation messages.
4. Display loading states.
5. Display empty states.
6. Display success and failure notifications.
7. Confirm destructive operations.
8. Use consistent navigation.
9. Keep the most frequently used operations easy to access.
10. Ensure mobile usability.
11. Never rely only on color to communicate a status.
12. Use accessible labels and sufficient contrast.

Avoid overly dense dashboard layouts.

---

# 23. PROJECT FILE STRUCTURE

Organize the codebase professionally.

Use a modular architecture with separation between:

- App routes.
- UI components.
- Feature modules.
- Server actions or API handlers.
- Supabase clients.
- Database types.
- Validation schemas.
- Business logic.
- Utilities.
- Hooks.
- Authentication.
- Documentation.

Avoid placing all business logic in a single large component.

Use strict TypeScript typing.

Avoid unnecessary use of `any`.

Use reusable components and consistent naming conventions.

---

# 24. DEVELOPMENT WORKFLOW — EXECUTION INSTRUCTIONS

You must work in the following order.

## PHASE 1 — INSPECT THE PROJECT

Before changing files:

1. Inspect the current workspace.
2. Inspect `package.json`.
3. Inspect the Next.js version.
4. Inspect existing dependencies.
5. Inspect existing project structure.
6. Identify existing reusable components.
7. Identify possible configuration conflicts.

Do not blindly replace an existing project.

## PHASE 2 — ESTABLISH THE FOUNDATION

Implement:

- Project architecture.
- Design system.
- Global styles.
- Typography.
- Main layout.
- Navigation.
- Authentication foundation.
- Supabase configuration.
- Shared UI components.

## PHASE 3 — DATABASE

Create:

- Complete SQL migrations.
- Tables.
- Relationships.
- Indexes.
- Constraints.
- RLS policies.
- Initial configuration.
- Type definitions.

Document every database setup step.

## PHASE 4 — BUILD THE APPLICATION MODULES

Implement the modules in this order:

1. Authentication.
2. Dashboard.
3. Student management.
4. Class management.
5. QR attendance.
6. Attendance management.
7. Parent portal.
8. Permission management.
9. Dispensation.
10. Early dismissal.
11. Reporting.
12. Notifications.
13. Administrative settings.

All modules must be connected to the actual application architecture.

## PHASE 5 — INTEGRATION

Ensure that:

- Attendance records appear in reports.
- Approved permission requests affect the appropriate attendance dates.
- Dispensation records remain separate from ordinary absence.
- Early dismissal is recorded separately from arrival attendance.
- Parent access is limited to linked students.
- Role permissions are enforced.
- Audit logs capture important changes.

## PHASE 6 — QUALITY ASSURANCE

Test:

- TypeScript errors.
- Build errors.
- Route errors.
- Authentication.
- Authorization.
- Database queries.
- RLS behavior.
- Form validation.
- QR scanning.
- Duplicate attendance prevention.
- Permission approval.
- Dispensation approval.
- Early dismissal.
- Report calculations.
- Responsive layout.
- Empty states.
- Error states.

Run available checks that do not require installing packages.

Do not claim that the application has passed tests that you have not actually performed.

If a required dependency is not installed, document the limitation and prepare the code accordingly.

---

# 25. REQUIRED APPLICATION ROUTES

The following pages must be implemented, not merely described.

### Public / Authentication

- `/login`
- `/forgot-password`

### Main Dashboard

- `/dashboard`

### Student Management

- `/students`
- `/students/[id]`
- `/students/new`
- `/students/[id]/edit`

### Class Management

- `/classes`
- `/classes/[id]`

### Attendance

- `/attendance`
- `/attendance/scanner`
- `/attendance/history`
- `/attendance/reports`

### Parent Portal

- `/parent/dashboard`
- `/parent/children`
- `/parent/permissions`
- `/parent/permissions/new`
- `/parent/attendance`

### Permission Administration

- `/permissions`
- `/permissions/[id]`

### Dispensation

- `/dispensations`
- `/dispensations/new`
- `/dispensations/[id]`

### Early Dismissal

- `/early-dismissal`
- `/early-dismissal/new`
- `/early-dismissal/[id]`

### Reporting

- `/reports`
- `/reports/daily`
- `/reports/monthly`
- `/reports/students`

### Settings

- `/settings`
- `/settings/users`
- `/settings/academic-year`
- `/settings/school-calendar`
- `/settings/attendance`
- `/settings/roles`

You may adjust the route structure when a better architectural approach is justified, but preserve all required functionality.

---

# 26. SAMPLE DATA AND DEVELOPMENT MODE

Prepare a safe development and demonstration strategy.

The application must support a clean initial state.

Provide optional seed data for:

- Sample classes.
- Sample students.
- Sample attendance.
- Sample permission requests.
- Sample dispensations.

Clearly label sample records as demonstration data.

Do not insert fake student information into the production database.

Do not create a hardcoded administrator account or universal password.

Provide a secure initial administrator setup procedure.

---

# 27. ENVIRONMENT CONFIGURATION

Create a complete `.env.example`.

Include only the necessary environment variable names.

For example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

If additional server-side secrets are needed, use server-only environment variables and explain their purpose.

Never commit actual secrets.

Provide a configuration guide explaining:

1. How to create a Supabase project.
2. Where to obtain the project URL.
3. Where to obtain the public key.
4. How to configure environment variables.
5. How to execute SQL migrations.
6. How to configure authentication.
7. How to create the initial administrator.
8. How to run the development server.

Do not invent Supabase credentials.

---

# 28. DOCUMENTATION AND HANDOVER

Create a professional `README.md` in Indonesian.

It must include:

- Project overview.
- Features.
- Technology stack.
- Project structure.
- Installation instructions.
- Environment setup.
- Supabase setup.
- Database migration instructions.
- Authentication setup.
- Development commands.
- Production build instructions.
- Troubleshooting.
- Security notes.
- Backup procedures.
- School administrator guide.

Also create:

- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/ROLE_PERMISSIONS.md`
- `docs/ATTENDANCE_SOP.md`
- `docs/PERMISSION_SOP.md`
- `docs/DISPENSATION_SOP.md`
- `docs/EARLY_DISMISSAL_SOP.md`
- `docs/SECURITY_AND_PRIVACY.md`
- `docs/HANDOVER_GUIDE.md`
- `docs/TESTING_CHECKLIST.md`

The documentation must be practical and understandable by future school administrators.

---

# 29. STRICT DEVELOPMENT RULES

These requirements are mandatory.

1. Do not stop after creating the dashboard.
2. Do not create a static-only prototype.
3. Do not use fake interactions for essential features.
4. Do not use hardcoded attendance statistics.
5. Do not leave important pages unfinished.
6. Do not use emojis.
7. Do not use generic placeholder text throughout the interface.
8. Do not expose private student data.
9. Do not bypass RLS.
10. Do not put service role credentials in frontend code.
11. Do not create insecure default administrator credentials.
12. Do not automatically approve permissions.
13. Do not treat QR Code scanning as proof of student presence.
14. Do not allow QR Code alone to authorize student dismissal.
15. Do not overwrite historical attendance records without an audit trail.
16. Do not install dependencies.
17. Do not claim that a feature works if it has not been implemented.
18. Do not leave critical functions as TODO comments.
19. Do not abandon implementation after reaching an initial milestone.
20. Maintain consistent design and architecture throughout the application.

If you encounter a limitation, implement the safest practical alternative and document it clearly.

---

# 30. ACCEPTANCE CRITERIA

The project is considered development-ready only when:

- The application has a consistent professional design.
- The dashboard uses real database queries.
- Authentication works with Supabase.
- Role-based access is enforced.
- Student and class management work.
- QR Code generation works.
- QR Code scanning works on supported devices.
- Duplicate attendance is prevented.
- Manual attendance is available.
- Parents can access only their linked children.
- Permission requests can be submitted and reviewed.
- Approved permissions update the appropriate attendance records.
- Dispensations have a separate approval and participation workflow.
- Early dismissal has a safe verification and handover workflow.
- Reports use consistent attendance calculations.
- Export functions work.
- Database RLS policies are prepared.
- Audit logs record critical changes.
- Error handling is implemented.
- Responsive layouts work.
- Documentation is complete.
- Environment configuration is documented.
- No real credentials are exposed.

Clearly distinguish between features implemented and features that still require external configuration.

---

# 31. FINAL EXECUTION INSTRUCTIONS

Start by inspecting the current VS Code workspace.

Then proceed to implement the entire project systematically.

Do not simply return an architecture proposal.

Create the actual files and implement the application.

You are allowed to make reasonable engineering decisions without repeatedly asking for permission when those decisions do not change the project's core requirements.

If a critical school policy or official institutional detail is unknown, create a configurable setting rather than inventing the information.

If the project is too large for one response, continue working in logical implementation phases. Preserve completed work and maintain a clear progress checklist. Do not replace completed functionality with a simplified mockup.

At the end, provide:

1. Summary of implemented modules.
2. Project directory structure.
3. List of dependencies added to `package.json`.
4. Exact manual npm installation command.
5. Supabase configuration steps.
6. SQL migration execution instructions.
7. Environment variable setup.
8. Exact command to start the development server.
9. Testing results and remaining limitations.
10. Features requiring school approval or operational configuration.

**IMPORTANT FINAL RULE:**

Do not execute `npm install`.

I will execute the dependency installation manually.

Your responsibility is to produce the complete, coherent, functional project inside the current VS Code workspace, with all necessary source files, configuration templates, database migrations, and documentation.

Begin by inspecting the workspace and then start implementation. Do not stop at planning.
