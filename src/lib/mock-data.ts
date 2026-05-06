export type ContractStatus = "ACTIVE" | "SETTLED" | "PENDING" | "FAILED";

export type Contract = {
  id: string;
  buyer: string;
  seller: string;
  volumeMWh: number;
  priceBRL: number;
  pldBRL: number;
  settlementDate: string;
  status: ContractStatus;
  txHash: string;
};

export const computeExposure = (c: Contract) => (c.pldBRL - c.priceBRL) * c.volumeMWh;

export type Settlement = {
  id: string;
  contractId: string;
  counterparty: string;
  amountBRL: number;
  pld: number;
  date: string;
  txHash: string;
  status: "CONFIRMED" | "PENDING" | "FAILED";
};

export const mockContracts: Contract[] = [
  { id: "EPC-2041", buyer: "Vale Energia S.A.", seller: "Engie Brasil", volumeMWh: 2400, priceBRL: 248.5, pldBRL: 271.2, settlementDate: "2026-05-12", status: "ACTIVE", txHash: "a3f9c1e240b8d7f4a3f9c1e240b8d7f4a3f9c1e240b8d7f4a3f9c1e240b8d7f4" },
  { id: "EPC-2040", buyer: "Petrobras Trading", seller: "EDP Brasil", volumeMWh: 1800, priceBRL: 252.1, pldBRL: 264.8, settlementDate: "2026-05-10", status: "ACTIVE", txHash: "b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4" },
  { id: "EPC-2039", buyer: "CCEE Comercializadora", seller: "Eletrobras", volumeMWh: 5200, priceBRL: 241.8, pldBRL: 258.0, settlementDate: "2026-05-09", status: "PENDING", txHash: "c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7" },
  { id: "EPC-2038", buyer: "Cemig Trading", seller: "Itaipu Binacional", volumeMWh: 3600, priceBRL: 239.4, pldBRL: 278.4, settlementDate: "2026-05-08", status: "SETTLED", txHash: "d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3" },
  { id: "EPC-2037", buyer: "Copel Mercado Livre", seller: "AES Tietê", volumeMWh: 980, priceBRL: 256.7, pldBRL: 237.1, settlementDate: "2026-05-07", status: "SETTLED", txHash: "e2f7a188d310e2f7a188d310e2f7a188d310e2f7a188d310e2f7a188d310e2f7" },
  { id: "EPC-2036", buyer: "Light Energia", seller: "Neoenergia", volumeMWh: 1450, priceBRL: 244.2, pldBRL: 261.5, settlementDate: "2026-05-06", status: "ACTIVE", txHash: "f1c9b327ae84f1c9b327ae84f1c9b327ae84f1c9b327ae84f1c9b327ae84f1c9" },
  { id: "EPC-2035", buyer: "Equatorial Energia", seller: "Furnas", volumeMWh: 2100, priceBRL: 246.0, pldBRL: 246.0, settlementDate: "2026-05-05", status: "FAILED", txHash: "0000000000000000000000000000000000000000000000000000000000000000" },
];

export const mockSettlements: Settlement[] = [
  { id: "STL-90211", contractId: "EPC-2038", counterparty: "Itaipu Binacional", amountBRL: 862400, pld: 278.4, date: "2026-05-05 14:22", txHash: "a3f9c1...e7b240", status: "CONFIRMED" },
  { id: "STL-90210", contractId: "EPC-2037", counterparty: "AES Tietê", amountBRL: -19208, pld: 237.1, date: "2026-05-05 11:08", txHash: "b8d4e2...912ca5", status: "CONFIRMED" },
  { id: "STL-90209", contractId: "EPC-2035", counterparty: "Neoenergia", amountBRL: 412900, pld: 268.0, date: "2026-05-04 17:54", txHash: "c1a7f0...3e8b91", status: "CONFIRMED" },
  { id: "STL-90208", contractId: "EPC-2034", counterparty: "Engie Brasil", amountBRL: 218750, pld: 261.5, date: "2026-05-04 09:31", txHash: "d9b3e8...77c1f2", status: "CONFIRMED" },
  { id: "STL-90207", contractId: "EPC-2033", counterparty: "EDP Brasil", amountBRL: 154600, pld: 254.9, date: "2026-05-03 16:12", txHash: "e2f7a1...88d310", status: "CONFIRMED" },
];

export const volumeSeries = [
  { day: "Apr 28", volume: 12400, settled: 11800 },
  { day: "Apr 29", volume: 14200, settled: 13900 },
  { day: "Apr 30", volume: 9800, settled: 9600 },
  { day: "May 01", volume: 16700, settled: 16100 },
  { day: "May 02", volume: 18900, settled: 18400 },
  { day: "May 03", volume: 21200, settled: 20800 },
  { day: "May 04", volume: 19450, settled: 19100 },
  { day: "May 05", volume: 23800, settled: 22900 },
];

export const pldSeries = [
  { hour: "00h", pld: 241 }, { hour: "03h", pld: 238 }, { hour: "06h", pld: 244 },
  { hour: "09h", pld: 258 }, { hour: "12h", pld: 271 }, { hour: "15h", pld: 282 },
  { hour: "18h", pld: 294 }, { hour: "21h", pld: 263 },
];
