import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  where,
  query,
} from "firebase/firestore";
import { db } from "../../../../services/firebase";
import { Users, MapPin, X, Search, ChevronDown, ChevronUp } from "lucide-react";
import AddingRoutes from "./AddingRoutes";
import { useUser } from "../../../../contexts/userContext";
import Button from "../../../ui/Button";
import SuccessDialog from "../../../ui/SuccessDialog";
import FailDialog from "../../../ui/FailDialog";

const AssignRoutes = () => {
  const { user: currentUser } = useUser();

  const [salesReps, setSalesReps] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSalesRep, setSelectedSalesRep] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedReps, setExpandedReps] = useState(new Set());
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchSalesReps = useCallback(async () => {
    try {
      const salesRepsRef = collection(db, "users");
      const salesRepsQuery = query(
        salesRepsRef,
        where("role", "==", "Sales Rep")
      );
      const snapshot = await getDocs(salesRepsQuery);

      const repsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSalesReps(repsData);
    } catch (error) {
      console.error("Error fetching sales reps:", error);
      throw error;
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const routesRef = collection(db, "routes");
      const snapshot = await getDocs(routesRef);
      const routesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRoutes(routesData);
    } catch (error) {
      console.error("Error fetching routes:", error);
      throw error;
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const assignmentsRef = collection(db, "route_assignments");
      const snapshot = await getDocs(assignmentsRef);
      const assignmentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAssignments(assignmentsData);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      throw error;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setFetchingData(true);
    try {
      await Promise.all([fetchSalesReps(), fetchRoutes(), fetchAssignments()]);
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage("Failed to load data");
      setShowError(true);
    } finally {
      setFetchingData(false);
    }
  }, [fetchSalesReps, fetchRoutes, fetchAssignments]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  const handleAssignRoute = async () => {
    if (!selectedSalesRep || !selectedRoute) {
      setErrorMessage("Please select both a sales representative and a route");
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      // Check if route is already assigned to this sales rep (active assignment)
      const existingAssignment = assignments.find(
        (assignment) =>
          assignment.repId === selectedSalesRep &&
          assignment.routeId === selectedRoute &&
          assignment.assignedTo === null
      );

      if (existingAssignment) {
        setErrorMessage(
          "This route is already assigned to the selected sales representative"
        );
        setShowError(true);
        setLoading(false);
        return;
      }

      const assignmentData = {
        repId: selectedSalesRep,
        routeId: selectedRoute,
        assignedFrom: serverTimestamp(),
        assignedTo: null,
      };

      await addDoc(collection(db, "route_assignments"), assignmentData);

      setSuccessMessage("Route assigned successfully!");
      setShowSuccess(true);

      // Reset selections
      setSelectedSalesRep("");
      setSelectedRoute("");

      // Refresh data
      await fetchAssignments();
    } catch (error) {
      console.error("Error assigning route:", error);
      setErrorMessage("Failed to assign route. Please try again.");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const getAssignedRoutes = (repId) => {
    const activeAssignments = assignments.filter(
      (assignment) =>
        assignment.repId === repId && assignment.assignedTo === null
    );

    return activeAssignments.map((assignment) => {
      const route = routes.find((r) => r.id === assignment.routeId);
      return {
        assignmentId: assignment.id,
        routeId: assignment.routeId,
        routeName: route?.name || "Unknown Route",
        areas: route?.area_covered || [],
        assignedFrom: assignment.assignedFrom,
      };
    });
  };

  const handleRemoveRoute = async (assignmentId) => {
    setLoading(true);

    try {
      const assignmentRef = doc(db, "route_assignments", assignmentId);

      // Set assignedTo to current timestamp to mark as inactive
      await deleteDoc(assignmentRef);

      setSuccessMessage("Route removed successfully!");
      setShowSuccess(true);

      await fetchAssignments();
    } catch (error) {
      console.error("Error removing route:", error);
      setErrorMessage("Failed to remove route. Please try again.");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRouteAdded = () => {
    setShowAddRoute(false);
    fetchRoutes();
    setSuccessMessage(
      "Route added successfully! You can now assign it to sales representatives."
    );
    setShowSuccess(true);
  };

  const toggleExpanded = (repId) => {
    const newExpanded = new Set(expandedReps);
    if (newExpanded.has(repId)) {
      newExpanded.delete(repId);
    } else {
      newExpanded.add(repId);
    }
    setExpandedReps(newExpanded);
  };

  const filteredSalesReps = salesReps.filter(
    (rep) =>
      rep.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAssignedRoutes = assignments.filter(
    (assignment) => assignment.assignedTo === null
  ).length;

  const repsWithRoutes = salesReps.filter(
    (rep) => getAssignedRoutes(rep.id).length > 0
  ).length;

  if (fetchingData) {
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

  if (showAddRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setShowAddRoute(false)}
            className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Back to Assign Routes</span>
          </button>
          <AddingRoutes onRouteAdded={handleRouteAdded} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Assign Routes
              </h1>
              <p className="text-gray-600 mt-1">
                Assign delivery routes to sales representatives
              </p>
            </div>

            {/* Statistics */}
            <div className="hidden lg:flex space-x-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">
                  {salesReps.length}
                </div>
                <div className="text-sm text-blue-800">Total Reps</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  {totalAssignedRoutes}
                </div>
                <div className="text-sm text-green-800">Active Routes</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">
                  {routes.length}
                </div>
                <div className="text-sm text-purple-800">Available Routes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Assignment Form */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Assign New Route
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Representative <span className="text-red-500">*</span>
                  </label>
                  {salesReps.length > 0 ? (
                    <select
                      value={selectedSalesRep}
                      onChange={(e) => setSelectedSalesRep(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Choose a sales representative</option>
                      {salesReps.map((rep) => (
                        <option key={rep.id} value={rep.id}>
                          {rep.fullName} ({getAssignedRoutes(rep.id).length}{" "}
                          routes)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                      No sales representatives found
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Route <span className="text-red-500">*</span>
                  </label>
                  {routes.length > 0 ? (
                    <select
                      value={selectedRoute}
                      onChange={(e) => setSelectedRoute(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Choose a route</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                      No routes found
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    onClick={handleAssignRoute}
                    disabled={loading || !selectedSalesRep || !selectedRoute}
                    loading={loading}
                    className="w-full"
                  >
                    Assign Route
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setShowAddRoute(true)}
                    className="w-full"
                  >
                    Add New Route
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Assignments List */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Route Assignments ({filteredSalesReps.length})
                  </h2>
                  <div className="text-sm text-gray-500">
                    {repsWithRoutes} of {salesReps.length} reps have routes
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sales representatives..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-6">
                {filteredSalesReps.length > 0 ? (
                  <div className="space-y-4">
                    {filteredSalesReps.map((rep) => {
                      const assignedRoutes = getAssignedRoutes(rep.id);
                      const isExpanded = expandedReps.has(rep.id);

                      return (
                        <div
                          key={rep.id}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <div className="p-4 bg-gray-50 hover:bg-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <h3 className="font-medium text-gray-900">
                                    {rep.fullName}
                                  </h3>
                                  <div className="text-sm text-gray-500">
                                    {rep.phoneNumber && `📞 ${rep.phoneNumber}`}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                {assignedRoutes.length > 0 ? (
                                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                                    {assignedRoutes.length} route
                                    {assignedRoutes.length > 1 ? "s" : ""}
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                                    No routes
                                  </span>
                                )}

                                {assignedRoutes.length > 0 && (
                                  <button
                                    onClick={() => toggleExpanded(rep.id)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-5 w-5" />
                                    ) : (
                                      <ChevronDown className="h-5 w-5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {assignedRoutes.length > 0 && isExpanded && (
                            <div className="p-4 bg-white border-t border-gray-200">
                              <div className="space-y-3">
                                {assignedRoutes.map((route) => (
                                  <div
                                    key={route.assignmentId}
                                    className="p-3 bg-gray-50 rounded-lg flex items-start justify-between"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <MapPin className="h-4 w-4 text-green-600" />
                                        <span className="font-medium text-gray-900">
                                          {route.routeName}
                                        </span>
                                      </div>

                                      <div className="text-xs text-gray-500">
                                        <p>
                                          <span className="font-medium">
                                            Areas:
                                          </span>{" "}
                                          {route.areas.length > 0
                                            ? route.areas.join(", ")
                                            : "No areas"}
                                        </p>
                                        {route.assignedFrom && (
                                          <p className="mt-1">
                                            <span className="font-medium">
                                              Assigned:
                                            </span>{" "}
                                            {route.assignedFrom?.toDate
                                              ? route.assignedFrom
                                                  .toDate()
                                                  .toLocaleDateString()
                                              : new Date(
                                                  route.assignedFrom
                                                ).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      onClick={() =>
                                        handleRemoveRoute(route.assignmentId)
                                      }
                                      disabled={loading}
                                      className="text-red-500 hover:text-red-700 p-1 rounded"
                                      title="Remove route"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {searchTerm
                        ? "No sales representatives found"
                        : "No sales representatives available"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Success!"
          message={successMessage}
          buttonText="Continue"
        />

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

export default AssignRoutes;
