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
