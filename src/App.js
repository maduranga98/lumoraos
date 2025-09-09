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
import Material from "./components/pages/purchasingnsuppliers/Material";

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
      <Route path="/materials" element={<Material />} />
    </Routes>
  );
};

export default App;
