import { Server } from "socket.io";
import { logger } from "../lib/logger.js";

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

    // Emit to both conversation room and tenant room simultaneously.
    // By chaining .to(), Socket.IO automatically deduplicates the event for sockets joined to both rooms.
    logger.info({ tenantId, conversationId, event }, "[Socket] Emitting event");
    io.to(conversationId).to(`tenant:${tenantId}`).emit(event, data);
}
