import exceljs from "exceljs";
import PDFDocument from "pdfkit";

export const HEADER_MAP: Record<string, string> = {
  ConversationId: "ID_Conversa",
  TicketId: "ID_Ticket",
  Status: "Situacao",
  SourceChannel: "Canal",
  CreatedAt: "Data_Criacao",
  LastMessageAt: "Ultima_Mensagem",
  AssignedAgent: "Atendente",
  QueueName: "Fila",
  MessageCount: "Total_Mensagens",
  SlaStatus: "SLA_Status",
  SlaDeadline: "SLA_Prazo",
  Agent: "Agente",
  Email: "Email",
  Resolved: "Resolvidos",
  Open: "Abertos",
  Total: "Total",
  SlaViolations: "SLA_Violacoes",
  SlaOk: "SLA_No_Prazo",
  SlaViolated: "SLA_Atrasados_Qtd",
  SlaPending: "SLA_Pendentes",
  CompliancePercent: "Taxa_Sucesso_SLA_Pct",
  ConversationTitle: "Titulo_Conversa",
  Priority: "Prioridade",
  AgentName: "Nome_Agente",
  ChannelName: "Nome_Canal",
  ResolvedCount: "Total_Resolvidos",
  OpenCount: "Total_Abertos",
  TotalCount: "Total_Chamados",
  SlaComplianceRate: "Taxa_SLA_Pct",
  AvgFirstResponseTime: "Media_Primeira_Resposta_Min",
  AvgResolutionTime: "Media_Resolucao_Min",
  SlaPercentage: "SLA_Percentual",
  FirstResponseAt: "Primeira_Resposta_Em",
  ResolvedAt: "Resolvido_Em",
  CsatScore: "Nota_CSAT",
  SlaViolationsCount: "SLA_Violacoes_Qtd",
  TotalConversations: "Total_Conversas",
  OpenConversations: "Conversas_Abertas",
  ClosedConversations: "Conversas_Fechadas",
  AvgMessageCount: "Media_Mensagens",
  AvgCsatScore: "Media_CSAT",
  TotalTickets: "Total_Tickets",
  WhatsappTickets: "Tickets_Whatsapp",
  EmailTickets: "Tickets_Email",
  PlatformTickets: "Tickets_Plataforma",
  SmsTickets: "Tickets_SMS",
  OtherTickets: "Tickets_Outros",
  CriticalTickets: "Tickets_Criticos",
  HighTickets: "Tickets_Altos",
  MediumTickets: "Tickets_Medios",
  LowTickets: "Tickets_Baixos",
  ActiveTickets: "Tickets_Ativos",
  ClosedTickets: "Tickets_Fechados",
  SlaWarningTickets: "Tickets_SLA_Alerta",
  SlaViolatedTickets: "Tickets_SLA_Violados",
  TotalActiveAgents: "Total_Agentes_Ativos",
  AvgResolvedPerAgent: "Media_Resolvidos_Por_Agente",
  OverallSlaViolationRate: "Taxa_Geral_Violacao_SLA_Pct",
  SlaOnTime: "SLA_No_Prazo_Qtd",
  SlaWarning: "SLA_Alerta_Qtd",
  ComplianceRate: "Taxa_Conformidade_Pct"
};

