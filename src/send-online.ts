// No SDK write queue and no conditional ETag read requirement for new requests.
export async function sendOnline(url: string, ticket: object, online = navigator.onLine, request: typeof fetch = fetch) {
  if (!online) throw new Error("No internet connection. Connect to the internet and try again.");
  let result: Response;
  try { result = await request(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ticket), signal: AbortSignal.timeout(25000) }); }
  catch { throw new Error("Connection interrupted. Delivery could not be confirmed. Keep this form open and retry; the same request ID will be checked first."); }
  if (result.status === 401 || result.status === 403) throw new Error("Access denied. Ask IT Admin to check this account's Firebase permissions. Your form has been kept.");
  if (!result.ok) throw new Error("The server could not save your request. Your form has been kept; please try again.");
}
