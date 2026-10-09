/** Reuse recent reports on navigation; no persistence across sign-outs. */
export const reportQueryOptions={staleTime:60_000,gcTime:15*60_000,refetchOnWindowFocus:false} as const;
