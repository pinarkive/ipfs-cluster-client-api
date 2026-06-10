import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IPFSClusterClient,
  toErrorPayload,
  getAllocationsFromPinInfo,
  getPeersFromStatus,
  getAllocationsFromStatus
} from '../src/index.js';

const PUBLIC_METHODS = [
  'checkConnection',
  'add',
  'dirAdd',
  'pin',
  'status',
  'remove',
  'listPins',
  'allocations',
  'health',
  'version',
  'peers'
];

describe('package exports', () => {
  it('exports IPFSClusterClient and helper functions', () => {
    assert.equal(typeof IPFSClusterClient, 'function');
    assert.equal(typeof toErrorPayload, 'function');
    assert.equal(typeof getAllocationsFromPinInfo, 'function');
    assert.equal(typeof getPeersFromStatus, 'function');
    assert.equal(typeof getAllocationsFromStatus, 'function');
  });
});

describe('IPFSClusterClient', () => {
  it('instantiates with default baseUrl', () => {
    const client = new IPFSClusterClient();
    assert.equal(client.baseUrl, 'http://localhost:9094');
  });

  it('instantiates with custom host, port and protocol', () => {
    const client = new IPFSClusterClient({
      host: 'cluster.internal',
      port: '8080',
      protocol: 'https'
    });
    assert.equal(client.baseUrl, 'https://cluster.internal:8080');
  });

  it('exposes all public async methods', () => {
    const client = new IPFSClusterClient();
    for (const method of PUBLIC_METHODS) {
      assert.equal(typeof client[method], 'function', `missing method: ${method}`);
    }
  });
});

describe('toErrorPayload', () => {
  it('maps HTTP response message and status', () => {
    const error = {
      response: { status: 404, data: { message: 'CID not found' } },
      message: 'Request failed with status code 404'
    };
    const result = toErrorPayload(error);
    assert.equal(result.success, false);
    assert.equal(result.error, 'CID not found');
    assert.equal(result.code, 404);
  });

  it('prefers response.data.error when message is absent', () => {
    const error = {
      response: { status: 503, data: { error: 'service unavailable' } },
      message: 'fail'
    };
    assert.equal(toErrorPayload(error).error, 'service unavailable');
  });

  it('uses error.code when response status is missing', () => {
    const error = { code: 'ECONNREFUSED', message: 'connect refused' };
    const result = toErrorPayload(error, { endpoint: 'http://127.0.0.1:1/id' });
    assert.equal(result.success, false);
    assert.equal(result.code, 'ECONNREFUSED');
    assert.equal(result.error, 'connect refused');
    assert.equal(result.endpoint, 'http://127.0.0.1:1/id');
  });

  it('defaults code to 500 when no status or code is present', () => {
    const result = toErrorPayload({ message: 'unknown failure' });
    assert.equal(result.code, 500);
    assert.equal(result.error, 'unknown failure');
  });
});

describe('getAllocationsFromPinInfo', () => {
  it('reads allocations from common response shapes', () => {
    assert.deepEqual(getAllocationsFromPinInfo({ allocations: ['p1'] }), ['p1']);
    assert.deepEqual(getAllocationsFromPinInfo({ Allocations: ['p2'] }), ['p2']);
    assert.deepEqual(
      getAllocationsFromPinInfo({ pin_info: { allocations: ['p3'] } }),
      ['p3']
    );
    assert.deepEqual(
      getAllocationsFromPinInfo({ pin_info: { Allocations: ['p4'] } }),
      ['p4']
    );
  });

  it('returns empty array when allocations are missing', () => {
    assert.deepEqual(getAllocationsFromPinInfo({}), []);
    assert.deepEqual(getAllocationsFromPinInfo(null), []);
  });
});

describe('getPeersFromStatus', () => {
  it('returns peer_map object when present', () => {
    const peerMap = { QmA: { status: 'pinned' } };
    assert.deepEqual(getPeersFromStatus({ peer_map: peerMap }), peerMap);
  });

  it('returns peers array when present', () => {
    const peers = [{ id: 'QmA' }];
    assert.deepEqual(getPeersFromStatus({ peers }), peers);
  });

  it('returns null when peer data is absent', () => {
    assert.equal(getPeersFromStatus({}), null);
  });
});

describe('getAllocationsFromStatus', () => {
  it('reads allocations from status payload variants', () => {
    assert.deepEqual(getAllocationsFromStatus({ allocations: ['n1'] }), ['n1']);
    assert.deepEqual(getAllocationsFromStatus({ Allocations: ['n2'] }), ['n2']);
  });

  it('returns null when allocations are absent', () => {
    assert.equal(getAllocationsFromStatus({}), null);
  });
});
