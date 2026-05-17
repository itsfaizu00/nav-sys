# Campus Navigator - Login System

## Overview
A complete authentication system has been added to the Campus Navigator app. Users must now login before accessing the campus map.

## Files Added/Modified

### 1. **login.html** (NEW)
Complete login page with:
- Email/Student ID input field
- Password input field
- "Remember me" checkbox
- Demo credentials display
- Professional dark theme matching the app design
- Form validation with error messages
- Loading state during authentication

**Demo Credentials:**
- Email: `user@integral.edu`
- Password: `password123`

Or:
- Email: `admin@integral.edu`
- Password: `admin123`

### 2. **index.html** (MODIFIED)
Added:
- Login wall that appears if user is not authenticated
- User menu in top-right corner showing:
  - User name and email
  - Logout button
  - Professional styling with hover effects

### 3. **style.css** (MODIFIED)
Added styles for:
- Login wall (full-screen overlay)
- User menu trigger button (top-right)
- User menu dropdown with user info
- Logout button styling
- Responsive design for mobile devices

### 4. **script.js** (MODIFIED)
Added:
- `AuthManager` class for session management
  - Checks if user is logged in
  - Manages user session data
  - Handles logout functionality
  - Redirects to login if not authenticated
- User menu initialization
- Logout button event listener

## How It Works

### Flow
1. User opens the app (index.html)
2. `AuthManager` checks for existing session in localStorage
3. If no session exists, user is redirected to login.html
4. User enters credentials (email/student ID + password)
5. On successful login:
   - User data is stored in localStorage
   - Session token is generated
   - User is redirected to the main app
6. User menu appears in top-right corner
7. User can click menu to logout

### Session Storage
All session data is stored in browser's localStorage:
- `nav_sys_user` - User object (name, email, ID)
- `nav_sys_token` - Session token for validation
- `nav_sys_timestamp` - Login timestamp
- `nav_sys_remember` - Remember me preference (optional)

### Security Notes
**Current Implementation (Demo):**
- Uses localStorage (client-side only)
- For development/demo purposes

**For Production:**
- Implement server-side authentication
- Use secure API endpoints for login
- Generate JWT tokens on server
- Implement token expiration
- Add password hashing on server
- Use HTTPS only
- Add CSRF protection

## Features

✅ **Login Page**
- Clean, modern design
- Form validation
- Error messages
- Demo credentials

✅ **Session Management**
- Automatic login checks
- Session persistence
- Logout functionality

✅ **User Menu**
- Display user info
- Easy logout access
- Responsive design

✅ **Mobile Friendly**
- Responsive layout
- Touch-friendly buttons
- Works on all devices

## Testing

1. **First Visit**: App redirects to login.html
2. **Demo Login**: Enter demo credentials and click "Sign In"
3. **Map Access**: After login, main map loads
4. **User Menu**: Top-right corner shows user info
5. **Logout**: Click user menu → Logout button
6. **Remember Me**: Check "Remember me" → Close and reopen → App auto-logs in

## Extending the System

### Add Real Authentication
Replace the demo credentials in `login.html` with actual API calls:
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password })
});
const data = await response.json();
if (data.success) {
  localStorage.setItem('nav_sys_token', data.token);
  // redirect to app
}
```

### Add Registration
Create a registration page (register.html) with form validation

### Add Password Reset
Add password reset functionality on login page

### Add Social Login
Add Google, Microsoft, or other OAuth providers

## File Structure
```
/
├── index.html          (Main app - now with login check)
├── login.html          (NEW - Login page)
├── style.css           (Updated with auth styles)
├── script.js           (Updated with auth logic)
├── manifest.json       (Unchanged)
├── sw.js               (Unchanged)
└── README.md           (Original)
```

---

**Version:** 1.0  
**Last Updated:** May 17, 2026
