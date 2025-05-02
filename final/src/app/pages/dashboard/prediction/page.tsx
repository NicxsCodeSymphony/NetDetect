"use client"

import React, { useState, useEffect, useCallback } from "react";
import { fetchPrediction } from "@/app/lib/predictionServer";
import Sidebar from "@/app/components/Sidebar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, ArrowUpDown, Download, Upload, Info, Filter } from "lucide-react";

// Define types
type Prediction = {
  device_id: number;
  hostname: string;
  predicted_upload: number;
  predicted_download: number;
  confidence_score: number;
};

type PredictionResponse = {
  predictions: Prediction[];
  timestamp: string;
  days_ahead: number;
};

const PredictionDashboard = () => {
  const [predictionData, setPredictionData] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Prediction | "";
    direction: "ascending" | "descending";
  }>({ key: "", direction: "ascending" });
  const [filterConfig, setFilterConfig] = useState({
    minUpload: 0,
    maxUpload: Infinity,
    minDownload: 0,
    maxDownload: Infinity,
    showZeroPredictions: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [displayMode, setDisplayMode] = useState<"table" | "chart">("table");

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await fetchPrediction();
      setPredictionData(res);
      // Set initial max values for filters based on data
      if (res.predictions && res.predictions.length > 0) {
        const maxUpload = Math.max(...res.predictions.map(p => p.predicted_upload));
        const maxDownload = Math.max(...res.predictions.map(p => p.predicted_download));
        setFilterConfig(prev => ({
          ...prev,
          maxUpload: maxUpload,
          maxDownload: maxDownload
        }));
      }
    } catch (err) {
      setError("Failed to fetch prediction data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (key: keyof Prediction) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const filteredPredictions = predictionData?.predictions
    .filter((prediction) => {
      if (!filterConfig.showZeroPredictions && 
          prediction.predicted_upload === 0 && 
          prediction.predicted_download === 0) {
        return false;
      }
      
      return (
        prediction.hostname.toLowerCase().includes(searchTerm.toLowerCase()) &&
        prediction.predicted_upload >= filterConfig.minUpload &&
        prediction.predicted_upload <= filterConfig.maxUpload &&
        prediction.predicted_download >= filterConfig.minDownload &&
        prediction.predicted_download <= filterConfig.maxDownload
      );
    })
    .sort((a, b) => {
      if (sortConfig.key === "") return 0;
      
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });

  // Prepare chart data - top 10 devices by download
  const chartData = filteredPredictions
    ?.sort((a, b) => b.predicted_download - a.predicted_download)
    .slice(0, 10)
    .map(pred => ({
      name: pred.hostname.length > 15 ? `${pred.hostname.substring(0, 12)}...` : pred.hostname,
      upload: pred.predicted_upload,
      download: pred.predicted_download
    }));

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 p-8 bg-gray-50">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading prediction data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 p-8 bg-gray-50">
          <div className="flex items-center justify-center h-full">
            <div className="bg-red-100 p-6 rounded-lg shadow-md text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-red-700 mb-2">Error</h2>
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={() => fetchData()} 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 bg-gray-50">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Network Bandwidth Prediction</h1>
            <p className="text-gray-600">
              Showing predicted bandwidth usage for {filteredPredictions?.length} devices
              {predictionData?.days_ahead && ` ${predictionData.days_ahead} day(s) ahead`}
            </p>
            <p className="text-sm text-gray-500">
              Last updated: {predictionData?.timestamp && new Date(predictionData.timestamp).toLocaleString()}
            </p>
          </div>

          <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by hostname..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </button>
                
                <button
                  onClick={() => setDisplayMode(displayMode === "table" ? "chart" : "table")}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {displayMode === "table" ? "Show Chart" : "Show Table"}
                </button>
                
                <button
                  onClick={() => fetchData()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Refresh Data
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                <h3 className="text-lg font-medium mb-3">Filter Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Range (MB)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Min"
                        value={filterConfig.minUpload}
                        onChange={(e) => setFilterConfig({ ...filterConfig, minUpload: Number(e.target.value) || 0 })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Max"
                        value={filterConfig.maxUpload === Infinity ? "" : filterConfig.maxUpload}
                        onChange={(e) => setFilterConfig({ ...filterConfig, maxUpload: Number(e.target.value) || Infinity })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Download Range (MB)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Min"
                        value={filterConfig.minDownload}
                        onChange={(e) => setFilterConfig({ ...filterConfig, minDownload: Number(e.target.value) || 0 })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Max"
                        value={filterConfig.maxDownload === Infinity ? "" : filterConfig.maxDownload}
                        onChange={(e) => setFilterConfig({ ...filterConfig, maxDownload: Number(e.target.value) || Infinity })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={filterConfig.showZeroPredictions}
                      onChange={(e) => setFilterConfig({ ...filterConfig, showZeroPredictions: e.target.checked })}
                      className="form-checkbox h-5 w-5 text-blue-500"
                    />
                    <span className="ml-2 text-gray-700">Show devices with zero predictions</span>
                  </label>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setFilterConfig({
                      minUpload: 0,
                      maxUpload: Infinity,
                      minDownload: 0,
                      maxDownload: Infinity,
                      showZeroPredictions: true,
                    })}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {displayMode === "chart" && filteredPredictions && filteredPredictions.length > 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl font-semibold mb-4">Top 10 Devices by Predicted Download</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`${value} MB`, undefined]}
                      labelFormatter={(label) => `Device: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="upload" name="Predicted Upload (MB)" fill="#4f46e5" />
                    <Bar dataKey="download" name="Predicted Download (MB)" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {displayMode === "table" && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {filteredPredictions && filteredPredictions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("hostname")}
                        >
                          <div className="flex items-center">
                            Hostname
                            {sortConfig.key === "hostname" && (
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("device_id")}
                        >
                          <div className="flex items-center">
                            Device ID
                            {sortConfig.key === "device_id" && (
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("predicted_upload")}
                        >
                          <div className="flex items-center">
                            <Upload className="mr-1 h-4 w-4" />
                            Predicted Upload (MB)
                            {sortConfig.key === "predicted_upload" && (
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("predicted_download")}
                        >
                          <div className="flex items-center">
                            <Download className="mr-1 h-4 w-4" />
                            Predicted Download (MB)
                            {sortConfig.key === "predicted_download" && (
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("confidence_score")}
                        >
                          <div className="flex items-center">
                            <Info className="mr-1 h-4 w-4" />
                            Confidence
                            {sortConfig.key === "confidence_score" && (
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPredictions.map((prediction) => (
                        <tr 
                          key={prediction.device_id}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{prediction.hostname}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {prediction.device_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${prediction.predicted_upload > 50 ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                              {prediction.predicted_upload.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${prediction.predicted_download > 2000 ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                              {prediction.predicted_download.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {prediction.confidence_score === 1 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  High
                                </span>
                              ) : prediction.confidence_score >= 0.5 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Medium
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Low
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-4">🔍</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No matching devices found</h3>
                  <p className="text-gray-500">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-right text-sm text-gray-500">
            Total devices: {predictionData?.predictions.length} | Filtered: {filteredPredictions?.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionDashboard;