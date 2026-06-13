import React from "react";
import { DetailCardProps } from "../types";

export const DetailCard: React.FC<DetailCardProps> = ({
  title,
  children,
  className = "",
}) => (
  <div className={`card ${className}`}>
    <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-md">
      {title}
    </h3>
    <div>{children}</div>
  </div>
);
