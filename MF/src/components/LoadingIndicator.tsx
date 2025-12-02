import React from "react";
import { Loader2 } from "lucide-react";
import { LoadingIndicatorProps } from "../types";

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = "Loading...",
}) => (
  <div className="flex justify-center items-center p-6 text-slate-400">
    <Loader2 className="w-5 h-5 animate-spin mr-3 text-sky-400" />
    {message}
  </div>
);
