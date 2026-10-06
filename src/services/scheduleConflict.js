import { db } from '../db/database.js';

/**
 * Converts HH:MM string into total minutes from midnight
 */
export function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Converts total minutes from midnight back into HH:MM format
 */
export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates ending time (HH:MM) given start time and duration in minutes
 */
export function calculateEndTime(startTime, durationMin) {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + Number(durationMin || 30);
  return minutesToTime(endMins);
}

/**
 * Checks if a requested slot has any time overlap with existing appointments
 * Overlap condition: startA < endB && endA > startB
 */
export function checkScheduleConflict({
  barbeiroId,
  dataISO,
  horaInicio,
  durationMin,
  excludeAgendamentoId = null
}) {
  const barbeiro = db.barbeiros.find(b => b.id === barbeiroId);
  if (!barbeiro) {
    return { hasConflict: true, reason: 'Barbeiro não encontrado.' };
  }

  // Check barber scale for the day of week
  const dateObj = new Date(`${dataISO}T00:00:00`);
  const dayOfWeek = dateObj.getDay(); // 0: Dom, 1: Seg ... 6: Sab
  if (barbeiro.escala && barbeiro.escala.diasSemana && !barbeiro.escala.diasSemana.includes(dayOfWeek)) {
    return {
      hasConflict: true,
      reason: `O barbeiro ${barbeiro.name} não atende no dia da semana selecionado.`
    };
  }

  const horaFim = calculateEndTime(horaInicio, durationMin);
  const reqStart = timeToMinutes(horaInicio);
  const reqEnd = timeToMinutes(horaFim);

  // Check barber working hours bounds
  const scaleStart = timeToMinutes(barbeiro.escala?.inicio || '09:00');
  const scaleEnd = timeToMinutes(barbeiro.escala?.fim || '19:00');

  if (reqStart < scaleStart || reqEnd > scaleEnd) {
    return {
      hasConflict: true,
      reason: `Horário solicitado (${horaInicio} às ${horaFim}) fora da escala do profissional (${barbeiro.escala?.inicio} às ${barbeiro.escala?.fim}).`
    };
  }

  // Filter existing active appointments for this barber and date
  const existingApts = db.agendamentos.filter(a =>
    a.barbeiroId === barbeiroId &&
    a.dataISO === dataISO &&
    a.status !== 'CANCELADO' &&
    (!excludeAgendamentoId || a.id !== excludeAgendamentoId)
  );

  for (const apt of existingApts) {
    const aptStart = timeToMinutes(apt.horaInicio);
    const aptEnd = timeToMinutes(apt.horaFim || calculateEndTime(apt.horaInicio, 30));

    // Overlap formula
    if (reqStart < aptEnd && reqEnd > aptStart) {
      return {
        hasConflict: true,
        reason: `Conflito de horário com o agendamento de ${apt.clienteNome || 'outro cliente'} (${apt.horaInicio} às ${apt.horaFim || minutesToTime(aptEnd)}).`,
        conflictingAppointment: apt
      };
    }
  }

  return {
    hasConflict: false,
    horaInicio,
    horaFim,
    durationMin
  };
}

/**
 * Computes all available, non-conflicting time slots for a given barber, date and service duration
 */
export function getAvailableSlots({ barbeiroId, dataISO, durationMin = 30 }) {
  const barbeiro = db.barbeiros.find(b => b.id === barbeiroId);
  if (!barbeiro) return [];

  const dateObj = new Date(`${dataISO}T00:00:00`);
  const dayOfWeek = dateObj.getDay();
  if (barbeiro.escala && barbeiro.escala.diasSemana && !barbeiro.escala.diasSemana.includes(dayOfWeek)) {
    return [];
  }

  const scaleStart = timeToMinutes(barbeiro.escala?.inicio || '09:00');
  const scaleEnd = timeToMinutes(barbeiro.escala?.fim || '19:00');
  const stepMin = 30; // Grid step of 30 minutes

  const existingApts = db.agendamentos.filter(a =>
    a.barbeiroId === barbeiroId &&
    a.dataISO === dataISO &&
    a.status !== 'CANCELADO'
  );

  const availableSlots = [];

  for (let mins = scaleStart; mins + durationMin <= scaleEnd; mins += stepMin) {
    const slotStart = mins;
    const slotEnd = mins + durationMin;
    const slotTimeStr = minutesToTime(slotStart);

    let isOccupied = false;
    for (const apt of existingApts) {
      const aptStart = timeToMinutes(apt.horaInicio);
      const aptEnd = timeToMinutes(apt.horaFim || calculateEndTime(apt.horaInicio, 30));

      if (slotStart < aptEnd && slotEnd > aptStart) {
        isOccupied = true;
        break;
      }
    }

    availableSlots.push({
      hora: slotTimeStr,
      horaFim: minutesToTime(slotEnd),
      disponivel: !isOccupied
    });
  }

  return availableSlots;
}
