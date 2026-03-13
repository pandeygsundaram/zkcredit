import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";

export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

export async function resolveEnsAddress(name: string): Promise<`0x${string}` | null> {
  try {
    const address = await mainnetClient.getEnsAddress({ name });
    if (address) return address;
  } catch (_) {}
  try {
    const address = await sepoliaClient.getEnsAddress({ name });
    return address ?? null;
  } catch (_) {
    return null;
  }
}

export async function getEnsAddressRecord(name: string): Promise<`0x${string}` | null> {
  try {
    const resolver = await mainnetClient.getEnsResolver({ name });
    if (!resolver) return null;
    const addr = await mainnetClient.getEnsAddress({ name });
    return addr ?? null;
  } catch (_) {
    return null;
  }
}
