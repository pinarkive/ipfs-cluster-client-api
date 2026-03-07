import { IPFSClusterClient } from './src/index.js';

const client = new IPFSClusterClient({ 
  host: '91.99.15.187', 
  port: '9094',
  protocol: 'http'
});

async function verifyClusterConnection() {
  const { connected, error, code, version, peerId } = await client.checkConnection();
  
  if (!connected) {
    throw new Error(`
    Cluster connection failed!
    ========================
    Endpoint: ${client.baseUrl}
    Error: ${error}
    Code: ${code}
    
    Troubleshooting:
    1. Verify cluster is running: ps aux | grep ipfs-cluster-service
    2. Check API port: netstat -tulnp | grep 9094
    3. Test manually: curl ${client.baseUrl}/id
    `);
  }

  console.log(`
  Cluster connected:
  =================
  Peer ID: ${peerId}
  Version: ${version}
  `);
}

async function runTests() {
  await verifyClusterConnection();

  console.log('=== Starting IPFS Cluster Client Tests ===\n');

  // Test variables
  let testCid;

  // 1. Test add() - Upload single file
  console.log('1. Testing add()...');
  const addResult = await client.add('./testfile.txt');
  if (addResult.success) {
    testCid = addResult.cid;
    console.log('✅ add() success:', {
      cid: testCid,
      size: `${addResult.size} bytes`,
      path: addResult.path
    });
  } else {
    console.error('❌ add() failed:', addResult.error);
    return;
  }

  // 2. Test dirAdd() - Upload directory (fixed)
  console.log('\n2. Testing dirAdd()...');
  try {
    const dirResult = await client.dirAdd('./testDir');
    if (dirResult.success) {
      console.log(`✅ dirAdd() success (${dirResult.count} files):`);
      if (dirResult.items && dirResult.items.length > 0) {
        dirResult.items.slice(0, 3).forEach((item, i) => {
          console.log(`   ${i + 1}. ${item.path} (${item.cid})`);
        });
        if (dirResult.count > 3) console.log(`   ...and ${dirResult.count - 3} more`);
      } else {
        console.log('   No files found in directory');
      }
    } else {
      console.error('❌ dirAdd() failed:', dirResult.error);
    }
  } catch (err) {
    console.error('❌ dirAdd() critical error:', err.message);
  }

  // 3. Test pin() - Pin content
  console.log('\n3. Testing pin()...');
  const pinResult = await client.pin(testCid);
  if (pinResult.success) {
    console.log('✅ pin() success:', {
      status: pinResult.status,
      operation: pinResult.operation
    });
  } else {
    console.error('❌ pin() failed:', pinResult.error);
  }

  // 4. Test status() - Check status
  console.log('\n4. Testing status()...');
  const statusResult = await client.status(testCid);
  if (statusResult.success) {
    console.log('✅ status() success:', {
      peers: statusResult.peers?.length || 0,
      status: statusResult.status || 'unknown'
    });
  } else {
    console.error('❌ status() failed:', statusResult.error);
  }

  // 5. Test listPins() - List pinned content
  console.log('\n5. Testing listPins()...');
  const listPinsResult = await client.listPins();
  if (listPinsResult.success) {
    console.log('✅ listPins() success:', {
      totalPins: listPinsResult.count,
      samplePin: listPinsResult.pins?.[0]?.cid || 'N/A'
    });
  } else {
    console.error('❌ listPins() failed:', listPinsResult.error);
  }

  // 6. Test remove() - Remove pin
  console.log('\n6. Testing remove()...');
  const removeResult = await client.remove(testCid);
  if (removeResult.success) {
    console.log('✅ remove() success:', {
      operation: removeResult.operation,
      cid: removeResult.cid
    });
  } else {
    console.error('❌ remove() failed:', removeResult.error);
  }

  // 7. Test allocations() - after remove, CID not in pinset (expect 404 or empty nodes)
  console.log('\n7. Testing allocations()...');
  const allocResult = await client.allocations(testCid);
  if (allocResult.success) {
    console.log('✅ allocations() success:', {
      nodes: allocResult.nodes?.length ?? 0,
      cid: allocResult.cid
    });
  } else {
    if (allocResult.code === 404) {
      console.log('✅ allocations() returned expected error (CID not in pinset):', {
        success: allocResult.success,
        code: allocResult.code,
        hasError: typeof allocResult.error === 'string'
      });
    } else {
      console.log('ℹ️ allocations() failed:', allocResult.error, 'code:', allocResult.code);
    }
  }

  // 7b. Error response shape: any failed call must return { success: false, error, code }
  console.log('\n7b. Testing error response shape...');
  const statusBad = await client.status('QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  const hasErrorShape =
    statusBad.success === false &&
    'error' in statusBad &&
    'code' in statusBad;
  if (hasErrorShape) {
    console.log('✅ Error response shape OK:', { success: false, code: statusBad.code });
  } else {
    console.log('⚠️ Unexpected error shape:', statusBad);
  }

  // 8. Test health() - Cluster health
  console.log('\n8. Testing health()...');
  const healthResult = await client.health();
  if (healthResult.success) {
    const healthStatus = healthResult.status || healthResult.details?.status || 'unknown';
    console.log('✅ health() success:', {
      status: healthStatus,
      details: healthResult.details ? Object.keys(healthResult.details) : 'N/A'
    });
  } else {
    console.error('❌ health() failed:', healthResult.error);
  }

  // 9. Test peers() - Cluster peers
  console.log('\n9. Testing peers()...');
  const peersResult = await client.peers();
  if (peersResult.success) {
    const peersList = peersResult.peers ?? peersResult.details;
    const count = Array.isArray(peersList) ? peersList.length : 0;
    const sample = Array.isArray(peersList) ? peersList[0] : null;
    console.log('✅ peers() success:', {
      count: peersResult.count ?? count,
      samplePeer: sample?.id ?? sample?.peer_id ?? 'N/A'
    });
  } else {
    console.error('❌ peers() failed:', peersResult.error);
  }

  console.log('\n=== Tests completed ===');
}

runTests().catch(err => {
  console.error('⚠️ Unhandled test error:', err);
  process.exit(1);
});