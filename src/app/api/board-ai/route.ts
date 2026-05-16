import { NextResponse } from 'next/server';
import http from 'node:http';
import https from 'node:https';

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
  'www.koreporeczki.cba.pl',
  'moja-tablica.vercel.app',
  'localhost',
  '127.0.0.1',
]);

type AiBackendResponse = {
  status?: string;
  answer?: string;
  message?: string;
};

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
  const bases = [apiUrl];
  if (apiUrl.hostname !== 'core-czki.pl') {
    bases.push(new URL(DEFAULT_BOARD_API_URL));
  }

  const urls = bases.flatMap((baseUrl) => {
    const boardApiUrl = new URL(baseUrl.toString());
    boardApiUrl.searchParams.set('action', 'ai_solve');

    const legacyAiUrl = new URL(boardApiUrl.toString());
    legacyAiUrl.pathname = legacyAiUrl.pathname.replace(/board_api\.php$/i, 'board_ai.php');
    legacyAiUrl.searchParams.delete('action');

    return [boardApiUrl.toString(), legacyAiUrl.toString()];
  });

  return [...new Set(urls)];
};

const parseBackendResponse = (text: string): AiBackendResponse | null => {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as AiBackendResponse;
  } catch {
    return { status: 'error', message: text.slice(0, 500) };
  }
};

const postJsonViaNode = (urlString: string, body: Record<string, string>) => new Promise<AiBackendResponse | null>((resolve, reject) => {
  const url = new URL(urlString);
  const payload = JSON.stringify(body);
  const client = url.protocol === 'https:' ? https : http;
  const options: http.RequestOptions & { rejectUnauthorized?: boolean } = {
    method: 'POST',
    family: 4,
    timeout: 55000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': 'moja-tablica-ai-proxy/1.0',
    },
  };

  if (url.protocol === 'https:') {
    options.rejectUnauthorized = false;
  }

  const request = client.request(url, options, (response) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    response.on('end', () => {
      const data = parseBackendResponse(Buffer.concat(chunks).toString('utf8'));
      if ((response.statusCode || 500) >= 400) {
        reject(new Error(data?.message || `Backend AI zwrócił błąd ${response.statusCode}.`));
        return;
      }
      resolve(data);
    });
  });

  request.on('timeout', () => request.destroy(new Error('Przekroczono czas oczekiwania na backend AI.')));
  request.on('error', reject);
  request.write(payload);
  request.end();
});

const postToAiEndpoint = async (url: string, body: Record<string, string>) => {
  const data = await postJsonViaNode(url, body);
  if (data?.status !== 'success') {
    throw new Error(data?.message || 'Backend AI nie zwrócił poprawnej odpowiedzi.');
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
