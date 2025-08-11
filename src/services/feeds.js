import { sampleStrategies, runMockSignal } from '../strategies';


export function listStrategies() {
  return sampleStrategies;
}

export async function getLiveSignal(symbol) {
  return runMockSignal(symbol);
}
