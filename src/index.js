import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

/**
 * Normalize axios error to { success: false, error, code }.
 * code is HTTP status when available (e.g. 404 for CID not in pinset).
 */
function toErrorPayload(error, extra = {}) {
  const code = error.response?.status ?? (error.code || 500);
  const message =
    error.response?.data?.message ??
    error.response?.data?.error ??
    error.message;
  return { success: false, error: message, code, ...extra };
}

/**
 * Extract allocations array from GET /allocations/{cid} response (PinInfo).
 * API may return: allocations, Allocations, or pin_info.allocations (by version).
 */
function getAllocationsFromPinInfo(data) {
  if (Array.isArray(data?.allocations)) return data.allocations;
  if (Array.isArray(data?.Allocations)) return data.Allocations;
  if (Array.isArray(data?.pin_info?.allocations)) return data.pin_info.allocations;
  if (Array.isArray(data?.pin_info?.Allocations)) return data.pin_info.Allocations;
  return [];
}

/**
 * Extract peer map / peers from GET /pins/{cid} response (GlobalPinInfo or PinInfo).
 * API may return: peer_map, peers, or peer_map with peer IDs as keys.
 */
function getPeersFromStatus(data) {
  if (data?.peer_map && typeof data.peer_map === 'object')
    return data.peer_map;
  if (Array.isArray(data?.peers)) return data.peers;
  return data?.peers ?? data?.peer_map ?? null;
}

/**
 * Extract allocations from status response (GET /pins/{cid}) when present.
 */
function getAllocationsFromStatus(data) {
  if (Array.isArray(data?.allocations)) return data.allocations;
  if (Array.isArray(data?.Allocations)) return data.Allocations;
  return null;
}

class IPFSClusterClient {
  constructor({ host = 'localhost', port = '9094', protocol = 'http' } = {}) {
    this.baseUrl = `${protocol}://${host}:${port}`;
  }

