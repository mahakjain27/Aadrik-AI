function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function groupSessions(sessions) {
  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const groups = { Today: [], Yesterday: [], Older: [] };

  for (const session of sessions) {
    const updated = startOfLocalDay(new Date(session.updated_at));

    if (updated.getTime() === today.getTime()) {
      groups.Today.push(session);
    } else if (updated.getTime() === yesterday.getTime()) {
      groups.Yesterday.push(session);
    } else {
      groups.Older.push(session);
    }
  }

  return groups;
}
