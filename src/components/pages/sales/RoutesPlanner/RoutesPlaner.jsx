import React, { useState, useEffect } from "react";
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
import { toast } from "react-hot-toast";
import { db } from "../../../../services/firebase";
import {
  Calendar,
  Users,
  MapPin,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useUser } from "../../../../contexts/userContext";

const RoutesPlanning = () => {
  const [salesReps, setSalesReps] = useState([]);
  const [selectedRep, setSelectedRep] = useState("");
  const [selectedRepData, setSelectedRepData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyPlan, setMonthlyPlan] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // Day type options
  const dayTypes = [
    {
      value: "working",
      label: "Working Day",
      color: "bg-green-100 text-green-800",
    },
    {
      value: "mercantile_holiday",
      label: "Mercantile Holiday",
      color: "bg-orange-100 text-orange-800",
    },
    { value: "holiday", label: "Holiday", color: "bg-red-100 text-red-800" },
    { value: "leave", label: "Leave", color: "bg-yellow-100 text-yellow-800" },
    {
      value: "sunday",
      label: "Sunday",
      color: "bg-purple-100 text-purple-800",
    },
    {
      value: "company_holiday",
      label: "Company Holiday",
      color: "bg-blue-100 text-blue-800",
    },
  ];
  const { user } = useUser();
  // Fetch sales reps on component mount
  useEffect(() => {
    fetchSalesReps();
  }, []);

  // Fetch monthly plan when rep or month changes
  useEffect(() => {
    if (selectedRep) {
      fetchMonthlyPlan();
    }
  }, [selectedRep, selectedMonth, selectedYear]);

  // Fetch sales representatives
  const fetchSalesReps = async () => {
    setFetchingData(true);
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
      toast.error("Failed to load sales representatives");
    } finally {
      setFetchingData(false);
    }
  };

  // Fetch monthly planning data
  const fetchMonthlyPlan = async () => {
    if (!selectedRep) return;

    setLoading(true);
    try {
      const planId = `${selectedYear}-${String(selectedMonth + 1).padStart(
        2,
        "0"
      )}`;
      const planRef = doc(db, "monthlyPlans", planId);

      const planDoc = await getDoc(planRef);
      if (planDoc.exists()) {
        setMonthlyPlan(planDoc.data().dailyPlans || {});
      } else {
        // Initialize empty plan for the month
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const initialPlan = {};

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(selectedYear, selectedMonth, day);
          const dayOfWeek = date.getDay(); // 0 = Sunday

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
      toast.error("Failed to load monthly plan");
    } finally {
      setLoading(false);
    }
  };

  // Handle sales rep selection
  const handleRepSelection = (repId) => {
    setSelectedRep(repId);
    const repData = salesReps.find((rep) => rep.id === repId);
    setSelectedRepData(repData);
    setMonthlyPlan({});
  };

  // Handle day type change
  const handleDayTypeChange = (day, dayType) => {
    const isNonWorking = [
      "mercantile_holiday",
      "holiday",
      "leave",
      "sunday",
      "company_holiday",
    ].includes(dayType);

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

  // Handle route selection
  const handleRouteSelection = (day, routeId) => {
    setMonthlyPlan((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        selectedRoute: routeId,
      },
    }));
  };

  // Save monthly plan
  const saveMonthlyPlan = async () => {
    if (!selectedRep) {
      toast.error("Please select a sales representative");
      return;
    }

    setSaving(true);
    try {
      const planId = `${selectedYear}-${String(selectedMonth + 1).padStart(
        2,
        "0"
      )}`;
      const planRef = doc(db, "users", selectedRep, "monthlyPlans", planId);

      const planData = {
        repId: selectedRep,
        repName: selectedRepData?.fullName || "",
        month: selectedMonth + 1,
        year: selectedYear,
        planId,
        dailyPlans: monthlyPlan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.userId,
      };
      console.log(planRef, planData);
      await setDoc(planRef, planData);
      toast.success("Monthly plan saved successfully!");
    } catch (error) {
      console.error("Error saving monthly plan:", error);
      toast.error("Failed to save monthly plan");
    } finally {
      setSaving(false);
    }
  };

  // Get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get day name
  const getDayName = (year, month, day) => {
    const date = new Date(year, month, day);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  // Get month name
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

  // Get day type styling
  const getDayTypeStyle = (dayType) => {
    const type = dayTypes.find((t) => t.value === dayType);
    return type ? type.color : "bg-gray-100 text-gray-800";
  };

  // Get route name by ID
  const getRouteName = (routeId) => {
    if (!selectedRepData?.assignedRoutes) return "";
    const route = selectedRepData.assignedRoutes.find(
      (r) => r.routeId === routeId
    );
    return route ? route.routeName : "";
  };

  // Navigate months
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
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading sales representatives...</p>
          </div>
        </div>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Route Planning</h1>
        </div>
        <p className="text-gray-600">
          Plan monthly routes for your sales representatives
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a sales representative</option>
                {salesReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.fullName}
                    {rep.assignedRoutes &&
                      rep.assignedRoutes.length > 0 &&
                      ` (${rep.assignedRoutes.length} route${
                        rep.assignedRoutes.length > 1 ? "s" : ""
                      })`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Users className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  No sales representatives found. Please add sales
                  representatives first.
                </span>
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
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Assigned Routes Display */}
        {selectedRepData?.assignedRoutes &&
          selectedRepData.assignedRoutes.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Assigned Routes:
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedRepData.assignedRoutes.map((route, index) => (
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Monthly Plan - {selectedRepData?.name} (
              {getMonthName(selectedMonth)} {selectedYear})
            </h2>
            <button
              onClick={saveMonthlyPlan}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Plan</span>
                </>
              )}
            </button>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Day
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Day Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                        {/* Date */}
                        <td
                          className={`px-4 py-3 text-sm font-medium ${
                            isSunday ? "text-purple-900" : "text-gray-900"
                          }`}
                        >
                          {day}
                        </td>

                        {/* Day Name */}
                        <td
                          className={`px-4 py-3 text-sm ${
                            isSunday
                              ? "text-purple-700 font-medium"
                              : "text-gray-600"
                          }`}
                        >
                          {dayName}
                        </td>

                        {/* Day Type */}
                        <td className="px-4 py-3">
                          <select
                            value={
                              dayPlan.dayType ||
                              (isSunday ? "sunday" : "working")
                            }
                            onChange={(e) =>
                              handleDayTypeChange(day, e.target.value)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {dayTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                          {dayPlan.dayType && (
                            <span
                              className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${getDayTypeStyle(
                                dayPlan.dayType
                              )}`}
                            >
                              {
                                dayTypes.find(
                                  (t) => t.value === dayPlan.dayType
                                )?.label
                              }
                            </span>
                          )}
                        </td>

                        {/* Route */}
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
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={
                                !selectedRepData?.assignedRoutes ||
                                selectedRepData.assignedRoutes.length === 0
                              }
                            >
                              <option value="">Select route</option>
                              {selectedRepData?.assignedRoutes?.map((route) => (
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
      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Day Type Legend:
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {dayTypes.map((type) => (
            <div key={type.value} className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${type.color}`}
              >
                {type.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoutesPlanning;
