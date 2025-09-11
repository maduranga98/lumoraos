import React from "react";
import { useUser } from "../../contexts/userContext";
import Button from "../ui/Button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user?.fullName}
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">User ID:</span> {user?.userId}
            </div>
            <div>
              <span className="font-medium">Username:</span> @{user?.username}
            </div>
            <div>
              <span className="font-medium">Role:</span>{" "}
              {user?.role || "Employee"}
            </div>
          </div>
        </div>

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* HR Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-4a.5.5 0 01.5.5v.5h-2l-.17.717a1.5 1.5 0 001.48 1.283h.09l.83.37a.5.5 0 01.14.808l-.09.063a4.5 4.5 0 01-2.8.75v.5a.5.5 0 11-1 0v-.5a4.5 4.5 0 01-2.8-.75l-.09-.063a.5.5 0 01.14-.808l.83-.37h.09a1.5 1.5 0 001.48-1.283L15.5 21H18v-1a6 6 0 00-3-5.197z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Human Resources
              </h2>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/addemployees")}
                className="w-full justify-start"
                variant="secondary"
              >
                👤 Add Employee
              </Button>
              <Button
                onClick={() => navigate("/employeelist")}
                className="w-full justify-start"
                variant="secondary"
              >
                📋 Employee List
              </Button>
            </div>
          </div>

          {/* Logistics Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Logistics</h2>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/add-vehicles")}
                className="w-full justify-start"
                variant="secondary"
              >
                🚐 Add Vehicle
              </Button>
              <Button
                onClick={() => navigate("/expenses")}
                className="w-full justify-start"
                variant="secondary"
              >
                💰 Vehicle Expenses
              </Button>
              <Button
                onClick={() => navigate("/services-repairs")}
                className="w-full justify-start"
                variant="secondary"
              >
                🔧 Service & Repairs
              </Button>
            </div>
          </div>

          {/* Suppliers Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m0 0h2M9 7h1m-1 4h1m4-4h1m-1 4h1M9 16h1"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Suppliers</h2>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/adding-suppliers")}
                className="w-full justify-start"
                variant="secondary"
              >
                🏢 Manage Suppliers
              </Button>
              <Button
                onClick={() => navigate("/materials")}
                className="w-full justify-start"
                variant="secondary"
              >
                📦 Purchase Materials
              </Button>
            </div>
          </div>

          {/* NEW: Inventory Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/material-issue")}
                className="w-full justify-start"
                variant="secondary"
              >
                📋 Issue Materials
              </Button>
              <Button
                onClick={() => navigate("/product-definition")}
                className="w-full justify-start"
                variant="secondary"
              >
                🏷️ Define Products
              </Button>
              <Button
                onClick={() => navigate("/production-entry")}
                className="w-full justify-start"
                variant="secondary"
              >
                🏭 Record Production
              </Button>
              <Button
                onClick={() => navigate("/product-stock")}
                className="w-full justify-start"
                variant="secondary"
                disabled
              >
                📊 Stock Reports <span className="text-xs">(Coming Soon)</span>
              </Button>
            </div>
          </div>
          {/* Route Planing */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Route Planing</h2>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/route-defining")}
                className="w-full justify-start"
                variant="secondary"
              >
                📋 Routes Defining
              </Button>
              <Button
                onClick={() => navigate("/route-assiging")}
                className="w-full justify-start"
                variant="secondary"
              >
                🏷️ Assign Routes
              </Button>
              <Button
                onClick={() => navigate("/route-planing")}
                className="w-full justify-start"
                variant="secondary"
              >
                🏭 Route Planing
              </Button>
            </div>
          </div>
          {/* SFA Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Sales</h2>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/outlets-adding")}
                className="w-full justify-start"
                variant="secondary"
              >
                📋 Adding Outlets
              </Button>
              <Button
                onClick={() => navigate("/outlets-stock")}
                className="w-full justify-start"
                variant="secondary"
              >
                🏷️ Outlets Stock
              </Button>
              <Button
                onClick={() => navigate("/route-planing")}
                className="w-full justify-start"
                variant="secondary"
              >
                🏭 Route Planing
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">-</div>
              <div className="text-sm text-blue-800">Total Employees</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">-</div>
              <div className="text-sm text-green-800">Active Vehicles</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">-</div>
              <div className="text-sm text-purple-800">Active Suppliers</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">-</div>
              <div className="text-sm text-orange-800">Materials in Stock</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
