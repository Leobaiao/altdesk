import { Request, Response, NextFunction } from "express";
import { writeAuditLog, extractRequestInfo } from "../services/auditLog.js";

/**
 * Middleware para auditar automaticamente operações de escrita (POST, PUT, DELETE).
 */
export const globalAuditLogger = async (req: Request, res: Response, next: NextFunction) => {
    const method = req.method;
    
    // Só auditamos escritas
    if (!['POST', 'PUT', 'DELETE'].includes(method)) {
        return next();
    }

    // Captura o send original para interceptar a resposta se necessário, 
    // mas aqui vamos logar o "intento" ou o resultado básico.
    const originalSend = res.send;
    
    // Interceptamos o send para saber se a operação foi bem sucedida
    (res as any).send = function (body: any) {
        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
        
        if (isSuccess) {
            const reqInfo = extractRequestInfo(req);
            const path = req.path;
            
            // Tenta determinar a tabela alvo pelo path (heurística simples)
            let targetTable = "Unknown";
            let action = `${method}_${path}`;

            // Mapeamento simples de caminhos para tabelas/ações amigáveis
            if (path.includes('/users')) { targetTable = 'User'; action = `${method}_USER`; }
            else if (path.includes('/tenants')) { targetTable = 'Tenant'; action = `${method}_TENANT`; }
            else if (path.includes('/contacts')) { targetTable = 'Contact'; action = `${method}_CONTACT`; }
            else if (path.includes('/roles')) { targetTable = 'Role'; action = `${method}_ROLE`; }
            else if (path.includes('/tags')) { targetTable = 'Tag'; action = `${method}_TAG`; }
            else if (path.includes('/templates')) { targetTable = 'Template'; action = `${method}_TEMPLATE`; }
            else if (path.includes('/knowledge')) { targetTable = 'KnowledgeArticle'; action = `${method}_KNOWLEDGE`; }
            else if (path.includes('/canned-responses')) { targetTable = 'CannedResponse'; action = `${method}_CANNED_RESPONSE`; }
            else if (path.includes('/queues')) { targetTable = 'Queue'; action = `${method}_QUEUE`; }

            // Log assíncrono (não bloqueia a resposta)
            writeAuditLog({
                ...reqInfo,
                action: action,
                targetTable: targetTable,
                targetId: req.params.id || (req.body?.id) || undefined,
                afterValues: method !== 'DELETE' ? req.body : undefined // Não logamos senhas via middleware se houver (o ideal é filtrar)
            }).catch(err => console.error("[AuditLogger Middleware Error]", err));
        }

        return originalSend.apply(res, arguments as any);
    };

    next();
};
