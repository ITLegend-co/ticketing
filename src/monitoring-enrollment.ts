export type DirectoryPerson = {
  name: string; email: string; department: string; status: string; location?: string;
};
export function deviceAssignment(userId: string, person: DirectoryPerson | null | undefined) {
  if (!userId || !person || person.status !== "Active") throw new Error("Select an active user from the User Directory.");
  const name = typeof person.name === "string" ? person.name.trim() : "";
  const department = typeof person.department === "string" ? person.department.trim() : "";
  const location = typeof person.location === "string" && person.location.trim() ? person.location.trim() : "Not recorded";
  if (!name || name.length > 100 || !department || department.length > 80 || location.length > 80) {
    throw new Error("Check the selected user's name and department in User Directory before enrolling.");
  }
  return { userId, name, department, location };
}
