// Display aliases do not change role identifiers or stored names used by security rules.
export const displayName = (name: string) => /^(IT Verification|IT Admin)$/i.test(name.trim()) ? "MT Adly" : name;
