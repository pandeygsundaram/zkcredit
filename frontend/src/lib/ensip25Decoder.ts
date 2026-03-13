export interface DecodedENSIP25 {
  chainId: number;
  address: string;
}

export function decodeENSIP25(record: string | null): DecodedENSIP25 | null {
  if (!record) return null;
  return { chainId: 1, address: record };
}

export function getChainName(chainId: number): string {
  const chains: Record<number, string> = {
    1: "Ethereum",
    10: "Optimism",
    42161: "Arbitrum",
    8453: "Base",
    11155111: "Sepolia (testnet)",
  };
  return chains[chainId] ?? `Chain ${chainId}`;
}