export function formatExportDate(dateObj: any): string {
  if (!(dateObj instanceof Date)) {
    if (typeof dateObj === "string" && !isNaN(Date.parse(dateObj))) {
      dateObj = new Date(dateObj);
    } else {
      return String(dateObj ?? "");
    }
  }
  if (isNaN(dateObj.getTime())) return "";
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(dateObj.getDate())}/${p(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${p(dateObj.getHours())}:${p(dateObj.getMinutes())}:${p(dateObj.getSeconds())}`;
}

/**
 * Exports data to CSV with BOM and translated headers
 */
export function exportToCSV(data: any[]): Buffer {
  if (!data || !data.length) {
    return Buffer.from("\uFEFF", "utf-8");
  }

  const originalHeaders = Object.keys(data[0]).filter(h => h !== "TotalRows");
  const translatedHeaders = originalHeaders.map(h => HEADER_MAP[h] || h);

  const lines = [
    translatedHeaders.join(","),
    ...data.map(row =>
      originalHeaders.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return "";
        let str = "";
        if (v instanceof Date) {
          str = formatExportDate(v);
        } else {
          str = String(v).replace(/"/g, '""');
        }
        return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
      }).join(",")
    )
  ];

  const csvContent = lines.join("\r\n");
  return Buffer.from("\uFEFF" + csvContent, "utf-8");
}

/**
 * Exports data to XLSX using exceljs with bold headers and autofitted columns
 */
export async function exportToXLSX(data: any[]): Promise<Buffer> {
  const workbook = new exceljs.Workbook();
  const worksheet = workbook.addWorksheet("Relatório");

  if (data && data.length > 0) {
    const originalHeaders = Object.keys(data[0]).filter(h => h !== "TotalRows");
    const translatedHeaders = originalHeaders.map(h => HEADER_MAP[h] || h);

    // Set columns with initial widths
    worksheet.columns = translatedHeaders.map(header => ({
      header,
      key: header,
      width: header.length + 5
    }));

    // Bold headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };

    // Add rows
    data.forEach(item => {
      const rowData: Record<string, any> = {};
      originalHeaders.forEach(key => {
        const transKey = HEADER_MAP[key] || key;
        const val = item[key];
        if (val instanceof Date) {
          rowData[transKey] = formatExportDate(val);
        } else if (val === null || val === undefined) {
          rowData[transKey] = "";
        } else {
          rowData[transKey] = val;
        }
      });
      worksheet.addRow(rowData);
    });

    // Auto-fit column widths
    worksheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell!({ includeEmpty: true }, cell => {
        const val = cell.value;
        const len = val ? String(val).length : 0;
        if (len > maxLen) {
          maxLen = len;
        }
      });
      column.width = Math.max(maxLen + 3, 12);
    });
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}

// Translations for cell values in PDF export
const VALUE_TRANSLATIONS: Record<string, Record<string, string>> = {
  Status: {
    NEW: "Novo",
    OPEN: "Aberto",
    TRIAGE: "Em Triagem",
    IN_PROGRESS: "Em Atendimento",
    WAITING_CUSTOMER: "Aguardando Cliente",
    WAITING_THIRD_PARTY: "Aguardando Terceiro",
    ESCALATED: "Escalado",
    RESOLVED: "Resolvido",
    CLOSED: "Fechado",
  },
  Priority: {
    LOW: "Baixa",
    MEDIUM: "Média",
    HIGH: "Alta",
    CRITICAL: "Crítica",
    URGENT: "Urgente",
  },
  SlaStatus: {
    OK: "No Prazo",
    ON_TIME: "No Prazo",
    WARNING: "Atenção",
    VIOLATED: "Fora do SLA",
    BREACHED: "Fora do SLA",
    PENDING: "Pendente",
  },
};

/**
 * Translates a cell value to Portuguese if a translation exists
 */
function translateCellValue(header: string, val: any): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return formatExportDate(val);
  const str = String(val);
  const translations = VALUE_TRANSLATIONS[header];
  if (translations) {
    return translations[str.toUpperCase()] || str;
  }
  // Detect and format dates
  if (typeof val === "string" && val.includes("T") && !isNaN(Date.parse(val))) {
    return formatExportDate(new Date(val));
  }
  return str;
}

/**
 * Exports data to PDF using pdfkit with company branding, pagination, and Portuguese translations
 */
export async function exportToPDF(data: any[], reportTitle = "Relatório", companyName = ""): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const limitRows = data.slice(0, 100);
      const originalHeaders = limitRows.length > 0
        ? Object.keys(limitRows[0]).filter(h => h !== "TotalRows")
        : [];
      const translatedHeaders = originalHeaders.map(h => HEADER_MAP[h] || h);

      const numCols = originalHeaders.length;
      const isLandscape = numCols > 5;
      const pageWidth = isLandscape ? 842 : 595;
      const pageHeight = isLandscape ? 595 : 842;
      const margin = 40;
      const printableWidth = pageWidth - (margin * 2);
      const colWidth = numCols > 0 ? printableWidth / numCols : printableWidth;
      const footerY = pageHeight - 30;
      const maxContentY = footerY - 20;

      // Use company name if provided, otherwise just the report title
      const displayName = companyName || "Relatório";
      const titleText = companyName ? `${companyName} - ${reportTitle}` : reportTitle;

      // We'll use bufferPages to add page numbers after all content is rendered
      const doc = new PDFDocument({
        size: "A4",
        layout: isLandscape ? "landscape" : "portrait",
        margins: { top: 40, bottom: 20, left: 40, right: 40 },
        bufferPages: true
      });

      const buffers: Buffer[] = [];
      doc.on("data", chunk => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", err => reject(err));

      // Title header - left-aligned
      doc.fontSize(16).font("Helvetica-Bold").text(titleText, margin, margin, { align: "left" });
      doc.fontSize(9).font("Helvetica").fillColor("#666666").text(`Gerado em: ${formatExportDate(new Date())}`, margin, doc.y, { align: "left" });
      doc.fillColor("#000000");
      doc.moveDown(2);

      if (limitRows.length === 0) {
        doc.fontSize(12).text("Nenhum dado encontrado para exportação.", { align: "center" });

        // Add footer and page numbers to all pages
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(7).fillColor("#999999").font("Helvetica")
            .text("Produzido por Altdesk", margin, footerY, { align: "left", width: printableWidth / 2 });
          doc.fontSize(7).fillColor("#999999").font("Helvetica")
            .text(`Página ${i + 1} de ${totalPages}`, margin + printableWidth / 2, footerY, { align: "right", width: printableWidth / 2 });
        }

        doc.end();
        return;
      }

      // Draw table header helper
      const drawHeader = (y: number) => {
        doc.fillColor("#f0f0f0").rect(margin, y - 4, printableWidth, 18).fill();
        doc.fillColor("#000000");
        translatedHeaders.forEach((header, index) => {
          doc.fontSize(8).font("Helvetica-Bold").text(
            header,
            margin + (index * colWidth) + 2,
            y,
            { width: colWidth - 4, height: 12, ellipsis: true }
          );
        });
        doc.moveTo(margin, y + 14).lineTo(margin + printableWidth, y + 14).strokeColor("#cccccc").stroke();
      };

      let startY = doc.y;
      drawHeader(startY);
      doc.font("Helvetica");

      let currentY = startY + 20;

      limitRows.forEach((row) => {
        // Page boundary check — leave room for footer
        if (currentY > maxContentY) {
          doc.addPage();
          currentY = margin;
          drawHeader(currentY);
          currentY += 20;
          doc.font("Helvetica");
        }

        originalHeaders.forEach((header, colIndex) => {
          const val = row[header];
          const textVal = translateCellValue(header, val);

          doc.fontSize(8).text(
            textVal,
            margin + (colIndex * colWidth) + 2,
            currentY,
            { width: colWidth - 4, height: 12, ellipsis: true }
          );
        });

        doc.moveTo(margin, currentY + 12).lineTo(margin + printableWidth, currentY + 12).strokeColor("#eeeeee").stroke();
        currentY += 16;
      });

      // Add footer and page numbers to ALL pages
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor("#999999").font("Helvetica")
          .text("Produzido por Altdesk", margin, footerY, { align: "left", width: printableWidth / 2 });
        doc.fontSize(7).fillColor("#999999").font("Helvetica")
          .text(`Página ${i + 1} de ${totalPages}`, margin + printableWidth / 2, footerY, { align: "right", width: printableWidth / 2 });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
