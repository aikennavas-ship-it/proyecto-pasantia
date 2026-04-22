
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, getDocs, deleteDoc, query } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const technicians = [
  { name: 'Carlos Rodríguez', email: 'carlos.r@cantv.net', role: 'técnico', department: 'Datos', specialty: 'Fibra Óptica' },
  { name: 'Luis Martínez', email: 'luis.m@cantv.net', role: 'técnico', department: 'Transmisión', specialty: 'Microondas' },
  { name: 'Ana Silva', email: 'ana.s@cantv.net', role: 'técnico', department: 'Provisión', specialty: 'Averías' },
  { name: 'Pedro Pérez', email: 'pedro.p@cantv.net', role: 'técnico', department: 'Datos', specialty: 'Configuración Routers' },
  { name: 'Jose Gregorio', email: 'jose.g@cantv.net', role: 'técnico', department: 'Transmisión', specialty: 'Radiolaces' }
];

const activityDescriptions = [
  'Mantenimiento correctivo en nodo Central 4357.',
  'Atención de avería en cliente corporativo (Banco Venezuela).',
  'Instalación de nuevo enlace de transmisión para Maracay Norte.',
  'Revisión de parámetros en OLT principal.',
  'Sustitución de patch cords dañados en el rack de agregación.',
  'Atención de reclamos por baja velocidad en zona industrial.',
  'Pruebas de latencia y jitter en troncal Caracas-Maracay.',
  'Upgrade de software en equipos Cisco Nexus.'
];

const fleets = ['Hilux V-21', 'Jeep V-45', 'Camioneta CANTV 09', 'S/V'];

async function seed() {
  console.log('--- Iniciando Sembrado de Datos CANTV ---');

  // 1. Create Technicians
  const techCollection = collection(db, 'technicians');
  const techDocs: any[] = [];
  
  for (const tech of technicians) {
    const docRef = await addDoc(techCollection, {
      ...tech,
      createdAt: Timestamp.now()
    });
    techDocs.push({ id: docRef.id, ...tech });
    console.log(`Técnico creado: ${tech.name}`);
  }

  // 2. Create Activities for the last 6 days
  const activityCollection = collection(db, 'activities');
  const today = new Date();
  
  for (let i = 0; i < 6; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    date.setHours(12, 0, 0, 0);
    
    // Create 2-4 activities per day
    const numActivities = Math.floor(Math.random() * 3) + 2;
    
    for (let j = 0; j < numActivities; j++) {
      const type = ['datos', 'transmisión', 'provisión'][Math.floor(Math.random() * 3)];
      const techIndices = [Math.floor(Math.random() * techDocs.length)];
      if (Math.random() > 0.5) techIndices.push((techIndices[0] + 1) % techDocs.length);
      
      const participants = techIndices.map(idx => techDocs[idx].name);
      const overtime = Math.random() > 0.4 ? Math.floor(Math.random() * 4) + 1 : 0;
      const perDiem = Math.random() > 0.7;
      
      const activity = {
        title: activityDescriptions[Math.floor(Math.random() * activityDescriptions.length)],
        description: 'Se realizó labor técnica en sitio bajo normas de seguridad industrial vigentes.',
        incidentNumber: `INC-${2024000 + Math.floor(Math.random() * 10000)}`,
        type,
        priority: ['baja', 'media', 'alta'][Math.floor(Math.random() * 3)],
        status: ['completado', 'en curso', 'pendiente'][Math.floor(Math.random() * 3)],
        participants,
        startTime: '08:00',
        endTime: overtime > 0 ? `${16 + overtime}:00` : '16:00',
        overtimeHours: overtime,
        hasPerDiem: perDiem,
        perDiemAmount: perDiem ? 15.5 * participants.length : 0,
        fleet: fleets[Math.floor(Math.random() * fleets.length)],
        date: Timestamp.fromDate(date),
        createdAt: Timestamp.fromDate(date),
        adminId: 'system-seed'
      };
      
      await addDoc(activityCollection, activity);
      console.log(`Actividad creada para el ${date.toLocaleDateString()}: ${activity.title}`);
    }
  }

  console.log('--- Sembrado Completado con Éxito ---');
  process.exit(0);
}

seed().catch(err => {
  console.error('Error durante el sembrado:', err);
  process.exit(1);
});
