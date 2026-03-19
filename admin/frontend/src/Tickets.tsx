import React, { useEffect, useState } from "react";
import { TicketList } from "./components/TicketList";
import { TicketDetail } from "./components/TicketDetail";
import type { TicketData } from "./components/TicketList";
import { api } from "./lib/api";

interface Props {
    token: string;
    onBack: () => void;
    role: string;
}

export function Tickets({ token, onBack, role }: Props) {
    const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        api.get("/api/profile")
            .then(res => setProfile(res.data))
            .catch(console.error);
    }, []);

    function handleTicketUpdate() {
        // Refresh the ticket data
        if (selectedTicket) {
            api.get<TicketData[]>("/api/conversations")
                .then(res => {
                    const updated = (res.data || []).find(t => t.ConversationId === selectedTicket.ConversationId);
                    if (updated) setSelectedTicket(updated);
                })
                .catch(console.error);
        }
    }

    if (selectedTicket) {
        return (
            <div style={{ flex: 1, height: "100%", overflow: "hidden" }}>
                <TicketDetail
                    ticket={selectedTicket}
                    onBack={() => setSelectedTicket(null)}
                    profile={profile}
                    onTicketUpdate={handleTicketUpdate}
                />
            </div>
        );
    }

    return (
        <div style={{ flex: 1, height: "100%", overflow: "hidden" }}>
            <TicketList
                onSelect={setSelectedTicket}
                selectedId={null}
                onBack={onBack}
            />
        </div>
    );
}
