// Inspect unchanged passwords, counting Unicode code points rather than UTF-16 units.
// Registration and recovery share the provider's byte limit; login accepts old passwords.
export function inspectPassword(password, { existing = false } = {}) {
	const length = [...password].length;
	let error = null;
	if (!length) error = "required";
	else if (!existing && length < 12) error = "too_short";
	else if (existing ? length > 128 : new TextEncoder().encode(password).length > 72) error = "too_long";
	return { length, error };
}
