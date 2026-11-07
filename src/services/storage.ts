import { Config, Preset, SessionRecord, PredictionRecord } from '../types';

const DB_NAME = 'RoboTendenciaLabDB';
const DB_VERSION = 1;

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'conservative',
    name: 'Conservador',
    description: 'Compra ≥ 80%, venda ≥ 85%, compra de 10% do saldo, meta 2,5%, limite 3%, máx. 3 lotes, trava 10%.',
    isDefault: true,
    config: {
      buyThreshold: 80,
      sellThreshold: 85,
      buySizeMode: 'percent',
      buySizeValue: 10,
      gainTargetPercent: 2.5,
      stopLossPercent: 3.0,
      maxActiveLots: 3,
      generalGuardrailPercent: 10
    }
  },
  {
    id: 'moderate',
    name: 'Moderado (Padrão)',
    description: 'Compra ≥ 70%, venda ≥ 85%, compra de 20% do saldo, meta 3%, limite 5%, máx. 5 lotes, trava 20%.',
    isDefault: true,
    config: {
      buyThreshold: 70,
      sellThreshold: 85,
      buySizeMode: 'percent',
      buySizeValue: 20,
      gainTargetPercent: 3.0,
      stopLossPercent: 5.0,
      maxActiveLots: 5,
      generalGuardrailPercent: 20
    }
  },
  {
    id: 'aggressive',
    name: 'Agressivo',
    description: 'Compra ≥ 60%, venda ≥ 75%, compra de 35% do saldo, meta 5%, limite 8%, máx. 8 lotes, trava 30%.',
    isDefault: true,
    config: {
      buyThreshold: 60,
      sellThreshold: 75,
      buySizeMode: 'percent',
      buySizeValue: 35,
      gainTargetPercent: 5.0,
      stopLossPercent: 8.0,
      maxActiveLots: 8,
      generalGuardrailPercent: 30
    }
  }
];

export const DEFAULT_CONFIG: Config = {
  market: 'xrpbrl',
  resolution: '1h',
  mode: 'replay',
  replayDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // yesterday
  replayStartTime: '08:00',
  replayEndTime: '18:00',
  replayDelayMs: 3000,
  initialCapitalBRL: 100,
  initialCoins: 0,
  feePercent: 0.5,
  slippagePercent: 0.1,
  minOrderValueBRL: 10,
  buySizeMode: 'percent',
  buySizeValue: 20,
  candleWindowSize: 30,
  predictionHorizon: 4,
  geminiModel: 'gemini-2.5-flash',
  temperature: 0.2,
  anonymized: true,
  buyThreshold: 70,
  sellThreshold: 85,
  fallPolicy: 'ignore',
  gainTargetPercent: 3.0,
  stopLossPercent: 5.0,
  cooldownSteps: 2,
  maxActiveLots: 5,
  maxDailyTrades: 20,
  generalGuardrailPercent: 20,
  guardrailAction: 'stop',
  dailyLossLimitBRL: null
};

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('predictions')) {
        db.createObjectStore('predictions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('presets')) {
        db.createObjectStore('presets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
  });
}

export async function saveSession(session: SessionRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const request = store.put(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSessions(): Promise<SessionRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function savePresets(presets: Preset[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('presets', 'readwrite');
    const store = tx.objectStore('presets');
    // Clear and put all
    store.clear();
    for (const p of presets) {
      store.put(p);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPresets(): Promise<Preset[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('presets', 'readonly');
    const store = tx.objectStore('presets');
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result || [];
      if (results.length === 0) {
        resolve(DEFAULT_PRESETS);
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function savePredictions(predictions: PredictionRecord[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('predictions', 'readwrite');
    const store = tx.objectStore('predictions');
    for (const p of predictions) {
      store.put(p);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPredictions(): Promise<PredictionRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('predictions', 'readonly');
    const store = tx.objectStore('predictions');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
