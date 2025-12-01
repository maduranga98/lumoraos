// src/config/permissions.config.js

/**
 * Permission Configuration for Role-Based Access Control
 * Each module has view, create, edit, and delete permissions
 */

export const PERMISSIONS = {
  // Human Resources
  HR: {
    module: "hr",
    label: "Human Resources",
    permissions: {
      VIEW_EMPLOYEES: "hr_view_employees",
      ADD_EMPLOYEES: "hr_add_employees",
      EDIT_EMPLOYEES: "hr_edit_employees",
      DELETE_EMPLOYEES: "hr_delete_employees",
    },
  },

  // Logistics
  LOGISTICS: {
    module: "logistics",
    label: "Logistics",
    permissions: {
      VIEW_VEHICLES: "logistics_view_vehicles",
      ADD_VEHICLES: "logistics_add_vehicles",
      EDIT_VEHICLES: "logistics_edit_vehicles",
      DELETE_VEHICLES: "logistics_delete_vehicles",
      VIEW_EXPENSES: "logistics_view_expenses",
      ADD_EXPENSES: "logistics_add_expenses",
      EDIT_EXPENSES: "logistics_edit_expenses",
      DELETE_EXPENSES: "logistics_delete_expenses",
      VIEW_SERVICES: "logistics_view_services",
      ADD_SERVICES: "logistics_add_services",
      EDIT_SERVICES: "logistics_edit_services",
      DELETE_SERVICES: "logistics_delete_services",
    },
  },

  // Suppliers & Inventory
  INVENTORY: {
    module: "inventory",
    label: "Suppliers & Inventory",
    permissions: {
      VIEW_SUPPLIERS: "inventory_view_suppliers",
      ADD_SUPPLIERS: "inventory_add_suppliers",
      EDIT_SUPPLIERS: "inventory_edit_suppliers",
      DELETE_SUPPLIERS: "inventory_delete_suppliers",
      VIEW_RAW_MATERIALS: "inventory_view_raw_materials",
      ADD_RAW_MATERIALS: "inventory_add_raw_materials",
      EDIT_RAW_MATERIALS: "inventory_edit_raw_materials",
      DELETE_RAW_MATERIALS: "inventory_delete_raw_materials",
      VIEW_PURCHASES: "inventory_view_purchases",
      ADD_PURCHASES: "inventory_add_purchases",
      EDIT_PURCHASES: "inventory_edit_purchases",
      DELETE_PURCHASES: "inventory_delete_purchases",
    },
  },

  // Stock Management
  STOCK: {
    module: "stock",
    label: "Stock Management",
    permissions: {
      VIEW_MATERIAL_STOCK: "stock_view_material_stock",
      ISSUE_MATERIALS: "stock_issue_materials",
      VIEW_PRODUCTION_STOCK: "stock_view_production_stock",
      ADD_PRODUCTION: "stock_add_production",
      EDIT_PRODUCTION: "stock_edit_production",
      DELETE_PRODUCTION: "stock_delete_production",
    },
  },

  // Products
  PRODUCTS: {
    module: "products",
    label: "Products",
    permissions: {
      VIEW_PRODUCTS: "products_view_products",
      ADD_PRODUCTS: "products_add_products",
      EDIT_PRODUCTS: "products_edit_products",
      DELETE_PRODUCTS: "products_delete_products",
      VIEW_BATCHES: "products_view_batches",
      ADD_BATCHES: "products_add_batches",
      EDIT_BATCHES: "products_edit_batches",
    },
  },

  // Route Planning
  ROUTES: {
    module: "routes",
    label: "Route Planning",
    permissions: {
      VIEW_ROUTES: "routes_view_routes",
      ADD_ROUTES: "routes_add_routes",
      EDIT_ROUTES: "routes_edit_routes",
      DELETE_ROUTES: "routes_delete_routes",
      ASSIGN_ROUTES: "routes_assign_routes",
      VIEW_ROUTE_PLANNING: "routes_view_planning",
    },
  },

  // Sales & Distribution
  SALES: {
    module: "sales",
    label: "Sales & Distribution",
    permissions: {
      VIEW_OUTLETS: "sales_view_outlets",
      ADD_OUTLETS: "sales_add_outlets",
      EDIT_OUTLETS: "sales_edit_outlets",
      DELETE_OUTLETS: "sales_delete_outlets",
      VIEW_OUTLET_STOCK: "sales_view_outlet_stock",
      MANAGE_OUTLET_STOCK: "sales_manage_outlet_stock",
      VIEW_DAILY_LOADING: "sales_view_daily_loading",
      ADD_DAILY_LOADING: "sales_add_daily_loading",
    },
  },

  // Reports & Analytics
  REPORTS: {
    module: "reports",
    label: "Reports & Analytics",
    permissions: {
      VIEW_REPORTS: "reports_view_reports",
      EXPORT_REPORTS: "reports_export_reports",
      VIEW_ANALYTICS: "reports_view_analytics",
    },
  },

  // System Settings
  SETTINGS: {
    module: "settings",
    label: "System Settings",
    permissions: {
      VIEW_SETTINGS: "settings_view_settings",
      EDIT_SETTINGS: "settings_edit_settings",
      MANAGE_ROLES: "settings_manage_roles",
    },
  },

  // Super Admin - System Administration
  SUPERADMIN: {
    module: "superadmin",
    label: "Super Admin",
    permissions: {
      MANAGE_ALL_USERS: "superadmin_manage_all_users",
      ACTIVATE_USERS: "superadmin_activate_users",
      DEACTIVATE_USERS: "superadmin_deactivate_users",
      REGISTER_USERS: "superadmin_register_users",
      DELETE_USERS: "superadmin_delete_users",
      VIEW_SYSTEM_LOGS: "superadmin_view_system_logs",
      MANAGE_ADMINS: "superadmin_manage_admins",
    },
  },
};

