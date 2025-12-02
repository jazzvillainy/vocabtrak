import React from "react";
import { DetailCardProps } from "../types";

export const DetailCard: React.FC<DetailCardProps> = ({
  title,
  children,
  className = "",
}) => (
  <div
    className={`p-4 bg-slate-800 rounded-xl shadow-lg border border-slate-700 ${className}`}
  >
    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
      {title}
    </h3>
    <div className="text-slate-200">{children}</div>
  </div>
);
