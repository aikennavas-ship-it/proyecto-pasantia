import { collection, addDoc, Timestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export async function seedDummyData(adminId: string) {
  const users = [
    { name: "Juan Escalona", role: "tecnico", specialty: "TRANSMISIÓN", idCard: "V-15487692", emp: "P00107881" },
    { name: "Luis Fernandez", role: "tecnico", specialty: "DATOS", idCard: "V-18765432", emp: "P00107882" },
    { name: "Ana Silva", role: "supervisor", specialty: "RADIO", idCard: "V-19876543", emp: "P00107883" },
    { name: "Carlos Mata", role: "tecnico", specialty: "ENERGÍA", idCard: "V-20123456", emp: "P00107884" },
    { name: "Maria Rojas", role: "tecnico", specialty: "FIBRA ÓPTICA", idCard: "V-22345678", emp: "P00107885" },
    { name: "Jose Perez", role: "tecnico", specialty: "TRANSMISIÓN", idCard: "V-16789012", emp: "P00107886" },
    { name: "Elena Gonzalez", role: "tecnico", specialty: "DATOS", idCard: "V-17890123", emp: "P00107887" }
  ];

  console.log("Creando personal...");
  const techNames: string[] = [];
  
  // Clean existing data first
  try {
     const acts = await getDocs(collection(db, 'activities'));
     const actDeletes = acts.docs.map(d => deleteDoc(doc(db, 'activities', d.id)));
     await Promise.all(actDeletes);

     const techs = await getDocs(collection(db, 'technicians'));
     const techDeletes = techs.docs.map(d => deleteDoc(doc(db, 'technicians', d.id)));
     await Promise.all(techDeletes);
     console.log("Datos anteriores eliminados.");
  } catch(e) {
     console.warn("Error borrando datos antiguos", e);
  }

  const techPromises = users.map(u => {
    techNames.push(u.name);
    const emailName = u.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ').join('.');
    return addDoc(collection(db, 'technicians'), {
      name: u.name,
      employeeId: u.emp,
      idCard: u.idCard,
      specialty: u.specialty,
      phoneNumber: "0414-1234567",
      status: "activo",
      role: u.role,
      email: `${emailName}@cantv.com.ve`,
      createdAt: Timestamp.now(),
      isDeleted: false
    });
  });
  await Promise.all(techPromises);

  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const totalDays = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

  console.log("Creando actividades...");
  const activityPromises: Promise<any>[] = [];
  for (let i = 0; i < totalDays; i++) {
    const actDate = new Date(startOfYear);
    actDate.setDate(actDate.getDate() + i);
    
    const numActivities = Math.floor(Math.random() * 10) + 1; // 1 to 10
    
    for (let j = 0; j < numActivities; j++) {
      const typeOptions = ["mantenimiento preventivo", "mantenimiento correctivo", "instalación", "configuración", "inspección", "reunión", "formación", "otro"];
      const type = typeOptions[Math.floor(Math.random() * typeOptions.length)];
      
      const regionOptions = ["Central", "Capital", "Oriente", "Occidente", "Los Andes", "Guayana"];
      const region = regionOptions[Math.floor(Math.random() * regionOptions.length)];

      const isOvertime = Math.random() > 0.5;
      const otHours = isOvertime ? Math.floor(Math.random() * 4) + 1 : 0;
      const hasPause = Math.random() > 0.5 ? 'SI' : 'NO';

      const numParticipants = Math.floor(Math.random() * 3) + 1;
      const p = [...techNames].sort(() => 0.5 - Math.random()).slice(0, numParticipants);

      activityPromises.push(addDoc(collection(db, 'activities'), {
        title: `Actividad generada #${j+1}`,
        description: "Esta es una actividad generada automáticamente como datos de prueba.",
        type: type,
        incidentNumber: `INC${Math.floor(Math.random() * 1000000)}`,
        fleet: `FL-${actDate.getDate()}`,
        region: region,
        startTimeMorning: '07:45',
        endTimeMorning: '11:45',
        hasPause: hasPause,
        startTimeAfternoon: '12:45',
        endTimeAfternoon: isOvertime ? '18:00' : '16:00',
        hasPerDiem: isOvertime,
        perDiemAmount: isOvertime ? 200 : 0,
        overtimeHours: otHours,
        driver: p[0] || "Luis Martínez",
        technicianId: "dummy123",
        technicianName: p[0],
        participants: p,
        adminId: adminId,
        date: Timestamp.fromDate(actDate),
        createdAt: Timestamp.now(),
        isDeleted: false
      }));
    }
  }

  // Chunk promises heavily to prevent out of memory / network saturation in browser
  const chunkSize = 50;
  for (let i = 0; i < activityPromises.length; i += chunkSize) {
    await Promise.all(activityPromises.slice(i, i + chunkSize));
  }

  console.log("Datos de prueba generados exitosamente");
}
