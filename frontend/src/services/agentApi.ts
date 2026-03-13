const API_BASE_URL = 'http://localhost:3001';

export async function registerAgent(
  wallet: string,
  ensName: string | null,
  polymarketMetadata: any = null,
  ensIdentity?: { name: string | null; chain: string }
) {
  try {
    const response = await fetch(`${API_BASE_URL}/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet,
        ens_name: ensName,
        polymarket_metadata: polymarketMetadata,
        ens_identity: ensIdentity ?? null,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register agent');
    }

    return await response.json();
  } catch (error) {
    console.error('Error registering agent:', error);
    throw error;
  }
}

export async function getQuote(wallet: string, collateral: number) {
  try {
    const response = await fetch(`${API_BASE_URL}/agents/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallet, collateral }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch loan quote');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching loan quote:', error);
    throw error;
  }
}
