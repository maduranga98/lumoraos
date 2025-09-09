import React from "react";
import { useUser } from "../../contexts/userContext";
import Button from "../ui/Button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  return (
    <div>
      <h1>Welcome, {user?.fullName}</h1>
      <h1>UID: {user?.userId}</h1>
      <h1>UserName: {user?.username}</h1>
      <div className=" m-6 flex flex-col container w-32 space-y-5">
        <h1 className="font-bold text-3xl">HR</h1>
        <Button onClick={() => navigate("/addemployees")}>Add Employee</Button>
        <Button onClick={() => navigate("/employeelist")}>Employee List</Button>
      </div>
      <div className=" m-6 flex flex-col container w-32 space-y-5">
        <h1 className="font-bold text-3xl">Logistics</h1>
        <Button onClick={() => navigate("/add-vehicles")}>Add Vehicle</Button>
        <Button onClick={() => navigate("/expenses")}>
          Vehicle Expenses Log
        </Button>
        <Button onClick={() => navigate("/services-repairs")}>
          Service & Repairs Log
        </Button>
      </div>
      <div className=" m-6 flex flex-col container w-32 space-y-5">
        <h1 className="font-bold text-3xl">Suppliers</h1>
        <Button onClick={() => navigate("/adding-suppliers")}>
          Adding Suppliers
        </Button>
        <Button onClick={() => navigate("/materials")}>Materials</Button>
      </div>
    </div>
  );
};

export default Dashboard;
