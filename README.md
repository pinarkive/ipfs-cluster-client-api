# ipfs-cluster-client-api

> A simple Node.js client library for interacting with the IPFS Cluster HTTP API (one cluster endpoint per client; see [official API reference](https://ipfscluster.io/documentation/reference/api/)).

## Table of contents <!-- omit in toc -->

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
  - [Methods](#methods)
    - [add(filePath)](#addfilepath)
    - [dirAdd(dirPath)](#diradddirpath)
    - [pin(cid)](#pincid)
    - [status(cid)](#statuscid)
    - [remove(cid)](#removecid)
    - [listPins()](#listpins)
    - [allocations(cid)](#allocationscid)
    - [health()](#health)
    - [version()](#version)
    - [peers()](#peers)
    - [checkConnection()](#checkconnection)
- [Requirements](#requirements)
- [Publishing to npm](#publishing-to-npm)
- [License](#license)

## Installation

Install the package and its dependencies via npm:

```bash
npm install ipfs-cluster-client-api axios form-data
```

## Usage

Here's a basic example of how to use the library:

```javascript
const { IPFSClusterClient } = require('ipfs-cluster-client-api');

// Initialize the client with your cluster's host and port
const client = new IPFSClusterClient({ host: 'localhost', port: '9094' });

// Upload a file
client.add('./testfile.txt').then(result => {
  console.log('CID:', result.cid);
}).catch(err => console.error(err));
```

## API

### Methods

#### add(filePath)

Uploads a single file to the IPFS Cluster and returns its CID.

- **Parameters**:
  - `filePath` (string): Path to the file on the local filesystem.
- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, cid, path, size, type: 'file', timestamp }`
  - Failure: `{ success: false, error: string, code: number }`
- **Example**:
```javascript
client.add('/path/to/file.txt').then(result => {
  if (result.success) {
    console.log(`Uploaded ${result.path} with CID: ${result.cid}`);
  }
});
```

#### dirAdd(dirPath)

Uploads an entire directory recursively and returns an array of CIDs.

- **Parameters**:
  - `dirPath` (string): Path to the directory on the local filesystem.
- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, count, items, type: 'directory' }`
  - Failure: `{ success: false, error: string, code: number }`
- **Example**:
```javascript
client.dirAdd('/path/to/directory').then(result => {
  if (result.success) {
    console.log(`Uploaded ${result.count} files:`, result.items);
  }
});
```

#### pin(cid)

Pins a CID to the IPFS Cluster.

- **Parameters**:
  - `cid` (string): Content Identifier to pin.
- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, cid, status: 'pinned', operation: 'pin', timestamp, ...response.data }`
  - Failure: `{ success: false, cid, error: string, code: number }`
- **Example**:
```javascript
client.pin('Qm...').then(result => {
  if (result.success) {
    console.log(`Pinned CID: ${result.cid}`);
  }
});
```

#### status(cid)

Retrieves the status of a CID in the cluster (GET /pins/{cid}). Response is normalized from the cluster’s PinInfo/GlobalPinInfo (peer_map, peers, allocations may vary by cluster version).

- **Parameters**:
  - `cid` (string): Content Identifier to check.
- **Returns**: Promise resolving to:
  - Success: `{ success: true, cid, status, peers, peer_map?, allocations?, replication_factor?, name?, created?, origins?, metadata?, timestamp }`
  - Failure: `{ success: false, cid, error: string, code: number }` (e.g. 404 when CID not in pinset; never throws).
- **Example**:
```javascript
client.status('Qm...').then(result => {
  if (result.success) {
    console.log(`Status: ${result.status}`, result.peer_map || result.peers);
    if (result.allocations) console.log('Allocations:', result.allocations);
  } else if (result.code === 404) {
    console.log('CID not in pinset');
  }
});
```

#### remove(cid)

Removes a pin from the cluster.

- **Parameters**:
  - `cid` (string): Content Identifier to unpin.
- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, cid, operation: 'remove', timestamp, ...response.data }`
  - Failure: `{ success: false, cid, error: string, code: number }`
- **Example**:
```javascript
client.remove('Qm...').then(result => {
  if (result.success) {
    console.log(`Removed CID: ${result.cid}`);
  }
});
```

#### listPins()

Lists all pinned CIDs in the cluster.

- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, count, pins, timestamp }`
  - Failure: `{ success: false, error: string, code: number }`
- **Example**:
```javascript
client.listPins().then(result => {
  if (result.success) {
    console.log(`Total pins: ${result.count}`, result.pins);
  }
});
```

#### allocations(cid)

Gets the nodes (allocations) where a CID is stored (GET /allocations/{cid}). The client normalizes the PinInfo response: the cluster may return `allocations`, `Allocations`, or nested `pin_info` depending on version.

- **Parameters**:
  - `cid` (string): Content Identifier to query.
- **Returns**: Promise resolving to:
  - Success: `{ success: true, cid, nodes: array, replication_factor?, name?, pin_info, timestamp }`
  - Failure: `{ success: false, cid, error: string, code: number }` (e.g. 404 when not in pinset; never throws).
- **Example**:
```javascript
client.allocations('Qm...').then(result => {
  if (result.success) {
    console.log(`Nodes for ${result.cid}:`, result.nodes);
  } else if (result.code === 404) {
    console.log('CID not in pinset');
  }
});
```

#### health()

Gets the health status of the cluster (GET /health; API returns 204 with no body).

- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, status, timestamp, details }`
  - Failure: `{ success: false, error: string, code: number }`
- **Example**:
```javascript
client.health().then(result => {
  if (result.success) console.log('Cluster health:', result.details);
});
```

#### version()

Gets the cluster version (GET /version).

- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, version, timestamp }`
  - Failure: `{ success: false, error: string, code: number }`
- **Example**:
```javascript
client.version().then(result => {
  if (result.success) console.log('Cluster version:', result.version);
});
```

#### peers()

Lists the peers in the cluster (GET /peers).

- **Returns**: Promise resolving to (never throws):
  - Success: `{ success: true, peers, count, timestamp, details }`
  - Failure: `{ success: false, error: string, code: number }`
- **Example**:
```javascript
client.peers().then(result => {
  if (result.success) console.log('Cluster peers:', result.peers ?? result.details);
});
```

#### checkConnection()

Tests the connection to the IPFS Cluster.

- **Returns**: Promise resolving to (never throws):
  - Success: `{ connected: true, version, peerId, clusterId }`
  - Failure: `{ connected: false, success: false, error, code, endpoint }`
- **Example**:
```javascript
client.checkConnection().then(result => {
  if (result.connected) {
    console.log(`Connected to cluster v${result.version}`);
  } else {
    console.log('Connection failed:', result.error);
  }
});
```

## Error handling

All methods **never throw** on HTTP or network errors. On failure they return an object:

- `success: false`
- `error`: string (message from server when available, else `error.message`)
- `code`: HTTP status (e.g. `404` when CID is not in pinset) or `'ECONNREFUSED'` etc.

So the backend can branch on `result.success` and `result.code === 404` for fallbacks or to respond 404 to the client.

## API alignment

Endpoints used (see [ipfscluster.io/documentation/reference/api](https://ipfscluster.io/documentation/reference/api/)):

| Method | Endpoint | Client method |
|--------|----------|----------------|
| GET | /id | checkConnection() |
| POST | /add | add() |
| GET | /pins | listPins() |
| GET | /pins/{cid} | status() |
| POST | /pins/{cid} | pin() |
| DELETE | /pins/{cid} | remove() |
| GET | /allocations/{cid} | allocations() |
| GET | /health | health() |
| GET | /version | version() |
| GET | /peers | peers() |

## Requirements

- **Node.js**: v14.x or higher
- **IPFS Cluster**: A running instance (default: `http://localhost:9094`)
- **Dependencies**:
  - `axios`: For HTTP requests
  - `form-data`: For multipart file uploads
  - `fs` and `path`: Node.js built-in modules

## Publishing to npm

The package is published to npm when you **push a tag** `v*` (e.g. `v0.1.6`). Workflow: [`.github/workflows/publish.yml`](.github/workflows/publish.yml) (environment: **production**).

1. **One-time setup**: Add secret **`NPM_TOKEN`** in the **production** environment (Settings → Environments → production → Environment secrets) or in the repo secrets. Create the token at [npm → Access Tokens](https://www.npmjs.com/settings/~youruser/tokens) (e.g. "Automation" or "Publish").

2. **For each release** (e.g. v0.1.6):
   - Bump `version` in `package.json`, commit and push.
   - Create and push the tag: `git tag v0.1.6 && git push origin v0.1.6`
   - The workflow runs on tag push and runs `npm publish`.

## License

MIT License. See [LICENSE](LICENSE) for details.