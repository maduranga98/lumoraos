import React from "react";
import { Routes, Route } from "react-router-dom";

import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import Dashboard from "./components/pages/Dashboard";
import AddUsers from "./components/pages/users/AddUsers";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/addemployees" element={<AddUsers />} />
    </Routes>
  );
};

export default App;
