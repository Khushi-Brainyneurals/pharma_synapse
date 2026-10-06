export const env = {
  isDev: import.meta.env.DEV,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  useMockApi:
    import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === "true",
};
