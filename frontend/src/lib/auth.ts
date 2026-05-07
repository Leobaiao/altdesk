/**
 * Safely parse a JWT token to extract its payload.
 * @param token The JWT string
 * @returns The decoded payload or null if invalid
 */
export function parseJwt(token: string) {
    try {
        return JSON.parse(atob(token.split(".")[1]));
    } catch (e) {
        return null;
    }
}

export function getUserIdFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = parseJwt(token);
    return payload ? payload.userId : null;
}

export function getUserRoleFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = parseJwt(token);
    return payload ? payload.role : null;
}
