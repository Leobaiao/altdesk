import { Server } from "socket.io";

/**
 * Helper to emit events to both a specific conversation room and the tenant room.
 * This ensures that active chat windows and the sidebar/monitoring views are all updated.
 */
export function emitConversationEvent(
    io: Server,
    tenantId: string,
    conversationId: string,
    event: string,
    data: any
) {
    if (!io) return;

    // 1. Emit to the specific conversation room (for users currently viewing this chat)
    io.to(conversationId).emit(event, data);

    // 2. Emit to the tenant room (for sidebar updates, counters, and monitoring)
    io.to(`tenant:${tenantId}`).emit(event, data);
}
