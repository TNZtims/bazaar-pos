# Admin Functionality

This document describes the admin functionality added to the POS system.

## Overview

The POS system now supports admin stores that have special privileges to create and manage other stores. This ensures that only authorized administrators can set up new stores in the system.

## Admin Properties

### Store Model
- Added `isAdmin: boolean` property to the Store model
- Admin stores have `isAdmin: true`, regular stores have `isAdmin: false`
- Only admin stores can create new stores

### Authentication
- JWT tokens now include `isAdmin` status
- Admin-specific authentication functions are available
- Frontend auth context includes admin status

## Admin Functions

### Backend (API)

#### Auth Functions (`src/lib/auth.ts`)
```typescript
// Authenticate admin requests
authenticateAdminRequest(request: NextRequest): Promise<AuthContext | null>

// Check if store has admin privileges  
isAdmin(store: IStore): boolean
```

#### Store Creation (`/api/stores/setup`)
- **BREAKING CHANGE**: Now requires admin authentication
- Only admin stores can create new stores
- New stores can be created as admin or regular stores

### Frontend

#### Auth Context (`src/contexts/AuthContext.tsx`)
- Added `isAdmin: boolean` to the auth context
- Use `const { isAdmin } = useAuth()` to check admin status

## Setup

### Creating the First Admin Store

Since store creation requires admin access, you need to create the first admin store using the setup script:

```bash
# Using environment variables (recommended)
ADMIN_STORE_NAME="Super Admin" \
ADMIN_USERNAME="superadmin" \
ADMIN_PASSWORD="secure123" \
ADMIN_EMAIL="admin@yourcompany.com" \
node scripts/create-admin-store.js

# Using defaults (admin/admin123)
node scripts/create-admin-store.js
```

### Environment Variables

You can customize the admin store creation using these environment variables:

- `ADMIN_STORE_NAME` - Name of the admin store (default: "Admin Store")
- `ADMIN_USERNAME` - Admin username (default: "admin")  
- `ADMIN_PASSWORD` - Admin password (default: "admin123")
- `ADMIN_EMAIL` - Admin email (default: "admin@example.com")

## Usage

### Creating New Stores (Admin Only)

Once you have an admin store, you can create new stores:

```typescript
// Admin login first
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
})

// Create new store
const createResponse = await fetch('/api/stores/setup', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // or use cookies
  },
  body: JSON.stringify({
    storeName: 'New Store',
    username: 'newstore',
    password: 'password123',
    isAdmin: false, // Set to true to create another admin store
    // ... other store details
  })
})
```

### Frontend Admin Checks

```typescript
import { useAuth } from '@/contexts/AuthContext'

function AdminPanel() {
  const { isAdmin, isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <div>Please log in</div>
  }
  
  if (!isAdmin) {
    return <div>Admin access required</div>
  }
  
  return (
    <div>
      <h1>Admin Panel</h1>
      {/* Admin-only content */}
    </div>
  )
}
```

## Security Notes

1. **Admin Access Control**: Only admin stores can create new stores
2. **Token Security**: Admin status is included in JWT tokens
3. **First Admin**: Must be created via the setup script
4. **Password Requirements**: Minimum 6 characters for all stores
5. **Environment Variables**: Use secure passwords in production

## Migration

### Existing Stores
- All existing stores will have `isAdmin: false` by default
- Use the setup script to create the first admin store
- Existing functionality remains unchanged for regular operations

### Database Changes
- Added `isAdmin` field to Store schema
- No data migration required for existing stores
- New index on `isAdmin` field for performance

## API Changes

### Modified Endpoints

#### `POST /api/stores/setup`
- **Before**: Public endpoint for store creation
- **After**: Admin-only endpoint
- **Breaking Change**: Requires admin authentication

#### `POST /api/auth/login`
- **Added**: Returns `isAdmin` status in response
- **Added**: Includes `isAdmin` in JWT token

#### `GET /api/auth/me`  
- **Added**: Returns `isAdmin` status in response

### Error Responses

```json
// When non-admin tries to create store
{
  "message": "Admin access required to create stores",
  "status": 403
}
```

## Troubleshooting

### Cannot Create Stores
- Ensure you're logged in as an admin store
- Check that your JWT token includes `isAdmin: true`
- Verify admin store exists in database

### Setup Script Issues
- Check MongoDB connection string
- Ensure admin credentials don't conflict with existing stores
- Verify password meets minimum requirements (6 characters)

### Frontend Auth Issues
- Check that `isAdmin` property is properly typed
- Ensure auth context is updated after login
- Verify API responses include admin status
