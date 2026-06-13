import { Timestamp } from "firebase/firestore";

export const formatDate = (timestamp: Timestamp | null): string => {
  if (!timestamp) return "N/A";
  try {
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(
      timestamp as unknown as string | number | Date,
    ).toLocaleDateString();
  } catch {
    return "Invalid Date";
  }
};
