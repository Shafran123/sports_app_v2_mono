"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { business } from "@spots/api";

export function useBookingActions(extraKeys: string[][] = []) {
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["admin-availability"] });
    extraKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  };

  const checkIn = useMutation({ mutationFn: (id: string) => business.checkIn(id), onSuccess: refresh });
  const markNoShow = useMutation({ mutationFn: (id: string) => business.markNoShow(id), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: (id: string) => business.cancelBooking(id), onSuccess: refresh });

  return { checkIn, markNoShow, cancel };
}