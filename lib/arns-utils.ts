import { ANT, ArweaveSigner, IO } from '@ar.io/sdk'

// Wallet connection utilities
export async function connectWallet(): Promise<string> {
  try {
    // Check if ArConnect is available
    if (typeof window !== 'undefined' && (window as any).arweaveWallet) {
      // Request permissions
      await (window as any).arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION'])
      
      // Get wallet address
      const address = await (window as any).arweaveWallet.getActiveAddress()
      return address
    } else {
      throw new Error('ArConnect wallet not found. Please install ArConnect extension.')
    }
  } catch (error) {
    console.error('Error connecting wallet:', error)
    throw new Error('Failed to connect wallet. Please make sure ArConnect is installed and try again.')
  }
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).arweaveWallet) {
      const address = await (window as any).arweaveWallet.getActiveAddress()
      return address
    }
    return null
  } catch (error) {
    return null
  }
}

// ARNS utilities
export interface ArnsName {
  name: string
  processId: string
  undername?: string
}

export async function getArnsNames(walletAddress: string): Promise<ArnsName[]> {
  try {
    console.log('Fetching ARNS names for address:', walletAddress)
    
    // Initialize IO client
    const io = IO.init()
    
    // Get all ARNS records
    const arnsRecords = await io.getArNSRecords()
    
    // Filter records owned by the wallet address
    const userArnsNames: ArnsName[] = []
    
    for (const [name, record] of Object.entries(arnsRecords)) {
      try {
        // Get the ANT record to check ownership
        const ant = ANT.init({ processId: record.processId })
        const antInfo = await ant.getInfo()
        
        // Check if the wallet address is the owner
        if (antInfo.Owner === walletAddress) {
          userArnsNames.push({
            name,
            processId: record.processId,
            undername: record.undername || '@'
          })
        }
      } catch (error) {
        console.warn(`Failed to check ownership for ${name}:`, error)
        // Continue with other records
      }
    }
    
    console.log('Found ARNS names:', userArnsNames)
    return userArnsNames
    
  } catch (error) {
    console.error('Error fetching ARNS names:', error)
    
    // Fallback: Return mock data for development/testing
    if (process.env.NODE_ENV === 'development') {
      console.log('Using mock ARNS data for development')
      return [
        {
          name: 'example-arns',
          processId: 'mock-process-id-1234567890abcdef',
          undername: '@'
        },
        {
          name: 'test-domain',
          processId: 'mock-process-id-abcdef1234567890',
          undername: 'www'
        }
      ]
    }
    
    throw new Error('Failed to fetch ARNS names. Please try again.')
  }
}

export async function migrateToArns(
  processId: string, 
  undername: string, 
  arweaveUrl: string
): Promise<{ arnsUrl: string; transactionId: string }> {
  try {
    // Extract transaction ID from arweave URL
    const txIdMatch = arweaveUrl.match(/\/([a-zA-Z0-9_-]+)$/)
    if (!txIdMatch) {
      throw new Error('Invalid Arweave URL format')
    }
    
    const transactionId = txIdMatch[1]
    console.log('Migrating transaction ID:', transactionId)
    console.log('To ANT process:', processId)
    console.log('With undername:', undername)
    
    // Check if ArConnect is available
    if (typeof window === 'undefined' || !(window as any).arweaveWallet) {
      throw new Error('ArConnect wallet not found')
    }
    
    // Create signer using ArConnect
    const signer = new ArweaveSigner((window as any).arweaveWallet)
    
    // Initialize ANT
    const ant = ANT.init({ processId, signer })
    
    // Update the undername record
    const result = await ant.setUndernameRecord({
      undername: undername,
      transactionId: transactionId,
      ttlSeconds: 3600 // 1 hour TTL
    }, {
      tags: [
        { name: 'App-Name', value: 'ARNS-Migration-Tool' },
        { name: 'Migration-Source', value: arweaveUrl },
        { name: 'Timestamp', value: new Date().toISOString() }
      ]
    })
    
    // Get the ARNS name from the process ID
    const io = IO.init()
    const arnsRecords = await io.getArNSRecords()
    
    let arnsName = ''
    for (const [name, record] of Object.entries(arnsRecords)) {
      if (record.processId === processId) {
        arnsName = name
        break
      }
    }
    
    if (!arnsName) {
      throw new Error('Could not find ARNS name for the given process ID')
    }
    
    // Construct the final ARNS URL
    const arnsUrl = undername === '@' || !undername 
      ? `https://${arnsName}.ar.io`
      : `https://${undername}_${arnsName}.ar.io`
    
    console.log('Migration successful:', {
      arnsUrl,
      transactionId: result.id || 'pending'
    })
    
    return {
      arnsUrl,
      transactionId: result.id || 'pending'
    }
    
  } catch (error) {
    console.error('Error during migration:', error)
    
    // For development/testing, return a mock successful result
    if (process.env.NODE_ENV === 'development') {
      const txIdMatch = arweaveUrl.match(/\/([a-zA-Z0-9_-]+)$/)
      const transactionId = txIdMatch ? txIdMatch[1] : 'mock-tx-id'
      
      return {
        arnsUrl: undername === '@' 
          ? 'https://example-arns.ar.io'
          : `https://${undername}_example-arns.ar.io`,
        transactionId: 'mock-migration-tx-id'
      }
    }
    
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to validate Arweave transaction ID
export function isValidArweaveId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{43}$/.test(id)
}

// Utility function to extract transaction ID from various Arweave URL formats
export function extractTransactionId(url: string): string | null {
  const patterns = [
    /arweave\.net\/([a-zA-Z0-9_-]{43})/,
    /ar\.io\/([a-zA-Z0-9_-]{43})/,
    /\/([a-zA-Z0-9_-]{43})$/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && isValidArweaveId(match[1])) {
      return match[1]
    }
  }
  
  return null
}