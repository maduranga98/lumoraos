import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const UserList = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modal states for view details
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Dialog states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load users on component mount
  useEffect(() => {
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

  // Filter users based on search and status
  useEffect(() => {
    let filtered = users;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.phoneNumber && user.phoneNumber.includes(searchTerm)) ||
          (user.email &&
            user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (user.employeeId &&
            user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((user) => {
        if (filterStatus === "active") return user.isActive;
        if (filterStatus === "inactive") return !user.isActive;
        return true;
      });
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterStatus]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc")
      );
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      setErrorMessage("Failed to load users. Please try again.");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    // Navigate to AddUser form with user data for editing
    navigate("/addemployees", { state: { editUser: user } });
  };

  const toggleUserStatus = async (user, newStatus) => {
    try {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        isActive: newStatus,
        updatedAt: serverTimestamp(),
      });

      // Update local state
      const updatedUsers = users.map((u) =>
        u.id === user.id ? { ...u, isActive: newStatus } : u
      );
      setUsers(updatedUsers);

      setSuccessMessage(
        `User ${newStatus ? "activated" : "deactivated"} successfully!`
      );
      setShowSuccess(true);
    } catch (error) {
      console.error("Error updating user status:", error);
      setErrorMessage("Failed to update user status. Please try again.");
      setShowError(true);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if user is not authenticated
  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Employee Directory
              </h1>
              <p className="text-gray-600 mt-1">
                Manage and view all registered employees
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Button onClick={() => navigate("/addemployees")}>
                Add New Employee
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  className="absolute left-3 top-3 h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xl font-bold text-blue-600">
                {users.length}
              </div>
              <div className="text-xs text-blue-800">Total</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xl font-bold text-green-600">
                {users.filter((u) => u.isActive).length}
              </div>
              <div className="text-xs text-green-800">Active</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xl font-bold text-red-600">
                {users.filter((u) => !u.isActive).length}
              </div>
              <div className="text-xs text-red-800">Inactive</div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading employees...</span>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-4xl mb-4">👥</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm || filterStatus !== "all"
                  ? "No employees match your search"
                  : "No employees found"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || filterStatus !== "all"
                  ? "Try adjusting your search terms or filters"
                  : "Get started by adding your first employee"}
              </p>
              {!searchTerm && filterStatus === "all" && (
                <Button onClick={() => navigate("/addemployees")}>
                  Add First Employee
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${
                              user.isActive
                                ? "bg-gradient-to-r from-blue-500 to-purple-600"
                                : "bg-gray-400"
                            }`}
                          >
                            {user.fullName
                              ? user.fullName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)
                              : "??"}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.fullName || "Unnamed User"}
                            </div>
                            <div className="text-sm text-gray-500">
                              @{user.username || "no-username"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.phoneNumber || "No phone"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email || "No email"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.role || "No role"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.department || "No department"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full mr-1 ${
                              user.isActive ? "bg-green-500" : "bg-red-500"
                            }`}
                          ></span>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(user)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              toggleUserStatus(user, !user.isActive)
                            }
                            className={`transition-colors ${
                              user.isActive
                                ? "text-red-600 hover:text-red-900"
                                : "text-green-600 hover:text-green-900"
                            }`}
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* View Details Modal */}
        {showModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg ${
                        selectedUser.isActive
                          ? "bg-gradient-to-r from-blue-500 to-purple-600"
                          : "bg-gray-400"
                      }`}
                    >
                      {selectedUser.fullName
                        ? selectedUser.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : "??"}
                    </div>
                    <div className="ml-4">
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedUser.fullName || "Unnamed User"}
                      </h2>
                      <p className="text-gray-600">Employee Details</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-2"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Username:</span>
                    <p className="text-gray-900">
                      @{selectedUser.username || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <p className="text-gray-900">
                      {selectedUser.email || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <p className="text-gray-900">
                      {selectedUser.phoneNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Employee ID:
                    </span>
                    <p className="text-gray-900">
                      {selectedUser.employeeId || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Role:</span>
                    <p className="text-gray-900">
                      {selectedUser.role || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Department:
                    </span>
                    <p className="text-gray-900">
                      {selectedUser.department || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Position:</span>
                    <p className="text-gray-900">
                      {selectedUser.position || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        selectedUser.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {selectedUser.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Created:</span>
                    <p className="text-gray-900">
                      {formatDate(selectedUser.createdAt)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Last Updated:
                    </span>
                    <p className="text-gray-900">
                      {formatDate(selectedUser.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl">
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    Close
                  </Button>
                  <Button onClick={() => handleEditUser(selectedUser)}>
                    Edit Employee
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Success!"
          message={successMessage}
          buttonText="Continue"
        />

        {/* Error Dialog */}
        <FailDialog
          isOpen={showError}
          onClose={() => setShowError(false)}
          title="Error"
          message={errorMessage}
          buttonText="Try Again"
          onRetry={() => setShowError(false)}
        />
      </div>
    </div>
  );
};

export default UserList;
