import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
};

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage = 10,
  totalItems = 0,
}: PaginationControlsProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-700">
      <div className="text-xs text-slate-400">
        {totalItems > 0 ? (
          <>
            Mostrando <span className="font-medium text-slate-300">{startItem}</span> a{" "}
            <span className="font-medium text-slate-300">{endItem}</span> de{" "}
            <span className="font-medium text-slate-300">{totalItems}</span> itens
          </>
        ) : (
          "Nenhum item"
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-sky-400 disabled:opacity-50 text-white gap-1 px-3 py-2 h-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`h-8 w-8 rounded-lg font-medium text-sm transition-colors ${
                currentPage === page
                  ? "bg-sky-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <Button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-sky-400 disabled:opacity-50 text-white gap-1 px-3 py-2 h-auto"
        >
          Próximo
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
