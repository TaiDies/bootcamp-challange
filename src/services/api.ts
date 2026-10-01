import { ClientRoomState, QuizQuestion } from '../types.ts';

const BASE_URL = '';

export async function adminLogin(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'خطأ في تسجيل الدخول');
  }
  return res.json();
}

export async function getAdminRooms(token: string) {
  const res = await fetch(`${BASE_URL}/api/admin/rooms`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('فشل جلب الغرف');
  return res.json();
}

export async function createRoom(
  token: string,
  payload: { title: string; questions: QuizQuestion[]; questionDuration?: number }
) {
  const res = await fetch(`${BASE_URL}/api/admin/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إنشاء الغرفة');
  }
  return res.json();
}

export async function getRoom(roomId: string, playerId?: string): Promise<{ success: boolean; room: ClientRoomState }> {
  const url = `${BASE_URL}/api/rooms/${roomId.toUpperCase()}${playerId ? `?playerId=${playerId}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'الغرفة غير موجودة');
  }
  return res.json();
}

export async function joinRoom(roomId: string, name: string, avatar: string) {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId.toUpperCase()}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, avatar })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل الانضمام إلى الغرفة');
  }
  return res.json();
}

export async function startQuiz(roomId: string, hostToken: string) {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId.toUpperCase()}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل بدء المسابقة');
  }
  return res.json();
}

export async function submitAnswer(roomId: string, playerId: string, selectedOption: number) {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId.toUpperCase()}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, selectedOption })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تسجيل الإجابة');
  }
  return res.json();
}

export async function nextQuestion(roomId: string, hostToken: string) {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId.toUpperCase()}/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل الانتقال للسؤال التالي');
  }
  return res.json();
}

export async function discussQuestion(roomId: string, hostToken: string) {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId.toUpperCase()}/discuss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل بدء مرحلة النقاش');
  }
  return res.json();
}

export async function finishQuiz(roomId: string, hostToken: string) {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId.toUpperCase()}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إنهاء المسابقة');
  }
  return res.json();
}

export async function resetQuiz(roomId: string, hostToken: string) {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId.toUpperCase()}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إعادة ضبط الغرفة');
  }
  return res.json();
}


export function subscribeToRoomStream(
  roomId: string,
  playerId: string | undefined,
  onUpdate: (state: ClientRoomState) => void,
  onError?: (err: any) => void
): () => void {
  const url = `${BASE_URL}/api/rooms/${roomId.toUpperCase()}/stream${playerId ? `?playerId=${playerId}` : ''}`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('room_update', (event) => {
    try {
      const data = JSON.parse(event.data);
      onUpdate(data);
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  });

  eventSource.onerror = (err) => {
    if (onError) onError(err);
  };

  return () => {
    eventSource.close();
  };
}