  async checkConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/id`, {
        timeout: 3000
      });
      const d = response.data;
      return {
        connected: true,
        version: d.version,
        peerId: d.id,
        clusterId: d.cluster_peer_id ?? d.id,
        peername: d.peername,
        clusterPeers: d.cluster_peers,
        ipfsId: d.ipfs?.id,
        addresses: d.addresses
      };
    } catch (error) {
      return {
        ...toErrorPayload(error, { endpoint: `${this.baseUrl}/id` }),
        connected: false,
        code: error.response?.status ?? error.code ?? 'ECONNREFUSED'
      };
    }
  }

  // Upload a file and return its CID
  async add(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath);
      const formData = new FormData();
      formData.append('file', fileContent, {
        filename: path.basename(filePath)
      });

      const response = await axios.post(`${this.baseUrl}/add`, formData, {
        headers: formData.getHeaders()
      });

      return {
        success: true,
        cid: response.data.cid,
        path: path.basename(filePath),
        size: fileContent.length,
        type: 'file',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  }

  // Upload an entire directory and return an array of CIDs
  async dirAdd(dirPath) {
    try {
      const files = fs.readdirSync(dirPath);
      const results = [];
  
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stats = fs.statSync(fullPath);
  
        if (stats.isFile()) {
          const result = await this.add(fullPath);
          if (result.success) {
            results.push({
              name: file,
              cid: result.cid,
              size: result.size,
              path: result.path
            });
          }
        } else if (stats.isDirectory()) {
          const subResults = await this.dirAdd(fullPath);
          if (subResults.success) {
            results.push(...subResults.items); // Only spread if successful
          }
        }
      }
  
      return {
        success: true,
        count: results.length,
        items: results,
        type: 'directory'
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  }

  // Pin a CID to the cluster
  async pin(cid) {
    try {
      const response = await axios.post(`${this.baseUrl}/pins/${cid}`);
      return {
        success: true,
        cid,
        status: 'pinned',
        operation: 'pin',
        timestamp: new Date().toISOString(),
        ...response.data
      };
    } catch (error) {
      return { ...toErrorPayload(error), cid };
    }
  }

  async status(cid) {
    try {
      const response = await axios.get(`${this.baseUrl}/pins/${cid}`);
      const d = response.data;
      const peerMap = d.peer_map && typeof d.peer_map === 'object' ? d.peer_map : {};
      const peersArray = Object.keys(peerMap).map((peerId) => ({
        id: peerId,
        peername: peerMap[peerId].peername,
        ipfs_peer_id: peerMap[peerId].ipfs_peer_id,
        status: peerMap[peerId].status,
        timestamp: peerMap[peerId].timestamp,
        error: peerMap[peerId].error
      }));
      const allStatuses = Object.values(peerMap).map((p) => p.status);
      const overallStatus =
        allStatuses.length === 0
          ? (d.status ?? d.Status ?? null)
          : allStatuses.every((s) => s === 'pinned')
            ? 'pinned'
            : allStatuses.some((s) => s === 'pinned')
              ? 'partial'
              : 'unpinned';
      const allocations = getAllocationsFromStatus(d);
      return {
        success: true,
        cid: d.cid ?? d.Cid ?? cid,
        status: overallStatus,
        peers: peersArray.length ? peersArray : (getPeersFromStatus(d) ?? undefined),
        peer_map: Object.keys(peerMap).length ? peerMap : undefined,
        allocations: allocations ?? undefined,
        replication_factor: d.replication_factor ?? d.ReplicationFactor,
        name: d.name ?? d.Name,
        created: d.created,
        origins: d.origins,
        metadata: d.metadata,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { ...toErrorPayload(error), cid };
    }
  }

  // Remove a pin from the cluster
  async remove(cid) {
    try {
      const response = await axios.delete(`${this.baseUrl}/pins/${cid}`);
      return {
        success: true,
        cid,
        operation: 'remove',
        timestamp: new Date().toISOString(),
        ...response.data
      };
    } catch (error) {
      return { ...toErrorPayload(error), cid };
    }
  }

  // List all pins in the cluster
  async listPins() {
    try {
      const response = await axios.get(`${this.baseUrl}/pins`);
      return {
        success: true,
        count: response.data.pins?.length || 0,
        pins: response.data.pins,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  }

  // Get the allocations (nodes) for a CID (GET /allocations/{cid}).
  // PinInfo may use "allocations", "Allocations", or nested pin_info; we normalize to nodes + pin_info.
  async allocations(cid) {
    try {
      const response = await axios.get(`${this.baseUrl}/allocations/${cid}`);
      const data = response.data;
      const nodes = getAllocationsFromPinInfo(data);
      return {
        success: true,
        cid: data.cid ?? data.Cid ?? cid,
        nodes,
        replication_factor: data.replication_factor ?? data.ReplicationFactor,
        name: data.name ?? data.Name,
        timestamp: new Date().toISOString(),
        pin_info: data
      };
    } catch (error) {
      return { ...toErrorPayload(error), cid };
    }
  }

  async health() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      const data = response.data ?? {};
      return {
        success: true,
        status: response.status === 204 ? 'ok' : (data.status ?? response.status),
        timestamp: new Date().toISOString(),
        details: Object.keys(data).length ? data : { status: 'ok', code: response.status }
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  }

  async version() {
    try {
      const response = await axios.get(`${this.baseUrl}/version`);
      return {
        success: true,
        version: response.data?.version ?? response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  }

  async peers() {
    try {
      const response = await axios.get(`${this.baseUrl}/peers`);
      const data = response.data;
      const list = Array.isArray(data) ? data : data?.peers ?? [];
      return {
        success: true,
        peers: list,
        count: list.length,
        timestamp: new Date().toISOString(),
        details: data
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  }
}

export { IPFSClusterClient };
export { toErrorPayload, getAllocationsFromPinInfo, getPeersFromStatus, getAllocationsFromStatus };