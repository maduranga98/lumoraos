import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../../services/firebase";
import {
  Calendar,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useUser } from "../../../../contexts/userContext";
import Button from "../../../ui/Button";
import SuccessDialog from "../../../ui/SuccessDialog";
import FailDialog from "../../../ui/FailDialog";

const RoutesPlanning = () => {
  const { user: currentUser } = useUser();

  const [salesReps, setSalesReps] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedRep, setSelectedRep] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyPlan, setMonthlyPlan] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const dayTypes = [
    {
      value: "working",
      label: "Working Day",
      color: "bg-green-100 text-green-800",
    },
    { value: "holiday", label: "Holiday", color: "bg-red-100 text-red-800" },
    { value: "leave", label: "Leave", color: "bg-yellow-100 text-yellow-800" },
    {
      value: "sunday",
      label: "Sunday",
      color: "bg-purple-100 text-purple-800",
    },
  ];

  const fetchSalesReps = useCallback(async () => {
    try {
      const salesRepsRef = collection(db, "users");
      const salesRepsQuery = query(
        salesRepsRef,
        where("roleId", "==", "sales_rep"),
        where("status", "==", "active")
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

  const getAssignedRoutes = (repId) => {
    const activeAssignments = assignments.filter(
      (assignment) =>
        assignment.repId === repId && assignment.assignedTo === null
    );

    return activeAssignments.map((assignment) => {
      const route = routes.find((r) => r.id === assignment.routeId);
      return {
        routeId: assignment.routeId,
        routeName: route?.name || "Unknown Route",
        areas: route?.area_covered || [],
      };
    });
  };

  const fetchMonthlyPlan = useCallback(async () => {
    if (!selectedRep) return;

    setLoading(true);
    try {
      const planId = `${selectedRep}-${selectedYear}-${String(
        selectedMonth + 1
      ).padStart(2, "0")}`;
      const planRef = doc(db, "monthly_plans", planId);

      const planDoc = await getDoc(planRef);
      if (planDoc.exists()) {
        setMonthlyPlan(planDoc.data().dailyPlans || {});
      } else {
        // Initialize empty plan
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const initialPlan = {};

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(selectedYear, selectedMonth, day);
          const dayOfWeek = date.getDay();

          initialPlan[day] = {
            dayType: dayOfWeek === 0 ? "sunday" : "working",
            selectedRoute: "",
            locked: dayOfWeek === 0,
          };
        }

        setMonthlyPlan(initialPlan);
      }
    } catch (error) {
      console.error("Error fetching monthly plan:", error);
      setErrorMessage("Failed to load monthly plan");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRep, selectedMonth, selectedYear]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  useEffect(() => {
    if (selectedRep) {
      fetchMonthlyPlan();
    }
  }, [selectedRep, selectedMonth, selectedYear, fetchMonthlyPlan]);

  const handleRepSelection = (repId) => {
    setSelectedRep(repId);
    setMonthlyPlan({});
  };

  const handleDayTypeChange = (day, dayType) => {
    const isNonWorking = ["holiday", "leave", "sunday"].includes(dayType);

    setMonthlyPlan((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        dayType,
        selectedRoute: isNonWorking ? "" : prev[day]?.selectedRoute || "",
        locked: isNonWorking,
      },
    }));
  };

  const handleRouteSelection = (day, routeId) => {
    setMonthlyPlan((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        selectedRoute: routeId,
      },
    }));
  };

  const saveMonthlyPlan = async () => {
    if (!selectedRep) {
      setErrorMessage("Please select a sales representative");
      setShowError(true);
      return;
    }

    setSaving(true);
    try {
      const selectedRepData = salesReps.find((rep) => rep.id === selectedRep);
      const planId = `${selectedRep}-${selectedYear}-${String(
        selectedMonth + 1
      ).padStart(2, "0")}`;
      const planRef = doc(db, "monthly_plans", planId);

      const planData = {
        planId,
        repId: selectedRep,
        repName: selectedRepData?.fullName || "",
        month: selectedMonth + 1,
        year: selectedYear,
        dailyPlans: monthlyPlan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.userId,
      };

      await setDoc(planRef, planData);

      setSuccessMessage("Monthly plan saved successfully!");
      setShowSuccess(true);
    } catch (error) {
      console.error("Error saving monthly plan:", error);
      setErrorMessage("Failed to save monthly plan");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getDayName = (year, month, day) => {
    const date = new Date(year, month, day);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getMonthName = (month) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month];
  };

  const navigateMonth = (direction) => {
    if (direction === "prev") {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

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

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const selectedRepData = salesReps.find((rep) => rep.id === selectedRep);
  const assignedRoutes = selectedRep ? getAssignedRoutes(selectedRep) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Route Planning
              </h1>
              <p className="text-gray-600 mt-1">
                Plan monthly routes for sales representatives
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales Rep Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Sales Representative{" "}
                <span className="text-red-500">*</span>
              </label>
              {salesReps.length > 0 ? (
                <select
                  value={selectedRep}
                  onChange={(e) => handleRepSelection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Choose a sales representative</option>
                  {salesReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.fullName} ({getAssignedRoutes(rep.id).length} routes)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  No sales representatives found
                </div>
              )}
            </div>

            {/* Month Navigation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Month & Year
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateMonth("prev")}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-lg font-medium">
                    {getMonthName(selectedMonth)} {selectedYear}
                  </span>
                </div>
                <button
                  onClick={() => navigateMonth("next")}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Assigned Routes Display */}
          {assignedRoutes.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Assigned Routes:
              </h3>
              <div className="flex flex-wrap gap-2">
                {assignedRoutes.map((route) => (
                  <span
                    key={route.routeId}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    {route.routeName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Planning Table */}
        {selectedRep && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Monthly Plan - {selectedRepData?.fullName} (
                {getMonthName(selectedMonth)} {selectedYear})
              </h2>
              <Button onClick={saveMonthlyPlan} loading={saving}>
                Save Plan
              </Button>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading monthly plan...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Day
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Day Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Route
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.from({ length: daysInMonth }, (_, index) => {
                      const day = index + 1;
                      const dayName = getDayName(
                        selectedYear,
                        selectedMonth,
                        day
                      );
                      const isSunday = dayName === "Sun";
                      const dayPlan = monthlyPlan[day] || {};
                      const isLocked = dayPlan.locked || false;

                      return (
                        <tr
                          key={day}
                          className={`${isSunday ? "bg-purple-50" : ""} ${
                            isLocked ? "opacity-60" : ""
                          }`}
                        >
                          <td
                            className={`px-4 py-3 text-sm font-medium ${
                              isSunday ? "text-purple-900" : "text-gray-900"
                            }`}
                          >
                            {day}
                          </td>

                          <td
                            className={`px-4 py-3 text-sm ${
                              isSunday
                                ? "text-purple-700 font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            {dayName}
                          </td>

                          <td className="px-4 py-3">
                            <select
                              value={
                                dayPlan.dayType ||
                                (isSunday ? "sunday" : "working")
                              }
                              onChange={(e) =>
                                handleDayTypeChange(day, e.target.value)
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                              {dayTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-4 py-3">
                            {isLocked ? (
                              <span className="text-sm text-gray-500 italic">
                                Not available
                              </span>
                            ) : (
                              <select
                                value={dayPlan.selectedRoute || ""}
                                onChange={(e) =>
                                  handleRouteSelection(day, e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                disabled={assignedRoutes.length === 0}
                              >
                                <option value="">Select route</option>
                                {assignedRoutes.map((route) => (
                                  <option
                                    key={route.routeId}
                                    value={route.routeId}
                                  >
                                    {route.routeName}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Day Type Legend:
          </h3>
          <div className="flex flex-wrap gap-3">
            {dayTypes.map((type) => (
              <span
                key={type.value}
                className={`px-3 py-1 rounded-full text-xs font-medium ${type.color}`}
              >
                {type.label}
              </span>
            ))}
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

export default RoutesPlanning;
