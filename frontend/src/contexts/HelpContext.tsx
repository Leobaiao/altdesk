import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { api } from "../lib/api";
import { HelpArticle } from "../../../shared/types";

interface HelpContextType {
    isOpen: boolean;
    loading: boolean;
    activeKey: string | null;
    article: HelpArticle | null;
    openHelp: (contextKey: string) => Promise<void>;
    closeHelp: () => void;
    pageContextKey: string | null;
    setPageContextKey: (key: string | null) => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [article, setArticle] = useState<HelpArticle | null>(null);
    const [pageContextKey, _setPageContextKey] = useState<string | null>(null);

    const setPageContextKey = useCallback((key: string | null) => {
        _setPageContextKey(key);
    }, []);

    const openHelp = useCallback(async (contextKey: string) => {

        // If same key is already open, just toggle visibility
        if (isOpen && activeKey === contextKey) {
            setIsOpen(false);
            return;
        }

        setIsOpen(true);
        setLoading(true);
        setActiveKey(contextKey);
        setArticle(null); // Clear previous content

        try {
            const response = await api.get<HelpArticle>(`/api/help/${contextKey}`);
            setArticle(response.data);
        } catch (error: any) {
            // If 404, show contextual fallback. If server error, show a different message.
            const status = error?.response?.status;

            if (status === 404) {
                setArticle({
                    HelpArticleId: "fallback",
                    ContextKey: contextKey,
                    Title: "Ajuda Indisponível",
                    Content: "<p>Ainda não há conteúdo de ajuda registrado para esta tela.</p>",
                    IsActive: true
                });
            } else {

                setArticle({
                    HelpArticleId: "fallback",
                    ContextKey: contextKey,
                    Title: "Erro ao Carregar",
                    Content: "<p>Não foi possível carregar o conteúdo de ajuda. Tente novamente em instantes.</p>",
                    IsActive: true
                });
            }
        } finally {
            setLoading(false);
        }
    }, [isOpen, activeKey]);

    const closeHelp = useCallback(() => {
        setIsOpen(false);
        // Delay clearing article for smooth exit animation
        setTimeout(() => {
            setActiveKey(null);
            setArticle(null);
        }, 350);
    }, []);

    return (
        <HelpContext.Provider value={{
            isOpen,
            loading,
            activeKey,
            article,
            openHelp,
            closeHelp,
            pageContextKey,
            setPageContextKey
        }}>
            {children}
        </HelpContext.Provider>
    );
}

export function useHelp() {
    const context = useContext(HelpContext);
    if (context === undefined) {
        throw new Error("useHelp must be used within a HelpProvider");
    }
    return context;
}
