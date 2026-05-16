import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AiRequestBody = {
  apiUrl?: unknown;
  prompt?: unknown;
  context?: unknown;
  image?: unknown;
};

const DEFAULT_BOARD_API_URL = 'https://core-czki.pl/uczen/board_api.php';
const ALLOWED_HOSTS = new Set([
  'core-czki.pl',
  'www.core-czki.pl',
  'koreporeczki.cba.pl',
  'moja-tablica.vercel.app',
  'localhost',
  '127.0.0.1',
]);

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

const normalizeBoardApiUrl = (rawApiUrl: unknown) => {
  const raw = asString(rawApiUrl).trim() || DEFAULT_BOARD_API_URL;
  const url = new URL(raw, DEFAULT_BOARD_API_URL);

  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    url.protocol = 'https:';
  }

  const isAllowedHost = ALLOWED_HOSTS.has(url.hostname) || /(^|\.)vercel\.app$/i.test(url.hostname);
  if (!isAllowedHost) {
    throw new Error('Ten adres API tablicy nie jest dozwolony.');
  }

  if (!/\/uczen\/board_api\.php$/i.test(url.pathname)) {
    throw new Error('Adres API musi wskazywać na /uczen/board_api.php.');
  }

  return url;
};

const getAiEndpointUrls = (apiUrl: URL) => {
  const boardApiUrl = new URL(apiUrl.toString());
  boardApiUrl.searchParams.set('action', 'ai_solve');

  const legacyAiUrl = new URL(boardApiUrl.toString());
  legacyAiUrl.pathname = legacyAiUrl.pathname.replace(/board_api\.php$/i, 'board_ai.php');
  legacyAiUrl.searchParams.delete('action');

  return [...new Set([boardApiUrl.toString(), legacyAiUrl.toString()])];
};

const readJsonOrText = async (response: Response) => {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as { status?: string; answer?: string; message?: string };
  } catch {
    return { status: 'error', message: text.slice(0, 500) };
  }
};

const postToAiEndpoint = async (url: string, body: Record<string, string>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(55000),
  });
  const data = await readJsonOrText(response);
  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || `Backend AI zwrócił błąd ${response.status}.`);
  }
  return String(data.answer || '').trim();
};

export async function POST(request: Request) {
  let body: AiRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'error', message: 'Niepoprawny JSON w zapytaniu AI.' }, { status: 400 });
  }

  let apiUrl: URL;
  try {
    apiUrl = normalizeBoardApiUrl(body.apiUrl);
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Niepoprawny adres API tablicy.' },
      { status: 400 },
    );
  }

  const payload = {
    prompt: asString(body.prompt).slice(0, 4000),
    context: asString(body.context).slice(0, 20000),
    image: asString(body.image),
  };

  if (!payload.prompt.trim() && !payload.context.trim() && !payload.image.trim()) {
    return NextResponse.json(
      { status: 'error', message: 'Zaznacz fragment tablicy albo dopisz krótki prompt.' },
      { status: 400 },
    );
  }

  let lastError = '';
  for (const url of getAiEndpointUrls(apiUrl)) {
    try {
      const answer = await postToAiEndpoint(url, payload);
      return NextResponse.json({ status: 'success', answer });
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Nieznany błąd backendu AI.';
    }
  }

  return NextResponse.json(
    {
      status: 'error',
      message: `Nie udało się połączyć z backendem AI przez serwer Vercel. Ostatni błąd: ${lastError}`,
    },
    { status: 502 },
  );
}
