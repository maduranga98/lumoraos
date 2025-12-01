# Super Admin System Guide

## Overview

The Super Admin system provides the highest level of access to LumoraOS, allowing complete control over user management, account activation/deactivation, and system administration.

## Features

### 1. Super Admin Role
- **Ultimate System Access**: Highest privilege level in the system
- **User Management**: Create, view, and manage all user accounts
- **Account Control**: Activate or deactivate user accounts
- **All Permissions**: Automatic access to all system features and modules

### 2. Separate Authentication
- **Dedicated Login Page**: `/superadmin-login` - Separate from regular user login
- **Enhanced Security**: Only users with `roleId: "superadmin"` can access
- **Session Management**: Secure session storage with remember-me option

### 3. User Management Dashboard
- **Comprehensive Overview**: View all users with detailed information
- **Statistics**: Real-time stats for total, active, inactive, and admin users
- **Search & Filter**: Search by name, username, email, or phone; filter by status and role
- **Quick Actions**: One-click account activation/deactivation

### 4. User Registration
- **Complete User Creation**: Register new users with all necessary details
- **Role Assignment**: Assign predefined roles or create custom permissions
- **Password Generation**: Built-in random password generator
- **Account Status**: Set initial account status (active/inactive)

## Getting Started

### Initial Setup

1. **Create the First Super Admin Account**
   - Navigate to: `http://localhost:3000/superadmin-setup`
   - Fill in the required information:
     - Full Name
     - Username (must be unique)
     - Email (optional)
     - Phone Number
     - Password (minimum 8 characters)
   - Click "Create Super Admin Account"

2. **Login as Super Admin**
   - Navigate to: `http://localhost:3000/superadmin-login`
   - Enter your super admin credentials
   - You'll be redirected to the Super Admin Dashboard

### Using the Super Admin Dashboard

#### Viewing Users
- The dashboard displays all users in a table format
- Each user shows:
  - Name and username
  - Contact information (email, phone)
  - Assigned role
  - Account status (active/inactive)
  - Last login date

#### Filtering and Searching
- **Search Bar**: Type to search by name, username, email, or phone number
- **Status Filter**: Show all, active only, or inactive only
- **Role Filter**: Filter by specific roles (Admin, Manager, Sales Rep, etc.)

#### Managing User Status
- Click "Activate" or "Deactivate" next to any user
- Deactivated users cannot log in to the system
- Super Admin accounts cannot be deactivated (protected)

#### Registering New Users

1. Click "Register New User" button in the dashboard header
2. Fill in user information:
   - **User Information**:
     - Full Name *
     - Username * (must be unique)
     - Email (optional)
     - Phone Number *
     - Password * (use generator or create your own)
     - Salary & Commission (optional)
   - **Role & Permissions**:
     - Choose "Predefined Role" for standard roles
     - Or "Custom Permissions" for specific access control
3. Set account status (Active/Inactive)
4. Click "Register User"

## Available Routes

### Public Routes
- `/superadmin-setup` - Initial super admin account creation (one-time)
- `/superadmin-login` - Super admin login page

### Protected Routes (Super Admin Only)
- `/superadmin/dashboard` - Main super admin dashboard
- `/superadmin/register-user` - User registration form

## Role Hierarchy

```
Super Admin (Highest)
├── Administrator
├── Manager
├── Sales Representative
├── Inventory Manager
├── Logistics Manager
├── Accountant
└── Viewer (Lowest)
```

## Predefined Roles

### Super Administrator
- **Access**: Complete system control
- **Special Abilities**:
  - Manage all users including other admins
  - Cannot be deactivated by anyone
  - Access to super admin dashboard

### Administrator
- **Access**: Full system access to all modules
- **Permissions**: All standard permissions (but not super admin privileges)

### Manager
- Full access to HR, Inventory, Stock, Products, Routes, and Sales
- View-only access to Logistics and Reports

### Sales Representative
- View and plan routes
- Manage outlets and daily loading
- View products

### Inventory Manager
- Full access to Inventory and Stock management
- View products and reports

### Logistics Manager
- Full access to Logistics (vehicles, expenses, services)
- View routes and reports

### Accountant
- View logistics expenses and inventory purchases
- Full access to Reports

