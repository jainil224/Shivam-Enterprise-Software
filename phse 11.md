# TASK — INTEGRATE FREE GSTINAPI INTO SHIVAM ENTERPRISE BMS

Integrate GSTINAPI into my existing Purchase Bill GSTIN verification system.

Provider documentation:
https://www.gstinapi.in/docs

## Requirements

1. Use the GSTINAPI REST API:
   GET /v1/gstin/{gstin}

2. Authentication:
   x-api-key header.

3. Read GSTIN_API_KEY exclusively from backend/.env.

4. Never expose API credentials to React.

5. Implement backend endpoint:
   GET /api/gstin/verify/:gstin

6. Validate GSTIN format before calling the provider.

7. Fetch actual supplier details:
   - GSTIN
   - Legal Name
   - Trade Name
   - Registration Status
   - Taxpayer Type
   - Registration Date
   - Registered Address
   - State Code
   - PIN Code

8. Map returned values into the Purchase Bill supplier form.

9. Display a verified badge only when the API returns success and the returned GSTIN exactly matches the requested GSTIN.

10. Handle:
   - Invalid GSTIN.
   - GSTIN not found.
   - Invalid API key.
   - Insufficient credits (HTTP 402).
   - Rate limit (HTTP 429).
   - Provider unavailable (HTTP 502).
   - Missing provider configuration.

11. Display credits_remaining after each successful lookup.

12. Cache successful results by GSTIN and verification timestamp to avoid unnecessary repeated API calls. Provide a manual refresh action to request fresh data. Clearly distinguish cached results from fresh verification.

13. Do not automatically create Party Master records. Supplier details should populate the Purchase Bill directly. Saving to Party Master remains optional.

14. Do not invent missing taxpayer fields or return fake successful responses.

15. Add a sandbox integration test using the provider's documented test GSTIN before testing real supplier records.

16. Do not modify Production Receive calculations, Packing Slip printing or unrelated modules.

17. Report changed files, API integration, test results and remaining free credits.

Complete only this task.