import React from "react";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

type AssessmentFiltersProps = {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterStatus: "all" | "active" | "inactive";
  onStatusChange: (status: "all" | "active" | "inactive") => void;
  filterType?: string;
  onTypeChange?: (type: string) => void;
  formTypes?: Array<{ value: string; label: string }>;
};

export function AssessmentFilters({
  searchTerm,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterType = "",
  onTypeChange,
  formTypes = [],
}: AssessmentFiltersProps) {
  const hasFilters = searchTerm || filterStatus !== "all" || filterType;

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => onStatusChange("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-sky-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => onStatusChange("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "active"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Ativas
          </button>
          <button
            onClick={() => onStatusChange("inactive")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "inactive"
                ? "bg-red-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Inativas
          </button>
        </div>
      </div>

      {/* Type Filter */}
      {formTypes.length > 0 && onTypeChange && (
        <div>
          <select
            value={filterType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full md:max-w-xs px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
          >
            <option value="">Todos os tipos</option>
            {formTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Clear Filters */}
      {hasFilters && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              onSearchChange("");
              onStatusChange("all");
              onTypeChange?.("");
            }}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm gap-1 px-3 py-2 h-auto flex items-center"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
