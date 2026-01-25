# Admin Panel Configuration

Third-party integration keys (reCAPTCHA, Google OAuth, etc.) will be configured via Admin Panel after frontend/backend implementation is complete.

## Implementation Notes

### Frontend Changes

1. **reCAPTCHA (REQUIRED per PRODUCT_SPEC.md 5.1)**
   - `main.tsx`: GoogleReCaptchaProvider wraps app only if `VITE_RECAPTCHA_SITE_KEY` exists
   - `Register.tsx`: **Registration is BLOCKED if reCAPTCHA not configured**
     - Shows error alert: "reCAPTCHA yapılandırılmadı (Admin Panel)"
     - All form fields are disabled
     - Submit button is disabled
     - User cannot proceed with registration
   - If reCAPTCHA configured: Registration proceeds normally with token verification

2. **Google OAuth (Optional via Supabase)**
   - Buttons always visible in UI
   - When clicked and OAuth not configured: Shows error message
   - Error: "Google OAuth yapılandırılmadı (Admin Panel)"
   - Flow does not proceed, user notified to contact admin
   - Configuration: Supabase Dashboard > Authentication > Providers > Google

### Backend Considerations

Backend must validate reCAPTCHA token on registration:

```javascript
// Backend registration endpoint
app.post('/auth/register', async (req, res) => {
  const { recaptchaToken } = req.body;
  
  if (!recaptchaToken) {
    return res.status(400).json({
      error: 'reCAPTCHA token required',
      message: 'Registration requires reCAPTCHA verification'
    });
  }
  
  // Verify with Google reCAPTCHA API
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  if (!recaptchaSecret) {
    return res.status(503).json({
      error: 'Service not configured',
      message: 'reCAPTCHA not configured on server'
    });
  }
  
  const isValid = await verifyRecaptcha(recaptchaToken, recaptchaSecret);
  if (!isValid) {
    return res.status(400).json({
      error: 'reCAPTCHA verification failed',
      message: 'Invalid reCAPTCHA token'
    });
  }
  
  // Proceed with registration...
});
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
