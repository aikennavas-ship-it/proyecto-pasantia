import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      system: "CANTV DTX Backend",
      timestamp: new Date().toISOString(),
      maracayTime: new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * -4)).toISOString()
    });
  });

  // Backend tools logic (Simulated backend processing endpoints)
  app.post("/api/activities/validate", (req, res) => {
    const { activity } = req.body;
    // Logic to validate technical constraints before saving
    if (!activity.title || !activity.incidentNumber) {
      return res.status(400).json({ error: "Datos técnicos incompletos" });
    }
    res.json({ valid: true, message: "Validación de labor exitosa" });
  });

  app.get("/api/reports/config", (req, res) => {
    res.json({
      central: "4357",
      region: "Central",
      departments: ["DATOS", "TRANSMISIÓN"],
      reportStructure: "TX/DX Standard 2026",
      signatures: ["Jefe de Departamento", "Supervisor de Guardia", "Técnico Responsable"]
    });
  });

  app.post("/api/stats/calculate", (req, res) => {
    const { activities } = req.body;
    // Server-side calculation of complex stats
    const totalHours = activities.reduce((acc: number, cur: any) => acc + (cur.overtimeHours || 0), 0);
    
    res.json({
      processedAt: new Date().toISOString(),
      totalOvertimeHours: totalHours.toFixed(1),
      avgHoursPerActivity: activities.length > 0 ? (totalHours / activities.length).toFixed(2) : 0
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: "0.0.0.0",
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
================================================
🚀 CANTV DTX BACKEND INICIADO
📡 Central 4357 - Datos y Transmisión
📍 Puerto: ${PORT}
🌐 Modo: ${process.env.NODE_ENV || 'development'}
================================================
    `);
  });
}

startServer().catch((err) => {
  console.error("Error iniciando el servidor:", err);
});
