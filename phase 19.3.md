# TASK: Fix WhatsApp QR Code Generation and Connection in SHIVAM ENTERPRISE BMS

## 1. Problem description

My SHIVAM ENTERPRISE Business Management System has a WhatsApp Integration page.

The expected functionality is:

1. User opens the website on localhost.
2. User clicks the Connect WhatsApp button.
3. Backend starts the WhatsApp Web client.
4. Backend generates a genuine WhatsApp QR code.
5. Frontend displays that QR code.
6. User scans the QR code using WhatsApp on their mobile phone.
7. WhatsApp connects successfully to the BMS.
8. User can subsequently send ERP-generated PDF documents directly through WhatsApp.

Currently, this functionality is not working.

The frontend remains stuck at Starting, and the QR code does not appear.

## 2. Previous backend error logs

These are the actual logs from my backend:

```text
[BMS Backend] Server successfully running at http://localhost:5000
[BMS Backend] Environment: development

[BMS WhatsApp] Starting browser client for company session-902a42ff-ee15-4437-af80-d649a06faabd...
[BMS WhatsApp] Starting browser client for company session-diag-1794639562505...
[BMS WhatsApp] Starting browser client for company session-diagnose-test...

[BMS Backend] Restored 3 WhatsApp session(s).

[BMS WhatsApp] Starting browser client for company 902a42ff-ee15-4437-af80-d649a06faabd...

[BMS WhatsApp] Disconnected (session-902a42ff-ee15-4437-af80-d649a06faabd): LOGOUT

[BMS WhatsApp] QR code received for company session-diag-1794639562505

[BMS WhatsApp] QR code received for company session-diagnose-test

[BMS WhatsApp] Client error during initialization (902a42ff-ee15-4437-af80-d649a06faabd):
TimeoutError: Waiting failed: 90000ms exceeded

at CdpPage.waitForFunction
at Client.inject
at async Client.initialize
```

## 3. First priority: Identify and fix the actual root cause

Inspect the existing implementation before changing code.

Investigate:

- WhatsApp client initialization.
- Puppeteer and Chromium startup.
- `whatsapp-web.js` installed version.
- `Client.inject` failure.
- WhatsApp Web initialization.
- QR event registration.
- LocalAuth session management.
- Company ID and session ID mapping.
- Backend QR API.
- Frontend polling and QR rendering.

Pay special attention to the fact that diagnostic sessions receive QR events, but the real company session does not.

Do not consider diagnostic QR events as successful company QR generation.

Investigate why three sessions are restored at backend startup and whether diagnostic sessions have accidentally been persisted.

## 4. Fix the real company session

Implement a reliable WhatsApp client lifecycle.

Requirements:

- One WhatsApp client per intended company session.
- Prevent duplicate client initialization.
- Register event listeners before initialization.
- Correctly associate QR events with their company.
- Handle `qr`, `authenticated`, `ready`, `auth_failure`, and `disconnected` events.
- Handle initialization errors and browser crashes.
- Avoid uncontrolled restart loops.
- Preserve valid existing sessions.
- Handle a logged-out session so the user can scan a fresh QR code.

Investigate the 90-second `Client.inject` timeout using the exact installed library source.

Check whether the installed `whatsapp-web.js` version has a known Puppeteer polling issue. Verify the exact affected code before applying a compatible upstream update or maintained dependency patch.

Do not blindly increase the timeout.

## 5. Fix QR generation and delivery

When the actual WhatsApp client emits its `qr` event:

1. Capture the genuine QR string.
2. Convert it into an image data URL using the existing QR library.
3. Temporarily store the latest QR in backend memory.
4. Associate it with the correct company session.
5. Return the QR image through the existing API.
6. Display it immediately on the frontend.

The frontend must not receive QR data from diagnostic sessions.

Use meaningful connection states:

- DISCONNECTED
- STARTING
- WAITING_FOR_QR
- QR_READY
- AUTHENTICATED
- CONNECTED
- AUTH_FAILURE
- ERROR

