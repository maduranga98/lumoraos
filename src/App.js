// src/App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Auth Components
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";

// Protected Route Component
import ProtectedRoute from "./components/guards/ProtectedRoute";

// Dashboard
import Dashboard from "./components/pages/Dashboard";

// Users / HR
import AddUsers from "./components/pages/users/AddUsers";
import UserList from "./components/pages/users/UserList";

// Logistics
import AddVehicles from "./components/pages/logistics/AddVehicles";
import VehicleList from "./components/pages/logistics/VehicleList";
import ExpensesLog from "./components/pages/logistics/ExpensesLog";
import ServicesAndRepairs from "./components/pages/logistics/ServicesAndReparis";

// Suppliers & Inventory
import AddingSuppliers from "./components/pages/purchasingnsuppliers/AddingSuppliers";
import RawMaterials from "./components/pages/inventory/RawMaterials";
import Purchases from "./components/pages/purchases/Purchases";
import MaterialMovements from "./components/pages/inventory/MaterialMovements";

// Stock Management
import MaterialIssue from "./components/pages/stocks/material_stock/MaterialIssue";
import ProductDefinition from "./components/pages/stocks/production_stock/ProductDefinition";
import ProductionEntry from "./components/pages/stocks/production_stock/ProductionStock";

// Products
import Products from "./components/pages/products/Products";
import ProductionBatches from "./components/pages/products/ProductionBatches";

// Routes Planning
import AddingRoutes from "./components/pages/sales/RoutesPlanner/AddingRoutes";
import AssignRoutes from "./components/pages/sales/RoutesPlanner/AssignRoutes";
import RoutesPlanning from "./components/pages/sales/RoutesPlanner/RoutesPlaner";

// Sales & Outlets
import OutletStockPage from "./components/pages/outlets/OutletStockPage";
import OutletsPage from "./components/pages/outlets/OutletsPage";
import DailyLoading from "./components/pages/sales/DailyLoading";

const App = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Dashboard - Basic Authentication Required */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* ==================== HR ROUTES ==================== */}
      <Route
        path="/addemployees"
        element={
          <ProtectedRoute permission="hr_add_employees">
            <AddUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employeelist"
        element={
          <ProtectedRoute permission="hr_view_employees">
            <UserList />
          </ProtectedRoute>
        }
      />

      {/* ==================== LOGISTICS ROUTES ==================== */}
      <Route
        path="/add-vehicles"
        element={
          <ProtectedRoute permission="logistics_add_vehicles">
            <AddVehicles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vehicles"
        element={
          <ProtectedRoute permission="logistics_view_vehicles">
            <VehicleList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute
            permissions={["logistics_view_expenses", "logistics_add_expenses"]}
          >
            <ExpensesLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services-repairs"
        element={
          <ProtectedRoute
            permissions={["logistics_view_services", "logistics_add_services"]}
          >
            <ServicesAndRepairs />
          </ProtectedRoute>
        }
      />

      {/* ==================== SUPPLIERS & INVENTORY ROUTES ==================== */}
      <Route
        path="/adding-suppliers"
        element={
          <ProtectedRoute
            permissions={[
              "inventory_view_suppliers",
              "inventory_add_suppliers",
            ]}
          >
            <AddingSuppliers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute
            permissions={[
              "inventory_view_suppliers",
              "inventory_add_suppliers",
            ]}
          >
            <AddingSuppliers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/raw-materials"
        element={
          <ProtectedRoute
            permissions={[
              "inventory_view_raw_materials",
              "inventory_add_raw_materials",
            ]}
          >
            <RawMaterials />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases"
        element={
          <ProtectedRoute
            permissions={[
              "inventory_view_purchases",
              "inventory_add_purchases",
            ]}
          >
            <Purchases />
          </ProtectedRoute>
        }
      />
      <Route
        path="/material-movements"
        element={
          <ProtectedRoute permission="inventory_view_raw_materials">
            <MaterialMovements />
          </ProtectedRoute>
        }
      />
      {/* Legacy route */}
      <Route
        path="/materials"
        element={
          <ProtectedRoute
            permissions={[
              "inventory_view_purchases",
              "inventory_add_purchases",
            ]}
          >
            <Purchases />
          </ProtectedRoute>
        }
      />

      {/* ==================== STOCK MANAGEMENT ROUTES ==================== */}
      <Route
        path="/material-issue"
        element={
          <ProtectedRoute permission="stock_issue_materials">
            <MaterialIssue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/product-definition"
        element={
          <ProtectedRoute
            permissions={["products_view_products", "products_add_products"]}
          >
            <ProductDefinition />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production-entry"
        element={
          <ProtectedRoute
            permissions={[
              "stock_view_production_stock",
              "stock_add_production",
            ]}
          >
            <ProductionEntry />
          </ProtectedRoute>
        }
      />

      {/* ==================== PRODUCTS ROUTES ==================== */}
      <Route
        path="/products"
        element={
          <ProtectedRoute
            permissions={["products_view_products", "products_add_products"]}
          >
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/production-batches"
        element={
          <ProtectedRoute
            permissions={["products_view_batches", "products_add_batches"]}
          >
            <ProductionBatches />
          </ProtectedRoute>
        }
      />

      {/* ==================== ROUTE PLANNING ROUTES ==================== */}
      <Route
        path="/route-defining"
        element={
          <ProtectedRoute
            permissions={["routes_view_routes", "routes_add_routes"]}
          >
            <AddingRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/route-assiging"
        element={
          <ProtectedRoute permission="routes_assign_routes">
            <AssignRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/route-planing"
        element={
          <ProtectedRoute permission="routes_view_planning">
            <RoutesPlanning />
          </ProtectedRoute>
        }
      />

      {/* ==================== SALES & DISTRIBUTION ROUTES ==================== */}
      <Route
        path="/outlets"
        element={
          <ProtectedRoute
            permissions={["sales_view_outlets", "sales_add_outlets"]}
          >
            <OutletsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/outlets-stock"
        element={
          <ProtectedRoute
            permissions={[
              "sales_view_outlet_stock",
              "sales_manage_outlet_stock",
            ]}
          >
            <OutletStockPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/daily-loading"
        element={
          <ProtectedRoute
            permissions={[
              "sales_view_daily_loading",
              "sales_add_daily_loading",
            ]}
          >
            <DailyLoading />
          </ProtectedRoute>
        }
      />

      {/* ==================== FALLBACK ROUTE ==================== */}
      {/* Redirect any unknown routes to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
