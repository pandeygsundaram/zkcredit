const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileverseClient {
  constructor({ endpoint, apiKey }) {
    this.endpoint = endpoint || '';
    this.apiKey = apiKey || '';
    this.localStore = process.env.FILEVERSE_LOCAL_STORE || path.join(process.cwd(), '.fileverse');
    this.encryptionKey = process.env.FILEVERSE_ENCRYPTION_KEY || '';
  }

  async storeAgentProfile(agent, metadata) {
    const payload = {
      schema: 'zkcredit.agent.profile.v1',
      agent,
      metadata,
      createdAt: new Date().toISOString()
    };
    return this._upload(payload);
  }

  async storeLoanDocuments(loanId, documents) {
    const content = this._encryptIfConfigured({
      schema: 'zkcredit.loan.documents.v1',
      loanId,
      documents
    });
    const payload = {
      schema: 'zkcredit.loan.documents.v1',
      loanId,
      encryption: content.encrypted ? 'aes-256-gcm' : 'none',
      content,
      createdAt: new Date().toISOString()
    };
    return this._upload(payload);
  }

  async updateLoanStatus(loanId, status) {
    const payload = {
      schema: 'zkcredit.loan.status.v1',
      loanId,
      status,
      versionedAt: new Date().toISOString()
    };
    return this._upload(payload);
  }

  async getAgentHistory(agent) {
    if (this.endpoint) {
      const url = `${this.endpoint.replace(/\/+$/, '')}/agent/${agent}`;
      const headers = this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
      const out = await axios.get(url, { headers });
      return out.data;
    }

    // Local fallback: scan durable local records and return matching agent profile entries.
    fs.mkdirSync(this.localStore, { recursive: true });
    const files = fs.readdirSync(this.localStore).filter((f) => f.endsWith('.json'));
    const records = [];
    for (const f of files) {
      const p = path.join(this.localStore, f);
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (raw?.payload?.agent?.toLowerCase?.() === agent.toLowerCase()) {
        records.push(raw.payload);
      }
    }
    return { agent, records, source: 'local-fallback' };
  }

  async updateEnsContenthash(resolverContract, node, cid) {
    const contenthashBytes = ethers.toUtf8Bytes(cid);
    const tx = await resolverContract.setContenthash(node, contenthashBytes);
    await tx.wait();
    return { txHash: tx.hash, cid };
  }

  async _upload(payload) {
    const bytes = ethers.toUtf8Bytes(JSON.stringify(payload));
    const cid = `bafy${ethers.keccak256(bytes).slice(2, 22)}`;

    if (this.endpoint) {
      // Generic API shape expected:
      // POST /store { cid, payload } -> { cid, ... }
      const url = `${this.endpoint.replace(/\/+$/, '')}/store`;
      const headers = {
        'content-type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      };
      const out = await axios.post(url, { cid, payload }, { headers });
      return out.data?.cid ? out.data : { cid, payload, remote: true };
    }

    // Durable local fallback.
    fs.mkdirSync(this.localStore, { recursive: true });
    const p = path.join(this.localStore, `${cid}.json`);
    fs.writeFileSync(p, JSON.stringify({ cid, payload }, null, 2));
    return { cid, payload, localPath: p };
  }

  _encryptIfConfigured(data) {
    if (!this.encryptionKey) {
      return { encrypted: false, data };
    }

    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted: true,
      algo: 'aes-256-gcm',
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      blob: ciphertext.toString('hex')
    };
  }
}

module.exports = { FileverseClient };

