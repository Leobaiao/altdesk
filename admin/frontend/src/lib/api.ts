import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Interceptador de Requisição (Request)
// Adiciona o Bearer Token automaticamente em todas as chamadas
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptador de Resposta (Response)
// Trata o erro 401 (Não Autorizado) deslogando o usuário suavemente
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("Token expirado ou inválido (401). Deslogando usuário...");
            localStorage.removeItem("token");
            window.location.href = "/login"; // Faz um refresh forcado p/ login matando o app tree
        }
        return Promise.reject(error);
    }
);
