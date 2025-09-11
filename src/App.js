import React from "react";
import { Routes, Route } from "react-router-dom";

import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import Dashboard from "./components/pages/Dashboard";
import AddUsers from "./components/pages/users/AddUsers";
import UserList from "./components/pages/users/UserList";
import AddVehicles from "./components/pages/logistics/AddVehicles";
import ExpensesLog from "./components/pages/logistics/ExpensesLog";
import ServicesAndRepairs from "./components/pages/logistics/ServicesAndReparis";
import AddingSuppliers from "./components/pages/purchasingnsuppliers/AddingSuppliers";
import MaterialIssue from "./components/pages/stocks/material_stock/MaterialIssue";
import ProductDefinition from "./components/pages/stocks/production_stock/ProductDefinition";
import ProductionEntry from "./components/pages/stocks/production_stock/ProductionStock";
import AddingRoutes from "./components/pages/sales/RoutesPlanner/AddingRoutes";
import AssignRoutes from "./components/pages/sales/RoutesPlanner/AssignRoutes";
import RoutesPlanning from "./components/pages/sales/RoutesPlanner/RoutesPlaner";
import AddingOutlets from "./components/pages/sales/Outlets/AddingOutlets";
import OutletsStock from "./components/pages/sales/Outlets/OutletsStock";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/addemployees" element={<AddUsers />} />
      <Route path="/employeelist" element={<UserList />} />
      <Route path="/add-vehicles" element={<AddVehicles />} />
      <Route path="/expenses" element={<ExpensesLog />} />
      <Route path="/services-repairs" element={<ServicesAndRepairs />} />
      <Route path="/adding-suppliers" element={<AddingSuppliers />} />
      <Route path="/materials" element={<MaterialIssue />} />
      <Route path="/material-issue" element={<MaterialIssue />} />
      <Route path="/product-definition" element={<ProductDefinition />} />
      <Route path="/production-entry" element={<ProductionEntry />} />
      <Route path="/route-defining" element={<AddingRoutes />} />
      <Route path="/route-assiging" element={<AssignRoutes />} />
      <Route path="/route-planing" element={<RoutesPlanning />} />
      <Route path="/outlets-adding" element={<AddingOutlets />} />
      <Route path="/outlets-stock" element={<OutletsStock />} />
    </Routes>
  );
};

export default App;
