# Admin Panel Configuration

Third-party integration keys (reCAPTCHA, Google OAuth, etc.) will be configured via Admin Panel after frontend/backend implementation is complete.

## Implementation Notes

### Frontend Changes

1. **reCAPTCHA (Optional)**
   - `main.tsx`: GoogleReCaptchaProvider wraps app only if `VITE_RECAPTCHA_SITE_KEY` exists
   - `Register.tsx`: Registration works with or without reCAPTCHA
   - If reCAPTCHA not configured: registration succeeds with empty token
   - UI shows no error, just logs warning in console

2. **Google OAuth (via Supabase)**
   - Buttons always visible (UI decision)
   - If not configured in Supabase: OAuth flow fails gracefully with error message
   - Configuration: Supabase Dashboard > Authentication > Providers > Google

### Backend Considerations

When implementing backend reCAPTCHA verification:

```javascript
// Backend should handle missing reCAPTCHA token gracefully
if (recaptchaToken) {
  // Verify with Google reCAPTCHA API
  const isValid = await verifyRecaptcha(recaptchaToken);
  if (!isValid) {
    throw new Error('reCAPTCHA verification failed');
  }
} else {
  // reCAPTCHA not configured - log warning but allow registration
  console.warn('reCAPTCHA token not provided - feature not configured');
}
```

### Environment Variables

Development `.env.local`:
```env
# Leave empty if not testing these features
VITE_RECAPTCHA_SITE_KEY=

# Supabase (always required)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=...
```

Production: Keys configured via Admin Panel (not env variables).

### Admin Panel Integration (Future)

When Admin Panel is implemented:

1. **Settings Page**: Add section for third-party integrations
2. **reCAPTCHA Config**:
   - Site Key field
   - Secret Key field (stored in backend only)
   - Enable/Disable toggle
3. **Google OAuth Config**:
   - Client ID field
   - Client Secret field (stored in backend only)
   - Enable/Disable toggle
4. **Storage**: Store in database table `system_settings`
5. **API Endpoint**: `PATCH /api/admin/settings`
6. **Frontend**: Fetch settings on app init, store in context

### Testing Without Keys

All auth features work without third-party keys:

- ✅ Registration with email/password (no reCAPTCHA)
- ✅ Login with email/password
- ✅ Password reset
- ❌ Google OAuth (requires Supabase config)
- ✅ Protected routes
- ✅ Profile & credits display

---

**Status**: Frontend ready for Admin Panel integration. No hardcoded keys in production code.
