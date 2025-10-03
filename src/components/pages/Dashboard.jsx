import React from "react";
import { useUser } from "../../contexts/userContext";
import Button from "../ui/Button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  // Section Card Component
  const SectionCard = ({ title, icon, iconBg, children }) => (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border border-gray-100 hover:border-gray-200">
      <div className="flex items-center mb-6">
        <div
          className={`w-14 h-14 ${iconBg} rounded-xl flex items-center justify-center mr-4 shadow-sm`}
        >
          {icon}
        </div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );

  // Action Button Component
  const ActionButton = ({ emoji, label, onClick, disabled = false }) => (
    <Button
      onClick={onClick}
      className="w-full justify-start text-left hover:scale-[1.02] transition-transform duration-200"
      variant="secondary"
      disabled={disabled}
    >
      <span className="mr-3 text-lg">{emoji}</span>
      <span className="font-medium">{label}</span>
      {disabled && (
        <span className="ml-auto text-xs text-gray-400">(Soon)</span>
      )}
    </Button>
  );

  // Stat Card Component
  const StatCard = ({ value, label, color, bgColor }) => (
    <div
      className={`${bgColor} rounded-xl p-5 hover:scale-105 transition-transform duration-200 cursor-pointer border border-${color}-100`}
    >
      <div className={`text-3xl font-bold ${color} mb-1`}>{value}</div>
      <div className={`text-sm ${color.replace("600", "800")} font-medium`}>
        {label}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* User Avatar */}
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
              </div>

              {/* User Info */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">
                  Welcome back, {user?.fullName?.split(" ")[0] || "User"}!
                </h1>
                <p className="text-gray-500 text-sm">
                  Here's what's happening with your business today
                </p>
              </div>
            </div>

            {/* User Badge */}
            <div className="hidden md:block">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl px-6 py-3 border border-blue-100">
                <div className="text-xs text-gray-500 mb-1">Current Role</div>
                <div className="text-lg font-bold text-gray-900">
                  {user?.role || "Employee"}
                </div>
              </div>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs text-gray-500">User ID</div>
                <div className="text-sm font-semibold text-gray-900">
                  {user?.userId?.slice(0, 8)}...
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs text-gray-500">Username</div>
                <div className="text-sm font-semibold text-gray-900">
                  @{user?.username}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="text-sm font-semibold text-green-600">
                  Active
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {/* HR Section */}
          <SectionCard
            title="Human Resources"
            iconBg="bg-gradient-to-br from-blue-400 to-blue-600"
            icon={
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
          >
            <ActionButton
              emoji="👤"
              label="Add Employee"
              onClick={() => navigate("/addemployees")}
            />
            <ActionButton
              emoji="📋"
              label="Employee List"
              onClick={() => navigate("/employeelist")}
            />
          </SectionCard>

          {/* Logistics Section */}
          <SectionCard
            title="Logistics"
            iconBg="bg-gradient-to-br from-green-400 to-green-600"
            icon={
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
          >
            <ActionButton
              emoji="🚐"
              label="Add Vehicle"
              onClick={() => navigate("/add-vehicles")}
            />
            <ActionButton
              emoji="💰"
              label="Vehicle Expenses"
              onClick={() => navigate("/expenses")}
            />
            <ActionButton
              emoji="🔧"
              label="Service & Repairs"
              onClick={() => navigate("/services-repairs")}
            />
          </SectionCard>

          {/* Suppliers & Inventory Section - UPDATED */}
          <SectionCard
            title="Suppliers & Inventory"
            iconBg="bg-gradient-to-br from-purple-400 to-purple-600"
            icon={
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m0 0h2M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            }
          >
            <ActionButton
              emoji="🏢"
              label="Manage Suppliers"
              onClick={() => navigate("/adding-suppliers")}
            />
            <ActionButton
              emoji="📦"
              label="Raw Materials"
              onClick={() => navigate("/raw-materials")}
            />
            <ActionButton
              emoji="🛒"
              label="Record Purchases"
              onClick={() => navigate("/purchases")}
            />
            <ActionButton
              emoji="📊"
              label="Material Movements"
              onClick={() => navigate("/material-movements")}
            />
          </SectionCard>

          {/* Production & Stock Section */}
          <SectionCard
            title="Production & Stock"
            iconBg="bg-gradient-to-br from-orange-400 to-orange-600"
            icon={
              <svg
                className="w-7 h-7 text-white"
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
            }
          >
            <ActionButton
              emoji="🏷️"
              label="Define Products"
              onClick={() => navigate("/products")}
            />
            <ActionButton
              emoji="📋"
              label="Product Batches"
              onClick={() => navigate("/production-batches")}
            />
            {/* <ActionButton
              emoji="🏷️"
              label="Define Products"
              onClick={() => navigate("/product-definition")}
            />
            <ActionButton
              emoji="🏭"
              label="Record Production"
              onClick={() => navigate("/production-entry")}
            />
            <ActionButton
              emoji="📊"
              label="Stock Reports"
              onClick={() => navigate("/product-stock")}
              disabled
            /> */}
          </SectionCard>

          {/* Route Planning Section */}
          <SectionCard
            title="Route Planning"
            iconBg="bg-gradient-to-br from-teal-400 to-teal-600"
            icon={
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            }
          >
            <ActionButton
              emoji="🗺️"
              label="Define Routes"
              onClick={() => navigate("/route-defining")}
            />
            <ActionButton
              emoji="📍"
              label="Assign Routes"
              onClick={() => navigate("/route-assiging")}
            />
            <ActionButton
              emoji="📅"
              label="Route Planning"
              onClick={() => navigate("/route-planing")}
            />
          </SectionCard>

          {/* Sales Section */}
          <SectionCard
            title="Sales & Distribution"
            iconBg="bg-gradient-to-br from-pink-400 to-pink-600"
            icon={
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            }
          >
            <ActionButton
              emoji="🏪"
              label="Add Outlets"
              onClick={() => navigate("/outlets")}
            />
            <ActionButton
              emoji="📊"
              label="Outlets Stock"
              onClick={() => navigate("/outlets-stock")}
            />
            <ActionButton
              emoji="📈"
              label="Daily Loading"
              onClick={() => navigate("/daily-loading")}
            />
          </SectionCard>
        </div>

        {/* Enhanced Quick Stats */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Quick Overview</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
              <span>View Details</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard
              value="-"
              label="Total Employees"
              color="text-blue-600"
              bgColor="bg-blue-50"
            />
            <StatCard
              value="-"
              label="Active Vehicles"
              color="text-green-600"
              bgColor="bg-green-50"
            />
            <StatCard
              value="-"
              label="Active Suppliers"
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
            <StatCard
              value="-"
              label="Stock Items"
              color="text-orange-600"
              bgColor="bg-orange-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