### Viewer
- Read-only access to most sections

## Security Features

### Authentication
- Separate login system from regular users
- Role-based access control (RBAC)
- Session management with localStorage/sessionStorage

### Account Protection
- Super Admin accounts are protected from deactivation
- Username uniqueness validation
- Password requirements (minimum 6-8 characters)

### Audit Trail
- User creation tracked with `createdBy` and `createdAt`
- User updates tracked with `updatedBy` and `updatedAt`
- Last login timestamps

## Database Structure

### Users Collection
```javascript
{
  userId: "superadmin_1234567890",
  fullName: "Super Admin",
  username: "superadmin",
  email: "admin@example.com",
  phoneNumber: "+1234567890",
  password: "encrypted_password", // Plain text in current implementation

  // Role & Permissions
  role: "Super Administrator",
  roleType: "predefined",
  roleId: "superadmin",
  permissions: [],
  isSuperAdmin: true,

  // Status
  isActive: true,
  status: "active",

  // Audit
  createdAt: timestamp,
  createdBy: "system",
  updatedAt: timestamp,
  updatedBy: "system",
  lastLoginAt: timestamp
}
```

### Usernames Collection
```javascript
{
  documentId: "username_lowercase",
  userId: "user_id_reference",
  createdAt: timestamp
}
```

## Common Tasks

### 1. Creating a New Employee with Account Access
1. Login as Super Admin
2. Click "Register New User"
3. Fill in employee details
4. Select appropriate role (e.g., "Sales Representative")
5. Ensure "Active account" is checked
6. Click "Register User"

### 2. Disabling a User Account
1. Login as Super Admin
2. Go to Super Admin Dashboard
3. Find the user in the table
4. Click "Deactivate" next to their name
5. Confirm the action

### 3. Re-enabling a Disabled Account
1. Login as Super Admin
2. Go to Super Admin Dashboard
3. Filter by "Inactive" status
4. Find the user
5. Click "Activate" next to their name

### 4. Viewing User Activity
1. Login as Super Admin
2. Go to Super Admin Dashboard
3. Check the "Last Login" column for each user

## Troubleshooting

### Can't Access Super Admin Setup
- **Issue**: Page shows "Setup Already Complete"
- **Solution**: A super admin already exists. Use `/superadmin-login` instead

### Login Fails
- **Issue**: "Access denied. This login is only for Super Administrators"
- **Solution**: This account doesn't have super admin privileges. Use regular login at `/login`

### Can't Deactivate a User
- **Issue**: "Protected" appears instead of "Deactivate"
- **Solution**: Super Admin accounts cannot be deactivated for security reasons

### Username Already Taken
- **Issue**: Red error when entering username
- **Solution**: Choose a different username - usernames must be unique

## Best Practices

1. **Secure Your Super Admin Account**
   - Use a strong, unique password
   - Don't share super admin credentials
   - Use "Remember Me" only on trusted devices

2. **User Management**
   - Assign the minimum necessary role for each user
   - Regularly review active users
   - Deactivate accounts for terminated employees immediately

3. **Account Creation**
   - Use descriptive usernames (e.g., john.smith)
   - Generate strong passwords using the built-in generator
   - Verify phone numbers and emails are correct

4. **Regular Audits**
   - Check last login dates to identify inactive accounts
   - Review user roles periodically
   - Monitor admin-level account creations

## Technical Notes

### Permissions System
- Super Admin has automatic access to all permissions
- Checking `user.roleId === "superadmin"` grants all access
- Regular permission checks are bypassed for super admins

### Context Integration
- `isSuperAdmin()` function available in `useUser()` hook
- Super admin flag stored in user context and session
- All permission checking functions include super admin override

## Future Enhancements

Potential improvements for the super admin system:
- Activity logs and audit trail viewer
- Password hashing (currently plain text)
- Two-factor authentication
- Role management interface
- Bulk user operations
- Email notifications for account changes
- Password reset functionality
- Session timeout configuration

## Support

For issues or questions about the Super Admin system:
- Check the Troubleshooting section above
- Review user permissions in the database
- Verify Firestore security rules allow super admin operations

## Version Information

- **Created**: 2025-12-01
- **Last Updated**: 2025-12-01
- **Compatible with**: LumoraOS v1.0
