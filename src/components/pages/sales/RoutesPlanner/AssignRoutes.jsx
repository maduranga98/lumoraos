import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  where,
  query,
} from "firebase/firestore";
import { toast } from "react-hot-toast";
import { db } from "../../../../services/firebase";
import {
  Users,
  MapPin,
  Plus,
  Save,
  Loader2,
  Route as RouteIcon,
  UserCheck,
  AlertCircle,
  Navigation,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
} from "lucide-react";
import AddingRoutes from "./AddingRoutes";
import { useUser } from "../../../../contexts/userContext";
const AssignRoutes = () => {
  const [salesReps, setSalesReps] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedSalesRep, setSelectedSalesRep] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedReps, setExpandedReps] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const { user } = useUser();
  // Fetch sales reps and routes on component mount
  useEffect(() => {
    fetchData();
  }, [user]);

  // Fetch sales reps and routes from Firebase
  const fetchData = async () => {
    setFetchingData(true);
    try {
      await Promise.all([fetchSalesReps(), fetchRoutes()]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setFetchingData(false);
    }
  };

  // Fetch sales representatives
  const fetchSalesReps = async () => {
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
      console.log(repsData);
      setSalesReps(repsData);
    } catch (error) {
      console.error("Error fetching sales reps:", error);
      throw error;
    }
  };

  // Fetch routes
  const fetchRoutes = async () => {
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
  };

  // Handle route assignment
  const handleAssignRoute = async () => {
    if (!selectedSalesRep || !selectedRoute) {
      toast.error("Please select both a sales representative and a route");
      return;
    }

    setLoading(true);

    try {
      const selectedSalesRepData = salesReps.find(
        (rep) => rep.id === selectedSalesRep
      );
      const selectedRouteData = routes.find(
        (route) => route.id === selectedRoute
      );
      console.log(selectedSalesRep);

      // Check if route is already assigned to this sales rep
      const existingRoutes = selectedSalesRepData?.assignedRoutes || [];
      const isAlreadyAssigned = existingRoutes.some(
        (route) => route.routeId === selectedRoute
      );

      if (isAlreadyAssigned) {
        toast.error(
          "This route is already assigned to the selected sales representative"
        );
        return;
      }

      // Create new route assignment object with regular timestamp
      const currentTimestamp = new Date();

      const newRouteAssignment = {
        routeId: selectedRoute,
        routeName: selectedRouteData?.name || "",
        areas: selectedRouteData?.areas || [],
        estimatedDistance: selectedRouteData?.estimatedDistance || null,
        estimatedTime: selectedRouteData?.estimatedTime || null,
        assignedAt: currentTimestamp,

        status: "active",
      };

      // Update sales rep with new assigned route in the assignedRoutes array
      const salesRepRef = doc(db, "users", selectedSalesRep);

      const updatedAssignedRoutes = [...existingRoutes, newRouteAssignment];

      await updateDoc(salesRepRef, {
        assignedRoutes: updatedAssignedRoutes,
        updatedAt: serverTimestamp(),
      });

      toast.success("Route assigned successfully!");

      // Reset selections
      setSelectedSalesRep("");
      setSelectedRoute("");

      // Refresh data to show updated assignments
      await fetchSalesReps();
    } catch (error) {
      console.error("Error assigning route:", error);
      toast.error("Failed to assign route. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Get assigned routes for a sales rep
  const getAssignedRoutes = (repId) => {
    const rep = salesReps.find((rep) => rep.id === repId);
    return rep?.assignedRoutes || [];
  };

  // Remove route assignment
  const handleRemoveRoute = async (repId, routeId) => {
    setLoading(true);

    try {
      const salesRepData = salesReps.find((rep) => rep.id === repId);
      const updatedRoutes = salesRepData.assignedRoutes.filter(
        (route) => route.routeId !== routeId
      );

      const salesRepRef = doc(
        db,

        "salesReps",
        repId
      );

      await updateDoc(salesRepRef, {
        assignedRoutes: updatedRoutes,
        updatedAt: serverTimestamp(),
      });

      toast.success("Route removed successfully!");
      await fetchSalesReps();
    } catch (error) {
      console.error("Error removing route:", error);
      toast.error("Failed to remove route. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle adding new route success
  const handleRouteAdded = () => {
    setShowAddRoute(false);
    fetchRoutes();
    toast.success(
      "Route added successfully! You can now assign it to sales representatives."
    );
  };

  // Toggle expanded state for a rep
  const toggleExpanded = (repId) => {
    const newExpanded = new Set(expandedReps);
    if (newExpanded.has(repId)) {
      newExpanded.delete(repId);
    } else {
      newExpanded.add(repId);
    }
    setExpandedReps(newExpanded);
  };

  // Filter sales reps based on search term
  const filteredSalesReps = salesReps.filter(
    (rep) =>
      rep.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    //   rep.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate filtered results
  const totalPages = Math.ceil(filteredSalesReps.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReps = filteredSalesReps.slice(startIndex, endIndex);

  // Calculate statistics
  const totalAssignedRoutes = salesReps.reduce(
    (total, rep) => total + (rep.assignedRoutes?.length || 0),
    0
  );
  const repsWithRoutes = salesReps.filter(
    (rep) => rep.assignedRoutes && rep.assignedRoutes.length > 0
  ).length;

  if (fetchingData) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">
              Loading sales representatives and routes...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show AddingRoute component if requested
  if (showAddRoute) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={() => setShowAddRoute(false)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-4"
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
        </div>
        <AddingRoutes onRouteAdded={handleRouteAdded} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Navigation className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Assign Routes
              </h1>
            </div>
            <p className="text-gray-600">
              Assign delivery routes to your sales representatives
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="hidden lg:flex space-x-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">
                    Total Reps
                  </p>
                  <p className="text-lg font-bold text-blue-700">
                    {salesReps.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">
                    Active Routes
                  </p>
                  <p className="text-lg font-bold text-green-700">
                    {totalAssignedRoutes}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-2">
                <RouteIcon className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600 font-medium">
                    Available Routes
                  </p>
                  <p className="text-lg font-bold text-purple-700">
                    {routes.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Assignment Form - Fixed Position */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
              <UserCheck className="h-5 w-5 mr-2 text-blue-600" />
              Assign New Route
            </h2>

            <div className="space-y-4">
              {/* Sales Rep Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Sales Representative{" "}
                  <span className="text-red-500">*</span>
                </label>
                {salesReps.length > 0 ? (
                  <select
                    value={selectedSalesRep}
                    onChange={(e) => setSelectedSalesRep(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Choose a sales representative</option>
                    {salesReps.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.fullName} ({rep.assignedRoutes?.length || 0}{" "}
                        routes)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                    <span className="text-sm text-yellow-700">
                      No sales representatives found.
                    </span>
                  </div>
                )}
              </div>

              {/* Route Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Route <span className="text-red-500">*</span>
                </label>
                {routes.length > 0 ? (
                  <select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Choose a route</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                        {/* {route.areas?.length > 2 ? "..." : ""} */}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      <span className="text-sm text-yellow-700">
                        No routes found.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4">
                <button
                  onClick={handleAssignRoute}
                  disabled={loading || !selectedSalesRep || !selectedRoute}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Assign Route</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowAddRoute(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add New Route</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Current Assignments - Scrollable */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header with Search */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <RouteIcon className="h-5 w-5 mr-2 text-green-600" />
                  Route Assignments ({filteredSalesReps.length})
                </h2>
                <div className="text-sm text-gray-500">
                  {repsWithRoutes} of {salesReps.length} reps have routes
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search sales representatives..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sales Reps List */}
            <div className="p-6">
              {paginatedReps.length > 0 ? (
                <div className="space-y-4">
                  {paginatedReps.map((rep) => {
                    const assignedRoutes = getAssignedRoutes(rep.id);
                    const isExpanded = expandedReps.has(rep.id);

                    return (
                      <div
                        key={rep.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        {/* Rep Header */}
                        <div className="p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {rep.fullName}
                                </h3>
                                <div className="flex items-center space-x-3 text-sm text-gray-500">
                                  {rep.phone && <span>📞 {rep.phone}</span>}
                                  {rep.email && <span>📧 {rep.email}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              {assignedRoutes.length > 0 ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                                  {assignedRoutes.length} route
                                  {assignedRoutes.length > 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                                  No routes
                                </span>
                              )}

                              {assignedRoutes.length > 0 && (
                                <button
                                  onClick={() => toggleExpanded(rep.id)}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
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

                        {/* Assigned Routes (Collapsible) */}
                        {assignedRoutes.length > 0 && isExpanded && (
                          <div className="p-4 bg-white border-t border-gray-200">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {assignedRoutes.map((route) => (
                                <div
                                  key={route.routeId}
                                  className="p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                                        <span className="font-medium text-gray-900 truncate">
                                          {route.routeName}
                                        </span>
                                      </div>

                                      <div className="space-y-1 text-xs text-gray-500">
                                        <p>
                                          <span className="font-medium">
                                            Areas:
                                          </span>{" "}
                                          {route.areas?.length > 3
                                            ? `${route.areas
                                                .slice(0, 3)
                                                .join(", ")}... (+${
                                                route.areas.length - 3
                                              } more)`
                                            : route.areas?.join(", ") ||
                                              "No areas specified"}
                                        </p>

                                        {route.estimatedDistance && (
                                          <p>
                                            <span className="font-medium">
                                              Distance:
                                            </span>{" "}
                                            {route.estimatedDistance} km
                                          </p>
                                        )}

                                        {route.estimatedTime && (
                                          <p className="flex items-center space-x-1">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                              {route.estimatedTime} min
                                            </span>
                                          </p>
                                        )}

                                        {route.assignedAt && (
                                          <p>
                                            <span className="font-medium">
                                              Assigned:
                                            </span>{" "}
                                            {route.assignedAt instanceof Date
                                              ? route.assignedAt.toLocaleDateString()
                                              : route.assignedAt.seconds
                                              ? new Date(
                                                  route.assignedAt.seconds *
                                                    1000
                                                ).toLocaleDateString()
                                              : new Date(
                                                  route.assignedAt
                                                ).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      onClick={() =>
                                        handleRemoveRoute(rep.id, route.routeId)
                                      }
                                      disabled={loading}
                                      className="text-red-500 hover:text-red-700 p-1 rounded transition-colors flex-shrink-0 ml-2"
                                      title="Remove route"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
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
                  <p className="text-gray-500 mb-2">
                    {searchTerm
                      ? "No sales representatives found matching your search"
                      : "No sales representatives found"}
                  </p>
                  <p className="text-sm text-gray-400">
                    {searchTerm
                      ? "Try adjusting your search terms"
                      : "Add sales representatives to assign routes"}
                  </p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-700">
                    Showing {startIndex + 1} to{" "}
                    {Math.min(endIndex, filteredSalesReps.length)} of{" "}
                    {filteredSalesReps.length} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 text-sm rounded ${
                              currentPage === page
                                ? "bg-blue-600 text-white"
                                : "border border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}
                    </div>

                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignRoutes;