If the client is already authenticated, show Connected instead of waiting for another QR.

## 6. Fix the Connect WhatsApp button

When the user clicks Connect WhatsApp:

- Start the actual company WhatsApp client.
- Show a loading indicator while initializing.
- Retrieve the real QR code when available.
- Display the QR image automatically.
- Show a meaningful error if initialization fails.
- Allow the user to restart the connection.
- Prevent repeated clicks from creating duplicate clients.

The user should not need to restart the backend manually every time they click Connect.

## 7. STRICT REQUIREMENT: NO WEBSITE AUTHENTICATION

I do NOT want any new website authentication system.

Do not introduce:

- Login or registration pages.
- Username/password authentication.
- OTP verification.
- Email verification.
- Google OAuth.
- Meta login.
- Additional authentication middleware.
- WhatsApp API keys.
- Paid WhatsApp Cloud API.

The existing website must remain accessible exactly as it is currently.

WhatsApp QR scanning is the only account-linking step required for the WhatsApp integration.

Do not modify the existing website authentication behavior or introduce new login screens.

Keep the existing company and financial-year selection functionality unchanged.

## 8. Windows 10 compatibility

My development environment is Windows 10.

Verify that:

- Puppeteer launches correctly on Windows.
- Chromium is available.
- Browser profiles have the correct permissions.
- LocalAuth session folders are writable.
- Browser processes are cleaned up safely.
- Old browser processes do not interfere with new clients.

Investigate the following cleanup messages:

```text
The process with PID ... could not be terminated.
Reason: There is no running instance of the task.
```

Determine whether these are harmless cleanup race conditions or actual process leaks.

Never terminate unrelated Chrome processes.

## 9. Frontend requirements

Preserve the existing WhatsApp Integration page design.

The page must display:

- Connection status.
- Actual QR code.
- Connect WhatsApp button.
- Restart/Disconnect controls.
- Useful initialization errors.
- Existing Send History table.

The QR placeholder must automatically change into the real QR image when the backend receives it.

Do not create a fake QR image or display a QR belonging to another session.

## 10. Testing

Test these scenarios:

1. Fresh company session generates a QR.
2. Frontend displays the real QR.
3. User scans the QR using their mobile WhatsApp.
4. WhatsApp reaches Connected.
5. Existing authenticated session reconnects correctly.
6. Logged-out session can request a fresh QR.
7. Repeated Connect clicks do not create duplicate clients.
8. Diagnostic sessions are not restored during normal startup.
9. Browser initialization errors are displayed properly.
10. Restart and Disconnect work.
11. No new website authentication is required.

Use mocked clients for automated tests. Do not send real WhatsApp messages during automated testing.

## 11. Important restrictions

- Do not rewrite the entire BMS.
- Do not modify accounting, billing, reports, manufacturing, or unrelated modules.
- Do not delete existing WhatsApp session data without a confirmed reason and backup.
- Do not add fake data.
- Do not add a new authentication system.
- Do not introduce paid APIs.
- Do not claim QR generation works based only on diagnostic sessions.
- Avoid unnecessary database migrations.
- Keep the existing architecture and coding conventions.

## 12. Final acceptance criteria

The implementation is successful only when:

1. I start my BMS locally.
2. I open WhatsApp Integration.
3. I click Connect WhatsApp.
4. The backend launches the correct company WhatsApp client.
5. A genuine QR code is generated.
6. The QR code appears on my website.
7. I scan it using my mobile phone.
8. WhatsApp connects successfully to my BMS.
9. The page displays Connected.
10. No additional website login or authentication is required.

Run relevant tests, TypeScript checks, and production builds.

Provide a final report containing the confirmed root cause, files modified, fixes implemented, test results, and any remaining manual steps.

Do not stop at diagnosis. Implement the fix, verify the actual company QR connection, and stop for my manual review.