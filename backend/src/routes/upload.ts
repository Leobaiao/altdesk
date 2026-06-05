import { Router, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMw } from "../mw.js";
import { AuthenticatedRequest } from "../types/index.js";

const router = Router();
router.use(authMw);

// Configurar o multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Determinar a subpasta baseado no campo ou endpoint
        let folder = "attachments";
        if (req.path.includes("avatar")) {
            folder = "avatars";
        }
        
        const uploadPath = path.join(process.cwd(), "public", "uploads", folder);
        
        // Criar a pasta se não existir
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Gerar um nome único
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// Endpoint para upload de avatar
router.post("/avatar", upload.single("file"), ((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Nenhum arquivo enviado" });
        }
        
        // Retornar a URL pública
        const url = `/uploads/avatars/${req.file.filename}`;
        res.json({ url });
    } catch (error) {
        next(error);
    }
}) as any);

// Endpoint para upload de anexo de conversa
router.post("/attachment", upload.single("file"), ((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Nenhum arquivo enviado" });
        }
        
        // Retornar a URL pública e informações do arquivo
        const url = `/uploads/attachments/${req.file.filename}`;
        
        // Determinar o MediaType básico
        let mediaType = "document";
        if (req.file.mimetype.startsWith("image/")) mediaType = "image";
        else if (req.file.mimetype.startsWith("audio/")) mediaType = "audio";
        else if (req.file.mimetype.startsWith("video/")) mediaType = "video";
        
        res.json({ 
            url, 
            mediaType,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        next(error);
    }
}) as any);

export default router;
