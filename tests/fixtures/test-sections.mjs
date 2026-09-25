// Stable IDs belong to the synthetic database fixture, not the gateway.
export const testSections = Object.freeze({
	free: "a524e32d-2640-4d94-a51c-000000000001",
	paid: "a524e32d-2640-4d94-a51c-000000000002",
});

export const testSectionPath = key => `/api/sections/${testSections[key]}/${key}`;
