import React from "react";
import { DetailCardProps } from "../types";

export const DetailCard: React.FC<DetailCardProps> = ({
  title,
  children,
  className = "",
}) => (
  <div className={`card ${className}`}>
    <h3 className="text-xs font-bold text-accent uppercase tracking-widest mb-lg">
      {title}
    </h3>
    <div className="space-y-md">{children}</div>
  </div>
);