/**
 * Predefined Roles with Default Permissions
 */
export const PREDEFINED_ROLES = {
  SUPER_ADMIN: {
    id: "superadmin",
    name: "Super Administrator",
    description: "Ultimate system access - can manage all users and system settings",
    permissions: "all", // Special case - all permissions including super admin
    isSuperAdmin: true,
  },

  ADMIN: {
    id: "admin",
    name: "Administrator",
    description: "Full system access",
    permissions: "all", // Special case - all permissions
  },

  MANAGER: {
    id: "manager",
    name: "Manager",
    description: "Can view all, edit most sections",
    permissions: [
      // HR
      ...Object.values(PERMISSIONS.HR.permissions),

      // Logistics - View only
      PERMISSIONS.LOGISTICS.permissions.VIEW_VEHICLES,
      PERMISSIONS.LOGISTICS.permissions.VIEW_EXPENSES,
      PERMISSIONS.LOGISTICS.permissions.VIEW_SERVICES,

      // Inventory - Full access
      ...Object.values(PERMISSIONS.INVENTORY.permissions),

      // Stock - Full access
      ...Object.values(PERMISSIONS.STOCK.permissions),

      // Products - Full access
      ...Object.values(PERMISSIONS.PRODUCTS.permissions),

      // Routes - Full access
      ...Object.values(PERMISSIONS.ROUTES.permissions),

      // Sales - Full access
      ...Object.values(PERMISSIONS.SALES.permissions),

      // Reports - View only
      PERMISSIONS.REPORTS.permissions.VIEW_REPORTS,
      PERMISSIONS.REPORTS.permissions.VIEW_ANALYTICS,
    ],
  },

  SALES_REP: {
    id: "sales_rep",
    name: "Sales Representative",
    description: "Route planning and outlet management",
    permissions: [
      // Routes - View and planning only
      PERMISSIONS.ROUTES.permissions.VIEW_ROUTES,
      PERMISSIONS.ROUTES.permissions.VIEW_ROUTE_PLANNING,

      // Sales - Limited access
      PERMISSIONS.SALES.permissions.VIEW_OUTLETS,
      PERMISSIONS.SALES.permissions.VIEW_OUTLET_STOCK,
      PERMISSIONS.SALES.permissions.VIEW_DAILY_LOADING,
      PERMISSIONS.SALES.permissions.ADD_DAILY_LOADING,

      // Products - View only
      PERMISSIONS.PRODUCTS.permissions.VIEW_PRODUCTS,
    ],
  },

  INVENTORY_MANAGER: {
    id: "inventory_manager",
    name: "Inventory Manager",
    description: "Manages inventory, suppliers, and stock",
    permissions: [
      // Inventory - Full access
      ...Object.values(PERMISSIONS.INVENTORY.permissions),

      // Stock - Full access
      ...Object.values(PERMISSIONS.STOCK.permissions),

      // Products - View only
      PERMISSIONS.PRODUCTS.permissions.VIEW_PRODUCTS,
      PERMISSIONS.PRODUCTS.permissions.VIEW_BATCHES,

      // Reports - View only
      PERMISSIONS.REPORTS.permissions.VIEW_REPORTS,
    ],
  },

  LOGISTICS_MANAGER: {
    id: "logistics_manager",
    name: "Logistics Manager",
    description: "Manages vehicles, expenses, and services",
    permissions: [
      // Logistics - Full access
      ...Object.values(PERMISSIONS.LOGISTICS.permissions),

      // Routes - View only
      PERMISSIONS.ROUTES.permissions.VIEW_ROUTES,
      PERMISSIONS.ROUTES.permissions.VIEW_ROUTE_PLANNING,

      // Reports - View only
      PERMISSIONS.REPORTS.permissions.VIEW_REPORTS,
    ],
  },

  ACCOUNTANT: {
    id: "accountant",
    name: "Accountant",
    description: "Financial reports and expense tracking",
    permissions: [
      // Logistics expenses - View only
      PERMISSIONS.LOGISTICS.permissions.VIEW_EXPENSES,

      // Inventory purchases - View only
      PERMISSIONS.INVENTORY.permissions.VIEW_PURCHASES,

      // Reports - Full access
      ...Object.values(PERMISSIONS.REPORTS.permissions),
    ],
  },

  VIEWER: {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to most sections",
    permissions: [
      PERMISSIONS.HR.permissions.VIEW_EMPLOYEES,
      PERMISSIONS.LOGISTICS.permissions.VIEW_VEHICLES,
      PERMISSIONS.LOGISTICS.permissions.VIEW_EXPENSES,
      PERMISSIONS.LOGISTICS.permissions.VIEW_SERVICES,
      PERMISSIONS.INVENTORY.permissions.VIEW_SUPPLIERS,
      PERMISSIONS.INVENTORY.permissions.VIEW_RAW_MATERIALS,
      PERMISSIONS.INVENTORY.permissions.VIEW_PURCHASES,
      PERMISSIONS.STOCK.permissions.VIEW_MATERIAL_STOCK,
      PERMISSIONS.STOCK.permissions.VIEW_PRODUCTION_STOCK,
      PERMISSIONS.PRODUCTS.permissions.VIEW_PRODUCTS,
      PERMISSIONS.PRODUCTS.permissions.VIEW_BATCHES,
      PERMISSIONS.ROUTES.permissions.VIEW_ROUTES,
      PERMISSIONS.SALES.permissions.VIEW_OUTLETS,
      PERMISSIONS.SALES.permissions.VIEW_OUTLET_STOCK,
      PERMISSIONS.REPORTS.permissions.VIEW_REPORTS,
    ],
  },
};

/**
 * Get all available permissions as an array
 */
export const getAllPermissions = () => {
  const allPermissions = [];

  Object.values(PERMISSIONS).forEach((module) => {
    Object.values(module.permissions).forEach((permission) => {
      allPermissions.push(permission);
    });
  });

  return allPermissions;
};

/**
 * Get permissions by module
 */
export const getPermissionsByModule = (moduleName) => {
  const module = PERMISSIONS[moduleName];
  return module ? Object.values(module.permissions) : [];
};

/**
 * Get all modules for permission selection
 */
export const getModulesForSelection = () => {
  return Object.entries(PERMISSIONS).map(([key, value]) => ({
    key,
    module: value.module,
    label: value.label,
    permissions: Object.entries(value.permissions).map(
      ([permKey, permValue]) => ({
        key: permKey,
        value: permValue,
        label: permKey
          .split("_")
          .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
          .join(" "),
      })
    ),
  }));
};
