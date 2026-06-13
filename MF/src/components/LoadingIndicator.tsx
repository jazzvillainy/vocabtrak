import React from "react";
import { Loader2 } from "lucide-react";
import { LoadingIndicatorProps } from "../types";

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = "Loading...",
}) => (
  <div className="flex justify-center items-center p-lg text-muted">
    <Loader2 className="w-5 h-5 animate-spin mr-md icon" />
    {message}
  </div>
);
