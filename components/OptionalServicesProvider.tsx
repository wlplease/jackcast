"use client";

import { createContext, useContext } from "react";
import type { OptionalService } from "@/lib/prefs-shared";

const DisabledServicesContext = createContext<ReadonlySet<OptionalService>>(new Set());

export function OptionalServicesProvider({ disabledServices, children }: { disabledServices: OptionalService[]; children: React.ReactNode }) {
  return <DisabledServicesContext.Provider value={new Set(disabledServices)}>{children}</DisabledServicesContext.Provider>;
}

export function useServiceDisabled(service: OptionalService) {
  return useContext(DisabledServicesContext).has(service);
}
