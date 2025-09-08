import React from "react";
import { useUser } from "../../contexts/userContext";
import Button from "../ui/Button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <Button onClick={() => navigate("/addemployees")}>Add Employee</Button>
    </div>
  );
};

export default Dashboard;
